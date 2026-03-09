#!/usr/bin/env node
/**
 * delete-kent-hard.mjs
 * - Kent(또는 지정 brand) 관련 category/product/productPage 문서를 전부 삭제
 * - 필요 시 brand 문서까지 삭제
 *
 * 사용:
 *   node scripts/delete-kent-hard.mjs --brand kent
 *   node scripts/delete-kent-hard.mjs --brand kent --apply
 *   node scripts/delete-kent-hard.mjs --brand kent --apply --keepBrand
 */

import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { createClient } from "next-sanity";

const repoRoot = process.cwd();
dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const readArg = (k, d) => {
  const i = argv.indexOf(k);
  if (i === -1) return d;
  return argv[i + 1] ?? d;
};

const BRAND_KEY = String(readArg("--brand", "kent")).trim() || "kent";
const APPLY = has("--apply");
const KEEP_BRAND = has("--keepBrand");

const {
  NEXT_PUBLIC_SANITY_PROJECT_ID,
  NEXT_PUBLIC_SANITY_DATASET,
  NEXT_PUBLIC_SANITY_API_VERSION,
  SANITY_WRITE_TOKEN,
} = process.env;

if (!NEXT_PUBLIC_SANITY_PROJECT_ID || !NEXT_PUBLIC_SANITY_DATASET) throw new Error("Missing SANITY project/dataset");
if (!SANITY_WRITE_TOKEN) throw new Error("Missing SANITY_WRITE_TOKEN");

const sanity = createClient({
  projectId: NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token: SANITY_WRITE_TOKEN,
  useCdn: false,
});

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function main() {
  const brand = await sanity.fetch(
    `*[_type=="brand" && (themeKey==$k || slug.current==$k)][0]{_id,title,themeKey,"slug":slug.current}`,
    { k: BRAND_KEY }
  );

  const brandId = brand?._id || null;
  console.log("brand:", brand || "(not found)");

  const ids = await sanity.fetch(
    `{
      "categories": *[_type=="category" && (
        brand._ref==$bid || brand->themeKey==$k || brand->slug.current==$k || themeKey==$k || brandSlug==$k
      )]._id,
      "products": *[_type=="product" && (
        brand._ref==$bid || brand->themeKey==$k || brand->slug.current==$k || themeKey==$k || brandSlug==$k
      )]._id,
      "productPages": *[_type=="productPage" && (
        brand._ref==$bid || brand->themeKey==$k || brand->slug.current==$k || themeKey==$k || brandSlug==$k
      )]._id
    }`,
    { k: BRAND_KEY, bid: brandId || "___none___" }
  );

  const catIds = ids.categories || [];
  const prodIds = ids.products || [];
  const pageIds = ids.productPages || [];

  console.log("=== DELETE PLAN ===");
  console.log("brandKey:", BRAND_KEY);
  console.log("apply:", APPLY);
  console.log("keepBrand:", KEEP_BRAND);
  console.log("categories:", catIds.length);
  console.log("products:", prodIds.length);
  console.log("productPages:", pageIds.length);

  if (!APPLY) {
    console.log("\n[dry-run] Run with --apply to actually delete.");
    return;
  }

  async function deleteMany(list, label) {
    for (const batch of chunk(list, 100)) {
      let tx = sanity.transaction();
      for (const id of batch) tx = tx.delete(id);
      await tx.commit();
      console.log(`[OK] deleted ${label}:`, batch.length);
    }
  }

  // 순서: products → productPages → categories → brand
  if (prodIds.length) await deleteMany(prodIds, "products");
  if (pageIds.length) await deleteMany(pageIds, "productPages");
  if (catIds.length) await deleteMany(catIds, "categories");

  if (!KEEP_BRAND && brandId) {
    await sanity.delete(brandId);
    console.log("[OK] deleted brand:", brandId);
  }

  console.log("✅ DONE");
}

main().catch((e) => {
  console.error(e?.responseBody || e);
  process.exit(1);
});
