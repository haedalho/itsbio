#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { createClient } from "@sanity/client";
import * as cheerio from "cheerio";

const root = process.cwd();
dotenv.config({ path: path.join(root, ".env.local") });

const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const skipSitemap = args.has("--skip-sitemap");
const KENT_BASE = "https://www.kentscientific.com";

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
if (write && !token) {
  console.error("Write mode requires a Sanity write token.");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  token: write ? token : undefined,
  apiVersion: "2025-02-19",
  useCdn: false,
});

const QUERY = `{
  "brand": *[_type == "brand" && (slug.current == "kent" || themeKey == "kent")][0]{ _id },
  "categories": *[
    _type == "category"
    && (!defined(isActive) || isActive == true)
    && (
      brandSlug == "kent"
      || themeKey == "kent"
      || brand->slug.current == "kent"
      || brand->themeKey == "kent"
    )
  ]{
    _id,
    path,
    legacyHtml,
    contentBlocks[]{
      items[]{
        title,
        subtitle,
        description,
        href,
        url,
        link,
        imageUrl,
        image,
        src,
        thumbnail,
        thumb,
        sku,
        catNo
      }
    }
  },
  "products": *[
    _type == "product"
    && (
      brandSlug == "kent"
      || themeKey == "kent"
      || brand->slug.current == "kent"
      || brand->themeKey == "kent"
    )
  ]{
    _id,
    title,
    "slug": slug.current,
    sku,
    sourceUrl,
    summary,
    categoryPath,
    listingPaths,
    imageUrls,
    productType,
    isActive
  }
}`;

function clean(value) {
  return String(value ?? "").trim();
}

function normalizePath(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean).join("/").toLowerCase();
  return clean(value).replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/").toLowerCase();
}

function normalizeSku(value) {
  return clean(value)
    .normalize("NFKC")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9._/-]/g, "");
}

function stripTags(value) {
  return clean(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function humanizeSlug(slug) {
  return clean(slug)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cleanTitle(value, slug) {
  return (
    stripTags(value)
      .replace(/\s*[|–—]\s*Kent Scientific(?: Corporation)?\s*$/i, "")
      .trim() || humanizeSlug(slug)
  );
}

function normalizeAbsoluteUrl(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw, KENT_BASE);
    url.hash = "";
    url.search = "";
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = decodeURIComponent(url.pathname).replace(/\/{2,}/g, "/");
    return url.toString();
  } catch {
    return "";
  }
}

function kentSlugFromHref(value) {
  const raw = clean(value);
  if (!raw) return "";

  const internalPatterns = [
    /^\/?products\/kent\/item\/(.+)$/i,
    /^\/?kent\/item\/(.+)$/i,
    /^\/?item\/(.+)$/i,
  ];
  for (const pattern of internalPatterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1].replace(/^\/+|\/+$/g, "");
  }

  const abs = normalizeAbsoluteUrl(raw);
  if (!abs) return "";
  try {
    const url = new URL(abs);
    if (!/(^|\.)kentscientific\.com$/i.test(url.hostname)) return "";
    const match = url.pathname.match(/^\/products\/(.+?)\/?$/i);
    return match?.[1] ? match[1].replace(/^\/+|\/+$/g, "") : "";
  } catch {
    return "";
  }
}

function canonicalSourceUrl(slug) {
  return `${KENT_BASE}/products/${slug.replace(/^\/+|\/+$/g, "")}/`;
}

function stableProductId(slug) {
  const hash = crypto.createHash("sha1").update(`kent|${slug}`).digest("hex").slice(0, 24);
  return `product-kent-${hash}`;
}

function unique(values, normalizer = (value) => clean(value).toLowerCase()) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const key = normalizer(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function best(values, fallback = "") {
  return [...(values || [])]
    .map(clean)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] || fallback;
}

