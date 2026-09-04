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
const OVERRIDES_PATH = path.join(process.cwd(), "data/cleaver-source-overrides.json");

const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const cleanText = (value) => {
  const $ = cheerio.load(`<div>${String(value || "")}</div>`);
  return $("div").text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
};
const normalizedSourceKey = (value) => String(value || "").trim().replace(/\/+$/, "").toLowerCase();
const packageFamilyKey = (value) => {
  const sku = normalizeSku(value);
  if (!/(?:^|[-_/])PP\d+(?:KIT)?$|KIT$/i.test(sku)) return "";
  return sku
    .replace(/(?:[-_/]?PP\d+)(?:KIT)?$/i, "")
    .replace(/KIT$/i, "")
    .replace(/[-_/]+$/g, "");
};

const inventory = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-product-catalog.json"), "utf8"));
const overrides = JSON.parse(await readFile(OVERRIDES_PATH, "utf8"));
if (!Array.isArray(inventory) || inventory.length !== 1432) {
  throw new Error(`Expected exactly 1,432 reviewed Cleaver SKUs, got ${Array.isArray(inventory) ? inventory.length : "invalid data"}.`);
}
const inventorySkuSet = new Set(inventory.map((row) => normalizeSku(row.sku)));
for (const [rawSku, override] of Object.entries(overrides)) {
  const sku = normalizeSku(rawSku);
  if (!inventorySkuSet.has(sku)) throw new Error(`Cleaver source override references an unknown reviewed SKU: ${sku}`);
  const modes = [override?.canonicalSku, override?.sourceSlug, override?.exclude].filter(Boolean).length;
  if (modes !== 1) throw new Error(`Cleaver source override must define exactly one resolution mode: ${sku}`);
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
  familyKeys.add(normalizedSourceKey(sourceUrl));
  output[sku] = {
    sourceTitle,
    sourceUrl,
    sourceSlug,
    images,
  };
}

// Some reviewed catalog rows use retired/legacy SKU spellings while the current
// manufacturer catalog exposes only the canonical family page or a renamed SKU.
// Resolve only reviewed, explicit aliases so title similarity can never attach a
// product to the wrong manufacturer page.
const directSlugs = [...new Set(Object.values(overrides).map((override) => String(override?.sourceSlug || "").trim()).filter(Boolean))];
const directProductsBySlug = new Map();
await pooled(directSlugs, 4, async (slug) => {
  const url = new URL(`https://${SOURCE_HOST}/wp-json/wc/store/v1/products`);
  url.searchParams.set("slug", slug);
  url.searchParams.set("per_page", "10");
  const rows = await fetchJson(url.toString());
  const product = (Array.isArray(rows) ? rows : []).find((row) => String(row?.slug || "").trim() === slug);
  if (!product) throw new Error(`Cleaver source override slug no longer resolves: ${slug}`);
  directProductsBySlug.set(slug, product);
});

let canonicalOverrides = 0;
let directOverrides = 0;
const excludedSkus = [];
for (const [rawSku, override] of Object.entries(overrides)) {
  const sku = normalizeSku(rawSku);
  if (override.exclude) {
    excludedSkus.push(sku);
    continue;
  }

  if (override.canonicalSku) {
    const canonicalSku = normalizeSku(override.canonicalSku);
    const identity = output[canonicalSku];
    if (!identity) throw new Error(`Cleaver source override canonical SKU did not resolve: ${sku} -> ${canonicalSku}`);
    output[sku] = { ...identity, images: [...(identity.images || [])] };
    familyKeys.add(normalizedSourceKey(identity.sourceUrl));
    canonicalOverrides += 1;
    continue;
  }

  const product = directProductsBySlug.get(String(override.sourceSlug || "").trim());
  const sourceTitle = cleanText(product?.name);
  const sourceUrl = String(product?.permalink || "").trim();
  const sourceSlug = String(product?.slug || "").trim();
  const images = Array.from(new Set((Array.isArray(product?.images) ? product.images : [])
    .map((image) => String(image?.src || "").trim())
    .filter((url) => /^https:\/\//i.test(url))));
  if (!sourceTitle || !sourceUrl || !sourceSlug) throw new Error(`Cleaver direct source override is incomplete: ${sku}`);
  output[sku] = { sourceTitle, sourceUrl, sourceSlug, images };
  familyKeys.add(normalizedSourceKey(sourceUrl));
  directOverrides += 1;
}

// Fill image gaps only from deterministic manufacturer-family relationships.
// 1) Exact manufacturer source URL peers are the same product family.
// 2) Package siblings such as XXX-PP500 / XXX-PP500KIT are the same reviewed package family.
const imagesBySource = new Map();
const imagesByPackageFamily = new Map();
for (const [sku, identity] of Object.entries(output)) {
  if (!Array.isArray(identity.images) || !identity.images.length) continue;
  const sourceKey = normalizedSourceKey(identity.sourceUrl);
  if (sourceKey && !imagesBySource.has(sourceKey)) imagesBySource.set(sourceKey, identity.images);
  const packageKey = packageFamilyKey(sku);
  if (packageKey && !imagesByPackageFamily.has(packageKey)) imagesByPackageFamily.set(packageKey, identity.images);
}

let inheritedBySource = 0;
let inheritedByPackageFamily = 0;
for (const [sku, identity] of Object.entries(output)) {
  if (Array.isArray(identity.images) && identity.images.length) continue;

  const sourceImages = imagesBySource.get(normalizedSourceKey(identity.sourceUrl));
  if (sourceImages?.length) {
    identity.images = [...sourceImages];
    inheritedBySource += 1;
    continue;
  }

  const packageKey = packageFamilyKey(sku);
  const packageImages = packageKey ? imagesByPackageFamily.get(packageKey) : null;
  if (packageImages?.length) {
    identity.images = [...packageImages];
    inheritedByPackageFamily += 1;
  }
}

const mapped = Object.keys(output).length;
const mappedWithImages = Object.values(output).filter((identity) => Array.isArray(identity.images) && identity.images.length).length;
const stats = {
  reviewedInventory: inventory.length,
  manufacturerSkuMatches: productsBySku.size,
  mapped,
  unmapped: inventory.length - mapped - excludedSkus.length,
  excludedSkus,
  mappedWithImages,
  canonicalOverrides,
  directOverrides,
  inheritedBySource,
  inheritedByPackageFamily,
  manufacturerFamilies: familyKeys.size,
  skuBatchFailures,
  parentBatchFailures,
};
console.log(JSON.stringify(stats));

if (productsBySku.size < 900 || mapped + excludedSkus.length !== inventory.length || familyKeys.size < 100) {
  throw new Error(`Cleaver source identity coverage unexpectedly low: ${JSON.stringify(stats)}`);
}

if (WRITE) {
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`[Cleaver source map] wrote ${mapped} SKU identities to ${OUTPUT_PATH}`);
}
