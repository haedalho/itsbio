#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const STABLE_PAGE = "https://www.abmgood.com/Stable-Cell-Lines.html";
const SEARCH_PAGE = "https://www.abmgood.com/search";
const ENDPOINT = "https://www.abmgood.com/product/searchProducts";
const USER_AGENT = "Mozilla/5.0 (compatible; ITSBIO-ABM-StableCollector/1.0)";
const OUT = path.resolve("data/abm-stable-cell-catalog.json");
const CONCURRENCY = Math.max(1, Math.min(8, Number.parseInt(process.env.ABM_STABLE_CONCURRENCY || "5", 10) || 5));

function clean(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

function frontendCategoryIds(product) {
  const ids = new Set();
  const primary = Number(product?.frontend_category_id || 0);
  if (primary) ids.add(primary);
  for (const raw of String(product?.frontend_category_ids || "").split(",")) {
    const id = Number.parseInt(raw.trim(), 10);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }
  return ids;
}

function isOfficialStableMember(product) {
  return frontendCategoryIds(product).has(25);
}

async function getHtml(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return { response, html: await response.text() };
}

function parseExpectedCount(html) {
  const stable = String(html || "");
  const direct = stable.match(/title=["']Stable Cell Lines["'][\s\S]{0,450}?abm-search-filter-item-count[^>]*>\s*([\d,]+)/i)?.[1];
  if (direct) return Number(direct.replace(/,/g, ""));
  const fallback = stable.match(/Stable Cell Lines\s*\([^<()]*<[^>]*>\s*([\d,]+)/i)?.[1];
  return fallback ? Number(fallback.replace(/,/g, "")) : 0;
}

async function createSession() {
  const [{ html: searchHtml }, stablePage] = await Promise.all([getHtml(SEARCH_PAGE), getHtml(STABLE_PAGE)]);
  const expectedCount = parseExpectedCount(searchHtml);
  if (!expectedCount) throw new Error("Unable to determine live Stable Cell Lines count from ABM search page");

  const token = stablePage.html.match(/<meta[^>]+name=["']X-CSRF-TOKEN["'][^>]+content=["']([^"']+)["']/i)?.[1]
    || stablePage.html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']X-CSRF-TOKEN["']/i)?.[1]
    || "";
  const cookies = typeof stablePage.response.headers.getSetCookie === "function"
    ? stablePage.response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ")
    : String(stablePage.response.headers.get("set-cookie") || "").split(/,(?=[^;]+?=)/).map((value) => value.trim().split(";", 1)[0]).filter(Boolean).join("; ");
  if (!token || !cookies) throw new Error("Unable to establish ABM Stable Cell Lines session");
  return { token, cookies, expectedCount };
}

async function fetchPage(session, page, attempt = 1) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": USER_AGENT,
      "x-csrf-token": session.token,
      "x-requested-with": "XMLHttpRequest",
      origin: "https://www.abmgood.com",
      referer: STABLE_PAGE,
      cookie: session.cookies,
    },
    body: JSON.stringify({ _token: session.token, query: "", filter_id: "63", page }),
  });
  if (response.ok) {
    const payload = await response.json();
    if (payload?.code === 0 && payload?.data) return payload.data;
  }
  if (attempt < 4) {
    await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    return fetchPage(session, page, attempt + 1);
  }
  throw new Error(`Stable API page ${page} failed after ${attempt} attempts (HTTP ${response.status})`);
}

function toRecord(product) {
  const sku = clean(product?.cat_no);
  const title = clean(product?.name);
  const seoKey = clean(product?.seo?.url_key).replace(/^\/+/, "");
  const media = Array.isArray(product?.media) ? product.media : [];
  const imagePath = clean(media.find((item) => item?.file_type === "image" && item?.status !== 0)?.file_path);
  return {
    sku,
    title,
    sourceUrl: seoKey ? `https://www.abmgood.com/${seoKey}` : "",
    species: clean(product?.species),
    tissue: clean(product?.tissue),
    tissueSystem: clean(product?.tissue_system),
    cellType: clean(product?.cell_type),
    productType: clean(product?.product_type),
    geneName: clean(product?.gene_name || product?.info?.gene_symbol),
    geneFullName: clean(product?.gene_full_name),
    accessionNumber: clean(product?.accession_number),
    growthProperties: clean(product?.info?.growth_properties),
    officialImage: imagePath ? new URL(imagePath, "https://www.abmgood.com").toString() : "",
    updatedAt: clean(product?.updated_at),
  };
}

const session = await createSession();
console.log(`Official Stable Cell Lines count: ${session.expectedCount}`);
const first = await fetchPage(session, 1);
const lastPage = Number(first.lastPage || 0);
if (!lastPage) throw new Error("ABM Stable API did not return lastPage");
console.log(`Scanning ${lastPage} API pages; Stable membership is selected by official frontend category id 25, including multi-category memberships.`);

const pages = new Array(lastPage);
pages[0] = first;
let nextPage = 2;
async function worker() {
  while (true) {
    const page = nextPage++;
    if (page > lastPage) return;
    pages[page - 1] = await fetchPage(session, page);
    if (page % 100 === 0) console.log(`Fetched page ${page}/${lastPage}`);
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

const bySku = new Map();
let stableRowsSeen = 0;
let primaryStableRows = 0;
let secondaryStableRows = 0;
const secondaryBreakdown = new Map();
for (const data of pages) {
  for (const product of data?.products || []) {
    if (!isOfficialStableMember(product)) continue;
    stableRowsSeen += 1;
    if (Number(product?.frontend_category_id) === 25) {
      primaryStableRows += 1;
    } else {
      secondaryStableRows += 1;
      const key = `${clean(product?.category_name) || "(blank)"} | ${clean(product?.cell_type) || "(blank)"} | ${clean(product?.product_type) || "(blank)"}`;
      secondaryBreakdown.set(key, (secondaryBreakdown.get(key) || 0) + 1);
    }
    const record = toRecord(product);
    if (!record.sku || !record.title) continue;
    bySku.set(record.sku.toLowerCase(), record);
  }
}

const products = Array.from(bySku.values()).sort((a, b) => a.title.localeCompare(b.title, "en", { numeric: true, sensitivity: "base" }));
const secondaryMembershipBreakdown = Array.from(secondaryBreakdown.entries())
  .map(([key, count]) => ({ key, count }))
  .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

console.log(JSON.stringify({
  expected: session.expectedCount,
  uniqueCollected: products.length,
  rawStableRows: stableRowsSeen,
  primaryStableRows,
  secondaryStableRows,
  secondaryMembershipBreakdown: secondaryMembershipBreakdown.slice(0, 20),
}, null, 2));

if (products.length !== session.expectedCount) {
  throw new Error(`Stable catalog mismatch: official count=${session.expectedCount}, unique collected=${products.length}, raw stable rows=${stableRowsSeen}, primary=${primaryStableRows}, secondary=${secondaryStableRows}`);
}

const payload = {
  source: STABLE_PAGE,
  searchSource: SEARCH_PAGE,
  filterId: 63,
  frontendCategoryId: 25,
  collectedAt: new Date().toISOString(),
  expectedCount: session.expectedCount,
  collectedCount: products.length,
  classification: {
    primaryStableRows,
    secondaryStableRows,
    secondaryMembershipBreakdown,
  },
  products,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
console.log(JSON.stringify({ expected: session.expectedCount, collected: products.length, rawStableRows: stableRowsSeen, output: OUT, first: products.slice(0, 3), last: products.slice(-3) }, null, 2));
