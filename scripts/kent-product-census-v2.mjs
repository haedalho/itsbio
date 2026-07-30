#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { createClient } from "@sanity/client";

import { createFetchPage } from "./lib/kent-census-utils.mjs";
import {
  collectFromCategories,
  collectFromSitemap,
} from "./lib/kent-census-sources.mjs";
import {
  collectFromShop,
  enrichAndValidateCandidates,
} from "./lib/kent-census-live-source-fix.mjs";
import { applyPlan, makePlan, renderMarkdown } from "./lib/kent-census-plan.mjs";

const root = process.cwd();
dotenv.config({ path: path.join(root, ".env.local") });
const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const refresh = args.has("--refresh");
const offline = args.has("--offline");
const skipShop = offline || args.has("--skip-shop");
const skipSitemap = offline || args.has("--skip-sitemap");
const skipProductPages = offline || args.has("--skip-product-pages");

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
if (write && offline) {
  console.error("Offline census is report-only. Do not combine --offline with --write.");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  token: write ? token : undefined,
  apiVersion: "2025-02-19",
  useCdn: false,
});
const fetchPage = createFetchPage(root, refresh);
const QUERY = `{
  "brand": *[_type == "brand" && (slug.current == "kent" || themeKey == "kent")][0]{ _id },
  "categories": *[_type == "category" && (!defined(isActive) || isActive == true) &&
    (brandSlug == "kent" || themeKey == "kent" || brand->slug.current == "kent" || brand->themeKey == "kent")]{
      _id, path, legacyHtml,
      contentBlocks[]{ items[]{ title, subtitle, description, href, url, link, imageUrl, image, src, thumbnail, thumb, sku, catNo } }
    },
  "products": *[_type == "product" &&
    (brandSlug == "kent" || themeKey == "kent" || brand->slug.current == "kent" || brand->themeKey == "kent")]{
      _id, title, "slug": slug.current, sku, sourceUrl, summary, categoryPath, listingPaths,
      imageUrls, productType, isActive
    }
}`;

async function main() {
  console.log("Fetching Kent categories and products from Sanity...");
  const data = await sanity.fetch(QUERY);
  if (!data?.brand?._id) throw new Error("Kent brand document not found.");

  const candidates = new Map();
  collectFromCategories(data.categories || [], candidates);
  const categoryCandidateCount = candidates.size;

  if (offline) {
    console.log("Offline mode: using the current Sanity category snapshot; Kent web requests are disabled.");
  } else {
    console.log("Collecting products from Kent Shop...");
  }
  const shop = skipShop
    ? { visited: [], errors: [], cardOccurrences: 0, skipped: true }
    : await collectFromShop(candidates, fetchPage);

  if (!offline) console.log("Collecting product URLs from Kent sitemaps...");
  const sitemap = skipSitemap
    ? { visited: [], errors: [], productLocOccurrences: 0, skipped: true }
    : await collectFromSitemap(candidates, fetchPage);

  if (!offline) {
    // In live mode, category links remain discovery hints and must be confirmed by Shop or product-page validation.
    for (const candidate of candidates.values()) {
      candidate.trustedSources = candidate.trustedSources.filter((source) => source === "shop");
    }
  }

  console.log(
    offline
      ? `Comparing ${candidates.size} category-snapshot candidates with Sanity products...`
      : `Validating and enriching ${candidates.size} product candidates...`,
  );
  const validation = await enrichAndValidateCandidates(candidates, fetchPage, skipProductPages);
  const planned = makePlan(candidates, data.products || []);
  const plan = planned.plan;
  const sourceMode = offline ? "offline-sanity-category-snapshot" : "live-source-validation";
  const counts = {
    sanityProducts: (data.products || []).length,
    categoryCandidates: categoryCandidateCount,
    discovered: plan.length,
    shopCardOccurrences: shop.cardOccurrences,
    shopPages: shop.visited.length,
    sitemapProductLocOccurrences: sitemap.productLocOccurrences,
    checkedProductPages: validation.checked,
    validatedProductPages: validation.validated,
    rejected: validation.rejected.length,
    fetchErrors: validation.errors.length,
    create: plan.filter((row) => row.action === "create").length,
    patch: plan.filter((row) => row.action === "patch").length,
    unchanged: plan.filter((row) => row.action === "unchanged").length,
    duplicateCandidates: plan.filter((row) => row.duplicateIds.length).length,
    sanityOnly: planned.sanityOnly.length,
  };

  const liveSourceFullyBlocked =
    !offline &&
    counts.checkedProductPages > 0 &&
    counts.validatedProductPages === 0 &&
    counts.fetchErrors === counts.checkedProductPages;

  if (write && liveSourceFullyBlocked) {
    throw new Error(
      "Kent live source is fully blocked. Refusing Sanity write. Run the offline census for reporting only.",
    );
  }

  const applied = write ? await applyPlan(sanity, plan, data.brand._id) : null;
  const report = {
    generatedAt: new Date().toISOString(),
    write,
    sourceMode,
    degraded: offline || liveSourceFullyBlocked,
    options: { refresh, offline, skipShop, skipSitemap, skipProductPages },
    counts,
    applied,
    shop,
    sitemap,
    validation,
    sanityOnly: planned.sanityOnly,
    plan,
  };

  const outputDir = path.join(root, ".cache", "kent-product-census");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "latest.json"), JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(path.join(outputDir, "latest.md"), renderMarkdown(report), "utf8");

  console.log("\n=== Kent product census v2 ===");
  console.log(`Source mode: ${sourceMode}`);
  console.log(`Sanity products: ${counts.sanityProducts}`);
  console.log(`Category candidates: ${counts.categoryCandidates}`);
  console.log(`Discovered: ${counts.discovered}`);
  console.log(`Shop pages: ${counts.shopPages}, product cards: ${counts.shopCardOccurrences}`);
  console.log(`Validated product pages: ${counts.validatedProductPages}/${counts.checkedProductPages}`);
  console.log(`Rejected candidates: ${counts.rejected}`);
  console.log(`Fetch errors: ${counts.fetchErrors}`);
  console.log(`Create: ${counts.create}`);
  console.log(`Patch: ${counts.patch}`);
  console.log(`Unchanged: ${counts.unchanged}`);
  console.log(`Duplicate candidates: ${counts.duplicateCandidates}`);
  console.log(`Sanity only: ${counts.sanityOnly}`);
  if (offline) console.log("Offline report only: Sanity write is disabled in this mode.");
  if (liveSourceFullyBlocked) {
    console.log("Kent live source is fully blocked (for example, HTTP 403). Use npm run kent:product:census:offline.");
  }
  if (applied) console.log(`Applied: created=${applied.created}, patched=${applied.patched}`);
  if (validation.rejected[0]?.diagnostic) {
    console.log("First rejection diagnostic:");
    console.log(JSON.stringify(validation.rejected[0], null, 2));
  }
  if (validation.errors[0]) {
    console.log("First fetch error:");
    console.log(JSON.stringify(validation.errors[0], null, 2));
  }
  console.log("Report: .cache/kent-product-census/latest.md");
  console.log("Data:   .cache/kent-product-census/latest.json\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});