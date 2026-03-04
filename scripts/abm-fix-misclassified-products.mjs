// scripts/abm-fix-misclassified-products.mjs
import process from "node:process";
import { createClient } from "next-sanity";

const args = process.argv.slice(2);
const HAS = (k) => args.includes(k);

const APPLY = HAS("--apply");
const DO_DELETE = HAS("--delete");
const NO_FETCH = HAS("--noFetch");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  if (i >= 0) return Number(args[i + 1] || "0") || 0;
  return 0;
})();

const BRAND_KEY = "abm";
const ABM_ROOTS = new Set(["general-materials", "cellular-materials", "genetic-materials"]);

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId || !dataset || !token) {
  console.error("Missing env. Need NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_WRITE_TOKEN");
  process.exit(1);
}

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });

function normUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  try {
    const x = new URL(s);
    x.hash = "";
    x.search = "";
    return x.toString();
  } catch {
    return s.replace(/[#?].*$/g, "");
  }
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (ITSBIO audit)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/**
 * 아주 현실적인 판별:
 * - ABM 카테고리/리소스 페이지에는 All Products nav(ul.abm-page-category-nav-list)가 거의 항상 있음
 * - product 페이지에는 보통 Product 구조(ld+json Product / product-info / addtocart 등)가 있음
 */
function looksLikeCategoryPage(html) {
  const low = String(html || "").toLowerCase();
  if (!low) return false;

  if (low.includes("abm-page-category-nav-list")) return true; // ✅ 강한 신호
  if (low.includes("all products") && low.includes("abm-page-category-nav")) return true;

  // product 신호가 강하면 category 아님
  if (low.includes('"@type":"product"') || low.includes('"@type": "product"')) return false;
  if (low.includes("product-info-main") || low.includes("product-view") || low.includes("add to cart")) return false;

  return false;
}

function looksLikeProductPage(html) {
  const low = String(html || "").toLowerCase();
  if (!low) return false;

  if (low.includes('"@type":"product"') || low.includes('"@type": "product"')) return true;
  if (low.includes("product-info-main") || low.includes("product-view")) return true;

  // Cat No는 category listing에도 나올 수 있어 약한 신호지만 참고
  if (/\bcat\.?\s*no\.?\b/i.test(low) && (low.includes("datasheet") || low.includes("documents"))) return true;

  return false;
}

async function main() {
  console.log(JSON.stringify({ APPLY, DO_DELETE, NO_FETCH, LIMIT }, null, 2));

  const categories = await client.fetch(
    `*[
      _type=="category"
      && defined(sourceUrl)
      && (
        brand->slug.current==$k
        || brand->themeKey==$k
        || themeKey==$k
        || brandSlug==$k
      )
    ]{ _id, title, path, sourceUrl }`,
    { k: BRAND_KEY }
  );

  const catByUrl = new Map();
  for (const c of categories || []) {
    const u = normUrl(c?.sourceUrl);
    if (u) catByUrl.set(u, c);
  }

  const products = await client.fetch(
    `*[
      _type=="product"
      && defined(sourceUrl)
      && (
        brand->slug.current==$k
        || brand->themeKey==$k
        || brandSlug==$k
      )
    ]{
      _id, title, isActive, sku, sourceUrl, "slug": slug.current, enrichedAt
    }`,
    { k: BRAND_KEY }
  );

  const collisions = [];
  for (const p of products || []) {
    const u = normUrl(p?.sourceUrl);
    if (!u) continue;
    const cat = catByUrl.get(u);
    if (!cat) continue;
    collisions.push({ p, cat, url: u });
  }

  console.log(`\n[collisions] product.sourceUrl == category.sourceUrl : ${collisions.length}`);

  let targets = collisions;

  // 루트 slug는 무조건 카테고리로 취급(데이터가 product에 있어도 잘못된 것)
  targets = targets.map((x) => ({ ...x, isRootSlug: ABM_ROOTS.has(String(x.p?.slug || "").toLowerCase()) }));

  if (LIMIT > 0) targets = targets.slice(0, LIMIT);

  let deactivated = 0;
  let deleted = 0;
  let kept = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const { p, cat, url, isRootSlug } = targets[i];
    const slug = String(p?.slug || "");
    const title = String(p?.title || "");
    const catPath = Array.isArray(cat?.path) ? cat.path.join("/") : "";

    try {
      let decision = "KEEP";

      if (isRootSlug) {
        decision = "DISABLE_PRODUCT";
      } else if (!NO_FETCH) {
        const html = await fetchHtml(url).catch(() => "");
        const isCat = looksLikeCategoryPage(html);
        const isProd = looksLikeProductPage(html);

        if (isCat && !isProd) decision = "DISABLE_PRODUCT";
        else decision = "KEEP"; // product 링크(leaf)인 경우는 유지
      }

      console.log(
        `\n[${i + 1}/${targets.length}] ${decision}\n  - url: ${url}\n  - product: ${slug} (${title}) [${p._id}]\n  - category: ${catPath} (${cat.title}) [${cat._id}]`
      );

      if (decision === "KEEP") {
        kept++;
        continue;
      }

      if (!APPLY) {
        console.log("  - DRY: no change");
        continue;
      }

      if (DO_DELETE) {
        await client.delete(p._id);
        deleted++;
        console.log("  - deleted product:", p._id);
      } else {
        await client.patch(p._id).set({ isActive: false }).commit();
        deactivated++;
        console.log("  - deactivated product:", p._id);
      }
    } catch (e) {
      failed++;
      console.error("  - FAILED:", e?.message || e);
    }
  }

  console.log(
    `\nDone.\n  kept=${kept}\n  deactivated=${deactivated}\n  deleted=${deleted}\n  failed=${failed}\n  (apply=${APPLY}, delete=${DO_DELETE})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});