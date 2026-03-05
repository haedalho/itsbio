#!/usr/bin/env node
/**
 * scripts/kent-all.mjs (v4)
 * - 카테고리: sitemap의 /product/ 링크 seed + 카테고리 페이지에서 /product/ 링크를 다시 수집(BFS)해서 하위 트리 완성
 * - 카테고리 본문: contentBlocks(HTML) 무조건 채움(빈 경우 fallback 문장)
 * - 제품: sitemap의 /products/ 링크 수집 → 제품 상세에서 product_meta의 /product/ 카테고리 링크로 categoryPath 확정
 * - 이미지: gallery + HTML img 모두 Sanity asset로 업로드 후 cdn.sanity.io로 치환(외부 이미지 0)
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import dotenv from "dotenv";
import { load } from "cheerio";
import sanitizeHtml from "sanitize-html";
import { createClient } from "next-sanity";

/* env */
const repoRoot = process.cwd();
dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const {
  NEXT_PUBLIC_SANITY_PROJECT_ID,
  NEXT_PUBLIC_SANITY_DATASET,
  NEXT_PUBLIC_SANITY_API_VERSION,
  SANITY_WRITE_TOKEN,
} = process.env;

if (!NEXT_PUBLIC_SANITY_PROJECT_ID || !NEXT_PUBLIC_SANITY_DATASET) throw new Error("Missing SANITY project/dataset");
if (!SANITY_WRITE_TOKEN) throw new Error("Missing SANITY_WRITE_TOKEN");

const sanity = createClient({
  projectId: NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token: SANITY_WRITE_TOKEN,
  useCdn: false,
});

/* args */
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const readArg = (k, d) => {
  const i = argv.indexOf(k);
  if (i === -1) return d;
  return argv[i + 1] ?? d;
};

const DRY = has("--dry");
const BRAND_KEY = String(readArg("--brand", "kent")).trim() || "kent";
const LIMIT = Number(readArg("--limit", "0") || "0") || 0;
const CATEGORY_LIMIT = Number(readArg("--categoryLimit", "0") || "0") || 0;
const UPLOAD_IMAGES = !has("--noUploadImages");
const ONLY_CATEGORIES = has("--onlyCategories");
const ONLY_PRODUCTS = has("--onlyProducts");

const SITEMAP_URL = String(readArg("--sitemap", "https://www.kentscientific.com/site-map/")).trim();
const BASE = "https://kentscientific.com";

/* cache */
const CACHE_DIR = path.join(repoRoot, ".cache", "kent");
const CACHE_SITEMAP = path.join(CACHE_DIR, "sitemap.html");
const CACHE_PAGES_DIR = path.join(CACHE_DIR, "pages");
const CACHE_CAT_DIR = path.join(CACHE_DIR, "categories");
fs.mkdirSync(CACHE_PAGES_DIR, { recursive: true });
fs.mkdirSync(CACHE_CAT_DIR, { recursive: true });

const IMG_CACHE_PATH = path.join(CACHE_DIR, "kent-image-upload-cache.json");
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

