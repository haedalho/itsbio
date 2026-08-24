// scripts/migrate-abm-category-images-to-sanity.mjs
// Usage:
// 1) 특정 category만: node --env-file=.env.local scripts/migrate-abm-category-images-to-sanity.mjs --id category-abm-xxxx
// 2) abm 전체:       node --env-file=.env.local scripts/migrate-abm-category-images-to-sanity.mjs --brand abm
//
// Optional:
// --dryRun (패치 안함)
// --limit 10 (처리 문서 수 제한)

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { createClient } from "next-sanity";
import * as cheerio from "cheerio";

const argv = process.argv.slice(2);
const getArg = (k) => {
  const i = argv.indexOf(k);
  if (i === -1) return null;
  const v = argv[i + 1];
  if (!v || v.startsWith("--")) return null;
  return v;
};
const hasFlag = (k) => argv.includes(k);

const ID = getArg("--id");
const BRAND = (getArg("--brand") || "").toLowerCase();
const DRY = hasFlag("--dryRun");
const LIMIT = Number(getArg("--limit") || 0) || 0;

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET;
const WRITE_TOKEN = [
  process.env.SANITY_WRITE_TOKEN,
  process.env.SANITY_API_WRITE_TOKEN,
  process.env.SANITY_API_TOKEN,
  process.env.SANITY_TOKEN,
  process.env.SANITY_AUTH_TOKEN,
].find((value) => typeof value === "string" && value.trim());

if (!PROJECT_ID || !DATASET) throw new Error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET");
if (!WRITE_TOKEN) throw new Error("Missing SANITY_WRITE_TOKEN (write permission needed)");

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: "2025-01-01",
  token: WRITE_TOKEN,
  useCdn: false,
});

