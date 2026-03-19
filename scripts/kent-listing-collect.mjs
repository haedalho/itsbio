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
const readArgs = (flag) => {
  const out = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && argv[i + 1]) out.push(String(argv[i + 1]));
  }
  return out;
};

const BASE = "https://www.kentscientific.com";
const SITEMAP_URL = readArg("--sitemap", "https://www.kentscientific.com/site-map/");
const DELAY_MS = Number(readArg("--delay", "250")) || 250;
const LIMIT = Number(readArg("--limit", "0")) || 0;
const URL_FILE = readArg("--file", "");
const SAMPLE = has("--sample");
const NO_CACHE = has("--noCache");
const VERBOSE = has("--verbose");

const OUT = path.resolve(
  readArg("--out", path.join(process.cwd(), ".cache", "kent-listing-collect.json"))
);
const CACHE_DIR = path.resolve(
  readArg("--cacheDir", path.join(process.cwd(), ".cache", "kent-listing-collect"))
);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

function log(...args) {
  console.log("[kent-listing]", ...args);
}

function warn(...args) {
  console.warn("[kent-listing]", ...args);
}

function textClean(s) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function isListingUrl(u) {
  try {
    const url = new URL(u);
    return url.hostname.endsWith("kentscientific.com") && url.pathname.startsWith("/product/");
  } catch {
    return false;
  }
}

function normalizeListingUrl(u) {
  try {
    const url = new URL(normalizeUrl(u));
    let p = url.pathname.replace(/\/+$/, "");
    if (!p) p = "/";
    url.pathname = `${p}/`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return normalizeUrl(u);
  }
}

function rootListingUrl(u) {
  try {
    const url = new URL(normalizeListingUrl(u));
    let p = url.pathname.replace(/\/page\/\d+\/?$/i, "/");
    p = p.replace(/\/+$/, "/");
    url.pathname = p;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return normalizeListingUrl(u);
  }
}

function pageNumberFromUrl(u) {
  try {
    const url = new URL(u);
    const m = url.pathname.match(/\/page\/(\d+)\/?$/i);
    return m ? Number(m[1]) : 1;
  } catch {
    return 1;
  }
}

function categoryPathFromListingUrl(u) {
  try {
    const url = new URL(u);
    const p = url.pathname.replace(/^\/+|\/+$/g, "");
    if (!p.startsWith("product/")) return [];
    const parts = p.split("/").slice(1);
    const pageIdx = parts.indexOf("page");
    return pageIdx >= 0 ? parts.slice(0, pageIdx) : parts;
  } catch {
    return [];
  }
}

function productSlugFromUrl(u) {
  try {
    const url = new URL(u);
    const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
    const idx = parts.indexOf("products");
    return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : "";
  } catch {
    return "";
  }
}

