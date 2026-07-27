#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { createClient } from "@sanity/client";

const root = process.cwd();
dotenv.config({ path: path.join(root, ".env.local") });

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const brandArg = [...args].find((arg) => arg.startsWith("--brand="))?.split("=")[1]?.trim()?.toLowerCase();
const selectedBrands = brandArg && brandArg !== "all" ? [brandArg] : ["kent", "abm"];

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
  sku,
  sourceUrl,
  isActive,
  summary,
  categoryPath,
  listingPaths,
  productType,
  defaultVariantId,
  "brandKey": coalesce(brandSlug, themeKey, brand->slug.current, brand->themeKey),
  imageUrls,
  "uploadedImages": images[]{ "url": asset->url, sourceUrl },
  docs[]{ title, label, url },
  optionGroups[]{
    _key,
    key,
    name,
    label,
    displayType,
    options[]{ _key, value, label }
  },
  variants[]{
    _key,
    variantId,
    title,
    sku,
    catNo,
    optionSummary,
    sourceVariationId,
    imageUrl,
    optionValues[]{ _key, key, label, value },
    attributes[]{ _key, key, value }
  },
  extraHtml,
  legacyHtml,
  specsHtml,
  datasheetHtml,
  documentsHtml,
  faqsHtml,
  referencesHtml,
  reviewsHtml
}`;

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeBrand(value) {
  return clean(value).toLowerCase();
}

function normalizePath(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean).join("/").toLowerCase();
  return clean(value).replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/").toLowerCase();
}

function normalizeUrl(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    url.hash = "";
    url.search = "";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = decodeURIComponent(url.pathname).replace(/\/{2,}/g, "/").replace(/\/$/, "").toLowerCase();
    return `${host}${pathname}`;
  } catch {
    return raw.toLowerCase().replace(/[?#].*$/, "").replace(/\/$/, "");
  }
}

function normalizeSku(value) {
  return clean(value)
    .normalize("NFKC")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9._/-]/g, "");
}

function normalizeTitle(value) {
  return clean(value)
    .replace(/&amp;/gi, "&")
    .split("|")[0]
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textOnly(html) {
  return clean(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNormalized(values, normalizer) {
  const seen = new Set();
  const unique = [];
  const duplicates = [];
  for (const value of values || []) {
    const key = normalizer(value);
    if (!key) continue;
    if (seen.has(key)) duplicates.push(value);
    else {
      seen.add(key);
      unique.push(value);
    }
  }
  return { unique, duplicates };
}

function groupDuplicates(rows, keyFn, detailFn) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const bucket = grouped.get(key) || [];
    bucket.push(detailFn(row));
    grouped.set(key, bucket);
  }
  return [...grouped.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([key, values]) => ({ key, values }));
}

function variantOptionKey(variant) {
  const rows = [...(variant?.optionValues || []), ...(variant?.attributes || [])]
    .map((row) => `${clean(row?.key || row?.label).toLowerCase()}=${clean(row?.value).toLowerCase()}`)
    .filter((row) => row !== "=")
    .sort();
  return rows.join("|");
}

function detectModelTable(product) {
  const html = [product.specsHtml, product.extraHtml, product.legacyHtml].filter(Boolean).join("\n");
  if (!/<table|<tr|<td|<th/i.test(html)) return false;
  const text = textOnly(html);
  const hasIdentifierHeading = /cat(?:alog)?\.?\s*(?:no|number)|item\s*#|model|sku/i.test(text);
  if (!hasIdentifierHeading) return false;
  const codes = text.match(/\b[A-Z]{1,6}[-_/]?[A-Z0-9]{2,}(?:[-_/][A-Z0-9]{1,})*\b/g) || [];
  return new Set(codes.map(normalizeSku).filter(Boolean)).size >= 2;
}

function classifyDisplayMode(product) {
  const variants = Array.isArray(product.variants) ? product.variants.filter(Boolean) : [];
  const groups = Array.isArray(product.optionGroups)
    ? product.optionGroups.filter((group) => Array.isArray(group?.options) && group.options.length)
    : [];
  const hasDocs = (product.docs || []).some((doc) => clean(doc?.url));
  const hasBody = [product.extraHtml, product.legacyHtml, product.specsHtml, product.documentsHtml]
    .some((value) => textOnly(value).length >= 80);

  if (variants.length > 1 || groups.length > 0) return "variant-selector";
  if (detectModelTable(product)) return "model-table";
  if (clean(product.sku) || variants.length === 1) return "simple";
  if (hasDocs || hasBody) return "document-info";
  return "unresolved";
}

function auditProduct(product) {
  const flags = [];
  const hardFlags = [];
  const brand = normalizeBrand(product.brandKey);
  const variants = Array.isArray(product.variants) ? product.variants.filter(Boolean) : [];
  const groups = Array.isArray(product.optionGroups) ? product.optionGroups.filter(Boolean) : [];
  const imageUrls = [
    ...(product.imageUrls || []),
    ...(product.uploadedImages || []).flatMap((image) => [image?.url, image?.sourceUrl]),
    ...variants.map((variant) => variant?.imageUrl),
  ].filter(Boolean);
  const docs = (product.docs || []).filter((doc) => clean(doc?.url));
  const listing = uniqueNormalized(product.listingPaths || [], normalizePath);
  const images = uniqueNormalized(imageUrls, normalizeUrl);
  const documents = uniqueNormalized(docs.map((doc) => doc?.url), normalizeUrl);
  const variantIds = uniqueNormalized(
    variants.map((variant) => variant?.sourceVariationId || variant?.variantId),
    (value) => clean(value).toLowerCase(),
  );
  const variantSkus = uniqueNormalized(
    variants.map((variant) => variant?.catNo || variant?.sku),
    normalizeSku,
  );
  const variantOptions = uniqueNormalized(variants.map(variantOptionKey), (value) => clean(value).toLowerCase());
  const displayMode = classifyDisplayMode(product);

  if (!clean(product.title)) hardFlags.push("missing_title");
  if (!brand) hardFlags.push("missing_brand");
  if (!clean(product.slug)) hardFlags.push("missing_slug");
  if (!normalizeUrl(product.sourceUrl)) hardFlags.push("missing_source_url");
  if (!normalizePath(product.categoryPath) && !listing.unique.length) hardFlags.push("missing_category");
  if (!normalizeSku(product.sku) && !variantSkus.unique.length && displayMode !== "model-table") {
    flags.push("missing_identifier");
  }
  if (!clean(product.summary) && textOnly(product.extraHtml || product.legacyHtml).length < 40) flags.push("thin_description");
  if (!images.unique.length) flags.push("missing_image");
  if (!textOnly(product.specsHtml).length) flags.push("missing_specs");
  if (!docs.length && !textOnly(product.documentsHtml || product.datasheetHtml).length) flags.push("missing_documents");
  if (!textOnly(product.extraHtml || product.legacyHtml).length && !textOnly(product.specsHtml).length) flags.push("empty_detail_content");
  if (listing.duplicates.length) hardFlags.push("duplicate_listing_paths");
  if (images.duplicates.length) flags.push("duplicate_images");
  if (documents.duplicates.length) flags.push("duplicate_documents");
  if (variantIds.duplicates.length) hardFlags.push("duplicate_variant_ids");
  if (variantSkus.duplicates.length) flags.push("duplicate_variant_skus");
  if (variantOptions.duplicates.length) hardFlags.push("duplicate_variant_option_combinations");
  if (variants.length > 1 && product.productType !== "variant") hardFlags.push("product_type_should_be_variant");
  if (!variants.length && !groups.length && product.productType === "variant") flags.push("variant_type_without_variants");
  if (groups.length && variants.length === 0) hardFlags.push("options_without_variants");
  if (product.defaultVariantId && !variants.some((variant) => clean(variant?.variantId) === clean(product.defaultVariantId))) {
    flags.push("invalid_default_variant");
  }
  if (displayMode === "unresolved") hardFlags.push("unresolved_display_mode");

  let score = 0;
  if (clean(product.title)) score += 10;
  if (brand) score += 10;
  if (clean(product.slug)) score += 10;
  if (normalizeUrl(product.sourceUrl)) score += 10;
  if (normalizePath(product.categoryPath) || listing.unique.length) score += 15;
  if (normalizeSku(product.sku) || variantSkus.unique.length || displayMode === "model-table") score += 15;
  if (images.unique.length) score += 10;
  if (clean(product.summary) || textOnly(product.extraHtml || product.legacyHtml).length >= 40) score += 10;
  if (textOnly(product.specsHtml).length) score += 5;
  if (docs.length || textOnly(product.documentsHtml || product.datasheetHtml).length) score += 5;

  const status = hardFlags.length ? (score >= 60 ? "needs-fix" : "skeleton") : score >= 80 ? "ready" : score >= 55 ? "thin" : "skeleton";

  return {
    id: product._id,
    brand,
    title: product.title,
    slug: product.slug,
    sku: product.sku,
    sourceUrl: product.sourceUrl,
    categoryPath: normalizePath(product.categoryPath),
    listingPaths: listing.unique.map(normalizePath),
    displayMode,
    productType: product.productType || "simple",
    score,
    status,
    hardFlags,
    flags,
    counts: {
      images: images.unique.length,
      documents: documents.unique.length,
      optionGroups: groups.length,
      variants: variants.length,
    },
  };
}

function summarize(rows) {
  const byStatus = {};
  const byDisplayMode = {};
  const byFlag = {};
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    byDisplayMode[row.displayMode] = (byDisplayMode[row.displayMode] || 0) + 1;
    for (const flag of [...row.hardFlags, ...row.flags]) byFlag[flag] = (byFlag[flag] || 0) + 1;
  }
  return { byStatus, byDisplayMode, byFlag };
}

function markdownList(rows, formatter, empty = "- 없음") {
  return rows?.length ? rows.map((row) => `- ${formatter(row)}`).join("\n") : empty;
}

function renderMarkdown(report) {
  const out = [
    "# ITS BIO 제품 품질 감사",
    "",
    `- 실행 시각: ${report.generatedAt}`,
    `- 검사 브랜드: ${report.brands.join(", ")}`,
    "",
    "## 전체 요약",
    "",
    `- 전체 상품: ${report.products.length}`,
    `- Ready: ${report.summary.byStatus.ready || 0}`,
    `- Thin: ${report.summary.byStatus.thin || 0}`,
    `- Needs fix: ${report.summary.byStatus["needs-fix"] || 0}`,
    `- Skeleton: ${report.summary.byStatus.skeleton || 0}`,
    "",
    "### 추천 표시 방식",
    "",
    ...Object.entries(report.summary.byDisplayMode)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => `- ${key}: ${count}`),
    "",
    "### 빈약·오류 항목 빈도",
    "",
    ...Object.entries(report.summary.byFlag)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => `- ${key}: ${count}`),
    "",
    "## 브랜드별 상태",
    "",
  ];

  for (const brand of report.brands) {
    const rows = report.products.filter((row) => row.brand === brand);
    const summary = summarize(rows);
    out.push(`### ${brand.toUpperCase()}`, "");
    out.push(`- 상품: ${rows.length}`);
    out.push(`- Ready: ${summary.byStatus.ready || 0}`);
    out.push(`- Thin: ${summary.byStatus.thin || 0}`);
    out.push(`- Needs fix: ${summary.byStatus["needs-fix"] || 0}`);
    out.push(`- Skeleton: ${summary.byStatus.skeleton || 0}`, "");
  }

  out.push("## 우선 수정 상품", "");
  const priority = [...report.products]
    .filter((row) => row.status !== "ready")
    .sort((a, b) => {
      if (a.hardFlags.length !== b.hardFlags.length) return b.hardFlags.length - a.hardFlags.length;
      return a.score - b.score;
    })
    .slice(0, 200);
  out.push(
    markdownList(
      priority,
      (row) =>
        `**${row.brand.toUpperCase()} · ${row.title || row.id}** — ${row.status} ${row.score}점 · ${row.displayMode} · ${[
          ...row.hardFlags,
          ...row.flags,
        ].join(", ")}`,
    ),
    "",
  );

  out.push("## 상품 문서 중복", "");
  for (const [label, rows] of Object.entries(report.duplicates)) {
    out.push(`### ${label}`, "");
    out.push(markdownList(rows, (row) => `\`${row.key}\` (${row.values.length}개)`), "");
  }

  out.push(
    "## 해석 기준",
    "",
    "- 상품명만 같은 경우는 자동 삭제하지 않는다.",
    "- 같은 brand + source URL 또는 같은 brand + slug는 실제 중복으로 우선 처리한다.",
    "- 옵션 SKU는 별도 상품 문서가 아니라 한 상품의 variant로 보관한다.",
    "- Skeleton도 전체 상품 목록 확보 단계에서는 올릴 수 있지만, 상세 화면에서는 빈 탭을 숨기고 문의 CTA를 제공한다.",
    "- 보고서는 읽기 전용이며 Sanity 데이터를 수정하지 않는다.",
    "",
  );
  return out.join("\n");
}

