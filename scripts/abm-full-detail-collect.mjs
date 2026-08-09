#!/usr/bin/env node
/**
 * Full ABM rebuild detail collector — READ ONLY.
 *
 * 1. Rebuilds the authoritative normal Product + Service inventory from /search.
 * 2. Fetches each unique official Product page once.
 * 3. Groups Service offerings by URL and fetches each unique Service page once.
 * 4. Parses full current detail (Specifications included; price/cart removed).
 * 5. Writes local artifact corpus + QA summary. No Sanity writes.
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { parseAbmRebuildDetailV2 } from "../lib/abm/rebuild-parser-v2.mjs";

const BASE = "https://www.abmgood.com";
const SEARCH = `${BASE}/search`;
const OUT = path.resolve(".cache/abm-full-detail-collect");
const argv = process.argv.slice(2);
const readArg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const DETAIL_WORKERS = Math.max(1, Math.min(4, Number(readArg("--workers", "2")) || 2));
const GAP_MS = Math.max(50, Number(readArg("--gap-ms", "140")) || 140);
const LIMIT_PRODUCTS = Math.max(0, Number(readArg("--limit-products", "0")) || 0);
const LIMIT_SERVICES = Math.max(0, Number(readArg("--limit-services", "0")) || 0);
const RESUME = argv.includes("--resume");

const INCLUDE = [
  "General Materials",
  "3D and Organoid",
  "Microbial Contamination",
  "Cell Immortalization Reagents",
  "Media & Supplements",
  "Growth Factors and Cytokines",
  "Culture Consumables",
  "Cell Assay Products",
  "Cas9 Vectors & Virus",
  "Cas Proteins & CRISPR Screening",
  "Expression Systems",
  "Specialized Vectors",
  "Kits for Viral Vectors",
];
const EXCLUDE = [
  "Cell Library Collections",
  "Expression-Ready Libraries",
  "CRISPR KO Vectors & Virus",
  "CRISPR Activation Vectors",
];
const SERVICES = ["Cell & Antibody Services", "DNA & Cloning Services", "Recombinant Virus Packaging"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (v) => String(v || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const safeName = (v) => clean(v).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100) || "record";

function cookieHeader(xs) {
  return (xs || []).map((x) => String(x).split(";", 1)[0]).filter(Boolean).join("; ");
}
function getSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const raw = headers.get("set-cookie");
  return raw ? [raw] : [];
}

async function openSearchSession() {
  const r = await fetch(SEARCH, {
    cache: "no-store",
    headers: { "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-DetailCollector/1.0)", accept: "text/html" },
  });
  if (!r.ok) throw new Error(`GET /search HTTP ${r.status}`);
  const html = await r.text();
  const $ = cheerio.load(html, { decodeEntities: false });
  const form = $("#abm-search-filter-sections-form").first();
  const token = String(form.find("input[name='_token']").val() || "");
  if (!token) throw new Error("ABM search CSRF token missing");
  const filters = [];
  form.find("input[name='fc_ids[]']").each((_, input) => {
    const $i = $(input);
    const a = $i.closest("a.abm-search-filter-item");
    const title = clean(a.attr("title") || a.find(".abm-search-filter-item-name").clone().children().remove().end().text());
    const count = Number(clean(a.find(".abm-search-filter-item-count").text()).replace(/,/g, "")) || 0;
    const level = Number(String(a.attr("style") || "").match(/--level:\s*(\d+)/)?.[1] || 0);
    filters.push({ id: String($i.val() || ""), title, count, level });
  });
  const stack = [];
  for (const f of filters) {
    while (stack.length >= f.level) stack.pop();
    f.path = [...stack.map((x) => x.title), f.title];
    stack.push(f);
  }
  return { token, cookie: cookieHeader(getSetCookies(r.headers)), filters };
}

async function postSearch(session, filter, page) {
  for (let attempt = 0; attempt < 7; attempt++) {
    await sleep(160);
    const body = new URLSearchParams();
    body.append("_token", session.token);
    body.append("query", "");
    body.append("search_mode", "exact");
    body.append("fc_ids[]", filter.id);
    if (page > 1) body.append("page", String(page));
    const r = await fetch(SEARCH, {
      method: "POST",
      cache: "no-store",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-DetailCollector/1.0)",
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        cookie: session.cookie,
        "x-requested-with": "XMLHttpRequest",
      },
      body,
    });
    if (r.status === 429) {
      const retry = Number(r.headers.get("retry-after") || 0);
      await sleep(Math.max(retry * 1000, 1800 * (attempt + 1)));
      continue;
    }
    if (!r.ok) throw new Error(`${filter.title} page ${page}: HTTP ${r.status}`);
    return await r.json();
  }
  throw new Error(`${filter.title} page ${page}: repeated HTTP 429`);
}

function parseSearchHtml(html, filter) {
  const $ = cheerio.load(`<div>${html || ""}</div>`, { decodeEntities: false });
  const rows = [];
  $(".abm-search-results-item").each((_, el) => {
    const e = $(el);
    const a = e.find(".abm-search-results-item-product_name a[href]").first();
    const title = clean(a.text());
    const url = String(a.attr("href") || "").trim();
    let sku = "";
    let unit = "";
    e.find(".abm-search-results-item-product_info-row").each((__, row) => {
      const label = clean($(row).find(".abm-search-results-item-product_info-label").text()).toLowerCase();
      const value = clean($(row).find(".abm-search-results-item-product_info-value").text());
      if (label.includes("cat.no")) sku = value;
      if (label.startsWith("unit")) unit = value;
    });
    if (title && url) {
      rows.push({
        title,
        url,
        sku,
        unit,
        searchCategory: clean(e.find(".abm-search-results-item-product_category").text()),
        filterId: filter.id,
        filterTitle: filter.title,
        filterPath: filter.path,
      });
    }
  });
  return rows;
}

async function collectFilter(session, filter) {
  const rows = [];
  let page = 1;
  let expected = filter.count;
  let showMore = true;
  while (showMore) {
    const json = await postSearch(session, filter, page);
    expected = Number(json.count || expected || 0);
    const got = parseSearchHtml(json?.data?.resultHTML || "", filter);
    rows.push(...got);
    showMore = Boolean(json?.data?.showLoadMore);
    if (showMore && !got.length) throw new Error(`${filter.title}: empty page ${page} with showLoadMore=true`);
    console.log(`[inventory] ${filter.title} page=${page} cumulative=${rows.length}/${expected}`);
    page++;
  }
  return { filter, expected, rows, complete: rows.length === expected };
}

function dedupeInventory(rows) {
  const m = new Map();
  for (const row of rows) {
    const key = row.sku ? `sku:${row.sku.toLowerCase()}` : `url:${row.url.toLowerCase()}`;
    if (!m.has(key)) {
      m.set(key, { ...row, listingFilters: [{ id: row.filterId, title: row.filterTitle, path: row.filterPath }] });
    } else {
      const e = m.get(key);
      if (!e.listingFilters.some((x) => x.id === row.filterId)) e.listingFilters.push({ id: row.filterId, title: row.filterTitle, path: row.filterPath });
    }
  }
  return [...m.values()];
}

async function authoritativeInventory() {
  const session = await openSearchSession();
  const byTitle = new Map(session.filters.map((f) => [f.title, f]));
  const get = (names) => names.map((name) => byTitle.get(name)).filter(Boolean);
  const included = get(INCLUDE);
  const excluded = get(EXCLUDE);
  const services = get(SERVICES);
  const missingFilters = [...INCLUDE, ...EXCLUDE, ...SERVICES].filter((name) => !byTitle.has(name));
  if (missingFilters.length) throw new Error(`Official search filters missing: ${missingFilters.join(", ")}`);

  const productRuns = [];
  for (const filter of included) productRuns.push(await collectFilter(session, filter));
  const serviceRuns = [];
  for (const filter of services) serviceRuns.push(await collectFilter(session, filter));

  const productRows = dedupeInventory(productRuns.flatMap((r) => r.rows));
  const serviceRows = dedupeInventory(serviceRuns.flatMap((r) => r.rows));
  return {
    generatedAt: new Date().toISOString(),
    products: productRows,
    services: serviceRows,
    excluded: excluded.map((f) => ({ title: f.title, count: f.count, path: f.path })),
    productRuns: productRuns.map((r) => ({ title: r.filter.title, expected: r.expected, got: r.rows.length, complete: r.complete })),
    serviceRuns: serviceRuns.map((r) => ({ title: r.filter.title, expected: r.expected, got: r.rows.length, complete: r.complete })),
  };
}

async function fetchDetailHtml(url) {
  for (let attempt = 0; attempt < 7; attempt++) {
    await sleep(GAP_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const r = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-DetailCollector/1.0; +https://itsbio.vercel.app)",
          accept: "text/html,application/xhtml+xml",
        },
      });
      clearTimeout(timer);
      if (r.status === 429) {
        const retry = Number(r.headers.get("retry-after") || 0);
        await sleep(Math.max(retry * 1000, 1500 * (attempt + 1)));
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { html: await r.text(), finalUrl: r.url || url, httpStatus: r.status };
    } catch (error) {
      clearTimeout(timer);
      if (attempt === 6) throw error;
      await sleep(500 * (attempt + 1));
    }
  }
  throw new Error("fetch failed");
}

async function pool(items, workers, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, items.length) }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

function loadCached(dir, key) {
  if (!RESUME) return null;
  const file = path.join(dir, `${safeName(key)}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}
function saveCached(dir, key, value) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${safeName(key)}.json`), JSON.stringify(value));
}

function hasPriceLeak(result) {
  const htmls = [
    result.introHtml,
    result.specificationsHtml,
    result.datasheetHtml,
    result.documentsHtml,
    result.faqsHtml,
    result.referencesHtml,
    result.reviewsHtml,
    result.serviceDetailsHtml,
  ].filter(Boolean).join("\n");
  return /(?:\$\s*\d|\b(?:USD|CAD)\s*\d|>\s*(?:Price|Cost|Amount)\s*</i.test(htmls);
}

async function collectProductDetails(products) {
  const dir = path.join(OUT, "product-records");
  return await pool(products, DETAIL_WORKERS, async (item, index) => {
    const key = item.sku || item.url;
    const cached = loadCached(dir, key);
    if (cached) return cached;
    if (index % 100 === 0) console.log(`[product detail] ${index}/${products.length}`);
    try {
      const fetched = await fetchDetailHtml(item.url);
      const detail = parseAbmRebuildDetailV2(fetched.html, fetched.finalUrl, { ...item, kind: "product" });
      const record = {
        status: "ok",
        inventory: item,
        finalUrl: fetched.finalUrl,
        detail,
        qa: {
          skuMatch: detail.verification?.skuMatches === true,
          specifications: detail.verification?.hasSpecifications === true,
          officialImages: detail.counts?.images || 0,
          documents: detail.counts?.documents || 0,
          faqs: detail.counts?.faqs || 0,
          priceLeak: hasPriceLeak(detail),
        },
      };
      saveCached(dir, key, record);
      return record;
    } catch (error) {
      const record = { status: "error", inventory: item, error: String(error?.stack || error) };
      saveCached(dir, key, record);
      return record;
    }
  });
}

async function collectServiceDetails(services) {
  const byUrl = new Map();
  for (const item of services) {
    const key = item.url;
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key).push(item);
  }
  const groups = [...byUrl.entries()].map(([url, offerings]) => ({ url, offerings }));
  const dir = path.join(OUT, "service-records");
  const groupResults = await pool(groups, DETAIL_WORKERS, async (group, index) => {
    const cached = loadCached(dir, group.url);
    if (cached) return cached;
    if (index % 25 === 0) console.log(`[service page] ${index}/${groups.length}`);
    try {
      const fetched = await fetchDetailHtml(group.url);
      const offerings = group.offerings.map((item) => {
        const detail = parseAbmRebuildDetailV2(fetched.html, fetched.finalUrl, { ...item, kind: "service" });
        return {
          status: "ok",
          inventory: item,
          detail,
          qa: {
            skuMatch: detail.verification?.skuMatches === true,
            serviceOfferMatch: item.sku ? detail.verification?.serviceOfferMatched === true : true,
            documents: detail.counts?.documents || 0,
            officialImages: detail.counts?.images || 0,
            priceLeak: hasPriceLeak(detail),
          },
        };
      });
      const record = { status: "ok", url: group.url, finalUrl: fetched.finalUrl, offerings };
      saveCached(dir, group.url, record);
      return record;
    } catch (error) {
      const record = { status: "error", url: group.url, offerings: group.offerings, error: String(error?.stack || error) };
      saveCached(dir, group.url, record);
      return record;
    }
  });
  return { groups, groupResults, offeringResults: groupResults.flatMap((g) => g.offerings || []) };
}

function compactDetail(record) {
  if (record.status !== "ok") return record;
  return record;
}

function makeSummary(inventory, productResults, serviceData) {
  const productOk = productResults.filter((r) => r.status === "ok");
  const productErrors = productResults.filter((r) => r.status !== "ok");
  const skuMismatches = productOk.filter((r) => !r.qa.skuMatch);
  const noSpecs = productOk.filter((r) => !r.qa.specifications);
  const noImages = productOk.filter((r) => r.qa.officialImages === 0);
  const priceLeaks = productOk.filter((r) => r.qa.priceLeak);

  const serviceGroupsOk = serviceData.groupResults.filter((r) => r.status === "ok");
  const serviceGroupsError = serviceData.groupResults.filter((r) => r.status !== "ok");
  const serviceOk = serviceData.offeringResults.filter((r) => r.status === "ok");
  const serviceSkuMismatch = serviceOk.filter((r) => !r.qa.skuMatch);
  const serviceOfferMismatch = serviceOk.filter((r) => !r.qa.serviceOfferMatch);
  const servicePriceLeaks = serviceOk.filter((r) => r.qa.priceLeak);

  return {
    generatedAt: new Date().toISOString(),
    sanityWrites: 0,
    inventory: {
      products: inventory.products.length,
      services: inventory.services.length,
      excludedLargeCatalogCount: inventory.excluded.reduce((n, x) => n + x.count, 0),
      productFiltersComplete: inventory.productRuns.every((x) => x.complete),
      serviceFiltersComplete: inventory.serviceRuns.every((x) => x.complete),
    },
    products: {
      attempted: productResults.length,
      ok: productOk.length,
      fetchParseErrors: productErrors.length,
      skuMismatches: skuMismatches.length,
      withoutSpecifications: noSpecs.length,
      withoutOfficialImage: noImages.length,
      withOfficialImage: productOk.length - noImages.length,
      priceLeakRecords: priceLeaks.length,
    },
    services: {
      offeringsAttempted: serviceData.offeringResults.length,
      uniquePages: serviceData.groups.length,
      pagesOk: serviceGroupsOk.length,
      pageErrors: serviceGroupsError.length,
      skuMismatches: serviceSkuMismatch.length,
      offerRowMismatches: serviceOfferMismatch.length,
      priceLeakRecords: servicePriceLeaks.length,
    },
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("[ABM full detail] rebuilding authoritative inventory...");
  const inventory = await authoritativeInventory();
  if (!inventory.productRuns.every((x) => x.complete) || !inventory.serviceRuns.every((x) => x.complete)) {
    throw new Error("Authoritative search inventory is incomplete; refusing detail collection");
  }
  fs.writeFileSync(path.join(OUT, "inventory.json"), JSON.stringify(inventory, null, 2));

  let products = inventory.products;
  let services = inventory.services;
  if (LIMIT_PRODUCTS) products = products.slice(0, LIMIT_PRODUCTS);
  if (LIMIT_SERVICES) services = services.slice(0, LIMIT_SERVICES);

  console.log(`[ABM full detail] products=${products.length}, services=${services.length}, workers=${DETAIL_WORKERS}`);
  const productResults = await collectProductDetails(products);
  const serviceData = await collectServiceDetails(services);
  const summary = makeSummary(inventory, productResults, serviceData);

  fs.writeFileSync(path.join(OUT, "products.json"), JSON.stringify(productResults.map(compactDetail), null, 2));
  fs.writeFileSync(path.join(OUT, "services.json"), JSON.stringify(serviceData.offeringResults, null, 2));
  fs.writeFileSync(path.join(OUT, "service-pages.json"), JSON.stringify(serviceData.groupResults, null, 2));
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));

  const productBad = productResults.filter((r) => r.status !== "ok" || !r.qa?.skuMatch || r.qa?.priceLeak);
  const serviceBad = serviceData.offeringResults.filter((r) => r.status !== "ok" || !r.qa?.skuMatch || !r.qa?.serviceOfferMatch || r.qa?.priceLeak);
  fs.writeFileSync(path.join(OUT, "product-review.json"), JSON.stringify(productBad, null, 2));
  fs.writeFileSync(path.join(OUT, "service-review.json"), JSON.stringify(serviceBad, null, 2));

  const md = `# ABM full detail collection\n\nGenerated: ${summary.generatedAt}\n\nSanity writes: **0**\n\n## Inventory\n- Official normal Products: **${summary.inventory.products}**\n- Official Services: **${summary.inventory.services}**\n- Excluded large generated/library results: **${summary.inventory.excludedLargeCatalogCount}**\n- Product filters complete: **${summary.inventory.productFiltersComplete}**\n- Service filters complete: **${summary.inventory.serviceFiltersComplete}**\n\n## Product details\n- Attempted: **${summary.products.attempted}**\n- Parsed: **${summary.products.ok}**\n- Fetch/parse errors: **${summary.products.fetchParseErrors}**\n- SKU mismatches: **${summary.products.skuMismatches}**\n- No Specifications: **${summary.products.withoutSpecifications}**\n- With official image: **${summary.products.withOfficialImage}**\n- Official page has no usable product image: **${summary.products.withoutOfficialImage}**\n- Price leaks: **${summary.products.priceLeakRecords}**\n\n## Service details\n- Offerings attempted: **${summary.services.offeringsAttempted}**\n- Unique source pages fetched: **${summary.services.uniquePages}**\n- Source pages OK: **${summary.services.pagesOk}**\n- Source page errors: **${summary.services.pageErrors}**\n- SKU mismatches: **${summary.services.skuMismatches}**\n- Service row mismatches: **${summary.services.offerRowMismatches}**\n- Price leaks: **${summary.services.priceLeakRecords}**\n`;
  fs.writeFileSync(path.join(OUT, "summary.md"), md);
  console.log(JSON.stringify(summary, null, 2));

  if (
    summary.products.fetchParseErrors ||
    summary.products.skuMismatches ||
    summary.products.priceLeakRecords ||
    summary.services.pageErrors ||
    summary.services.skuMismatches ||
    summary.services.offerRowMismatches ||
    summary.services.priceLeakRecords
  ) process.exitCode = 2;
}

main().catch((error) => {
  console.error("[ABM full detail] FATAL", error?.stack || error);
  process.exit(1);
});
