#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");
const cheerio = require("cheerio");

const APPLY = process.argv.includes("--apply");
const MIGRATION_KEY = "cleaver-products-2026-08-24";
const SOURCE_HOSTS = new Set(["www.msesupplies.com", "www.appletonwoods.co.uk", "www.vinaquips.com", "www.thistlescientific.com"]);
const IMAGE_HOSTS = new Set(["cdn.shopify.com", "www.vinaquips.com"]);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const inventory = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-product-catalog.json"), "utf8"));
const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");
const reviewedSkus = new Map(inventory.map((row) => [normalizeSku(row.sku), row]));

if (inventory.length !== 1432 || reviewedSkus.size !== 1432) throw new Error("Expected exactly 1,432 unique reviewed Cleaver products.");

const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim())
  .find(Boolean);
if (APPLY && !token) throw new Error("Cleaver image migration requires an existing Production Sanity write token.");

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

function normalizeImageUrl(value) {
  if (!value) return "";
  try {
    const parsed = new URL(String(value).startsWith("//") ? `https:${value}` : String(value));
    if (parsed.protocol !== "https:" || !IMAGE_HOSTS.has(parsed.hostname.toLowerCase())) return "";
    if (!/\.(?:avif|gif|jpe?g|png|webp)$/i.test(parsed.pathname)) return "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

async function fetchPublic(url, accept = "application/json,text/html;q=0.9,*/*;q=0.8") {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !SOURCE_HOSTS.has(parsed.hostname)) throw new Error(`Unapproved Cleaver image source: ${url}`);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(parsed, { headers: { Accept: accept }, signal: AbortSignal.timeout(45_000), redirect: "follow" });
    if (response.status === 401 || response.status === 403) throw new Error(`Public Cleaver catalog access denied (HTTP ${response.status}): ${parsed.hostname}`);
    if (response.status === 429 && attempt < 4) {
      const requestedWait = Number.parseInt(response.headers.get("retry-after") || "0", 10) * 1000;
      const wait = Math.min(30_000, Math.max(requestedWait || 0, 1200 * (2 ** attempt)));
      console.warn(`[Cleaver images] respecting ${parsed.hostname} rate limit for ${wait}ms`);
      await new Promise((resolve) => setTimeout(resolve, wait));
      continue;
    }
    if (!response.ok) throw new Error(`Public Cleaver catalog returned HTTP ${response.status}: ${parsed.hostname}`);
    return response;
  }
  throw new Error(`Public Cleaver catalog remained rate-limited: ${parsed.hostname}`);
}

async function pooled(items, limit, worker) {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current], current);
    }
  }));
}