async function main() {
  console.log("Fetching product documents from Sanity...");
  const all = await sanity.fetch(QUERY);
  const selected = (all || []).filter((product) => selectedBrands.includes(normalizeBrand(product.brandKey)));
  const products = selected.map(auditProduct);

  const duplicates = {
    "brand + source URL": groupDuplicates(
      selected,
      (row) => {
        const brand = normalizeBrand(row.brandKey);
        const url = normalizeUrl(row.sourceUrl);
        return brand && url ? `${brand}|${url}` : "";
      },
      (row) => ({ id: row._id, title: row.title, slug: row.slug, sku: row.sku }),
    ),
    "brand + slug": groupDuplicates(
      selected,
      (row) => {
        const brand = normalizeBrand(row.brandKey);
        const slug = normalizePath(row.slug);
        return brand && slug ? `${brand}|${slug}` : "";
      },
      (row) => ({ id: row._id, title: row.title, sourceUrl: row.sourceUrl, sku: row.sku }),
    ),
    "brand + SKU": groupDuplicates(
      selected,
      (row) => {
        const brand = normalizeBrand(row.brandKey);
        const sku = normalizeSku(row.sku);
        return brand && sku ? `${brand}|${sku}` : "";
      },
      (row) => ({ id: row._id, title: row.title, slug: row.slug, sourceUrl: row.sourceUrl }),
    ),
    "brand + normalized title candidates": groupDuplicates(
      selected,
      (row) => {
        const brand = normalizeBrand(row.brandKey);
        const title = normalizeTitle(row.title);
        return brand && title ? `${brand}|${title}` : "";
      },
      (row) => ({ id: row._id, title: row.title, slug: row.slug, sku: row.sku, sourceUrl: row.sourceUrl }),
    ),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    brands: selectedBrands,
    summary: summarize(products),
    products,
    duplicates,
  };

  const outputDir = path.join(root, ".cache", "product-quality");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "latest.json"), JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(path.join(outputDir, "latest.md"), renderMarkdown(report), "utf8");

  console.log("\n=== ITS BIO product quality audit ===");
  console.log(`Products: ${products.length}`);
  for (const [status, count] of Object.entries(report.summary.byStatus)) console.log(`${status}: ${count}`);
  for (const [mode, count] of Object.entries(report.summary.byDisplayMode)) console.log(`display ${mode}: ${count}`);
  console.log("Report: .cache/product-quality/latest.md");
  console.log("Data:   .cache/product-quality/latest.json\n");

  const hardDuplicateCount = duplicates["brand + source URL"].length + duplicates["brand + slug"].length;
  const hardProductCount = products.filter((row) => row.hardFlags.length).length;
  if (strict && (hardDuplicateCount || hardProductCount)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
