#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createClient } from "next-sanity";

const argv = process.argv.slice(2);
const readArg = (name, fallback = "") => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : fallback;
};

const MODE = readArg("--mode", "prepare");
const TARGET_FILE = path.resolve(readArg("--targets", "data/abm-fallback-150-targets.json"));
const OUT = path.resolve(".cache/abm-fallback-150-migration");
const COLLECT_OUT = path.resolve(".cache/abm-full-detail-collect");
const VERSION = "2026-08-09-search-v5";
const EXPECTED_TARGETS = 150;
const projectId = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const dataset = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const apiVersion = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();

fs.mkdirSync(OUT, { recursive: true });

const client = createClient({ projectId, dataset, apiVersion, useCdn: false });
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const lower = (value) => clean(value).toLowerCase();
const keyFor = (row) => `product:${lower(row?.sku || row?.url)}`;
const hasCommerceText = (value) => /(?:\b(?:USD|CAD)\b\s*:?)?\s*\$\s*\d|\b(?:USD|CAD)\s+\d[\d,.]*|\badd\s+to\s+cart\b|\bprice\b/i.test(String(value || ""));

function appendOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function loadTargets() {
  if (!fs.existsSync(TARGET_FILE)) throw new Error(`Target file not found: ${TARGET_FILE}`);
  const target = JSON.parse(fs.readFileSync(TARGET_FILE, "utf8"));
  const skus = Array.isArray(target?.skus) ? target.skus.map(clean).filter(Boolean) : [];
  const unique = new Set(skus.map(lower));
  if (target?.version !== VERSION) throw new Error(`Target version mismatch: ${target?.version}`);
  if (target?.count !== EXPECTED_TARGETS || skus.length !== EXPECTED_TARGETS || unique.size !== EXPECTED_TARGETS) {
    throw new Error(`Target set must contain exactly ${EXPECTED_TARGETS} unique SKUs; got rows=${skus.length}, unique=${unique.size}`);
  }
  return { target, skus, skuSet: unique };
}

async function readState() {
  const { skus, skuSet } = loadTargets();
  const inventory = await client.fetch(`*[
    _type == "abmRebuildChunk"
    && version == $version
    && kind == "product"
  ].records[]{
    kind,
    sku,
    title,
    url,
    unit,
    searchCategory,
    filterTitle,
    filterPath,
    listingFilters,
    hasDetail,
    previewImage,
    previewSummary
  }`, { version: VERSION });

  const inventoryBySku = new Map();
  for (const row of inventory || []) {
    const sku = lower(row?.sku);
    if (!skuSet.has(sku)) continue;
    if (!inventoryBySku.has(sku)) inventoryBySku.set(sku, []);
    inventoryBySku.get(sku).push(row);
  }

  const missingInventory = [];
  const duplicateInventory = [];
  const targetRows = [];
  for (const sku of skus) {
    const matches = inventoryBySku.get(lower(sku)) || [];
    if (matches.length === 0) missingInventory.push(sku);
    if (matches.length > 1) duplicateInventory.push({ sku, count: matches.length });
    if (matches.length === 1) targetRows.push(matches[0]);
  }
  if (missingInventory.length || duplicateInventory.length || targetRows.length !== EXPECTED_TARGETS) {
    throw new Error(`Frozen target inventory mismatch: missing=${missingInventory.length}, duplicate=${duplicateInventory.length}, resolved=${targetRows.length}`);
  }

  const targetKeys = new Set(targetRows.map(keyFor));
  const details = await client.fetch(`*[
    _type == "abmRebuildDetailChunk"
    && version == $version
    && kind == "product"
  ]{
    _id,
    "records": records[]{key,title,unit,sourceUrl,images,verification}
  }`, { version: VERSION });

  const detailByKey = new Map();
  for (const doc of details || []) {
    for (const record of doc?.records || []) {
      const key = lower(record?.key);
      if (!targetKeys.has(key)) continue;
      if (!detailByKey.has(key)) detailByKey.set(key, []);
      detailByKey.get(key).push({ docId: doc._id, ...record });
    }
  }

  const duplicateDetails = [...detailByKey.entries()]
    .filter(([, records]) => records.length > 1)
    .map(([key, records]) => ({ key, docs: records.map((row) => row.docId) }));
  if (duplicateDetails.length) {
    fs.writeFileSync(path.join(OUT, "duplicate-details.json"), JSON.stringify(duplicateDetails, null, 2));
    throw new Error(`Target detail keys are duplicated in Sanity: ${duplicateDetails.length}`);
  }

  const missingRows = targetRows.filter((row) => !detailByKey.has(keyFor(row)));
  const completeRows = targetRows.filter((row) => detailByKey.has(keyFor(row)));
  return { skus, targetRows, missingRows, completeRows, detailByKey };
}

function validManagedImage(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === "cdn.sanity.io" && url.pathname.startsWith(`/images/${projectId}/`);
  } catch {
    return false;
  }
}

function detailValidation(record) {
  const failures = [];
  if (!clean(record?.title)) failures.push("missing title");
  if (!clean(record?.sourceUrl)) failures.push("missing sourceUrl");
  if (hasCommerceText(record?.unit)) failures.push("commerce text in unit");
  if (record?.verification?.skuMatches !== true) failures.push("skuMatches != true");
  if (record?.verification?.priceLeak !== false) failures.push("priceLeak != false");
  if ((record?.images || []).some((image) => !validManagedImage(image))) failures.push("unmanaged image");
  return failures;
}

