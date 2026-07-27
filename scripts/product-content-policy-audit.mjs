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

const QUERY = `*[_type == "product"]{
  _id,
  title,
  "slug": slug.current,
  "brandKey": coalesce(brandSlug, themeKey, brand->slug.current, brand->themeKey),
  summary,
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
  docs[]{ title, label, url },
  imageUrls,
  galleryImageUrls,
  "uploadedImages": images[]{ "url": asset->url },
  variants[]{ variantId, sku, catNo, optionSummary, imageUrl }
}`;

const PRICE_HEADER_RE = /^(?:price|pricing|unit price|list price|retail price|sale price|dealer price|your price|online price|web price|net price|msrp|cost|amount)$/i;
const PRICE_PROMPT_RE = /(?:login|sign in)\s+(?:to|for)\s+(?:see\s+)?prices?|(?:call|contact us)\s+for\s+pric(?:e|ing)|price on request|starting (?:at|from)/i;
const MONEY_RE = /(?:[$€£¥₩]\s*\d[\d,.]*(?:\s*(?:USD|EUR|GBP|JPY|KRW))?|(?:USD|EUR|GBP|JPY|KRW)\s*\d[\d,.]*|\d[\d,.]*\s*(?:USD|EUR|GBP|JPY|KRW|원))/i;

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

function signature(value) {
  return textOnly(value)
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    url.hash = "";
    url.search = "";
    return `${url.hostname.toLowerCase().replace(/^www\./, "")}${decodeURIComponent(url.pathname).replace(/\/$/, "").toLowerCase()}`;
  } catch {
    return raw.toLowerCase().replace(/[?#].*$/, "").replace(/\/$/, "");
  }
}

function duplicateValues(values, normalizer = (value) => clean(value).toLowerCase()) {
  const seen = new Set();
  const duplicates = [];
  for (const value of values.filter(Boolean)) {
    const key = normalizer(value);
    if (!key) continue;
    if (seen.has(key)) duplicates.push(value);
    else seen.add(key);
  }
  return duplicates;
}

function sectionValues(product) {
  return Array.isArray(product.kentSections) ? product.kentSections.filter(Boolean) : [];
}

function allContent(product) {
  return [
    product.summary,
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
    JSON.stringify(product.kentSections || []),
  ]
    .filter(Boolean)
    .join("\n");
}

function audit(product) {
  const flags = [];
  const content = allContent(product);
  const sections = sectionValues(product);

  if (MONEY_RE.test(textOnly(content))) flags.push("monetary_amount_in_content");
  if (PRICE_PROMPT_RE.test(textOnly(content))) flags.push("supplier_pricing_prompt");
  if (/<(?:th|td)\b[^>]*>\s*(?:price|pricing|cost|amount|msrp)[^<]*<\/(?:th|td)>/i.test(content)) {
    flags.push("price_column_in_html");
  }

  const sectionSignatures = sections.map((section) =>
    signature(`${section?.title || ""} ${section?.html || section?.contentHtml || section?.bodyHtml || ""} ${JSON.stringify(section?.items || section?.rows || [])}`),
  );
  if (duplicateValues(sectionSignatures).length) flags.push("duplicate_structured_sections");

  const sectionTitles = sections.map((section) => signature(section?.title || "")).filter(Boolean);
  if (duplicateValues(sectionTitles).length) flags.push("duplicate_section_titles");

  const docs = (product.docs || []).map((doc) => doc?.url).filter(Boolean);
  if (duplicateValues(docs, normalizeUrl).length) flags.push("duplicate_document_urls");

  const images = [
    ...(product.imageUrls || []),
    ...(product.galleryImageUrls || []),
    ...(product.uploadedImages || []).map((image) => image?.url),
    ...(product.variants || []).map((variant) => variant?.imageUrl),
  ].filter(Boolean);
  if (duplicateValues(images, normalizeUrl).length) flags.push("duplicate_image_urls");

  const variantIds = (product.variants || []).map((variant) => variant?.variantId || variant?.catNo || variant?.sku).filter(Boolean);
  if (duplicateValues(variantIds).length) flags.push("duplicate_variant_identifiers");

  return {
    id: product._id,
    brand: clean(product.brandKey).toLowerCase(),
    title: clean(product.title),
    slug: clean(product.slug),
    flags,
  };
}

const products = await sanity.fetch(QUERY);
const audited = products.map(audit);
const needsFix = audited.filter((row) => row.flags.length);
const ready = audited.filter((row) => !row.flags.length);

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

const outDir = path.join(process.cwd(), ".cache", "product-content-policy");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "latest.json"), JSON.stringify({ summary, products: audited }, null, 2));

const lines = [
  "# Product content policy audit",
  "",
  `Generated: ${summary.generatedAt}`,
  `Total: ${summary.total}`,
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
    `- brand: ${row.brand || "unknown"}`,
    `- slug: ${row.slug || "missing"}`,
    `- flags: ${row.flags.join(", ")}`,
    "",
  ]),
];
fs.writeFileSync(path.join(outDir, "latest.md"), lines.join("\n"));

console.log(JSON.stringify(summary, null, 2));
console.log(`Report: ${path.relative(process.cwd(), path.join(outDir, "latest.md"))}`);
