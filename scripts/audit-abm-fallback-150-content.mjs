#!/usr/bin/env node
import fs from "node:fs";
import { createClient } from "next-sanity";

const VERSION = "2026-08-09-search-v5";
const TARGET_FILE = "data/abm-fallback-150-targets.json";
const targets = JSON.parse(fs.readFileSync(TARGET_FILE, "utf8"));
const skus = targets.skus.map((value) => String(value || "").trim()).filter(Boolean);
const keys = skus.map((sku) => `product:${sku.toLowerCase()}`);

if (skus.length !== 150 || new Set(keys).size !== 150) {
  throw new Error(`Expected exactly 150 frozen targets, got ${skus.length}`);
}

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  useCdn: false,
});

const docs = await client.fetch(`*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
  && count(records[key in $keys]) > 0
]{
  _id,
  "records": records[key in $keys]{
    key,
    title,
    sourceUrl,
    description,
    introHtml,
    specificationsHtml,
    datasheetHtml,
    documentsHtml,
    faqsHtml,
    referencesHtml,
    reviewsHtml,
    storage,
    materialCitation,
    images,
    verification
  }
}`, { version: VERSION, keys });

const records = (docs || []).flatMap((doc) => doc.records || []);
const byKey = new Map();
for (const row of records) {
  const key = String(row?.key || "").toLowerCase();
  if (!byKey.has(key)) byKey.set(key, []);
  byKey.get(key).push(row);
}

const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;
const commerceLeak = (value) => /(?:\$\s*\d|\b(?:USD|CAD)\s*\d|add\s+to\s+cart|\bprice\b)/i.test(String(value || ""));
const failures = [];
const stats = {
  targets: keys.length,
  uniqueDetailKeys: byKey.size,
  withSpecifications: 0,
  withOverviewOrDescription: 0,
  withManagedImage: 0,
};

for (const key of keys) {
  const matches = byKey.get(key) || [];
  if (matches.length !== 1) {
    failures.push({ key, issue: matches.length ? `duplicate detail records: ${matches.length}` : "missing detail record" });
    continue;
  }
  const row = matches[0];
  const specs = nonEmpty(row.specificationsHtml);
  const overview = nonEmpty(row.description) || nonEmpty(row.introHtml);
  const images = Array.isArray(row.images) ? row.images : [];
  const managedImage = images.some((url) => /^https:\/\/cdn\.sanity\.io\/images\/9b5twpc8\//i.test(String(url || "")));
  if (specs) stats.withSpecifications += 1;
  if (overview) stats.withOverviewOrDescription += 1;
  if (managedImage) stats.withManagedImage += 1;

  if (!nonEmpty(row.title)) failures.push({ key, issue: "missing title" });
  if (!nonEmpty(row.sourceUrl)) failures.push({ key, issue: "missing sourceUrl" });
  if (!specs) failures.push({ key, issue: "missing specificationsHtml" });
  if (!overview) failures.push({ key, issue: "missing overview/description" });
  if (row.verification?.skuMatches !== true) failures.push({ key, issue: "skuMatches != true" });

  const html = [
    row.description,
    row.specificationsHtml,
    row.datasheetHtml,
    row.documentsHtml,
    row.faqsHtml,
    row.referencesHtml,
    row.reviewsHtml,
    row.storage,
    row.materialCitation,
  ].filter(Boolean).join("\n");
  if (commerceLeak(html)) failures.push({ key, issue: "commerce/price text remains in migrated content" });
}

const report = {
  generatedAt: new Date().toISOString(),
  version: VERSION,
  ...stats,
  failureCount: failures.length,
  failures,
  passed: failures.length === 0 && byKey.size === 150 && stats.withSpecifications === 150 && stats.withOverviewOrDescription === 150,
};

console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 2;
