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
const EXPECTED_TOTAL_IMAGES = 1581;
const EXPECTED_MULTI_PRODUCTS = 372;
const FETCH_WORKERS = Math.max(1, Math.min(6, Number(process.env.STABLE_GALLERY_FETCH_WORKERS || 4) || 4));
const IMAGE_WORKERS = Math.max(1, Math.min(5, Number(process.env.STABLE_GALLERY_IMAGE_WORKERS || 3) || 3));
const GAP_MS = Math.max(100, Number(process.env.STABLE_GALLERY_GAP_MS || 250) || 250);
const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
const DETAIL_IMAGE_SIZE = 1600;
const DETAIL_WEBP_QUALITY = 90;
const USER_AGENT = "Mozilla/5.0 (compatible; ITSBIO-StableGalleryMigration/2.0)";

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
const skuKey = (v) => clean(v).toLowerCase();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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

async function fetchWithRetry(url, { accept = "*/*", timeoutMs = 45_000, attempts = 7 } = {}) {
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

async function collectGallery(product, index) {
  const sku = clean(product.sku);
  const sourceUrl = clean(product.sourceUrl);
  try {
    const response = await fetchWithRetry(sourceUrl, { accept: "text/html,application/xhtml+xml", timeoutMs: 40_000 });
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
    let officialGalleryImages = [...new Set((Array.isArray(detail.images) ? detail.images : [])
      .map((url) => officialImageUrl(url, finalUrl)).filter(Boolean))];
    let fallbackFromListing = false;
    if (!officialGalleryImages.length) {
      const listingImage = officialImageUrl(product.previewImage, sourceUrl);
      if (listingImage) {
        officialGalleryImages = [listingImage];
        fallbackFromListing = true;
      }
    }
    if ((index + 1) % 50 === 0) console.log(`[stable galleries] fetched ${index + 1}/${EXPECTED_PRODUCTS}`);
    return { sku, sourceUrl, officialGalleryImages, fallbackFromListing, status: "ok" };
  } catch (error) {
    return { sku, sourceUrl, officialGalleryImages: [], fallbackFromListing: false, status: "error", error: String(error?.stack || error) };
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

async function uploadImage(sku, imageIndex, bytes) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const safeSku = clean(sku).replace(/[^A-Za-z0-9._-]+/g, "-");
      const asset = await client.assets.upload("image", bytes, {
        filename: `abm-stable-${safeSku}-gallery-${String(imageIndex + 1).padStart(2, "0")}.webp`,
      });
      if (!isManagedImage(asset?.url)) throw new Error(`${sku}: Sanity returned invalid image URL`);
      return asset.url;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(1200 * attempt);
    }
  }
  throw lastError;
}

async function pool(items, workers, fn) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try { output[index] = await fn(items[index], index); }
      catch (error) { output[index] = { sku: clean(items[index]?.sku), status: "error", error: String(error?.stack || error) }; }
    }
  }));
  return output;
}

fs.mkdirSync(REPORT_DIR, { recursive: true });
console.log(`[stable galleries] collecting all ${EXPECTED_PRODUCTS} official galleries`);
const galleryRows = await pool(catalog.products, FETCH_WORKERS, collectGallery);
const errors = galleryRows.filter((row) => row.status !== "ok");
const noImages = galleryRows.filter((row) => row.status === "ok" && !row.officialGalleryImages.length);
const suspicious = galleryRows.filter((row) => row.officialGalleryImages?.length > 8);
const distribution = {};
for (const row of galleryRows.filter((row) => row.status === "ok")) {
  const n = row.officialGalleryImages.length;
  distribution[n] = (distribution[n] || 0) + 1;
}
const totalImages = galleryRows.reduce((sum, row) => sum + (row.officialGalleryImages?.length || 0), 0);
const multiProducts = galleryRows.filter((row) => (row.officialGalleryImages?.length || 0) > 1).length;
const listingFallbacks = galleryRows.filter((row) => row.fallbackFromListing).map((row) => row.sku);
const preflight = {
  products: galleryRows.length,
  errors: errors.length,
  noImages: noImages.length,
  totalOfficialGalleryImages: totalImages,
  productsWithMultipleImages: multiProducts,
  listingFallbacks,
  maxImagesPerProduct: Math.max(...galleryRows.map((row) => row.officialGalleryImages?.length || 0)),
  distribution,
  suspiciousOver8: suspicious.map((row) => ({ sku: row.sku, count: row.officialGalleryImages.length })),
};
fs.writeFileSync(path.join(REPORT_DIR, "official-gallery-census.json"), JSON.stringify({ summary: preflight, rows: galleryRows }, null, 2));
console.log(JSON.stringify(preflight, null, 2));
if (errors.length || noImages.length || suspicious.length) throw new Error(`Stable gallery preflight failed errors=${errors.length} noImages=${noImages.length} suspicious=${suspicious.length}`);
if (totalImages !== EXPECTED_TOTAL_IMAGES || multiProducts !== EXPECTED_MULTI_PRODUCTS || listingFallbacks.length !== 2) {
  throw new Error(`Stable gallery census changed: images=${totalImages}/${EXPECTED_TOTAL_IMAGES}, multi=${multiProducts}/${EXPECTED_MULTI_PRODUCTS}, listingFallbacks=${listingFallbacks.length}/2`);
}

