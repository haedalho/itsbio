#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { load } from "cheerio";

const argv = process.argv.slice(2);

const has = (flag) => argv.includes(flag);
const readArg = (flag, fallback = "") => {
  const i = argv.indexOf(flag);
  return i >= 0 ? String(argv[i + 1] ?? fallback) : fallback;
};

const BASE = "https://www.kentscientific.com";
const LISTING_JSON = path.resolve(
  readArg("--listing", path.join(process.cwd(), ".cache", "kent-listing-all.json"))
);
const OUT = path.resolve(
  readArg("--out", path.join(process.cwd(), ".cache", "kent-products-from-listing.json"))
);
const CACHE_DIR = path.resolve(
  readArg("--cacheDir", path.join(process.cwd(), ".cache", "kent-product-from-listing"))
);
const DELAY_MS = Number(readArg("--delay", "250")) || 250;
const LIMIT = Number(readArg("--limit", "0")) || 0;
const NO_CACHE = has("--noCache");
const VERBOSE = has("--verbose");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

function log(...args) {
  console.log("[kent-link]", ...args);
}

function warn(...args) {
  console.warn("[kent-link]", ...args);
}

function textClean(s) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(u) {
  try {
    const url = new URL(String(u || "").trim());
    url.hash = "";
    if (url.hostname === "kentscientific.com") url.hostname = "www.kentscientific.com";
    return url.toString();
  } catch {
    return String(u || "").trim();
  }
}

function normalizeTrailingSlashUrl(u) {
  try {
    const url = new URL(normalizeUrl(u));
    url.pathname = url.pathname.replace(/\/+$/, "") + "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return normalizeUrl(u);
  }
}