/* utils */
function textClean(s) {
  return String(s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
function sha1(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function absUrl(base, href) {
  try {
    return new URL(String(href || ""), base).toString();
  } catch {
    return String(href || "");
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
function isSanityCdn(url) {
  return String(url || "").includes("cdn.sanity.io/images/");
}
function isJunkImage(url) {
  const u = String(url || "").toLowerCase();
  return (
    !u ||
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
    u.includes("doubleclick")
  );
}
function sanitizePanel(html) {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img","table","thead","tbody","tr","th","td","figure","figcaption","iframe","video","source","hr"
    ]),
    allowedAttributes: {
      a: ["href","name","target","rel"],
      img: ["src","alt","title","loading","width","height","data-original-src"],
      iframe: ["src","title","allow","allowfullscreen","frameborder"],
      "*": ["class","id","style"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  }).trim();
}
function prettifyTitle(raw) {
  let t = textClean(raw);
  t = t.replace(/\s*\|\s*.*$/g, "").trim();
  t = t.replace(/\s*-\s*KENT\s*SCIENTIFIC\s*$/i, "").trim();
  t = t.replace(/\s+Archives$/i, "").trim();
  t = t.replace(/\s+Products$/i, "").trim();
  t = t.replace(/\s*&\s*/g, " & ").replace(/\s+/g, " ").trim();
  return t;
}
function pathFromProductArchiveUrl(u) {
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
function slugFromProductsUrl(u) {
  try {
    const url = new URL(u);
    const p = url.pathname.replace(/\/+$/, "");
    const parts = p.split("/").filter(Boolean);
    const i = parts.indexOf("products");
    if (i >= 0 && parts[i + 1]) return parts[i + 1];
    return parts.at(-1) || "";
  } catch {
    return "";
  }
}

/* http */
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
    // www -> non-www retry
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

async function fetchCached(url, cacheFile, timeoutMs = 30000) {
  if (fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile, "utf8");
  const html = await fetchText(url, timeoutMs);
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, html, "utf8");
  return html;
}

async function fetchBinary(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    signal: controller.signal,
    headers: {
      "user-agent": "itsbio-kent-migrator/1.0",
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
    if (!abs) continue;
    if (isSanityCdn(abs)) continue;

    const up = await uploadImageFromUrl(abs, imgCache);
    if (up?.assetUrl) {
      $img.attr("data-original-src", src);
      $img.attr("src", up.assetUrl);
      changed = true;
    }
  }
  return changed ? $.html() : input;
}

/* sanity helpers */
async function ensureBrand() {
  const b = await sanity.fetch(
    `*[_type=="brand" && (slug.current==$k || themeKey==$k)][0]{_id}`,
    { k: BRAND_KEY }
  );
  if (!b?._id) throw new Error(`Brand not found in Sanity (slug/themeKey=${BRAND_KEY})`);
  return { _type: "reference", _ref: b._id, _id: b._id };
}

async function ensureCategoryByPath({ brandRef, title, pathArr, sourceUrl, parentId, order }) {
  const pathStr = pathArr.join("/");
  const existing = await sanity.fetch(
    `*[_type=="category"
      && (themeKey==$k || brand->themeKey==$k || brand->slug.current==$k)
      && array::join(path,"/")==$p
    ][0]{_id}`,
    { k: BRAND_KEY, p: pathStr }
  );

  if (existing?._id) {
    if (!DRY) {
      await sanity.patch(existing._id).set({
        title,
        path: pathArr,
        themeKey: BRAND_KEY,
        sourceUrl: sourceUrl || null,
        brand: brandRef,
        order: typeof order === "number" ? order : 0,
        ...(parentId ? { parent: { _type: "reference", _ref: parentId } } : { parent: null }),
      }).commit();
    }
    return existing._id;
  }

  const newId = `cat_${BRAND_KEY}__${pathStr.replaceAll("/", "__")}`;
  if (!DRY) {
    await sanity.createIfNotExists({
      _id: newId,
      _type: "category",
      title,
      path: pathArr,
      themeKey: BRAND_KEY,
      sourceUrl: sourceUrl || null,
      brand: brandRef,
      order: typeof order === "number" ? order : 0,
      ...(parentId ? { parent: { _type: "reference", _ref: parentId } } : {}),
    });
  }
  return newId;
}

async function patchCategoryContent({ categoryId, summary, heroAssetId, overviewHtml, legacyHtml }) {
  if (DRY) return;
  const contentBlocks = [
    {
      _type: "contentBlockHtml",
      title: "Overview",
      html: overviewHtml || "",
    },
  ].filter((b) => textClean(b.html));

  await sanity.patch(categoryId).set({
    summary: summary || "",
    legacyHtml: legacyHtml || "",
    contentBlocks: contentBlocks.length ? contentBlocks : [{
      _type: "contentBlockHtml",
      title: "Overview",
      html: `<p>Browse products in this category.</p>`,
    }],
    ...(heroAssetId
      ? { heroImage: { _type: "image", asset: { _type: "reference", _ref: heroAssetId } } }
      : {}),
  }).commit({ autoGenerateArrayKeys: true });
}

async function upsertProduct({ brandRef, slug, data }) {
  const existing = await sanity.fetch(
    `*[_type=="product" && slug.current==$slug && (brand->slug.current==$k || brand->themeKey==$k)][0]{_id}`,
    { slug, k: BRAND_KEY }
  );

  const docId = existing?._id || `prod_${BRAND_KEY}__${slug}`;
  const payload = {
    _id: docId,
    _type: "product",
    isActive: true,
    title: data.title || slug,
    brand: brandRef,
    slug: { _type: "slug", current: slug },
    sku: data.sku || "",
    sourceUrl: data.sourceUrl || null,
    legacyHtml: data.legacyHtml || "",
    datasheetHtml: data.datasheetHtml || "",
    documentsHtml: data.documentsHtml || "",
    referencesHtml: data.referencesHtml || "",
    imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
    images: Array.isArray(data.images) ? data.images : [],
    docs: Array.isArray(data.docs)
      ? data.docs.map((d) => ({ _type: "docItem", title: d.title || "Document", url: d.url || "" }))
      : [],
    categoryPath: Array.isArray(data.categoryPath) ? data.categoryPath : [],
    categoryPathTitles: Array.isArray(data.categoryPathTitles) ? data.categoryPathTitles : [],
    ...(data.categoryRefId ? { categoryRef: { _type: "reference", _ref: data.categoryRefId } } : {}),
    enrichedAt: new Date().toISOString(),
    order: 0,
  };

  if (DRY) return;

  if (!existing?._id) await sanity.createIfNotExists(payload);
  else await sanity.patch(docId).set(payload).commit({ autoGenerateArrayKeys: true });
}

/* parsing */
function collectCategorySeedsFromSitemap($) {
  const map = new Map(); // pathStr -> {title,url,order}
  let order = 0;

  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") || "";
    if (!href.includes("/product/")) return;
    const url = normalizeUrl(absUrl(SITEMAP_URL, href));
    const pathArr = pathFromProductArchiveUrl(url);
    if (!pathArr.length) return;

    const title = prettifyTitle(textClean($(a).text()) || pathArr[pathArr.length - 1]);
    const pathStr = pathArr.join("/");

    if (!map.has(pathStr)) {
      map.set(pathStr, { title, url, pathArr, order: order++ });
    }
  });

  // root 먼저, 그 다음 길이순
  return [...map.values()].sort((a, b) => a.pathArr.length - b.pathArr.length || a.order - b.order);
}

function collectProductUrlsFromSitemap($) {
  const map = new Map(); // slug -> url
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") || "";
    const u = normalizeUrl(absUrl(SITEMAP_URL, href));
    try {
      const uu = new URL(u);
      if (!uu.pathname.startsWith("/products/")) return;
      const slug = slugFromProductsUrl(uu.toString());
      if (!slug) return;
      if (!map.has(slug)) map.set(slug, normalizeUrl(uu.toString()));
    } catch {}
  });
  return [...map.values()];
}

