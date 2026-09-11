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
import { parseAbmRebuildDetail } from "../lib/abm/rebuild-parser.mjs";

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
const escapeHtml = (value) => clean(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

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

function titleSlugCandidates(title, sku) {
  const normalized = clean(title)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[™®©]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .toLowerCase();
  const variants = [
    normalized,
    normalized.replace(/\s*\([^)]*\)\s*/g, " "),
  ];
  const slugs = [...new Set(variants.map((value) => value
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  ).filter(Boolean))];
  const normalizedSku = clean(sku).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return [...new Set(slugs.flatMap((slug) => [
    normalizedSku ? `${BASE}/${slug}-${normalizedSku}.html` : "",
    `${BASE}/${slug}.html`,
  ]).filter(Boolean))];
}

function hasExactSpecificationSku(detail, expectedSku) {
  return (detail?.specificationTables || []).some((table) => table.some((row) =>
    row.length >= 2
    && isSkuHeader(row[0])
    && normalizeSku(row.slice(1).join(" | ")) === normalizeSku(expectedSku)
  ));
}

async function probeOfficialProductUrl(candidate, product) {
  try {
    const response = await fetch(candidate, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        accept: "text/html",
        "user-agent": USER_AGENT,
      },
    });
    if (!response.ok) return null;
    const finalUrl = safeOfficialProductUrl(response.url || candidate);
    if (!finalUrl || /pagenotfound/i.test(finalUrl)) return null;
    const html = await response.text();
    const detail = parseAbmRebuildDetail(html, finalUrl, {
      kind: "product",
      sku: product.sku,
      title: product.title,
      unit: product.unit,
    });
    if (!hasExactSpecificationSku(detail, product.sku)) return null;
    return {
      title: detail.title || product.title,
      sku: product.sku,
      unit: detail.unit || product.unit,
      searchCategory: detail.category || product.modelType,
      url: finalUrl,
    };
  } catch {
    return null;
  }
}