function dedupeStrings(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

function isProductDetailUrl(u) {
  try {
    const url = new URL(u);
    return url.hostname.endsWith("kentscientific.com") && url.pathname.startsWith("/products/");
  } catch {
    return false;
  }
}

function slugFromProductsUrl(u) {
  try {
    const url = new URL(u);
    const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
    const idx = parts.indexOf("products");
    return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : "";
  } catch {
    return "";
  }
}

function sha1(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function absUrl(base, href) {
  try {
    return new URL(String(href || ""), base).toString();
  } catch {
    return String(href || "").trim();
  }
}

async function fetchText(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
        referer: `${BASE}/`,
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCached(url) {
  const key = sha1(url);
  const cacheFile = path.join(CACHE_DIR, `${key}.html`);

  if (!NO_CACHE && fs.existsSync(cacheFile)) {
    if (VERBOSE) log("cache hit", url);
    return fs.readFileSync(cacheFile, "utf8");
  }

  if (VERBOSE) log("fetch", url);
  const html = await fetchText(url);
  fs.writeFileSync(cacheFile, html, "utf8");
  await sleep(DELAY_MS);
  return html;
}

const SUPPORT_PATTERNS = [
  /need help\??/i,
  /need help with your order/i,
  /help\s*&\s*support/i,
  /our product specialists/i,
  /our specialists/i,
  /we reply fast/i,
  /usually in 24 hours/i,
  /give us a call today/i,
  /call\s+888-572-8887/i,
  /chat with an expert/i,
  /contact us/i,
  /call us/i,
  /request a quote/i,
  /request quote/i,
  /get quote/i,
];

const UI_PATTERNS = [
  /^choose an option$/i,
  /^clear$/i,
  /^add to cart$/i,
  /^increase quantity$/i,
  /^decrease quantity$/i,
  /^qty$/i,
  /^\+$/i,
  /^-$/i,
  /^login to see prices$/i,
  /\bgtag\s*\(/i,
  /\b123\s*4567\s*890\b/i,
];

function isSupportText(text) {
  const s = textClean(text);
  if (!s) return false;
  return SUPPORT_PATTERNS.some((re) => re.test(s));
}

function isUiNoiseText(text) {
  const s = textClean(text);
  if (!s) return false;
  return UI_PATTERNS.some((re) => re.test(s));
}

function isNoiseText(text) {
  return isSupportText(text) || isUiNoiseText(text);
}

function cleanupPreviewText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => textClean(line))
    .filter(Boolean)
    .filter((line) => !isNoiseText(line))
    .filter((line) => !/^(choose an option|clear|add to cart|qty|\+|-|quantity)$/i.test(line))
    .join("\n")
    .trim();
}

function collectImages($, canonical) {
  const imageUrls = [];
  $(".woocommerce-product-gallery img, .summary img, main img").each((_, img) => {
    const src =
      $(img).attr("data-src") ||
      $(img).attr("src") ||
      $(img).attr("data-large_image") ||
      $(img).attr("data-lazy-src") ||
      "";
    const u = normalizeTrailingSlashUrl(absUrl(canonical, src));
    if (!u) return;
    if (/logo|icon|favicon|badge|seal|trustpilot|review/i.test(u)) return;
    imageUrls.push(u);
  });
  return dedupeStrings(imageUrls).slice(0, 40);
}

function collectPdfs($, canonical) {
  const pdfs = [];
  $('main a[href], .summary a[href], #tab-description a[href], .woocommerce-Tabs-panel--description a[href]').each(
    (_, a) => {
      const href = normalizeUrl(absUrl(canonical, $(a).attr("href") || ""));
      if (!/\.pdf($|\?)/i.test(href)) return;
      const title = textClean($(a).text()) || path.basename(href).split("?")[0];
      if (isNoiseText(title)) return;
      pdfs.push({ title, href });
    }
  );
  return dedupeByHref(pdfs);
}

function collectVideos($, canonical) {
  const urls = [];
  $('iframe[src], video source[src], a[href*="youtube"], a[href*="vimeo"]').each((_, el) => {
    const href = normalizeUrl(absUrl(canonical, $(el).attr("src") || $(el).attr("href") || ""));
    if (!href) return;
    if (/youtube\.com\/user\/kentscientific/i.test(href)) return;
    urls.push(href);
  });
  return dedupeStrings(urls);
}

function collectRelatedProducts($, canonical) {
  const relatedProducts = [];
  $('section.related a[href*="/products/"], .related a[href*="/products/"], .upsells a[href*="/products/"]').each(
    (_, a) => {
      const href = normalizeTrailingSlashUrl(absUrl(canonical, $(a).attr("href") || ""));
      if (!isProductDetailUrl(href)) return;
      const label = textClean($(a).text()) || slugFromProductsUrl(href);
      if (!href || isNoiseText(label)) return;
      relatedProducts.push({ label, href });
    }
  );
  return dedupeByHref(relatedProducts);
}

function dedupeByHref(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const href = item.href || item.url || "";
    if (!href || seen.has(href)) continue;
    seen.add(href);
    out.push(item);
  }
  return out;
}

function collectOptionGroups($) {
  const groups = [];

  function addGroup(label, options, source = "unknown") {
    const cleanLabel = textClean(label || "");
    const cleanOptions = (options || [])
      .map((opt) => ({
        value: textClean(opt.value || ""),
        text: textClean(opt.text || opt.label || ""),
      }))
      .filter((opt) => opt.text || opt.value)
      .filter((opt) => !isNoiseText(opt.text) && !isNoiseText(opt.value))
      .filter((opt) => !/^(choose an option|\+|-|add to cart)$/i.test(opt.text));

    if (!cleanLabel && !cleanOptions.length) return;

    const key = JSON.stringify({
      label: cleanLabel.toLowerCase(),
      opts: cleanOptions.map((v) => `${v.value}||${v.text}`),
    });

    if (!addGroup._seen) addGroup._seen = new Set();
    if (addGroup._seen.has(key)) return;
    addGroup._seen.add(key);

    groups.push({
      label: cleanLabel,
      options: cleanOptions,
      source,
    });
  }

  $("form.variations_form select, form.cart select").each((_, sel) => {
    const $sel = $(sel);
    const labelId = $sel.attr("id");
    let label = "";
    if (labelId) label = textClean($(`label[for="${labelId}"]`).first().text());
    if (!label) label = textClean($sel.closest("tr").find("th,label").first().text());
    if (!label) label = textClean($sel.attr("name") || "");

    const options = [];
    $sel.find("option").each((__, opt) => {
      const value = textClean($(opt).attr("value") || "");
      const text = textClean($(opt).text());
      if (!text) return;
      if (isNoiseText(text) || isNoiseText(value)) return;
      if (/^choose an option$/i.test(text)) return;
      options.push({ value, text });
    });

    addGroup(label, options, "select");
  });

  const rawVariationText = [];
  $(".summary, form.variations_form, form.cart")
    .find("*")
    .each((_, el) => {
      const tag = (el.tagName || "").toLowerCase();
      if (["script", "style"].includes(tag)) return;
      const txt = textClean($(el).text());
      if (!txt) return;
      if (isNoiseText(txt)) return;
      if (/^choose an option$/i.test(txt)) return;
      if (/^[-+]+$/i.test(txt)) return;
      if (/^(qty|quantity)$/i.test(txt)) return;
      if (/^add to cart$/i.test(txt)) return;
      rawVariationText.push(txt);
    });

  return {
    optionGroups: groups,
    rawVariationText: dedupeStrings(rawVariationText).slice(0, 80),
  };
}

function collectVariationJson($) {
  const payloads = [];

  $("form.variations_form").each((_, form) => {
    const raw = $(form).attr("data-product_variations");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      payloads.push(
        ...parsed.map((item) => {
          const attrs = item?.attributes || {};
          const normalizedAttrs = {};
          for (const [k, v] of Object.entries(attrs)) {
            normalizedAttrs[k] = textClean(v || "");
          }

          const priceText = cleanupPreviewText(load(`<div>${item?.price_html || ""}</div>`)("div").text());

          return {
            variationId: item?.variation_id ?? "",
            sku: textClean(item?.sku || ""),
            priceText,
            displayPrice: item?.display_price ?? "",
            displayRegularPrice: item?.display_regular_price ?? "",
            isInStock: item?.is_in_stock ?? "",
            image: normalizeUrl(item?.image?.src || ""),
            attributes: normalizedAttrs,
          };
        })
      );
    } catch {
      // ignore
    }
  });

  return payloads;
}

