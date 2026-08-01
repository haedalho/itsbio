#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import dotenv from "dotenv";
import { createClient } from "next-sanity";

const ROOT = process.cwd();
dotenv.config({ path: path.join(ROOT, ".env.local") });
dotenv.config({ path: path.join(ROOT, ".env") });

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const readArg = (flag, fallback = "") => {
  const index = argv.indexOf(flag);
  return index >= 0 ? String(argv[index + 1] ?? fallback) : fallback;
};

if (has("--write")) {
  throw new Error("This command is audit-only. Kent writes require a separately reviewed migration plan.");
}

const CATALOG_PATH = path.resolve(
  ROOT,
  readArg("--catalog", "data/kent-official-product-ids-2026.json"),
);
const OUTPUT_DIR = path.resolve(
  ROOT,
  readArg("--output", ".cache/kent-official-catalog-audit"),
);
const JSON_PATH = path.join(OUTPUT_DIR, "latest.json");
const MARKDOWN_PATH = path.join(OUTPUT_DIR, "latest.md");
const BRAND_ALIASES = ["kent", "kentscientifics"];

function clean(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeId(value) {
  const normalized = clean(value)
    .replace(/^item\s*#?\s*:?\s*/i, "")
    .replace(/^cat(?:alog)?\.?\s*(?:no\.?|#)?\s*:?\s*/i, "")
    .toUpperCase();
  if (!normalized || /^(?:N\/?A|NONE|NULL|UNDEFINED|-)$/.test(normalized)) return "";
  return normalized;
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function candidateIds(value, officialSet) {
  if (Array.isArray(value)) {
    return unique(value.flatMap((item) => candidateIds(item, officialSet)));
  }

  const raw = clean(value);
  if (!raw) return [];

  const matches = [];
  const whole = normalizeId(raw);
  if (officialSet.has(whole)) matches.push(whole);

  for (const part of raw.split(/[\n,;|/]+/g)) {
    const normalized = normalizeId(part);
    if (officialSet.has(normalized)) matches.push(normalized);
  }

  return unique(matches);
}

function isWarranty(product) {
  return /\bwarrant(?:y|ies)\b/i.test(
    `${clean(product.title)} ${clean(product.slug)} ${clean(product.productType)}`,
  );
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function writeJson(filePath, value) {
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function productSummary(product) {
  return {
    _id: product._id,
    title: product.title || "",
    slug: product.slug || "",
    sku: product.sku || "",
    catNo: product.catNo || "",
    sourceUrl: product.sourceUrl || "",
    productType: product.productType || "",
    isActive: product.isActive,
  };
}

function distinctProducts(matches) {
  const byId = new Map();
  for (const match of matches || []) {
    if (!match?.product?._id) continue;
    if (!byId.has(match.product._id)) byId.set(match.product._id, match.product);
  }
  return [...byId.values()];
}

function renderMarkdown(report) {
  const lines = [
    "# Kent official catalog audit",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Official product IDs: ${report.counts.officialIds}`,
    `- Sanity Kent documents: ${report.counts.sanityDocuments}`,
    `- Sanity product documents: ${report.counts.sanityProducts}`,
    `- Warranty documents: ${report.counts.warrantyDocuments}`,
    `- Official IDs matched as primary product SKU: ${report.counts.primaryMatched}`,
    `- Official IDs matched only inside variants: ${report.counts.variantMatched}`,
    `- Official IDs matched in both product and variant fields: ${report.counts.mixedMatched}`,
    `- Official IDs matched to multiple product documents: ${report.counts.conflictedOfficialIds}`,
    `- Official IDs not matched in Sanity: ${report.counts.unmatchedOfficialIds}`,
    `- Sanity products with no official-ID match: ${report.counts.sanityOnlyProducts}`,
    "",
    "## Interpretation",
    "",
    "- `variantMatched` confirms official catalog rows that belong inside an existing product's variants rather than becoming standalone product pages.",
    "- `unmatchedOfficialIds` are review candidates only. They must not be auto-published because the official ID list includes accessories, parts, consumables, and option SKUs.",
    "- `sanityOnlyProducts` are preserved legacy/current records. They are not delete candidates.",
    "- No Kent web requests are made by this audit.",
    "- No Sanity documents are modified.",
    "",
    `## Unmatched official IDs (${report.unmatchedOfficialIds.length})`,
    "",
  ];

  if (!report.unmatchedOfficialIds.length) lines.push("- None");
  for (const id of report.unmatchedOfficialIds) lines.push(`- \`${id}\``);

  lines.push("", `## Conflicted official IDs (${report.conflictedOfficialIds.length})`, "");
  if (!report.conflictedOfficialIds.length) lines.push("- None");
  for (const row of report.conflictedOfficialIds) {
    lines.push(
      `- \`${row.officialId}\` → ${row.products
        .map((product) => `\`${product.slug || product._id}\``)
        .join(", ")}`,
    );
  }

  lines.push("", `## Sanity products with no official-ID match (${report.sanityOnlyProducts.length})`, "");
  if (!report.sanityOnlyProducts.length) lines.push("- None");
  for (const product of report.sanityOnlyProducts) {
    lines.push(
      `- **${product.title || product._id}** — \`${product.slug || "no-slug"}\`${
        product.sku ? ` · SKU ${product.sku}` : ""
      }`,
    );
  }

  lines.push("", `## Variant-only official matches (${report.variantOnlyMatches.length})`, "");
  if (!report.variantOnlyMatches.length) lines.push("- None");
  for (const row of report.variantOnlyMatches) {
    const match = row.matches[0];
    lines.push(
      `- \`${row.officialId}\` → **${match.product.title || match.product._id}** · \`${
        match.product.slug || "no-slug"
      }\``,
    );
  }

  lines.push("", "## Rules", "");
  lines.push("- Existing Sanity data is preserved.");
  lines.push("- Product title alone is never used to merge or delete.");
  lines.push("- Option SKUs stay in `variants` under one canonical product document.");
  lines.push("- Empty collected values never overwrite existing values.");
  lines.push("- Any future write requires a reviewed, deterministic plan generated from this audit.");
  lines.push("");

  return lines.join("\n");
}

async function main() {
  if (!fs.existsSync(CATALOG_PATH)) {
    throw new Error(`Official Kent catalog ID file not found: ${CATALOG_PATH}`);
  }

  const officialRaw = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  if (!Array.isArray(officialRaw)) {
    throw new Error("Official Kent catalog file must be a JSON array of product IDs.");
  }

  const normalizedOfficial = officialRaw.map(normalizeId).filter(Boolean);
  const officialIds = unique(normalizedOfficial);
  if (officialIds.length < 500) {
    throw new Error(`Safety stop: expected at least 500 official IDs, found ${officialIds.length}.`);
  }

  const officialSet = new Set(officialIds);
  const duplicateOfficialIds = unique(
    normalizedOfficial.filter((id, index) => normalizedOfficial.indexOf(id) !== index),
  );

  const projectId =
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
    process.env.SANITY_STUDIO_PROJECT_ID ||
    process.env.SANITY_PROJECT_ID;
  const dataset =
    process.env.NEXT_PUBLIC_SANITY_DATASET ||
    process.env.SANITY_STUDIO_DATASET ||
    process.env.SANITY_DATASET;

  if (!projectId || !dataset) {
    throw new Error("Missing Sanity project ID or dataset in .env.local/.env.");
  }

  const sanity = createClient({
    projectId,
    dataset,
    apiVersion: "2025-02-19",
    useCdn: false,
  });

  const products = await sanity.fetch(
    `*[_type == "product" && (
      brandSlug in $aliases ||
      themeKey in $aliases ||
      brand->slug.current in $aliases ||
      brand->themeKey in $aliases
    )]{
      _id,
      title,
      "slug": slug.current,
      sku,
      catNo,
      itemNumber,
      productCode,
      sourceUrl,
      productType,
      isActive,
      variants[]{
        _key,
        title,
        sku,
        catNo,
        itemNumber,
        variantId,
        sourceVariationId,
        optionSummary
      }
    }`,
    { aliases: BRAND_ALIASES },
  );

  const warrantyProducts = products.filter(isWarranty);
  const normalProducts = products.filter((product) => !isWarranty(product));
  const matchesByOfficialId = new Map(officialIds.map((id) => [id, []]));
  const matchedProductIds = new Set();

  for (const product of normalProducts) {
    const primaryIds = unique([
      ...candidateIds(product.sku, officialSet),
      ...candidateIds(product.catNo, officialSet),
      ...candidateIds(product.itemNumber, officialSet),
      ...candidateIds(product.productCode, officialSet),
    ]);

    for (const officialId of primaryIds) {
      matchesByOfficialId.get(officialId).push({
        kind: "primary",
        field: "product",
        product: productSummary(product),
      });
      matchedProductIds.add(product._id);
    }

    for (const variant of product.variants || []) {
      const variantIds = unique([
        ...candidateIds(variant.sku, officialSet),
        ...candidateIds(variant.catNo, officialSet),
        ...candidateIds(variant.itemNumber, officialSet),
        ...candidateIds(variant.variantId, officialSet),
        ...candidateIds(variant.sourceVariationId, officialSet),
      ]);

      for (const officialId of variantIds) {
        matchesByOfficialId.get(officialId).push({
          kind: "variant",
          field: "variant",
          product: productSummary(product),
          variant: {
            _key: variant._key || "",
            title: variant.title || "",
            sku: variant.sku || "",
            catNo: variant.catNo || "",
            itemNumber: variant.itemNumber || "",
            variantId: variant.variantId || "",
            sourceVariationId: variant.sourceVariationId || "",
            optionSummary: variant.optionSummary || "",
          },
        });
        matchedProductIds.add(product._id);
      }
    }
  }

  const matched = [];
  const unmatchedOfficialIds = [];
  const conflictedOfficialIds = [];
  const variantOnlyMatches = [];
  let primaryMatched = 0;
  let variantMatched = 0;
  let mixedMatched = 0;

  for (const officialId of officialIds) {
    const rawMatches = matchesByOfficialId.get(officialId) || [];
    const productsForId = distinctProducts(rawMatches);
    const hasPrimary = rawMatches.some((row) => row.kind === "primary");
    const hasVariant = rawMatches.some((row) => row.kind === "variant");

    if (!rawMatches.length) {
      unmatchedOfficialIds.push(officialId);
      continue;
    }

    if (productsForId.length > 1) {
      conflictedOfficialIds.push({
        officialId,
        products: productsForId,
        matches: rawMatches,
      });
      continue;
    }

    const matchType = hasPrimary && hasVariant ? "mixed" : hasPrimary ? "primary" : "variant";
    if (matchType === "primary") primaryMatched += 1;
    if (matchType === "variant") variantMatched += 1;
    if (matchType === "mixed") mixedMatched += 1;

    const row = { officialId, matchType, matches: rawMatches };
    matched.push(row);
    if (matchType === "variant") variantOnlyMatches.push(row);
  }

  const sanityOnlyProducts = normalProducts
    .filter((product) => !matchedProductIds.has(product._id))
    .map(productSummary)
    .sort((a, b) => clean(a.title).localeCompare(clean(b.title)));

  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      officialCatalogPath: path.relative(ROOT, CATALOG_PATH),
      sanityProjectId: projectId,
      sanityDataset: dataset,
      kentWebRequests: 0,
      writeMode: false,
    },
    counts: {
      officialIds: officialIds.length,
      duplicateOfficialIds: duplicateOfficialIds.length,
      sanityDocuments: products.length,
      sanityProducts: normalProducts.length,
      warrantyDocuments: warrantyProducts.length,
      matchedOfficialIds: matched.length,
      primaryMatched,
      variantMatched,
      mixedMatched,
      conflictedOfficialIds: conflictedOfficialIds.length,
      unmatchedOfficialIds: unmatchedOfficialIds.length,
      sanityOnlyProducts: sanityOnlyProducts.length,
    },
    duplicateOfficialIds,
    matched,
    variantOnlyMatches,
    conflictedOfficialIds,
    unmatchedOfficialIds,
    sanityOnlyProducts,
    warrantyProducts: warrantyProducts.map(productSummary),
  };

  writeJson(JSON_PATH, report);
  writeFile(MARKDOWN_PATH, renderMarkdown(report));

  console.log("=== Kent official catalog audit ===");
  console.log(`Official IDs: ${report.counts.officialIds}`);
  console.log(`Sanity products: ${report.counts.sanityProducts}`);
  console.log(`Warranty documents: ${report.counts.warrantyDocuments}`);
  console.log(`Primary matches: ${report.counts.primaryMatched}`);
  console.log(`Variant-only matches: ${report.counts.variantMatched}`);
  console.log(`Mixed matches: ${report.counts.mixedMatched}`);
  console.log(`Conflicted official IDs: ${report.counts.conflictedOfficialIds}`);
  console.log(`Unmatched official IDs: ${report.counts.unmatchedOfficialIds}`);
  console.log(`Sanity-only products: ${report.counts.sanityOnlyProducts}`);
  console.log(`Report: ${path.relative(ROOT, MARKDOWN_PATH)}`);
  console.log(`Data:   ${path.relative(ROOT, JSON_PATH)}`);
  console.log("Kent web requests: 0");
  console.log("Sanity writes: 0");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