async function retry(label, operation, maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = Number(error?.statusCode || error?.response?.statusCode || 0);
      if (attempt === maxAttempts - 1 || (status && status !== 408 && status !== 409 && status !== 429 && status < 500)) throw error;
      const wait = Math.min(12_000, 500 * (2 ** attempt));
      console.warn(`[Cleaver images] retrying ${label} in ${wait}ms`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

const candidates = new Map();

function addCandidate(rawSku, rawImage, source, rank, page) {
  const sku = normalizeSku(rawSku);
  const image = normalizeImageUrl(rawImage);
  if (!reviewedSkus.has(sku) || !image) return false;
  if ((candidates.get(sku)?.rank || 0) >= rank) return false;
  candidates.set(sku, { sku, image, source, rank, page });
  return true;
}

async function collectShopifySource({ name, origin, vendor, pages, acceptTags }) {
  const handles = new Set();

  await pooled(Array.from({ length: pages }, (_, index) => index + 1), 3, async (page) => {
    const url = `${origin}/collections/vendors?page=${page}&q=${encodeURIComponent(vendor)}`;
    const $ = cheerio.load(await (await fetchPublic(url, "text/html,*/*;q=0.8")).text());
    $("a[href*='/products/']").each((_, element) => {
      const href = $(element).attr("href");
      if (!href) return;
      const handle = new URL(href, url).pathname.split("/products/").at(-1)?.split("/")[0];
      if (handle && /^[a-z0-9][a-z0-9-]*$/i.test(handle)) handles.add(handle);
    });
  });

  let accepted = 0;
  let failures = 0;
  await pooled([...handles], acceptTags ? 3 : 6, async (handle) => {
    try {
      const page = `${origin}/products/${handle}`;
      const product = await (await fetchPublic(`${page}.js`)).json();
      if (!/^cleaver(?: scientific)?$/i.test(String(product.vendor || "").trim())) return;

      for (const variant of Array.isArray(product.variants) ? product.variants : []) {
        const image = variant.featured_image?.src || product.featured_image || product.images?.[0];
        if (addCandidate(variant.sku, image, name, 100, page)) accepted += 1;
      }

      if (acceptTags) {
        const manufacturerSkus = (Array.isArray(product.tags) ? product.tags : []).filter((tag) => reviewedSkus.has(normalizeSku(tag)));
        for (const sku of manufacturerSkus) {
          if (addCandidate(sku, product.featured_image || product.images?.[0], name, 80, page)) accepted += 1;
        }
      }
    } catch (error) {
      failures += 1;
      console.warn(`[Cleaver images] ${name} product ${handle}: ${error.message}`);
    }
  });

  console.log(JSON.stringify({ source: name, reviewedProductPages: handles.size, acceptedMatches: accepted, failures, totalMatchedProducts: candidates.size }));
}

async function collectAdditionalDistributor() {
  const url = "https://www.vinaquips.com/wp-json/wc/store/v1/products?brand=cleaver-scientific-ltd&per_page=100";
  try {
    const products = await (await fetchPublic(url)).json();
    let accepted = 0;
    for (const product of Array.isArray(products) ? products : []) {
      if (addCandidate(product.sku, product.images?.[0]?.src, "Vinaquips reviewed Cleaver catalog", 85, product.permalink || url)) accepted += 1;
    }
    console.log(JSON.stringify({ source: "Vinaquips reviewed Cleaver catalog", reviewedProductPages: products.length, acceptedMatches: accepted, totalMatchedProducts: candidates.size }));
  } catch (error) {
    console.warn(`[Cleaver images] optional distributor unavailable: ${error.message}`);
  }
}

async function extendManufacturerImageGroups() {
  const groups = new Map();
  const skus = [...reviewedSkus.keys()];
  const batches = Array.from({ length: Math.ceil(skus.length / 35) }, (_, index) => skus.slice(index * 35, (index + 1) * 35));

  await pooled(batches, 5, async (batch) => {
    const url = new URL("https://www.thistlescientific.com/wp-json/wc/store/v1/products");
    url.searchParams.set("sku", batch.join(","));
    url.searchParams.set("per_page", "100");
    try {
      const products = await (await fetchPublic(url.toString())).json();
      for (const product of Array.isArray(products) ? products : []) {
        const sku = normalizeSku(product.sku);
        const image = product.images?.[0]?.src;
        if (!reviewedSkus.has(sku) || !image) continue;
        const key = new URL(image).pathname.toLowerCase();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(sku);
      }
    } catch (error) {
      console.warn(`[Cleaver images] optional manufacturer image verification: ${error.message}`);
    }
  });

  let accepted = 0;
  for (const group of groups.values()) {
    const verified = group.map((sku) => candidates.get(sku)).filter(Boolean).sort((a, b) => b.rank - a.rank)[0];
    if (!verified) continue;
    for (const sku of group) {
      if (addCandidate(sku, verified.image, `${verified.source}; manufacturer-confirmed shared product image`, 60, verified.page)) accepted += 1;
    }
  }
  console.log(JSON.stringify({ manufacturerImageGroups: groups.size, additionalVerifiedMatches: accepted, totalMatchedProducts: candidates.size }));
}

await collectShopifySource({
  name: "MSE Supplies authorized Cleaver Scientific supplier",
  origin: "https://www.msesupplies.com",
  vendor: "Cleaver Scientific",
  pages: 3,
  acceptTags: false,
});

await Promise.all([
  collectShopifySource({
    name: "Appleton Woods reviewed Cleaver distributor",
    origin: "https://www.appletonwoods.co.uk",
    vendor: "cleaver",
    pages: 2,
    acceptTags: true,
  }),
  collectAdditionalDistributor(),
]);

await extendManufacturerImageGroups();

const targetRows = inventory.map((row) => candidates.get(normalizeSku(row.sku))).filter(Boolean);
if (targetRows.length < 400) throw new Error(`Only ${targetRows.length} verified Cleaver product photographs were discovered; expected at least 400.`);
if (!targetRows.some((row) => row.sku === "MSMINI10")) throw new Error("The reviewed MSMINI10 product photograph is missing.");

console.log(JSON.stringify({ stage: APPLY ? "apply" : "dry-run", inventory: inventory.length, verifiedPhotographs: targetRows.length, firstProducts: targetRows.slice(0, 8).map((row) => row.sku) }));
if (!APPLY) process.exit(0);

const existing = await client.fetch(`*[_type == "product" && migrationKey == $migrationKey]{_id, sku, "hasImage": defined(images[0].asset)}`, { migrationKey: MIGRATION_KEY });
const productsBySku = new Map((existing || []).map((row) => [normalizeSku(row.sku), row]));
const pending = targetRows.filter((row) => productsBySku.has(row.sku) && !productsBySku.get(row.sku).hasImage);
const uploadedAssets = new Map();
let completed = 0;
let skipped = 0;
let failed = 0;

async function uploadAsset(row) {
  const existingUpload = uploadedAssets.get(row.image);
  if (existingUpload) return existingUpload;

  const task = (async () => {
    const response = await fetch(row.image, { headers: { Accept: "image/*,*/*;q=0.8" }, signal: AbortSignal.timeout(35_000), redirect: "follow" });
    if (response.status === 401 || response.status === 403) throw new Error(`Distributor image access denied (HTTP ${response.status})`);
    if (!response.ok) throw new Error(`Distributor image returned HTTP ${response.status}`);
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/")) throw new Error(`Unsupported image content type: ${contentType}`);
    const declaredBytes = Number.parseInt(response.headers.get("content-length") || "0", 10);
    if (declaredBytes > MAX_IMAGE_BYTES) throw new Error("Distributor image exceeds the reviewed size limit.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1500 || bytes.length > MAX_IMAGE_BYTES) throw new Error("Distributor image has an invalid file size.");
    const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : contentType.includes("gif") ? "gif" : "jpg";
    const filename = `cleaver-${row.sku.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${hash(row.image).slice(0, 12)}.${extension}`;
    return retry(`Sanity image ${row.sku}`, () => client.assets.upload("image", bytes, {
      filename,
      contentType,
      source: { id: row.image, name: row.source },
    }));
  })();

  uploadedAssets.set(row.image, task);
  try {
    return await task;
  } catch (error) {
    uploadedAssets.delete(row.image);
    throw error;
  }
}

await pooled(pending, 6, async (row) => {
  try {
    const product = productsBySku.get(row.sku);
    if (!product) {
      skipped += 1;
      return;
    }
    const asset = await uploadAsset(row);
    const image = { _key: hash(row.image).slice(0, 12), _type: "image", asset: { _type: "reference", _ref: asset._id }, sourceUrl: row.image };
    await retry(`Cleaver product image ${row.sku}`, () => client.patch(product._id).set({ images: [image], imageMigratedAt: new Date().toISOString() }).commit({ visibility: "async" }));
    completed += 1;
    if (completed <= 8 || completed % 25 === 0 || completed === pending.length) console.log(`[Cleaver images] published ${completed}/${pending.length}: ${row.sku}`);
  } catch (error) {
    failed += 1;
    console.warn(`[Cleaver images] ${row.sku}: ${error.message}`);
  }
});

const actual = await client.fetch(`count(*[_type == "product" && migrationKey == $migrationKey && defined(images[0].asset)])`, { migrationKey: MIGRATION_KEY });
console.log(JSON.stringify({ reviewedProducts: inventory.length, verifiedPhotographs: targetRows.length, previouslyPublished: targetRows.length - pending.length, uploaded: completed, skipped, failed, totalProductsWithManagedImages: actual, uniqueUploadedAssets: uploadedAssets.size }));
if (actual < 400 || failed > Math.max(10, pending.length * 0.1)) throw new Error(`Cleaver product image migration is incomplete: ${actual} images, ${failed} failures.`);
