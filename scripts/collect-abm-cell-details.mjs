#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import * as cheerio from "cheerio";

import { parseAbmRebuildDetailV2 } from "../lib/abm/rebuild-parser-v2.mjs";
import { sanitizeAbmStoredHtml } from "../lib/abm/rebuild-parser.mjs";

const argv = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : fallback;
};

const INPUT = path.resolve(readArg("--input", "data/abm-cell-model-catalog.json"));
const OUTPUT_DIRECTORY = path.resolve(readArg("--output", "data/abm-cell-details"));
const CACHE_DIRECTORY = path.resolve(readArg("--cache", "/tmp/itsbio-abm-cell-detail-pages"));
const RECORD_CACHE_DIRECTORY = path.resolve(readArg("--record-cache", "/tmp/itsbio-abm-cell-detail-records"));
const START = Math.max(0, Number.parseInt(readArg("--start", "0"), 10) || 0);
const LIMIT = Math.max(0, Number.parseInt(readArg("--limit", "0"), 10) || 0);
const WORKERS = Math.max(1, Math.min(16, Number.parseInt(readArg("--workers", "4"), 10) || 4));
const GAP_MS = Math.max(250, Number.parseInt(readArg("--gap-ms", "1200"), 10) || 1200);
const SHARD_COUNT = 16;
const USER_AGENT = "ITSBIO-ABM-Cell-Detail-Migration/1.0";
const CACHE_ONLY = argv.includes("--cache-only");

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const digest = (value) => createHash("sha256").update(String(value)).digest("hex");
const normalizedSku = (value) => clean(value).normalize("NFKC").toLowerCase();
const shardKey = (sku) => digest(normalizedSku(sku)).slice(0, 1);

let nextRequestAt = 0;
async function waitForRequestSlot() {
  const now = Date.now();
  const scheduled = Math.max(now, nextRequestAt);
  nextRequestAt = scheduled + GAP_MS;
  if (scheduled > now) await sleep(scheduled - now);
}

function readerUrl(sourceUrl) {
  const target = new URL(sourceUrl);
  target.protocol = "http:";
  target.hostname = "www.abmgood.com";
  return `https://r.jina.ai/${target.toString()}`;
}

async function fetchOfficialHtml(product) {
  const cachePath = path.join(CACHE_DIRECTORY, `${digest(product.sourceUrl || product.url)}.html`);
  try {
    const cached = await readFile(cachePath, "utf8");
    if (cached.includes("<html") && cached.length > 5_000) return cached;
  } catch {
    // Missing or incomplete cache entries are fetched below.
  }

  let lastError = new Error(`Unable to fetch ${product.sourceUrl || product.url}`);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await waitForRequestSlot();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(readerUrl(product.sourceUrl || product.url), {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          accept: "text/html",
          "user-agent": USER_AGENT,
          "x-return-format": "html",
          "x-timeout": "60",
        },
      });
      clearTimeout(timer);
      if (response.status === 429 || response.status === 408 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after") || 0);
        lastError = new Error(`Reader HTTP ${response.status}`);
        await sleep(Math.max(retryAfter * 1_000, Math.min(60_000, 2_500 * (2 ** attempt))));
        continue;
      }
      if (!response.ok) throw new Error(`Reader HTTP ${response.status}`);
      const html = await response.text();
      if (!html.includes("<html") || html.length < 5_000) throw new Error("Reader returned incomplete HTML");
      await mkdir(CACHE_DIRECTORY, { recursive: true });
      await writeFile(cachePath, html, "utf8");
      return html;
    } catch (error) {
      clearTimeout(timer);
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === 9) break;
      await sleep(Math.min(60_000, 2_500 * (2 ** attempt)));
    }
  }
  throw lastError;
}

function withoutImages(rawHtml, sourceUrl) {
  const sanitized = sanitizeAbmStoredHtml(String(rawHtml || ""), sourceUrl);
  if (!sanitized) return "";
  const $ = cheerio.load(`<div id="__root">${sanitized}</div>`, { decodeEntities: false });
  $("#__root img, #__root figure:has(img)").remove();
  return sanitizeAbmStoredHtml($("#__root").html() || "", sourceUrl);
}

