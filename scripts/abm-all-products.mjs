#!/usr/bin/env node
/**
 * ABM All-in-one Products Importer
 *
 * 1) categories-export.json -> ABM category sourceUrl fetch -> product links extract -> product upsert
 * 2) product.sourceUrl fetch -> legacyHtml/specsHtml/extraHtml/docs/images(up로드) enrich
 *
 * Usage:
 *   node --env-file=.env.local scripts/abm-all-products.mjs
 *   node --env-file=.env.local scripts/abm-all-products.mjs --limit-cats 30
 *   node --env-file=.env.local scripts/abm-all-products.mjs --limit-products 50
 *   node --env-file=.env.local scripts/abm-all-products.mjs --enrich-only
 *
 * Required env:
 *  - NEXT_PUBLIC_SANITY_PROJECT_ID
 *  - NEXT_PUBLIC_SANITY_DATASET
 *  - SANITY_WRITE_TOKEN
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "next-sanity";

const BRAND_KEY = "abm";
const BASE = "https://www.abmgood.com";

// ---- args
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const readArg = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
};

const LIMIT_CATS = Number(readArg("--limit-cats") || "0") || 0;
const LIMIT_PRODUCTS = Number(readArg("--limit-products") || "0") || 0;
const ENRICH_ONLY = has("--enrich-only");

// ---- env
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId || !dataset || !token) {
  console.error("Missing env. Need NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_WRITE_TOKEN");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  apiVersion: "2025-01-01",
  useCdn: false,
  token,
});

// ---- tuning (안정 우선)
const FETCH_TIMEOUT_MS = 25000;
const FETCH_RETRY = 2;

const SLEEP_PER_UPSERT_MS = 250;      // product upsert 템포
const SLEEP_PER_CAT_MS = 600;         // 카테고리 간 템포
const SLEEP_PER_ENRICH_MS = 800;      // 제품 enrich 간 템포
const SLEEP_PER_IMAGE_UPLOAD_MS = 250;

const MAX_IMAGES = 12;
const MAX_DOCS = 12;

// ---- utils
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeAbmUrl(u) {
  if (!u) return "";
  let s = String(u).trim();
  s = s.replace(/[\?#].*$/g, "");
  s = s.replace(/^https?:\/\/abmgood\.com\//i, `${BASE}/`);
  return s;
}

function toAbsUrl(u) {
  if (!u) return "";
  let s = String(u).trim();
  if (s.startsWith("//")) s = `https:${s}`;
  if (s.startsWith("/")) s = `${BASE}${s}`;
  if (!/^https?:\/\//i.test(s)) s = `${BASE}/${s.replace(/^\.?\//, "")}`;
  return normalizeAbmUrl(s);
}

function extractSlugFromProductUrl(u) {
  let s = normalizeAbmUrl(u);
  s = s.replace(/^https?:\/\/(www\.)?abmgood\.com\//i, "");
  s = s.replace(/\.html$/i, "");
  s = s.replace(/^\/+|\/+$/g, "");
  return s;
}

function makeDeterministicId(brandKey, slug) {
  const safe = String(slug).replace(/[^a-zA-Z0-9_-]/g, "-");
  return `product-${brandKey}-${safe}`.toLowerCase();
}

async function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
  for (let attempt = 0; attempt <= FETCH_RETRY; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "user-agent": "Mozilla/5.0 (ITSBIO Importer)",
          accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      const msg = e?.name === "AbortError" ? "TIMEOUT" : (e?.message || String(e));
      console.log(`  - fetch error (${attempt + 1}/${FETCH_RETRY + 1}): ${msg}`);
      if (attempt === FETCH_RETRY) throw e;
      await sleep(800 + attempt * 700);
    }
  }
}

// ---- Sanity helpers
async function getBrandId(brandKey) {
  const q = `*[_type=="brand" && (themeKey==$brandKey || slug.current==$brandKey)][0]{_id}`;
  const r = await sanity.fetch(q, { brandKey });
  return r?._id || null;
}

async function findCategoryIdByPath(brandKey, pathArr) {
  const q = `
*[
  _type=="category"
  && !(_id in path("drafts.**"))
  && (
    themeKey == $brandKey
    || brand->themeKey == $brandKey
    || brand->slug.current == $brandKey
  )
  && array::join(path,"/")==$pathStr
][0]{_id}
`;
  const r = await sanity.fetch(q, { brandKey, pathStr: pathArr.join("/") });
  return r?._id || null;
}

async function upsertProduct(doc, id) {
  await sanity.createIfNotExists({ _id: id, ...doc });
  await sanity.patch(id).set(doc).commit({ autoGenerateArrayKeys: true });
}

async function buildExistingSlugSet(brandKey) {
  const q = `
*[
  _type=="product"
  && !(_id in path("drafts.**"))
  && (brand->themeKey==$brandKey || brand->slug.current==$brandKey)
]{
  "slug": slug.current,
  "enrichedAt": enrichedAt
}
`;
  const rows = await sanity.fetch(q, { brandKey });
  const map = new Map(); // slug -> { enrichedAt }
  for (const r of rows || []) {
    if (r?.slug) map.set(String(r.slug), { enrichedAt: r?.enrichedAt || null });
  }
  return map;
}

async function fetchProductsToEnrich(brandKey) {
  const q = `
*[
  _type=="product"
  && !(_id in path("drafts.**"))
  && (brand->themeKey==$brandKey || brand->slug.current==$brandKey)
  && defined(sourceUrl)
  && (!defined(enrichedAt))
]
| order(_createdAt asc){
  _id, title, "slug": slug.current, sourceUrl
}
`;
  const rows = await sanity.fetch(q, { brandKey });
  const list = Array.isArray(rows) ? rows : [];
  return LIMIT_PRODUCTS > 0 ? list.slice(0, LIMIT_PRODUCTS) : list;
}

// ---- HTML parsing (simple, ABM 구조 완벽 파서는 아님 / "한 방"용)
function stripScripts(html) {
  return (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .trim();
}

function extractBody(html) {
  const m = (html || "").match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (m?.[1] || html || "").trim();
}

function rewriteRelativeUrls(html) {
  let out = html || "";
  out = out.replace(/\s(href|src)=["'](\/(?!\/)[^"']*)["']/gi, (_m, attr, p) => ` ${attr}="${BASE}${p}"`);
  out = out.replace(/\s(href|src)=["'](\/\/[^"']+)["']/gi, (_m, attr, p2) => ` ${attr}="https:${p2}"`);
  return out;
}

function replaceEmails(html) {
  return (html || "")
    .replace(/technical@abmgood\.com/gi, "info@itsbio.co.kr")
    .replace(/quotes@abmgood\.com/gi, "info@itsbio.co.kr")
    .replace(/sales@abmgood\.com/gi, "info@itsbio.co.kr");
}

// ✅ specs table에서 Price “행” 제거 (ABM 테이블이 key/value row 형태일 때 잘 먹음)
function removePriceRowsFromTables(html) {
  let out = html || "";
  out = out.replace(
    /<tr[^>]*>[\s\S]*?<t[hd][^>]*>\s*price\s*<\/t[hd]>[\s\S]*?<\/tr>/gi,
    ""
  );
  out = out.replace(
    /<tr[^>]*>[\s\S]*?\bprice\b[\s\S]*?<\/tr>/gi,
    (tr) => (/\$|usd|krw|eur|gbp|price/i.test(tr) ? "" : tr)
  );
  return out;
}

function extractProductLinksFromCategory(html) {
  const out = [];
  const re = /<a\b[^>]*href=["']([^"']+\.html(?:[\?#][^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = toAbsUrl(m[1] || "");
    if (!/abmgood\.com/i.test(href)) continue;
    const inner = (m[2] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    out.push({ href, text: inner });
  }
  // unique
  const seen = new Set();
  const uniq = [];
  for (const x of out) {
    if (seen.has(x.href)) continue;
    seen.add(x.href);
    uniq.push(x);
  }
  return uniq;
}

function extractDocLinks(html) {
  const docs = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const hrefAbs = toAbsUrl(m[1] || "");
    const text = (m[2] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const lower = hrefAbs.toLowerCase();
    if (!(/\.(pdf|doc|docx)(\?|#|$)/i.test(lower))) continue;
    docs.push({ title: text || "Document", url: hrefAbs });
  }
  const seen = new Set();
  const uniq = [];
  for (const d of docs) {
    if (seen.has(d.url)) continue;
    seen.add(d.url);
    uniq.push(d);
  }
  return uniq.slice(0, MAX_DOCS);
}

function extractImgSrcs(html) {
  const srcs = [];
  const re = /<img\b[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = toAbsUrl(m[1] || "");
    if (!u) continue;
    srcs.push(u);
  }
  const seen = new Set();
  const uniq = [];
  for (const s of srcs) {
    if (seen.has(s)) continue;
    seen.add(s);
    uniq.push(s);
  }
  return uniq.slice(0, MAX_IMAGES);
}

// “specs”는 table 위주로 하나 잡고, extra는 body 전체(추후 HtmlContent에서 더 정리)
function pickSpecsAndExtra(bodyHtml) {
  const tables = [];
  const re = /<table[\s\S]*?<\/table>/gi;
  let m;
  while ((m = re.exec(bodyHtml))) tables.push(m[0]);

  let specs = "";
  for (const t of tables) {
    const txt = t.toLowerCase();
    if (txt.includes("spec") || txt.includes("specification") || txt.includes("parameter")) {
      specs = t;
      break;
    }
  }
  if (!specs && tables.length) specs = tables.reduce((a, b) => (a.length >= b.length ? a : b), "");

  return { specsHtml: specs || "", extraHtml: bodyHtml || "" };
}

async function uploadImageToSanity(url) {
  const res = await fetchWithTimeout(url, 25000);
  if (!res.ok) throw new Error(`image fetch failed ${res.status}`);

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  const nameGuess = url.split("/").pop()?.split("?")[0]?.slice(0, 120) || "abm-image";

  const asset = await sanity.assets.upload("image", buf, {
    filename: nameGuess,
    contentType,
  });

  return asset; // { _id, url, ... }
}

// ---- pipeline
async function step1_upsertProductsFromCategories(brandId, existingMap) {
  const file = path.join(process.cwd(), "categories-export.json");
  if (!fs.existsSync(file)) {
    console.error("Missing categories-export.json at project root:", file);
    process.exit(1);
  }

  const cats = JSON.parse(fs.readFileSync(file, "utf-8"));
  const abmCats = (Array.isArray(cats) ? cats : []).filter((c) => {
    const id = String(c?._id || "");
    if (id.startsWith("drafts.")) return false;
    const brandKeyFromDoc = String(c?.brand?.themeKey || c?.brand?.slug?.current || c?.themeKey || "").toLowerCase();
    const src = typeof c?.sourceUrl === "string" ? c.sourceUrl.trim() : "";
    return brandKeyFromDoc === BRAND_KEY && src.length > 0 && Array.isArray(c?.path) && c.path.length;
  });

  const finalCats = LIMIT_CATS > 0 ? abmCats.slice(0, LIMIT_CATS) : abmCats;

  console.log("ABM categories:", finalCats.length);

  let createdOrUpdated = 0;
  let skippedExisting = 0;

  for (let idx = 0; idx < finalCats.length; idx++) {
    const c = finalCats[idx];
    const catUrl = normalizeAbmUrl(c.sourceUrl);
    console.log(`\n[CAT ${idx + 1}/${finalCats.length}] ${c.path.join(" / ")} -> ${catUrl}`);

    let res;
    try {
      res = await fetchWithTimeout(catUrl);
    } catch (e) {
      console.log("  - category fetch error (skip):", e?.message || e);
      await sleep(SLEEP_PER_CAT_MS);
      continue;
    }

    if (!res.ok) {
      console.log("  - fetch failed:", res.status);
      await sleep(SLEEP_PER_CAT_MS);
      continue;
    }

    const html = await res.text();
    const links = extractProductLinksFromCategory(html);

    const candidates = links
      .map((x) => ({ ...x, slug: extractSlugFromProductUrl(x.href) }))
      .filter((x) => x.slug && x.slug.length >= 10);

    console.log("  - candidates:", candidates.length);

    const categoryId = await findCategoryIdByPath(BRAND_KEY, c.path);

    for (const p of candidates) {
      const slug = p.slug;

      // 이미 있으면 스킵 (단, categoryPath/categoryRef 업데이트는 하고 싶으면 아래 로직 수정 가능)
      if (existingMap.has(slug)) {
        skippedExisting++;
        continue;
      }

      const id = makeDeterministicId(BRAND_KEY, slug);
      const title = (p.text && p.text.length >= 3 ? p.text : slug.replaceAll("-", " ")).trim();

      const doc = {
        _type: "product",
        title,
        slug: { _type: "slug", current: slug },
        sourceUrl: `${BASE}/${slug}.html`,
        brand: { _type: "reference", _ref: brandId },
        categoryPath: c.path,
        isActive: true,
        ...(categoryId ? { categoryRef: { _type: "reference", _ref: categoryId } } : {}),
      };

      try {
        await upsertProduct(doc, id);
        existingMap.set(slug, { enrichedAt: null });
        createdOrUpdated++;
      } catch (e) {
        console.log("  - upsert error:", slug, e?.message || e);
      }

      await sleep(SLEEP_PER_UPSERT_MS);
    }

    console.log(`  - progress: created=${createdOrUpdated}, skipped(existing)=${skippedExisting}`);
    await sleep(SLEEP_PER_CAT_MS);
  }

  console.log("\n[STEP1] Done.");
  console.log("Created/Updated:", createdOrUpdated);
  console.log("Skipped(existing):", skippedExisting);
}

async function step2_enrichProducts(existingMap) {
  const targets = await fetchProductsToEnrich(BRAND_KEY);
  console.log("\nTargets to enrich:", targets.length);
  if (!targets.length) {
    console.log("Nothing to enrich (already enriched or no products).");
    return;
  }

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < targets.length; i++) {
    const p = targets[i];
    console.log(`\n[ENRICH ${i + 1}/${targets.length}] ${p.slug || p._id}`);

    const url = normalizeAbmUrl(p.sourceUrl);
    if (!url) {
      console.log("  - no sourceUrl, skip");
      fail++;
      continue;
    }

    let html;
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        console.log("  - fetch failed:", res.status);
        fail++;
        await sleep(SLEEP_PER_ENRICH_MS);
        continue;
      }
      html = await res.text();
    } catch (e) {
      console.log("  - fetch error:", e?.message || e);
      fail++;
      await sleep(SLEEP_PER_ENRICH_MS);
      continue;
    }

    // normalize + rewrite + email replace
    let body = extractBody(html);
    body = stripScripts(body);
    body = rewriteRelativeUrls(body);
    body = replaceEmails(body);

    // docs/images/specs/extra
    const docs = extractDocLinks(body);

    const { specsHtml, extraHtml } = pickSpecsAndExtra(body);
    const specsClean = removePriceRowsFromTables(specsHtml);
    const extraClean = replaceEmails(extraHtml);

    const imgSrcs = extractImgSrcs(body);

    const images = [];
    for (const src of imgSrcs) {
      try {
        const asset = await uploadImageToSanity(src);
        images.push({
          _type: "imageItem",
          asset: { _type: "reference", _ref: asset._id },
          sourceUrl: src,
        });
        await sleep(SLEEP_PER_IMAGE_UPLOAD_MS);
      } catch (e) {
        console.log("  - image upload failed:", src, e?.message || e);
      }
    }

    // patch product
    try {
      await sanity
        .patch(p._id)
        .set({
          legacyHtml: body,          // 원문(정리된) body 저장
          specsHtml: specsClean,
          extraHtml: extraClean,
          docs,
          images,
          enrichedAt: new Date().toISOString(),
        })
        .commit({ autoGenerateArrayKeys: true });

      ok++;
      console.log(`  - done: images=${images.length}, docs=${docs.length}`);
    } catch (e) {
      fail++;
      console.log("  - patch failed:", e?.message || e);
    }

    await sleep(SLEEP_PER_ENRICH_MS);
  }

  console.log("\n[STEP2] Enrich finished.");
  console.log("OK:", ok);
  console.log("FAIL:", fail);
}

// ---- main
async function main() {
  const brandId = await getBrandId(BRAND_KEY);
  if (!brandId) {
    console.error("Brand not found in Sanity:", BRAND_KEY);
    process.exit(1);
  }

  const existingMap = await buildExistingSlugSet(BRAND_KEY);
  console.log("Existing products:", existingMap.size);

  if (!ENRICH_ONLY) {
    await step1_upsertProductsFromCategories(brandId, existingMap);
  }

  await step2_enrichProducts(existingMap);

  console.log("\n✅ ABM all products pipeline done.");
}

main().catch((e) => {
  console.error("\n[abm-all-products] ERROR", e?.message || e);
  process.exit(1);
});
