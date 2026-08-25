#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");
const sharp = require("sharp");

const APPLY = process.argv.includes("--apply");
const MIGRATION_KEY = "cleaver-products-2026-08-24";
const MANUFACTURER_BRAND_ID = 1889;
const MAX_IMAGE_BYTES = 14 * 1024 * 1024;
const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");

const inventory = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-product-catalog.json"), "utf8"));
const reviewedSkus = new Set(inventory.map((row) => normalizeSku(row.sku)));
if (inventory.length !== 1432 || reviewedSkus.size !== 1432) throw new Error("Expected exactly 1,432 reviewed Cleaver SKUs.");

const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim()).find(Boolean);
if (APPLY && !token) throw new Error("Cleaver perceptual image repair requires the Production Sanity write token.");

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

async function pooled(items, concurrency, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const position = next;
      next += 1;
      await worker(items[position], position);
    }
  }));
}

async function retry(label, operation, attempts = 5) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = Number(error?.statusCode || error?.response?.statusCode || 0);
      if (attempt === attempts - 1 || (status && ![408, 409, 429].includes(status) && status < 500)) throw error;
      const delay = Math.min(12_000, 650 * (2 ** attempt));
      console.warn(`[Cleaver perceptual repair] retrying ${label} in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function normalizeWiserImage(value) {
  try {
    const url = new URL(String(value || "").startsWith("//") ? `https:${value}` : String(value || ""));
    if (url.protocol !== "https:" || !["wisertech.it", "www.wisertech.it"].includes(url.hostname)) return "";
    if (!/\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname)) return "";
    if (/(?:logo|placeholder|woocommerce-placeholder|no[-_]?image)/i.test(url.pathname)) return "";
    url.searchParams.delete("width");
    url.searchParams.delete("height");
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function reportedWidth(image) {
  const configured = Number(image?.width || 0);
  const widths = [...String(image?.srcset || "").matchAll(/\s(\d+)w(?:,|$)/g)].map((match) => Number(match[1])).filter(Number.isFinite);
  return Math.max(configured, ...widths, 0);
}

async function fetchBuffer(url, referer = "") {
  const response = await fetch(url, {
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      ...(referer ? { Referer: referer } : {}),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("image/")) throw new Error(`unsupported type ${contentType}`);
  const declared = Number.parseInt(response.headers.get("content-length") || "0", 10);
  if (declared > MAX_IMAGE_BYTES) throw new Error("image exceeds size limit");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1800 || bytes.length > MAX_IMAGE_BYTES) throw new Error("invalid image byte size");
  return { bytes, contentType };
}

async function perceptualStats(bytes) {
  let pipeline = sharp(bytes, { failOn: "none" }).rotate().flatten({ background: "#ffffff" });
  try {
    pipeline = pipeline.trim({ background: "#ffffff", threshold: 12 });
  } catch {
    // Keep the full frame if trim is not appropriate for the source.
  }
  const normalized = await pipeline
    .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: false })
    .greyscale()
    .png()
    .toBuffer();
  const stats = await sharp(normalized).stats();
  const sharpness = Number(stats.sharpness || 0);
  const entropy = Number(stats.entropy || 0);
  const score = sharpness * (0.72 + Math.min(0.28, entropy / 24));
  return { sharpness, entropy, score };
}

function hostOf(value) {
  try { return new URL(String(value || "")).hostname; } catch { return ""; }
}

function isCandidateForAudit(row) {
  const primary = Array.isArray(row?.images) ? row.images[0] : null;
  const sourceHost = hostOf(primary?.sourceUrl);
  const width = Number(primary?.width || 0);
  if (!primary?.url) return false;
  if (/cdn\.shopify\.com/i.test(sourceHost)) return true;
  if (/wisertech/i.test(sourceHost) && width >= 1800) return true;
  if (width >= 1800 && !row?.imageQualitySource) return true;
  return width > 0 && width < 750;
}

const existing = await client.fetch(`*[_type == "product" && migrationKey == $key]{
  _id,sku,imageQualitySource,
  "images":images[]{_key,_type,sourceUrl,asset,"width":asset->metadata.dimensions.width,"height":asset->metadata.dimensions.height,"url":asset->url}
}`, { key: MIGRATION_KEY });
if (!Array.isArray(existing) || existing.length !== 1432) throw new Error(`Expected 1,432 Cleaver products, found ${existing?.length || 0}.`);
const existingBySku = new Map(existing.map((row) => [normalizeSku(row.sku), row]));

const wiserProducts = new Map();
const wiserUrl = (page) => `https://wisertech.it/wp-json/wc/store/v1/products?brand=${MANUFACTURER_BRAND_ID}&per_page=100&page=${page}`;
const firstResponse = await fetch(wiserUrl(1), { headers: { Accept: "application/json,*/*;q=0.8" }, signal: AbortSignal.timeout(55_000) });
if (!firstResponse.ok) throw new Error(`Wisertech catalog returned HTTP ${firstResponse.status}`);
const totalPages = Number.parseInt(firstResponse.headers.get("x-wp-totalpages") || "1", 10);
const totalProducts = Number.parseInt(firstResponse.headers.get("x-wp-total") || "0", 10);
if (totalPages < 10 || totalProducts < 1200) throw new Error(`Unexpected verified Wisertech Cleaver catalog: ${totalProducts}/${totalPages}`);

function collect(rows) {
  for (const product of Array.isArray(rows) ? rows : []) {
    const sku = normalizeSku(product?.sku);
    const branded = Array.isArray(product?.brands) && product.brands.some((brand) => Number(brand?.id) === MANUFACTURER_BRAND_ID && /thistle scientific/i.test(String(brand?.name || "")));
    if (!reviewedSkus.has(sku) || !branded) continue;
    const images = (Array.isArray(product?.images) ? product.images : [])
      .map((image) => ({ url: normalizeWiserImage(image?.src), width: reportedWidth(image) }))
      .filter((image) => image.url)
      .sort((a, b) => b.width - a.width)
      .slice(0, 2);
    if (images.length) wiserProducts.set(sku, { sku, page: product?.permalink || "https://wisertech.it/", images });
  }
}
collect(await firstResponse.json());
await pooled(Array.from({ length: totalPages - 1 }, (_, index) => index + 2), 4, async (page) => {
  const response = await fetch(wiserUrl(page), { headers: { Accept: "application/json,*/*;q=0.8" }, signal: AbortSignal.timeout(55_000) });
  if (!response.ok) throw new Error(`Wisertech catalog page ${page} returned HTTP ${response.status}`);
  collect(await response.json());
});

const targets = existing.filter((row) => isCandidateForAudit(row) && wiserProducts.has(normalizeSku(row.sku)));
if (wiserProducts.size < 1200) throw new Error(`Only ${wiserProducts.size} exact-SKU Wisertech image candidates were found.`);

const evaluations = [];
let auditFailures = 0;
await pooled(targets, 6, async (row) => {
  const sku = normalizeSku(row.sku);
  const current = row.images?.[0];
  const source = wiserProducts.get(sku);
  try {
    const currentDownloaded = await fetchBuffer(current.url);
    const currentStats = await perceptualStats(currentDownloaded.bytes);
    let best;
    for (const candidate of source.images) {
      try {
        const downloaded = await fetchBuffer(candidate.url, source.page);
        const stats = await perceptualStats(downloaded.bytes);
        if (!best || stats.score > best.stats.score) best = { ...candidate, downloaded, stats };
      } catch (error) {
        console.warn(`[Cleaver perceptual repair] ${sku} candidate: ${error.message}`);
      }
    }
    if (!best) return;
    const improvement = currentStats.score > 0 ? best.stats.score / currentStats.score : 0;
    const entropyRatio = currentStats.entropy > 0 ? best.stats.entropy / currentStats.entropy : 1;
    const currentHost = hostOf(current.sourceUrl);
    const minimumImprovement = /cdn\.shopify\.com/i.test(currentHost) ? 1.12 : 1.22;
    const replace = best.width >= 650 && improvement >= minimumImprovement && entropyRatio >= 0.62;
    evaluations.push({
      sku,
      row,
      source,
      current,
      currentStats,
      best,
      improvement,
      entropyRatio,
      replace,
    });
  } catch (error) {
    auditFailures += 1;
    console.warn(`[Cleaver perceptual repair] ${sku} current image: ${error.message}`);
  }
});

const replacements = evaluations.filter((row) => row.replace).sort((a, b) => b.improvement - a.improvement);
const msmini7 = evaluations.find((row) => row.sku === "MSMINI7");
console.log(JSON.stringify({
  phase: APPLY ? "apply" : "dry-run",
  products: existing.length,
  exactWiserSkuImages: wiserProducts.size,
  audited: evaluations.length,
  auditFailures,
  replacements: replacements.length,
  sampleMSMINI7: msmini7 ? {
    currentSource: msmini7.current.sourceUrl,
    currentWidth: msmini7.current.width,
    currentSharpness: Number(msmini7.currentStats.sharpness.toFixed(4)),
    candidateUrl: msmini7.best.url,
    candidateWidth: msmini7.best.width,
    candidateSharpness: Number(msmini7.best.stats.sharpness.toFixed(4)),
    improvement: Number(msmini7.improvement.toFixed(3)),
    replace: msmini7.replace,
  } : { evaluated: false },
  top: replacements.slice(0, 12).map((row) => ({ sku: row.sku, improvement: Number(row.improvement.toFixed(3)), currentWidth: row.current.width, candidateWidth: row.best.width })),
}));

if (!APPLY) process.exit(0);
if (!replacements.length) {
  console.log("[Cleaver perceptual repair] no exact-SKU image is perceptually better enough to replace safely.");
  process.exit(0);
}

const knownAssets = await client.fetch(`*[_type == "sanity.imageAsset" && defined(source.id) && source.name == "Cleaver exact-SKU perceptual quality replacement"]{_id,"sourceId":source.id}`);
const assets = new Map((knownAssets || []).map((asset) => [asset.sourceId, Promise.resolve(asset)]));
let published = 0;
let failures = 0;

async function upload(evaluation) {
  const url = evaluation.best.url;
  if (assets.has(url)) return assets.get(url);
  const task = retry(`upload ${evaluation.sku}`, async () => {
    const { bytes, contentType } = evaluation.best.downloaded;
    const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const filename = `cleaver-sharp-${evaluation.sku.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${hash(url).slice(0, 12)}.${extension}`;
    return client.assets.upload("image", bytes, {
      filename,
      contentType,
      source: { id: url, name: "Cleaver exact-SKU perceptual quality replacement" },
    });
  });
  assets.set(url, task);
  try { return await task; } catch (error) { assets.delete(url); throw error; }
}

await pooled(replacements, 5, async (evaluation) => {
  try {
    const asset = await upload(evaluation);
    const row = evaluation.row;
    const primary = {
      _key: hash(`${evaluation.sku}:${evaluation.best.url}`).slice(0, 12),
      _type: "image",
      asset: { _type: "reference", _ref: asset._id },
      sourceUrl: evaluation.best.url,
    };
    const preserved = (Array.isArray(row.images) ? row.images : [])
      .filter((image) => image?.asset?._ref && image.asset._ref !== asset._id)
      .map(({ _key, _type, sourceUrl, asset: imageAsset }) => ({ _key, _type: _type || "image", ...(sourceUrl ? { sourceUrl } : {}), asset: imageAsset }));
    const images = [primary, ...preserved].slice(0, 5);
    await retry(`publish ${evaluation.sku}`, () => client.patch(row._id).set({
      images,
      imageQualityRepairedAt: new Date().toISOString(),
      imageQualitySource: `Exact-SKU perceptual sharpness replacement (${evaluation.improvement.toFixed(2)}x)`,
    }).commit({ visibility: "async" }));
    published += 1;
    if (published <= 10 || published % 25 === 0 || published === replacements.length) console.log(`[Cleaver perceptual repair] published ${published}/${replacements.length}: ${evaluation.sku}`);
  } catch (error) {
    failures += 1;
    console.warn(`[Cleaver perceptual repair] ${evaluation.sku}: ${error.message}`);
  }
});

await new Promise((resolve) => setTimeout(resolve, 2500));
const after = await client.fetch(`{
  "photos":count(*[_type == "product" && migrationKey == $key && defined(images[0].asset)]),
  "perceptualRepairs":count(*[_type == "product" && migrationKey == $key && imageQualitySource match "Exact-SKU perceptual sharpness replacement*"]),
  "msmini7":*[_type == "product" && migrationKey == $key && sku == "MSMINI7"][0]{imageQualitySource,"width":images[0].asset->metadata.dimensions.width,"height":images[0].asset->metadata.dimensions.height,"sourceUrl":images[0].sourceUrl,"images":count(images)}
}`, { key: MIGRATION_KEY });
console.log(JSON.stringify({ published, failures, after }));
if (failures > Math.max(15, replacements.length * 0.12)) throw new Error(`Cleaver perceptual image repair had too many failures: ${failures}/${replacements.length}`);