function safeDocuments(documents) {
  if (!Array.isArray(documents)) return [];
  return documents.map((document) => ({
    title: clean(document?.title || "Document"),
    url: clean(document?.url || document?.href),
    section: clean(document?.section),
  })).filter((document) => /^https?:\/\//i.test(document.url));
}

function compactDetail(product, detail) {
  const sourceUrl = clean(detail.sourceUrl || product.sourceUrl || product.url);
  const sku = clean(product.sku || detail.sku);
  const record = {
    kind: "product",
    sku,
    title: clean(detail.title || product.title),
    unit: clean(detail.unit || product.unit),
    sourceUrl,
    category: clean(product.modelType),
    description: clean(detail.description),
    storage: clean(detail.storage),
    materialCitation: clean(detail.materialCitation),
    specificationsHtml: withoutImages(detail.specificationsHtml, sourceUrl),
    datasheetHtml: withoutImages(detail.datasheetHtml, sourceUrl),
    documentsHtml: withoutImages(detail.documentsHtml, sourceUrl),
    faqsHtml: withoutImages(detail.faqsHtml, sourceUrl),
    referencesHtml: withoutImages(detail.referencesHtml, sourceUrl),
    reviewsHtml: withoutImages(detail.reviewsHtml, sourceUrl),
    documents: safeDocuments(detail.documents),
    images: [],
    hasDetail: true,
    collectedAt: new Date().toISOString(),
    verification: {
      skuMatches: detail.verification?.skuMatches === true,
      hasSpecifications: detail.verification?.hasSpecifications === true,
      officialImagesPendingSanity: Array.isArray(detail.images) && detail.images.length > 0,
      priceLeak: false,
    },
  };

  const serialized = JSON.stringify(record);
  if (!record.verification.skuMatches) throw new Error(`${sku}: official page SKU mismatch`);
  if (/(?:\b(?:USD|CAD)\b\s*:?)?\s*\$\s*\d|\b(?:USD|CAD)\s+\d[\d,.]*/i.test(serialized)) {
    throw new Error(`${sku}: currency value remains after sanitization`);
  }
  if (/\b(?:add\s+to\s+cart|shopping\s+cart|checkout)\b/i.test(serialized)) {
    throw new Error(`${sku}: commerce UI text remains after sanitization`);
  }
  return record;
}

async function readCachedRecord(product) {
  const filename = path.join(RECORD_CACHE_DIRECTORY, `${digest(product.sourceUrl || product.url)}.json`);
  try {
    const record = JSON.parse(await readFile(filename, "utf8"));
    if (record?.hasDetail === true && normalizedSku(record.sku) === normalizedSku(product.sku)) return record;
  } catch {
    // Missing or invalid parsed records are rebuilt from the official HTML cache.
  }
  return undefined;
}

async function writeCachedRecord(product, record) {
  await mkdir(RECORD_CACHE_DIRECTORY, { recursive: true });
  const filename = path.join(RECORD_CACHE_DIRECTORY, `${digest(product.sourceUrl || product.url)}.json`);
  await writeFile(filename, JSON.stringify(record), "utf8");
}

async function pool(items, workerCount, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

function makeManifest(records, expectedTotal) {
  const modelTypes = {};
  const fields = {
    descriptions: 0,
    specifications: 0,
    datasheets: 0,
    documents: 0,
    faqs: 0,
    references: 0,
    reviews: 0,
    officialImagesPendingSanity: 0,
  };
  for (const record of records) {
    modelTypes[record.category] = (modelTypes[record.category] || 0) + 1;
    if (record.description) fields.descriptions += 1;
    if (record.specificationsHtml) fields.specifications += 1;
    if (record.datasheetHtml) fields.datasheets += 1;
    if (record.documentsHtml || record.documents.length) fields.documents += 1;
    if (record.faqsHtml) fields.faqs += 1;
    if (record.referencesHtml) fields.references += 1;
    if (record.reviewsHtml) fields.reviews += 1;
    if (record.verification.officialImagesPendingSanity) fields.officialImagesPendingSanity += 1;
  }
  return {
    source: "Official ABM product pages via Jina Reader HTML passthrough",
    generatedAt: new Date().toISOString(),
    expectedTotal,
    collected: records.length,
    complete: records.length === expectedTotal,
    modelTypes,
    fields,
    shardCount: SHARD_COUNT,
    skuChecksum: digest(records.map((record) => normalizedSku(record.sku)).sort().join("\n")),
    sanityWrites: 0,
    externalProductImagesStored: 0,
  };
}

async function writeShards(records, manifest) {
  await rm(OUTPUT_DIRECTORY, { recursive: true, force: true });
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const shards = new Map();
  for (const record of records) {
    const key = shardKey(record.sku);
    if (!shards.has(key)) shards.set(key, {});
    shards.get(key)[normalizedSku(record.sku)] = record;
  }
  for (const key of Array.from({ length: SHARD_COUNT }, (_, index) => index.toString(16))) {
    const payload = JSON.stringify(shards.get(key) || {});
    await writeFile(path.join(OUTPUT_DIRECTORY, `${key}.json.gz`), gzipSync(payload, { level: 9 }));
  }
  await writeFile(path.join(OUTPUT_DIRECTORY, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

const catalog = JSON.parse(await readFile(INPUT, "utf8"));
const authoritativeProducts = Array.isArray(catalog.products) ? catalog.products : [];
const products = LIMIT
  ? authoritativeProducts.slice(START, START + LIMIT)
  : authoritativeProducts.slice(START);
if (!products.length) throw new Error("ABM cell catalog is empty");

console.log(`[ABM cell details] start=${START} products=${products.length}/${authoritativeProducts.length} workers=${WORKERS} gapMs=${GAP_MS} cacheOnly=${CACHE_ONLY}`);
const startedAt = Date.now();
const records = await pool(products, WORKERS, async (product, index) => {
  const cachedRecord = await readCachedRecord(product);
  if (cachedRecord) return cachedRecord;
  const html = await fetchOfficialHtml(product);
  const parsed = parseAbmRebuildDetailV2(html, product.sourceUrl || product.url, {
    kind: "product",
    sku: product.sku,
    title: product.title,
  });
  const record = compactDetail(product, parsed);
  await writeCachedRecord(product, record);
  if ((index + 1) % 10 === 0 || index + 1 === products.length) {
    const elapsedMinutes = (Date.now() - startedAt) / 60_000;
    const rate = (index + 1) / Math.max(elapsedMinutes, 0.01);
    console.log(`[ABM cell details] ${index + 1}/${products.length} ${rate.toFixed(1)} items/min`);
  }
  return record;
});

records.sort((left, right) => normalizedSku(left.sku).localeCompare(normalizedSku(right.sku)));
const manifest = makeManifest(records, LIMIT ? products.length : authoritativeProducts.length);
if (!manifest.complete) throw new Error(`Incomplete detail corpus: ${manifest.collected}/${manifest.expectedTotal}`);
if (!CACHE_ONLY) await writeShards(records, manifest);

const outputFiles = CACHE_ONLY ? [] : await readdir(OUTPUT_DIRECTORY);
console.log(JSON.stringify({ output: CACHE_ONLY ? null : OUTPUT_DIRECTORY, files: outputFiles.length, cacheOnly: CACHE_ONLY, ...manifest }, null, 2));
