#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const cheerio = require("cheerio");

const WRITE = process.argv.includes("--write");
const SOURCE_HOST = "www.thistlescientific.com";
const USER_AGENT = "Mozilla/5.0 (compatible; ITS-BIO-CleaverCatalog/1.0; +https://itsbio.co.kr)";
const OUTPUT_PATH = path.join(process.cwd(), "data/cleaver-source-map.json");

const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const cleanText = (value) => {
  const $ = cheerio.load(`<div>${String(value || "")}</div>`);
  return $("div").text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
};

const inventory = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-product-catalog.json"), "utf8"));
if (!Array.isArray(inventory) || inventory.length !== 1432) {
  throw new Error(`Expected exactly 1,432 reviewed Cleaver SKUs, got ${Array.isArray(inventory) ? inventory.length : "invalid data"}.`);
}

async function pooled(items, limit, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
    }
  }));
}

async function fetchJson(url) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-GB,en;q=0.9",
        Referer: `https://${SOURCE_HOST}/`,
        "User-Agent": USER_AGENT,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(45_000),
    });
    if (response.status === 429 && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (2 ** attempt)));
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${new URL(url).pathname}`);
    return response.json();
  }
  throw new Error(`Source remained rate limited: ${url}`);
}

const productsBySku = new Map();
const skus = inventory.map((row) => normalizeSku(row.sku));
const skuBatches = Array.from({ length: Math.ceil(skus.length / 30) }, (_, index) => skus.slice(index * 30, index * 30 + 30));
let skuBatchFailures = 0;

await pooled(skuBatches, 4, async (batch) => {
  try {
    const url = new URL(`https://${SOURCE_HOST}/wp-json/wc/store/v1/products`);
    url.searchParams.set("sku", batch.join(","));
    url.searchParams.set("per_page", "100");
    const rows = await fetchJson(url.toString());
    for (const product of Array.isArray(rows) ? rows : []) {
      const sku = normalizeSku(product.sku);
      if (sku) productsBySku.set(sku, product);
    }
  } catch (error) {
    skuBatchFailures += 1;
    console.warn(`[Cleaver source map] SKU batch failed: ${error.message}`);
  }
});

const parentIds = [...new Set([...productsBySku.values()]
  .map((product) => Number(product.parent))
  .filter((id) => Number.isSafeInteger(id) && id > 0))];
const parentsById = new Map();
const parentBatches = Array.from({ length: Math.ceil(parentIds.length / 30) }, (_, index) => parentIds.slice(index * 30, index * 30 + 30));
let parentBatchFailures = 0;

await pooled(parentBatches, 4, async (batch) => {
  try {
    const url = new URL(`https://${SOURCE_HOST}/wp-json/wc/store/v1/products`);
    url.searchParams.set("include", batch.join(","));
    url.searchParams.set("per_page", "100");
    const rows = await fetchJson(url.toString());
    for (const product of Array.isArray(rows) ? rows : []) {
      const id = Number(product.id);
      if (Number.isSafeInteger(id) && id > 0) parentsById.set(id, product);
    }
  } catch (error) {
    parentBatchFailures += 1;
    console.warn(`[Cleaver source map] parent batch failed: ${error.message}`);
  }
});

const output = {};
const familyKeys = new Set();
for (const row of inventory) {
  const sku = normalizeSku(row.sku);
  const variation = productsBySku.get(sku);
  if (!variation) continue;

  const parentId = Number(variation.parent);
  const parent = parentId > 0 ? parentsById.get(parentId) : variation;
  const source = parent || variation;
  const sourceTitle = cleanText(source.name || variation.name || row.title);
  const sourceUrl = String(source.permalink || variation.permalink || "").trim();
  const sourceSlug = String(source.slug || variation.slug || "").trim();
  const images = Array.from(new Set((Array.isArray(source.images) ? source.images : [])
    .map((image) => String(image?.src || "").trim())
    .filter((url) => /^https:\/\//i.test(url))));

  if (!sourceTitle || !sourceUrl || !sourceSlug) continue;
  familyKeys.add(sourceUrl.replace(/\/+$/, "").toLowerCase());
  output[sku] = {
    sourceTitle,
    sourceUrl,
    sourceSlug,
    images,
  };
}

const mapped = Object.keys(output).length;
const stats = {
  reviewedInventory: inventory.length,
  manufacturerSkuMatches: productsBySku.size,
  mapped,
  manufacturerFamilies: familyKeys.size,
  skuBatchFailures,
  parentBatchFailures,
};
console.log(JSON.stringify(stats));

if (productsBySku.size < 900 || mapped < 900 || familyKeys.size < 100) {
  throw new Error(`Cleaver source identity coverage unexpectedly low: ${JSON.stringify(stats)}`);
}

if (WRITE) {
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`[Cleaver source map] wrote ${mapped} SKU identities to ${OUTPUT_PATH}`);
}
