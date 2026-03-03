#!/usr/bin/env node
/**
 * scripts/kent-all.mjs
 *
 * Kent Scientific importer (category + product) + image rehosting to Sanity
 *
 * ✅ /site-map/ 에서:
 *  - Product categories (/product/...) => category 트리 생성
 *  - /products/<slug>/ 링크 => 제품 상세 수집
 *
 * ✅ 카테고리 페이지(/product/...):
 *  - 소개/설명 HTML => category.contentBlocks[contentBlockHtml]
 *  - 대표 이미지 => category.heroImage (Sanity asset 업로드)
 *  - summary => category.summary
 *
 * ✅ 제품 페이지(/products/...):
 *  - 이미지(갤러리 + HTML 안 img 포함) => 전부 Sanity assets.upload('image') 후 cdn.sanity.io 로 치환
 *  - product.imageUrls 는 Sanity CDN URL만 저장
 *  - product.images[] 도 업로드된 이미지 asset ref로 채움
 *
 * Usage:
 *   node .\scripts\kent-all.mjs --brand kentscientific
 *   node .\scripts\kent-all.mjs --brand kentscientific --limit 20
 *   node .\scripts\kent-all.mjs --brand kentscientific --dry
 *
 * Options:
 *   --noUploadImages        이미지 업로드/치환 끔
 *   --noCrawlCategories     카테고리 페이지(/product/...) 크롤링 끔 (트리만 생성)
 *   --onlyCategories        카테고리만
 *   --onlyProducts          제품만
 *   --categoryLimit 10      카테고리 페이지 크롤링 개수 제한(테스트용)
 *
 * Env (.env.local):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   NEXT_PUBLIC_SANITY_API_VERSION (default: 2025-01-01)
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

// -------------------- env --------------------
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

// -------------------- args --------------------
const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const readArg = (name, fallback = undefined) => {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  return argv[i + 1] ?? fallback;
};

const DRY = has("--dry");
const BRAND_KEY = String(readArg("--brand", "kentscientific")).trim() || "kentscientific";
const LIMIT = Number(readArg("--limit", "0") || "0") || 0;
const CATEGORY_LIMIT = Number(readArg("--categoryLimit", "0") || "0") || 0;

const UPLOAD_IMAGES = !has("--noUploadImages");
const CRAWL_CATEGORIES = !has("--noCrawlCategories");
const ONLY_CATEGORIES = has("--onlyCategories");
const ONLY_PRODUCTS = has("--onlyProducts");

const SITEMAP_URL = String(readArg("--sitemap", "https://www.kentscientific.com/site-map/")).trim();

// -------------------- cache dirs --------------------
const CACHE_DIR = path.join(repoRoot, ".cache", "kent");
const CACHE_SITEMAP = path.join(CACHE_DIR, "sitemap.html");
const CACHE_PAGES_DIR = path.join(CACHE_DIR, "pages");
const CACHE_CAT_DIR = path.join(CACHE_DIR, "categories");
fs.mkdirSync(CACHE_PAGES_DIR, { recursive: true });
fs.mkdirSync(CACHE_CAT_DIR, { recursive: true });

// image upload cache
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

// -------------------- utils --------------------
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
  const h = String(href || "").trim();
  if (!h) return "";
  try {
    return new URL(h, base).toString();
  } catch {
    return h;
  }
}

// ✅ www → non-www 통일(일부 www 링크가 404)
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
  if (!u) return true;
  return (
    u.includes("logo") ||
    u.includes("favicon") ||
    u.includes("sprite") ||
    u.includes("icon") ||
    u.includes("header") ||
    u.includes("footer") ||
    u.includes("banner") ||
    u.includes("payment") ||
    u.includes("social") ||
    u.includes("tracking") ||
    u.includes("google") ||
    u.includes("doubleclick") ||
    u.includes("seal") ||
    u.includes("badge") ||
    u.includes("trust")
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

function cssEscape(id) {
  return String(id || "").replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, "\\$1");
}

function stripSiteSuffix(t) {
  let s = textClean(t);
  s = s.replace(/\s*-\s*KENT\s*SCIENTIFIC\s*$/i, "").trim();
  s = s.replace(/\s*-\s*Kent\s*Scientific\s*$/i, "").trim();
  return s;
}

function prettifyCategoryTitle(raw) {
  let t = stripSiteSuffix(raw);
  t = t.replace(/\s+Archives$/i, "").trim();
  t = t.replace(/\s+Products$/i, "").trim();
  t = t.replace(/\s*&\s*/g, " & ").replace(/\s+/g, " ").trim();
  return t;
}