function parseCategoryPage(html, url) {
  const $ = load(html, { decodeEntities: false });
  const $main = $("main").first().length ? $("main").first() : $("body");

  $main.find("script,noscript,style,header,footer,nav,form").remove();

  const title =
    textClean($(".woocommerce-products-header__title").first().text()) ||
    textClean($("h1").first().text()) ||
    prettifyTitle(textClean($("title").text())) ||
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

  // hero: 페이지에서 첫 유효 img
  let heroUrl = "";
  $main.find("img").each((_, img) => {
    if (heroUrl) return;
    const src = $(img).attr("data-src") || $(img).attr("src") || "";
    const u = normalizeUrl(absUrl(BASE, src));
    if (!u || isJunkImage(u)) return;
    heroUrl = u;
  });

  const summary = textClean(load(descHtml).text()).slice(0, 240);
  const legacyHtml = ($main.html() || "").slice(0, 180000);

  // ✅ 하위 카테고리 링크 수집(/product/...)
  const childLinks = [];
  $("a[href*='/product/']").each((_, a) => {
    const href = $(a).attr("href") || "";
    const u = normalizeUrl(absUrl(BASE, href));
    const p = pathFromProductArchiveUrl(u);
    if (!p.length) return;
    const t = prettifyTitle(textClean($(a).text()) || p[p.length - 1]);
    childLinks.push({ title: t, url: u, pathArr: p });
  });

  // dedupe
  const seen = new Set();
  const children = [];
  for (const c of childLinks) {
    const k = c.pathArr.join("/");
    if (seen.has(k)) continue;
    seen.add(k);
    children.push(c);
  }

  return { title, url: normalizeUrl(url), descHtml, heroUrl, summary, legacyHtml, children };
}

