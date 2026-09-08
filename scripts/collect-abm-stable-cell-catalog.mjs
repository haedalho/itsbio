#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const STABLE_PAGE = "https://www.abmgood.com/Stable-Cell-Lines.html";
const SEARCH_PAGE = "https://www.abmgood.com/search";
const FRONTEND_CATEGORY_ID = 25;
const USER_AGENT = "Mozilla/5.0 (compatible; ITSBIO-ABM-StableCollector/2.1)";
const OUT = path.resolve("data/abm-stable-cell-catalog.json");
const CONCURRENCY = Math.max(1, Math.min(8, Number.parseInt(process.env.ABM_STABLE_CONCURRENCY || "5", 10) || 5));
const PAGE_SIZE = 10;

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function clean(value) {
  return decodeHtml(String(value || ""))
    .replace(/<sup>(.*?)<\/sup>/gi, "^$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getHtml(url, attempt = 1) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
  });
  if (response.ok) return await response.text();
  if (attempt < 4) {
    await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
    return getHtml(url, attempt + 1);
  }
  throw new Error(`${url}: HTTP ${response.status}`);
}

function parseExpectedCount(html) {
  const direct = String(html || "").match(/title=["']Stable Cell Lines["'][\s\S]{0,500}?abm-search-filter-item-count[^>]*>\s*([\d,]+)/i)?.[1];
  return direct ? Number(direct.replace(/,/g, "")) : 0;
}

function stableSearchUrl(page) {
  const params = new URLSearchParams();
  params.append("fc_ids[]", String(FRONTEND_CATEGORY_ID));
  if (page > 1) params.set("page", String(page));
  return `${SEARCH_PAGE}?${params.toString()}`;
}

function normalizeLabel(value) {
  return clean(value).replace(/\s*:\s*$/, "").toLowerCase();
}

function parseInfoFields(chunk) {
  const fields = {};
  const rowRe = /abm-search-results-item-product_info-label[^>]*>([\s\S]*?)<\/div>\s*<div\s+class=["']abm-search-results-item-product_info-value["'][^>]*>([\s\S]*?)<\/div>/gi;
  for (const match of chunk.matchAll(rowRe)) {
    const label = normalizeLabel(match[1]);
    const value = clean(match[2]);
    if (!label || !value || label === "price") continue;
    fields[label] = value;
  }
  return fields;
}

function parseProducts(html, page) {
  const marker = '<div class="abm-search-results-item">';
  const chunks = String(html || "").split(marker).slice(1);
  const products = [];

  for (const chunk of chunks) {
    const nameMatch = chunk.match(/abm-search-results-item-product_name[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!nameMatch) continue;
    const sourceUrl = new URL(decodeHtml(nameMatch[1]), SEARCH_PAGE).toString();
    const title = clean(nameMatch[2]);
    const fields = parseInfoFields(chunk);
    const sku = clean(fields["cat.no."] || fields["cat.no"] || fields["cat no."] || fields["cat no"] || "");
    if (!sku || !title) continue;

    const primaryCategory = clean(chunk.match(/abm-search-results-item-product_category[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]);
    products.push({
      sku,
      title,
      sourceUrl,
      stableMembership: true,
      primaryCategory,
      unit: clean(fields.unit),
      species: clean(fields.species),
      tissue: clean(fields.tissue),
      tissueSystem: clean(fields["tissue system"]),
      cellType: clean(fields["cell type"]),
      productType: clean(fields["product type"]),
      geneName: clean(fields["gene name"] || fields.gene || fields["gene symbol"]),
      geneFullName: clean(fields["gene full name"]),
      accessionNumber: clean(fields["accession number"] || fields.accession),
      growthProperties: clean(fields["growth properties"] || fields["growth property"]),
      donorHistory: clean(fields["donor history"]),
      page,
    });
  }

  return products;
}

const rootHtml = await getHtml(SEARCH_PAGE);
const expectedCount = parseExpectedCount(rootHtml);
if (!expectedCount) throw new Error("Unable to determine live Stable Cell Lines count from ABM search page");
const totalPages = Math.ceil(expectedCount / PAGE_SIZE);
console.log(`Official Stable Cell Lines search count: ${expectedCount}; collecting ${totalPages} pages from fc_ids[]=${FRONTEND_CATEGORY_ID}`);

const pageProducts = new Array(totalPages);
let nextPage = 1;
async function worker() {
  while (true) {
    const page = nextPage++;
    if (page > totalPages) return;
    const html = await getHtml(stableSearchUrl(page));
    const products = parseProducts(html, page);
    const expectedOnPage = page < totalPages ? PAGE_SIZE : (expectedCount - PAGE_SIZE * (totalPages - 1));
    if (products.length !== expectedOnPage) {
      throw new Error(`Stable search page ${page}: expected ${expectedOnPage} products, parsed ${products.length}`);
    }
    pageProducts[page - 1] = products;
    if (page === 1 || page % 20 === 0 || page === totalPages) console.log(`Collected page ${page}/${totalPages} (${products.length} products)`);
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

const bySku = new Map();
const duplicates = [];
for (const product of pageProducts.flat()) {
  const key = product.sku.toLowerCase();
  if (bySku.has(key)) duplicates.push(product.sku);
  bySku.set(key, product);
}
const products = Array.from(bySku.values()).sort((a, b) => a.title.localeCompare(b.title, "en", { numeric: true, sensitivity: "base" }));

if (duplicates.length) throw new Error(`Duplicate Stable SKUs across official search pages: ${[...new Set(duplicates)].join(", ")}`);
if (products.length !== expectedCount) throw new Error(`Stable catalog mismatch: official count=${expectedCount}, unique collected=${products.length}`);

const primaryCategoryCounts = new Map();
for (const product of products) {
  const category = product.primaryCategory || "(blank)";
  primaryCategoryCounts.set(category, (primaryCategoryCounts.get(category) || 0) + 1);
}
const categoryBreakdown = Array.from(primaryCategoryCounts, ([category, count]) => ({ category, count }))
  .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
const directStableCount = primaryCategoryCounts.get("Stable Cell Lines") || 0;
const crossListedCount = products.length - directStableCount;

const payload = {
  source: STABLE_PAGE,
  searchSource: `${SEARCH_PAGE}?fc_ids%5B%5D=${FRONTEND_CATEGORY_ID}`,
  frontendCategoryId: FRONTEND_CATEGORY_ID,
  collectedAt: new Date().toISOString(),
  expectedCount,
  collectedCount: products.length,
  pageSize: PAGE_SIZE,
  totalPages,
  classification: {
    directStableCount,
    crossListedCount,
    primaryCategoryBreakdown: categoryBreakdown,
  },
  products: products.map(({ page: _page, ...product }) => product),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
console.log(JSON.stringify({
  output: OUT,
  expected: expectedCount,
  collected: products.length,
  directStableCount,
  crossListedCount,
  categoryBreakdown,
  first: products.slice(0, 3),
  last: products.slice(-3),
}, null, 2));