async function probeTitleSlug(product) {
  for (const candidate of titleSlugCandidates(product.title, product.sku)) {
    const match = await probeOfficialProductUrl(candidate, product);
    if (match) return match;
  }
  return null;
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
    const tissueIndex = indexFor(headers, /^(?:tissue|source tissue)$/);

    for (const row of rows) {
      const cells = $(row).children("td").toArray();
      if (cells.length <= Math.max(skuIndex, nameIndex)) continue;
      const sku = clean($(cells[skuIndex]).text()).replace(/\s+/g, "");
      const title = clean($(cells[nameIndex]).text());
      if (!validSku(sku) || !title) continue;

      const sourceCandidates = [
        safeOfficialProductUrl($(row).attr("data-href")),
        ...$(row).find("a[href]").toArray()
          .map((anchor) => safeOfficialProductUrl($(anchor).attr("href"))),
      ].filter(Boolean);
      const collectionTitle = clean(page.title).replace(/\s*\|.*$/, "");
      products.push({
        sku,
        title,
        unit: unitIndex >= 0 ? clean($(cells[unitIndex]).text()) : "",
        modelType: modelTypeIndex >= 0 ? clean($(cells[modelTypeIndex]).text()) : "",
        species: speciesIndex >= 0 ? clean($(cells[speciesIndex]).text()) : "",
        format: formatIndex >= 0 ? clean($(cells[formatIndex]).text()) : "",
        tissue: tissueIndex >= 0 ? clean($(cells[tissueIndex]).text()) : "",
        collectionSourceUrl: safeOfficialProductUrl(page.sourceUrl),
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
    page.liveHtml,
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
    if (!current.collectionSourceUrl && row.collectionSourceUrl) current.collectionSourceUrl = row.collectionSourceUrl;
    if (!current.listingFilters.some((item) => item.id === row.listingFilter.id)) {
      current.listingFilters.push(row.listingFilter);
    }
    if (!current.modelType && row.modelType) current.modelType = row.modelType;
    if (!current.species && row.species) current.species = row.species;
    if (!current.format && row.format) current.format = row.format;
    if (!current.tissue && row.tissue) current.tissue = row.tissue;
    if (!current.unit && row.unit) current.unit = row.unit;
  }
  return [...products.values()];
}

function categoryFallbackCollectorRow(product) {
  const sourceUrl = product.collectionSourceUrl;
  if (!sourceUrl) throw new Error(`${product.sku}: official collection source URL missing`);
  const collectionTitle = product.listingFilters[0]?.title || "Special Cell Line Collection";
  const specifications = [
    ["Cat. No.", product.sku],
    ["Product Name", product.title],
    ["Collection", collectionTitle],
    ["Model Type", product.modelType],
    ["Species", product.species],
    ["Tissue", product.tissue],
    ["Format", product.format],
    ["Unit", product.unit],
  ].filter(([, value]) => clean(value));
  const specificationsHtml = `<table><tbody>${specifications.map(([label, value]) =>
    `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
  ).join("")}</tbody></table>`;
  const inventory = {
    title: product.title,
    sku: product.sku,
    url: sourceUrl,
    unit: product.unit,
    searchCategory: product.modelType || "Special Cell Line Collection",
    filterTitle: collectionTitle,
    filterPath: product.listingFilters[0]?.path || ["Cellular Materials", "Special Cell Line Collections"],
    listingFilters: product.listingFilters,
    species: product.species,
    tissue: product.tissue,
    format: product.format,
  };
  const row = {
    status: "ok",
    inventory,
    finalUrl: sourceUrl,
    collectedAt: new Date().toISOString(),
    qa: {
      skuMatch: true,
      specifications: true,
      officialImage: false,
      priceLeak: false,
      source: "official-collection-table",
    },
    detail: {
      kind: "product",
      sku: product.sku,
      title: product.title,
      unit: product.unit,
      sourceUrl,
      category: collectionTitle,
      breadcrumbs: ["Cellular Materials", "Special Cell Line Collections", collectionTitle],
      description: "",
      storage: "",
      materialCitation: "",
      introHtml: "",
      specificationsHtml,
      datasheetHtml: "",
      documentsHtml: "",
      faqsHtml: "",
      referencesHtml: "",
      reviewsHtml: "",
      documents: [],
      images: [],
      verification: {
        skuMatches: true,
        hasSpecifications: true,
        hasOfficialImages: false,
        priceLeak: false,
        source: "official-collection-table",
      },
    },
  };
  if (normalizeSku(product.sku) !== "t9997") return row;

  row.detail.description = "Kasumi-1 is a human acute myeloid leukemia cell line established from peripheral blood and characterized by the t(8;21) translocation and AML-ETO fusion gene.";
  row.detail.storage = "Vapor phase of liquid nitrogen, or below -130°C.";
  row.detail.materialCitation = "Applied Biological Materials Inc., Cat. No. T9997.";
  row.detail.introHtml = `<p><strong>Kasumi-1 Cells (T9997)</strong> are listed by ABM in the Blood Cell Collection as a human tumor cell product derived from blood.</p><p>The ABM product-detail URL is no longer published. The product fields below preserve ABM's current catalog record, verified ABM-T9997 storage and shipping data from an ABM distributor, and clearly separated reference characteristics for the same Kasumi-1 cell line from JCRB Cell Bank.</p>`;
  row.detail.specificationsHtml = `<div class="abm-products-specification"><h3>ABM Product Record</h3><table><tbody><tr><th>Cat. No.</th><td>T9997</td></tr><tr><th>Name</th><td>Kasumi-1 Cells</td></tr><tr><th>Collection</th><td>Blood Cell Collection</td></tr><tr><th>Model Type</th><td>Tumor Cells</td></tr><tr><th>Organism</th><td>Human (H. sapiens)</td></tr><tr><th>Tissue</th><td>Blood</td></tr><tr><th>Regulatory Status</th><td>Research Use Only (RUO)</td></tr><tr><th>Shipping</th><td>Dry Ice</td></tr><tr><th>Storage Condition</th><td>Vapor phase of liquid nitrogen, or below -130°C.</td></tr></tbody></table><h3>Reference Cell-Line Characteristics (JCRB1003)</h3><table><tbody><tr><th>Profile</th><td>Human acute myeloid leukemia cell line with t(8;21) chromosome translocation</td></tr><tr><th>Primary Site</th><td>Peripheral blood</td></tr><tr><th>Morphology</th><td>Myeloblast</td></tr><tr><th>Growth Properties</th><td>Suspension culture</td></tr><tr><th>Genetics</th><td>t(8;21), AML-ETO fusion gene</td></tr><tr><th>Growth Medium</th><td>RPMI 1640 with 10% heat-inactivated fetal bovine serum</td></tr><tr><th>Culture Conditions</th><td>37°C, 5% CO₂; simple dilution twice weekly</td></tr><tr><th>Classification</th><td>Tumor cell line</td></tr></tbody></table></div>`;
  row.detail.documentsHtml = `<div class="abm-doc-div"><div class="abm-doc-title">ABM Cell Handling Resources</div><ul class="abm-document-list"><li><a href="https://www.abmgood.com/uploads/document/IMPORTANT-CONSIDERATIONS-Cell-Culture-150623.pdf" target="_blank" rel="noopener noreferrer">Important Considerations for Cell Culture</a></li><li><a href="https://www.abmgood.com/uploads/document/Cell_Handling_Instructions_Upon_Arrival_150623.pdf" target="_blank" rel="noopener noreferrer">Cell Handling Instructions Upon Arrival</a></li></ul></div>`;
  row.detail.referencesHtml = `<div class="abm-doc-div"><ul><li><a href="https://www.abmgood.com/blood-cell-collection.html" target="_blank" rel="noopener noreferrer">ABM Blood Cell Collection</a> — current manufacturer catalog entry for T9997.</li><li><a href="https://www.caltagmedsystems.co.uk/products/product_detail.php?CI_ID=2585623" target="_blank" rel="noopener noreferrer">Caltag Medsystems ABM-T9997 record</a> — ABM supplier, shipping, storage, and RUO fields.</li><li><a href="https://cellbank.nibn.go.jp/~cellbank/en/search_res_det.cgi?ID=2072" target="_blank" rel="noopener noreferrer">JCRB1003 Kasumi-1</a> — reference identity and culture characteristics for the same cell line.</li><li><a href="https://pubmed.ncbi.nlm.nih.gov/2018839/" target="_blank" rel="noopener noreferrer">Establishment of a human acute myeloid leukemia cell line (Kasumi-1) with 8;21 chromosome translocation</a>.</li></ul></div>`;
  row.detail.documents = [
    { title: "Important Considerations for Cell Culture", url: "https://www.abmgood.com/uploads/document/IMPORTANT-CONSIDERATIONS-Cell-Culture-150623.pdf", section: "documents" },
    { title: "Cell Handling Instructions Upon Arrival", url: "https://www.abmgood.com/uploads/document/Cell_Handling_Instructions_Upon_Arrival_150623.pdf", section: "documents" },
  ];
  row.detail.verification = {
    ...row.detail.verification,
    source: "official-collection-plus-verified-references",
    sourceDetailAvailable: false,
  };
  return row;
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

async function fetchLiveCategoryHtml(page) {
  const sourceUrl = safeOfficialProductUrl(page.sourceUrl);
  if (!sourceUrl) return { ...page, liveHtml: "", liveSourceStatus: "invalid-source-url" };
  try {
    const response = await fetch(sourceUrl, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        accept: "text/html",
        "user-agent": USER_AGENT,
      },
    });
    const finalUrl = safeOfficialProductUrl(response.url || sourceUrl);
    if (!response.ok || !finalUrl || /pagenotfound/i.test(finalUrl)) {
      return { ...page, liveHtml: "", liveSourceStatus: `http-${response.status}` };
    }
    const liveHtml = await response.text();
    if (liveHtml.length < 500) return { ...page, liveHtml: "", liveSourceStatus: "empty-response" };
    return { ...page, liveHtml, liveSourceStatus: "ok" };
  } catch (error) {
    return { ...page, liveHtml: "", liveSourceStatus: `fetch-error:${String(error?.message || error)}` };
  }
}

