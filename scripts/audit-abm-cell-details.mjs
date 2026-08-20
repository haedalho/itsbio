#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const CATALOG = path.resolve("data/abm-cell-model-catalog.json");
const DETAIL_DIRECTORY = path.resolve("data/abm-cell-details");
const normalized = (value) => String(value || "").normalize("NFKC").trim().toLowerCase();
const digest = (value) => createHash("sha256").update(String(value)).digest("hex");

const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
const manifest = JSON.parse(await readFile(path.join(DETAIL_DIRECTORY, "manifest.json"), "utf8"));
const expected = new Map(catalog.products.map((product) => [normalized(product.sku), product]));
const records = new Map();
let compressedBytes = 0;

for (const filename of (await readdir(DETAIL_DIRECTORY)).filter((name) => name.endsWith(".json.gz")).sort()) {
  const fullPath = path.join(DETAIL_DIRECTORY, filename);
  compressedBytes += (await stat(fullPath)).size;
  const shard = JSON.parse(gunzipSync(await readFile(fullPath)).toString("utf8"));
  for (const [key, record] of Object.entries(shard)) {
    if (records.has(key)) throw new Error(`Duplicate detail SKU: ${key}`);
    records.set(key, record);
  }
}

const missing = [...expected.keys()].filter((sku) => !records.has(sku));
const extra = [...records.keys()].filter((sku) => !expected.has(sku));
const mismatched = [];
const currencyLeaks = [];
const commerceLeaks = [];
const externalImages = [];
const missingSpecifications = [];

for (const [sku, record] of records) {
  const serialized = JSON.stringify(record);
  if (normalized(record.sku) !== sku || record.verification?.skuMatches !== true || record.hasDetail !== true) mismatched.push(sku);
  if (/(?:\b(?:USD|CAD)\b\s*:?)?\s*\$\s*\d|\b(?:USD|CAD)\s+\d[\d,.]*/i.test(serialized)) currencyLeaks.push(sku);
  if (/\b(?:add\s+to\s+cart|shopping\s+cart|checkout)\b/i.test(serialized)) commerceLeaks.push(sku);
  if (/<img\b|"images":\s*\[(?!\s*\])/i.test(serialized)) externalImages.push(sku);
  if (!record.specificationsHtml) missingSpecifications.push(sku);
}

const checksum = digest([...records.keys()].sort().join("\n"));
const summary = {
  expected: expected.size,
  records: records.size,
  missing: missing.length,
  extra: extra.length,
  mismatched: mismatched.length,
  currencyLeaks: currencyLeaks.length,
  commerceLeaks: commerceLeaks.length,
  externalImages: externalImages.length,
  missingSpecifications: missingSpecifications.length,
  compressedBytes,
  manifestComplete: manifest.complete === true,
  checksumMatches: manifest.skuChecksum === checksum,
};

console.log(JSON.stringify(summary, null, 2));
if (
  summary.records !== summary.expected
  || summary.missing
  || summary.extra
  || summary.mismatched
  || summary.currencyLeaks
  || summary.commerceLeaks
  || summary.externalImages
  || !summary.manifestComplete
  || !summary.checksumMatches
) process.exitCode = 1;
