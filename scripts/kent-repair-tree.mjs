#!/usr/bin/env node
/**
 * scripts/kent-repair-tree.mjs
 *
 * ✅ 느려지지 않게 "데이터만" 고친다:
 *  - 제품 상세(/products/...)에서 product_meta / breadcrumb의 /product/ 카테고리 링크를 읽음
 *  - categoryPath / categoryRef / categoryPathTitles를 보정
 *  - /product/a/b/c/ -> category.path ["a","b","c"] 체인 문서를 Sanity에 생성/연결(parent)
 *  - category 페이지(/product/...)를 한번씩 크롤링해서 contentBlocks(Overview)/summary를 채움
 *
 * Usage:
 *   node .\scripts\kent-repair-tree.mjs --brand kent
 *   node .\scripts\kent-repair-tree.mjs --brand kent --limit 50
 *   node .\scripts\kent-repair-tree.mjs --brand kent --categoryLimit 30
 *   node .\scripts\kent-repair-tree.mjs --brand kent --noUploadImages
 *
 * Env (.env.local):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   NEXT_PUBLIC_SANITY_API_VERSION (optional)
 *   SANITY_WRITE_TOKEN
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import dotenv from "dotenv";
import { load } from "cheerio";
import sanitizeHtml from "sanitize-html";
import { createClient } from "next-sanity";

/* ---------------- env ---------------- */
const repoRoot = process.cwd();
dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const {
  NEXT_PUBLIC_SANITY_PROJECT_ID,
  NEXT_PUBLIC_SANITY_DATASET,
  NEXT_PUBLIC_SANITY_API_VERSION,
  SANITY_WRITE_TOKEN,
} = process.env;

if (!NEXT_PUBLIC_SANITY_PROJECT_ID || !NEXT_PUBLIC_SANITY_DATASET) {
  throw new Error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET");
}
if (!SANITY_WRITE_TOKEN) {
  throw new Error("Missing SANITY_WRITE_TOKEN");
}

const sanity = createClient({
  projectId: NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token: SANITY_WRITE_TOKEN,
  useCdn: false,
});

/* ---------------- args ---------------- */
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const readArg = (k, d) => {
  const i = argv.indexOf(k);
  if (i === -1) return d;
  return argv[i + 1] ?? d;
};

const BRAND_KEY = String(readArg("--brand", "kent")).trim() || "kent";
const LIMIT = Number(readArg("--limit", "0") || "0") || 0; // products limit
const CATEGORY_LIMIT = Number(readArg("--categoryLimit", "0") || "0") || 0; // categories crawl limit
const UPLOAD_IMAGES = !has("--noUploadImages");
const DRY = has("--dry");

const BASE = "https://kentscientific.com";

/* ---------------- cache ---------------- */
const CACHE_DIR = path.join(repoRoot, ".cache", "kent-repair");
const CACHE_PRODUCT_DIR = path.join(CACHE_DIR, "products");
const CACHE_CATEGORY_DIR = path.join(CACHE_DIR, "categories");
fs.mkdirSync(CACHE_PRODUCT_DIR, { recursive: true });
fs.mkdirSync(CACHE_CATEGORY_DIR, { recursive: true });

