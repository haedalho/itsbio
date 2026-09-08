#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createClient } from "next-sanity";

const CATALOG_FILE = path.resolve("data/abm-stable-cell-catalog.json");
const VERSION = String(process.env.ABM_REBUILD_VERSION || "2026-08-09-search-v5").trim();
const PREFIX = "abm-rebuild-detail-product-batch-stable-cell-lines-chunk-";
const PROJECT_ID = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const DATASET = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const API_VERSION = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const EXPECTED = 1102;

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
if (!Array.isArray(catalog.products) || catalog.products.length !== EXPECTED) throw new Error(`Catalog count ${catalog.products?.length || 0}/${EXPECTED}`);
const clean = (v) => String(v || "").trim();
const key = (v) => clean(v).toLowerCase();
const isManaged = (value) => {
  try {
    const u = new URL(clean(value));
    return u.hostname === "cdn.sanity.io" && u.pathname.startsWith(`/images/${PROJECT_ID}/`);
  } catch { return false; }
};
const arraysEqual = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);

const catalogBySku = new Map();
let catalogOfficialImages = 0;
let catalogManagedImages = 0;
const catalogErrors = [];
const distribution = {};
for (const product of catalog.products) {
  const sku = key(product.sku);
  const official = Array.isArray(product.officialGalleryImages) ? product.officialGalleryImages : [];
  const managed = Array.isArray(product.managedGalleryImages) ? product.managedGalleryImages : [];
  if (!sku || !official.length || official.length !== managed.length || !managed.every(isManaged)) {
    catalogErrors.push({ sku: product.sku, official: official.length, managed: managed.length });
  }
  catalogOfficialImages += official.length;
  catalogManagedImages += managed.length;
  distribution[official.length] = (distribution[official.length] || 0) + 1;
  catalogBySku.set(sku, { official, managed, title: product.title });
}
if (catalogErrors.length) {
  console.error(catalogErrors.slice(0, 30));
  throw new Error(`Catalog gallery verification failed for ${catalogErrors.length} products`);
}

const t6352 = catalogBySku.get("t6352");
if (!t6352 || t6352.official.length !== 3 || t6352.managed.length !== 3) {
  throw new Error(`T6352 must contain exactly 3 official/managed gallery images; got ${t6352?.official.length || 0}/${t6352?.managed.length || 0}`);
}

const token = [process.env.SANITY_READ_TOKEN, process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_TOKEN].map((v) => clean(v)).find(Boolean);
const client = createClient({ projectId: PROJECT_ID, dataset: DATASET, apiVersion: API_VERSION, token: token || undefined, useCdn: false });
const rows = await client.fetch(`*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
  && string::startsWith(_id, $prefix)
].records[]{sku, images, previewImage, verification}`, { version: VERSION, prefix: PREFIX });
if (rows.length !== EXPECTED) throw new Error(`Sanity Stable records ${rows.length}/${EXPECTED}`);

const sanityErrors = [];
let sanityImages = 0;
for (const row of rows) {
  const expected = catalogBySku.get(key(row.sku));
  const images = Array.isArray(row.images) ? row.images : [];
  if (!expected || !arraysEqual(images, expected.managed) || images.length !== expected.official.length || !images.every(isManaged) || row.previewImage !== images[0]) {
    sanityErrors.push({ sku: row.sku, expectedOfficial: expected?.official.length || 0, expectedManaged: expected?.managed.length || 0, sanity: images.length });
    continue;
  }
  if (row?.verification?.officialGalleryImageCount !== expected.official.length || row?.verification?.managedGalleryImageCount !== images.length) {
    sanityErrors.push({ sku: row.sku, reason: "stored verification counts mismatch" });
    continue;
  }
  sanityImages += images.length;
}
if (sanityErrors.length) {
  console.error(sanityErrors.slice(0, 30));
  throw new Error(`Sanity gallery verification failed for ${sanityErrors.length} products`);
}
if (catalogOfficialImages !== catalogManagedImages || catalogManagedImages !== sanityImages) {
  throw new Error(`Gallery totals differ official=${catalogOfficialImages} managed=${catalogManagedImages} sanity=${sanityImages}`);
}

console.log(JSON.stringify({
  products: EXPECTED,
  officialGalleryImages: catalogOfficialImages,
  managedGalleryImages: catalogManagedImages,
  sanityGalleryImages: sanityImages,
  productsWithMultipleImages: catalog.products.filter((p) => (p.officialGalleryImages?.length || 0) > 1).length,
  maxImagesPerProduct: Math.max(...catalog.products.map((p) => p.officialGalleryImages?.length || 0)),
  distribution,
  t6352: { official: t6352.official.length, managed: t6352.managed.length },
  mismatches: 0,
}, null, 2));
