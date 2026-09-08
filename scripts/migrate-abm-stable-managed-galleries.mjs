#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { createClient } from "next-sanity";
import sharp from "sharp";
import { parseAbmRebuildDetailV2 } from "../lib/abm/rebuild-parser-v2.mjs";

const CATALOG_FILE = path.resolve("data/abm-stable-cell-catalog.json");
const REPORT_DIR = path.resolve(".cache/abm-stable-gallery-migration");
const VERSION = String(process.env.ABM_REBUILD_VERSION || "2026-08-09-search-v5").trim();
const DETAIL_PREFIX = "abm-rebuild-detail-product-batch-stable-cell-lines-chunk-";
const PROJECT_ID = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const DATASET = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const API_VERSION = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const EXPECTED_PRODUCTS = 1102;
const FETCH_WORKERS = Math.max(1, Math.min(6, Number(process.env.STABLE_GALLERY_FETCH_WORKERS || 4) || 4));
const IMAGE_WORKERS = Math.max(1, Math.min(5, Number(process.env.STABLE_GALLERY_IMAGE_WORKERS || 3) || 3));
const GAP_MS = Math.max(100, Number(process.env.STABLE_GALLERY_GAP_MS || 250) || 250);
const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
const DETAIL_IMAGE_SIZE = 1600;
const DETAIL_WEBP_QUALITY = 90;
const USER_AGENT = "Mozilla/5.0 (compatible; ITSBIO-StableGalleryMigration/1.0)";

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
if (!Array.isArray(catalog.products) || catalog.products.length !== EXPECTED_PRODUCTS) {
  throw new Error(`Expected ${EXPECTED_PRODUCTS} Stable products, got ${catalog.products?.length || 0}`);
}

const client = createClient({ projectId: PROJECT_ID, dataset: DATASET, apiVersion: API_VERSION, token, useCdn: false });
const clean = (v) => String(v || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const normalizeSku = (v) => clean(v).toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arraysEqual = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);

function isManagedImage(value) {
  try {
    const u = new URL(clean(value));
    return u.hostname === "cdn.sanity.io" && u.pathname.startsWith(`/images/${PROJECT_ID}/`);
  } catch { return false; }
}

function officialImageUrl(value, baseUrl) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const u = new URL(raw, baseUrl || "https://www.abmgood.com");
    const host = u.hostname.toLowerCase();
    if (host !== "abmgood.com" && !host.endsWith(".abmgood.com")) return "";
    if (!["http:", "https:"].includes(u.protocol)) return "";
    if (!/\/assets\/product\//i.test(u.pathname)) return "";
    u.protocol = "https:";
    u.hash = "";
    return u.toString();
  } catch { return ""; }
}

async function fetchWithRetry(url, { accept = "*/*", timeoutMs = 45_000, attempts = 6 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await sleep(GAP_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept, "accept-language": "en-US,en;q=0.9" },
      });
      clearTimeout(timer);
      if (response.status === 429 || response.status === 408 || response.status >= 500) {
        lastError = new Error(`${url}: HTTP ${response.status}`);
        const retryAfter = Number(response.headers.get("retry-after") || 0);
        await sleep(Math.max(retryAfter * 1000, 1200 * attempt));
        continue;
      }
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < attempts) await sleep(1000 * attempt);
    }
  }
  throw lastError || new Error(`${url}: fetch failed`);
}

async function fetchOfficialGallery(product, index) {
  const sku = clean(product.sku);
  const sourceUrl = clean(product.sourceUrl);
  try {
    const response = await fetchWithRetry(sourceUrl, { accept: "text/html,application/xhtml+xml", timeoutMs: 40_000, attempts: 7 });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const finalUrl = response.url || sourceUrl;
    const detail = parseAbmRebuildDetailV2(html, finalUrl, {
      sku,
      title: clean(product.title),
      url: sourceUrl,
      unit: clean(product.unit),
      kind: "product",
    });
    const officialGalleryImages = [...new Set((Array.isArray(detail.images) ? detail.images : [])
      .map((url) => officialImageUrl(url, finalUrl)).filter(Boolean))];
    if ((index + 1) % 50 === 0) console.log(`[stable galleries] fetched ${index + 1}/${EXPECTED_PRODUCTS}`);
    return { sku, sourceUrl, officialGalleryImages, status: "ok" };
  } catch (error) {
    return { sku, sourceUrl, officialGalleryImages: [], status: "error", error: String(error?.stack || error) };
  }
}