function parseProduct(html, url) {
  const $ = load(html, { decodeEntities: false });
  const canonical = $("link[rel='canonical']").attr("href");
  const sourceUrl = normalizeUrl(canonical || url);

  const title = textClean($("h1").first().text()) || prettifyTitle(textClean($("title").text())) || "Untitled";

  // Item #
  const metaText = textClean($(".product_meta").text());
  let sku = "";
  let m = metaText.match(/\bItem\s*#\s*[:#]?\s*([A-Za-z0-9-]{2,40})\b/i);
  if (m) sku = m[1];

  // ✅ 카테고리: product_meta의 /product/ 링크가 가장 안정적
  const catCandidates = [];
  $(".product_meta a[href*='/product/']").each((_, a) => {
    const href = $(a).attr("href") || "";
    const u = normalizeUrl(absUrl(BASE, href));
    const p = pathFromProductArchiveUrl(u);
    if (!p.length) return;
    const t = prettifyTitle(textClean($(a).text()) || p[p.length - 1]);
    catCandidates.push({ pathArr: p, title: t, url: u });
  });

  // deepest path pick
  catCandidates.sort((a, b) => b.pathArr.length - a.pathArr.length);
  const bestCat = catCandidates[0] || null;

  const categoryPath = bestCat?.pathArr || [];
  const categoryPathTitles = categoryPath.length ? categoryPath.map((seg) => prettifyTitle(seg)) : [];

  // images
  const imageUrls = [];
  $(".woocommerce-product-gallery img").each((_, img) => {
    const src = $(img).attr("data-src") || $(img).attr("src") || "";
    const u = normalizeUrl(absUrl(BASE, src));
    if (!u || isJunkImage(u)) return;
    imageUrls.push(u);
  });

  // description tab
  let datasheetRaw = "";
  const descPanelId =
    $("a[href='#tab-description']").length ? "tab-description" : $("div.woocommerce-Tabs-panel--description").attr("id");
  if (descPanelId) {
    const $panel = $(`#${cssEscape(descPanelId)}`);
    datasheetRaw = $panel.length ? $panel.html() || "" : "";
  }
  if (!datasheetRaw) datasheetRaw = $(".summary").first().html() || $("main").html() || $("body").html() || "";

  const $main = $("main").first().length ? $("main").first() : $("body");
  const videosRaw = extractSectionByHeading($, $main, /product\s*videos?/i);
  const resourcesRaw = extractSectionByHeading($, $main, /\bresources?\b/i);
  const pubsRaw = extractSectionByHeading($, $main, /(scientific\s+publications?|publications)/i);
  const documentsCombined = [videosRaw, resourcesRaw].filter(Boolean).join("\n<hr/>\n");

  // pdf docs
  const docs = [];
  $main.find("a[href]").each((_, a) => {
    const href = $(a).attr("href") || "";
    const u = normalizeUrl(absUrl(BASE, href));
    if (!u.toLowerCase().includes(".pdf")) return;
    const t = textClean($(a).text()) || "Document";
    docs.push({ title: t, url: u });
  });

  return {
    title,
    sku,
    sourceUrl,
    legacyHtml: ($main.html() || "").slice(0, 180000),
    datasheetHtml: sanitizePanel(datasheetRaw),
    documentsHtml: sanitizePanel(documentsCombined),
    referencesHtml: sanitizePanel(pubsRaw),
    imageUrls: [...new Set(imageUrls)],
    docs: docs,
    categoryPath,
    categoryPathTitles,
  };
}

function cssEscape(id) {
  return String(id || "").replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, "\\$1");
}

function extractSectionByHeading($, $main, headingRegex) {
  const $h = $main.find("h1,h2,h3,h4").filter((_, el) => headingRegex.test(textClean($(el).text()))).first();
  if (!$h.length) return "";
  const parts = [];
  let $cur = $h.next();
  let guard = 0;
  while ($cur.length && guard < 80) {
    const tag = ($cur.get(0)?.tagName || "").toLowerCase();
    if (["h1","h2","h3","h4"].includes(tag)) break;
    parts.push($.html($cur));
    $cur = $cur.next();
    guard++;
  }
  return parts.join("\n");
}

