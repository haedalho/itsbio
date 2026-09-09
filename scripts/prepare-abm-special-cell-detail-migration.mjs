#!/usr/bin/env node

/**
 * Build a verified, read-only migration inventory for products exposed by the
 * twelve Special Cell Line Collections category pages.
 *
 * The category tables are the source of scope. The official ABM search API is
 * used only to resolve each Cat. No. to its canonical product URL. Existing
 * local CELL details and non-special staged details are excluded so this job
 * migrates only genuinely missing product pages.
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { createClient } from "next-sanity";

const OUT = path.resolve(".cache/abm-special-cell-detail-migration");
const INVENTORY_FILE = path.join(OUT, "inventory.json");
const REPORT_FILE = path.join(OUT, "prepare-report.json");
const CELL_CATALOG_FILE = path.resolve("data/abm-cell-model-catalog.json");
const VERSION = String(process.env.ABM_REBUILD_VERSION || "2026-08-09-search-v5").trim();
const BATCH_KEY = String(process.env.ABM_SPECIAL_CELL_BATCH_KEY || "special-cell-20260909")
  .replace(/[^A-Za-z0-9_-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 80);
const SEARCH_GAP_MS = Math.max(200, Number(process.env.ABM_SEARCH_GAP_MS || 350));
const SEARCH_WORKERS = Math.max(1, Math.min(4, Number(process.env.ABM_SEARCH_WORKERS || 2)));
const BASE = "https://www.abmgood.com";
const SEARCH = `${BASE}/search`;
const USER_AGENT = "Mozilla/5.0 (compatible; ITSBIO-Special-Cell-Migration/1.0)";

const projectId = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const dataset = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const apiVersion = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const client = createClient({ projectId, dataset, apiVersion, useCdn: false });

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const normalizeSku = (value) => clean(value).replace(/\s+/g, "").normalize("NFKC").toLowerCase();
const normalizeHeader = (value) => clean(value)
  .toLowerCase()
  .replace(/[.:#()]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

function isSkuHeader(value) {
  return /^(?:cat(?:alog)?\s*(?:no|number)?|catalog\s*(?:no|number)|sku|item\s*(?:no|number))$/.test(normalizeHeader(value));
}

function isNameHeader(value) {
  return /^(?:product(?:\s+(?:name|description))?(?:\s*\/\s*(?:name|description))?|name|description|cell(?:\s+line)?(?:\s+name)?|model(?:\s+name)?)$/.test(normalizeHeader(value));
}

function indexFor(headers, pattern) {
  return headers.findIndex((header) => pattern.test(normalizeHeader(header)));
}

function validSku(value) {
  const sku = clean(value).replace(/\s+/g, "");
  return sku.length >= 2 && sku.length <= 64 && /\d/.test(sku) && /^[A-Za-z0-9][A-Za-z0-9._+\/-]*$/.test(sku);
}

function safeOfficialProductUrl(value) {
  try {
    const url = new URL(String(value || ""), BASE);
    if (!new Set(["abmgood.com", "www.abmgood.com"]).has(url.hostname.toLowerCase())) return "";
    if (!/\.html$/i.test(url.pathname)) return "";
    url.protocol = "https:";
    url.hostname = "www.abmgood.com";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function extractProductRows(html, page) {
  const $ = cheerio.load(String(html || ""), { decodeEntities: false });
  const products = [];

  $("table").each((_, table) => {
    const rows = $(table).find("tr").toArray();
    let headers = [];
    let skuIndex = -1;
    let nameIndex = -1;

    for (const row of rows.slice(0, 6)) {
      const candidate = $(row).children("th,td").toArray().map((cell) => clean($(cell).text()));
      const candidateSku = candidate.findIndex(isSkuHeader);
      const candidateName = candidate.findIndex(isNameHeader);
      if (candidateSku >= 0 && candidateName >= 0 && candidateSku !== candidateName) {
        headers = candidate;
        skuIndex = candidateSku;
        nameIndex = candidateName;
        break;
      }
    }

    if (skuIndex < 0 || nameIndex < 0) return;
    const modelTypeIndex = indexFor(headers, /^(?:model type|cell type|category|bio system)$/);
    const speciesIndex = indexFor(headers, /^species$/);
    const unitIndex = indexFor(headers, /^(?:unit|size|pack size)$/);
    const formatIndex = indexFor(headers, /^format$/);

    for (const row of rows) {
      const cells = $(row).children("td").toArray();
      if (cells.length <= Math.max(skuIndex, nameIndex)) continue;
      const sku = clean($(cells[skuIndex]).text()).replace(/\s+/g, "");
      const title = clean($(cells[nameIndex]).text());
      if (!validSku(sku) || !title) continue;

      const sourceCandidates = $(row).find("a[href]").toArray()
        .map((anchor) => safeOfficialProductUrl($(anchor).attr("href")))
        .filter(Boolean);
      const collectionTitle = clean(page.title).replace(/\s*\|.*$/, "");
      products.push({
        sku,
        title,
        unit: unitIndex >= 0 ? clean($(cells[unitIndex]).text()) : "",
        modelType: modelTypeIndex >= 0 ? clean($(cells[modelTypeIndex]).text()) : "",
        species: speciesIndex >= 0 ? clean($(cells[speciesIndex]).text()) : "",
        format: formatIndex >= 0 ? clean($(cells[formatIndex]).text()) : "",
        sourceCandidates: [...new Set(sourceCandidates)],
        listingFilter: {
          id: `special-cell:${page.path[2]}`,
          title: collectionTitle,
          path: ["Cellular Materials", "Special Cell Line Collections", collectionTitle],
        },
      });
    }
  });

  return products;
}

function bestPageRows(page) {
  const candidates = [
    page.legacyHtml,
    ...(page.contentBlocks || []).map((block) => block?.html),
    ...(page.blocks || []).map((block) => block?.html),
  ].filter(Boolean);
  return candidates
    .map((html) => extractProductRows(html, page))
    .sort((left, right) => right.length - left.length)[0] || [];
}

function dedupeProducts(rows) {
  const products = new Map();
  for (const row of rows) {
    const key = normalizeSku(row.sku);
    const current = products.get(key);
    if (!current) {
      products.set(key, { ...row, listingFilters: [row.listingFilter] });
      continue;
    }
    current.sourceCandidates = [...new Set([...current.sourceCandidates, ...row.sourceCandidates])];
    if (!current.listingFilters.some((item) => item.id === row.listingFilter.id)) {
      current.listingFilters.push(row.listingFilter);
    }
    if (!current.modelType && row.modelType) current.modelType = row.modelType;
    if (!current.species && row.species) current.species = row.species;
    if (!current.format && row.format) current.format = row.format;
    if (!current.unit && row.unit) current.unit = row.unit;
  }
  return [...products.values()];
}

function cookieHeader(values) {
  return (values || []).map((value) => String(value).split(";", 1)[0]).filter(Boolean).join("; ");
}

function setCookies(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const raw = headers.get("set-cookie");
  return raw ? [raw] : [];
}

async function openSearchSession() {
  const response = await fetch(SEARCH, {
    cache: "no-store",
    headers: { accept: "text/html", "user-agent": USER_AGENT },
  });
  if (!response.ok) throw new Error(`GET /search HTTP ${response.status}`);
  const html = await response.text();
  const $ = cheerio.load(html, { decodeEntities: false });
  const token = String($("#abm-search-filter-sections-form input[name='_token']").first().val() || "");
  if (!token) throw new Error("ABM search CSRF token missing");
  return { token, cookie: cookieHeader(setCookies(response.headers)) };
}

let nextRequestAt = 0;
async function waitForSearchSlot() {
  const now = Date.now();
  const scheduled = Math.max(now, nextRequestAt);
  nextRequestAt = scheduled + SEARCH_GAP_MS;
  if (scheduled > now) await sleep(scheduled - now);
}

function parseSearchResults(html) {
  const $ = cheerio.load(`<div id="__root">${String(html || "")}</div>`, { decodeEntities: false });
  const rows = [];
  $(".abm-search-results-item").each((_, element) => {
    const item = $(element);
    const anchor = item.find(".abm-search-results-item-product_name a[href]").first();
    const result = {
      title: clean(anchor.text()),
      url: safeOfficialProductUrl(anchor.attr("href")),
      sku: "",
      unit: "",
      searchCategory: clean(item.find(".abm-search-results-item-product_category").text()),
    };
    item.find(".abm-search-results-item-product_info-row").each((__, row) => {
      const label = clean($(row).find(".abm-search-results-item-product_info-label").text()).toLowerCase();
      const value = clean($(row).find(".abm-search-results-item-product_info-value").text());
      if (label.includes("cat.no") || label.includes("cat. no") || label.includes("catalog")) result.sku = value;
      if (label.startsWith("unit")) result.unit = value;
    });
    if (result.title && result.url) rows.push(result);
  });
  return rows;
}

async function searchOfficial(session, query) {
  let lastError = new Error(`Official search failed: ${query}`);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await waitForSearchSlot();
    const body = new URLSearchParams({
      _token: session.token,
      query,
      search_mode: "exact",
    });
    try {
      const response = await fetch(SEARCH, {
        method: "POST",
        cache: "no-store",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          cookie: session.cookie,
          "user-agent": USER_AGENT,
          "x-requested-with": "XMLHttpRequest",
        },
        body,
      });
      if (response.status === 429 || response.status === 408 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after") || 0);
        lastError = new Error(`Official search HTTP ${response.status}: ${query}`);
        await sleep(Math.max(retryAfter * 1000, Math.min(30_000, 1500 * (2 ** attempt))));
        continue;
      }
      if (!response.ok) throw new Error(`Official search HTTP ${response.status}: ${query}`);
      const json = await response.json();
      return parseSearchResults(json?.data?.resultHTML || "");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < 7) await sleep(Math.min(30_000, 1500 * (2 ** attempt)));
    }
  }
  throw lastError;
}

async function pool(items, workers, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await mapper(items[index], index);
    }
  }));
  return output;
}

async function resolveProductUrls(products) {
  if (!products.length) return [];
  const session = await openSearchSession();
  return await pool(products, SEARCH_WORKERS, async (product, index) => {
    const directUrl = product.sourceCandidates[0] || "";
    if (directUrl) return { status: "resolved", method: "category-link", product, result: { url: directUrl } };
    try {
      let results = await searchOfficial(session, product.sku);
      let match = results.find((row) => normalizeSku(row.sku) === normalizeSku(product.sku));
      if (!match) {
        results = await searchOfficial(session, product.title);
        match = results.find((row) => normalizeSku(row.sku) === normalizeSku(product.sku));
      }
      if (!match) return { status: "unresolved", product, error: "No exact Cat. No. result" };
      if ((index + 1) % 20 === 0 || index + 1 === products.length) {
        console.log(`[special-cell URLs] ${index + 1}/${products.length}`);
      }
      return { status: "resolved", method: "official-search", product, result: match };
    } catch (error) {
      return { status: "unresolved", product, error: String(error?.stack || error) };
    }
  });
}

fs.mkdirSync(OUT, { recursive: true });
const [pages, stagedDocuments] = await Promise.all([
  client.fetch(`*[
    _type == "category"
    && path[0] == "cellular-materials"
    && path[1] == "special-cell-line-collections"
    && count(path) == 3
  ] | order(path[2] asc) {
    title,
    path,
    sourceUrl,
    legacyHtml,
    contentBlocks[]{html},
    blocks[]{html}
  }`),
  client.fetch(`*[
    _type == "abmRebuildDetailChunk"
    && version == $version
    && kind == "product"
  ]{_id,"keys":records[].key}`, { version: VERSION }),
]);

if (pages.length !== 12) throw new Error(`Expected 12 Special Cell Line Collection pages, found ${pages.length}`);
const pageCoverage = pages.map((page) => ({ path: page.path.join("/"), rows: bestPageRows(page).length }));
const tableRows = pages.flatMap((page) => bestPageRows(page));
const products = dedupeProducts(tableRows);
const localCatalog = JSON.parse(fs.readFileSync(CELL_CATALOG_FILE, "utf8"));
const localSkus = new Set((localCatalog.products || []).map((product) => normalizeSku(product.sku)));
const ownBatchPrefix = `abm-rebuild-detail-product-batch-${BATCH_KEY}-chunk-`;
const otherStagedSkus = new Set(stagedDocuments
  .filter((document) => !String(document._id || "").startsWith(ownBatchPrefix))
  .flatMap((document) => document.keys || [])
  .map((key) => String(key || "").replace(/^product:/i, "").toLowerCase()));
const migrationTargets = products.filter((product) => {
  const sku = normalizeSku(product.sku);
  return !localSkus.has(sku) && !otherStagedSkus.has(sku);
});

const resolutions = await resolveProductUrls(migrationTargets);
const resolved = resolutions.filter((item) => item.status === "resolved");
const unresolved = resolutions.filter((item) => item.status !== "resolved");
const inventoryProducts = resolved.map(({ product, result }) => ({
  title: product.title,
  sku: product.sku,
  url: result.url,
  unit: result.unit || product.unit,
  searchCategory: product.modelType || result.searchCategory || "Special Cell Line Collection",
  filterTitle: product.listingFilters[0]?.title || "Special Cell Line Collection",
  filterPath: product.listingFilters[0]?.path || ["Cellular Materials", "Special Cell Line Collections"],
  listingFilters: product.listingFilters,
  species: product.species,
  format: product.format,
}));

const inventory = {
  generatedAt: new Date().toISOString(),
  products: inventoryProducts,
  services: [],
  excluded: [],
  productRuns: [{
    title: "Special Cell Line Collections missing details",
    expected: inventoryProducts.length,
    got: inventoryProducts.length,
    complete: true,
  }],
  serviceRuns: [{ title: "No services", expected: 0, got: 0, complete: true }],
};
const report = {
  generatedAt: inventory.generatedAt,
  version: VERSION,
  batchKey: BATCH_KEY,
  pages: pages.length,
  pageCoverage,
  tableRows: tableRows.length,
  duplicateTableRows: tableRows.length - products.length,
  uniqueProducts: products.length,
  alreadyInLocalCellDetails: products.filter((product) => localSkus.has(normalizeSku(product.sku))).length,
  alreadyInOtherStagedDetails: products.filter((product) => otherStagedSkus.has(normalizeSku(product.sku))).length,
  migrationTargets: migrationTargets.length,
  resolved: resolved.length,
  unresolved: unresolved.length,
  unresolvedProducts: unresolved.map((item) => ({
    sku: item.product.sku,
    title: item.product.title,
    error: item.error,
  })),
  productionProductWrites: 0,
  productionCategoryWrites: 0,
};

fs.writeFileSync(INVENTORY_FILE, `${JSON.stringify(inventory, null, 2)}\n`);
fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (unresolved.length) process.exitCode = 2;
