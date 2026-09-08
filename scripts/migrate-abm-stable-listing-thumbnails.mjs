#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "next-sanity";

const CATALOG_FILE = path.resolve("data/abm-stable-cell-catalog.json");
const MAX_DIRECT_BYTES = 8 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const WIDTH = 320;
const HEIGHT = 320;
const CONCURRENCY = 3;

const projectId = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const dataset = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const apiVersion = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const token = [
  process.env.SANITY_WRITE_TOKEN,
  process.env.SANITY_API_WRITE_TOKEN,
  process.env.SANITY_API_TOKEN,
  process.env.SANITY_TOKEN,
  process.env.SANITY_AUTH_TOKEN,
].map((value) => String(value || "").trim()).find(Boolean) || "";

if (!token) throw new Error("No Sanity write token available");
if (!fs.existsSync(CATALOG_FILE)) throw new Error(`Stable catalog not found: ${CATALOG_FILE}`);

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
const products = Array.isArray(catalog?.products) ? catalog.products : [];
if (products.length !== Number(catalog?.expectedCount || 0)) {
  throw new Error(`Stable catalog count mismatch: products=${products.length} expected=${catalog?.expectedCount}`);
}

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isManaged(value) {
  try {
    const url = new URL(String(value || ""));
    return url.hostname === "cdn.sanity.io" && url.pathname.startsWith(`/images/${projectId}/`);
  } catch {
    return false;
  }
}

function isOfficial(value) {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase();
    return (host === "abmgood.com" || host === "www.abmgood.com")
      && ["http:", "https:"].includes(url.protocol)
      && /\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await sleep(500 * attempt);
  }
  throw lastError || new Error("fetch failed");
}

async function declaredSize(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchWithRetry(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0", accept: "image/*,*/*;q=0.8" },
    });
    return Number(response.headers.get("content-length") || 0);
  } catch {
    return 0;
  } finally {
    clearTimeout(timeout);
  }
}

async function download(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetchWithRetry(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0", accept: "image/*,*/*;q=0.8" },
    });
    const contentType = String(response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) throw new Error(`unexpected content-type ${contentType || "missing"}`);
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MAX_DOWNLOAD_BYTES) throw new Error(`source image exceeds ${MAX_DOWNLOAD_BYTES} bytes (${declared})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error("empty image response");
    if (buffer.length > MAX_DOWNLOAD_BYTES) throw new Error(`download exceeds ${MAX_DOWNLOAD_BYTES} bytes (${buffer.length})`);
    return buffer;
  } finally {
    clearTimeout(timeout);
  }
}

async function optimizeProduct(product) {
  const sku = String(product?.sku || "").trim();
  const sourceUrl = String(product?.previewImage || "").trim();
  if (!sku || !sourceUrl || isManaged(sourceUrl) || !isOfficial(sourceUrl)) {
    return { sku, status: isManaged(sourceUrl) ? "already-managed" : "skip", sourceUrl };
  }

  const size = await declaredSize(sourceUrl);
  if (size > 0 && size <= MAX_DIRECT_BYTES) return { sku, status: "direct", sourceUrl, size };

  const original = await download(sourceUrl);
  if (original.length <= MAX_DIRECT_BYTES) return { sku, status: "direct", sourceUrl, size: original.length };

  const optimized = await sharp(original, { failOn: "none" })
    .rotate()
    .resize({ width: WIDTH, height: HEIGHT, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  if (!optimized.length || optimized.length >= original.length) throw new Error(`${sku}: optimized thumbnail is invalid`);

  const asset = await client.assets.upload("image", optimized, {
    filename: `abm-stable-list-${sku.replace(/[^A-Za-z0-9_-]/g, "_")}.webp`,
    contentType: "image/webp",
  });
  if (!isManaged(asset?.url)) throw new Error(`${sku}: Sanity returned unmanaged thumbnail URL`);
  product.previewImage = asset.url;
  return {
    sku,
    status: "optimized",
    sourceUrl,
    originalBytes: original.length,
    optimizedBytes: optimized.length,
    managedUrl: asset.url,
  };
}

const candidates = products.filter((product) => {
  const preview = String(product?.previewImage || "").trim();
  return preview && !isManaged(preview) && isOfficial(preview);
});

const results = new Array(candidates.length);
let cursor = 0;
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, candidates.length)) }, async () => {
  while (true) {
    const index = cursor++;
    if (index >= candidates.length) return;
    const product = candidates[index];
    try {
      results[index] = await optimizeProduct(product);
    } catch (error) {
      results[index] = {
        sku: String(product?.sku || "").trim(),
        status: "error",
        sourceUrl: String(product?.previewImage || "").trim(),
        error: String(error?.message || error),
      };
    }
    if ((index + 1) % 100 === 0 || index + 1 === candidates.length) {
      console.log(`[stable listing media] checked ${index + 1}/${candidates.length}`);
    }
  }
}));

const optimized = results.filter((row) => row?.status === "optimized");
const errors = results.filter((row) => row?.status === "error");
const direct = results.filter((row) => row?.status === "direct");
const managedCount = products.filter((product) => isManaged(product?.previewImage)).length;
const officialDirectCount = products.filter((product) => isOfficial(product?.previewImage)).length;

catalog.media = {
  ...(catalog.media || {}),
  managedPreviewImageCount: managedCount,
  directOfficialPreviewImageCount: officialDirectCount,
  optimizedOversizedCount: optimized.length,
  thumbnailOptimizationErrors: errors.length,
  optimizedAt: new Date().toISOString(),
};
fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2) + "\n");

const report = {
  products: products.length,
  candidates: candidates.length,
  direct: direct.length,
  optimized: optimized.length,
  managedPreviewImageCount: managedCount,
  directOfficialPreviewImageCount: officialDirectCount,
  errors,
  optimizedSamples: optimized.slice(0, 20),
};
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
