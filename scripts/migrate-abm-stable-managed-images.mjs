#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { createClient } from "next-sanity";
import sharp from "sharp";

import { parseAbmRebuildDetailV2 } from "../lib/abm/rebuild-parser-v2.mjs";

const CATALOG_FILE = path.resolve("data/abm-stable-cell-catalog.json");
const VERSION = String(process.env.ABM_REBUILD_VERSION || "2026-08-09-search-v5").trim();
const DETAIL_PREFIX = "abm-rebuild-detail-product-batch-stable-cell-lines-chunk-";
const PROJECT_ID = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const DATASET = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const API_VERSION = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const EXPECTED_PRODUCTS = 1102;
const EXPECTED_WITH_IMAGE = 1100;
const CONCURRENCY = Math.max(1, Math.min(6, Number(process.env.STABLE_IMAGE_CONCURRENCY || 5) || 5));
const MAX_SOURCE_BYTES = 80 * 1024 * 1024;
const TARGET_SIZE = 640;
const WEBP_QUALITY = 82;
const USER_AGENT = "Mozilla/5.0 (compatible; ITSBIO-StableImageMigration/1.0)";

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

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token,
  useCdn: false,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const normalizeSku = (value) => clean(value).toLowerCase();

function isManagedImage(value) {
  try {
    const url = new URL(clean(value));
    return url.hostname === "cdn.sanity.io" && url.pathname.startsWith(`/images/${PROJECT_ID}/`);
  } catch {
    return false;
  }
}

function officialImageUrl(value, baseUrl = "https://www.abmgood.com") {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw, baseUrl);
    const host = url.hostname.toLowerCase();
    if (host !== "abmgood.com" && !host.endsWith(".abmgood.com")) return "";
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.protocol = "https:";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

async function fetchWithRetry(url, { accept, timeoutMs = 45_000, attempts = 5 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: accept || "*/*",
          "accept-language": "en-US,en;q=0.9",
        },
      });
      clearTimeout(timer);
      if (response.status === 404 || response.status === 410) return response;
      if (response.status === 429 || response.status === 408 || response.status >= 500) {
        lastError = new Error(`${url}: HTTP ${response.status}`);
        const retryAfter = Number(response.headers.get("retry-after") || 0);
        await sleep(Math.max(retryAfter * 1000, 800 * attempt * attempt));
        continue;
      }
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < attempts) await sleep(800 * attempt * attempt);
    }
  }
  throw lastError || new Error(`${url}: fetch failed`);
}

async function fetchDetailImageCandidates(product) {
  const sourceUrl = clean(product.sourceUrl);
  if (!sourceUrl) return [];
  const response = await fetchWithRetry(sourceUrl, {
    accept: "text/html,application/xhtml+xml",
    timeoutMs: 35_000,
    attempts: 6,
  });
  if (!response.ok) throw new Error(`${product.sku}: detail page HTTP ${response.status}`);
  const html = await response.text();
  const finalUrl = response.url || sourceUrl;
  const detail = parseAbmRebuildDetailV2(html, finalUrl, {
    sku: clean(product.sku),
    title: clean(product.title),
    url: sourceUrl,
    unit: clean(product.unit),
    kind: "product",
  });
  return Array.from(new Set((Array.isArray(detail?.images) ? detail.images : [])
    .map((url) => officialImageUrl(url, finalUrl))
    .filter(Boolean)));
}

