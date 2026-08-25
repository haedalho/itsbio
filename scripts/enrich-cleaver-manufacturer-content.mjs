#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");
const cheerio = require("cheerio");

const APPLY = process.argv.includes("--apply");
const MIGRATION_KEY = "cleaver-products-2026-08-24";
const MANUFACTURER_BRAND_ID = 1889;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_ADDITIONS = 500;
const SOURCE_HOSTS = new Set(["wisertech.it", "www.wisertech.it", "www.thistlescientific.com", "thistlescientific.com"]);
const IMAGE_HOSTS = new Set(["wisertech.it", "www.wisertech.it", "www.thistlescientific.com", "thistlescientific.com"]);
const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const cleanText = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");

const inventory = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-product-catalog.json"), "utf8"));
const reviewedSkus = new Map(inventory.map((row) => [normalizeSku(row.sku), row]));
if (inventory.length !== 1432 || reviewedSkus.size !== 1432) throw new Error("Expected exactly 1,432 reviewed Cleaver product SKUs.");

const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim()).find(Boolean);
if (APPLY && !token) throw new Error("Cleaver enrichment requires the existing Production Sanity write token.");

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

async function pooled(items, concurrency, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const position = next;
      next += 1;
      await worker(items[position], position);
    }
  }));
}

async function retry(label, operation, attempts = 5) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = Number(error?.statusCode || error?.response?.statusCode || 0);
      if (attempt === attempts - 1 || (status && ![408, 409, 429].includes(status) && status < 500)) throw error;
      const delay = Math.min(15_000, 700 * (2 ** attempt));
      console.warn(`[Cleaver enrichment] retrying ${label} in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function fetchReviewed(rawUrl, accept = "application/json,text/html;q=0.9,*/*;q=0.8") {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !SOURCE_HOSTS.has(url.hostname)) throw new Error(`Unapproved Cleaver source: ${url.hostname}`);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { headers: { Accept: accept }, redirect: "follow", signal: AbortSignal.timeout(55_000) });
    if ([401, 403].includes(response.status)) throw new Error(`Cleaver source access denied (HTTP ${response.status}): ${url.hostname}`);
    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      const requested = Number.parseInt(response.headers.get("retry-after") || "0", 10) * 1000;
      const delay = Math.min(30_000, Math.max(requested || 0, 1400 * (2 ** attempt)));
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (!response.ok) throw new Error(`Cleaver source returned HTTP ${response.status}: ${url.hostname}`);
    return response;
  }
  throw new Error(`Cleaver source remained unavailable: ${url.hostname}`);
}

function normalizeImage(raw) {
  try {
    const url = new URL(String(raw || "").startsWith("//") ? `https:${raw}` : String(raw || "").trim());
    if (url.protocol !== "https:" || !IMAGE_HOSTS.has(url.hostname)) return "";
    if (!/\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname)) return "";
    if (/(?:^|[-_/])(?:logo|placeholder|no[-_]?image|woocommerce-placeholder)(?:[-_.]|$)/i.test(url.pathname)) return "";
    url.searchParams.delete("width");
    url.searchParams.delete("height");
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function cleanOverview(rawHtml) {
  if (!rawHtml) return "";
  const $ = cheerio.load(rawHtml);
  $("script,style,iframe,form,button,table,img,video,svg,noscript").remove();
  $("h1").remove();
  $("h2,h3,h4,h5,h6").each((_, heading) => {
    const title = cleanText($(heading).text());
    if (/^(?:specifications?|technical data|documents?|downloads?|related products?|accessories|you may also like)\s*:?$/i.test(title)) $(heading).remove();
  });
  $("a").each((_, anchor) => $(anchor).replaceWith($(anchor).text()));
  $("p,li,div").each((_, element) => {
    const text = cleanText($(element).text());
    if (!text || /\b(?:Wisertech|price|VAT|shipping|add to cart|wishlist)\b/i.test(text)) {
      if (!$(element).find("p,ul,ol,h2,h3,h4").length) $(element).remove();
    }
  });
  $("*").each((_, element) => {
    for (const attribute of Object.keys(element.attribs || {})) $(element).removeAttr(attribute);
  });
  return ($("body").html() || "").trim();
}

function overviewText(html) {
  return cleanText(cheerio.load(html || "")("body").text());
}

function extractOverviewDetails(html) {
  const $ = cheerio.load(html || "");
  const paragraphs = $("p").toArray().map((node) => cleanText($(node).text())).filter((text) => text.length > 45 && text.length < 700);
  const body = cleanText($("body").text());
  const summary = (paragraphs[0] || body).slice(0, 340).trim();
  const lists = $("ul,ol").toArray().map((list) => $(list).find("li").toArray().map((item) => cleanText($(item).text())).filter((item) => item.length > 8 && item.length < 180));
  const highlights = (lists.find((list) => list.length >= 2) || []).slice(0, 8);
  return { summary, highlights };
}

function extractDocuments(rawHtml, baseUrl) {
  const $ = cheerio.load(rawHtml || "");
  const documents = new Map();
  $("a[href]").each((_, node) => {
    try {
      const url = new URL($(node).attr("href"), baseUrl);
      if (url.protocol !== "https:" || !/\.pdf(?:$|\?)/i.test(url.toString())) return;
      const label = cleanText($(node).text());
      const filename = decodeURIComponent(url.pathname.split("/").at(-1) || "Product document.pdf").replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
      const title = label && !/^(?:click here|download|pdf)$/i.test(label) ? label : filename;
      documents.set(url.toString(), { _key: hash(url.toString()).slice(0, 12), title: title.slice(0, 160), label: title.slice(0, 160), url: url.toString() });
    } catch {
      // Ignore malformed links.
    }
  });
  return [...documents.values()].slice(0, 10);
}

function extractSpecificationRows(rawHtml, requestedSku, attributes = []) {
  const $ = cheerio.load(rawHtml || "");
  const sku = normalizeSku(requestedSku);
  const rows = [];
  const seen = new Set();
  const add = (label, value) => {
    const name = cleanText(label).replace(/:\s*$/, "");
    const detail = cleanText(value);
    const key = name.toLowerCase();
    if (!name || !detail || name.length > 120 || detail.length > 600 || seen.has(key)) return;
    if (/^(?:sku|catalog(?:ue)?(?:\s+(?:no\.?|number))?|part number|brand)$/i.test(name)) return;
    seen.add(key);
    rows.push({ _key: hash(`${sku}:${name}:${detail}`).slice(0, 12), label: name, value: detail });
  };

  $("table").each((_, table) => {
    const matrix = $(table).find("tr").toArray().map((tr) => $(tr).find("th,td").toArray().map((cell) => cleanText($(cell).text()))).filter((row) => row.length > 1);
    if (!matrix.length) return;
    const header = matrix[0];
    const matchingColumn = header.findIndex((cell) => normalizeSku(cell) === sku);
    if (matchingColumn > 0) {
      matrix.slice(1).forEach((row) => add(row[0], row[matchingColumn]));
      return;
    }
    const matchingRow = matrix.find((row) => normalizeSku(row[0]) === sku);
    if (matchingRow && matchingRow.length === header.length) {
      header.slice(1).forEach((label, index) => add(label, matchingRow[index + 1]));
      return;
    }
    const containsOtherReviewedSku = matrix.some((row) => row.some((cell) => reviewedSkus.has(normalizeSku(cell)) && normalizeSku(cell) !== sku));
    if (!containsOtherReviewedSku && matrix.every((row) => row.length === 2)) matrix.forEach((row) => add(row[0], row[1]));
  });

  for (const attribute of Array.isArray(attributes) ? attributes : []) {
    const values = Array.isArray(attribute?.terms) ? attribute.terms.map((term) => cleanText(term?.name)).filter(Boolean) : [];
    if (values.length) add(attribute?.name, values.join(", "));
  }
  return rows.slice(0, 36);
}

function candidateFromProduct(product, sourceName, parent = null) {
  const sku = normalizeSku(product?.sku);
  if (!reviewedSkus.has(sku)) return null;
  const page = String(product?.permalink || parent?.permalink || "https://www.thistlescientific.com/");
  const rawHtml = [parent?.description, parent?.short_description, product?.description, product?.short_description].filter(Boolean).join("\n");
  const overviewHtml = cleanOverview(rawHtml);
  const { summary, highlights } = extractOverviewDetails(overviewHtml);
  const specRows = extractSpecificationRows(rawHtml, sku, [...(Array.isArray(parent?.attributes) ? parent.attributes : []), ...(Array.isArray(product?.attributes) ? product.attributes : [])]);
  const docs = extractDocuments(rawHtml, page);
  const images = [...new Set([...(Array.isArray(product?.images) ? product.images : []), ...(Array.isArray(parent?.images) ? parent.images : [])].map((image) => normalizeImage(image?.src)).filter(Boolean))].slice(0, 5);
  return { sku, sourceName, page, overviewHtml, summary, highlights, specRows, docs, images };
}

function mergeCandidates(first, second) {
  if (!first) return second;
  if (!second) return first;
  const richer = overviewText(second.overviewHtml).length > overviewText(first.overviewHtml).length ? second : first;
  const mergeBy = (a, b, keyFn, limit) => {
    const map = new Map();
    for (const row of [...a, ...b]) map.set(keyFn(row), row);
    return [...map.values()].slice(0, limit);
  };
  return {
    ...richer,
    summary: second.summary?.length > first.summary?.length ? second.summary : first.summary,
    highlights: [...new Set([...(first.highlights || []), ...(second.highlights || [])])].slice(0, 8),
    specRows: mergeBy(first.specRows || [], second.specRows || [], (row) => cleanText(row.label).toLowerCase(), 36),
    docs: mergeBy(first.docs || [], second.docs || [], (row) => row.url, 10),
    images: [...new Set([...(first.images || []), ...(second.images || [])])].slice(0, 5),
    sourceName: `${first.sourceName}; ${second.sourceName}`,
  };
}

const candidates = new Map();
const wiserUrl = (page) => `https://wisertech.it/wp-json/wc/store/v1/products?brand=${MANUFACTURER_BRAND_ID}&per_page=100&page=${page}`;
const firstWiser = await fetchReviewed(wiserUrl(1));
const wiserPages = Number.parseInt(firstWiser.headers.get("x-wp-totalpages") || "1", 10);
const wiserTotal = Number.parseInt(firstWiser.headers.get("x-wp-total") || "0", 10);
if (wiserPages < 10 || wiserPages > 30 || wiserTotal < 1200) throw new Error(`Unexpected verified Cleaver source size: ${wiserTotal} products, ${wiserPages} pages.`);

function collectWiser(rows) {
  for (const product of Array.isArray(rows) ? rows : []) {
    const branded = Array.isArray(product?.brands) && product.brands.some((brand) => Number(brand?.id) === MANUFACTURER_BRAND_ID && /thistle scientific/i.test(String(brand?.name || "")));
    if (!branded) continue;
    const candidate = candidateFromProduct(product, "Wisertech verified Thistle Scientific catalog");
    if (candidate) candidates.set(candidate.sku, mergeCandidates(candidates.get(candidate.sku), candidate));
  }
}
collectWiser(await firstWiser.json());
await pooled(Array.from({ length: wiserPages - 1 }, (_, index) => index + 2), 4, async (page) => collectWiser(await (await fetchReviewed(wiserUrl(page))).json()));

const officialProducts = new Map();
const batches = Array.from({ length: Math.ceil(inventory.length / 35) }, (_, index) => inventory.slice(index * 35, index * 35 + 35));
await pooled(batches, 4, async (batch) => {
  try {
    const url = new URL("https://www.thistlescientific.com/wp-json/wc/store/v1/products");
    url.searchParams.set("sku", batch.map((row) => row.sku).join(","));
    url.searchParams.set("per_page", "100");
    const rows = await (await fetchReviewed(url.toString())).json();
    for (const row of Array.isArray(rows) ? rows : []) {
      const sku = normalizeSku(row?.sku);
      if (reviewedSkus.has(sku)) officialProducts.set(sku, row);
    }
  } catch (error) {
    console.warn(`[Cleaver enrichment] optional direct manufacturer batch: ${error.message}`);
  }
});

const parentIds = [...new Set([...officialProducts.values()].map((row) => Number(row?.parent)).filter((id) => Number.isSafeInteger(id) && id > 0))];
const parents = new Map();
await pooled(Array.from({ length: Math.ceil(parentIds.length / 30) }, (_, index) => parentIds.slice(index * 30, index * 30 + 30)), 4, async (batch) => {
  try {
    const url = new URL("https://www.thistlescientific.com/wp-json/wc/store/v1/products");
    url.searchParams.set("include", batch.join(","));
    url.searchParams.set("per_page", "100");
    const rows = await (await fetchReviewed(url.toString())).json();
    for (const row of Array.isArray(rows) ? rows : []) parents.set(Number(row?.id), row);
  } catch (error) {
    console.warn(`[Cleaver enrichment] optional direct manufacturer parent batch: ${error.message}`);
  }
});

for (const [sku, product] of officialProducts) {
  const candidate = candidateFromProduct(product, "Thistle Scientific direct product catalog", parents.get(Number(product?.parent)));
  if (candidate) candidates.set(sku, mergeCandidates(candidates.get(sku), candidate));
}

const existing = await client.fetch(`*[_type == "product" && migrationKey == $key]{
  _id,sku,title,summary,overviewHtml,highlights,
  specRows[]{_key,label,value},docs[]{_key,title,label,url},
  images[]{_key,_type,sourceUrl,asset,"url":asset->url,"width":asset->metadata.dimensions.width}
}`, { key: MIGRATION_KEY });
if (!Array.isArray(existing) || existing.length !== 1432) throw new Error(`Expected 1,432 published Cleaver products, found ${existing?.length || 0}.`);

const metrics = (rows) => ({
  products: rows.length,
  photos: rows.filter((row) => Array.isArray(row.images) && row.images.length > 0).length,
  galleries: rows.filter((row) => Array.isArray(row.images) && row.images.length > 1).length,
  overview: rows.filter((row) => overviewText(row.overviewHtml).length >= 120).length,
  specs: rows.filter((row) => Array.isArray(row.specRows) && row.specRows.length > 0).length,
  docs: rows.filter((row) => Array.isArray(row.docs) && row.docs.length > 0).length,
});

console.log(JSON.stringify({ phase: "before", ...metrics(existing), sourceCandidates: candidates.size, directManufacturerMatches: officialProducts.size, wiserCatalogProducts: wiserTotal }));
if (candidates.size < 1000) throw new Error(`Only ${candidates.size} verified exact-SKU candidates were collected; refusing enrichment.`);

function mergeSpecRows(existingRows = [], candidateRows = []) {
  const result = [...(Array.isArray(existingRows) ? existingRows : [])];
  const labels = new Set(result.map((row) => cleanText(row?.label).toLowerCase()));
  for (const row of (Array.isArray(candidateRows) ? candidateRows : [])) {
    const key = cleanText(row?.label).toLowerCase();
    if (!key || labels.has(key)) continue;
    labels.add(key);
    result.push(row);
  }
  return result.slice(0, 36);
}

function mergeDocs(existingRows = [], candidateRows = []) {
  const result = [...(Array.isArray(existingRows) ? existingRows : [])];
  const urls = new Set(result.map((row) => String(row?.url || "")));
  for (const row of (Array.isArray(candidateRows) ? candidateRows : [])) {
    if (!row?.url || urls.has(row.url)) continue;
    urls.add(row.url);
    result.push(row);
  }
  return result.slice(0, 10);
}

const plans = [];
for (const row of existing) {
  const candidate = candidates.get(normalizeSku(row.sku));
  if (!candidate) continue;
  const patch = {};
  const currentOverviewLength = overviewText(row.overviewHtml).length;
  const candidateOverviewLength = overviewText(candidate.overviewHtml).length;
  if (currentOverviewLength < 120 && candidateOverviewLength >= 120) patch.overviewHtml = candidate.overviewHtml;
  if (cleanText(row.summary).length < 45 && cleanText(candidate.summary).length >= 45) patch.summary = candidate.summary;

  const highlights = [...new Set([...(Array.isArray(row.highlights) ? row.highlights : []), ...(candidate.highlights || [])].map(cleanText).filter(Boolean))].slice(0, 8);
  if (highlights.length > (row.highlights?.length || 0)) patch.highlights = highlights;

  const specRows = mergeSpecRows(row.specRows, candidate.specRows);
  if (specRows.length > (row.specRows?.length || 0)) patch.specRows = specRows;
  const docs = mergeDocs(row.docs, candidate.docs);
  if (docs.length > (row.docs?.length || 0)) patch.docs = docs;

  const knownSources = new Set((row.images || []).map((image) => String(image?.sourceUrl || "")).filter(Boolean));
  const imageRoom = Math.max(0, 3 - (row.images?.length || 0));
  const imageSources = imageRoom ? candidate.images.filter((url) => !knownSources.has(url)).slice(0, imageRoom) : [];
  if (Object.keys(patch).length || imageSources.length) plans.push({ row, candidate, patch, imageSources });
}

const planned = {
  productsTouched: plans.length,
  overview: plans.filter((plan) => "overviewHtml" in plan.patch).length,
  summary: plans.filter((plan) => "summary" in plan.patch).length,
  highlights: plans.filter((plan) => "highlights" in plan.patch).length,
  specs: plans.filter((plan) => "specRows" in plan.patch).length,
  docs: plans.filter((plan) => "docs" in plan.patch).length,
  imageProducts: plans.filter((plan) => plan.imageSources.length).length,
  imageAdditions: plans.reduce((sum, plan) => sum + plan.imageSources.length, 0),
};
console.log(JSON.stringify({ phase: "plan", ...planned }));

if (!APPLY) process.exit(0);

await pooled(plans.filter((plan) => Object.keys(plan.patch).length), 5, async ({ row, patch }) => {
  await retry(`content ${row.sku}`, () => client.patch(row._id).set(patch).commit({ autoGenerateArrayKeys: true }));
});

let imageBudget = MAX_IMAGE_ADDITIONS;
const imagePlans = plans.filter((plan) => plan.imageSources.length).sort((a, b) => (a.row.images?.length || 0) - (b.row.images?.length || 0));
await pooled(imagePlans, 3, async ({ row, candidate, imageSources }) => {
  if (imageBudget <= 0) return;
  const existingImages = Array.isArray(row.images) ? row.images.map((image) => ({ _key: image._key, _type: image._type || "image", ...(image.sourceUrl ? { sourceUrl: image.sourceUrl } : {}), asset: image.asset })) : [];
  const refs = new Set(existingImages.map((image) => image?.asset?._ref).filter(Boolean));
  const additions = [];
  for (const sourceUrl of imageSources) {
    if (imageBudget <= 0) break;
    try {
      const response = await fetchReviewed(sourceUrl, "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");
      const type = String(response.headers.get("content-type") || "").split(";")[0].trim();
      const size = Number(response.headers.get("content-length") || 0);
      if (!type.startsWith("image/") || size > MAX_IMAGE_BYTES) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) continue;
      const filename = decodeURIComponent(new URL(sourceUrl).pathname.split("/").at(-1) || `${row.sku}.jpg`).slice(0, 180);
      const asset = await retry(`upload ${row.sku}`, () => client.assets.upload("image", bytes, { filename, source: { id: hash(sourceUrl).slice(0, 24), name: `${candidate.sourceName} ${row.sku}`, url: sourceUrl } }));
      if (!asset?._id || refs.has(asset._id)) continue;
      refs.add(asset._id);
      additions.push({ _key: hash(`${row.sku}:${asset._id}`).slice(0, 12), _type: "image", sourceUrl, asset: { _type: "reference", _ref: asset._id } });
      imageBudget -= 1;
    } catch (error) {
      console.warn(`[Cleaver enrichment] image ${row.sku}: ${error.message}`);
    }
  }
  if (additions.length) await retry(`gallery ${row.sku}`, () => client.patch(row._id).set({ images: [...existingImages, ...additions].slice(0, 5) }).commit({ autoGenerateArrayKeys: true }));
});

await new Promise((resolve) => setTimeout(resolve, 3500));
const after = await client.fetch(`*[_type == "product" && migrationKey == $key]{summary,overviewHtml,specRows,docs,images}`, { key: MIGRATION_KEY });
console.log(JSON.stringify({ phase: "after", ...metrics(after), imageBudgetRemaining: imageBudget }));
