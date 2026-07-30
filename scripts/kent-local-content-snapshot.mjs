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
  summary,
  sku,
  sourceUrl,
  productType,
  sourceIntroHtml,
  overviewHtml,
  extraHtml,
  legacyHtml,
  specsHtml,
  datasheetHtml,
  documentsHtml,
  faqsHtml,
  referencesHtml,
  reviewsHtml,
  kentSections,
  optionGroups,
  variants,
  imageUrls,
  galleryImageUrls,
  "images": images[]{
    _key,
    caption,
    sourceUrl,
    "assetId": asset->_id,
    "url": asset->url,
    "filename": asset->originalFilename,
    "width": asset->metadata.dimensions.width,
    "height": asset->metadata.dimensions.height
  }
}
`;

function cleanHtml(value) {
  return typeof value === "string" ? value.trim() : "";
}

function compact(row, index) {
  return {
    index: index + 1,
    sanityId: row?._id || "",
    title: row?.title || "",
    slug: row?.slug || "",
    summary: row?.summary || "",
    sku: row?.sku || "",
    sourceUrl: row?.sourceUrl || "",
    productType: row?.productType || "",
    html: {
      sourceIntroHtml: cleanHtml(row?.sourceIntroHtml),
      overviewHtml: cleanHtml(row?.overviewHtml),
      extraHtml: cleanHtml(row?.extraHtml),
      legacyHtml: cleanHtml(row?.legacyHtml),
      specsHtml: cleanHtml(row?.specsHtml),
      datasheetHtml: cleanHtml(row?.datasheetHtml),
      documentsHtml: cleanHtml(row?.documentsHtml),
      faqsHtml: cleanHtml(row?.faqsHtml),
      referencesHtml: cleanHtml(row?.referencesHtml),
      reviewsHtml: cleanHtml(row?.reviewsHtml),
    },
    kentSections: Array.isArray(row?.kentSections) ? row.kentSections : [],
    optionGroups: Array.isArray(row?.optionGroups) ? row.optionGroups : [],
    variants: Array.isArray(row?.variants) ? row.variants : [],
    images: Array.isArray(row?.images) ? row.images : [],
    imageUrls: Array.isArray(row?.imageUrls) ? row.imageUrls : [],
    galleryImageUrls: Array.isArray(row?.galleryImageUrls) ? row.galleryImageUrls : [],
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

const products = (await fetchRows()).map(compact);
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, "kent-local-content-snapshot.ndjson"),
  products.map((row) => JSON.stringify(row)).join("\n") + "\n",
);
fs.writeFileSync(
  path.join(outputDir, "kent-local-content-snapshot-meta.json"),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: `sanity://${projectId}/${dataset}`,
    productCount: products.length,
    format: "One product per line; ordered by lower(title).",
  }, null, 2) + "\n",
);
console.log(`Kent local content snapshot written: ${products.length} products`);
