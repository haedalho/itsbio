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
  && !(lower(coalesce(title, "")) match "*warranty*" || lower(coalesce(slug.current, "")) match "*warranty*")
] | order(lower(title) asc) {
  _id,
  title,
  "slug": slug.current,
  summary,
  sku,
  sourceUrl,
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
  "images": images[]{
    "assetId": asset->_id,
    "url": asset->url,
    "filename": asset->originalFilename,
    "width": asset->metadata.dimensions.width,
    "height": asset->metadata.dimensions.height,
    sourceUrl
  },
  imageUrls,
  galleryImageUrls
}
`;

const PRICE_RE = /(?:[$€£¥₩]\s*\d|\b(?:USD|EUR|GBP|JPY|KRW)\b|\bprice\b|login to see prices|add to cart|choose an option|quantity|calculate your savings|annual calibration cost|\.single_variation_wrap)/i;
const SUPPORT_RE = /need help with your order|chat with an expert|call\s+888-572-8887|product specialists are here to help|ask a question/i;

function textOnly(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function signature(value) {
  return textOnly(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function combined(row) {
  return [
    row?.summary,
    row?.sourceIntroHtml,
    row?.overviewHtml,
    row?.extraHtml,
    row?.legacyHtml,
    row?.specsHtml,
    row?.datasheetHtml,
    row?.documentsHtml,
    row?.faqsHtml,
    row?.referencesHtml,
    row?.reviewsHtml,
    JSON.stringify(row?.kentSections || []),
  ].filter(Boolean).join("\n");
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

const rows = await fetchRows();
const titleBySignature = new Map();
for (const row of rows) {
  const key = signature(row?.title);
  if (key) titleBySignature.set(key, { title: row?.title || "", slug: row?.slug || "" });
}

const products = rows.map((row, index) => {
  const flags = [];
  const raw = combined(row);
  const text = textOnly(raw);
  const summaryKey = signature(row?.summary);
  const ownTitleKey = signature(row?.title);
  const summaryProduct = titleBySignature.get(summaryKey);

  if (!row?.title || !row?.slug) flags.push("missing_title_or_slug");
  if (!row?.sourceUrl) flags.push("missing_official_source_url");
  if (!row?.summary) flags.push("missing_summary");
  if (summaryProduct && summaryKey !== ownTitleKey) {
    flags.push(`summary_is_other_product:${summaryProduct.slug}`);
  }
  if (PRICE_RE.test(raw)) flags.push("price_or_commerce_contamination");
  if (SUPPORT_RE.test(raw)) flags.push("supplier_support_contamination");

  const sections = Array.isArray(row?.kentSections) ? row.kentSections : [];
  if (!sections.length) flags.push("no_structured_sections");

  const variants = Array.isArray(row?.variants) ? row.variants : [];
  const variantSkus = variants.map((variant) => String(variant?.sku || variant?.catNo || "").trim()).filter(Boolean);
  const seenSkus = new Set();
  const duplicateSkus = [...new Set(variantSkus.filter((sku) => seenSkus.has(sku) || !seenSkus.add(sku)))];
  if (duplicateSkus.length) flags.push(`duplicate_variant_sku:${duplicateSkus.join("|")}`);

  const images = Array.isArray(row?.images) ? row.images : [];
  if (!images.length) flags.push("no_sanity_image_asset");
  const lowRes = images.filter((image) => Number(image?.width || 0) < 300 || Number(image?.height || 0) < 300);
  if (lowRes.length) flags.push(`low_resolution_assets:${lowRes.length}`);
  const duplicateAssetIds = images.map((image) => image?.assetId).filter(Boolean);
  if (new Set(duplicateAssetIds).size !== duplicateAssetIds.length) flags.push("duplicate_image_asset_reference");
  if ((row?.imageUrls || []).length || (row?.galleryImageUrls || []).length) flags.push("legacy_image_url_arrays_present");

  const sourceTitles = [...titleBySignature.entries()]
    .filter(([key, value]) => key !== ownTitleKey && key.length >= 8 && signature(text.slice(0, 220)).includes(key))
    .map(([, value]) => value.slug)
    .slice(0, 5);
  if (sourceTitles.length) flags.push(`content_starts_with_other_products:${sourceTitles.join("|")}`);

  return {
    index: index + 1,
    sanityId: row?._id || "",
    title: row?.title || "",
    slug: row?.slug || "",
    sku: row?.sku || "",
    sourceUrl: row?.sourceUrl || "",
    status: flags.length ? "NEEDS_FIX_CONFIRMED" : "OFFICIAL_REVIEW_REQUIRED",
    flags,
  };
});

const flagCounts = {};
for (const product of products) {
  for (const flag of product.flags) {
    const key = flag.split(":")[0];
    flagCounts[key] = (flagCounts[key] || 0) + 1;
  }
}
const summary = {
  generatedAt: new Date().toISOString(),
  productCount: products.length,
  needsFixConfirmed: products.filter((row) => row.status === "NEEDS_FIX_CONFIRMED").length,
  officialReviewRequired: products.filter((row) => row.status === "OFFICIAL_REVIEW_REQUIRED").length,
  flagCounts,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "kent-catalog-local-defect-audit.json"), JSON.stringify({ summary, products }, null, 2) + "\n");

const lines = [
  "# Kent catalog local defect audit",
  "",
  `Generated: ${summary.generatedAt}`,
  `Products: ${summary.productCount}`,
  `Confirmed NEEDS_FIX before official comparison: ${summary.needsFixConfirmed}`,
  `No confirmed local defect yet; official review still required: ${summary.officialReviewRequired}`,
  "",
  "## Flag counts",
  "",
  ...Object.entries(flagCounts).sort((a, b) => b[1] - a[1]).map(([flag, count]) => `- ${flag}: ${count}`),
  "",
  "## Products",
  "",
  ...products.flatMap((product) => [
    `### ${product.index}. ${product.title}`,
    `- slug: ${product.slug}`,
    `- status: ${product.status}`,
    `- flags: ${product.flags.length ? product.flags.join(", ") : "none"}`,
    "",
  ]),
];
fs.writeFileSync(path.join(outputDir, "kent-catalog-local-defect-audit.md"), lines.join("\n") + "\n");
console.log(JSON.stringify(summary));