function parseProduct(html, url) {
  const $ = load(html, { decodeEntities: false });
  const canonical = normalizeTrailingSlashUrl($('link[rel="canonical"]').attr("href") || url);
  const title = textClean($("h1").first().text()) || textClean($("title").text());
  const metaText = cleanupPreviewText($(".product_meta").text());

  const itemMatch = metaText.match(/\bItem\s*#\s*[:#]?\s*([^\s|,]{1,120})/i);
  const sku = itemMatch ? textClean(itemMatch[1]) : "";

  const { optionGroups, rawVariationText } = collectOptionGroups($);
  const variationPayloads = collectVariationJson($);

  let $contentRoot = $("#tab-description");
  if (!$contentRoot.length) $contentRoot = $("div.woocommerce-Tabs-panel--description").first();
  if (!$contentRoot.length) $contentRoot = $(".woocommerce-product-details__short-description").first();
  if (!$contentRoot.length) $contentRoot = $(".entry-summary").first();
  if (!$contentRoot.length) $contentRoot = $("main .product").first();
  if (!$contentRoot.length) $contentRoot = $("main").first();
  if (!$contentRoot.length) $contentRoot = $("body");

  const bodyTextPreview = cleanupPreviewText($contentRoot.text()).slice(0, 5000);

  return {
    title,
    slug: slugFromProductsUrl(canonical),
    sourceUrl: canonical,
    sku,
    metaText,
    commerce: {
      model:
        optionGroups.length || variationPayloads.length
          ? "optionSelector"
          : sku
            ? "singleSku"
            : "unknown",
      optionGroups,
      rawVariationText,
      variationPayloads: variationPayloads.slice(0, 80),
    },
    imageUrls: collectImages($, canonical),
    pdfs: collectPdfs($, canonical),
    videos: collectVideos($, canonical),
    relatedProducts: collectRelatedProducts($, canonical),
    bodyTextPreview,
  };
}

function buildProductCategoryMap(listingJson) {
  const productMap = new Map();

  for (const category of listingJson.categories || []) {
    const rootUrl = normalizeUrl(category.rootUrl || "");
    const categoryPath = Array.isArray(category.categoryPath) ? category.categoryPath : [];
    const title = textClean(category.title || "");

    for (const productUrl of category.productUrls || []) {
      const norm = normalizeTrailingSlashUrl(productUrl);
      if (!isProductDetailUrl(norm)) continue;

      if (!productMap.has(norm)) {
        productMap.set(norm, {
          sourceUrl: norm,
          categories: [],
        });
      }

      productMap.get(norm).categories.push({
        rootUrl,
        title,
        categoryPath,
      });
    }
  }

  for (const entry of productMap.values()) {
    const seen = new Set();
    entry.categories = entry.categories.filter((cat) => {
      const key = `${cat.rootUrl}||${cat.categoryPath.join("/")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return productMap;
}

function choosePrimaryCategory(categories, parsed) {
  if (!categories?.length) return null;

  const slug = String(parsed?.slug || "").toLowerCase();
  const title = String(parsed?.title || "").toLowerCase();

  const scored = categories.map((cat) => {
    let score = 0;
    const joined = (cat.categoryPath || []).join(" ").toLowerCase();
    if (slug && joined.includes(slug)) score += 10;
    if (title && joined && title.includes(joined)) score += 4;
    score += (cat.categoryPath || []).length;
    return { cat, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.cat || categories[0];
}

function saveSnapshot(payload) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
}

async function main() {
  log(`listing: ${LISTING_JSON}`);
  log(`output: ${OUT}`);
  log(`cacheDir: ${CACHE_DIR}`);

  if (!fs.existsSync(LISTING_JSON)) {
    throw new Error(`Listing JSON not found: ${LISTING_JSON}`);
  }

  const listingJson = JSON.parse(fs.readFileSync(LISTING_JSON, "utf8"));
  const productMap = buildProductCategoryMap(listingJson);

  let productUrls = [...productMap.keys()].sort();
  if (LIMIT > 0) productUrls = productUrls.slice(0, LIMIT);

  const output = {
    generatedAt: new Date().toISOString(),
    source: "Kent product details joined with listing categories",
    listingFile: LISTING_JSON,
    count: 0,
    ok: 0,
    fail: 0,
    skipped: 0,
    results: [],
  };

  if (!productUrls.length) {
    saveSnapshot(output);
    throw new Error("No product URLs found in listing JSON");
  }

  for (let i = 0; i < productUrls.length; i += 1) {
    const url = productUrls[i];

    try {
      if (!isProductDetailUrl(url)) {
        output.skipped += 1;
        continue;
      }

      const html = await fetchCached(url);
      const parsed = parseProduct(html, url);

      const sourceCategories = productMap.get(url)?.categories || [];
      const primaryCategory = choosePrimaryCategory(sourceCategories, parsed);

      output.results.push({
        ...parsed,
        primaryCategory,
        sourceCategories,
        categoryPathCandidates: sourceCategories.map((v) => v.categoryPath || []),
      });

      output.ok += 1;
      output.count = output.results.length;
      saveSnapshot(output);

      process.stdout.write(
        `\r[${i + 1}/${productUrls.length}] ok=${output.ok} fail=${output.fail} skip=${output.skipped} ${parsed.slug || parsed.title}`
      );
    } catch (err) {
      output.fail += 1;
      output.results.push({
        sourceUrl: url,
        error: String(err?.message || err),
      });
      output.count = output.results.length;
      saveSnapshot(output);

      process.stdout.write(
        `\r[${i + 1}/${productUrls.length}] ok=${output.ok} fail=${output.fail} skip=${output.skipped} ERROR`
      );
    }
  }

  process.stdout.write("\n");

  output.generatedAt = new Date().toISOString();
  output.count = output.results.length;
  saveSnapshot(output);

  log(`saved: ${OUT}`);
  log(`ok=${output.ok} fail=${output.fail} skipped=${output.skipped}`);
}

main().catch((err) => {
  warn(String(err?.message || err));
  process.exit(1);
});