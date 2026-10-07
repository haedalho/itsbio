#!/usr/bin/env node

/** Audit only the versioned Special Cell Line detail batch. */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "next-sanity";

const OUT = path.resolve(".cache/abm-special-cell-detail-migration");
const INVENTORY_FILE = path.join(OUT, "inventory.json");
const PREPARE_REPORT_FILE = path.join(OUT, "prepare-report.json");
const AUDIT_FILE = path.join(OUT, "audit-report.json");
const VERSION = String(process.env.ABM_REBUILD_VERSION || "2026-08-09-search-v5").trim();
const BATCH_KEY = String(process.env.ABM_SPECIAL_CELL_BATCH_KEY || "special-cell-20260909")
  .replace(/[^A-Za-z0-9_-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 80);
const projectId = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const dataset = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const apiVersion = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const client = createClient({ projectId, dataset, apiVersion, useCdn: false });
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const normalizedSku = (value) => clean(value).normalize("NFKC").toLowerCase();

function isManagedImage(value) {
  try {
    const url = new URL(String(value || ""));
    return url.hostname === "cdn.sanity.io" && url.pathname.startsWith(`/images/${projectId}/`);
  } catch {
    return false;
  }
}

const inventory = JSON.parse(fs.readFileSync(INVENTORY_FILE, "utf8"));
const prepare = JSON.parse(fs.readFileSync(PREPARE_REPORT_FILE, "utf8"));
const prefix = `abm-rebuild-detail-product-batch-${BATCH_KEY}-chunk-`;
const documents = await client.fetch(`*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
  && _id match $prefix
]{_id,records}`, { version: VERSION, prefix: `${prefix}*` });
const records = documents.flatMap((document) => document.records || []);
const expectedSkus = new Set([
  ...(inventory.products || []).map((product) => normalizedSku(product.sku)),
  ...(inventory.categoryFallbackRows || []).map((row) => normalizedSku(row?.inventory?.sku)),
]);
const actualSkus = records.map((record) => normalizedSku(record.sku));
const actualSet = new Set(actualSkus);
const duplicates = actualSkus.filter((sku, index) => actualSkus.indexOf(sku) !== index);
const missing = [...expectedSkus].filter((sku) => !actualSet.has(sku));
const unexpected = [...actualSet].filter((sku) => !expectedSkus.has(sku));
const invalid = records.filter((record) => {
  const serialized = JSON.stringify(record);
  const hasContent = Boolean(clean(record.description || record.introHtml || record.specificationsHtml || record.datasheetHtml || record.documentsHtml));
  return !clean(record.title)
    || !clean(record.sku)
    || !clean(record.sourceUrl)
    || record.verification?.skuMatches !== true
    || record.verification?.priceLeak !== false
    || !hasContent
    || (record.images || []).some((image) => !isManagedImage(image))
    || /(?:\b(?:USD|CAD)\b\s*:?)?\s*\$\s*\d|\b(?:add\s+to\s+cart|shopping\s+cart|checkout|quantity)\b/i.test(serialized);
});
const report = {
  generatedAt: new Date().toISOString(),
  version: VERSION,
  batchKey: BATCH_KEY,
  preparedTargets: prepare.migrationTargets,
  unresolvedDuringPreparation: prepare.unresolved,
  officialProductPages: prepare.resolvedOfficialProductPages,
  officialCollectionTableFallbacks: prepare.categoryTableFallbacks,
  expected: expectedSkus.size,
  staged: records.length,
  uniqueStaged: actualSet.size,
  missing,
  unexpected,
  duplicates: [...new Set(duplicates)],
  invalid: invalid.map((record) => record.sku),
  managedImages: records.reduce((sum, record) => sum + (record.images || []).length, 0),
  productionProductWrites: 0,
  productionCategoryWrites: 0,
  passed: prepare.unresolved === 0
    && records.length === expectedSkus.size
    && actualSet.size === expectedSkus.size
    && missing.length === 0
    && unexpected.length === 0
    && duplicates.length === 0
    && invalid.length === 0,
};

fs.writeFileSync(AUDIT_FILE, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 2;
