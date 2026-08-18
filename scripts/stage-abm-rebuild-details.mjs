#!/usr/bin/env node
/**
 * Stage collected ABM Product/Service details into compact Sanity documents.
 *
 * Safety:
 * - writes only `_type == "abmRebuildDetailChunk"`
 * - never creates, patches, or deletes production `product` / `category` documents
 * - rehosts official ABM images as owned Sanity assets before writing details
 * - supports stable, non-overlapping batch chunk IDs for resumable staging
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "next-sanity";
import * as cheerio from "cheerio";
import { sanitizeAbmStoredHtml } from "../lib/abm/rebuild-parser.mjs";
import { createAbmImageRehoster } from "./lib/abm-sanity-image-assets.mjs";

const argv = process.argv.slice(2);
const readArg = (name, fallback = "") => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : fallback;
};

const PRODUCTS_FILE = path.resolve(readArg("--products", ".cache/abm-full-detail-collect/products.json"));
const SERVICES_FILE = path.resolve(readArg("--services", ".cache/abm-full-detail-collect/services.json"));
const QA_RESULTS_FILE = readArg("--qa-results") ? path.resolve(readArg("--qa-results")) : "";
const VERSION = readArg("--version", "2026-08-09-search-v5");
const MAX_RECORDS = Math.max(1, Math.min(25, Number(readArg("--max-records", "10")) || 10));
const MAX_BYTES = Math.max(100_000, Math.min(900_000, Number(readArg("--max-bytes", "700000")) || 700_000));
const DRY = argv.includes("--dry");
const ALLOW_PARTIAL = argv.includes("--allow-partial");
const REPLACE = argv.includes("--replace");
const BATCH_KEY_RAW = readArg("--batch-key");
const BATCH_KEY = BATCH_KEY_RAW.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const OUT = path.resolve(".cache/abm-rebuild-detail-staging");
fs.mkdirSync(OUT, { recursive: true });

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

if (!DRY && !token) throw new Error("No Sanity write token available");
if (BATCH_KEY_RAW && !BATCH_KEY) throw new Error("--batch-key must contain at least one letter or number");
if (ALLOW_PARTIAL && !BATCH_KEY) {
  throw new Error("--allow-partial requires --batch-key so partial runs cannot overwrite one another");
}

const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const hasCurrency = (value) => /(?:\b(?:USD|CAD)\b\s*:?)?\s*\$\s*\d|\b(?:USD|CAD)\s+\d[\d,.]*/i.test(String(value || ""));
const isCommerceKey = (value) => /price|cost|amount|currency|cart|quantity/i.test(clean(value));
const isProductStyleService = (inventory, detail) =>
  /^T\d+(?:-\d+)?$/i.test(clean(inventory?.sku))
  && /(?:^|-)cell-line(?:-|\.|$)/i.test(clean(inventory?.url))
  && !detail?.serviceOffer
  && detail?.verification?.hasSpecifications === true;

function safeUrl(value) {
  const text = clean(value);
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeServiceOffer(offer, expectedSku) {
  if (!offer || typeof offer !== "object") return undefined;
  const fields = [];
  for (const [key, value] of Object.entries(offer.fields || {})) {
    if (isCommerceKey(key) || hasCurrency(value)) continue;
    const label = clean(key);
    const text = clean(value);
    if (label && text) {
      fields.push({
        _key: label.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 90) || `field_${fields.length}`,
        label,
        value: text,
      });
    }
  }
  return {
    sku: clean(offer.sku || expectedSku),
    title: clean(offer.title),
    unit: clean(offer.unit),
    fields,
  };
}

function assertSanityAttributeNames(value, path = "record") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSanityAttributeNames(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (!/^\$?[A-Za-z0-9_-]+$/.test(key)) {
      throw new Error(`${path}: invalid Sanity attribute name ${JSON.stringify(key)}`);
    }
    assertSanityAttributeNames(child, `${path}.${key}`);
  }
}