const CACHE_PATH = path.resolve(".cache/abm-image-upload-cache.json");
const ABM_IMAGE_HOSTS = new Set(["abmgood.com", "www.abmgood.com", "info.abmgood.com"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const STATIC_ABM_IMAGE_FILES = [
  "app/products/abm/cellular-materials/cell-library-collections/page.tsx",
  "app/products/abm/cellular-materials/cell-library-collections/crispr-ko-cell-lines/page.tsx",
  "app/products/abm/cellular-materials/cell-library-collections/cas9-expressing-cell-lines/page.tsx",
  "app/products/abm/cellular-materials/cell-library-collections/stem-cell-derived-cells/page.tsx",
  "app/products/abm/cellular-materials/cell-library-collections/stem-cell-derived-cells/neurological/page.tsx",
  "app/products/abm/cellular-materials/cell-library-collections/stem-cell-derived-cells/cardiovascular/page.tsx",
  "components/products/AbmCas9VectorsTableFixClient.tsx",
];

function readCache() {
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { byUrl: {} };
  }
}
function writeCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

function sha1(s) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

function normalizeAbmUrl(src, baseUrl = "https://www.abmgood.com") {
  if (!src) return "";
  const s = String(src).trim();
  if (!s) return "";
  try {
    const parsed = new URL(s, baseUrl);
    if (!ABM_IMAGE_HOSTS.has(parsed.hostname.toLowerCase())) return "";
    if (!/\/(?:assets\/images|assets\/img|assets\/product\/upload|uploads\/images|hubfs)\//i.test(parsed.pathname)) return "";
    if (!/\.(?:avif|gif|jpe?g|png|webp)$/i.test(parsed.pathname)) return "";
    parsed.protocol = "https:";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

async function fetchBinary(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      // 너무 공격적으로 보이지 않게
      "User-Agent": "itsbio-migrator/1.0",
      Accept: "image/*,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${res.statusText}: ${url}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.toLowerCase().startsWith("image/")) throw new Error(`Unsupported image response: ${url}`);
  const expectedBytes = Number.parseInt(res.headers.get("content-length") || "0", 10);
  if (expectedBytes > MAX_IMAGE_BYTES) throw new Error(`Image exceeds 8 MB: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error(`Image exceeds 8 MB: ${url}`);
  return { buf, contentType: ct };
}

function guessExt(contentType, url) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  // fallback: URL
  const m = String(url).toLowerCase().match(/\.(png|jpe?g|webp|gif)(\?|#|$)/);
  return m ? m[1].replace("jpeg", "jpg") : "png";
}

async function uploadImageFromUrl(url, cache) {
  const u = normalizeAbmUrl(url);
  if (!u) return null;

  // cache hit
  const hit = cache.byUrl[u];
  if (hit?.assetId && hit?.assetUrl) return hit;

  const { buf, contentType } = await fetchBinary(u);
  if (!buf?.length) throw new Error(`Empty image: ${u}`);

  const ext = guessExt(contentType, u);
  const filename = `abm-${sha1(u).slice(0, 12)}.${ext}`;

  const asset = await sanity.assets.upload("image", buf, {
    filename,
    contentType: contentType || undefined,
    source: { id: u, name: "Official ABM product and category image" },
  });

  const out = { assetId: asset._id, assetUrl: asset.url };
  cache.byUrl[u] = out;
  return out;
}

function buildPatchForResourcesBlock(block) {
  // contentBlockResources expected:
  // { _key, _type:"contentBlockResources", items:[ { _key, href,title,subtitle,imageUrl,image{asset} } ] }
  const items = Array.isArray(block?.items) ? block.items : [];
  return { ...block, items };
}

async function migrateDocImages(doc, cache) {
  const contentBlocks = Array.isArray(doc?.contentBlocks) ? doc.contentBlocks : [];
  let changed = false;

  // 1) Resources block images
  for (const b of contentBlocks) {
    if (b?._type !== "contentBlockResources") continue;

    const items = Array.isArray(b?.items) ? b.items : [];
    for (const it of items) {
      const imgUrl = it?.imageUrl;
      const hasAsset = Boolean(it?.image?.asset?._ref);

      // 이미 asset 있으면 스킵
      if (hasAsset) continue;

      if (typeof imgUrl === "string" && normalizeAbmUrl(imgUrl)) {
        const uploaded = await uploadImageFromUrl(imgUrl.trim(), cache);
        if (uploaded?.assetId) {
          it.image = {
            _type: "image",
            asset: { _type: "reference", _ref: uploaded.assetId },
          };
          it.imageUrl = uploaded.assetUrl;
          it.assetUrl = uploaded.assetUrl;
          changed = true;
        }
      }
    }
  }

  // 2) HTML block 안의 <img src="...">도 업로드 후 src 치환
  for (const b of contentBlocks) {
    if (b?._type !== "contentBlockHtml") continue;
    const html = typeof b?.html === "string" ? b.html : "";
    if (!html.trim()) continue;

    const $ = cheerio.load(html, { decodeEntities: false }, false);

    const imgs = $("img").toArray();
    if (!imgs.length) continue;

    for (const el of imgs) {
      const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-original") || "";
      const abs = normalizeAbmUrl(src, doc?.sourceUrl || "https://www.abmgood.com");
      if (!abs) continue;
      try {
        const uploaded = await uploadImageFromUrl(abs, cache);
        if (uploaded?.assetUrl) {
          $(el).attr("src", uploaded.assetUrl);
          $(el).removeAttr("srcset data-srcset data-src data-original");
          changed = true;
        }
      } catch (error) {
        console.warn(`! IMAGE ${doc._id} ${abs}: ${error?.message || error}`);
      }
    }

    if (changed) {
      b.html = $.html();
    }
  }

  return { changed, contentBlocks };
}

async function cachePreviouslyManagedImages(cache) {
  const assets = await sanity.fetch(
    '*[_type == "sanity.imageAsset" && defined(source.id) && source.id match "*abmgood.com*"]{_id,url,"sourceUrl":source.id}',
  );
  for (const asset of assets || []) {
    const sourceUrl = normalizeAbmUrl(asset?.sourceUrl);
    if (sourceUrl && asset?._id && asset?.url) {
      cache.byUrl[sourceUrl] = { assetId: asset._id, assetUrl: asset.url };
    }
  }
}

async function migrateStaticCellImages(cache) {
  const imageUrls = new Set();
  for (const filename of STATIC_ABM_IMAGE_FILES) {
    const source = fs.readFileSync(path.resolve(filename), "utf8");
    for (const match of source.matchAll(/https:\/\/(?:www\.)?abmgood\.com\/[\w%./-]+\.(?:avif|gif|jpe?g|png|webp)/gi)) {
      const normalized = normalizeAbmUrl(match[0]);
      if (normalized) imageUrls.add(normalized);
    }
  }

  for (const imageUrl of imageUrls) {
    try {
      await uploadImageFromUrl(imageUrl, cache);
    } catch (error) {
      console.warn(`! STATIC ${imageUrl}: ${error?.message || error}`);
    }
  }
  console.log(`Static ABM cell illustrations reviewed: ${imageUrls.size}`);
}

async function migrateSpecialtyProductImages(cache) {
  const products = await sanity.fetch(`*[
    _type == "product"
    && (brandSlug == "abm" || brand._ref == "brand-abm" || brand->slug.current == "abm")
    && sku match "T*"
    && (title match "*Cas9*" || title match "*CRISPR*" || title match "*Knockout*" || title match "*Stable*" || title match "*Stem*" || title match "*Cardiomyocyte*" || title match "*Neuron*")
    && defined(imageUrls)
  ][0...250]{_id,title,imageUrls,images}`);

  let patched = 0;
  for (const product of products || []) {
    const nextUrls = [...(Array.isArray(product.imageUrls) ? product.imageUrls : [])];
    const nextImages = [...(Array.isArray(product.images) ? product.images : [])];
    let changed = false;

    for (let index = 0; index < nextUrls.length; index += 1) {
      const sourceUrl = normalizeAbmUrl(nextUrls[index]);
      if (!sourceUrl) continue;
      try {
        const asset = await uploadImageFromUrl(sourceUrl, cache);
        if (!asset?.assetId) continue;
        nextUrls[index] = asset.assetUrl;
        if (!nextImages.some((image) => image?.asset?._ref === asset.assetId)) {
          nextImages.push({ _type: "image", _key: sha1(`${product._id}:${asset.assetId}`).slice(0, 12), asset: { _type: "reference", _ref: asset.assetId } });
        }
        changed = true;
      } catch (error) {
        console.warn(`! PRODUCT ${product._id} ${sourceUrl}: ${error?.message || error}`);
      }
    }

    if (changed && !DRY) {
      await sanity.patch(product._id).set({ imageUrls: nextUrls, images: nextImages }).commit({ autoGenerateArrayKeys: true });
      patched += 1;
      console.log(`- PRODUCT ${product._id} (${product.title})`);
    }
  }
  console.log(`Specialty ABM cell products repaired: ${patched}`);
}

async function main() {
  const cache = readCache();
  await cachePreviouslyManagedImages(cache);

  let docs = [];
  if (ID) {
    const d = await sanity.fetch(
      `*[_type=="category" && _id==$id][0]{_id,title,sourceUrl,contentBlocks}`,
      { id: ID }
    );
    if (d?._id) docs = [d];
  } else if (BRAND) {
    // brandKey/themeKey 기준으로 ABM 카테고리 전부 가져오기
    docs = await sanity.fetch(
      `*[_type=="category" && (themeKey==$brand || brandKey==$brand || brand->themeKey==$brand || brand->slug.current==$brand)]
      | order(_createdAt asc){
        _id,title,sourceUrl,contentBlocks
      }`,
      { brand: BRAND }
    );
  } else {
    throw new Error("Provide --id <categoryId> OR --brand <brandKey>");
  }

  if (!docs.length) {
    console.log("No docs found.");
    return;
  }

  const targetDocs = LIMIT ? docs.slice(0, LIMIT) : docs;

  console.log(`Docs: ${targetDocs.length} (dryRun=${DRY})`);

  let patched = 0;

  for (const d of targetDocs) {
    try {
      const beforeCount = Array.isArray(d.contentBlocks) ? d.contentBlocks.length : 0;

      const { changed, contentBlocks } = await migrateDocImages(d, cache);

      if (!changed) {
        console.log(`- SKIP ${d._id} (${d.title}) : no image changes`);
        continue;
      }

      // patch
      if (!DRY) {
        await sanity.patch(d._id).set({ contentBlocks }).commit({ autoGenerateArrayKeys: true });
        patched++;
        console.log(`- PATCHED ${d._id} (${d.title}) blocks=${beforeCount}`);
      } else {
        console.log(`- DRY ${d._id} (${d.title}) would patch`);
      }

      writeCache(cache);
    } catch (e) {
      console.error(`! FAIL ${d._id} (${d.title})`, e?.message || e);
      // 실패해도 다음 문서 계속
    }
  }

  if (BRAND === "abm" && !ID) {
    await migrateStaticCellImages(cache);
    await migrateSpecialtyProductImages(cache);
  }

  writeCache(cache);
  console.log(`Done. patched=${patched}`);
}

main();
