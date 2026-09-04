#!/usr/bin/env node

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");

const APPLY = process.argv.includes("--apply");
const MIGRATION_KEY = "cleaver-products-2026-08-24";
const READER = "https://r.jina.ai/";
const SOURCE_HOSTS = new Set(["www.thistlescientific.com", "thistlescientific.com"]);
const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
const oneLine = (value) => clean(value).replace(/\s+/g, " ");
const escapeHtml = (value) => String(value).replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[character]));

const inventory = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-product-catalog.json"), "utf8"));
const sourceMap = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-source-map.json"), "utf8"));
const inventorySkus = new Set(inventory.map((row) => normalizeSku(row.sku)));

function normalizeSourceUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!SOURCE_HOSTS.has(url.hostname.toLowerCase())) return "";
    url.hash = "";
    url.search = "";
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
    return url.toString();
  } catch {
    return "";
  }
}

const families = new Map();
for (const [rawSku, identity] of Object.entries(sourceMap)) {
  const sku = normalizeSku(rawSku);
  if (!inventorySkus.has(sku)) continue;
  const sourceUrl = normalizeSourceUrl(identity?.sourceUrl);
  if (!sourceUrl) continue;
  const list = families.get(sourceUrl) || [];
  list.push(sku);
  families.set(sourceUrl, list);
}

async function pooled(items, limit, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  }));
}

async function readSource(sourceUrl) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${READER}${sourceUrl}`, {
      headers: { Accept: "text/markdown,text/plain;q=0.9,*/*;q=0.8", "User-Agent": "ITS-BIO-CleaverShortOverview/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(75_000),
    });
    const text = await response.text();
    lastStatus = response.status;
    if (response.ok && text.length > 250) return text;
    if (![408, 429, 500, 502, 503, 504].includes(response.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 1500 * (2 ** attempt)));
  }
  throw new Error(`reader HTTP ${lastStatus}`);
}

function stripMarkdown(value) {
  return oneLine(String(value || "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`>#]/g, " ")
    .replace(/\|/g, " "));
}

function overviewBody(markdown) {
  const normalized = String(markdown || "").replace(/[’]/g, "'");
  const headings = [...normalized.matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)].map((match) => ({
    level: match[1].length,
    title: oneLine(match[2]).replace(/\s*\+\s*$/, ""),
    index: match.index,
    length: match[0].length,
  }));
  const start = headings.find((heading) => /^overview$/i.test(heading.title));
  if (!start) return "";
  const from = start.index + start.length;
  const next = headings.find((heading) => heading.index > start.index && heading.level <= start.level);
  return normalized.slice(from, next ? next.index : normalized.length).trim();
}

const shortOverviews = new Map();
const failures = [];
await pooled([...families.entries()], 6, async ([sourceUrl, skus]) => {
  try {
    const markdown = await readSource(sourceUrl);
    const plain = stripMarkdown(overviewBody(markdown));
    if (!plain || plain.length >= 30) return;
    const html = `<p>${escapeHtml(plain)}</p>`;
    for (const sku of skus) shortOverviews.set(sku, { sourceUrl, plain, html });
  } catch (error) {
    failures.push({ sourceUrl, error: error instanceof Error ? error.message : String(error) });
  }
});

console.log(JSON.stringify({ stage: APPLY ? "apply" : "dry-run", families: families.size, shortOverviewSkus: shortOverviews.size, sourceFailures: failures.length, samples: [...shortOverviews.entries()].slice(0, 12).map(([sku, row]) => ({ sku, overview: row.plain })) }));
if (failures.length) throw new Error(`Short-overview repair refused partial source coverage: ${failures.length} source families failed.`);
if (!APPLY) process.exit(0);

const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim()).find(Boolean);
if (!token) throw new Error("Short-overview repair requires the Production Sanity write token.");
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

const rows = await client.fetch(`*[_type == "product" && migrationKey == $key]{_id,sku}`, { key: MIGRATION_KEY });
const bySku = new Map((rows || []).map((row) => [normalizeSku(row.sku), row]));
const missing = [...shortOverviews.keys()].filter((sku) => !bySku.has(sku));
if (missing.length) throw new Error(`Sanity is missing ${missing.length} short-overview products: ${missing.slice(0, 12).join(",")}`);

let published = 0;
await pooled([...shortOverviews.entries()], 5, async ([sku, source]) => {
  const target = bySku.get(sku);
  await client.patch(target._id).set({ overviewHtml: source.html }).commit({ visibility: "sync" });
  published += 1;
});

const verify = await client.fetch(`*[_type == "product" && migrationKey == $key && sku in $skus]{sku,overviewHtml}`, { key: MIGRATION_KEY, skus: [...shortOverviews.keys()] });
const actual = new Map((verify || []).map((row) => [normalizeSku(row.sku), oneLine(String(row.overviewHtml || "").replace(/<[^>]+>/g, " "))]));
const mismatches = [...shortOverviews.entries()].filter(([sku, expected]) => actual.get(sku) !== expected.plain).map(([sku, expected]) => ({ sku, expected: expected.plain, actual: actual.get(sku) || "" }));
console.log(JSON.stringify({ published, verified: shortOverviews.size - mismatches.length, mismatches: mismatches.slice(0, 20) }));
if (mismatches.length) throw new Error(`Short-overview post-publish verification failed: ${mismatches.length} mismatches.`);