function isolateStoredServiceHtml(rawHtml, expectedSku, sourceUrl) {
  const sanitized = sanitizeAbmStoredHtml(String(rawHtml || ""), sourceUrl || "https://www.abmgood.com");
  const wanted = clean(expectedSku).toLowerCase();
  if (!sanitized || !wanted) return sanitized;
  const $ = cheerio.load(`<div id="__root">${sanitized}</div>`, { decodeEntities: false });
  $("#__root table").each((_, table) => {
    const rows = $(table).find("tr");
    const headers = rows.first().children("th,td").toArray().map((cell) => clean($(cell).text()).toLowerCase().replace(/[\s:]+$/g, ""));
    const isCatalogTable = headers.some((header) => /^(?:cat\.?\s*no\.?|catalog(?:ue)?(?:\s+number)?)$/.test(header));
    const matching = rows.filter((__, tr) =>
      $(tr).children("th,td").toArray().some((cell) => clean($(cell).text()).toLowerCase() === wanted),
    );
    if (matching.length) {
      rows.each((__, tr) => {
        const row = $(tr);
        if (!row.children("th").length && !row.is(matching)) row.remove();
      });
      return;
    }
    if (isCatalogTable) $(table).remove();
  });
  return sanitizeAbmStoredHtml($("#__root").html() || "", sourceUrl || "https://www.abmgood.com");
}

function sanitizeDetail(kind, inventory, detail, collectedAt) {
  const sku = clean(inventory?.sku || detail?.sku);
  const sourceUrl = safeUrl(detail?.sourceUrl || inventory?.url);
  const html = (value) => sanitizeAbmStoredHtml(String(value || ""), sourceUrl || "https://www.abmgood.com");
  const documents = Array.isArray(detail?.documents)
    ? detail.documents.map((item) => ({
        _key: clean(item?.url || item?.href || item?.title).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 90) || undefined,
        title: clean(item?.title || "Document"),
        url: safeUrl(item?.url || item?.href),
        section: clean(item?.section),
      })).filter((item) => item.url)
    : [];
  const images = Array.isArray(detail?.images) ? [...new Set(detail.images.map(safeUrl).filter(Boolean))] : [];
  const productStyleService = kind === "service" && isProductStyleService(inventory, detail);
  const record = {
    _key: `${kind}-${(sku || sourceUrl).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 90)}`,
    key: `${kind}:${(sku || sourceUrl).toLowerCase()}`,
    kind,
    sku,
    title: clean(detail?.title || inventory?.title),
    unit: clean(detail?.unit || inventory?.unit),
    sourceUrl,
    category: clean(detail?.category || inventory?.filterTitle),
    listingPaths: Array.isArray(inventory?.listingFilters)
      ? inventory.listingFilters.map((item) => Array.isArray(item?.path) ? item.path.map(clean).filter(Boolean) : []).filter((item) => item.length)
      : [],
    breadcrumbs: Array.isArray(detail?.breadcrumbs) ? detail.breadcrumbs.map(clean).filter(Boolean) : [],
    description: clean(detail?.description),
    storage: clean(detail?.storage),
    materialCitation: clean(detail?.materialCitation),
    introHtml: html(detail?.introHtml),
    specificationsHtml: html(detail?.specificationsHtml),
    datasheetHtml: html(detail?.datasheetHtml),
    documentsHtml: html(detail?.documentsHtml),
    faqsHtml: html(detail?.faqsHtml),
    referencesHtml: html(detail?.referencesHtml),
    reviewsHtml: html(detail?.reviewsHtml),
    serviceDetailsHtml: kind === "service" ? isolateStoredServiceHtml(detail?.serviceDetailsHtml, sku, sourceUrl) : "",
    serviceOffer: kind === "service" ? safeServiceOffer(detail?.serviceOffer, sku) : undefined,
    documents,
    images,
    collectedAt,
    verification: {
      skuMatches: detail?.verification?.skuMatches === true,
      serviceOfferMatched: kind === "service"
        ? detail?.verification?.serviceOfferMatched === true || productStyleService
        : undefined,
      hasSpecifications: detail?.verification?.hasSpecifications === true,
      hasOfficialImages: images.length > 0,
      priceLeak: false,
    },
  };
  const serialized = JSON.stringify(record);
  if (hasCurrency(serialized) || /"(?:price|cost|amount|currency|cart|quantity)"\s*:/i.test(serialized)) {
    throw new Error(`${kind} ${sku || sourceUrl}: price/commerce leak remains after sanitization`);
  }
  assertSanityAttributeNames(record, `${kind} ${sku || sourceUrl}`);
  return record;
}