async function prepare() {
  const state = await readState();
  const inventory = {
    generatedAt: new Date().toISOString(),
    products: state.missingRows,
    services: [],
    excluded: [],
    productRuns: [{ title: "ABM fallback 150 current-missing target set", expected: state.missingRows.length, got: state.missingRows.length, complete: true }],
    serviceRuns: [{ title: "No services in target set", expected: 0, got: 0, complete: true }],
  };
  const inventoryFile = path.join(OUT, "inventory.json");
  fs.writeFileSync(inventoryFile, JSON.stringify(inventory, null, 2));
  const report = {
    generatedAt: new Date().toISOString(),
    version: VERSION,
    frozenTargetCount: EXPECTED_TARGETS,
    alreadyComplete: state.completeRows.length,
    currentMissing: state.missingRows.length,
    currentMissingSkus: state.missingRows.map((row) => row.sku),
  };
  fs.writeFileSync(path.join(OUT, "prepare-report.json"), JSON.stringify(report, null, 2));
  appendOutput("inventory_file", inventoryFile);
  appendOutput("missing_count", state.missingRows.length);
  appendOutput("complete_count", state.completeRows.length);
  console.log(JSON.stringify(report, null, 2));
}

function filterCollected() {
  const prep = JSON.parse(fs.readFileSync(path.join(OUT, "prepare-report.json"), "utf8"));
  const productFile = path.join(COLLECT_OUT, "products.json");
  if (!fs.existsSync(productFile)) throw new Error(`Collector output missing: ${productFile}`);
  const rows = JSON.parse(fs.readFileSync(productFile, "utf8"));
  if (!Array.isArray(rows) || rows.length !== prep.currentMissing) {
    throw new Error(`Collector row count mismatch: expected ${prep.currentMissing}, got ${Array.isArray(rows) ? rows.length : "non-array"}`);
  }
  const targetSet = new Set(loadTargets().skus.map(lower));
  const safe = [];
  const rejected = [];
  const sanitizedCommerceUnits = [];
  for (const row of rows) {
    const sku = clean(row?.inventory?.sku);
    const reasons = [];
    if (!targetSet.has(lower(sku))) reasons.push("outside frozen target set");
    if (row?.status !== "ok") reasons.push("fetch/parse error");
    if (row?.qa?.skuMatch !== true || row?.detail?.verification?.skuMatches !== true) reasons.push("SKU mismatch");
    if (row?.qa?.priceLeak !== false) reasons.push("price leak");
    if (!clean(row?.detail?.title)) reasons.push("missing title");
    if (!clean(row?.detail?.sourceUrl)) reasons.push("missing sourceUrl");

    if (row?.status === "ok" && row?.detail && hasCommerceText(row.detail.unit)) {
      const inventoryUnit = clean(row?.inventory?.unit);
      row.detail.unit = hasCommerceText(inventoryUnit) ? "" : inventoryUnit;
      sanitizedCommerceUnits.push(sku);
    }

    if (hasCommerceText(row?.detail?.unit)) reasons.push("commerce text remains in unit");
    if (reasons.length) rejected.push({ sku, reasons, error: row?.error || null, finalUrl: row?.finalUrl || null });
    else safe.push(row);
  }
  fs.writeFileSync(path.join(OUT, "safe-products.json"), JSON.stringify(safe, null, 2));
  fs.writeFileSync(path.join(OUT, "empty-services.json"), "[]\n");
  fs.writeFileSync(path.join(OUT, "rejected-products.json"), JSON.stringify(rejected, null, 2));
  const report = {
    attempted: rows.length,
    safe: safe.length,
    rejected: rejected.length,
    sanitizedCommerceUnitCount: sanitizedCommerceUnits.length,
    sanitizedCommerceUnits,
    rejectedRows: rejected,
  };
  fs.writeFileSync(path.join(OUT, "filter-report.json"), JSON.stringify(report, null, 2));
  appendOutput("safe_count", safe.length);
  appendOutput("rejected_count", rejected.length);
  console.log(JSON.stringify(report, null, 2));
}

async function audit() {
  const state = await readState();
  const invalid = [];
  for (const row of state.completeRows) {
    const key = keyFor(row);
    const detail = state.detailByKey.get(key)?.[0];
    const failures = detailValidation(detail);
    if (failures.length) invalid.push({ sku: row.sku, key, failures, docId: detail?.docId });
  }
  const report = {
    generatedAt: new Date().toISOString(),
    version: VERSION,
    frozenTargetCount: EXPECTED_TARGETS,
    complete: state.completeRows.length,
    remainingFallback: state.missingRows.length,
    remainingSkus: state.missingRows.map((row) => row.sku),
    invalidDetailCount: invalid.length,
    invalid,
    passed: state.missingRows.length === 0 && invalid.length === 0 && state.completeRows.length === EXPECTED_TARGETS,
  };
  fs.writeFileSync(path.join(OUT, "final-audit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 2;
}

if (MODE === "prepare") await prepare();
else if (MODE === "filter") filterCollected();
else if (MODE === "audit") await audit();
else throw new Error(`Unknown --mode ${MODE}`);