async function downloadAndOptimize(sourceUrl) {
  const response = await fetchWithRetry(sourceUrl, {
    accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    timeoutMs: 60_000,
    attempts: 5,
  });
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) throw new Error(`${sourceUrl}: HTTP ${response.status}`);

  const contentType = clean(response.headers.get("content-type")).toLowerCase();
  if (!contentType.startsWith("image/")) throw new Error(`${sourceUrl}: unexpected content-type ${contentType || "missing"}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_SOURCE_BYTES) throw new Error(`${sourceUrl}: source image exceeds ${MAX_SOURCE_BYTES} bytes`);

  const source = Buffer.from(await response.arrayBuffer());
  if (!source.length) throw new Error(`${sourceUrl}: empty image`);
  if (source.length > MAX_SOURCE_BYTES) throw new Error(`${sourceUrl}: source image exceeds ${MAX_SOURCE_BYTES} bytes`);

  const output = await sharp(source, { failOn: "none", animated: false })
    .rotate()
    .resize({ width: TARGET_SIZE, height: TARGET_SIZE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer();
  if (output.length < 500) throw new Error(`${sourceUrl}: optimized image is unexpectedly small (${output.length} bytes)`);
  return output;
}

async function uploadManagedImage(sku, sourceUrl, bytes) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const asset = await client.assets.upload("image", bytes, {
        filename: `abm-stable-${clean(sku).replace(/[^A-Za-z0-9._-]+/g, "-")}.webp`,
      });
      if (!isManagedImage(asset?.url)) throw new Error(`Sanity returned invalid managed URL for ${sku}`);
      return asset.url;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(1200 * attempt);
    }
  }
  throw lastError;
}

const uploadedBySource = new Map();
async function migrateProduct(product, index) {
  const sku = clean(product.sku);
  const existingManaged = clean(product.managedPreviewImage);
  if (isManagedImage(existingManaged)) {
    return { sku, managedUrl: existingManaged, sourceUrl: clean(product.previewImage), reused: true, noImage: false };
  }

  const initialSource = officialImageUrl(product.previewImage, product.sourceUrl);
  let candidates = initialSource ? [initialSource] : [];
  let detailCandidatesLoaded = false;
  const errors = [];

  async function ensureDetailCandidates() {
    if (detailCandidatesLoaded) return;
    detailCandidatesLoaded = true;
    const fromDetail = await fetchDetailImageCandidates(product);
    candidates = Array.from(new Set([...candidates, ...fromDetail]));
  }

  if (!candidates.length) await ensureDetailCandidates();

  for (let candidateIndex = 0; ; candidateIndex++) {
    if (candidateIndex >= candidates.length) {
      if (!detailCandidatesLoaded) {
        await ensureDetailCandidates();
        if (candidateIndex < candidates.length) continue;
      }
      break;
    }
    const sourceUrl = candidates[candidateIndex];
    try {
      if (uploadedBySource.has(sourceUrl)) {
        const managedUrl = await uploadedBySource.get(sourceUrl);
        return { sku, managedUrl, sourceUrl, reused: true, noImage: false };
      }
      const task = (async () => {
        const bytes = await downloadAndOptimize(sourceUrl);
        if (!bytes) return "";
        return await uploadManagedImage(sku, sourceUrl, bytes);
      })();
      uploadedBySource.set(sourceUrl, task);
      const managedUrl = await task;
      if (managedUrl) {
        if ((index + 1) % 50 === 0) console.log(`[stable images] ${index + 1}/${EXPECTED_PRODUCTS}`);
        return { sku, managedUrl, sourceUrl, reused: false, noImage: false };
      }
    } catch (error) {
      errors.push(`${sourceUrl}: ${error?.message || error}`);
      uploadedBySource.delete(sourceUrl);
    }
  }

  if (!candidates.length) return { sku, managedUrl: "", sourceUrl: "", reused: false, noImage: true };
  return { sku, managedUrl: "", sourceUrl: candidates[0] || "", reused: false, noImage: false, errors };
}

async function pool(items, workers, fn) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        output[index] = await fn(items[index], index);
      } catch (error) {
        output[index] = {
          sku: clean(items[index]?.sku),
          managedUrl: "",
          sourceUrl: clean(items[index]?.previewImage),
          noImage: false,
          errors: [String(error?.stack || error)],
        };
      }
    }
  }));
  return output;
}

console.log(`[stable images] migrating ${catalog.products.length} products with concurrency=${CONCURRENCY}`);
const results = await pool(catalog.products, CONCURRENCY, migrateProduct);
const managedResults = results.filter((row) => isManagedImage(row?.managedUrl));
const noImageResults = results.filter((row) => row?.noImage === true);
const failedResults = results.filter((row) => !isManagedImage(row?.managedUrl) && row?.noImage !== true);

console.log(JSON.stringify({
  total: results.length,
  managed: managedResults.length,
  officialNoImage: noImageResults.length,
  failures: failedResults.length,
  failedSkus: failedResults.slice(0, 30).map((row) => ({ sku: row.sku, errors: row.errors?.slice(-2) })),
  noImageSkus: noImageResults.map((row) => row.sku),
}, null, 2));

if (failedResults.length) {
  throw new Error(`Stable managed image migration has ${failedResults.length} unresolved image failures`);
}
if (managedResults.length < EXPECTED_WITH_IMAGE || noImageResults.length > EXPECTED_PRODUCTS - EXPECTED_WITH_IMAGE) {
  throw new Error(`Stable managed image completeness mismatch: managed=${managedResults.length}, noImage=${noImageResults.length}`);
}

const managedBySku = new Map(managedResults.map((row) => [normalizeSku(row.sku), row]));
const noImageSkuSet = new Set(noImageResults.map((row) => normalizeSku(row.sku)));

for (const product of catalog.products) {
  const result = managedBySku.get(normalizeSku(product.sku));
  if (result) product.managedPreviewImage = result.managedUrl;
  else if (noImageSkuSet.has(normalizeSku(product.sku))) delete product.managedPreviewImage;
}
catalog.media = {
  ...(catalog.media || {}),
  managedPreviewImage: managedResults.length,
  officialNoImage: noImageResults.length,
  managedImageMigratedAt: new Date().toISOString(),
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
    const managed = managedBySku.get(sku)?.managedUrl || "";
    const next = {
      ...record,
      images: managed ? [managed] : [],
      verification: {
        ...(record?.verification || {}),
        hasOfficialImages: Boolean(managed),
        mediaDeferred: false,
      },
    };
    if (managed) next.previewImage = managed;
    else delete next.previewImage;
    patchedRecords += 1;
    return next;
  });
  await client.patch(doc._id).set({ records: nextRecords }).commit();
  if ((docIndex + 1) % 10 === 0 || docIndex === docs.length - 1) {
    console.log(`[stable images] patched Sanity chunks ${docIndex + 1}/${docs.length}`);
  }
}

if (patchedRecords !== EXPECTED_PRODUCTS) {
  throw new Error(`Stable Sanity detail patch count mismatch: ${patchedRecords}/${EXPECTED_PRODUCTS}`);
}

const verificationRows = await client.fetch(`*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
  && string::startsWith(_id, $prefix)
].records[]{sku, images, previewImage, verification}`, { version: VERSION, prefix: DETAIL_PREFIX });
const verifiedManaged = verificationRows.filter((row) => {
  const images = Array.isArray(row?.images) ? row.images : [];
  return images.some(isManagedImage) && isManagedImage(row?.previewImage) && row?.verification?.hasOfficialImages === true;
});
const verifiedNoImage = verificationRows.filter((row) => !(Array.isArray(row?.images) && row.images.some(isManagedImage)));

if (verificationRows.length !== EXPECTED_PRODUCTS || verifiedManaged.length !== managedResults.length || verifiedNoImage.length !== noImageResults.length) {
  throw new Error(`Stable Sanity image verification mismatch: rows=${verificationRows.length}, managed=${verifiedManaged.length}, noImage=${verifiedNoImage.length}`);
}

fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2) + "\n");
console.log(JSON.stringify({
  catalogProducts: catalog.products.length,
  managedImages: managedResults.length,
  officialNoImage: noImageResults.length,
  sanityRecords: verificationRows.length,
  sanityManaged: verifiedManaged.length,
  sanityNoImage: verifiedNoImage.length,
  catalogFile: CATALOG_FILE,
}, null, 2));
