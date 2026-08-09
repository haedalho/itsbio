#!/usr/bin/env node
/**
 * Read-only ABM census for the full ITS BIO rebuild.
 *
 * Scope agreed for this project:
 *   - include all normal ABM Products
 *   - exclude large library/catalog products
 *   - collect all official ABM Services
 *   - DO NOT write to Sanity
 *
 * Outputs: .cache/abm-full-census/*
 */

import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const BASE = "https://www.abmgood.com";
const OUT_DIR = path.resolve(".cache/abm-full-census");
const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8";
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  if (i < 0) return fallback;
  const value = argv[i + 1];
  return value && !value.startsWith("--") ? value : fallback;
};

const MAX_CATEGORY_PAGES = Number(arg("--max-category-pages", "3000")) || 3000;
const MAX_PRODUCT_VALIDATIONS = Number(arg("--max-product-validations", "15000")) || 15000;
const CONCURRENCY = Math.max(1, Math.min(10, Number(arg("--concurrency", "5")) || 5));
const REQUEST_GAP_MS = Math.max(0, Number(arg("--gap-ms", "80")) || 80);

const PRODUCT_ROOTS = new Set(["General Materials", "Cellular Materials", "Genetic Materials"]);
const SERVICE_ROOTS = new Set([
  "Cell & Antibody Services",
  "DNA & Cloning Services",
  "Recombinant Virus Packaging",
]);

// Large catalog branches explicitly excluded from product-document migration.
// The landing category itself is preserved in taxonomy; individual SKUs below it are excluded.
const HARD_LIBRARY_BRANCHES = [
  ["Cellular Materials", "Cell Library Collections"],
  ["Genetic Materials", "Expression-Ready Libraries"],
];

// Collections can contain useful stand-alone products. Keep them visible for manual review rather
// than silently excluding them.
const REVIEW_BRANCH_TERMS = ["Special Cell Line Collections"];