function addCandidate(candidates, input) {
  const slug = kentSlugFromHref(input.href || input.sourceUrl);
  if (!slug) return;
  const key = slug.toLowerCase();
  const current = candidates.get(key) || {
    slug,
    sourceUrl: canonicalSourceUrl(slug),
    titles: [],
    summaries: [],
    skus: [],
    images: [],
    listingPaths: [],
    discoveredFrom: [],
  };

  if (clean(input.title)) current.titles.push(cleanTitle(input.title, slug));
  if (clean(input.summary)) current.summaries.push(stripTags(input.summary));
  if (clean(input.sku)) current.skus.push(clean(input.sku));
  if (clean(input.imageUrl)) current.images.push(normalizeAbsoluteUrl(input.imageUrl));
  if (clean(input.listingPath)) current.listingPaths.push(normalizePath(input.listingPath));
  if (clean(input.discoveredFrom)) current.discoveredFrom.push(clean(input.discoveredFrom));

  current.titles = unique(current.titles);
  current.summaries = unique(current.summaries);
  current.skus = unique(current.skus, normalizeSku);
  current.images = unique(current.images, normalizeAbsoluteUrl);
  current.listingPaths = unique(current.listingPaths, normalizePath);
  current.discoveredFrom = unique(current.discoveredFrom);
  candidates.set(key, current);
}

function itemImage(item) {
  const value = [item?.imageUrl, item?.image, item?.src, item?.thumbnail, item?.thumb]
    .find((candidate) => typeof candidate === "string" && clean(candidate));
  return value ? normalizeAbsoluteUrl(value) : "";
}

function collectFromCategories(categories, candidates) {
  for (const category of categories || []) {
    const listingPath = normalizePath(category.path || []);

    for (const block of category.contentBlocks || []) {
      for (const item of block?.items || []) {
        const href = item?.href || item?.url || item?.link || "";
        addCandidate(candidates, {
          href,
          title: item?.title,
          summary: item?.subtitle || item?.description,
          sku: item?.sku || item?.catNo,
          imageUrl: itemImage(item),
          listingPath,
          discoveredFrom: `contentBlock:${category._id}`,
        });
      }
    }

    const html = clean(category.legacyHtml);
    if (!html) continue;
    const $ = cheerio.load(html);
    $("a[href]").each((_, anchor) => {
      const href = clean($(anchor).attr("href"));
      if (!kentSlugFromHref(href)) return;
      const card = $(anchor).closest("li.product, .product, .product-card, article, .card");
      const scope = card.length ? card : $(anchor);
      const image = scope.find("img").first();
      addCandidate(candidates, {
        href,
        title:
          scope.find(".woocommerce-loop-product__title, h1, h2, h3, h4, .product-title").first().text() ||
          $(anchor).attr("title") ||
          $(anchor).text(),
        summary: scope.find(".excerpt, .description, .summary, p").first().text(),
        sku: scope.find(".sku, .product-sku, [class*='sku'], [class*='item-number']").first().text(),
        imageUrl:
          image.attr("data-lazy-src") || image.attr("data-src") || image.attr("src") || "",
        listingPath,
        discoveredFrom: `legacyHtml:${category._id}`,
      });
    });
  }
}

