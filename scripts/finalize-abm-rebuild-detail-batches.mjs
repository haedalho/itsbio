#!/usr/bin/env node
/**
 * Validate a complete set of independently staged ABM detail batches, then
 * remove obsolete non-batch preview chunks for the same staging version.
 *
 * Safety: this script only reads/writes `_type == "abmRebuildDetailChunk"`.
 */
import fs from "node:fs";
import path from "node:path";

import { createClient } from "next-sanity";

const argv = process.argv.slice(2);
const readArg = (name, fallback = "") => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : fallback;
};

const VERSION = readArg("--version", "2026-08-09-search-v5");
const OUT = path.resolve(".cache/abm-rebuild-detail-finalize");
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
].map((value) => String(value || "").trim()).find(Boolean);

if (!token) throw new Error("No Sanity write token available");

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });
const managed = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.hostname === "cdn.sanity.io" && url.pathname.startsWith(`/images/${projectId}/`);
  } catch {
    return false;
  }
};
const keyForInventory = (kind, row) => `${kind}:${String(row?.sku || row?.url || "").trim().toLowerCase()}`;
const cleanKey = (row) => String(row?.key || "").trim().toLowerCase();
function unmanagedImages(record) {
  return (Array.isArray(record?.images) ? record.images : []).filter((url) => !managed(url));
}

const data = await client.fetch(`{
  "inventoryProducts": *[_type == "abmRebuildChunk" && version == $version && kind == "product"].records[]{sku,url},
  "inventoryServices": *[_type == "abmRebuildChunk" && version == $version && kind == "service"].records[]{sku,url},
  "chunks": *[_type == "abmRebuildDetailChunk" && version == $version]{_id,kind,"records":records[]{key,images}}
}`, { version: VERSION });

const batchPrefix = (kind) => `abm-rebuild-detail-${kind}-batch-`;
const validateKind = (kind, inventory, expected) => {
  const chunks = (data.chunks || []).filter((chunk) => chunk.kind === kind && String(chunk._id || "").startsWith(batchPrefix(kind)));
  const records = chunks.flatMap((chunk) => chunk.records || []);
  const inventoryKeys = inventory.map((row) => keyForInventory(kind, row));
  const detailKeys = records.map(cleanKey);
  const inventorySet = new Set(inventoryKeys);
  const detailSet = new Set(detailKeys);
  const missing = inventoryKeys.filter((key) => !detailSet.has(key));
  const extra = detailKeys.filter((key) => !inventorySet.has(key));
  const duplicates = detailKeys.filter((key, index) => detailKeys.indexOf(key) !== index);
  const unmanaged = records.flatMap((record) => unmanagedImages(record).map((url) => ({ key: record.key, url })));
  const passed = inventory.length === expected && inventorySet.size === expected && records.length === expected
    && detailSet.size === expected && !missing.length && !extra.length && !duplicates.length && !unmanaged.length;
  return {
    kind,
    expected,
    chunks: chunks.length,
    inventory: inventory.length,
    records: records.length,
    uniqueInventoryKeys: inventorySet.size,
    uniqueDetailKeys: detailSet.size,
    missing,
    extra,
    duplicates: [...new Set(duplicates)],
    unmanagedImages: unmanaged,
    passed,
  };
};

const products = validateKind("product", data.inventoryProducts || [], 5144);
const services = validateKind("service", data.inventoryServices || [], 251);
const report = {
  generatedAt: new Date().toISOString(),
  version: VERSION,
  products,
  services,
  productionProductWrites: 0,
  productionCategoryWrites: 0,
  passed: products.passed && services.passed,
};

if (!report.passed) {
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    passed: false,
    products: { records: products.records, missing: products.missing.length, duplicates: products.duplicates.length },
    services: { records: services.records, missing: services.missing.length, duplicates: services.duplicates.length },
  }, null, 2));
  throw new Error("ABM detail batches are incomplete; obsolete chunks were not removed");
}

const obsoleteIds = (data.chunks || [])
  .filter((chunk) => !String(chunk._id || "").startsWith(batchPrefix(chunk.kind)))
  .map((chunk) => chunk._id)
  .filter(Boolean);
for (let index = 0; index < obsoleteIds.length; index += 100) {
  let transaction = client.transaction();
  for (const id of obsoleteIds.slice(index, index + 100)) transaction = transaction.delete(id);
  await transaction.commit();
}
report.obsoleteDetailChunksRemoved = obsoleteIds.length;
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  passed: true,
  products: products.records,
  services: services.records,
  obsoleteDetailChunksRemoved: obsoleteIds.length,
}, null, 2));