function normalizeCollectorRows(rows, kind) {
  return rows.filter((row) => row?.status === "ok" && row?.detail).map((row) =>
    sanitizeDetail(kind, row.inventory, row.detail, row.collectedAt || new Date().toISOString()),
  );
}

function loadRecords() {
  if (QA_RESULTS_FILE) {
    const rows = JSON.parse(fs.readFileSync(QA_RESULTS_FILE, "utf8"));
    const products = [];
    const services = [];
    for (const row of rows) {
      if (!row?.qa?.passed || !row?.parsed) continue;
      const kind = row.sample?.kind === "service" ? "service" : "product";
      const record = sanitizeDetail(kind, row.sample, row.parsed, new Date().toISOString());
      (kind === "service" ? services : products).push(record);
    }
    return { products, services, inputErrors: rows.length - products.length - services.length };
  }
  if (!fs.existsSync(PRODUCTS_FILE)) throw new Error(`Products file not found: ${PRODUCTS_FILE}`);
  if (!fs.existsSync(SERVICES_FILE)) throw new Error(`Services file not found: ${SERVICES_FILE}`);
  const productRows = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
  const serviceRows = JSON.parse(fs.readFileSync(SERVICES_FILE, "utf8"));
  return {
    products: normalizeCollectorRows(productRows, "product"),
    services: normalizeCollectorRows(serviceRows, "service"),
    inputErrors: productRows.filter((row) => row?.status !== "ok").length + serviceRows.filter((row) => row?.status !== "ok").length,
  };
}

function chunkIdPrefix(kind) {
  const batchSegment = BATCH_KEY ? `-batch-${BATCH_KEY}` : "";
  return `abm-rebuild-detail-${kind}${batchSegment}-chunk-`;
}

function makeChunks(records, kind) {
  const chunks = [];
  let current = [];
  let bytes = 0;
  for (const record of records) {
    const recordBytes = Buffer.byteLength(JSON.stringify(record));
    if (recordBytes > MAX_BYTES) throw new Error(`${kind} ${record.sku}: detail record exceeds ${MAX_BYTES} bytes`);
    if (current.length && (current.length >= MAX_RECORDS || bytes + recordBytes > MAX_BYTES)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(record);
    bytes += recordBytes;
  }
  if (current.length) chunks.push(current);
  return chunks.map((recordsInChunk, chunkIndex) => ({
    _id: `${chunkIdPrefix(kind)}${String(chunkIndex).padStart(4, "0")}`,
    _type: "abmRebuildDetailChunk",
    version: VERSION,
    kind,
    chunkIndex,
    totalRecords: records.length,
    records: recordsInChunk,
  }));
}

const loaded = loadRecords();
if (!ALLOW_PARTIAL && (loaded.products.length !== 5144 || loaded.services.length !== 251 || loaded.inputErrors)) {
  throw new Error(`Full corpus required: products=${loaded.products.length}/5144 services=${loaded.services.length}/251 errors=${loaded.inputErrors}`);
}

function assertUniqueDetailKeys(records, kind) {
  const keys = records.map((record) => clean(record.key));
  const unique = new Set(keys);
  if (keys.some((key) => !key.startsWith(`${kind}:`))) throw new Error(`${kind}: invalid staged detail key`);
  if (unique.size !== records.length) throw new Error(`${kind}: duplicate staged detail keys (${records.length - unique.size})`);
}

assertUniqueDetailKeys(loaded.products, "product");
assertUniqueDetailKeys(loaded.services, "service");

const client = !DRY ? createClient({ projectId, dataset, apiVersion, token, useCdn: false }) : null;
const imageRehoster = createAbmImageRehoster({ client, dryRun: DRY });

async function rehostRecords(records, label) {
  const output = new Array(records.length);
  let cursor = 0;
  const workers = Math.min(4, Math.max(1, records.length));
  await Promise.all(Array.from({ length: workers }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= records.length) return;
      output[index] = await imageRehoster.rehostDetailRecord(records[index]);
      if (index % 250 === 0) console.log(`[stage detail assets] ${label} ${index}/${records.length}`);
    }
  }));
  return output;
}