function parseLocs(xml) {
  return [...String(xml || "").matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => match[1].replace(/&amp;/g, "&").trim());
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 Chrome/150 Safari/537.36",
        accept: "application/xml,text/xml,text/html;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function collectFromSitemap(candidates) {
  const queue = [
    `${KENT_BASE}/wp-sitemap.xml`,
    `${KENT_BASE}/product-sitemap.xml`,
    `${KENT_BASE}/wp-sitemap-posts-product-1.xml`,
  ];
  const visited = new Set();
  const errors = [];

  while (queue.length && visited.size < 80) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    try {
      const xml = await fetchText(current);
      for (const loc of parseLocs(xml)) {
        if (/\.xml(?:\?|$)/i.test(loc)) {
          if (/product|wp-sitemap/i.test(loc) && !visited.has(loc) && !queue.includes(loc)) queue.push(loc);
        } else {
          addCandidate(candidates, { href: loc, discoveredFrom: `sitemap:${current}` });
        }
      }
    } catch (error) {
      errors.push({ url: current, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { visited: [...visited], errors };
}

function buildExistingMaps(products) {
  const bySource = new Map();
  const bySlug = new Map();
  for (const product of products || []) {
    const source = normalizeAbsoluteUrl(product.sourceUrl).toLowerCase();
    const slug = normalizePath(product.slug);
    if (source) {
      const rows = bySource.get(source) || [];
      rows.push(product);
      bySource.set(source, rows);
    }
    if (slug) {
      const rows = bySlug.get(slug) || [];
      rows.push(product);
      bySlug.set(slug, rows);
    }
  }
  return { bySource, bySlug };
}

function makePlan(candidates, products) {
  const existingMaps = buildExistingMaps(products);
  const plan = [];

  for (const candidate of candidates.values()) {
    const sourceKey = normalizeAbsoluteUrl(candidate.sourceUrl).toLowerCase();
    const slugKey = normalizePath(candidate.slug);
    const matches = unique(
      [...(existingMaps.bySource.get(sourceKey) || []), ...(existingMaps.bySlug.get(slugKey) || [])],
      (row) => row._id,
    );
    const existing = matches[0] || null;
    const title = best(candidate.titles, humanizeSlug(candidate.slug));
    const summary = best(candidate.summaries);
    const sku = best(candidate.skus);
    const images = unique(candidate.images, normalizeAbsoluteUrl);
    const listingPaths = unique(candidate.listingPaths, normalizePath);
    const patch = {};

    if (existing) {
      const existingListings = unique(existing.listingPaths || [], normalizePath);
      const existingImages = unique(existing.imageUrls || [], normalizeAbsoluteUrl);
      const mergedListings = unique([...existingListings, ...listingPaths], normalizePath);
      const mergedImages = unique([...existingImages, ...images], normalizeAbsoluteUrl);
      const existingTitle = clean(existing.title);
      const weakExistingTitle = !existingTitle || existingTitle.toLowerCase() === humanizeSlug(candidate.slug).toLowerCase();

      if (!clean(existing.sourceUrl)) patch.sourceUrl = candidate.sourceUrl;
      if (weakExistingTitle && title) patch.title = title;
      if (!clean(existing.summary) && summary) patch.summary = summary;
      if (!clean(existing.sku) && sku) patch.sku = sku;
      if (mergedListings.length !== existingListings.length) patch.listingPaths = mergedListings;
      if ((!Array.isArray(existing.categoryPath) || !existing.categoryPath.length) && mergedListings[0]) {
        patch.categoryPath = mergedListings[0].split("/").filter(Boolean);
      }
      if (mergedImages.length !== existingImages.length) patch.imageUrls = mergedImages;
      if (existing.isActive === false) patch.isActive = true;
    }

    plan.push({
      action: !existing ? "create" : Object.keys(patch).length ? "patch" : "unchanged",
      id: existing?._id || stableProductId(candidate.slug),
      existingId: existing?._id || null,
      duplicateIds: matches.slice(1).map((row) => row._id),
      slug: candidate.slug,
      sourceUrl: candidate.sourceUrl,
      title,
      summary,
      sku,
      images,
      listingPaths,
      discoveredFrom: candidate.discoveredFrom,
      patch,
    });
  }

  const rank = { create: 0, patch: 1, unchanged: 2 };
  return plan.sort((a, b) => rank[a.action] - rank[b.action] || a.slug.localeCompare(b.slug));
}

async function applyPlan(plan, brandId) {
  let created = 0;
  let patched = 0;

  for (const row of plan) {
    if (row.action === "create") {
      await sanity.createIfNotExists({
        _id: row.id,
        _type: "product",
        isActive: true,
        brand: { _type: "reference", _ref: brandId },
        title: row.title,
        slug: { _type: "slug", current: row.slug },
        sourceUrl: row.sourceUrl,
        productType: "simple",
        ...(row.summary ? { summary: row.summary } : {}),
        ...(row.sku ? { sku: row.sku } : {}),
        ...(row.images.length ? { imageUrls: row.images } : {}),
        ...(row.listingPaths.length
          ? {
              listingPaths: row.listingPaths,
              categoryPath: row.listingPaths[0].split("/").filter(Boolean),
            }
          : {}),
      });
      created += 1;
    } else if (row.action === "patch" && row.existingId) {
      await sanity.patch(row.existingId).set(row.patch).commit();
      patched += 1;
    }
  }

  return { created, patched };
}

function renderMarkdown(report) {
  const out = [
    "# Kent product census",
    "",
    `- 실행 시각: ${report.generatedAt}`,
    `- 발견한 고유 상품: ${report.counts.discovered}`,
    `- 새 skeleton 생성 대상: ${report.counts.create}`,
    `- 기존 문서 보강 대상: ${report.counts.patch}`,
    `- 변경 불필요: ${report.counts.unchanged}`,
    `- 중복 기존 문서 후보: ${report.counts.duplicateCandidates}`,
    `- 실행 모드: ${report.write ? "WRITE" : "DRY RUN"}`,
    "",
  ];

  for (const action of ["create", "patch", "unchanged"]) {
    const rows = report.plan.filter((row) => row.action === action);
    out.push(`## ${action.toUpperCase()} (${rows.length})`, "");
    if (!rows.length) out.push("- 없음");
    for (const row of rows) {
      const details = [
        row.sku ? `SKU ${row.sku}` : "no SKU",
        `${row.listingPaths.length} listing`,
        `${row.images.length} image`,
        row.duplicateIds.length ? `duplicates: ${row.duplicateIds.join(", ")}` : "",
      ].filter(Boolean).join(" · ");
      out.push(`- **${row.title}** — \`${row.slug}\` · ${details}`);
    }
    out.push("");
  }

  out.push(
    "## 규칙",
    "",
    "- source URL과 slug를 기준으로 기존 상품을 먼저 찾는다.",
    "- category와 sitemap에서 여러 번 발견된 상품은 하나로 합치고 listingPaths만 병합한다.",
    "- 새 상품은 deterministic ID와 createIfNotExists를 사용한다.",
    "- 빈 수집값은 기존 값을 덮어쓰지 않는다.",
    "- 옵션과 상세 정보는 전체 skeleton 확보 후 별도 보강한다.",
    "",
  );
  return out.join("\n");
}

async function main() {
  console.log("Fetching Kent categories and products from Sanity...");
  const data = await sanity.fetch(QUERY);
  if (!data?.brand?._id) throw new Error("Kent brand document not found.");

  const candidates = new Map();
  collectFromCategories(data.categories || [], candidates);
  const sitemap = skipSitemap ? { visited: [], errors: [] } : await collectFromSitemap(candidates);
  const plan = makePlan(candidates, data.products || []);
  const counts = {
    discovered: plan.length,
    create: plan.filter((row) => row.action === "create").length,
    patch: plan.filter((row) => row.action === "patch").length,
    unchanged: plan.filter((row) => row.action === "unchanged").length,
    duplicateCandidates: plan.filter((row) => row.duplicateIds.length).length,
  };

  const applied = write ? await applyPlan(plan, data.brand._id) : null;
  const report = {
    generatedAt: new Date().toISOString(),
    write,
    counts,
    applied,
    sitemap,
    plan,
  };

  const outputDir = path.join(root, ".cache", "kent-product-census");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "latest.json"), JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(path.join(outputDir, "latest.md"), renderMarkdown(report), "utf8");

  console.log("\n=== Kent product census ===");
  console.log(`Discovered: ${counts.discovered}`);
  console.log(`Create: ${counts.create}`);
  console.log(`Patch: ${counts.patch}`);
  console.log(`Unchanged: ${counts.unchanged}`);
  console.log(`Duplicate candidates: ${counts.duplicateCandidates}`);
  if (applied) console.log(`Applied: created=${applied.created}, patched=${applied.patched}`);
  console.log("Report: .cache/kent-product-census/latest.md");
  console.log("Data:   .cache/kent-product-census/latest.json\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
