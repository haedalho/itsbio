#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { createClient } from "next-sanity";
import stableCatalog from "../data/abm-stable-cell-catalog.json" with { type: "json" };

const VERSION = String(process.env.ABM_REBUILD_VERSION || "2026-08-09-search-v5").trim();
const PREFIX = "abm-rebuild-detail-product-batch-stable-cell-lines-chunk-";
const EXPECTED = Number(stableCatalog?.expectedCount || 0);
const OUT = path.resolve(".cache/abm-stable-migration-verification");
const WAIT = process.argv.includes("--wait");
const MAX_ATTEMPTS = Math.max(1, Number(process.env.STABLE_VERIFY_ATTEMPTS || (WAIT ? 30 : 1)) || 1);
const WAIT_MS = Math.max(1000, Number(process.env.STABLE_VERIFY_WAIT_MS || 15000) || 15000);

fs.mkdirSync(OUT, { recursive: true });
if (!EXPECTED || !Array.isArray(stableCatalog?.products) || stableCatalog.products.length !== EXPECTED) {
  throw new Error(`Stable source catalog invalid: expected=${EXPECTED} products=${stableCatalog?.products?.length}`);
}

const client = createClient({
  projectId: String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim(),
  dataset: String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim(),
  apiVersion: String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim(),
  useCdn: false,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const lower = (value) => clean(value).toLowerCase();
const htmlText = (value) => value ? clean(cheerio.load(`<div id="x">${String(value)}</div>`)("#x").text()) : "";
const officialSkus = new Set(stableCatalog.products.map((product) => lower(product.sku)).filter(Boolean));

function isManagedImage(value) {
  try {
    const url = new URL(String(value || ""));
    return url.hostname === "cdn.sanity.io" && url.pathname.startsWith("/images/9b5twpc8/");
  } catch {
    return false;
  }
}

function hasCurrency(value) {
  return /(?:\b(?:USD|CAD)\b\s*:?)?\s*\$\s*\d|\b(?:USD|CAD)\s+\d[\d,.]*/i.test(String(value || ""));
}

async function fetchRows() {
  return await client.fetch(`*[
    _type == "abmRebuildDetailChunk"
    && version == $version
    && kind == "product"
    && string::startsWith(_id, $prefix)
  ].records[]{
    key,sku,title,sourceUrl,specificationsHtml,images,verification
  }`, { version: VERSION, prefix: PREFIX });
}

let rows = [];
for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  rows = await fetchRows();
  console.log(`[stable verify] attempt ${attempt}/${MAX_ATTEMPTS}: ${rows.length}/${EXPECTED} records`);
  if (rows.length === EXPECTED) break;
  if (attempt < MAX_ATTEMPTS) await sleep(WAIT_MS);
}

const seen = new Map();
const duplicateSkus = [];
const unexpectedSkus = [];
const missingSpecifications = [];
const priceLeaks = [];
const unmanagedImages = [];
const invalidSource = [];
const noManagedImage = [];

for (const row of rows) {
  const sku = lower(row?.sku || String(row?.key || "").replace(/^product:/i, ""));
  if (!sku) continue;
  if (seen.has(sku)) duplicateSkus.push(sku);
  seen.set(sku, row);
  if (!officialSkus.has(sku)) unexpectedSkus.push(sku);

  const specsText = htmlText(row?.specificationsHtml);
  if (row?.verification?.hasSpecifications !== true || specsText.length < 10) missingSpecifications.push(sku);
  if (hasCurrency(JSON.stringify(row))) priceLeaks.push(sku);
  if (/\/pagenotfound\b/i.test(clean(row?.sourceUrl)) || /page\s+not\s+found/i.test(clean(row?.title))) invalidSource.push(sku);

  const images = Array.isArray(row?.images) ? row.images.map(String).filter(Boolean) : [];
  const badImages = images.filter((url) => !isManagedImage(url));
  if (badImages.length) unmanagedImages.push({ sku, images: badImages });
  if (!images.some(isManagedImage)) noManagedImage.push(sku);
}

const missingSkus = [...officialSkus].filter((sku) => !seen.has(sku));
const summary = {
  expected: EXPECTED,
  staged: rows.length,
  uniqueSkus: seen.size,
  missingSkus: missingSkus.length,
  duplicateSkus: duplicateSkus.length,
  unexpectedSkus: unexpectedSkus.length,
  missingSpecifications: missingSpecifications.length,
  priceLeaks: priceLeaks.length,
  unmanagedImages: unmanagedImages.length,
  noManagedImage: noManagedImage.length,
  invalidSource: invalidSource.length,
};

const report = {
  generatedAt: new Date().toISOString(),
  version: VERSION,
  prefix: PREFIX,
  summary,
  defects: {
    missingSkus,
    duplicateSkus,
    unexpectedSkus,
    missingSpecifications,
    priceLeaks,
    unmanagedImages,
    noManagedImage,
    invalidSource,
  },
};
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(summary, null, 2));

const critical = summary.staged !== EXPECTED
  || summary.uniqueSkus !== EXPECTED
  || summary.missingSkus
  || summary.duplicateSkus
  || summary.unexpectedSkus
  || summary.missingSpecifications
  || summary.priceLeaks
  || summary.unmanagedImages
  || summary.invalidSource;
if (critical) process.exitCode = 1;