// image upload cache
const IMG_CACHE_PATH = path.join(CACHE_DIR, "image-upload-cache.json");
function readImgCache() {
  try {
    return JSON.parse(fs.readFileSync(IMG_CACHE_PATH, "utf8"));
  } catch {
    return { byUrl: {} };
  }
}
function writeImgCache(cache) {
  fs.mkdirSync(path.dirname(IMG_CACHE_PATH), { recursive: true });
  fs.writeFileSync(IMG_CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

/* ---------------- utils ---------------- */
function textClean(s) {
  return String(s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
function sha1(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}
function absUrl(base, href) {
  const h = String(href || "").trim();
  if (!h) return "";
  try {
    return new URL(h, base).toString();
  } catch {
    return h;
  }
}
function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.hash = "";
    url.search = "";
    if (url.hostname === "www.kentscientific.com") url.hostname = "kentscientific.com";
    return url.toString();
  } catch {
    return String(u || "").trim();
  }
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function pathFromProductArchiveUrl(u) {
  // /product/a/b/c/
  try {
    const url = new URL(u);
    const p = url.pathname || "";
    const idx = p.indexOf("/product/");
    if (idx === -1) return [];
    const rest = p.slice(idx + "/product/".length).replace(/^\/+/, "").replace(/\/+$/, "");
    if (!rest) return [];
    return rest.split("/").filter(Boolean);
  } catch {
    return [];
  }
}
function stripSiteSuffix(t) {
  let s = textClean(t);
  s = s.replace(/\s*-\s*KENT\s*SCIENTIFIC\s*$/i, "").trim();
  s = s.replace(/\s*-\s*Kent\s*Scientific\s*$/i, "").trim();
  return s;
}
function prettifyTitle(raw) {
  let t = stripSiteSuffix(raw);
  t = t.replace(/\s+Archives$/i, "").trim();
  t = t.replace(/\s+Products$/i, "").trim();
  t = t.replace(/\s*&\s*/g, " & ").replace(/\s+/g, " ").trim();
  return t;
}
function isSanityCdn(url) {
  return String(url || "").includes("cdn.sanity.io/images/");
}
function isJunkImage(url) {
  const u = String(url || "").toLowerCase();
  if (!u) return true;
  return (
    u.includes("logo") ||
    u.includes("favicon") ||
    u.includes("sprite") ||
    u.includes("icon") ||
    u.includes("header") ||
    u.includes("footer") ||
    u.includes("banner") ||
    u.includes("seal") ||
    u.includes("badge") ||
    u.includes("trust") ||
    u.includes("doubleclick") ||
    u.includes("tracking")
  );
}
function sanitizePanel(html) {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "figure",
      "figcaption",
      "iframe",
      "video",
      "source",
      "hr",
    ]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "loading", "width", "height", "data-original-src"],
      iframe: ["src", "title", "allow", "allowfullscreen", "frameborder"],
      "*": ["class", "id", "style"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  }).trim();
}

