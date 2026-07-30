#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { createClient } from "@sanity/client";

const root = process.cwd();
dotenv.config({ path: path.join(root, ".env.local") });

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const skipSource = args.has("--skip-source");
const requestedBrand = [...args]
  .find((arg) => arg.startsWith("--brand="))
  ?.split("=")[1]
  ?.trim()
  ?.toLowerCase();
const brands = requestedBrand && requestedBrand !== "all" ? [requestedBrand] : ["kent", "abm"];

const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.SANITY_STUDIO_PROJECT_ID ||
  process.env.SANITY_PROJECT_ID;
const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_STUDIO_DATASET ||
  process.env.SANITY_DATASET;
const token =
  process.env.SANITY_API_TOKEN ||
  process.env.SANITY_WRITE_TOKEN ||
  process.env.SANITY_TOKEN;

if (!projectId || !dataset) {
  console.error("Missing Sanity project ID or dataset in .env.local.");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  token,
  apiVersion: "2025-02-19",
  useCdn: false,
});

const QUERY = `{
  "categories": *[_type == "category"]{
    _id,
    title,
    path,
    sourceUrl,
    isActive,
    pageType,
    "brandKey": coalesce(brandSlug, themeKey, brand->slug.current, brand->themeKey),
    contentBlocks[]{
      _key,
      _type,
      title,
      kind,
      items[]{ _key, title, href, sku }
    }
  },
  "products": *[_type == "product"]{
    _id,
    title,
    "slug": slug.current,
    sku,
    sourceUrl,
    isActive,
    categoryPath,
    listingPaths,
    "brandKey": coalesce(brandSlug, themeKey, brand->slug.current, brand->themeKey)
  }
}`;

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeBrand(value) {
  return clean(value).toLowerCase();
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

function normalizeSku(value) {
  return clean(value)
    .normalize("NFKC")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9._/-]/g, "");
}

function normalizeUrl(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    url.hash = "";
    url.search = "";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = decodeURIComponent(url.pathname)
      .replace(/\/{2,}/g, "/")
      .replace(/\/$/, "")
      .toLowerCase();
    return `${host}${pathname}`;
  } catch {
    return raw.toLowerCase().replace(/[?#].*$/, "").replace(/\/$/, "");
  }
}

function normalizePath(value) {
  if (Array.isArray(value)) {
    return value.map(clean).filter(Boolean).join("/").toLowerCase();
  }
  return clean(value)
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/")
    .toLowerCase();
}

function duplicatesInArray(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values.map(clean).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) duplicates.add(value);
    seen.add(key);
  }
  return [...duplicates];
}

function groupDuplicates(rows, keyFn, detailFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const bucket = groups.get(key) || [];
    bucket.push(detailFn(row));
    groups.set(key, bucket);
  }
  return [...groups.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([key, values]) => ({ key, values }));
}

function extractKentPathFromUrl(value, kind) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const marker = kind === "category" ? "/product/" : "/products/";
    const index = url.pathname.toLowerCase().indexOf(marker);
    if (index < 0) return "";
    return normalizePath(url.pathname.slice(index + marker.length));
  } catch {
    return "";
  }
}