function looksLikeListingLandingProduct(productUrl, listingUrl, anchorText = "") {
  const slug = productSlugFromUrl(productUrl).toLowerCase();
  const categoryPath = categoryPathFromListingUrl(listingUrl).map((v) => v.toLowerCase());
  const cleanAnchor = textClean(anchorText).toLowerCase();

  if (!slug) return false;
  if (categoryPath.includes(slug)) return true;

  const last = categoryPath.at(-1) || "";
  if (last && slug === last) return true;

  if (cleanAnchor) {
    if (cleanAnchor === slug.replace(/-/g, " ")) return true;
    if (last && cleanAnchor === last.replace(/-/g, " ")) return true;
  }

  return false;
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

function collectSeedListingUrlsFromSitemap(html) {
  const $ = load(html, { decodeEntities: false });
  const urls = [];

  $("a[href]").each((_, a) => {
    const href = normalizeListingUrl(absUrl(SITEMAP_URL, $(a).attr("href") || ""));
    if (!isListingUrl(href)) return;
    const parts = categoryPathFromListingUrl(href);
    if (!parts.length) return;
    urls.push(rootListingUrl(href));
  });

  return dedupeStrings(urls).sort();
}

function readInputUrls() {
  const urls = [];

  for (const u of readArgs("--url")) {
    const norm = normalizeUrl(u);
    if (isListingUrl(norm)) urls.push(rootListingUrl(norm));
  }

  if (URL_FILE) {
    const filePath = path.resolve(URL_FILE);
    if (!fs.existsSync(filePath)) throw new Error(`URL file not found: ${filePath}`);

    const lines = fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((s) => normalizeUrl(s.trim()))
      .filter(Boolean);

    for (const u of lines) {
      if (isListingUrl(u)) urls.push(rootListingUrl(u));
    }
  }

  return dedupeStrings(urls);
}

function extractProductLinksFromGrid($, pageUrl) {
  const results = [];
  const productCardSelectors = [
    "ul.products li.product",
    ".woocommerce ul.products li.product",
    ".products li.product",
    ".products .product",
    ".woocommerce .products .product",
    "li.product-category, li.product",
  ];

  const seen = new Set();

  for (const selector of productCardSelectors) {
    $(selector).each((_, card) => {
      const $card = $(card);

      if (
        $card.closest("header, footer, nav, .related, .upsells, .cross-sells, .breadcrumb, .woocommerce-breadcrumb")
          .length
      ) {
        return;
      }

      const anchors = $card.find('a[href*="/products/"]').toArray();
      for (const a of anchors) {
        const $a = $(a);
        const href = normalizeTrailingSlashUrl(absUrl(pageUrl, $a.attr("href") || ""));
        const label = textClean($a.text());

        if (!isProductDetailUrl(href)) continue;
        if (looksLikeListingLandingProduct(href, pageUrl, label)) continue;

        const key = href;
        if (seen.has(key)) continue;
        seen.add(key);

        results.push({
          href,
          label,
        });
      }
    });
  }

  return results;
}

function extractSubcategoryUrls($, pageUrl) {
  const out = [];
  const pageRoot = rootListingUrl(pageUrl);
  const thisPath = categoryPathFromListingUrl(pageUrl);

  const selectors = [
    "ul.products li.product-category a[href]",
    ".children a[href]",
    ".widget_product_categories a[href]",
    ".category-grid a[href]",
    ".product-category a[href]",
  ];

  for (const selector of selectors) {
    $(selector).each((_, a) => {
      const href = normalizeListingUrl(absUrl(pageUrl, $(a).attr("href") || ""));
      if (!isListingUrl(href)) return;

      const root = rootListingUrl(href);
      if (root === pageRoot) return;

      const subPath = categoryPathFromListingUrl(root);
      if (!subPath.length) return;
      if (subPath.length <= thisPath.length) return;

      const prefixMatch = thisPath.every((part, i) => subPath[i] === part);
      if (!prefixMatch) return;

      out.push(root);
    });
  }

  return dedupeStrings(out).sort();
}

function extractPaginationUrls($, pageUrl) {
  const out = [];
  const pageRoot = rootListingUrl(pageUrl);

  const selectors = [
    ".page-numbers a[href]",
    "nav.pagination a[href]",
    ".pagination a[href]",
    ".woocommerce-pagination a[href]",
  ];

  for (const selector of selectors) {
    $(selector).each((_, a) => {
      const href = normalizeListingUrl(absUrl(pageUrl, $(a).attr("href") || ""));
      if (!isListingUrl(href)) return;
      if (rootListingUrl(href) !== pageRoot) return;
      out.push(href);
    });
  }

  return dedupeStrings(out).sort((a, b) => pageNumberFromUrl(a) - pageNumberFromUrl(b));
}

function extractListingPageData(html, pageUrl) {
  const $ = load(html, { decodeEntities: false });

  const canonical = normalizeListingUrl(
    $('link[rel="canonical"]').attr("href") || pageUrl
  );
  const title =
    textClean($("h1").first().text()) ||
    textClean($("title").text()) ||
    categoryPathFromListingUrl(canonical).at(-1) ||
    "";

  const description =
    textClean($(".term-description").first().text()) ||
    textClean($(".archive-description").first().text()) ||
    "";

  const productLinks = extractProductLinksFromGrid($, canonical);
  const productUrls = productLinks.map((v) => v.href);

  const subcategoryUrls = extractSubcategoryUrls($, canonical);
  const paginationUrls = extractPaginationUrls($, canonical);

  const pageNumbers = [pageNumberFromUrl(canonical)];
  for (const u of paginationUrls) pageNumbers.push(pageNumberFromUrl(u));

  return {
    pageUrl: canonical,
    pageNumber: pageNumberFromUrl(canonical),
    title,
    description,
    productUrls: dedupeStrings(productUrls).sort(),
    productCards: productLinks,
    subcategoryUrls,
    paginationUrls,
    maxSeenPage: Math.max(...pageNumbers, 1),
  };
}

function ensureCategoryRecord(map, listingUrl) {
  const root = rootListingUrl(listingUrl);

  if (!map.has(root)) {
    map.set(root, {
      rootUrl: root,
      categoryPath: categoryPathFromListingUrl(root),
      title: "",
      description: "",
      pageCount: 0,
      maxSeenPage: 1,
      pageUrls: [],
      subcategoryUrls: [],
      productUrls: [],
      pages: [],
    });
  }

  return map.get(root);
}

function finalizeCategories(categoryMap) {
  const categories = [];

  for (const category of categoryMap.values()) {
    category.pageUrls = dedupeStrings(category.pageUrls).sort(
      (a, b) => pageNumberFromUrl(a) - pageNumberFromUrl(b)
    );
    category.subcategoryUrls = dedupeStrings(category.subcategoryUrls).sort();
    category.productUrls = dedupeStrings(category.productUrls).sort();
    category.pageCount = category.pageUrls.length;
    category.pages.sort((a, b) => a.pageNumber - b.pageNumber);
    categories.push(category);
  }

  categories.sort((a, b) => a.rootUrl.localeCompare(b.rootUrl));
  return categories;
}

function saveSnapshot(payload) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
}

