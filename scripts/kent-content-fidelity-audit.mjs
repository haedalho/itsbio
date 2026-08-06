#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@sanity/client";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.SANITY_STUDIO_PROJECT_ID ||
  process.env.SANITY_PROJECT_ID;
const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_STUDIO_DATASET ||
  process.env.SANITY_DATASET;

if (!projectId || !dataset) {
  console.error("Missing Sanity project ID or dataset in .env.local.");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  apiVersion: "2025-02-19",
  useCdn: false,
});

const QUERY = `*[
  _type == "product"
  && coalesce(brandSlug, themeKey, brand->slug.current, brand->themeKey) == "kent"
]{
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
  optionGroups[]{ key, label, options[]{ value, label } },
  variants[]{ variantId, sku, catNo, optionSummary, imageUrl },
  imageUrls,
  galleryImageUrls,
  "uploadedImageCount": count(images)
}`;

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function textOnly(value) {
  return clean(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function firstParagraph(value) {
  const html = clean(value);
  const match = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return textOnly(match?.[1] || "");
}

function sourceCandidates(product) {
  return [product.sourceIntroHtml, product.overviewHtml, product.extraHtml, product.legacyHtml]
    .map((value) => clean(value))
    .filter(Boolean);
}

function combinedSource(product) {
  return [
    product.sourceIntroHtml,
    product.overviewHtml,
    product.extraHtml,
    product.legacyHtml,
    product.specsHtml,
    product.datasheetHtml,
    product.documentsHtml,
    product.faqsHtml,
    product.referencesHtml,
    product.reviewsHtml,
  ]
    .filter(Boolean)
    .join("\n");
}

function contentSignals(product) {
  const html = combinedSource(product);
  const text = textOnly(html);
  const sectionTypes = Array.isArray(product.kentSections)
    ? product.kentSections.map((section) => clean(section?.type).toLowerCase()).filter(Boolean)
    : [];

  return {
    textLength: text.length,
    headingCount: (html.match(/<h[2-4]\b/gi) || []).length,
    sectionCount: sectionTypes.length,
    longform:
      /what you get|base system includes|product specifications|resources|warranty information|what your peers say/i.test(text) ||
      text.length >= 900,
    commerceContamination:
      /login to see prices|add to cart|single_variation_wrap|display\s*:\s*none|!important/i.test(html),
    variantTableContamination:
      /\bvariant\b[\s\S]{0,180}\bsku\b[\s\S]{0,180}\boption\b[\s\S]{0,180}\bprice\b/i.test(text),
    priceColumn: /<(?:th|td)\b[^>]*>\s*(?:price|cost|amount|msrp)\s*<\/(?:th|td)>/i.test(html),
  };
}

function audit(product) {
  const flags = [];
  const candidates = sourceCandidates(product);
  const sourceIntro = firstParagraph(product.sourceIntroHtml) || firstParagraph(product.overviewHtml) || firstParagraph(product.extraHtml) || firstParagraph(product.legacyHtml);
  const summary = clean(product.summary);
  const signals = contentSignals(product);
  const hasImages = Number(product.uploadedImageCount || 0) > 0 || (product.galleryImageUrls || []).length > 0 || (product.imageUrls || []).length > 0;
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const groups = Array.isArray(product.optionGroups) ? product.optionGroups : [];

  if (!candidates.length && !summary) flags.push("missing_product_introduction");
  if (!sourceIntro && summary.length > 170) flags.push("long_summary_used_without_source_intro");
  if (sourceIntro && summary.length > 170 && !sourceIntro.toLowerCase().includes(summary.slice(0, 80).toLowerCase())) {
    flags.push("summary_may_be_rewritten_or_unrelated");
  }
  if (signals.longform && !signals.headingCount && !signals.sectionCount) flags.push("longform_without_ordered_sections");
  if (signals.commerceContamination) flags.push("commerce_html_contamination");
  if (signals.variantTableContamination) flags.push("variant_table_in_product_content");
  if (signals.priceColumn) flags.push("price_column_in_content");
  if (!hasImages) flags.push("missing_product_image");
  if ((variants.length > 1 || groups.length > 0) && product.productType !== "variant") flags.push("variant_product_type_mismatch");
  if (signals.textLength < 80 && !variants.length && !groups.length) flags.push("thin_source_content");

  return {
    id: product._id,
    title: clean(product.title),
    slug: clean(product.slug),
    sourceUrl: clean(product.sourceUrl),
    sku: clean(product.sku),
    sourceTextLength: signals.textLength,
    headingCount: signals.headingCount,
    sectionCount: signals.sectionCount,
    flags,
  };
}

const products = await sanity.fetch(QUERY);
const audited = products.map(audit);
const needsFix = audited.filter((row) => row.flags.length > 0);
const ready = audited.filter((row) => row.flags.length === 0);

const summary = {
  generatedAt: new Date().toISOString(),
  total: audited.length,
  ready: ready.length,
  needsFix: needsFix.length,
  flagCounts: Object.fromEntries(
    [...new Set(needsFix.flatMap((row) => row.flags))]
      .sort()
      .map((flag) => [flag, needsFix.filter((row) => row.flags.includes(flag)).length]),
  ),
};

const outDir = path.join(process.cwd(), ".cache", "kent-content-fidelity");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "latest.json"), JSON.stringify({ summary, products: audited }, null, 2));

const lines = [
  "# Kent content fidelity audit",
  "",
  `Generated: ${summary.generatedAt}`,
  `Total products: ${summary.total}`,
  `Ready: ${summary.ready}`,
  `Needs fix: ${summary.needsFix}`,
  "",
  "## Flag counts",
  "",
  ...Object.entries(summary.flagCounts).map(([flag, count]) => `- ${flag}: ${count}`),
  "",
  "## Products requiring review",
  "",
  ...needsFix.flatMap((row) => [
    `### ${row.title || row.slug || row.id}`,
    `- slug: ${row.slug || "missing"}`,
    `- Item #: ${row.sku || "missing"}`,
    `- source text: ${row.sourceTextLength}`,
    `- headings / structured sections: ${row.headingCount} / ${row.sectionCount}`,
    `- flags: ${row.flags.join(", ")}`,
    row.sourceUrl ? `- source: ${row.sourceUrl}` : "- source: missing",
    "",
  ]),
];
fs.writeFileSync(path.join(outDir, "latest.md"), lines.join("\n"));

console.log(JSON.stringify(summary, null, 2));
console.log(`Report: ${path.relative(process.cwd(), path.join(outDir, "latest.md"))}`);
