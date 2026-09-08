#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { createClient } from "next-sanity";
import { sanitizeAbmStoredHtml } from "../lib/abm/rebuild-parser.mjs";

const PRODUCTS_FILE = path.resolve(process.argv[2] || ".cache/abm-full-detail-collect/products.json");
const VERSION = String(process.env.ABM_REBUILD_VERSION || "2026-08-09-search-v5").trim();
const PREFIX = "abm-rebuild-detail-product-batch-stable-cell-lines-chunk-";
const EXPECTED = 1102;
const MAX_RECORDS = 10;
const MAX_BYTES = 700000;

const projectId = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const dataset = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const apiVersion = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const token = [
  process.env.SANITY_WRITE_TOKEN,
  process.env.SANITY_API_WRITE_TOKEN,
  process.env.SANITY_API_TOKEN,
  process.env.SANITY_TOKEN,
  process.env.SANITY_AUTH_TOKEN,
].map((value) => String(value || "").trim()).find(Boolean) || "";

if (!token) throw new Error("No Sanity write token available");
if (!fs.existsSync(PRODUCTS_FILE)) throw new Error(`Stable collected products file not found: ${PRODUCTS_FILE}`);

const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const hasCurrency = (value) => /(?:\b(?:USD|CAD)\b\s*:?)?\s*\$\s*\d|\b(?:USD|CAD)\s+\d[\d,.]*/i.test(String(value || ""));

function safeUrl(value) {
  const text = clean(value);
  if (!text) return "";
  try {
    const url = new URL(text);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function sanitizedHtmlWithoutImages(value, sourceUrl) {
  const sanitized = sanitizeAbmStoredHtml(String(value || ""), sourceUrl || "https://www.abmgood.com");
  if (!sanitized) return "";
  const $ = cheerio.load(`<div id="__root">${sanitized}</div>`, { decodeEntities: false });
  $("#__root img").remove();
  return sanitizeAbmStoredHtml($("#__root").html() || "", sourceUrl || "https://www.abmgood.com");
}

function normalizeRecord(row) {
  if (row?.status !== "ok" || !row?.detail || !row?.inventory) return null;
  const inventory = row.inventory;
  const detail = row.detail;
  const sku = clean(inventory.sku || detail.sku);
  const sourceUrl = safeUrl(detail.sourceUrl || inventory.url);
  if (!sku || !sourceUrl) throw new Error(`Stable row missing SKU/sourceUrl: ${JSON.stringify(inventory)}`);
  if (detail?.verification?.skuMatches !== true) throw new Error(`${sku}: SKU verification failed`);
  if (detail?.verification?.hasSpecifications !== true) throw new Error(`${sku}: Specifications verification failed`);

  const documents = Array.isArray(detail.documents)
    ? detail.documents.map((item) => ({
        _key: clean(item?.url || item?.href || item?.title).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 90) || undefined,
        title: clean(item?.title || "Document"),
        url: safeUrl(item?.url || item?.href),
        section: clean(item?.section),
      })).filter((item) => item.url)
    : [];

  const html = (value) => sanitizedHtmlWithoutImages(value, sourceUrl);
  const record = {
    _key: `product-${sku.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 90)}`,
    key: `product:${sku.toLowerCase()}`,
    kind: "product",
    sku,
    title: clean(detail.title || inventory.title),
    unit: clean(detail.unit || inventory.unit),
    sourceUrl,
    category: "Stable Cell Lines",
    listingPaths: [["Cellular Materials", "Cell Library Collections", "Stable Cell Lines"]],
    breadcrumbs: Array.isArray(detail.breadcrumbs) && detail.breadcrumbs.length
      ? detail.breadcrumbs.map(clean).filter(Boolean)
      : ["Cellular Materials", "Cell Library Collections", "Stable Cell Lines", clean(detail.title || inventory.title)],
    description: clean(detail.description),
    storage: clean(detail.storage),
    materialCitation: clean(detail.materialCitation),
    introHtml: html(detail.introHtml),
    specificationsHtml: html(detail.specificationsHtml),
    datasheetHtml: html(detail.datasheetHtml),
    documentsHtml: html(detail.documentsHtml),
    faqsHtml: html(detail.faqsHtml),
    referencesHtml: html(detail.referencesHtml),
    reviewsHtml: html(detail.reviewsHtml),
    documents,
    images: [],
    collectedAt: clean(row.collectedAt) || new Date().toISOString(),
    verification: {
      skuMatches: true,
      hasSpecifications: true,
      hasOfficialImages: false,
      mediaDeferred: true,
      priceLeak: false,
    },
  };
  const serialized = JSON.stringify(record);
  if (hasCurrency(serialized) || /"(?:price|cost|amount|currency|cart|quantity)"\s*:/i.test(serialized)) {
    throw new Error(`${sku}: price/commerce leak remains`);
  }
  if (!clean(record.specificationsHtml)) throw new Error(`${sku}: empty sanitized Specifications`);
  return record;
}

const sourceRows = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
const records = sourceRows.map(normalizeRecord).filter(Boolean);
if (records.length !== EXPECTED) throw new Error(`Expected ${EXPECTED} Stable records, got ${records.length}`);
const keys = records.map((record) => record.key);
if (new Set(keys).size !== EXPECTED) throw new Error(`Stable duplicate detail keys: ${EXPECTED - new Set(keys).size}`);

function makeChunks(items) {
  const chunks = [];
  let current = [];
  let bytes = 0;
  for (const record of items) {
    const recordBytes = Buffer.byteLength(JSON.stringify(record));
    if (recordBytes > MAX_BYTES) throw new Error(`${record.sku}: detail record exceeds ${MAX_BYTES} bytes`);
    if (current.length && (current.length >= MAX_RECORDS || bytes + recordBytes > MAX_BYTES)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(record);
    bytes += recordBytes;
  }
  if (current.length) chunks.push(current);
  return chunks.map((recordsInChunk, index) => ({
    _id: `${PREFIX}${String(index).padStart(4, "0")}`,
    _type: "abmRebuildDetailChunk",
    version: VERSION,
    kind: "product",
    chunkIndex: index,
    totalRecords: EXPECTED,
    records: recordsInChunk,
  }));
}

const docs = makeChunks(records);
const expectedIds = new Set(docs.map((doc) => doc._id));
const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });

// Each detail chunk can be hundreds of KB. Sanity caps a mutation request at 4 MB,
// so commit one chunk per request instead of combining many chunks in one transaction.
for (let index = 0; index < docs.length; index += 1) {
  await client.createOrReplace(docs[index], { autoGenerateArrayKeys: true });
  if (index % 10 === 0 || index === docs.length - 1) {
    console.log(`[stable text stage] ${index + 1}/${docs.length} chunks`);
  }
}

const existingIds = await client.fetch(`*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
  && string::startsWith(_id, $prefix)
]._id`, { version: VERSION, prefix: PREFIX });
const stale = existingIds.filter((id) => !expectedIds.has(id));
for (let index = 0; index < stale.length; index += 50) {
  let tx = client.transaction();
  for (const id of stale.slice(index, index + 50)) tx = tx.delete(id);
  await tx.commit();
}

const verification = await client.fetch(`{
  "docs": count(*[_type == "abmRebuildDetailChunk" && version == $version && kind == "product" && string::startsWith(_id, $prefix)]),
  "records": count(*[_type == "abmRebuildDetailChunk" && version == $version && kind == "product" && string::startsWith(_id, $prefix)].records[]),
  "keys": *[_type == "abmRebuildDetailChunk" && version == $version && kind == "product" && string::startsWith(_id, $prefix)].records[].key
}`, { version: VERSION, prefix: PREFIX });
const uniqueKeys = new Set(verification.keys || []);
if (verification.records !== EXPECTED || uniqueKeys.size !== EXPECTED) {
  throw new Error(`Stable text staging verification failed: records=${verification.records} unique=${uniqueKeys.size}`);
}

console.log(JSON.stringify({
  sourceFile: PRODUCTS_FILE,
  products: records.length,
  chunks: docs.length,
  staleChunksRemoved: stale.length,
  verifiedRecords: verification.records,
  verifiedUniqueKeys: uniqueKeys.size,
  mediaDeferred: true,
}, null, 2));