/* ---------------- http ---------------- */
async function fetchText(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    signal: controller.signal,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
      referer: BASE + "/",
    },
  });

  clearTimeout(t);

  if (res.status === 404) {
    try {
      const uu = new URL(url);
      if (uu.hostname === "www.kentscientific.com") {
        uu.hostname = "kentscientific.com";
        return await fetchText(uu.toString(), timeoutMs);
      }
    } catch {}
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} :: ${url}`);
  return await res.text();
}

async function fetchCached(url, cacheFile) {
  if (fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile, "utf8");
  const html = await fetchText(url, 35000);
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, html, "utf8");
  return html;
}

async function fetchBinary(url, timeoutMs = 35000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    signal: controller.signal,
    headers: {
      "user-agent": "itsbio-kent-repair/1.0",
      accept: "image/*,*/*;q=0.8",
      referer: BASE + "/",
    },
  });

  clearTimeout(t);

  if (res.status === 404) {
    try {
      const uu = new URL(url);
      if (uu.hostname === "www.kentscientific.com") {
        uu.hostname = "kentscientific.com";
        return await fetchBinary(uu.toString(), timeoutMs);
      }
    } catch {}
  }

  if (!res.ok) throw new Error(`Fetch image failed ${res.status} :: ${url}`);
  const ct = res.headers.get("content-type") || "";
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, contentType: ct };
}

function guessExt(contentType, url) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  const m = String(url).toLowerCase().match(/\.(png|jpe?g|webp|gif)(\?|#|$)/);
  return m ? m[1].replace("jpeg", "jpg") : "png";
}

async function uploadImageFromUrl(url, imgCache) {
  const u0 = normalizeUrl(url);
  if (!u0 || isJunkImage(u0)) return null;
  if (isSanityCdn(u0)) return { assetId: "", assetUrl: u0, sourceUrl: u0 };

  const hit = imgCache.byUrl[u0];
  if (hit?.assetId && hit?.assetUrl) return { ...hit, sourceUrl: u0 };

  const { buf, contentType } = await fetchBinary(u0, 35000);
  if (!buf?.length) throw new Error(`Empty image: ${u0}`);

  const ext = guessExt(contentType, u0);
  const filename = `kent-${sha1(u0).slice(0, 12)}.${ext}`;

  const asset = await sanity.assets.upload("image", buf, {
    filename,
    contentType: contentType || undefined,
  });

  const out = { assetId: asset._id, assetUrl: asset.url };
  imgCache.byUrl[u0] = out;
  return { ...out, sourceUrl: u0 };
}

async function rewriteHtmlImagesToSanity(html, imgCache) {
  const input = String(html || "").trim();
  if (!input) return "";

  const $ = load(input, { decodeEntities: false });
  const imgs = $("img").toArray();
  if (!imgs.length) return input;

  let changed = false;
  for (const el of imgs) {
    const $img = $(el);
    const src = String($img.attr("src") || "").trim();
    if (!src) continue;

    const abs = normalizeUrl(absUrl(BASE, src));
    if (!abs || isSanityCdn(abs)) continue;

    const up = await uploadImageFromUrl(abs, imgCache);
    if (up?.assetUrl) {
      $img.attr("data-original-src", src);
      $img.attr("src", up.assetUrl);
      changed = true;
    }
  }

  return changed ? $.html() : input;
}

/* ---------------- sanity helpers ---------------- */
async function ensureBrand() {
  const b = await sanity.fetch(
    `*[_type=="brand" && (slug.current==$k || themeKey==$k)][0]{_id,title,themeKey,"slug":slug.current}`,
    { k: BRAND_KEY }
  );
  if (!b?._id) throw new Error(`Brand not found in Sanity (slug/themeKey=${BRAND_KEY})`);
  return b;
}

async function findCategoryIdByPath(pathArr) {
  const pathStr = pathArr.join("/");
  const existing = await sanity.fetch(
    `*[
      _type=="category"
      && (themeKey==$k || brand->themeKey==$k || brand->slug.current==$k)
      && array::join(path,"/")==$p
    ][0]{_id,title,sourceUrl,summary,contentBlocks}`,
    { k: BRAND_KEY, p: pathStr }
  );
  return existing || null;
}

async function ensureCategoryChain({ brandRef, chainPath, chainTitles, leafUrl }) {
  let parentId = null;
  let leafId = null;

  for (let i = 0; i < chainPath.length; i++) {
    const p = chainPath.slice(0, i + 1);
    const pathStr = p.join("/");
    const docId = `cat_${BRAND_KEY}__${pathStr.replaceAll("/", "__")}`;

    const title =
      (Array.isArray(chainTitles) && chainTitles[i] ? chainTitles[i] : prettifyTitle(p[p.length - 1])) ||
      prettifyTitle(p[p.length - 1]);

    // 각 레벨 URL (가능하면 /product/a/b/ 형태로)
    const levelUrl = leafUrl
      ? normalizeUrl(new URL(`/product/${pathStr}/`, BASE).toString())
      : normalizeUrl(new URL(`/product/${pathStr}/`, BASE).toString());

    const patch = {
      _id: docId,
      _type: "category",
      title,
      brand: brandRef,
      path: p,
      themeKey: BRAND_KEY,
      sourceUrl: levelUrl,
      ...(parentId ? { parent: { _type: "reference", _ref: parentId } } : {}),
    };

    if (!DRY) {
      await sanity.createIfNotExists(patch);
      // 타이틀/소스URL 최신화(있으면 덮어쓰기)
      await sanity
        .patch(docId)
        .set({
          title,
          sourceUrl: levelUrl,
          themeKey: BRAND_KEY,
          ...(parentId ? { parent: { _type: "reference", _ref: parentId } } : { parent: null }),
        })
        .commit();
    }

    parentId = docId;
    leafId = docId;
  }

  return leafId;
}

async function patchProductCategory({ productId, leafCategoryId, categoryPath, categoryTitles }) {
  if (DRY) return;

  const patch = sanity.patch(productId).set({
    categoryRef: leafCategoryId ? { _type: "reference", _ref: leafCategoryId } : null,
    categoryPath: Array.isArray(categoryPath) ? categoryPath : [],
    categoryPathTitles: Array.isArray(categoryTitles) ? categoryTitles : [],
  });

  await patch.commit();
}

/* ---------------- parsing: product -> category path ---------------- */
function parseCategoryFromProductHtml(html, pageUrl) {
  const $ = load(html, { decodeEntities: false });
  const sourceUrl = normalizeUrl($("link[rel='canonical']").attr("href") || pageUrl);

  // 1) product_meta의 카테고리 링크가 가장 정확함
  const metaLinks = [];
  $(".product_meta a[href*='/product/']").each((_, a) => {
    const href = $(a).attr("href") || "";
    const u = normalizeUrl(absUrl(BASE, href));
    const p = pathFromProductArchiveUrl(u);
    if (!p.length) return;
    const t = prettifyTitle(textClean($(a).text()) || p[p.length - 1]);
    metaLinks.push({ pathArr: p, url: u, title: t });
  });

  metaLinks.sort((a, b) => b.pathArr.length - a.pathArr.length);

  // 2) breadcrumb도 chain title 얻는 데 도움
  const crumbTitles = [];
  $("nav.woocommerce-breadcrumb a[href*='/product/']").each((_, a) => {
    const href = $(a).attr("href") || "";
    const u = normalizeUrl(absUrl(BASE, href));
    const p = pathFromProductArchiveUrl(u);
    if (!p.length) return;
    crumbTitles.push(prettifyTitle(textClean($(a).text()) || p[p.length - 1]));
  });

  const best = metaLinks[0] || null;
  if (!best) return { sourceUrl, leafPath: [], leafUrl: "", chainTitles: [] };

  // chainTitles는 breadcrumb이 길이 맞으면 breadcrumb을 우선 사용
  const chainTitles =
    crumbTitles.length === best.pathArr.length
      ? crumbTitles
      : best.pathArr.map((seg, i) => metaLinks.find((x) => x.pathArr.length === i + 1)?.title || prettifyTitle(seg));

  return {
    sourceUrl,
    leafPath: best.pathArr,
    leafUrl: best.url,
    chainTitles,
  };
}

/* ---------------- parsing: category page content ---------------- */
function pickMain($) {
  const sels = ["main", "#primary", "#content", ".site-main", "#main", "body"];
  for (const s of sels) {
    const $el = $(s).first();
    if ($el.length) return $el;
  }
  return $("body");
}

function firstNonJunkImageUrl($, $scope) {
  let out = "";
  $scope.find("img").each((_, el) => {
    if (out) return;
    const src = $(el).attr("data-src") || $(el).attr("src") || "";
    if (!src) return;
    const u = normalizeUrl(absUrl(BASE, src));
    if (!u || isJunkImage(u)) return;
    out = u;
  });
  return out;
}

function parseCategoryPage(html, url) {
  const $ = load(html, { decodeEntities: false });
  const canonical = $("link[rel='canonical']").attr("href");
  const sourceUrl = normalizeUrl(canonical || url);

  const $main = pickMain($);
  $main.find("script,noscript,style,header,footer,nav,form").remove();

  const title =
    textClean($(".woocommerce-products-header__title").first().text()) ||
    textClean($("h1").first().text()) ||
    stripSiteSuffix(textClean($("title").text())) ||
    "";

  const $desc =
    $(".woocommerce-products-header__description").first().length
      ? $(".woocommerce-products-header__description").first()
      : $(".term-description").first().length
        ? $(".term-description").first()
        : $(".archive-description").first().length
          ? $(".archive-description").first()
          : $(".taxonomy-description").first();

  let descHtml = $desc.length ? ($desc.html() || "") : "";
  descHtml = sanitizePanel(descHtml);

  if (!textClean(load(descHtml || "").text())) {
    descHtml = `<p>Browse products in <strong>${title || "this category"}</strong>.</p>`;
  }

  let heroUrl = "";
  const $header = $(".woocommerce-products-header").first();
  if ($header.length) heroUrl = firstNonJunkImageUrl($, $header);
  if (!heroUrl) heroUrl = firstNonJunkImageUrl($, $main);

  const summary = textClean(load(descHtml).text()).slice(0, 240);
  const legacyHtml = ($main.html() || "").slice(0, 180000);

  return { title: prettifyTitle(title), sourceUrl, descHtml, heroUrl, summary, legacyHtml };
}

async function patchCategoryContent({ categoryId, parsed, imgCache }) {
  const existing = await sanity.fetch(
    `*[_id==$id][0]{_id, summary, contentBlocks}`,
    { id: categoryId }
  );

  const hasBlocks = Array.isArray(existing?.contentBlocks) && existing.contentBlocks.length > 0;
  const hasSummary = !!textClean(existing?.summary || "");

  // 이미 채워졌으면 스킵(속도)
  if (hasBlocks && hasSummary) return false;

  let overviewHtml = parsed.descHtml || "";
  let heroAssetId = "";

  if (UPLOAD_IMAGES) {
    overviewHtml = sanitizePanel(await rewriteHtmlImagesToSanity(overviewHtml, imgCache));

    if (parsed.heroUrl && !isJunkImage(parsed.heroUrl)) {
      const up = await uploadImageFromUrl(parsed.heroUrl, imgCache);
      if (up?.assetId) heroAssetId = up.assetId;
    }
  }

  if (DRY) return true;

  const patch = sanity.patch(categoryId).set({
    summary: parsed.summary || "",
    legacyHtml: parsed.legacyHtml || "",
    contentBlocks: [
      {
        _type: "contentBlockHtml",
        title: "Overview",
        html: overviewHtml || "",
      },
    ].filter((b) => textClean(b.html)),
    ...(heroAssetId
      ? { heroImage: { _type: "image", asset: { _type: "reference", _ref: heroAssetId } } }
      : {}),
  });

  await patch.commit({ autoGenerateArrayKeys: true });
  return true;
}

/* ---------------- main ---------------- */
async function main() {
  console.log(`[kent-repair] brand=${BRAND_KEY} dry=${DRY} uploadImages=${UPLOAD_IMAGES} limit=${LIMIT || "ALL"} categoryLimit=${CATEGORY_LIMIT || "ALL"}`);

  const brand = await ensureBrand();
  const brandRef = { _type: "reference", _ref: brand._id };

  // 1) Sanity에서 Kent 제품 목록 가져오기(이미 import된 것 기준)
  const products = await sanity.fetch(
    `*[
      _type=="product"
      && isActive==true
      && (brand->slug.current==$k || brand->themeKey==$k)
      && defined(sourceUrl)
    ]|order(_updatedAt desc){
      _id,
      title,
      "slug": slug.current,
      sourceUrl,
      categoryPath,
      categoryRef
    }`,
    { k: BRAND_KEY }
  );

  const targetProducts = LIMIT > 0 ? products.slice(0, LIMIT) : products;
  console.log(`- products to inspect: ${targetProducts.length}`);

  const discoveredCategoryUrls = new Map(); // pathStr -> url

  // image cache
  const imgCache = readImgCache();
  let imgDirty = 0;
  const flushImg = () => {
    if (!DRY && imgDirty > 0) {
      writeImgCache(imgCache);
      imgDirty = 0;
    }
  };

  // 2) 제품별로 카테고리 chain 생성 + 제품 categoryPath/ref 보정
  let okProd = 0;
  let skipProd = 0;
  let failProd = 0;

  for (let i = 0; i < targetProducts.length; i++) {
    const p = targetProducts[i];
    const url = normalizeUrl(p.sourceUrl || "");
    if (!url) {
      skipProd++;
      continue;
    }

    const cacheFile = path.join(CACHE_PRODUCT_DIR, `${p.slug || sha1(p._id).slice(0, 12)}.html`);

    try {
      const html = await fetchCached(url, cacheFile);
      const parsed = parseCategoryFromProductHtml(html, url);

      const leafPath = parsed.leafPath || [];
      if (!leafPath.length) {
        skipProd++;
        continue;
      }

      const pathStr = leafPath.join("/");
      discoveredCategoryUrls.set(pathStr, parsed.leafUrl || normalizeUrl(new URL(`/product/${pathStr}/`, BASE).toString()));

      // ensure category chain docs
      const leafId = await ensureCategoryChain({
        brandRef,
        chainPath: leafPath,
        chainTitles: parsed.chainTitles || [],
        leafUrl: parsed.leafUrl,
      });

      // patch product if missing or mismatched
      const needPatch =
        !Array.isArray(p.categoryPath) ||
        p.categoryPath.join("/") !== pathStr ||
        !p.categoryRef?._ref;

      if (needPatch) {
        await patchProductCategory({
          productId: p._id,
          leafCategoryId: leafId,
          categoryPath: leafPath,
          categoryTitles: parsed.chainTitles || leafPath.map((s) => prettifyTitle(s)),
        });
      }

      okProd++;
      if ((i + 1) % 25 === 0) console.log(`  products: ${i + 1}/${targetProducts.length} ok=${okProd} skip=${skipProd} fail=${failProd}`);
      await sleep(80);
    } catch (e) {
      failProd++;
      console.log(`  - ❌ product fail: ${url}`);
      console.log(`    ${e?.message || e}`);
      await sleep(150);
    }
  }

  console.log(`- product pass done: ok=${okProd} skip=${skipProd} fail=${failProd}`);

  // 3) 카테고리 본문 채우기(contentBlocks/summary)
  const categoryPaths = [...discoveredCategoryUrls.keys()].sort((a, b) => a.split("/").length - b.split("/").length);
  const targetCats = CATEGORY_LIMIT > 0 ? categoryPaths.slice(0, CATEGORY_LIMIT) : categoryPaths;

  console.log(`- categories to patch content: ${targetCats.length} / discovered=${categoryPaths.length}`);

  let okCat = 0;
  let skipCat = 0;
  let failCat = 0;

  for (let i = 0; i < targetCats.length; i++) {
    const pathStr = targetCats[i];
    const pathArr = pathStr.split("/").filter(Boolean);

    const cat = await findCategoryIdByPath(pathArr);
    if (!cat?._id) {
      skipCat++;
      continue;
    }

    // 이미 blocks/summary 있으면 skip (속도)
    const hasBlocks = Array.isArray(cat.contentBlocks) && cat.contentBlocks.length > 0;
    const hasSummary = !!textClean(cat.summary || "");
    if (hasBlocks && hasSummary) {
      skipCat++;
      continue;
    }

    const url = normalizeUrl(cat.sourceUrl || discoveredCategoryUrls.get(pathStr) || new URL(`/product/${pathStr}/`, BASE).toString());
    const cacheFile = path.join(CACHE_CATEGORY_DIR, `${pathStr.replaceAll("/", "__")}.html`);

    try {
      const html = await fetchCached(url, cacheFile);
      const parsed = parseCategoryPage(html, url);

      const changed = await patchCategoryContent({ categoryId: cat._id, parsed, imgCache });
      if (changed) okCat++;
      else skipCat++;

      imgDirty++;
      if ((i + 1) % 10 === 0) flushImg();
      await sleep(90);
    } catch (e) {
      failCat++;
      console.log(`  - ❌ category fail: ${url}`);
      console.log(`    ${e?.message || e}`);
      await sleep(150);
    }
  }

  flushImg();

  console.log(`[kent-repair] DONE`);
  console.log(`- products: ok=${okProd} skip=${skipProd} fail=${failProd}`);
  console.log(`- categories: ok=${okCat} skip=${skipCat} fail=${failCat}`);
}

main().catch((e) => {
  console.error("\n[kent-repair] ERROR", e?.message || e);
  process.exit(1);
});