/* main */
async function main() {
  console.log(`[kent-all] brand=${BRAND_KEY} dry=${DRY} limit=${LIMIT||"ALL"} categoryLimit=${CATEGORY_LIMIT||"ALL"} uploadImages=${UPLOAD_IMAGES}`);
  console.log(`[kent-all] sitemap=${SITEMAP_URL}`);

  const brand = await ensureBrand();
  const brandRef = { _type: "reference", _ref: brand._id };

  const imgCache = readImgCache();
  let imgDirty = 0;
  const flushImg = () => {
    if (!DRY && imgDirty > 0) {
      writeImgCache(imgCache);
      imgDirty = 0;
    }
  };

  // sitemap
  const sitemapHtml = await fetchCached(SITEMAP_URL, CACHE_SITEMAP, 35000);
  const $s = load(sitemapHtml, { decodeEntities: false });

  // seed categories
  const seedCats = collectCategorySeedsFromSitemap($s);
  console.log(`- seed categories from sitemap: ${seedCats.length}`);

  // category maps
  const catMeta = new Map(); // pathStr -> {title,url,pathArr,order}
  for (const c of seedCats) catMeta.set(c.pathArr.join("/"), c);

  // BFS queue: roots first
  const roots = seedCats.filter((c) => c.pathArr.length === 1);
  const queue = [...roots];
  const visited = new Set();

  // ensure parents first
  const categoryIdByPath = new Map();

  // create all seed categories first (at least root list shows)
  const allSeedSorted = [...catMeta.values()].sort((a,b)=>a.pathArr.length-b.pathArr.length || a.order-b.order);
  for (const n of allSeedSorted) {
    const pathStr = n.pathArr.join("/");
    const parentPathStr = n.pathArr.slice(0,-1).join("/");
    const parentId = parentPathStr ? (categoryIdByPath.get(parentPathStr) || null) : null;

    const id = await ensureCategoryByPath({
      brandRef,
      title: n.title,
      pathArr: n.pathArr,
      sourceUrl: n.url,
      parentId,
      order: n.order,
    });
    categoryIdByPath.set(pathStr, id);
  }

  // crawl categories to fill content + discover children
  if (!ONLY_PRODUCTS) {
    console.log(`- crawl categories BFS (discover subcategories)…`);
    let crawled = 0;

    while (queue.length) {
      const cur = queue.shift();
      const key = cur.pathArr.join("/");
      if (visited.has(key)) continue;
      visited.add(key);

      // limit
      if (CATEGORY_LIMIT > 0 && crawled >= CATEGORY_LIMIT) break;
      crawled++;

      const cacheFile = path.join(CACHE_CAT_DIR, `${key.replaceAll("/","__")}.html`);
      try {
        const html = await fetchCached(cur.url, cacheFile, 35000);
        const parsed = parseCategoryPage(html, cur.url);

        // patch content
        let overviewHtml = parsed.descHtml;
        let heroAssetId = "";

        if (UPLOAD_IMAGES) {
          overviewHtml = sanitizePanel(await rewriteHtmlImagesToSanity(overviewHtml, imgCache));
          imgDirty++;

          if (parsed.heroUrl && !isJunkImage(parsed.heroUrl)) {
            const up = await uploadImageFromUrl(parsed.heroUrl, imgCache);
            if (up?.assetId) {
              heroAssetId = up.assetId;
              imgDirty++;
            }
          }
        }

        const catId = categoryIdByPath.get(key);
        if (catId) {
          await patchCategoryContent({
            categoryId: catId,
            summary: parsed.summary,
            heroAssetId,
            overviewHtml,
            legacyHtml: parsed.legacyHtml,
          });
        }

        // discover children
        for (const child of parsed.children) {
          const cKey = child.pathArr.join("/");
          if (!catMeta.has(cKey)) {
            catMeta.set(cKey, { ...child, order: 0 });
          }

          // ensure chain exists
          for (let i = 1; i <= child.pathArr.length; i++) {
            const p = child.pathArr.slice(0, i);
            const pStr = p.join("/");
            if (!categoryIdByPath.has(pStr)) {
              const parentStr = p.slice(0, -1).join("/");
              const parentId = parentStr ? (categoryIdByPath.get(parentStr) || null) : null;
              const title = i === child.pathArr.length ? child.title : prettifyTitle(p[p.length - 1]);

              const id = await ensureCategoryByPath({
                brandRef,
                title,
                pathArr: p,
                sourceUrl: child.url,
                parentId,
                order: 0,
              });
              categoryIdByPath.set(pStr, id);
            }
          }

          // BFS에 추가(자식도 크롤링해서 contentBlocks 채움)
          queue.push(child);
        }

        if (crawled % 10 === 0) flushImg();
        await sleep(120);
      } catch (e) {
        console.log(`  - ❌ category fail ${cur.url}: ${e?.message || e}`);
        await sleep(200);
      }
    }

    flushImg();
    console.log(`- categories total in map: ${catMeta.size}`);
    console.log(`- categories crawled: ${visited.size}`);
  }

  if (ONLY_CATEGORIES) {
    console.log("[kent-all] DONE (onlyCategories)");
    console.log(`- categories created: ${categoryIdByPath.size}`);
    return;
  }

  // products
  const productUrlsAll = collectProductUrlsFromSitemap($s);
  const productUrls = LIMIT > 0 ? productUrlsAll.slice(0, LIMIT) : productUrlsAll;
  console.log(`- products urls: ${productUrlsAll.length} / target: ${productUrls.length}`);

  if (!ONLY_CATEGORIES) {
    let ok = 0, fail = 0;

    for (let i = 0; i < productUrls.length; i++) {
      const u = productUrls[i];
      const slug = slugFromProductsUrl(u);
      if (!slug) continue;

      const cacheFile = path.join(CACHE_PAGES_DIR, `${slug}.html`);
      try {
        const html = await fetchCached(u, cacheFile, 35000);
        const parsed = parseProduct(html, u);

        // categoryRef resolve (ensure if missing)
        let categoryRefId = "";
        if (parsed.categoryPath?.length) {
          const pathStr = parsed.categoryPath.join("/");
          categoryRefId = categoryIdByPath.get(pathStr) || "";

          if (!categoryRefId) {
            // create chain if not exists
            let parentId = null;
            for (let d = 0; d < parsed.categoryPath.length; d++) {
              const p = parsed.categoryPath.slice(0, d + 1);
              const pStr = p.join("/");
              const title = prettifyTitle(p[p.length - 1]);
              const id = await ensureCategoryByPath({
                brandRef,
                title,
                pathArr: p,
                sourceUrl: null,
                parentId,
                order: 0,
              });
              categoryIdByPath.set(pStr, id);
              parentId = id;
              if (d === parsed.categoryPath.length - 1) categoryRefId = id;
            }
          }
        }

        // image rehost
        let images = [];
        let imageUrls = Array.isArray(parsed.imageUrls) ? parsed.imageUrls : [];
        if (UPLOAD_IMAGES) {
          const uploadedUrls = [];
          const seen = new Set();
          for (const src of imageUrls) {
            const srcN = normalizeUrl(src);
            if (!srcN || isJunkImage(srcN)) continue;
            if (seen.has(srcN)) continue;
            seen.add(srcN);

            const up = await uploadImageFromUrl(srcN, imgCache);
            if (up?.assetUrl && up?.assetId) {
              uploadedUrls.push(up.assetUrl);
              images.push({
                _type: "image",
                asset: { _type: "reference", _ref: up.assetId },
                caption: "",
                sourceUrl: up.sourceUrl || srcN,
              });
              imgDirty++;
            }
          }
          imageUrls = uploadedUrls;

          parsed.datasheetHtml = sanitizePanel(await rewriteHtmlImagesToSanity(parsed.datasheetHtml, imgCache));
          parsed.documentsHtml = sanitizePanel(await rewriteHtmlImagesToSanity(parsed.documentsHtml, imgCache));
          parsed.referencesHtml = sanitizePanel(await rewriteHtmlImagesToSanity(parsed.referencesHtml, imgCache));
          imgDirty++;

          if ((i + 1) % 10 === 0) flushImg();
        }

        await upsertProduct({
          brandRef,
          slug,
          data: { ...parsed, categoryRefId, imageUrls, images },
        });

        ok++;
        process.stdout.write(`\r  products: ${i + 1}/${productUrls.length} ok=${ok} fail=${fail}`);
        await sleep(140);
      } catch (e) {
        fail++;
        console.log(`\n  - ❌ product fail ${u}: ${e?.message || e}`);
        await sleep(200);
      }
    }

    flushImg();
    console.log(`\n[kent-all] DONE products`);
  }
}

main().catch((e) => {
  console.error("\n[kent-all] ERROR", e?.message || e);
  process.exit(1);
});