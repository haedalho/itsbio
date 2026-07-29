#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID || "9b5twpc8";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || "production";
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-02-19";
const outputDir = path.join(process.cwd(), "data");

const query = `
*[
  _type == "product"
  && (
    brandSlug == "kent"
    || themeKey == "kent"
    || brand->slug.current == "kent"
    || brand->themeKey == "kent"
  )
  && !(
    lower(coalesce(title, "")) match "*warranty*"
    || lower(coalesce(slug.current, "")) match "*warranty*"
  )
] | order(lower(title) asc) {
  _id,
  title,
  "slug": slug.current,
  sku,
  sourceUrl,
  kentOfficialGalleryStatus,
  "managedImages": images[defined(asset)]{
    _key,
    "assetId": asset->_id,
    "url": asset->url,
    "filename": asset->originalFilename,
    "width": asset->metadata.dimensions.width,
    "height": asset->metadata.dimensions.height
  },
  galleryImageUrls,
  imageUrls,
  "variantImageUrls": variants[defined(imageUrl)].imageUrl
}
`;

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(" | ") : value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function isSanityUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "cdn.sanity.io";
  } catch {
    return false;
  }
}

function normalize(row, index) {
  const managed = (Array.isArray(row?.managedImages) ? row.managedImages : []).filter((image) => isSanityUrl(image?.url));
  const legacy = [
    ...(Array.isArray(row?.galleryImageUrls) ? row.galleryImageUrls : []),
    ...(Array.isArray(row?.imageUrls) ? row.imageUrls : []),
    ...(Array.isArray(row?.variantImageUrls) ? row.variantImageUrls : []),
  ].map((value) => String(value || "").trim()).filter(Boolean);
  const uniqueManaged = [...new Map(managed.map((image) => [image.assetId || image.url, image])).values()];
  const uniqueLegacy = [...new Set(legacy)];
  let status = "MISSING";
  if (uniqueManaged.length === 1) status = "MANAGED_SINGLE";
  else if (uniqueManaged.length > 1) status = "MANAGED_MULTI_REVIEW";
  else if (uniqueLegacy.length) status = "LEGACY_ONLY";

  return {
    index: index + 1,
    sanityId: row?._id || "",
    title: row?.title || "",
    slug: row?.slug || "",
    sku: row?.sku || "",
    sourceUrl: row?.sourceUrl || "",
    verificationStatus: row?.kentOfficialGalleryStatus || "UNVERIFIED",
    status,
    managedImageCount: uniqueManaged.length,
    managedImages: uniqueManaged,
    legacyImageUrlCount: uniqueLegacy.length,
    legacyImageUrls: uniqueLegacy,
  };
}

async function fetchRows() {
  const url = new URL(`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`);
  url.searchParams.set("query", query);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Sanity query failed: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  if (!Array.isArray(payload?.result)) throw new Error("Sanity query did not return an array.");
  return payload.result;
}

const rows = (await fetchRows()).map(normalize);
const counts = rows.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] || 0) + 1;
  return acc;
}, {});
const generatedAt = new Date().toISOString();
const report = {
  generatedAt,
  source: `sanity://${projectId}/${dataset}`,
  totalProducts: rows.length,
  counts: {
    managedSingle: counts.MANAGED_SINGLE || 0,
    managedMultiReview: counts.MANAGED_MULTI_REVIEW || 0,
    legacyOnly: counts.LEGACY_ONLY || 0,
    missing: counts.MISSING || 0,
  },
  products: rows,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "kent-image-asset-audit.json"), JSON.stringify(report, null, 2) + "\n");

const headers = [
  "index", "status", "title", "slug", "sku", "verificationStatus",
  "managedImageCount", "legacyImageUrlCount", "managedImageUrls", "legacyImageUrls", "sourceUrl",
];
const csv = [
  headers.join(","),
  ...rows.map((row) => [
    row.index,
    row.status,
    row.title,
    row.slug,
    row.sku,
    row.verificationStatus,
    row.managedImageCount,
    row.legacyImageUrlCount,
    row.managedImages.map((image) => image.url),
    row.legacyImageUrls,
    row.sourceUrl,
  ].map(csvCell).join(",")),
].join("\n") + "\n";
fs.writeFileSync(path.join(outputDir, "kent-image-asset-audit.csv"), csv);

const md = [
  "# Kent image asset audit",
  "",
  `Generated: ${generatedAt}`,
  `Source: Sanity project ${projectId}, dataset ${dataset}`,
  "",
  `- Product candidates: ${rows.length}`,
  `- Managed single image: ${report.counts.managedSingle}`,
  `- Managed multiple images requiring review: ${report.counts.managedMultiReview}`,
  `- Legacy URLs only: ${report.counts.legacyOnly}`,
  `- No image data: ${report.counts.missing}`,
  "",
  "| # | Status | Product | Slug | Sanity assets | Legacy URLs |",
  "|---:|---|---|---|---:|---:|",
  ...rows.map((row) => `| ${row.index} | ${row.status} | ${String(row.title).replaceAll("|", "\\|")} | ${row.slug} | ${row.managedImageCount} | ${row.legacyImageUrlCount} |`),
  "",
].join("\n");
fs.writeFileSync(path.join(outputDir, "kent-image-asset-audit.md"), md);

console.log(JSON.stringify(report.counts));