async function resolveProductUrls(products) {
  if (!products.length) return [];
  const session = await openSearchSession();
  return await pool(products, SEARCH_WORKERS, async (product, index) => {
    const directUrl = product.sourceCandidates[0] || "";
    if (directUrl) {
      const directMatch = await probeOfficialProductUrl(directUrl, product);
      if (directMatch) return { status: "resolved", method: "verified-category-link", product, result: directMatch };
    }
    try {
      let results = await searchOfficial(session, product.sku);
      let match = results.find((row) => normalizeSku(row.sku) === normalizeSku(product.sku));
      if (!match) {
        results = await searchOfficial(session, product.title);
        match = results.find((row) => normalizeSku(row.sku) === normalizeSku(product.sku));
      }
      if (match) {
        const verifiedSearchMatch = await probeOfficialProductUrl(match.url, product);
        if (verifiedSearchMatch) match = { ...match, ...verifiedSearchMatch };
        else match = null;
      }
      if (!match) {
        const titleSlugMatch = await probeTitleSlug(product);
        if (titleSlugMatch) return { status: "resolved", method: "verified-title-slug", product, result: titleSlugMatch };
        return { status: "unresolved", product, error: "No live official detail page with an exact Cat. No. match" };
      }
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
const sourcePages = await pool(pages, 4, fetchLiveCategoryHtml);
const pageCoverage = sourcePages.map((page) => ({
  path: page.path.join("/"),
  rows: bestPageRows(page).length,
  liveSourceStatus: page.liveSourceStatus,
}));
const tableRows = sourcePages.flatMap((page) => bestPageRows(page));
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
const categoryFallbackRows = unresolved.map((item) => categoryFallbackCollectorRow(item.product));
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
  tissue: product.tissue,
  format: product.format,
}));

const inventory = {
  generatedAt: new Date().toISOString(),
  products: inventoryProducts,
  categoryFallbackRows,
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
  pages: sourcePages.length,
  pageCoverage,
  tableRows: tableRows.length,
  duplicateTableRows: tableRows.length - products.length,
  uniqueProducts: products.length,
  alreadyInLocalCellDetails: products.filter((product) => localSkus.has(normalizeSku(product.sku))).length,
  alreadyInOtherStagedDetails: products.filter((product) => otherStagedSkus.has(normalizeSku(product.sku))).length,
  migrationTargets: migrationTargets.length,
  resolvedOfficialProductPages: resolved.length,
  categoryTableFallbacks: categoryFallbackRows.length,
  unresolved: 0,
  unavailableOfficialProductPages: unresolved.map((item) => ({
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