const galleryBySku = new Map(galleryRows.map((row) => [skuKey(row.sku), row]));
const uploadedBySource = new Map();
let managedProgress = 0;

async function migrateProduct(product) {
  const sku = clean(product.sku);
  const gallery = galleryBySku.get(skuKey(sku));
  if (!gallery) return { sku, status: "error", error: "gallery census row missing" };
  const officialGalleryImages = gallery.officialGalleryImages;
  const previousOfficial = Array.isArray(product.officialGalleryImages) ? product.officialGalleryImages : [];
  const previousManaged = Array.isArray(product.managedGalleryImages) ? product.managedGalleryImages : [];

  if (arraysEqual(previousOfficial, officialGalleryImages) && previousManaged.length === officialGalleryImages.length && previousManaged.every(isManagedImage)) {
    managedProgress += previousManaged.length;
    return { sku, officialGalleryImages, managedGalleryImages: previousManaged, reused: true, status: "ok" };
  }

  // Single-image products already have a verified managed preview from the first Stable media pass.
  // Reuse it only when it represents the exact same official source image. Multi-image products
  // are rebuilt at 1600 px so microscopy/figure galleries remain sharp.
  const listingSource = officialImageUrl(product.previewImage, product.sourceUrl);
  if (officialGalleryImages.length === 1 && listingSource === officialGalleryImages[0] && isManagedImage(product.managedPreviewImage)) {
    managedProgress += 1;
    return { sku, officialGalleryImages, managedGalleryImages: [product.managedPreviewImage], reused: true, status: "ok" };
  }

  const managedGalleryImages = [];
  for (let imageIndex = 0; imageIndex < officialGalleryImages.length; imageIndex++) {
    const sourceUrl = officialGalleryImages[imageIndex];
    try {
      let task = uploadedBySource.get(sourceUrl);
      if (!task) {
        task = (async () => {
          const bytes = await downloadAndOptimize(sourceUrl);
          return await uploadImage(sku, imageIndex, bytes);
        })();
        uploadedBySource.set(sourceUrl, task);
      }
      managedGalleryImages.push(await task);
      managedProgress += 1;
      if (managedProgress % 100 === 0 || managedProgress === EXPECTED_TOTAL_IMAGES) {
        console.log(`[stable galleries] managed ${managedProgress}/${EXPECTED_TOTAL_IMAGES}`);
      }
    } catch (error) {
      uploadedBySource.delete(sourceUrl);
      return { sku, officialGalleryImages, managedGalleryImages, status: "error", failedSourceUrl: sourceUrl, error: String(error?.stack || error) };
    }
  }
  return { sku, officialGalleryImages, managedGalleryImages, reused: false, status: "ok" };
}

console.log(`[stable galleries] migrating full galleries; multi-image products use ${DETAIL_IMAGE_SIZE}px WebP quality ${DETAIL_WEBP_QUALITY}`);
const migrationRows = await pool(catalog.products, IMAGE_WORKERS, migrateProduct);
const migrationErrors = migrationRows.filter((row) => row.status !== "ok");
fs.writeFileSync(path.join(REPORT_DIR, "migration-results.json"), JSON.stringify(migrationRows, null, 2));
if (migrationErrors.length) {
  console.error(migrationErrors.slice(0, 20));
  throw new Error(`Stable gallery migration failed for ${migrationErrors.length} products`);
}