const STATIC_SKIP_PATHS = [
  "/aboutus",
  "/browse",
  "/contact",
  "/resources",
  "/promotions",
  "/privacy-policy",
  "/terms",
  "/rewards",
  "/research",
  "/collaborate",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cleanText = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

function normalizeUrl(raw, base = BASE) {
  const value = String(raw || "").trim();
  if (!value || value.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(value)) return "";
  try {
    const url = new URL(value, base);
    if (url.hostname !== "www.abmgood.com" && url.hostname !== "abmgood.com") return "";
    url.protocol = "https:";
    url.hostname = "www.abmgood.com";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function canonicalNoQuery(raw) {
  const url = normalizeUrl(raw);
  if (!url) return "";
  const u = new URL(url);
  u.search = "";
  return u.toString();
}

function isStaticSkip(url) {
  try {
    const p = new URL(url).pathname.toLowerCase().replace(/\/$/, "");
    return STATIC_SKIP_PATHS.some((x) => p === x || p.startsWith(x + "/"));
  } catch {
    return true;
  }
}

async function fetchText(url, { retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      if (REQUEST_GAP_MS) await sleep(REQUEST_GAP_MS);
      const res = await fetch(url, {
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-Census/1.0; +https://itsbio.vercel.app)",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < retries) await sleep(500 * (attempt + 1));
    }
  }
  throw lastError || new Error(`Fetch failed: ${url}`);
}

function pickNavigationList($) {
  const candidates = $("ul.abm-page-category-nav-list")
    .toArray()
    .map((node) => $(node));
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.find("a[href]").length - a.find("a[href]").length);
  return candidates[0];
}

function parseNavigationTree(html, pageUrl) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const $nav = pickNavigationList($);
  if (!$nav?.length) return [];

  const nodes = [];
  function walk($ul, parents = []) {
    $ul.children("li").each((order, li) => {
      const $li = $(li);
      const $a = $li.children("a[href]").first();
      if (!$a.length) return;
      const title = cleanText($a.text());
      const url = canonicalNoQuery(normalizeUrl($a.attr("href"), pageUrl));
      if (!title || !url) return;
      const titles = [...parents.map((x) => x.title), title];
      const node = { title, url, order, titles, depth: titles.length };
      nodes.push(node);
      const child = $li.children("ul").first();
      if (child.length) walk(child, [...parents, node]);
    });
  }
  walk($nav, []);
  return nodes;
}

function underRoot(node, roots) {
  return node?.titles?.some((title, index) => index === 0 && roots.has(title));
}

function startsWithTrail(titles, trail) {
  if (!Array.isArray(titles) || titles.length < trail.length) return false;
  return trail.every((title, i) => titles[i] === title);
}

function isHardLibraryTrail(titles) {
  return HARD_LIBRARY_BRANCHES.some((trail) => startsWithTrail(titles, trail));
}

function isReviewTrail(titles) {
  return REVIEW_BRANCH_TERMS.some((term) => titles.includes(term));
}

function contentScope($) {
  const selectors = ["#abm-category-right-outer", ".abm-category-right", "#content", "main", ".container"];
  for (const selector of selectors) {
    const el = $(selector).first();
    if (el.length) return el;
  }
  return $("body");
}

function extractPaginationUrls($, pageUrl) {
  const out = new Set();
  $(".pagination a[href], a[rel='next'][href], a[aria-label*='next' i][href]").each((_, a) => {
    const url = normalizeUrl($(a).attr("href"), pageUrl);
    if (!url) return;
    const u = new URL(url);
    const current = new URL(pageUrl);
    if (u.pathname !== current.pathname) return;
    if (!u.search) return;
    out.add(u.toString());
  });
  return [...out];
}

function likelyProductCandidate(url, text, knownNavigationUrls) {
  if (!url || knownNavigationUrls.has(canonicalNoQuery(url))) return false;
  if (isStaticSkip(url)) return false;
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const pathname = u.pathname.toLowerCase();
  if (!pathname || pathname === "/") return false;
  if (/\.(pdf|docx?|xlsx?|zip|png|jpe?g|gif|webp)$/i.test(pathname)) return false;
  if (/\/(blog|news|knowledge|resource|promotion|category|manufacturer)\//i.test(pathname)) return false;
  const label = cleanText(text).toLowerCase();
  if (["view", "learn more", "read more", "details"].includes(label)) return true;
  // ABM product detail URLs frequently include a catalogue-number suffix and usually end in .html.
  if (/\.html$/i.test(pathname) && /-[a-z]{0,5}\d{2,}[a-z0-9-]*\.html$/i.test(pathname)) return true;
  if (/\.html$/i.test(pathname) && label.length >= 4) return true;
  return false;
}

function extractCandidatesFromCategory(html, pageUrl, knownNavigationUrls) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const scope = contentScope($).clone();
  scope.find("header,footer,nav,script,style,noscript,ul.abm-page-category-nav-list").remove();

  const candidates = new Map();
  const selectors = [
    ".product-thumb a[href]",
    ".product-layout a[href]",
    ".product-item a[href]",
    ".product-name a[href]",
    ".caption a[href]",
    "a[href]",
  ];
  for (const selector of selectors) {
    scope.find(selector).each((_, a) => {
      const $a = $(a);
      const url = normalizeUrl($a.attr("href"), pageUrl);
      const title = cleanText($a.text() || $a.attr("title") || $a.find("img").attr("alt"));
      if (!likelyProductCandidate(url, title, knownNavigationUrls)) return;
      const key = canonicalNoQuery(url);
      if (!key) return;
      const existing = candidates.get(key);
      if (!existing || title.length > existing.title.length) candidates.set(key, { url: key, title });
    });
  }
  return { candidates: [...candidates.values()], pagination: extractPaginationUrls($, pageUrl) };
}

function parseProductPage(html, url) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const scope = contentScope($);
  const allText = cleanText(scope.text());
  const catMatch = allText.match(/Cat\.?\s*No\.?\s*[:#]?\s*([A-Za-z0-9._/+\-]+)/i);
  const hasTabs = ["Specifications", "Datasheet", "Documents", "FAQs", "References", "Reviews"].filter((label) =>
    scope.find("a,button,li").toArray().some((el) => cleanText($(el).text()).toLowerCase() === label.toLowerCase())
  ).length >= 2;
  const title = cleanText(scope.find("h1").first().text() || $("h1").first().text() || $("title").first().text()).replace(/\s*\|.*$/, "");
  const sku = catMatch?.[1] || "";
  const isProduct = Boolean(sku || hasTabs);
  return { isProduct, title, sku, url };
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function crawlCategory(node, knownNavigationUrls) {
  const queue = [node.url];
  const seenPages = new Set();
  const candidates = new Map();
  const failures = [];

  while (queue.length && seenPages.size < MAX_CATEGORY_PAGES) {
    const pageUrl = queue.shift();
    if (!pageUrl || seenPages.has(pageUrl)) continue;
    seenPages.add(pageUrl);
    try {
      const html = await fetchText(pageUrl);
      const parsed = extractCandidatesFromCategory(html, pageUrl, knownNavigationUrls);
      for (const candidate of parsed.candidates) candidates.set(candidate.url, candidate);
      for (const next of parsed.pagination) if (!seenPages.has(next)) queue.push(next);
    } catch (error) {
      failures.push({ url: pageUrl, error: String(error?.message || error) });
    }
  }

  return { node, pages: [...seenPages], candidates: [...candidates.values()], failures };
}

async function fetchSanityInventory() {
  const query = `{
    "publishedProducts": *[_type=="product" && !(_id in path("drafts.**")) && (brandSlug=="abm" || brand->slug.current=="abm" || brand->themeKey=="abm")]{_id,title,sku,"slug":slug.current,sourceUrl,categoryPath,isActive},
    "draftProducts": count(*[_type=="product" && _id in path("drafts.**") && (brandSlug=="abm" || brand->slug.current=="abm" || brand->themeKey=="abm")]),
    "publishedCategories": *[_type=="category" && !(_id in path("drafts.**")) && (brandSlug=="abm" || themeKey=="abm" || brand->slug.current=="abm" || brand->themeKey=="abm")]{_id,title,path,sourceUrl,isActive},
    "draftCategories": count(*[_type=="category" && _id in path("drafts.**") && (brandSlug=="abm" || themeKey=="abm" || brand->slug.current=="abm" || brand->themeKey=="abm")])
  }`;
  const endpoint = new URL(`https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}`);
  endpoint.searchParams.set("query", query);
  try {
    const res = await fetch(endpoint, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`Sanity HTTP ${res.status}`);
    const body = await res.json();
    return body?.result || { error: "No result" };
  } catch (error) {
    return { error: String(error?.message || error) };
  }
}

function csvEscape(value) {
  const s = Array.isArray(value) ? value.join(" > ") : String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function writeCsv(file, rows) {
  const cols = ["status", "sku", "title", "url", "categoryPath", "listingPaths", "reason"];
  const lines = [cols.join(",")];
  for (const row of rows) lines.push(cols.map((c) => csvEscape(row[c])).join(","));
  fs.writeFileSync(path.join(OUT_DIR, file), lines.join("\n") + "\n", "utf8");
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log("[ABM census] fetching canonical navigation...");

  const homeHtml = await fetchText(`${BASE}/`);
  let nav = parseNavigationTree(homeHtml, `${BASE}/`);
  if (!nav.length) {
    const browseHtml = await fetchText(`${BASE}/browse`);
    nav = parseNavigationTree(browseHtml, `${BASE}/browse`);
  }
  if (!nav.length) throw new Error("Could not find ABM canonical navigation tree");

  const productNodes = nav.filter((node) => underRoot(node, PRODUCT_ROOTS));
  const serviceNodes = nav.filter((node) => underRoot(node, SERVICE_ROOTS));
  const knownNavigationUrls = new Set(nav.map((node) => canonicalNoQuery(node.url)).filter(Boolean));

  const productCategoryNodes = productNodes.filter((node) => node.depth >= 2);
  const crawlableNodes = productCategoryNodes.filter((node) => !isHardLibraryTrail(node.titles));
  const hardExcludedCategoryNodes = productCategoryNodes.filter((node) => isHardLibraryTrail(node.titles));

  console.log(`[ABM census] product taxonomy nodes=${productNodes.length}, crawlable=${crawlableNodes.length}, hard-library-nodes=${hardExcludedCategoryNodes.length}`);
  console.log(`[ABM census] service taxonomy nodes=${serviceNodes.length}`);

  const categoryResults = [];
  for (let i = 0; i < crawlableNodes.length; i++) {
    const node = crawlableNodes[i];
    console.log(`[category ${i + 1}/${crawlableNodes.length}] ${node.titles.join(" > ")}`);
    categoryResults.push(await crawlCategory(node, knownNavigationUrls));
  }

  const candidateMap = new Map();
  for (const result of categoryResults) {
    for (const candidate of result.candidates) {
      const existing = candidateMap.get(candidate.url) || {
        url: candidate.url,
        titleHint: candidate.title,
        listingPaths: [],
        reviewHint: false,
      };
      const pathTitles = result.node.titles;
      const key = pathTitles.join(" > ");
      if (!existing.listingPaths.some((x) => x.join(" > ") === key)) existing.listingPaths.push(pathTitles);
      existing.reviewHint ||= isReviewTrail(pathTitles);
      if (!existing.titleHint && candidate.title) existing.titleHint = candidate.title;
      candidateMap.set(candidate.url, existing);
    }
  }

  const candidateList = [...candidateMap.values()].slice(0, MAX_PRODUCT_VALIDATIONS);
  const truncated = candidateMap.size > candidateList.length;
  console.log(`[ABM census] validating product candidates=${candidateList.length}${truncated ? ` (TRUNCATED from ${candidateMap.size})` : ""}`);

  const validated = await mapLimit(candidateList, CONCURRENCY, async (candidate, index) => {
    if (index % 100 === 0) console.log(`[validate] ${index}/${candidateList.length}`);
    try {
      const html = await fetchText(candidate.url, { retries: 1 });
      const parsed = parseProductPage(html, candidate.url);
      return { ...candidate, ...parsed };
    } catch (error) {
      return { ...candidate, isProduct: false, error: String(error?.message || error) };
    }
  });

  const include = [];
  const review = [];
  const nonProducts = [];

  for (const item of validated) {
    if (!item.isProduct) {
      nonProducts.push(item);
      continue;
    }
    const title = item.title || item.titleHint || "";
    const titleLooksLibrary = /\blibrar(?:y|ies)\b/i.test(title);
    const titleLooksCollection = /\bcollection\b/i.test(title);
    const listingPaths = item.listingPaths || [];
    const primary = listingPaths[0] || [];
    const row = {
      status: "INCLUDE",
      sku: item.sku || "",
      title,
      url: item.url,
      categoryPath: primary,
      listingPaths: listingPaths.map((x) => x.join(" > ")).join(" | "),
      reason: "normal product",
    };
    if (item.reviewHint || titleLooksLibrary || titleLooksCollection) {
      review.push({ ...row, status: "REVIEW", reason: item.reviewHint ? "collection branch requires review" : "title contains library/collection" });
    } else {
      include.push(row);
    }
  }

  // Hard-excluded library branches are captured as taxonomy-level exclusions without crawling their huge SKU lists.
  const excludedLibrary = hardExcludedCategoryNodes.map((node) => ({
    status: "EXCLUDE_LIBRARY",
    sku: "",
    title: node.title,
    url: node.url,
    categoryPath: node.titles,
    listingPaths: "",
    reason: "large library/catalog branch: individual SKUs intentionally not crawled",
  }));

  const services = serviceNodes.map((node) => ({
    title: node.title,
    url: node.url,
    path: node.titles,
    depth: node.depth,
    root: node.titles[0] || "",
  }));

  const sanity = await fetchSanityInventory();
  const sanityProducts = Array.isArray(sanity?.publishedProducts) ? sanity.publishedProducts : [];
  const officialByUrl = new Set([...include, ...review].map((x) => canonicalNoQuery(x.url)));
  const sanityByUrl = new Set(sanityProducts.map((x) => canonicalNoQuery(x.sourceUrl)).filter(Boolean));
  const missingFromSanity = [...include, ...review].filter((x) => !sanityByUrl.has(canonicalNoQuery(x.url)));
  const sanityOnly = sanityProducts.filter((x) => x.sourceUrl && !officialByUrl.has(canonicalNoQuery(x.sourceUrl)));

  const summary = {
    generatedAt: new Date().toISOString(),
    scope: {
      include: "all normal ABM products and all official ABM services",
      exclude: "large library/catalog product branches",
      review: "ambiguous collection/library-labelled stand-alone products",
      sanityWrites: 0,
    },
    taxonomy: {
      productNodes: productNodes.length,
      productCategoryNodes: productCategoryNodes.length,
      crawlableProductCategoryNodes: crawlableNodes.length,
      hardExcludedLibraryCategoryNodes: hardExcludedCategoryNodes.length,
      serviceNodes: serviceNodes.length,
    },
    crawl: {
      categoryPagesFetched: categoryResults.reduce((sum, x) => sum + x.pages.length, 0),
      rawProductCandidates: candidateMap.size,
      validatedCandidates: validated.length,
      validationTruncated: truncated,
      includeProducts: include.length,
      reviewProducts: review.length,
      nonProductCandidates: nonProducts.length,
      categoryFetchFailures: categoryResults.reduce((sum, x) => sum + x.failures.length, 0),
    },
    sanity: {
      error: sanity?.error || null,
      publishedProducts: sanityProducts.length,
      draftProducts: Number(sanity?.draftProducts || 0),
      publishedCategories: Array.isArray(sanity?.publishedCategories) ? sanity.publishedCategories.length : 0,
      draftCategories: Number(sanity?.draftCategories || 0),
      officialNormalProductsMissingFromSanity: missingFromSanity.length,
      sanityProductsNotInThisOfficialNormalCensus: sanityOnly.length,
    },
  };

  fs.writeFileSync(path.join(OUT_DIR, "official-taxonomy.json"), JSON.stringify({ productNodes, serviceNodes, hardExcludedCategoryNodes }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "products-include.json"), JSON.stringify(include, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "products-review.json"), JSON.stringify(review, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "products-exclude-library.json"), JSON.stringify(excludedLibrary, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "services.json"), JSON.stringify(services, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "sanity-inventory.json"), JSON.stringify(sanity, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "missing-from-sanity.json"), JSON.stringify(missingFromSanity, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "sanity-only.json"), JSON.stringify(sanityOnly, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "non-product-candidates.json"), JSON.stringify(nonProducts, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));

  writeCsv("products-include.csv", include);
  writeCsv("products-review.csv", review);
  writeCsv("products-exclude-library.csv", excludedLibrary);

  const md = `# ABM full rebuild census\n\nGenerated: ${summary.generatedAt}\n\n## Scope\n\n- Include all normal ABM Products.\n- Exclude individual SKUs under large library/catalog branches.\n- Collect all official ABM Services.\n- Sanity writes in this run: **0**.\n\n## Official taxonomy\n\n- Product navigation nodes: **${summary.taxonomy.productNodes}**\n- Product category nodes: **${summary.taxonomy.productCategoryNodes}**\n- Crawlable product category nodes: **${summary.taxonomy.crawlableProductCategoryNodes}**\n- Hard-excluded large-library category nodes: **${summary.taxonomy.hardExcludedLibraryCategoryNodes}**\n- Service navigation nodes: **${summary.taxonomy.serviceNodes}**\n\n## Product census\n\n- Raw product candidates: **${summary.crawl.rawProductCandidates}**\n- Validated candidates: **${summary.crawl.validatedCandidates}**\n- INCLUDE normal products: **${summary.crawl.includeProducts}**\n- REVIEW products: **${summary.crawl.reviewProducts}**\n- Non-product links rejected: **${summary.crawl.nonProductCandidates}**\n- Category fetch failures: **${summary.crawl.categoryFetchFailures}**\n- Validation truncated: **${summary.crawl.validationTruncated ? "YES" : "NO"}**\n\n## Current Sanity comparison\n\n- Published ABM product docs: **${summary.sanity.publishedProducts}**\n- ABM product drafts: **${summary.sanity.draftProducts}**\n- Published ABM category docs: **${summary.sanity.publishedCategories}**\n- ABM category drafts: **${summary.sanity.draftCategories}**\n- Official normal/review products missing from current Sanity: **${summary.sanity.officialNormalProductsMissingFromSanity}**\n- Current Sanity products outside this normal-product census: **${summary.sanity.sanityProductsNotInThisOfficialNormalCensus}**\n\n## Large-library rule\n\nHard-excluded branches are recorded in \`products-exclude-library.json\`; their individual SKUs are deliberately not fetched. Ambiguous Collection/Library-labelled stand-alone items are routed to \`products-review.json\` instead of being silently dropped.\n`;
  fs.writeFileSync(path.join(OUT_DIR, "summary.md"), md, "utf8");

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("[ABM full census] FATAL", error?.stack || error?.message || error);
  process.exit(1);
});
