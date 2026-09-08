#!/usr/bin/env node
import stableCatalog from "../data/abm-stable-cell-catalog.json" with { type: "json" };
import { createClient } from "next-sanity";

const PROJECT_ID = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const DATASET = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const API_VERSION = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const VERSION = String(process.env.ABM_REBUILD_VERSION || "2026-08-09-search-v5").trim();
const PREFIX = "abm-rebuild-detail-product-batch-stable-cell-lines-chunk-";
const EXPECTED = 1102;
const EXPECTED_MANAGED = 1100;

const clean = (value) => String(value || "").trim();
const normalize = (value) => clean(value).toLowerCase();
function isManaged(value) {
  try {
    const url = new URL(clean(value));
    return url.hostname === "cdn.sanity.io" && url.pathname.startsWith(`/images/${PROJECT_ID}/`);
  } catch {
    return false;
  }
}

const products = Array.isArray(stableCatalog?.products) ? stableCatalog.products : [];
if (products.length !== EXPECTED) throw new Error(`Stable catalog count mismatch: ${products.length}/${EXPECTED}`);
const catalogManaged = products.filter((product) => isManaged(product.managedPreviewImage));
const catalogNoImage = products.filter((product) => !isManaged(product.managedPreviewImage));
if (catalogManaged.length !== EXPECTED_MANAGED || catalogNoImage.length !== EXPECTED - EXPECTED_MANAGED) {
  throw new Error(`Stable catalog image mismatch: managed=${catalogManaged.length}, noImage=${catalogNoImage.length}`);
}
const managedBySku = new Map(catalogManaged.map((product) => [normalize(product.sku), clean(product.managedPreviewImage)]));

const client = createClient({ projectId: PROJECT_ID, dataset: DATASET, apiVersion: API_VERSION, useCdn: false });
const rows = await client.fetch(`*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
  && string::startsWith(_id, $prefix)
].records[]{sku,images,previewImage,verification}`, { version: VERSION, prefix: PREFIX });
if (rows.length !== EXPECTED) throw new Error(`Stable Sanity detail count mismatch: ${rows.length}/${EXPECTED}`);

let sanityManaged = 0;
const mismatches = [];
const unmanaged = [];
for (const row of rows) {
  const sku = normalize(row?.sku);
  const expected = managedBySku.get(sku) || "";
  const images = Array.isArray(row?.images) ? row.images.map(String).filter(Boolean) : [];
  const actual = images.find(isManaged) || "";
  if (images.some((url) => !isManaged(url))) unmanaged.push(row?.sku);
  if (actual) sanityManaged += 1;
  if (actual !== expected || (expected && clean(row?.previewImage) !== expected) || Boolean(expected) !== (row?.verification?.hasOfficialImages === true)) {
    mismatches.push({ sku: row?.sku, expected, actual, previewImage: row?.previewImage, hasOfficialImages: row?.verification?.hasOfficialImages });
  }
}

const summary = {
  catalogProducts: products.length,
  catalogManaged: catalogManaged.length,
  catalogNoImage: catalogNoImage.length,
  sanityRecords: rows.length,
  sanityManaged,
  sanityNoImage: rows.length - sanityManaged,
  mismatches: mismatches.length,
  unmanaged: unmanaged.length,
  officialNoImageSkus: catalogNoImage.map((product) => product.sku),
};
console.log(JSON.stringify(summary, null, 2));
if (sanityManaged !== EXPECTED_MANAGED || mismatches.length || unmanaged.length) {
  console.error(JSON.stringify({ mismatches: mismatches.slice(0, 20), unmanaged: unmanaged.slice(0, 20) }, null, 2));
  process.exit(1);
}
