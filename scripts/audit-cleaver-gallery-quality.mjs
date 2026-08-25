#!/usr/bin/env node

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");
const sharp = require("sharp");

const SKU = String(process.argv.find((arg) => arg.startsWith("--sku="))?.slice(6) || "MSMINI7").trim().toUpperCase();
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  useCdn: false,
  perspective: "published",
});

async function fetchBuffer(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function stats(bytes) {
  let pipeline = sharp(bytes, { failOn: "none" }).rotate().flatten({ background: "#fff" });
  try { pipeline = pipeline.trim({ background: "#fff", threshold: 12 }); } catch {}
  const normalized = await pipeline.resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: false }).greyscale().png().toBuffer();
  const s = await sharp(normalized).stats();
  return { sharpness: Number((s.sharpness || 0).toFixed(4)), entropy: Number((s.entropy || 0).toFixed(4)) };
}

const row = await client.fetch(`*[_type == "product" && migrationKey == "cleaver-products-2026-08-24" && upper(sku) == $sku][0]{
  _id,sku,imageQualitySource,
  "images":images[]{_key,sourceUrl,"url":asset->url,"width":asset->metadata.dimensions.width,"height":asset->metadata.dimensions.height}
}`, { sku: SKU });
if (!row) throw new Error(`Product ${SKU} not found`);
const result = [];
for (let i = 0; i < (row.images || []).length; i += 1) {
  const image = row.images[i];
  try {
    const metric = await stats(await fetchBuffer(image.url));
    result.push({ index: i + 1, sourceUrl: image.sourceUrl || "", width: image.width, height: image.height, ...metric });
  } catch (error) {
    result.push({ index: i + 1, sourceUrl: image.sourceUrl || "", width: image.width, height: image.height, error: error.message });
  }
}
console.log(JSON.stringify({ sku: row.sku, imageQualitySource: row.imageQualitySource || "", images: result }, null, 2));