const migratedBySku = new Map(migrationRows.map((row) => [skuKey(row.sku), row]));
for (const product of catalog.products) {
  const migrated = migratedBySku.get(skuKey(product.sku));
  if (!migrated || migrated.managedGalleryImages.length !== migrated.officialGalleryImages.length || !migrated.managedGalleryImages.every(isManagedImage)) {
    throw new Error(`${product.sku}: invalid final gallery mapping`);
  }
  product.officialGalleryImages = migrated.officialGalleryImages;
  product.managedGalleryImages = migrated.managedGalleryImages;
}
catalog.media = {
  ...(catalog.media || {}),
  totalOfficialGalleryImages: EXPECTED_TOTAL_IMAGES,
  managedGalleryImages: EXPECTED_TOTAL_IMAGES,
  productsWithMultipleGalleryImages: EXPECTED_MULTI_PRODUCTS,
  galleryDistribution: distribution,
  galleryListingFallbackSkus: listingFallbacks,
  managedGalleryMigratedAt: new Date().toISOString(),
  multiImageDetailGalleryTargetSize: DETAIL_IMAGE_SIZE,
  multiImageDetailGalleryWebpQuality: DETAIL_WEBP_QUALITY,
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
    const sku = skuKey(record?.sku || String(record?.key || "").replace(/^product:/i, ""));
    const migrated = migratedBySku.get(sku);
    if (!migrated) throw new Error(`${sku}: no gallery migration row for Sanity record`);
    const images = migrated.managedGalleryImages;
    patchedRecords += 1;
    return {
      ...record,
      images,
      previewImage: images[0],
      verification: {
        ...(record?.verification || {}),
        hasOfficialImages: true,
        mediaDeferred: false,
        officialGalleryImageCount: migrated.officialGalleryImages.length,
        managedGalleryImageCount: images.length,
      },
    };
  });
  await client.patch(doc._id).set({ records: nextRecords }).commit();
  if ((docIndex + 1) % 10 === 0 || docIndex === docs.length - 1) console.log(`[stable galleries] patched Sanity chunks ${docIndex + 1}/${docs.length}`);
}
if (patchedRecords !== EXPECTED_PRODUCTS) throw new Error(`Stable detail patch count ${patchedRecords}/${EXPECTED_PRODUCTS}`);

const verificationRows = await client.fetch(`*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
  && string::startsWith(_id, $prefix)
].records[]{sku, images, previewImage, verification}`, { version: VERSION, prefix: DETAIL_PREFIX });
if (verificationRows.length !== EXPECTED_PRODUCTS) throw new Error(`Sanity Stable rows ${verificationRows.length}/${EXPECTED_PRODUCTS}`);
let verifiedImages = 0;
const verifyErrors = [];
for (const row of verificationRows) {
  const migrated = migratedBySku.get(skuKey(row.sku));
  const images = Array.isArray(row.images) ? row.images : [];
  if (!migrated || !arraysEqual(images, migrated.managedGalleryImages) || !images.every(isManagedImage) || row.previewImage !== images[0]) {
    verifyErrors.push({ sku: row.sku, expected: migrated?.managedGalleryImages?.length || 0, got: images.length });
    continue;
  }
  if (row?.verification?.officialGalleryImageCount !== migrated.officialGalleryImages.length || row?.verification?.managedGalleryImageCount !== images.length) {
    verifyErrors.push({ sku: row.sku, reason: "verification counts differ" });
    continue;
  }
  verifiedImages += images.length;
}
if (verifyErrors.length || verifiedImages !== EXPECTED_TOTAL_IMAGES) {
  console.error(verifyErrors.slice(0, 30));
  throw new Error(`Stable gallery Sanity verification failed products=${verifyErrors.length}, images=${verifiedImages}/${EXPECTED_TOTAL_IMAGES}`);
}

const t6352 = migratedBySku.get("t6352");
if (!t6352 || t6352.officialGalleryImages.length !== 3 || t6352.managedGalleryImages.length !== 3) throw new Error("T6352 must finish with exactly 3 gallery images");

fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2) + "\n");
const summary = {
  products: EXPECTED_PRODUCTS,
  officialGalleryImages: EXPECTED_TOTAL_IMAGES,
  managedGalleryImages: verifiedImages,
  productsWithMultipleImages: EXPECTED_MULTI_PRODUCTS,
  maxImagesPerProduct: preflight.maxImagesPerProduct,
  distribution,
  listingFallbacks,
  sanityRecords: verificationRows.length,
  t6352GalleryImages: t6352.managedGalleryImages.length,
  mismatches: 0,
};
fs.writeFileSync(path.join(REPORT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