loaded.products = await rehostRecords(loaded.products, "products");
loaded.services = await rehostRecords(loaded.services, "services");
const docs = [...makeChunks(loaded.products, "product"), ...makeChunks(loaded.services, "service")];
const expectedIds = new Set(docs.map((doc) => doc._id));

const report = {
  generatedAt: new Date().toISOString(),
  dryRun: DRY,
  version: VERSION,
  batchKey: BATCH_KEY || null,
  products: loaded.products.length,
  services: loaded.services.length,
  inputErrors: loaded.inputErrors,
  chunks: docs.length,
  maxRecordsPerChunk: MAX_RECORDS,
  maxBytesPerChunk: MAX_BYTES,
  productionProductWrites: 0,
  productionCategoryWrites: 0,
  sanityAssetWrites: imageRehoster.stats.uploadedAssets,
  imageMigration: imageRehoster.stats,
};

if (!DRY) {
  for (let index = 0; index < docs.length; index += 25) {
    let transaction = client.transaction();
    for (const doc of docs.slice(index, index + 25)) transaction = transaction.createOrReplace(doc);
    await transaction.commit({ autoGenerateArrayKeys: true });
    console.log(`[stage detail] ${Math.min(index + 25, docs.length)}/${docs.length}`);
  }
  if (BATCH_KEY) {
    const batchIds = await client.fetch(`*[_type == "abmRebuildDetailChunk" && version == $version]._id`, { version: VERSION });
    const staleBatchIds = batchIds.filter((id) =>
      (id.startsWith(chunkIdPrefix("product")) || id.startsWith(chunkIdPrefix("service"))) && !expectedIds.has(id),
    );
    for (let index = 0; index < staleBatchIds.length; index += 100) {
      let transaction = client.transaction();
      for (const id of staleBatchIds.slice(index, index + 100)) transaction = transaction.delete(id);
      await transaction.commit();
    }
    report.staleBatchChunksRemoved = staleBatchIds.length;
  }
  if (REPLACE) {
    const stale = await client.fetch(`*[_type == "abmRebuildDetailChunk" && version == $version]._id`, { version: VERSION });
    const staleIds = stale.filter((id) => !expectedIds.has(id));
    for (let index = 0; index < staleIds.length; index += 100) {
      let transaction = client.transaction();
      for (const id of staleIds.slice(index, index + 100)) transaction = transaction.delete(id);
      await transaction.commit();
    }
    report.staleDetailChunksRemoved = staleIds.length;
  }
  const verified = await client.fetch(`{
    "docs": count(*[_type == "abmRebuildDetailChunk" && version == $version]),
    "products": count(*[_type == "abmRebuildDetailChunk" && version == $version && kind == "product"].records[]),
    "services": count(*[_type == "abmRebuildDetailChunk" && version == $version && kind == "service"].records[])
  }`, { version: VERSION });
  report.verified = verified;
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
if (ALLOW_PARTIAL) {
  fs.writeFileSync(path.join(OUT, "preview-records.json"), JSON.stringify({ products: loaded.products, services: loaded.services }, null, 2));
}
console.log(JSON.stringify(report, null, 2));