function auditBrand(brand, allCategories, allProducts) {
  const categories = allCategories.filter((row) => normalizeBrand(row.brandKey) === brand);
  const products = allProducts.filter((row) => normalizeBrand(row.brandKey) === brand);

  const categoryDuplicates = {
    path: groupDuplicates(
      categories,
      (row) => normalizePath(row.path),
      (row) => ({ id: row._id, title: row.title, sourceUrl: row.sourceUrl }),
    ),
    sourceUrl: groupDuplicates(
      categories,
      (row) => normalizeUrl(row.sourceUrl),
      (row) => ({ id: row._id, title: row.title, path: normalizePath(row.path) }),
    ),
    siblingTitle: groupDuplicates(
      categories,
      (row) => {
        const segments = Array.isArray(row.path) ? row.path.map(clean).filter(Boolean) : [];
        const parent = segments.slice(0, -1).join("/").toLowerCase();
        const title = normalizeTitle(row.title);
        return title ? `${parent}|${title}` : "";
      },
      (row) => ({ id: row._id, title: row.title, path: normalizePath(row.path) }),
    ),
  };

  const productDuplicates = {
    slug: groupDuplicates(
      products,
      (row) => normalizePath(row.slug),
      (row) => ({ id: row._id, title: row.title, sku: row.sku, sourceUrl: row.sourceUrl }),
    ),
    sourceUrl: groupDuplicates(
      products,
      (row) => normalizeUrl(row.sourceUrl),
      (row) => ({ id: row._id, title: row.title, slug: row.slug, sku: row.sku }),
    ),
    sku: groupDuplicates(
      products,
      (row) => normalizeSku(row.sku),
      (row) => ({ id: row._id, title: row.title, slug: row.slug, sourceUrl: row.sourceUrl }),
    ),
    title: groupDuplicates(
      products,
      (row) => normalizeTitle(row.title),
      (row) => ({ id: row._id, title: row.title, slug: row.slug, sku: row.sku }),
    ),
  };

  const duplicateCardLinks = [];
  for (const category of categories) {
    const links = [];
    for (const block of category.contentBlocks || []) {
      for (const item of block?.items || []) {
        const href = normalizeUrl(item?.href) || normalizePath(item?.href);
        if (href) links.push({ href, block: block?._key || block?.title || "block", item });
      }
    }
    const grouped = new Map();
    for (const entry of links) {
      const bucket = grouped.get(entry.href) || [];
      bucket.push(entry);
      grouped.set(entry.href, bucket);
    }
    for (const [href, entries] of grouped.entries()) {
      if (entries.length > 1) {
        duplicateCardLinks.push({
          categoryId: category._id,
          categoryTitle: category.title,
          categoryPath: normalizePath(category.path),
          href,
          count: entries.length,
          items: entries.map((entry) => ({
            block: entry.block,
            title: entry.item?.title,
            sku: entry.item?.sku,
          })),
        });
      }
    }
  }

  const duplicateListingPaths = products
    .map((product) => ({
      id: product._id,
      title: product.title,
      slug: product.slug,
      duplicates: duplicatesInArray(product.listingPaths || []),
    }))
    .filter((row) => row.duplicates.length);

  const kentPathMismatches = brand === "kent"
    ? {
        categories: categories
          .map((row) => ({
            id: row._id,
            title: row.title,
            storedPath: normalizePath(row.path),
            sourcePath: extractKentPathFromUrl(row.sourceUrl, "category"),
            sourceUrl: row.sourceUrl,
          }))
          .filter((row) => row.sourcePath && row.storedPath !== row.sourcePath),
        products: products
          .map((row) => ({
            id: row._id,
            title: row.title,
            storedSlug: normalizePath(row.slug),
            sourceSlug: extractKentPathFromUrl(row.sourceUrl, "product"),
            sourceUrl: row.sourceUrl,
          }))
          .filter((row) => row.sourceSlug && row.storedSlug !== row.sourceSlug),
      }
    : { categories: [], products: [] };

  return {
    counts: {
      categories: categories.length,
      activeCategories: categories.filter((row) => row.isActive !== false).length,
      products: products.length,
      activeProducts: products.filter((row) => row.isActive !== false).length,
    },
    categoryDuplicates,
    productDuplicates,
    duplicateCardLinks,
    duplicateListingPaths,
    kentPathMismatches,
    categories,
    products,
  };
}

