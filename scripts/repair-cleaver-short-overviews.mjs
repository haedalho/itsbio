#!/usr/bin/env node

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");

const APPLY = process.argv.includes("--apply");
const MIGRATION_KEY = "cleaver-products-2026-08-24";
const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const oneLine = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\r/g, " ").replace(/\s+/g, " ").trim();
const escapeHtml = (value) => String(value).replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[character]));

// These exact short Overview values were independently discovered from the
// complete Thistle source scan. The main source-truth parser intentionally
// treats these as a regression fixture so short manufacturer copy can never
// be dropped merely because it is under an arbitrary length threshold.
const VERIFIED_SHORT_OVERVIEWS = new Map([
  ["MSO-1-12/22DS", "Comb 12/22, 1mm thick DS"],
  ["CVS8TANK", "Replacement tank for proPAGE"],
  ["S0200-22", "S0200-22"],
  ["S0200-24", "S0200-24"],
  ["S0200-25", "S0200-25"],
  ["S0200-26", "S0200-26"],
  ["S0200-27", "S0200-27"],
  ["CSL-WHITETUBE", "CSL-WHITETUBE"],
]);

const sourceMap = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-source-map.json"), "utf8"));
const mappedSkus = new Set(Object.keys(sourceMap).map(normalizeSku));
const missingFromSourceMap = [...VERIFIED_SHORT_OVERVIEWS.keys()].filter((sku) => !mappedSkus.has(normalizeSku(sku)));
if (missingFromSourceMap.length) {
  throw new Error(`Verified short Overview SKU(s) disappeared from the Cleaver source map: ${missingFromSourceMap.join(", ")}`);
}

console.log(JSON.stringify({
  stage: APPLY ? "apply" : "dry-run",
  shortOverviewSkus: VERIFIED_SHORT_OVERVIEWS.size,
  samples: [...VERIFIED_SHORT_OVERVIEWS.entries()].map(([sku, overview]) => ({ sku, overview })),
}));

if (!APPLY) process.exit(0);

const token = [
  process.env.SANITY_WRITE_TOKEN,
  process.env.SANITY_API_WRITE_TOKEN,
  process.env.SANITY_API_TOKEN,
  process.env.SANITY_TOKEN,
  process.env.SANITY_AUTH_TOKEN,
].map((value) => String(value || "").trim()).find(Boolean);
if (!token) throw new Error("Short-overview repair requires the Production Sanity write token.");

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

const targetSkus = [...VERIFIED_SHORT_OVERVIEWS.keys()];
const rows = await client.fetch(
  `*[_type == "product" && migrationKey == $key && sku in $skus]{_id,sku}`,
  { key: MIGRATION_KEY, skus: targetSkus },
);
const bySku = new Map((rows || []).map((row) => [normalizeSku(row.sku), row]));
const missing = targetSkus.filter((sku) => !bySku.has(normalizeSku(sku)));
if (missing.length) throw new Error(`Sanity is missing verified short-overview product(s): ${missing.join(", ")}`);

let published = 0;
for (const [sku, overview] of VERIFIED_SHORT_OVERVIEWS) {
  const target = bySku.get(normalizeSku(sku));
  await client.patch(target._id).set({ overviewHtml: `<p>${escapeHtml(overview)}</p>` }).commit({ visibility: "sync" });
  published += 1;
}

const verify = await client.fetch(
  `*[_type == "product" && migrationKey == $key && sku in $skus]{sku,overviewHtml}`,
  { key: MIGRATION_KEY, skus: targetSkus },
);
const actual = new Map((verify || []).map((row) => [
  normalizeSku(row.sku),
  oneLine(String(row.overviewHtml || "").replace(/<[^>]+>/g, " ").replace(/&amp;/gi, "&")),
]));
const mismatches = [...VERIFIED_SHORT_OVERVIEWS.entries()]
  .filter(([sku, expected]) => actual.get(normalizeSku(sku)) !== expected)
  .map(([sku, expected]) => ({ sku, expected, actual: actual.get(normalizeSku(sku)) || "" }));

console.log(JSON.stringify({ published, verified: VERIFIED_SHORT_OVERVIEWS.size - mismatches.length, mismatches }));
if (mismatches.length) throw new Error(`Short-overview post-publish verification failed: ${mismatches.length} mismatches.`);
