#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { createClient } from "@sanity/client";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const args = new Set(process.argv.slice(2));
const slugArg = process.argv.find((value) => value.startsWith("--slug="));
const slug = String(slugArg?.split("=").slice(1).join("=") || "").trim();
const apply = args.has("--apply");
const confirmReplace = args.has("--confirm-replace-active-gallery");
const deleteOrphanAssets = args.has("--delete-orphan-assets");

if (!slug) {
  console.error("Missing --slug=<product-slug>");
  process.exit(1);
}

if (apply && !confirmReplace) {
  console.error("Write blocked: --apply also requires --confirm-replace-active-gallery");
  process.exit(1);
}

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

const PRODUCT_QUERY = `
*[
  _type == "product"
  && slug.current == $slug
  && (
    brandSlug == "kent"
    || themeKey == "kent"
    || brand->slug.current == "kent"
    || brand->themeKey == "kent"
  )
][0]{
  _id,
  _rev,
  title,
  "slug": slug.current,
  sku,
  sourceUrl,
  images[]{
    _key,
    _type,
    caption,
    sourceUrl,
    asset->{_id, originalFilename, url, metadata{dimensions{width,height}}}
  },
  imageUrls,
  galleryImageUrls,
  imageFiles,
  kentOfficialGalleryStatus,
  kentOfficialGallery[]{
    _key,
    sourceUrl,
    alt,
    order,
    sourceWidth,
    sourceHeight,
    sourceFingerprint
  },
  kentOfficialSourceUrl,
  kentOfficialGalleryVerifiedAt,
  kentOfficialGalleryFingerprint,
  kentOfficialGalleryNotes
}
`;

function normalizedOfficialRows(product) {
  const rows = Array.isArray(product?.kentOfficialGallery) ? product.kentOfficialGallery : [];
  const seen = new Set();
  return rows
    .map((row, index) => ({
      sourceUrl: String(row?.sourceUrl || "").trim(),
      alt: String(row?.alt || product?.title || "").trim(),
      order: Number.isFinite(Number(row?.order)) ? Number(row.order) : index,
      sourceWidth: Number(row?.sourceWidth || 0),
      sourceHeight: Number(row?.sourceHeight || 0),
      sourceFingerprint: String(row?.sourceFingerprint || "").trim(),
    }))
    .filter((row) => {
      if (!row.sourceUrl || seen.has(row.sourceUrl)) return false;
      const url = new URL(row.sourceUrl);
      if (url.protocol !== "https:") throw new Error(`Non-HTTPS official image URL: ${row.sourceUrl}`);
      const host = url.hostname.toLowerCase();
      if (host !== "kentscientific.com" && host !== "www.kentscientific.com") {
        throw new Error(`Non-Kent official image URL: ${row.sourceUrl}`);
      }
      if (/(?:^|\/)thumb(?:s|nail)?(?:\/|[-_.])/i.test(url.pathname)) {
        throw new Error(`Thumbnail URL cannot be promoted: ${row.sourceUrl}`);
      }
      seen.add(row.sourceUrl);
      return true;
    })
    .sort((a, b) => a.order - b.order);
}

function backupFileName(product) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(process.cwd(), ".cache", "kent-gallery-backups", `${stamp}-${product.slug}.json`);
}

function writeBackup(product, rows) {
  const file = backupFileName(product);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        backedUpAt: new Date().toISOString(),
        productId: product._id,
        productRevision: product._rev,
        title: product.title,
        slug: product.slug,
        old: {
          images: product.images || [],
          imageUrls: product.imageUrls || [],
          galleryImageUrls: product.galleryImageUrls || [],
          imageFiles: product.imageFiles || [],
        },
        approvedOfficialGallery: rows,
      },
      null,
      2,
    ) + "\n",
  );
  return file;
}

function fileNameFromUrl(url, index) {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).at(-1) || "");
    return name || `kent-official-${index + 1}.jpg`;
  } catch {
    return `kent-official-${index + 1}.jpg`;
  }
}

