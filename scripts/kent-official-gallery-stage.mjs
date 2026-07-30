#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { createClient } from "@sanity/client";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const slugArg = process.argv.find((value) => value.startsWith("--slug="));
const manifestArg = process.argv.find((value) => value.startsWith("--manifest="));
const onlySlug = String(slugArg?.split("=").slice(1).join("=") || "").trim();
const manifestPath = path.resolve(
  process.cwd(),
  String(manifestArg?.split("=").slice(1).join("=") || "data/kent-official-gallery-staging.json"),
);

const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.SANITY_STUDIO_PROJECT_ID ||
  process.env.SANITY_PROJECT_ID ||
  "9b5twpc8";
const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_STUDIO_DATASET ||
  process.env.SANITY_DATASET ||
  "production";
const token =
  process.env.SANITY_API_TOKEN ||
  process.env.SANITY_WRITE_TOKEN ||
  process.env.SANITY_TOKEN ||
  "";

if (!fs.existsSync(manifestPath)) {
  console.error(`Gallery staging manifest not found: ${manifestPath}`);
  process.exit(1);
}
if (apply && !token) {
  console.error("Write blocked: a Sanity write token is required.");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  token: token || undefined,
  apiVersion: "2025-02-19",
  useCdn: false,
});

function normalizeProduct(row) {
  const slug = String(row?.slug || "").trim();
  const sourceUrl = String(row?.sourceUrl || "").trim();
  const images = (Array.isArray(row?.images) ? row.images : [])
    .map((image, index) => ({
      _key: String(image?._key || `official-${index + 1}`),
      _type: "kentOfficialGalleryItem",
      sourceUrl: String(image?.sourceUrl || "").trim(),
      alt: String(image?.alt || "").trim(),
      order: Number.isFinite(Number(image?.order)) ? Number(image.order) : index,
      sourceWidth: Number(image?.sourceWidth || 0) || undefined,
      sourceHeight: Number(image?.sourceHeight || 0) || undefined,
      sourceFingerprint: String(image?.sourceFingerprint || "").trim() || undefined,
    }))
    .filter((image) => image.sourceUrl)
    .sort((a, b) => a.order - b.order);

  if (!slug) throw new Error("Manifest row is missing slug.");
  if (!sourceUrl) throw new Error(`Manifest row is missing sourceUrl: ${slug}`);
  if (!images.length) throw new Error(`Manifest row has no official gallery images: ${slug}`);

  const seen = new Set();
  for (const image of images) {
    const url = new URL(image.sourceUrl);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || (host !== "kentscientific.com" && host !== "www.kentscientific.com")) {
      throw new Error(`Invalid Kent gallery URL for ${slug}: ${image.sourceUrl}`);
    }
    if (seen.has(image.sourceUrl)) throw new Error(`Duplicate official gallery URL for ${slug}: ${image.sourceUrl}`);
    seen.add(image.sourceUrl);
  }

  const fingerprint =
    String(row?.fingerprint || "").trim() ||
    crypto
      .createHash("sha256")
      .update(JSON.stringify(images.map(({ sourceUrl: url, order }) => ({ url, order }))))
      .digest("hex");

  return {
    slug,
    sourceUrl,
    images,
    fingerprint,
    checkedAt: String(row?.checkedAt || new Date().toISOString()).trim(),
    notes: String(row?.notes || "Official Kent top gallery staged for visual review.").trim(),
  };
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
let rows = (Array.isArray(manifest?.products) ? manifest.products : []).map(normalizeProduct);
if (onlySlug) rows = rows.filter((row) => row.slug === onlySlug);

if (!rows.length) {
  console.log("No gallery staging rows selected. No Sanity data changed.");
  process.exit(0);
}

const productIds = await sanity.fetch(
  `*[_type == "product" && slug.current in $slugs]{_id, _rev, title, "slug": slug.current, "oldImages": count(images), "oldImageUrls": count(imageUrls), "oldGalleryUrls": count(galleryImageUrls)}`,
  { slugs: rows.map((row) => row.slug) },
);
const bySlug = new Map((productIds || []).map((row) => [row.slug, row]));
const report = rows.map((row) => ({
  slug: row.slug,
  found: bySlug.has(row.slug),
  officialGalleryCount: row.images.length,
  existing: bySlug.get(row.slug) || null,
}));
console.log(JSON.stringify({ mode: apply ? "APPLY_STAGE" : "DRY_RUN", products: report }, null, 2));

const missing = report.filter((row) => !row.found);
if (missing.length) {
  console.error(`Staging blocked: ${missing.length} product(s) were not found in Sanity.`);
  process.exit(2);
}
if (!apply) {
  console.log("Dry run only. Existing images and Sanity fields were not changed.");
  process.exit(0);
}

let transaction = sanity.transaction();
for (const row of rows) {
  const product = bySlug.get(row.slug);
  transaction = transaction.patch(product._id, (patch) =>
    patch
      .ifRevisionId(product._rev)
      .set({
        kentOfficialGalleryStatus: "STAGING",
        kentOfficialGallery: row.images,
        kentOfficialSourceUrl: row.sourceUrl,
        kentOfficialGalleryVerifiedAt: row.checkedAt,
        kentOfficialGalleryFingerprint: row.fingerprint,
        kentOfficialGalleryNotes: row.notes,
      }),
  );
}
await transaction.commit({ autoGenerateArrayKeys: true });
console.log(`Staged ${rows.length} official Kent gallery record(s). Existing active image data was preserved.`);
