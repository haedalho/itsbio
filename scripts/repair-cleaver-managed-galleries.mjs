#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");

const MIGRATION_KEY = "cleaver-products-2026-08-24";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const SOURCE_HOSTS = new Set(["www.thistlescientific.com", "thistlescientific.com"]);
const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");

const sourceMap = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-source-map.json"), "utf8"));
const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim()).find(Boolean);
if (!token) throw new Error("Cleaver gallery repair requires a Production Sanity write token.");

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

function canonicalImageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!SOURCE_HOSTS.has(url.hostname)) return "";
    url.hash = "";
    url.searchParams.delete("w");
    url.searchParams.delete("width");
    url.searchParams.delete("h");
    url.searchParams.delete("height");
    url.pathname = url.pathname.replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+$)/i, "");
    return url.toString();
  } catch {
    return "";
  }
}

async function retry(label, operation, maximum = 5) {
  for (let attempt = 0; attempt < maximum; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = Number(error?.statusCode || error?.response?.statusCode || 0);
      if (attempt === maximum - 1 || (status && status < 500 && status !== 408 && status !== 409 && status !== 429)) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(15_000, 750 * (2 ** attempt))));
    }
  }
  throw new Error(`Retry exhausted: ${label}`);
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

const products = await client.fetch(`*[_type == "product" && migrationKey == $key]{
  _id, sku,
  images[]{_key, sourceUrl, "assetId":asset->_id}
}`, { key: MIGRATION_KEY });
const bySku = new Map((products || []).map((product) => [normalizeSku(product.sku), product]));
const targets = Object.entries(sourceMap || {})
  .map(([rawSku, identity]) => ({ sku: normalizeSku(rawSku), identity, product: bySku.get(normalizeSku(rawSku)) }))
  .filter((entry) => entry.product && Array.isArray(entry.identity?.images) && entry.identity.images.length);

const assetByUrl = new Map();
for (const product of products || []) {
  for (const image of product.images || []) {
    const sourceUrl = canonicalImageUrl(image?.sourceUrl);
    if (sourceUrl && image?.assetId && !assetByUrl.has(sourceUrl)) assetByUrl.set(sourceUrl, Promise.resolve({ _id: image.assetId }));
  }
}

let uploads = 0;
let reusedAssets = 0;
let productsReordered = 0;
let failures = 0;
const failed = [];

async function managedAsset(rawUrl, sku) {
  const url = canonicalImageUrl(rawUrl);
  if (!url) throw new Error(`Invalid manufacturer image URL: ${rawUrl}`);
  if (assetByUrl.has(url)) {
    reusedAssets += 1;
    return assetByUrl.get(url);
  }

  const task = retry(`download ${sku}`, async () => {
    const response = await fetch(url, {
      headers: { Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8", "User-Agent": "ITS-BIO-CleaverGalleryRepair/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw Object.assign(new Error(`image HTTP ${response.status}`), { statusCode: response.status });
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const declared = Number.parseInt(response.headers.get("content-length") || "0", 10);
    if (!contentType.startsWith("image/") || declared > MAX_IMAGE_BYTES) throw new Error(`Unsupported image response for ${url}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1200 || bytes.length > MAX_IMAGE_BYTES) throw new Error(`Invalid image size ${bytes.length} for ${url}`);
    const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : contentType.includes("gif") ? "gif" : "jpg";
    const filename = `cleaver-source-${hash(url).slice(0, 16)}.${extension}`;
    const asset = await retry(`upload ${sku}`, () => client.assets.upload("image", bytes, {
      filename,
      contentType,
      source: { id: url, name: "Cleaver / Thistle manufacturer gallery" },
    }));
    uploads += 1;
    return asset;
  });

  assetByUrl.set(url, task);
  try {
    return await task;
  } catch (error) {
    assetByUrl.delete(url);
    throw error;
  }
}

await pooled(targets, 4, async ({ sku, identity, product }) => {
  try {
    const sourceUrls = Array.from(new Set((identity.images || []).map(canonicalImageUrl).filter(Boolean))).slice(0, 8);
    const existing = Array.isArray(product.images) ? product.images : [];
    const existingBySource = new Map(existing.map((image) => [canonicalImageUrl(image?.sourceUrl), image]).filter(([url]) => Boolean(url)));
    const nextImages = [];

    for (const sourceUrl of sourceUrls) {
      const prior = existingBySource.get(sourceUrl);
      if (prior?.assetId) {
        nextImages.push({
          _key: prior._key || hash(`${sku}:${sourceUrl}`).slice(0, 12),
          _type: "image",
          asset: { _type: "reference", _ref: prior.assetId },
          sourceUrl,
        });
        continue;
      }
      const asset = await managedAsset(sourceUrl, sku);
      nextImages.push({
        _key: hash(`${sku}:${sourceUrl}`).slice(0, 12),
        _type: "image",
        asset: { _type: "reference", _ref: asset._id },
        sourceUrl,
      });
    }

    for (const image of existing) {
      if (nextImages.length >= 10) break;
      if (!image?.assetId) continue;
      const sourceUrl = String(image.sourceUrl || "").trim();
      const normalized = canonicalImageUrl(sourceUrl);
      if (normalized && sourceUrls.includes(normalized)) continue;
      if (nextImages.some((candidate) => candidate.asset._ref === image.assetId)) continue;
      nextImages.push({
        _key: image._key || hash(`${sku}:${image.assetId}`).slice(0, 12),
        _type: "image",
        asset: { _type: "reference", _ref: image.assetId },
        ...(sourceUrl ? { sourceUrl } : {}),
      });
    }

    if (!nextImages.length) return;
    await retry(`patch gallery ${sku}`, () => client.patch(product._id).set({
      images: nextImages,
      detailedContentMigratedAt: new Date().toISOString(),
    }).commit({ visibility: "async" }));
    productsReordered += 1;
  } catch (error) {
    failures += 1;
    if (failed.length < 20) failed.push({ sku, error: error instanceof Error ? error.message : String(error) });
    console.warn(`[Cleaver gallery repair] ${sku}: ${error instanceof Error ? error.message : String(error)}`);
  }
});

const totals = await client.fetch(`{
  "products": count(*[_type == "product" && migrationKey == $key]),
  "withAnyImage": count(*[_type == "product" && migrationKey == $key && count(images) > 0]),
  "withGallery": count(*[_type == "product" && migrationKey == $key && count(images) > 1])
}`, { key: MIGRATION_KEY });

console.log(JSON.stringify({
  sourceMappedWithImages: targets.length,
  productsReordered,
  uploads,
  reusedAssets,
  failures,
  firstFailures: failed,
  totals,
}));

if (failures > Math.max(20, targets.length * 0.05)) throw new Error(`Cleaver managed gallery repair had too many failures: ${failures}`);