function pathFromProductArchiveUrl(u) {
  // expects /product/.../
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

function slugFromProductUrl(u) {
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

// -------------------- http --------------------
async function fetchText(url, timeoutMs = 25000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    signal: controller.signal,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
      referer: "https://kentscientific.com/",
    },
  });

  clearTimeout(t);

  // www에서 404면 non-www로 재시도
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

async function fetchCached(url, cacheFile, timeoutMs = 25000) {
  if (fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile, "utf8");
  const html = await fetchText(url, timeoutMs);
  fs.writeFileSync(cacheFile, html, "utf8");
  return html;
}

async function fetchBinary(url, timeoutMs = 25000) {
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
      referer: "https://kentscientific.com/",
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
  if (ct.includes("svg")) return "svg"; // 대부분 junk라 필터에 걸리지만 혹시 대비
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  const m = String(url).toLowerCase().match(/\.(png|jpe?g|webp|gif|svg)(\?|#|$)/);
  return m ? m[1].replace("jpeg", "jpg") : "png";
}

async function uploadImageFromUrl(url, imgCache) {
  const u0 = normalizeUrl(url);
  if (!u0) return null;
  if (isSanityCdn(u0)) return { assetId: "", assetUrl: u0, sourceUrl: u0 };

  const hit = imgCache.byUrl[u0];
  if (hit?.assetId && hit?.assetUrl) return { ...hit, sourceUrl: u0 };

  const { buf, contentType } = await fetchBinary(u0, 35000);
  if (!buf?.length) throw new Error(`Empty image: ${u0}`);

  const ext = guessExt(contentType, u0);
  // svg는 Next/Image 설정에 따라 막힐 수 있어서, 여기서는 업로드하지 않고 제거(대부분 아이콘/로고)
  if (ext === "svg") {
    return null;
  }

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

    const abs = normalizeUrl(absUrl("https://kentscientific.com/", src));
    if (!abs) continue;

    if (isSanityCdn(abs)) continue;

    if (isJunkImage(abs)) {
      $img.remove();
      changed = true;
      continue;
    }

    const uploaded = await uploadImageFromUrl(abs, imgCache);
    if (uploaded?.assetUrl) {
      $img.attr("data-original-src", src);
      $img.attr("src", uploaded.assetUrl);
      changed = true;
    }
  }

  return changed ? $.html() : input;
}

// -------------------- sanity helpers --------------------
async function ensureBrand() {
  const b = await sanity.fetch(
    `*[_type=="brand" && (slug.current==$brandKey || themeKey==$brandKey)][0]{_id,title,themeKey,"slug":slug.current}`,
    { brandKey: BRAND_KEY }
  );
  if (!b?._id) {
    throw new Error(`Brand not found in Sanity (slug/themeKey = ${BRAND_KEY})`);
  }
  return { _type: "reference", _ref: b._id, _id: b._id };
}

async function ensureCategoryByPath({ brandRef, title, pathArr, sourceUrl, parentId, order }) {
  const pathStr = pathArr.join("/");
  if (!pathStr) throw new Error("ensureCategoryByPath: empty path");

  const existing = await sanity.fetch(
    `*[
      _type=="category"
      && (themeKey==$brandKey || brand->slug.current==$brandKey || brand->themeKey==$brandKey)
      && array::join(path,"/")==$pathStr
    ][0]{_id}`,
    { brandKey: BRAND_KEY, pathStr }
  );

  if (existing?._id) {
    if (!DRY) {
      await sanity
        .patch(existing._id)
        .set({
          title,
          path: pathArr,
          themeKey: BRAND_KEY,
          sourceUrl: sourceUrl || null,
          brand: brandRef,
          order: typeof order === "number" ? order : 0,
          ...(parentId ? { parent: { _type: "reference", _ref: parentId } } : { parent: null }),
        })
        .commit();
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

async function patchCategoryContent({ categoryId, summary, heroAssetId, contentBlocksHtml, legacyHtml }) {
  if (DRY) return;

  const patch = sanity.patch(categoryId).set({
    summary: summary || "",
    legacyHtml: legacyHtml || "",
    contentBlocks: contentBlocksHtml
      ? [
          {
            _type: "contentBlockHtml",
            title: "Overview",
            html: contentBlocksHtml,
          },
        ]
      : [],
    ...(heroAssetId
      ? { heroImage: { _type: "image", asset: { _type: "reference", _ref: heroAssetId } } }
      : { heroImage: null }),
  });

  await patch.commit({ autoGenerateArrayKeys: true });
}

async function upsertProduct({ brandRef, slug, data }) {
  const existing = await sanity.fetch(
    `*[
      _type=="product"
      && slug.current==$slug
      && (brand->slug.current==$brandKey || brand->themeKey==$brandKey)
    ][0]{_id}`,
    { slug, brandKey: BRAND_KEY }
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
    faqsHtml: data.faqsHtml || "",
    referencesHtml: data.referencesHtml || "",
    reviewsHtml: data.reviewsHtml || "",

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

  if (DRY) return { _id: docId, created: !existing?._id };

  if (!existing?._id) {
    await sanity.createIfNotExists(payload);
  } else {
    await sanity.patch(docId).set(payload).commit({ autoGenerateArrayKeys: true });
  }

  return { _id: docId, created: !existing?._id };
}

// -------------------- sitemap parsing --------------------
function findHeadingEl($, headingText) {
  const wanted = headingText.toLowerCase();
  return $("h1,h2,h3,h4")
    .filter((_, el) => textClean($(el).text()).toLowerCase() === wanted)
    .first();
}

function findNextList($, $heading) {
  if (!$heading?.length) return null;
  let $cur = $heading.next();
  for (let i = 0; i < 30 && $cur.length; i++) {
    if ($cur.is("ul,ol")) return $cur;
    $cur = $cur.next();
  }
  const $ul = $heading.nextAll("ul,ol").first();
  return $ul.length ? $ul : null;
}

function parseCategoryListFromSitemap($) {
  const $h = findHeadingEl($, "Product categories");
  const $list = findNextList($, $h);
  if (!$list?.length) throw new Error("Cannot find 'Product categories' list in sitemap HTML");

  const nodes = [];
  function walk($ul, parentPathStr = null) {
    const $lis = $ul.children("li");
    $lis.each((idx, li) => {
      const $li = $(li);
      const $a = $li.children("a").first();
      const rawTitle = textClean($a.text());
      const href = normalizeUrl(absUrl(SITEMAP_URL, $a.attr("href") || ""));
      const pathArr = pathFromProductArchiveUrl(href);

      if (!rawTitle || !pathArr.length) {
        const $childUl = $li.children("ul,ol").first();
        if ($childUl.length) walk($childUl, parentPathStr);
        return;
      }

      const title = prettifyCategoryTitle(rawTitle);
      const pathStr = pathArr.join("/");

      nodes.push({
        title,
        sourceUrl: href,
        pathArr,
        parentPathStr,
        order: idx,
      });

      const $childUl = $li.children("ul,ol").first();
      if ($childUl.length) walk($childUl, pathStr);
    });
  }

  walk($list, null);

  const seen = new Set();
  const uniq = [];
  for (const n of nodes) {
    const k = n.pathArr.join("/");
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(n);
  }

  uniq.sort((a, b) => a.pathArr.length - b.pathArr.length || a.pathArr.join("/").localeCompare(b.pathArr.join("/")));
  return uniq;
}

// slug 기준으로 dedupe (www/non-www 섞여도 1개)
function collectAllProductUrlsFromSitemap($) {
  const map = new Map(); // slug -> url
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    const u = normalizeUrl(absUrl(SITEMAP_URL, href));
    try {
      const uu = new URL(u);
      const p = uu.pathname || "";
      if (!p.startsWith("/products/")) return;
      if (p === "/products" || p === "/products/") return;

      const slug = slugFromProductUrl(uu.toString());
      if (!slug) return;
      if (!map.has(slug)) map.set(slug, normalizeUrl(uu.toString()));
    } catch {}
  });
  return [...map.values()];
}

// -------------------- category page parsing --------------------
function pickMain($) {
  const sels = ["main", "#primary", "#content", ".site-main", "#main", "body"];
  for (const s of sels) {
    const $el = $(s).first();
    if ($el.length) return $el;
  }
  return $("body");
}

function firstNonJunkImageUrl($, $scope) {
  const candidates = [];
  $scope.find("img").each((_, el) => {
    const src = $(el).attr("data-src") || $(el).attr("src") || "";
    if (!src) return;
    const u = normalizeUrl(absUrl("https://kentscientific.com/", src));
    if (!u || isJunkImage(u)) return;
    candidates.push(u);
  });
  return candidates[0] || "";
}

function parseKentCategoryPage(html, url) {
  const $ = load(html, { decodeEntities: false });
  const canonical = $("link[rel='canonical']").attr("href");
  const sourceUrl = normalizeUrl(canonical || url);

  const $main = pickMain($);
  $main.find("script,noscript,style,header,footer,nav,form").remove();

  // title
  const title =
    textClean($(".woocommerce-products-header__title").first().text()) ||
    textClean($("h1").first().text()) ||
    stripSiteSuffix(textClean($("title").text())) ||
    "";

  // description (Woo category usually)
  const $desc =
    $(".woocommerce-products-header__description").first().length
      ? $(".woocommerce-products-header__description").first()
      : $(".term-description").first().length
        ? $(".term-description").first()
        : $(".archive-description").first().length
          ? $(".archive-description").first()
          : $(".taxonomy-description").first();

  let descHtml = $desc.length ? ($desc.html() || "") : "";

  // If empty, try first paragraph near header
  if (!descHtml) {
    const $p = $(".woocommerce-products-header").find("p").first();
    descHtml = $p.length ? ($p.parent().html() || $p.html() || "") : "";
  }

  // hero image: prefer header image, fallback to any image in main
  let heroUrl = "";
  const $header = $(".woocommerce-products-header").first();
  if ($header.length) {
    heroUrl = firstNonJunkImageUrl($, $header);
  }
  if (!heroUrl) heroUrl = firstNonJunkImageUrl($, $main);

  const summary = descHtml ? textClean(load(descHtml).text()).slice(0, 240) : "";

  const legacyHtml = ($main.html() || "").slice(0, 180000);

  return {
    title,
    sourceUrl,
    descHtml: sanitizePanel(descHtml),
    heroUrl,
    summary,
    legacyHtml,
  };
}

// -------------------- product parsing --------------------
function removeElementsContainingText($, $root, patterns = []) {
  const regs = patterns.map((p) => (p instanceof RegExp ? p : new RegExp(String(p), "i")));
  $root.find("*").each((_, el) => {
    const $el = $(el);
    const t = textClean($el.text());
    if (!t) return;
    if (regs.some((r) => r.test(t))) {
      const tag = (el.tagName || "").toLowerCase();
      if (["span", "p", "div", "li", "a", "section"].includes(tag)) $el.remove();
    }
  });
}

function parseBreadcrumbCategory($) {
  let $bc = $("nav.woocommerce-breadcrumb").first();
  if (!$bc.length) $bc = $(".breadcrumbs,.breadcrumb").first();

  const crumbs = [];
  if ($bc.length) {
    $bc.find("a").each((_, a) => {
      const t = prettifyCategoryTitle(textClean($(a).text()));
      const href = $(a).attr("href") || "";
      const u = href ? normalizeUrl(absUrl("https://kentscientific.com/", href)) : "";
      if (!t) return;
      if (/^home$/i.test(t)) return;
      crumbs.push({ title: t, url: u });
    });
  }

  const catCrumbs = crumbs.filter((c) => c.url && c.url.includes("/product/"));
  if (!catCrumbs.length) return { categoryPath: [], categoryPathTitles: [], categoryLeafUrl: "" };

  const leaf = catCrumbs[catCrumbs.length - 1];
  const categoryPath = pathFromProductArchiveUrl(leaf.url);
  const categoryPathTitles = catCrumbs.map((c) => c.title);

  return { categoryPath, categoryPathTitles, categoryLeafUrl: leaf.url };
}

function parseSkuItemNo($) {
  const metaText = textClean($(".product_meta").text());
  let m = metaText.match(/\bItem\s*#\s*[:#]?\s*([A-Za-z0-9-]{2,40})\b/i);
  if (m) return m[1];

  const bodyText = textClean($("body").text());
  m = bodyText.match(/\bItem\s*#\s*[:#]?\s*([A-Za-z0-9-]{2,40})\b/i);
  if (m) return m[1];

  m = bodyText.match(/\b(?:SKU|Cat\.?\s*No\.?|Catalog\s*No\.?)\s*[:#]?\s*([A-Za-z0-9-]{2,40})\b/i);
  return m ? m[1] : "";
}

function parseProductImages($) {
  const imgs = [];

  $(".woocommerce-product-gallery img, figure.woocommerce-product-gallery__wrapper img").each((_, el) => {
    const src = $(el).attr("data-src") || $(el).attr("src") || "";
    if (!src) return;
    const u = normalizeUrl(absUrl("https://kentscientific.com/", src));
    if (!u || isJunkImage(u)) return;
    imgs.push(u);
  });

  if (imgs.length < 2) {
    const $main = pickMain($);
    $main.find("img").each((_, el) => {
      const src = $(el).attr("data-src") || $(el).attr("src") || "";
      if (!src) return;
      const u = normalizeUrl(absUrl("https://kentscientific.com/", src));
      if (!u || isJunkImage(u)) return;
      imgs.push(u);
    });
  }

  return [...new Set(imgs)];
}

function parsePdfDocs($, $scope) {
  const docs = [];
  $scope.find("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const txt = textClean($(el).text()) || "Document";
    if (!href) return;
    const u = normalizeUrl(absUrl("https://kentscientific.com/", href));
    if (!u.toLowerCase().includes(".pdf")) return;
    docs.push({ title: txt, url: u });
  });

  const seen = new Set();
  return docs.filter((d) => (seen.has(d.url) ? false : (seen.add(d.url), true)));
}

function extractSectionByHeading($, $main, headingRegex) {
  const $h = $main
    .find("h1,h2,h3,h4")
    .filter((_, el) => headingRegex.test(textClean($(el).text())))
    .first();

  if (!$h.length) return "";

  const parts = [];
  let $cur = $h.next();
  let guard = 0;

  while ($cur.length && guard < 80) {
    const tag = ($cur.get(0)?.tagName || "").toLowerCase();
    if (["h1", "h2", "h3", "h4"].includes(tag)) break;
    parts.push($.html($cur));
    $cur = $cur.next();
    guard++;
  }

  return parts.join("\n");
}

function parseKentProduct(html, url) {
  const $ = load(html, { decodeEntities: false });

  const canonical = $("link[rel='canonical']").attr("href");
  const sourceUrl = normalizeUrl(canonical || url);

  const title =
    textClean($("h1").first().text()) ||
    stripSiteSuffix(textClean($("title").text())) ||
    slugFromProductUrl(sourceUrl) ||
    "Untitled";

  const sku = parseSkuItemNo($);
  const $main = pickMain($);

  $main.find("script,noscript,style,header,footer,nav,form").remove();
  removeElementsContainingText($, $main, [/login to see prices/i, /add to cart/i, /checkout/i]);

  const docs = parsePdfDocs($, $main);
  const imageUrls = parseProductImages($);

  const bc = parseBreadcrumbCategory($);
  const categoryPath = bc.categoryPath || [];
  const categoryPathTitles = bc.categoryPathTitles || [];

  let datasheetRaw = "";
  const descPanelId =
    $("a[href='#tab-description']").length ? "tab-description" : $("div.woocommerce-Tabs-panel--description").attr("id");

  if (descPanelId) {
    const $panel = $(`#${cssEscape(descPanelId)}`);
    datasheetRaw = $panel.length ? $panel.html() || "" : "";
  }

  if (!datasheetRaw) {
    const $summary =
      $(".summary").first().length ? $(".summary").first() : $main.find(".summary, .product, .entry-content").first();
    datasheetRaw = $summary.length ? $summary.html() || "" : $main.html() || "";
  }

  const videosRaw = extractSectionByHeading($, $main, /product\s*videos?/i);
  const resourcesRaw = extractSectionByHeading($, $main, /\bresources?\b/i);
  const pubsRaw = extractSectionByHeading($, $main, /(scientific\s+publications?|publications)/i);

  const documentsCombined = [videosRaw, resourcesRaw].filter(Boolean).join("\n<hr/>\n");

  const datasheetHtml = sanitizePanel(datasheetRaw);
  const documentsHtml = sanitizePanel(documentsCombined);
  const referencesHtml = sanitizePanel(pubsRaw);

  const legacyHtml = ($main.html() || "").slice(0, 180000);

  return {
    title,
    sku,
    sourceUrl,
    legacyHtml,
    datasheetHtml,
    documentsHtml,
    referencesHtml,
    faqsHtml: "",
    reviewsHtml: "",
    imageUrls,
    docs,
    categoryPath,
    categoryPathTitles,
    categoryLeafUrl: bc.categoryLeafUrl || "",
  };
}

// -------------------- main --------------------
async function main() {
  console.log(
    `[kent-all] brand=${BRAND_KEY} dry=${DRY} limit=${LIMIT || "ALL"} categoryLimit=${CATEGORY_LIMIT || "ALL"} uploadImages=${UPLOAD_IMAGES} crawlCategories=${CRAWL_CATEGORIES}`
  );
  console.log(`[kent-all] sitemap=${SITEMAP_URL}`);

  const brand = await ensureBrand();
  const brandRef = { _type: "reference", _ref: brand._id };

  const imgCache = readImgCache();
  let imgCacheDirtyCount = 0;
  const flushImgCache = async () => {
    if (!DRY && imgCacheDirtyCount > 0) {
      writeImgCache(imgCache);
      imgCacheDirtyCount = 0;
    }
  };

  // 1) sitemap
  console.log("\n[1/5] Fetch sitemap...");
  const sitemapHtml = await fetchCached(SITEMAP_URL, CACHE_SITEMAP, 35000);
  const $s = load(sitemapHtml, { decodeEntities: false });

  // 2) categories upsert (tree)
  console.log("[2/5] Parse & upsert categories (Product categories)...");
  const catNodes = parseCategoryListFromSitemap($s);
  console.log(` - parsed categories: ${catNodes.length}`);

  const categoryIdByPath = new Map(); // pathStr -> _id
  const nodeByPath = new Map(); // pathStr -> node (for url)

  for (let i = 0; i < catNodes.length; i++) {
    const n = catNodes[i];
    const pathStr = n.pathArr.join("/");
    const parentId = n.parentPathStr ? categoryIdByPath.get(n.parentPathStr) || null : null;

    const id = await ensureCategoryByPath({
      brandRef,
      title: prettifyCategoryTitle(n.title),
      pathArr: n.pathArr,
      sourceUrl: n.sourceUrl,
      parentId,
      order: n.order ?? 0,
    });

    categoryIdByPath.set(pathStr, id);
    nodeByPath.set(pathStr, n);

    if ((i + 1) % 25 === 0 || i === catNodes.length - 1) {
      console.log(`   - categories upserted: ${i + 1}/${catNodes.length}`);
    }
  }

  // 3) category pages crawl (content)
  if (!ONLY_PRODUCTS && CRAWL_CATEGORIES) {
    console.log("\n[3/5] Crawl category pages (/product/...) and patch category content...");
    const paths = [...nodeByPath.keys()];
    const target = CATEGORY_LIMIT > 0 ? paths.slice(0, CATEGORY_LIMIT) : paths;

    let ok = 0;
    let fail = 0;

    for (let i = 0; i < target.length; i++) {
      const pathStr = target[i];
      const node = nodeByPath.get(pathStr);
      const categoryId = categoryIdByPath.get(pathStr);
      if (!node?.sourceUrl || !categoryId) continue;

      const cacheFile = path.join(CACHE_CAT_DIR, `${pathStr.replaceAll("/", "__")}.html`);

      try {
        console.log(` - [${i + 1}/${target.length}] ${pathStr}`);
        const html = await fetchCached(node.sourceUrl, cacheFile, 35000);
        const parsed = parseKentCategoryPage(html, node.sourceUrl);

        let heroAssetId = "";
        let descHtml = parsed.descHtml || "";

        if (UPLOAD_IMAGES) {
          // hero upload
          if (parsed.heroUrl && !isJunkImage(parsed.heroUrl)) {
            const up = await uploadImageFromUrl(parsed.heroUrl, imgCache);
            if (up?.assetId) {
              heroAssetId = up.assetId;
              imgCacheDirtyCount++;
            }
          }

          // description html image rewrite
          if (descHtml) {
            descHtml = sanitizePanel(await rewriteHtmlImagesToSanity(descHtml, imgCache));
            imgCacheDirtyCount++;
          }
        }

        await patchCategoryContent({
          categoryId,
          summary: parsed.summary || "",
          heroAssetId,
          contentBlocksHtml: descHtml,
          legacyHtml: parsed.legacyHtml || "",
        });

        ok++;
        if (ok % 10 === 0) await flushImgCache();
        await sleep(140);
      } catch (e) {
        fail++;
        console.log(`   ❌ category fail: ${node.sourceUrl}`);
        console.log(`   ${e?.message || e}`);
        await sleep(220);
      }
    }

    await flushImgCache();
    console.log(` - category crawl DONE: OK=${ok} FAIL=${fail}`);
  } else {
    console.log("\n[3/5] Skip category crawl (flag)");
  }

  if (ONLY_CATEGORIES) {
    console.log("\n[kent-all] DONE (onlyCategories)");
    console.log(` - categories(total): ${categoryIdByPath.size}`);
    return;
  }

  // 4) product URLs
  console.log("\n[4/5] Collect product URLs from sitemap...");
  const allProductUrls = collectAllProductUrlsFromSitemap($s);
  const productUrls = LIMIT > 0 ? allProductUrls.slice(0, LIMIT) : allProductUrls;
  console.log(` - products found: ${allProductUrls.length} / target: ${productUrls.length}`);

  // 5) products
  console.log("\n[5/5] Fetch product pages & upsert to Sanity (rehost images)...");
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < productUrls.length; i++) {
    const u = productUrls[i];
    const slug = slugFromProductUrl(u);
    if (!slug) continue;

    const cacheFile = path.join(CACHE_PAGES_DIR, `${slug}.html`);

    try {
      console.log(`\n[${i + 1}/${productUrls.length}] ${slug}`);
      const html = await fetchCached(u, cacheFile, 35000);
      const parsed = parseKentProduct(html, u);

      // categoryRef resolve
      let categoryRefId = "";
      if (Array.isArray(parsed.categoryPath) && parsed.categoryPath.length) {
        const pathStr = parsed.categoryPath.join("/");
        categoryRefId = categoryIdByPath.get(pathStr) || "";

        // sitemap에 없거나 path 새로 나오면 breadcrumb chain 생성
        if (!categoryRefId) {
          let parentId = null;
          for (let d = 0; d < parsed.categoryPath.length; d++) {
            const p = parsed.categoryPath.slice(0, d + 1);
            const pStr = p.join("/");
            const title = parsed.categoryPathTitles?.[d] || prettifyCategoryTitle(p[p.length - 1]);
            const id = await ensureCategoryByPath({
              brandRef,
              title: prettifyCategoryTitle(title),
              pathArr: p,
              sourceUrl: parsed.categoryLeafUrl || null,
              parentId,
              order: 0,
            });
            categoryIdByPath.set(pStr, id);
            parentId = id;
            if (d === parsed.categoryPath.length - 1) categoryRefId = id;
          }
        }
      }

      // ✅ rehost images
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
            imgCacheDirtyCount++;
          }
        }

        imageUrls = uploadedUrls;

        // HTML 내부 img도 업로드 후 src 치환
        parsed.datasheetHtml = sanitizePanel(await rewriteHtmlImagesToSanity(parsed.datasheetHtml, imgCache));
        parsed.documentsHtml = sanitizePanel(await rewriteHtmlImagesToSanity(parsed.documentsHtml, imgCache));
        parsed.referencesHtml = sanitizePanel(await rewriteHtmlImagesToSanity(parsed.referencesHtml, imgCache));
        imgCacheDirtyCount++;

        if ((i + 1) % 10 === 0) await flushImgCache();
      }

      const res = await upsertProduct({
        brandRef,
        slug,
        data: {
          ...parsed,
          categoryRefId,
          imageUrls,
          images,
        },
      });

      ok++;
      console.log(` - ✅ upsert ok: ${res._id}${res.created ? " (created)" : ""}`);
      await sleep(160);
    } catch (e) {
      fail++;
      console.log(` - ❌ fail: ${u}`);
      console.log(`   ${e?.message || e}`);
      await sleep(250);
    }
  }

  await flushImgCache();

  console.log("\n[kent-all] DONE");
  console.log(` - OK: ${ok}`);
  console.log(` - FAIL: ${fail}`);
  console.log(` - categories(total): ${categoryIdByPath.size}`);
}

main().catch((e) => {
  console.error("\n[kent-all] ERROR", e?.message || e);
  process.exit(1);
});