#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID || "9b5twpc8";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || "production";
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-02-19";
const root = process.cwd();
const outputDir = path.join(root, "data");
const baselinePath = path.join(outputDir, "kent-product-baseline.json");

const query = `
*[
  _type == "product"
  && (
    brandSlug == "kent"
    || themeKey == "kent"
    || brand->slug.current == "kent"
    || brand->themeKey == "kent"
  )
] | order(lower(title) asc) {
  _id,
  title,
  "slug": slug.current,
  sku,
  sourceUrl,
  summary,
  categoryPath,
  categoryPathTitles,
  listingPaths,
  productType,
  isActive,
  defaultVariantId,
  "galleryAssetCount": count(images[defined(asset)]),
  "galleryImageUrlCount": count(galleryImageUrls),
  "rawImageUrlCount": count(imageUrls),
  "sectionCount": count(kentSections),
  "variantCount": count(variants),
  "optionGroupCount": count(optionGroups)
}
`;

function classify(row) {
  const text = `${row.title || ""} ${row.slug || ""} ${row.sourceUrl || ""}`.toLowerCase();
  if (/warranty|extended warranty|premium warranty/.test(text)) return "EXCLUDE_WARRANTY";
  if (/service|certification|calibration|repair/.test(text)) return "REVIEW_SERVICE";
  return "PRODUCT";
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(" > ") : value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function readPrevious() {
  try {
    const parsed = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    const products = Array.isArray(parsed?.products) ? parsed.products : [];
    return {
      byId: new Map(products.filter((row) => row?.sanityId).map((row) => [row.sanityId, row])),
      bySlug: new Map(products.filter((row) => row?.slug).map((row) => [row.slug, row])),
    };
  } catch {
    return { byId: new Map(), bySlug: new Map() };
  }
}

async function fetchProducts() {
  const url = new URL(`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`);
  url.searchParams.set("query", query);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Sanity query failed: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  if (!Array.isArray(payload?.result)) throw new Error("Sanity query did not return a product array.");
  return payload.result;
}

function normalize(rows, previous) {
  return rows.map((row, index) => {
    const prior = previous.byId.get(row._id) || previous.bySlug.get(row.slug) || {};
    const recordType = classify(row);
    return {
      index: index + 1,
      sanityId: row._id || "",
      title: row.title || "",
      slug: row.slug || "",
      sku: row.sku || "",
      sourceUrl: row.sourceUrl || "",
      categoryPath: Array.isArray(row.categoryPath) ? row.categoryPath : [],
      categoryPathTitles: Array.isArray(row.categoryPathTitles) ? row.categoryPathTitles : [],
      listingPaths: Array.isArray(row.listingPaths) ? row.listingPaths : [],
      productType: row.productType || "",
      isActive: row.isActive !== false,
      recordType,
      verificationStatus: recordType === "EXCLUDE_WARRANTY" ? "EXCLUDE" : prior.verificationStatus || "UNVERIFIED",
      galleryAssetCount: Number(row.galleryAssetCount || 0),
      galleryImageUrlCount: Number(row.galleryImageUrlCount || 0),
      rawImageUrlCount: Number(row.rawImageUrlCount || 0),
      sectionCount: Number(row.sectionCount || 0),
      variantCount: Number(row.variantCount || 0),
      optionGroupCount: Number(row.optionGroupCount || 0),
      officialTitle: prior.officialTitle || "",
      officialSubtitle: prior.officialSubtitle || "",
      officialSku: prior.officialSku || "",
      officialSourceUrl: prior.officialSourceUrl || "",
      officialGalleryCount: prior.officialGalleryCount ?? null,
      officialSectionCount: prior.officialSectionCount ?? null,
      verifiedAt: prior.verifiedAt || "",
      notes: prior.notes || "",
    };
  });
}

function writeOutputs(products) {
  fs.mkdirSync(outputDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const productCount = products.filter((row) => row.recordType === "PRODUCT").length;
  const warrantyCount = products.filter((row) => row.recordType === "EXCLUDE_WARRANTY").length;
  const serviceReviewCount = products.filter((row) => row.recordType === "REVIEW_SERVICE").length;
  const countStatus = (status) => products.filter((row) => row.verificationStatus === status).length;
  const report = {
    generatedAt,
    source: `sanity://${projectId}/${dataset}`,
    total: products.length,
    counts: { product: productCount, warranty: warrantyCount, serviceReview: serviceReviewCount },
    statusCounts: {
      VERIFIED: countStatus("VERIFIED"),
      NEEDS_FIX: countStatus("NEEDS_FIX"),
      UNRESOLVED: countStatus("UNRESOLVED"),
      EXCLUDE: countStatus("EXCLUDE"),
      UNVERIFIED: countStatus("UNVERIFIED"),
    },
    products,
  };

  fs.writeFileSync(baselinePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const columns = [
    "index", "sanityId", "title", "slug", "sku", "sourceUrl", "categoryPath", "productType", "isActive",
    "recordType", "verificationStatus", "galleryAssetCount", "galleryImageUrlCount", "rawImageUrlCount", "sectionCount",
    "variantCount", "optionGroupCount", "officialTitle", "officialSubtitle", "officialSku", "officialSourceUrl",
    "officialGalleryCount", "officialSectionCount", "verifiedAt", "notes",
  ];
  const csv = [columns.join(","), ...products.map((row) => columns.map((key) => csvCell(row[key])).join(","))].join("\n") + "\n";
  fs.writeFileSync(path.join(outputDir, "kent-product-baseline.csv"), csv, "utf8");

  const status = report.statusCounts;
  const markdown = [
    "# Kent product baseline",
    "",
    `Generated: ${generatedAt}`,
    `Source: Sanity project ${projectId}, dataset ${dataset}`,
    "",
    `- Total Sanity rows: ${products.length}`,
    `- Product candidates: ${productCount}`,
    `- Warranty exclusions: ${warrantyCount}`,
    `- Service review: ${serviceReviewCount}`,
    `- Verified: ${status.VERIFIED}`,
    `- Needs fix: ${status.NEEDS_FIX}`,
    `- Unresolved: ${status.UNRESOLVED}`,
    `- Unverified: ${status.UNVERIFIED}`,
    "",
    "| # | Product | Slug | Item # | Record type | Status | Source URL |",
    "|---:|---|---|---|---|---|---|",
    ...products.map((row) => `| ${row.index} | ${String(row.title).replace(/\|/g, "\\|")} | ${row.slug} | ${row.sku} | ${row.recordType} | ${row.verificationStatus} | ${row.sourceUrl || ""} |`),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outputDir, "kent-product-baseline.md"), markdown, "utf8");
  console.log(`Kent baseline written: total=${products.length}, products=${productCount}, warranties=${warrantyCount}, serviceReview=${serviceReviewCount}`);
}

const previous = readPrevious();
const rows = await fetchProducts();
writeOutputs(normalize(rows, previous));
