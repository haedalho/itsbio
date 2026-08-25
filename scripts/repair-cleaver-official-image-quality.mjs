#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");

const APPLY = process.argv.includes("--apply");
const MIGRATION_KEY = "cleaver-products-2026-08-24";
const MAX_IMAGE_BYTES = 14 * 1024 * 1024;
const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");

const inventory = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-product-catalog.json"), "utf8"));
const reviewedSkus = new Set(inventory.map((row) => normalizeSku(row.sku)));
if (inventory.length !== 1432 || reviewedSkus.size !== 1432) throw new Error("Expected exactly 1,432 reviewed Cleaver SKUs.");

const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim()).find(Boolean);
if (APPLY && !token) throw new Error("Cleaver official-image repair requires the Production Sanity write token.");

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
      const delay = Math.min(12_000, 700 * (2 ** attempt));
      console.warn(`[Cleaver official image] retrying ${label} in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

const browserHeaders = {
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
  Referer: "https://www.thistlescientific.com/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
};

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json,*/*;q=0.8", Referer: "https://www.thistlescientific.com/", "User-Agent": browserHeaders["User-Agent"] },
    redirect: "follow",
    signal: AbortSignal.timeout(55_000),
  });
  if (!response.ok) throw new Error(`Thistle catalog returned HTTP ${response.status}`);
  return response.json();
}

function normalizeOfficialImage(value) {
  try {
    const url = new URL(String(value || "").startsWith("//") ? `https:${value}` : String(value || ""));
    if (url.protocol !== "https:" || !["www.thistlescientific.com", "thistlescientific.com"].includes(url.hostname)) return "";
    if (!/\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname)) return "";
    if (/(?:logo|placeholder|woocommerce-placeholder)/i.test(url.pathname)) return "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function originalWordPressImage(url) {
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(/-\d{2,5}x\d{2,5}(?=\.[^.\/]+$)/i, "");
    return parsed.toString();
  } catch {
    return url;
  }
}

async function downloadOfficialImage(rawUrl) {
  const normalized = normalizeOfficialImage(rawUrl);
  if (!normalized) throw new Error("Invalid official image URL");
  const attempts = [...new Set([originalWordPressImage(normalized), normalized])];
  let lastError;
  for (const url of attempts) {
    try {
      const response = await fetch(url, { headers: browserHeaders, redirect: "follow", signal: AbortSignal.timeout(45_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      if (!contentType.startsWith("image/")) throw new Error(`unexpected type ${contentType}`);
      const declared = Number.parseInt(response.headers.get("content-length") || "0", 10);
      if (declared > MAX_IMAGE_BYTES) throw new Error("image exceeds size limit");
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 1800 || bytes.length > MAX_IMAGE_BYTES) throw new Error("invalid image byte size");
      return { url, bytes, contentType, usedOriginal: url !== normalized || !/-\d{2,5}x\d{2,5}(?=\.[^.\/]+$)/i.test(normalized) };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("official image unavailable");
}

const existing = await client.fetch(`*[_type == "product" && migrationKey == $key]{
  _id,sku,imageQualitySource,
  "primaryWidth":images[0].asset->metadata.dimensions.width,
  "primaryHeight":images[0].asset->metadata.dimensions.height,
  "images":images[]{_key,_type,sourceUrl,asset,"width":asset->metadata.dimensions.width,"height":asset->metadata.dimensions.height,"url":asset->url}
}`, { key: MIGRATION_KEY });
if (!Array.isArray(existing) || existing.length !== 1432) throw new Error(`Expected 1,432 Cleaver products, found ${existing?.length || 0}.`);
const existingBySku = new Map(existing.map((row) => [normalizeSku(row.sku), row]));

const official = new Map();
const batches = Array.from({ length: Math.ceil(inventory.length / 35) }, (_, index) => inventory.slice(index * 35, index * 35 + 35));
await pooled(batches, 4, async (batch) => {
  const url = new URL("https://www.thistlescientific.com/wp-json/wc/store/v1/products");
  url.searchParams.set("sku", batch.map((row) => row.sku).join(","));
  url.searchParams.set("per_page", "100");
  try {
    const rows = await fetchJson(url.toString());
    for (const row of Array.isArray(rows) ? rows : []) {
      const sku = normalizeSku(row?.sku);
      if (!reviewedSkus.has(sku)) continue;
      const images = [...new Set((Array.isArray(row?.images) ? row.images : []).map((image) => normalizeOfficialImage(image?.src)).filter(Boolean))];
      if (images.length) official.set(sku, { sku, page: row?.permalink || "https://www.thistlescientific.com/", images });
    }
  } catch (error) {
    console.warn(`[Cleaver official image] catalog batch: ${error.message}`);
  }
});

function hostOf(value) {
  try { return new URL(String(value || "")).hostname; } catch { return ""; }
}

function isSuspectCurrent(row) {
  const primary = Array.isArray(row?.images) ? row.images[0] : null;
  const sourceHost = hostOf(primary?.sourceUrl);
  const width = Number(row?.primaryWidth || 0);
  const sourceLabel = String(row?.imageQualitySource || "");
  if (!width) return true;
  if (/wisertech/i.test(sourceHost) || /Wisertech/i.test(sourceLabel)) return true;
  if (/cdn\.shopify\.com/i.test(sourceHost) && width >= 1800) return true;
  if (width < 700) return true;
  return false;
}

const targets = [...official.values()].filter((candidate) => {
  const row = existingBySku.get(candidate.sku);
  return row && isSuspectCurrent(row);
});

console.log(JSON.stringify({
  phase: APPLY ? "apply" : "dry-run",
  products: existing.length,
  officialExactSkuImages: official.size,
  suspectProductsWithOfficialReplacement: targets.length,
  sampleMSMINI7: {
    currentWidth: Number(existingBySku.get("MSMINI7")?.primaryWidth || 0),
    currentSource: existingBySku.get("MSMINI7")?.images?.[0]?.sourceUrl || "",
    currentQualitySource: existingBySku.get("MSMINI7")?.imageQualitySource || "",
    officialImages: official.get("MSMINI7")?.images || [],
    targeted: targets.some((row) => row.sku === "MSMINI7"),
  },
}));

if (!APPLY) process.exit(0);
if (!targets.length) {
  console.log("[Cleaver official image] no suspect products require replacement.");
  process.exit(0);
}

const knownAssets = await client.fetch(`*[_type == "sanity.imageAsset" && defined(source.id) && source.name == "Cleaver Scientific exact-SKU official image"]{_id,"sourceId":source.id}`);
const assets = new Map((knownAssets || []).map((asset) => [asset.sourceId, Promise.resolve(asset)]));
let published = 0;
let failures = 0;
let originalFilesUsed = 0;
let resizedFallbacksUsed = 0;

async function upload(candidate, rawUrl) {
  const normalized = normalizeOfficialImage(rawUrl);
  const original = originalWordPressImage(normalized);
  for (const key of [original, normalized]) {
    if (assets.has(key)) return assets.get(key);
  }
  const task = (async () => {
    const downloaded = await downloadOfficialImage(normalized);
    if (downloaded.usedOriginal) originalFilesUsed += 1;
    else resizedFallbacksUsed += 1;
    const extension = downloaded.contentType.includes("png") ? "png" : downloaded.contentType.includes("webp") ? "webp" : "jpg";
    const filename = `cleaver-official-${candidate.sku.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${hash(downloaded.url).slice(0, 12)}.${extension}`;
    const asset = await retry(`upload ${candidate.sku}`, () => client.assets.upload("image", downloaded.bytes, {
      filename,
      contentType: downloaded.contentType,
      source: { id: downloaded.url, name: "Cleaver Scientific exact-SKU official image" },
    }));
    return { asset, sourceUrl: downloaded.url };
  })();
  assets.set(original, task);
  assets.set(normalized, task);
  try {
    return await task;
  } catch (error) {
    assets.delete(original);
    assets.delete(normalized);
    throw error;
  }
}

await pooled(targets, 4, async (candidate) => {
  const row = existingBySku.get(candidate.sku);
  if (!row) return;
  try {
    const replacements = [];
    for (const imageUrl of candidate.images.slice(0, 4)) {
      try {
        const uploaded = await upload(candidate, imageUrl);
        const assetId = uploaded.asset?._id || uploaded?._id;
        if (!assetId || replacements.some((image) => image.asset._ref === assetId)) continue;
        replacements.push({
          _key: hash(`${candidate.sku}:${uploaded.sourceUrl}`).slice(0, 12),
          _type: "image",
          asset: { _type: "reference", _ref: assetId },
          sourceUrl: uploaded.sourceUrl,
        });
      } catch (error) {
        console.warn(`[Cleaver official image] ${candidate.sku} candidate: ${error.message}`);
      }
    }
    if (!replacements.length) throw new Error("no official image could be downloaded");

    const preserved = (Array.isArray(row.images) ? row.images : [])
      .filter((image) => image?.asset?._ref && !replacements.some((next) => next.asset._ref === image.asset._ref))
      .filter((image) => {
        const host = hostOf(image?.sourceUrl);
        const width = Number(image?.width || 0);
        if (/wisertech/i.test(host)) return false;
        if (/cdn\.shopify\.com/i.test(host) && width >= 1800) return false;
        return true;
      })
      .map(({ _key, _type, sourceUrl, asset }) => ({ _key, _type: _type || "image", ...(sourceUrl ? { sourceUrl } : {}), asset }));

    const images = [...replacements, ...preserved].slice(0, 5);
    await retry(`publish ${candidate.sku}`, () => client.patch(row._id).set({
      images,
      imageQualityRepairedAt: new Date().toISOString(),
      imageQualitySource: "Thistle Scientific exact-SKU official original preferred over enlarged supplier copies",
    }).commit({ visibility: "async" }));
    published += 1;
    if (published <= 10 || published % 25 === 0 || published === targets.length) console.log(`[Cleaver official image] published ${published}/${targets.length}: ${candidate.sku}`);
  } catch (error) {
    failures += 1;
    console.warn(`[Cleaver official image] ${candidate.sku}: ${error.message}`);
  }
});

await new Promise((resolve) => setTimeout(resolve, 2500));
const final = await client.fetch(`{
  "photos":count(*[_type == "product" && migrationKey == $key && defined(images[0].asset)]),
  "officialPrimary":count(*[_type == "product" && migrationKey == $key && imageQualitySource match "Thistle Scientific exact-SKU official*"]),
  "msmini7":*[_type == "product" && migrationKey == $key && sku == "MSMINI7"][0]{imageQualitySource,"width":images[0].asset->metadata.dimensions.width,"height":images[0].asset->metadata.dimensions.height,"sourceUrl":images[0].sourceUrl,"images":count(images)}
}`, { key: MIGRATION_KEY });
console.log(JSON.stringify({ published, failures, originalFilesUsed, resizedFallbacksUsed, after: final }));
if (published < Math.max(1, Math.floor(targets.length * 0.5)) || failures > Math.max(20, targets.length * 0.5)) {
  throw new Error(`Cleaver official image quality repair coverage was too low: ${published}/${targets.length}, failures=${failures}`);
}