function parseLocs(xml) {
  return [...String(xml || "").matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) =>
    match[1].replace(/&amp;/g, "&").trim(),
  );
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
      accept: "application/xml,text/xml,text/html;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function collectKentSourceUrls() {
  const base = "https://www.kentscientific.com";
  const seeds = [
    `${base}/wp-sitemap.xml`,
    `${base}/product-sitemap.xml`,
    `${base}/product_cat-sitemap.xml`,
    `${base}/wp-sitemap-posts-product-1.xml`,
    `${base}/wp-sitemap-taxonomies-product_cat-1.xml`,
  ];
  const visited = new Set();
  const queue = [...seeds];
  const pageUrls = [];
  const errors = [];

  while (queue.length && visited.size < 80) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    try {
      const xml = await fetchText(current);
      const locs = parseLocs(xml);
      for (const loc of locs) {
        if (/\.xml(?:\?|$)/i.test(loc)) {
          if (
            /product|product_cat|wp-sitemap/i.test(loc) &&
            !visited.has(loc) &&
            !queue.includes(loc)
          ) {
            queue.push(loc);
          }
        } else {
          pageUrls.push(loc);
        }
      }
    } catch (error) {
      errors.push({ url: current, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const categories = pageUrls
    .map((url) => ({ url, path: extractKentPathFromUrl(url, "category") }))
    .filter((row) => row.path);
  const products = pageUrls
    .map((url) => ({ url, slug: extractKentPathFromUrl(url, "product") }))
    .filter((row) => row.slug);

  return {
    visitedSitemaps: [...visited],
    errors,
    categories,
    products,
    duplicateCategoryUrls: groupDuplicates(categories, (row) => normalizeUrl(row.url), (row) => row),
    duplicateProductUrls: groupDuplicates(products, (row) => normalizeUrl(row.url), (row) => row),
  };
}

function compareKentSource(kentAudit, source) {
  const sourceCategoryByPath = new Map(source.categories.map((row) => [row.path, row]));
  const sourceProductBySlug = new Map(source.products.map((row) => [row.slug, row]));
  const sanityCategoryByPath = new Map(
    kentAudit.categories.map((row) => [normalizePath(row.path), row]).filter(([key]) => key),
  );
  const sanityProductBySlug = new Map(
    kentAudit.products.map((row) => [normalizePath(row.slug), row]).filter(([key]) => key),
  );

  return {
    missingCategoriesInSanity: [...sourceCategoryByPath.entries()]
      .filter(([key]) => !sanityCategoryByPath.has(key))
      .map(([, row]) => row),
    sanityOnlyCategories: [...sanityCategoryByPath.entries()]
      .filter(([key]) => !sourceCategoryByPath.has(key))
      .map(([, row]) => ({ id: row._id, title: row.title, path: normalizePath(row.path), sourceUrl: row.sourceUrl })),
    missingProductsInSanity: [...sourceProductBySlug.entries()]
      .filter(([key]) => !sanityProductBySlug.has(key))
      .map(([, row]) => row),
    sanityOnlyProducts: [...sanityProductBySlug.entries()]
      .filter(([key]) => !sourceProductBySlug.has(key))
      .map(([, row]) => ({ id: row._id, title: row.title, slug: row.slug, sourceUrl: row.sourceUrl })),
  };
}

function duplicateIssueCount(audit) {
  return (
    audit.categoryDuplicates.path.length +
    audit.categoryDuplicates.sourceUrl.length +
    audit.categoryDuplicates.siblingTitle.length +
    audit.productDuplicates.slug.length +
    audit.productDuplicates.sourceUrl.length +
    audit.productDuplicates.sku.length +
    audit.productDuplicates.title.length +
    audit.duplicateCardLinks.length +
    audit.duplicateListingPaths.length
  );
}

function markdownList(rows, formatter, empty = "- 없음") {
  if (!rows?.length) return empty;
  return rows.map((row) => `- ${formatter(row)}`).join("\n");
}

function renderMarkdown(report) {
  const out = [
    "# ITS BIO 콘텐츠 감사 결과",
    "",
    `- 실행 시각: ${report.generatedAt}`,
    `- 검사 브랜드: ${report.brands.join(", ")}`,
    "",
  ];

  for (const brand of report.brands) {
    const audit = report.audit[brand];
    out.push(`## ${brand.toUpperCase()}`, "");
    out.push(`- 카테고리: ${audit.counts.categories}`);
    out.push(`- 상품: ${audit.counts.products}`);
    out.push(`- 중복 그룹/항목: ${duplicateIssueCount(audit)}`, "");
    out.push("### 카테고리 경로 중복", "");
    out.push(markdownList(audit.categoryDuplicates.path, (row) => `\`${row.key}\` (${row.values.length}개)`), "");
    out.push("### 상품 slug 중복", "");
    out.push(markdownList(audit.productDuplicates.slug, (row) => `\`${row.key}\` (${row.values.length}개)`), "");
    out.push("### 원본 URL 중복", "");
    const urls = [...audit.categoryDuplicates.sourceUrl, ...audit.productDuplicates.sourceUrl];
    out.push(markdownList(urls, (row) => `\`${row.key}\` (${row.values.length}개)`), "");
    out.push("### 카드 링크 중복", "");
    out.push(
      markdownList(
        audit.duplicateCardLinks,
        (row) => `\`${row.categoryPath}\`에서 \`${row.href}\` ${row.count}회`,
      ),
      "",
    );
  }

  if (report.kentSourceComparison) {
    const comparison = report.kentSourceComparison;
    out.push("## Kent 원본 비교", "");
    out.push(`- ITS BIO에 누락된 Kent 카테고리: ${comparison.missingCategoriesInSanity.length}`);
    out.push(`- Kent 원본에 없는 ITS BIO 카테고리: ${comparison.sanityOnlyCategories.length}`);
    out.push(`- ITS BIO에 누락된 Kent 상품: ${comparison.missingProductsInSanity.length}`);
    out.push(`- Kent 원본에 없는 ITS BIO 상품: ${comparison.sanityOnlyProducts.length}`, "");
    out.push("### 누락 카테고리", "");
    out.push(markdownList(comparison.missingCategoriesInSanity, (row) => `\`${row.path}\` — ${row.url}`), "");
    out.push("### 누락 상품", "");
    out.push(markdownList(comparison.missingProductsInSanity, (row) => `\`${row.slug}\` — ${row.url}`), "");
  }

  out.push(
    "## 판정 원칙",
    "",
    "- 경로·slug·원본 URL 중복은 우선 정리 대상이다.",
    "- 제목 또는 SKU 중복은 옵션형 상품이나 의도된 공유 SKU일 수 있으므로 자동 삭제하지 않고 검토한다.",
    "- `Sanity only` 항목은 sitemap 누락 가능성이 있어 자동 삭제하지 않는다.",
    "- 보고서는 데이터 변경 없이 읽기 전용으로 생성된다.",
    "",
  );
  return out.join("\n");
}

async function main() {
  console.log("Fetching Sanity categories and products...");
  const data = await sanity.fetch(QUERY);
  const audit = {};
  for (const brand of brands) {
    audit[brand] = auditBrand(brand, data.categories || [], data.products || []);
  }

  let kentSource = null;
  let kentSourceComparison = null;
  if (brands.includes("kent") && !skipSource) {
    console.log("Fetching current Kent sitemaps...");
    kentSource = await collectKentSourceUrls();
    if (kentSource.categories.length || kentSource.products.length) {
      kentSourceComparison = compareKentSource(audit.kent, kentSource);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    brands,
    audit,
    kentSource,
    kentSourceComparison,
  };

  const outputDir = path.join(root, ".cache", "content-audit");
  fs.mkdirSync(outputDir, { recursive: true });
  const json = JSON.stringify(report, null, 2);
  const markdown = renderMarkdown(report);
  fs.writeFileSync(path.join(outputDir, "latest.json"), json, "utf8");
  fs.writeFileSync(path.join(outputDir, "latest.md"), markdown, "utf8");

  console.log("\n=== ITS BIO content audit ===");
  for (const brand of brands) {
    const item = audit[brand];
    console.log(
      `${brand.toUpperCase()}: categories=${item.counts.categories}, products=${item.counts.products}, duplicate issues=${duplicateIssueCount(item)}`,
    );
  }
  if (kentSourceComparison) {
    console.log(
      `Kent source comparison: missing categories=${kentSourceComparison.missingCategoriesInSanity.length}, missing products=${kentSourceComparison.missingProductsInSanity.length}, Sanity-only categories=${kentSourceComparison.sanityOnlyCategories.length}, Sanity-only products=${kentSourceComparison.sanityOnlyProducts.length}`,
    );
  } else if (brands.includes("kent") && !skipSource) {
    console.log("Kent source comparison unavailable: sitemap fetch returned no category/product URLs.");
  }
  console.log("Report: .cache/content-audit/latest.md");
  console.log("Data:   .cache/content-audit/latest.json\n");

  const hardDuplicates = brands.reduce((sum, brand) => sum + duplicateIssueCount(audit[brand]), 0);
  const missingKent = kentSourceComparison
    ? kentSourceComparison.missingCategoriesInSanity.length + kentSourceComparison.missingProductsInSanity.length
    : 0;
  if (strict && (hardDuplicates || missingKent)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