async function main() {
  log(`output: ${OUT}`);
  log(`cacheDir: ${CACHE_DIR}`);

  const output = {
    generatedAt: new Date().toISOString(),
    source: "Kent Scientific listing pages",
    sitemapUrl: SITEMAP_URL,
    seedCount: 0,
    visitedListingPages: 0,
    ok: 0,
    fail: 0,
    skipped: 0,
    categories: [],
    productUrlCount: 0,
    productUrls: [],
    errors: [],
  };

  try {
    let seeds = readInputUrls();

    if (!seeds.length || SAMPLE) {
      const sitemapHtml = await fetchCached(SITEMAP_URL);
      const all = collectSeedListingUrlsFromSitemap(sitemapHtml);
      seeds = LIMIT > 0 ? all.slice(0, LIMIT) : all;
    }

    if (!seeds.length) {
      saveSnapshot(output);
      throw new Error("No listing URLs found. Use --url, --file, or --sample --limit N");
    }

    output.seedCount = seeds.length;

    const queue = [...seeds];
    const queued = new Set(queue.map((u) => normalizeListingUrl(u)));
    const visitedPages = new Set();
    const categoryMap = new Map();
    const globalProducts = new Set();

    while (queue.length) {
      const nextListing = normalizeListingUrl(queue.shift());
      const root = rootListingUrl(nextListing);

      try {
        const html = await fetchCached(nextListing);
        const page = extractListingPageData(html, nextListing);

        if (!isListingUrl(page.pageUrl)) {
          output.skipped += 1;
          continue;
        }

        if (visitedPages.has(page.pageUrl)) {
          output.skipped += 1;
          continue;
        }

        visitedPages.add(page.pageUrl);

        const category = ensureCategoryRecord(categoryMap, root);
        if (!category.title) category.title = page.title;
        if (!category.description && page.description) category.description = page.description;
        category.maxSeenPage = Math.max(category.maxSeenPage, page.maxSeenPage);
        category.pageUrls.push(page.pageUrl);
        category.subcategoryUrls.push(...page.subcategoryUrls);
        category.productUrls.push(...page.productUrls);
        category.pages.push({
          pageUrl: page.pageUrl,
          pageNumber: page.pageNumber,
          productUrls: page.productUrls,
          subcategoryUrls: page.subcategoryUrls,
        });

        for (const p of page.productUrls) globalProducts.add(p);

        for (const pagedUrl of page.paginationUrls) {
          const norm = normalizeListingUrl(pagedUrl);
          if (!visitedPages.has(norm) && !queued.has(norm)) {
            queue.push(norm);
            queued.add(norm);
          }
        }

        for (const sub of page.subcategoryUrls) {
          const subRoot = rootListingUrl(sub);
          if (!queued.has(subRoot)) {
            queue.push(subRoot);
            queued.add(subRoot);
          }
        }

        output.ok += 1;
        output.visitedListingPages = visitedPages.size;
        output.categories = finalizeCategories(categoryMap);
        output.productUrls = [...globalProducts].sort();
        output.productUrlCount = output.productUrls.length;
        saveSnapshot(output);

        process.stdout.write(
          `\rvisited=${output.visitedListingPages} categories=${output.categories.length} products=${output.productUrlCount} fail=${output.fail}`
        );
      } catch (err) {
        output.fail += 1;
        output.errors.push({
          url: nextListing,
          error: String(err?.message || err),
        });
        saveSnapshot(output);

        process.stdout.write(
          `\rvisited=${output.visitedListingPages} categories=${output.categories.length} products=${output.productUrlCount} fail=${output.fail}`
        );
      }
    }

    process.stdout.write("\n");

    output.generatedAt = new Date().toISOString();
    output.categories = finalizeCategories(categoryMap);
    output.productUrls = [...globalProducts].sort();
    output.productUrlCount = output.productUrls.length;
    output.visitedListingPages = visitedPages.size;

    saveSnapshot(output);

    log(`saved: ${OUT}`);
    log(
      `visited=${output.visitedListingPages} categories=${output.categories.length} products=${output.productUrlCount} fail=${output.fail}`
    );
  } catch (err) {
    output.generatedAt = new Date().toISOString();
    output.fatalError = String(err?.message || err);
    saveSnapshot(output);
    warn(String(err?.message || err));
    warn(`error report saved to: ${OUT}`);
    process.exit(1);
  }
}

main();