async function downloadAndOptimize(sourceUrl) {
  const response = await fetchWithRetry(sourceUrl, {
    accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    timeoutMs: 75_000,
    attempts: 6,
  });
  if (!response.ok) throw new Error(`${sourceUrl}: HTTP ${response.status}`);
  const contentType = clean(response.headers.get("content-type")).toLowerCase();
  if (!contentType.startsWith("image/")) throw new Error(`${sourceUrl}: unexpected content-type ${contentType || "missing"}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_SOURCE_BYTES) throw new Error(`${sourceUrl}: source exceeds ${MAX_SOURCE_BYTES} bytes`);
  const source = Buffer.from(await response.arrayBuffer());
  if (!source.length || source.length > MAX_SOURCE_BYTES) throw new Error(`${sourceUrl}: invalid source size ${source.length}`);
  const output = await sharp(source, { failOn: "none", animated: false })
    .rotate()
    .resize({ width: DETAIL_IMAGE_SIZE, height: DETAIL_IMAGE_SIZE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: DETAIL_WEBP_QUALITY, effort: 4 })
    .toBuffer();
  if (output.length < 500) throw new Error(`${sourceUrl}: optimized output too small (${output.length})`);
  return output;
}

async function uploadGalleryImage(sku, index, bytes) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const safeSku = clean(sku).replace(/[^A-Za-z0-9._-]+/g, "-");
      const asset = await client.assets.upload("image", bytes, { filename: `abm-stable-${safeSku}-gallery-${String(index + 1).padStart(2, "0")}.webp` });
      if (!isManagedImage(asset?.url)) throw new Error(`${sku}: Sanity returned invalid managed URL`);
      return asset.url;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(1200 * attempt);
    }
  }
  throw lastError;
}

async function pool(items, workers, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try { out[i] = await fn(items[i], i); }
      catch (error) { out[i] = { status: "error", error: String(error?.stack || error), sku: clean(items[i]?.sku) }; }
    }
  }));
  return out;
}

fs.mkdirSync(REPORT_DIR, { recursive: true });
console.log(`[stable galleries] census ${EXPECTED_PRODUCTS} official product pages`);
const galleryRows = await pool(catalog.products, FETCH_WORKERS, fetchOfficialGallery);
const fetchErrors = galleryRows.filter((r) => r.status !== "ok");
const noImages = galleryRows.filter((r) => r.status === "ok" && r.officialGalleryImages.length === 0);
const suspicious = galleryRows.filter((r) => r.status === "ok" && r.officialGalleryImages.length > 12);
const distribution = {};
for (const row of galleryRows.filter((r) => r.status === "ok")) {
  const n = row.officialGalleryImages.length;
  distribution[n] = (distribution[n] || 0) + 1;
}
const totalOfficialImages = galleryRows.reduce((n, row) => n + (row.officialGalleryImages?.length || 0), 0);
const preflight = {
  products: galleryRows.length,
  fetchErrors: fetchErrors.length,
  noImages: noImages.length,
  suspiciousOver12: suspicious.map((r) => ({ sku: r.sku, count: r.officialGalleryImages.length })),
  totalOfficialGalleryImages: totalOfficialImages,
  productsWithMultipleImages: galleryRows.filter((r) => (r.officialGalleryImages?.length || 0) > 1).length,
  distribution,
};
fs.writeFileSync(path.join(REPORT_DIR, "official-gallery-census.json"), JSON.stringify({ summary: preflight, rows: galleryRows }, null, 2));
console.log(JSON.stringify(preflight, null, 2));
if (fetchErrors.length || noImages.length || suspicious.length) {
  throw new Error(`Stable gallery preflight failed: fetchErrors=${fetchErrors.length}, noImages=${noImages.length}, suspicious=${suspicious.length}`);
}

const galleryBySku = new Map(galleryRows.map((r) => [normalizeSku(r.sku), r.officialGalleryImages]));
const existingProductBySku = new Map(catalog.products.map((p) => [normalizeSku(p.sku), p]));
const uploadedBySource = new Map();
let imageProgress = 0;

async function migrateGallery(product) {
  const sku = clean(product.sku);
  const officialGalleryImages = galleryBySku.get(normalizeSku(sku)) || [];
  const previousOfficial = Array.isArray(product.officialGalleryImages) ? product.officialGalleryImages : [];
  const previousManaged = Array.isArray(product.managedGalleryImages) ? product.managedGalleryImages : [];
  if (arraysEqual(previousOfficial, officialGalleryImages) && previousManaged.length === officialGalleryImages.length && previousManaged.every(isManagedImage)) {
    imageProgress += officialGalleryImages.length;
    return { sku, officialGalleryImages, managedGalleryImages: previousManaged, reused: true, status: "ok" };
  }

  const managedGalleryImages = [];
  for (let i = 0; i < officialGalleryImages.length; i++) {
    const sourceUrl = officialGalleryImages[i];
    try {
      let task = uploadedBySource.get(sourceUrl);
      if (!task) {
        task = (async () => {
          const bytes = await downloadAndOptimize(sourceUrl);
          return await uploadGalleryImage(sku, i, bytes);
        })();
        uploadedBySource.set(sourceUrl, task);
      }
      const managedUrl = await task;
      managedGalleryImages.push(managedUrl);
      imageProgress += 1;
      if (imageProgress % 100 === 0 || imageProgress === totalOfficialImages) {
        console.log(`[stable galleries] managed images ${imageProgress}/${totalOfficialImages}`);
      }
    } catch (error) {
      uploadedBySource.delete(sourceUrl);
      return { sku, officialGalleryImages, managedGalleryImages, reused: false, status: "error", failedSourceUrl: sourceUrl, error: String(error?.stack || error) };
    }
  }
  return { sku, officialGalleryImages, managedGalleryImages, reused: false, status: "ok" };
}

console.log(`[stable galleries] migrating ${totalOfficialImages} full-detail images at ${DETAIL_IMAGE_SIZE}px quality=${DETAIL_WEBP_QUALITY}`);
const migrationRows = await pool(catalog.products, IMAGE_WORKERS, migrateGallery);
const migrationErrors = migrationRows.filter((r) => r.status !== "ok");
fs.writeFileSync(path.join(REPORT_DIR, "migration-results.json"), JSON.stringify(migrationRows, null, 2));
if (migrationErrors.length) {
  console.error(migrationErrors.slice(0, 20));
  throw new Error(`Stable gallery image migration failed for ${migrationErrors.length} products`);
}

const migratedBySku = new Map(migrationRows.map((r) => [normalizeSku(r.sku), r]));
for (const product of catalog.products) {
  const migrated = migratedBySku.get(normalizeSku(product.sku));
  if (!migrated) throw new Error(`${product.sku}: missing migrated gallery result`);
  product.officialGalleryImages = migrated.officialGalleryImages;
  product.managedGalleryImages = migrated.managedGalleryImages;
}
catalog.media = {
  ...(catalog.media || {}),
  totalOfficialGalleryImages: totalOfficialImages,
  productsWithMultipleGalleryImages: preflight.productsWithMultipleImages,
  galleryDistribution: distribution,
  managedGalleryImages: totalOfficialImages,
  managedGalleryMigratedAt: new Date().toISOString(),
  detailGalleryImageSize: DETAIL_IMAGE_SIZE,
  detailGalleryWebpQuality: DETAIL_WEBP_QUALITY,
};

const docs = await client.fetch(`*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
  && string::startsWith(_id, $prefix)
] | order(_id asc) {_id, records}`, { version: VERSION, prefix: DETAIL_PREFIX });
let patchedRecords = 0;
for (let docIndex = 0; docIndex < docs.length; docIndex++) {
  const doc = docs[docIndex];
  const nextRecords = (Array.isArray(doc.records) ? doc.records : []).map((record) => {
    const sku = normalizeSku(record?.sku || String(record?.key || "").replace(/^product:/i, ""));
    const product = existingProductBySku.get(sku);
    const migrated = migratedBySku.get(sku);
    if (!product || !migrated) throw new Error(`${sku}: Stable detail record not found in catalog/migration`);
    const images = migrated.managedGalleryImages;
    patchedRecords += 1;
    return {
      ...record,
      images,
      previewImage: images[0],
      verification: {
        ...(record?.verification || {}),
        hasOfficialImages: images.length > 0,
        mediaDeferred: false,
        officialGalleryImageCount: migrated.officialGalleryImages.length,
        managedGalleryImageCount: images.length,
      },
    };
  });
  await client.patch(doc._id).set({ records: nextRecords }).commit();
  if ((docIndex + 1) % 10 === 0 || docIndex === docs.length - 1) {
    console.log(`[stable galleries] patched Sanity chunks ${docIndex + 1}/${docs.length}`);
  }
}
if (patchedRecords !== EXPECTED_PRODUCTS) throw new Error(`Stable detail patch count mismatch: ${patchedRecords}/${EXPECTED_PRODUCTS}`);

const verificationRows = await client.fetch(`*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
  && string::startsWith(_id, $prefix)
].records[]{sku, images, previewImage, verification}`, { version: VERSION, prefix: DETAIL_PREFIX });
if (verificationRows.length !== EXPECTED_PRODUCTS) throw new Error(`Stable verification rows mismatch: ${verificationRows.length}/${EXPECTED_PRODUCTS}`);

const verificationErrors = [];
let verifiedImages = 0;
for (const row of verificationRows) {
  const sku = normalizeSku(row.sku);
  const migrated = migratedBySku.get(sku);
  const images = Array.isArray(row.images) ? row.images : [];
  if (!migrated || !arraysEqual(images, migrated.managedGalleryImages) || !images.every(isManagedImage) || row.previewImage !== images[0]) {
    verificationErrors.push({ sku: row.sku, expected: migrated?.managedGalleryImages?.length || 0, got: images.length });
    continue;
  }
  if (row?.verification?.officialGalleryImageCount !== migrated.officialGalleryImages.length || row?.verification?.managedGalleryImageCount !== images.length) {
    verificationErrors.push({ sku: row.sku, reason: "verification counts differ" });
    continue;
  }
  verifiedImages += images.length;
}
if (verificationErrors.length || verifiedImages !== totalOfficialImages) {
  console.error(verificationErrors.slice(0, 30));
  throw new Error(`Stable gallery Sanity verification failed: productErrors=${verificationErrors.length}, verifiedImages=${verifiedImages}/${totalOfficialImages}`);
}

fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2) + "\n");
const finalSummary = {
  products: EXPECTED_PRODUCTS,
  totalOfficialGalleryImages: totalOfficialImages,
  totalManagedGalleryImages: verifiedImages,
  productsWithMultipleImages: preflight.productsWithMultipleImages,
  maxImagesPerProduct: Math.max(...galleryRows.map((r) => r.officialGalleryImages.length)),
  distribution,
  sanityRecords: verificationRows.length,
  mismatches: 0,
  output: CATALOG_FILE,
};
fs.writeFileSync(path.join(REPORT_DIR, "summary.json"), JSON.stringify(finalSummary, null, 2));
console.log(JSON.stringify(finalSummary, null, 2));
