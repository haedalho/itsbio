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
  console.error("Write mode requires SANITY_API_TOKEN, SANITY_WRITE_TOKEN, or SANITY_TOKEN.");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  token: write ? token : undefined,
  apiVersion: "2025-02-19",
  useCdn: false,
});

const KENT_BASE = "https://www.kentscientific.com";

const QUERY = `{
  "brand": *[
    _type == "brand" && (slug.current == "kent" || themeKey == "kent")
  ][0]{ _id, title, "slug": slug.current, themeKey },
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
    title,
    path,
    sourceUrl,
    legacyHtml,
    contentBlocks[]{
      _key,
      _type,
      title,
      kind,
      items[]{
        _key,
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

function toAbs(value) {
  const raw = clean(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `${KENT_BASE}${raw}`;
  return raw;
}

function normalizeUrl(value) {
  const raw = toAbs(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    url.search = "";
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "www.");
    url.pathname = decodeURIComponent(url.pathname).replace(/\/{2,}/g, "/").replace(/\/$/, "");
    return url.toString();
  } catch {
    return raw.replace(/[?#].*$/, "").replace(/\/$/, "");
  }
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
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function cleanTitle(value, slug = "") {
  const title = stripTags(value)
    .replace(/\s*[|–—-]\s*Kent Scientific(?: Corporation)?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return title || humanizeSlug(slug);
}

function isWeakTitle(value, slug) {
  const title = clean(value).toLowerCase();
  if (!title) return true;
  return title === clean(slug).toLowerCase() || title === humanizeSlug(slug).toLowerCase();
}

function kentSlugFromHref(value) {
  const raw = clean(value);
  if (!raw) return "";

  const internal = raw
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/^products\/kent\/item\//i, "")
    .replace(/^kent\/item\//i, "")
    .replace(/^item\//i, "");
  if (internal !== raw.replace(/^\/+/, "") && internal) {
    return internal.replace(/^\/+|\/+$/g, "");
  }

  const abs = normalizeUrl(raw);
  if (!abs) return "";
  try {
    const url = new URL(abs);
    const match = url.pathname.match(/^\/products\/(.+)$/i);
    if (!match?.[1]) return "";
    return match[1].replace(/^\/+|\/+$/g, "");
  } catch {
    return "";
  }
}

function sourceUrlFromHref(value) {
  const slug = kentSlugFromHref(value);
  return slug ? `${KENT_BASE}/products/${slug}/` : "";
}

function getImageUrl(item) {
  if (!item || typeof item !== "object") return "";
  const direct = [item.imageUrl, item.image, item.src, item.thumbnail, item.thumb]
    .find((value) => typeof value === "string" && clean(value));
  return direct ? toAbs(direct) : "";
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

function addCandidate(map, input) {
  const slug = kentSlugFromHref(input?.sourceUrl || input?.href || "");
  if (!slug) return;
  const sourceUrl = sourceUrlFromHref(input?.sourceUrl || input?.href || "") || `${KENT_BASE}/products/${slug}/`;
  const key = normalizeUrl(sourceUrl).toLowerCase();
  if (!key) return;

  const current = map.get(key) || {
    slug,
    sourceUrl,
    titles: [],
    summaries: [],
    skus: [],
    images: [],
    listingPaths: [],
    discoveredFrom: [],
  };

  if (clean(input?.title)) current.titles.push(cleanTitle(input.title, slug));
  if (clean(input?.summary)) current.summaries.push(stripTags(input.summary));
  if (clean(input?.sku)) current.skus.push(clean(input.sku));
  if (clean(input?.imageUrl)) current.images.push(toAbs(input.imageUrl));
  if (clean(input?.listingPath)) current.listingPaths.push(normalizePath(input.listingPath));
  if (clean(input?.discoveredFrom)) current.discoveredFrom.push(clean(input.discoveredFrom));

  current.titles = unique(current.titles, (value) => clean(value).toLowerCase());
  current.summaries = unique(current.summaries, (value) => clean(value).toLowerCase());
  current.skus = unique(current.skus, normalizeSku);
  current.images = unique(current.images, (value) => normalizeUrl(value).toLowerCase());
  current.listingPaths = unique(current.listingPaths, normalizePath);
  current.discoveredFrom = unique(current.discoveredFrom);
  map.set(key, current);
}

function collectFromContentBlocks(categories, map) {
  for (const category of categories || []) {
    const listingPath = normalizePath(category.path || []);
    for (const block of category.contentBlocks || []) {
      for (const item of block?.items || []) {
        const href = item?.href || item?.url || item?.link || "";
        if (!kentSlugFromHref(href)) continue;
        addCandidate(map, {
          href,
          title: item?.title,
          summary: item?.subtitle || item?.description,
          sku: item?.sku || item?.catNo,
          imageUrl: getImageUrl(item),
          listingPath,
          discoveredFrom: `contentBlock:${category._id}`,
        });
      }
    }
  }
}

function collectFromLegacyHtml(categories, map) {
  for (const category of categories || []) {
    const html = clean(category.legacyHtml);
    if (!html) continue;
    const listingPath = normalizePath(category.path || []);
    const $ = cheerio.load(html);

    $("a[href]").each((_, anchor) => {
      const href = clean($(anchor).attr("href"));
      if (!kentSlugFromHref(href)) return;

      const card = $(anchor).closest("li.product, .product, .product-card, article, .card");
      const scope = card.length ? card : $(anchor);
      const title = clean(
        scope.find(".woocommerce-loop-product__title, h1, h2, h3, h4, .product-title").first().text() ||
          $(anchor).attr("title") ||
          $(anchor).text(),
      );
      const summary = clean(scope.find(".excerpt, .description, .summary, p").first().text());
      const sku = clean(scope.find(".sku, .product-sku, [class*='sku'], [class*='item-number']").first().text());
      const image = scope.find("img").first();
      const imageUrl = clean(
        image.attr("data-lazy-src") || image.attr("data-src") || image.attr("src") || "",
      );

      addCandidate(map, {
        href,
        title,
        summary,
        sku,
        imageUrl,
        listingPath,
        discoveredFrom: `legacyHtml:${category._id}`,
      });
    });
  }
}

function parseLocs(xml) {
  return [...String(xml || "").matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) =>
    match[1].replace(/&amp;/g, "&").trim(),
  );
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
        accept: "application/xml,text/xml,text/html;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function collectFromSitemaps(map) {
  const seeds = [
    `${KENT_BASE}/wp-sitemap.xml`,
    `${KENT_BASE}/product-sitemap.xml`,
    `${KENT_BASE}/wp-sitemap-posts-product-1.xml`,
  ];
  const queue = [...seeds];
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
          continue;
        }
        if (!kentSlugFromHref(loc)) continue;
        addCandidate(map, { href: loc, discoveredFrom: `sitemap:${current}` });
      }
    } catch (error) {
      errors.push({ url: current, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { visited: [...visited], errors };
}

function chooseBest(values, fallback = "") {
  return [...(values || [])]
    .map(clean)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] || fallback;
}

function buildExistingMaps(products) {
  const bySource = new Map();
  const bySlug = new Map();
  for (const product of products || []) {
    const source = normalizeUrl(product.sourceUrl).toLowerCase();
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
  const maps = buildExistingMaps(products);
  const rows = [];

  for (const candidate of candidates.values()) {
    const sourceKey = normalizeUrl(candidate.sourceUrl).toLowerCase();
    const slugKey = normalizePath(candidate.slug);
    const sourceMatches = maps.bySource.get(sourceKey) || [];
    const slugMatches = maps.bySlug.get(slugKey) || [];
    const matches = unique([...sourceMatches, ...slugMatches], (row) => row._id);
    const existing = matches[0] || null;
    const duplicateIds = matches.slice(1).map((row) => row._id);

    const title = chooseBest(candidate.titles, humanizeSlug(candidate.slug));
    const summary = chooseBest(candidate.summaries, "");
    const sku = chooseBest(candidate.skus, "");
    const images = unique(candidate.images, (value) => normalizeUrl(value).toLowerCase());
    const listingPaths = unique(candidate.listingPaths, normalizePath);

    const patch = {};
    if (existing) {
      const existingListing = unique(existing.listingPaths || [], normalizePath);
      const mergedListing = unique([...existingListing, ...listingPaths], normalizePath);
      const existingImages = unique(existing.imageUrls || [], (value) => normalizeUrl(value).toLowerCase());
      const mergedImages = unique([...existingImages, ...images], (value) => normalizeUrl(value).toLowerCase());

      if (!clean(existing.sourceUrl)) patch.sourceUrl = candidate.sourceUrl;
      if (isWeakTitle(existing.title, candidate.slug) && title) patch.title = title;
      if (!clean(existing.summary) && summary) patch.summary = summary;
      if (!clean(existing.sku) && sku) patch.sku = sku;
      if (mergedListing.length !== existingListing.length) patch.listingPaths = mergedListing;
      if ((!Array.isArray(existing.categoryPath) || !existing.categoryPath.length) && mergedListing[0]) {
        patch.categoryPath = mergedListing[0].split("/").filter(Boolean);
      }
      if (mergedImages.length !== existingImages.length) patch.imageUrls = mergedImages;
      if (existing.isActive === false) patch.isActive = true;
    }

    rows.push({
      action: !existing ? "create" : Object.keys(patch).length ? "patch" : "unchanged",
      id: existing?._id || stableProductId(candidate.slug),
      existingId: existing?._id || null,
      duplicateIds,
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

  return rows.sort((a, b) => {
    const rank = { create: 0, patch: 1, unchanged: 2 };
    if (rank[a.action] !== rank[b.action]) return rank[a.action] - rank[b.action];
    return a.slug.localeCompare(b.slug);
  });
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
        ...(row.summary ? { summary: row.summary } : {}),
        ...(row.sku ? { sku: row.sku } : {}),
        ...(row.images.length ? { imageUrls: row.images } : {}),
        ...(row.listingPaths.length
          ? {
              listingPaths: row.listingPaths,
              categoryPath: row.listingPaths[0].split("/").filter(Boolean),
            }
          : {}),
        productType: "simple",
      });
      created += 1;
      continue;
    }

    if (row.action === "patch" && row.existingId) {
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
    `- 중복 기존 문서가 연결된 후보: ${report.counts.duplicateCandidates}`,
    `- 실행 모드: ${report.write ? "WRITE" : "DRY RUN"}`,
    "",
  ];

  if (report.sitemap?.errors?.length) {
    out.push("## Sitemap errors", "");
    for (const row of report.sitemap.errors) out.push(`- ${row.url}: ${row.error}`);
    out.push("");
  }

  for (const action of ["create", "patch", "unchanged"]) {
    const rows = report.plan.filter((row) => row.action === action);
    out.push(`## ${action.toUpperCase()} (${rows.length})`, "");
    if (!rows.length) out.push("- 없음", "");
    for (const row of rows) {
      const meta = [
        row.sku ? `SKU ${row.sku}` : "",
        row.listingPaths.length ? `${row.listingPaths.length} listing` : "no listing",
        row.images.length ? `${row.images.length} image` : "no image",
        row.duplicateIds.length ? `duplicate IDs: ${row.duplicateIds.join(", ")}` : "",
      ].filter(Boolean).join(" · ");
      out.push(`- **${row.title}** — \`${row.slug}\` · ${meta}`);
    }
    out.push("");
  }

  out.push(
    "## 규칙",
    "",
    "- source URL과 slug를 기준으로 기존 문서를 먼저 찾는다.",
    "- 새 상품은 slug 기반 deterministic ID로 createIfNotExists한다.",
    "- 빈 수집값으로 기존 값을 덮어쓰지 않는다.",
    "- category/listing에서 여러 번 발견된 상품은 product 하나에 listingPaths만 합친다.",
    "- 이 스크립트는 옵션/variant 상세를 생성하지 않는다. 전체 상품 skeleton 확보가 목적이다.",
    "",
  );
  return out.join("\n");
}

async function main() {
  console.log("Fetching Kent categories and products from Sanity...");
  const data = await sanity.fetch(QUERY);
  if (!data?.brand?._id) throw new Error("Kent brand document not found.");

  const candidates = new Map();
  collectFromContentBlocks(data.categories || [], candidates);
  collectFromLegacyHtml(data.categories || [], candidates);

  let sitemap = { visited: [], errors: [] };
  if (!skipSitemap) {
    console.log("Fetching Kent product sitemaps...");
    sitemap = await collectFromSitemaps(candidates);
  }

  const plan = makePlan(candidates, data.products || []);
  const counts = {
    discovered: plan.length,
    create: plan.filter((row) => row.action === "create").length,
    patch: plan.filter((row) => row.action === "patch").length,
    unchanged: plan.filter((row) => row.action === "unchanged").length,
    duplicateCandidates: plan.filter((row) => row.duplicateIds.length).length,
  };

  let applied = null;
  if (write) {
    console.log(`Applying ${counts.create} creates and ${counts.patch} patches...`);
    applied = await applyPlan(plan, data.brand._id);
  }

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