async function downloadOfficialImage(row, index) {
  const response = await fetch(row.sourceUrl, {
    redirect: "follow",
    headers: { accept: "image/*" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Image download failed (${response.status}): ${row.sourceUrl}`);
  const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim();
  if (!contentType.startsWith("image/")) throw new Error(`Unexpected content type ${contentType}: ${row.sourceUrl}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 10_000) throw new Error(`Official image file is unexpectedly small: ${row.sourceUrl}`);
  const fingerprint = crypto.createHash("sha256").update(bytes).digest("hex");
  if (row.sourceFingerprint && row.sourceFingerprint !== fingerprint) {
    throw new Error(`Official image fingerprint changed: ${row.sourceUrl}`);
  }
  return {
    bytes,
    contentType,
    filename: fileNameFromUrl(row.sourceUrl, index),
    fingerprint,
  };
}

async function uploadOfficialRows(rows) {
  const uploaded = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const file = await downloadOfficialImage(row, index);
    const asset = await sanity.assets.upload("image", file.bytes, {
      filename: file.filename,
      contentType: file.contentType,
      label: `Kent official gallery: ${slug} #${index + 1}`,
      title: row.alt || file.filename,
      source: {
        id: file.fingerprint,
        name: "Kent Scientific official product gallery",
        url: row.sourceUrl,
      },
    });
    uploaded.push({ row, asset, fingerprint: file.fingerprint });
  }
  return uploaded;
}

async function deleteUnusedOldAssets(oldImages, newAssetIds) {
  const oldIds = [...new Set((oldImages || []).map((row) => row?.asset?._id).filter(Boolean))];
  const results = [];
  for (const assetId of oldIds) {
    if (newAssetIds.has(assetId)) continue;
    const referenceCount = await sanity.fetch(`count(*[references($assetId)])`, { assetId });
    if (referenceCount > 0) {
      results.push({ assetId, deleted: false, reason: `still_referenced:${referenceCount}` });
      continue;
    }
    await sanity.delete(assetId);
    results.push({ assetId, deleted: true });
  }
  return results;
}

const product = await sanity.fetch(PRODUCT_QUERY, { slug });
if (!product?._id) {
  console.error(`Kent product not found: ${slug}`);
  process.exit(1);
}

const rows = normalizedOfficialRows(product);
const report = {
  mode: apply ? "APPLY" : "DRY_RUN",
  productId: product._id,
  title: product.title,
  slug: product.slug,
  status: product.kentOfficialGalleryStatus || "UNVERIFIED",
  officialSourceUrl: product.kentOfficialSourceUrl || product.sourceUrl || "",
  officialGalleryCount: rows.length,
  oldUploadedImageCount: Array.isArray(product.images) ? product.images.length : 0,
  oldImageUrlCount: Array.isArray(product.imageUrls) ? product.imageUrls.length : 0,
  oldGalleryImageUrlCount: Array.isArray(product.galleryImageUrls) ? product.galleryImageUrls.length : 0,
  oldImageFileCount: Array.isArray(product.imageFiles) ? product.imageFiles.length : 0,
  willUnset: ["imageUrls", "galleryImageUrls", "imageFiles"],
  willReplace: ["images"],
  deleteOrphanAssets,
};

console.log(JSON.stringify(report, null, 2));

if (!rows.length) {
  console.error("Promotion blocked: kentOfficialGallery is empty.");
  process.exit(2);
}
if (product.kentOfficialGalleryStatus !== "APPROVED") {
  console.error("Promotion blocked: gallery status must be APPROVED after visual review.");
  process.exit(2);
}
if (!apply) {
  console.log("Dry run only. No Sanity data or assets were changed.");
  process.exit(0);
}

const backupPath = writeBackup(product, rows);
const uploaded = await uploadOfficialRows(rows);
const newImages = uploaded.map(({ row, asset }, index) => ({
  _key: `kent-official-${index + 1}-${asset._id.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
  _type: "image",
  asset: { _type: "reference", _ref: asset._id },
  caption: row.alt || product.title,
  sourceUrl: row.sourceUrl,
}));
const galleryFingerprint = crypto
  .createHash("sha256")
  .update(uploaded.map((row) => row.fingerprint).join("|"))
  .digest("hex");

await sanity
  .patch(product._id)
  .ifRevisionId(product._rev)
  .set({
    images: newImages,
    kentOfficialGalleryStatus: "APPROVED",
    kentOfficialGalleryVerifiedAt: new Date().toISOString(),
    kentOfficialGalleryFingerprint: galleryFingerprint,
    kentOfficialGalleryNotes: `Active gallery replaced from approved Kent official gallery. Backup: ${path.relative(process.cwd(), backupPath)}`,
  })
  .unset(["imageUrls", "galleryImageUrls", "imageFiles", "kentOfficialGallery"])
  .commit({ autoGenerateArrayKeys: true });

let orphanCleanup = [];
if (deleteOrphanAssets) {
  orphanCleanup = await deleteUnusedOldAssets(
    product.images,
    new Set(uploaded.map((row) => row.asset._id)),
  );
}

console.log(
  JSON.stringify(
    {
      promoted: true,
      productId: product._id,
      slug: product.slug,
      activeOfficialImages: newImages.length,
      backupPath,
      orphanCleanup,
    },
    null,
    2,
  ),
);
