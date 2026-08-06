#!/usr/bin/env node

import fs from "node:fs";

const MODE = process.argv.includes("--smoke") ? "smoke" : "prepare";
const MAP_FILE = "/tmp/kent-exact-route-map.json";
const BASE_URL = process.env.KENT_VALIDATION_BASE || "http://127.0.0.1:3000";

function pathKey(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).join("/") : "";
}

function titleKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[®™]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeUrl(value) {
  try {
    const parsed = new URL(String(value || ""), "https://www.kentscientific.com");
    parsed.hash = "";
    parsed.search = "";
    if (parsed.hostname === "kentscientific.com") parsed.hostname = "www.kentscientific.com";
    if (!/\.[a-z0-9]{2,8}$/i.test(parsed.pathname)) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "") + "/";
    }
    return parsed.toString().toLowerCase();
  } catch {
    return "";
  }
}

async function sanityData() {
  const query = `{
    "products": *[_type=="kentPreviewProduct" && (!defined(isActive) || isActive==true)]{"slug":slug.current},
    "categories": *[_type=="category" && (!defined(isActive) || isActive==true) && (brand->themeKey=="kent" || brand->slug.current=="kent" || themeKey=="kent" || brandSlug=="kent") && defined(path)]{_id,title,path,sourceUrl,pageType,_updatedAt}
  }`;
  const url = new URL("https://9b5twpc8.api.sanity.io/v2025-02-19/data/query/production");
  url.searchParams.set("query", query);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sanity ${response.status}`);
  return (await response.json()).result || {};
}

async function prepare() {
  const taxonomy = JSON.parse(fs.readFileSync("data/kent-current-taxonomy.json", "utf8"));
  if (taxonomy.publishedProductCount !== 204) throw new Error(`Expected 204 official products, got ${taxonomy.publishedProductCount}`);
  if (taxonomy.categoryCount !== 69) throw new Error(`Expected 69 official categories, got ${taxonomy.categoryCount}`);
  if (taxonomy.countMismatchCount !== 0) throw new Error(`Official taxonomy has ${taxonomy.countMismatchCount} mismatches`);

  const data = await sanityData();
  const sanityProducts = new Set((data.products || []).map((row) => String(row.slug || "").toLowerCase()).filter(Boolean));
  const officialProducts = new Set((taxonomy.products || []).map((row) => String(row.slug || "").toLowerCase()).filter(Boolean));
  const missing = [...officialProducts].filter((slug) => !sanityProducts.has(slug));
  const unexpected = [...sanityProducts].filter((slug) => !officialProducts.has(slug));
  if (missing.length || unexpected.length) {
    throw new Error(`Product mismatch missing=${JSON.stringify(missing)} unexpected=${JSON.stringify(unexpected)}`);
  }

  const ordered = [...(data.categories || [])]
    .sort((a, b) => String(b._updatedAt || "").localeCompare(String(a._updatedAt || "")));
  const uniqueByPath = new Map();
  for (const category of ordered) {
    const key = pathKey(category.path);
    if (key && !uniqueByPath.has(key)) uniqueByPath.set(key, category);
  }
  const categories = [...uniqueByPath.values()];
  const byPath = new Map(categories.map((row) => [pathKey(row.path), row]));
  const bySource = new Map(categories.map((row) => [normalizeUrl(row.sourceUrl), row]).filter(([key]) => key));
  const byLeaf = new Map();
  const byTitle = new Map();
  for (const category of categories) {
    const leaf = Array.isArray(category.path) ? category.path.at(-1) : "";
    if (leaf) {
      if (!byLeaf.has(leaf)) byLeaf.set(leaf, []);
      byLeaf.get(leaf).push(category);
    }
    const title = titleKey(category.title);
    if (title) {
      if (!byTitle.has(title)) byTitle.set(title, []);
      byTitle.get(title).push(category);
    }
  }

  const routeAliases = new Map([
    ["animal-handling/animal-holders", "laboratory-animal-handling/animal-holders"],
  ]);
  const mappings = [];

  for (const official of taxonomy.categories || []) {
    if (official.count <= 0) continue;
    if (!Array.isArray(official.productSlugs) || official.productSlugs.length !== official.count) {
      throw new Error(`Official count/list mismatch for ${pathKey(official.categoryPath)}`);
    }
    const missingCategoryProducts = official.productSlugs.filter((slug) => !sanityProducts.has(String(slug).toLowerCase()));
    if (missingCategoryProducts.length) {
      throw new Error(`Missing products for ${pathKey(official.categoryPath)}: ${JSON.stringify(missingCategoryProducts)}`);
    }

    const officialPath = pathKey(official.categoryPath);
    const explicitRoute = routeAliases.get(officialPath) || "";
    const exact = byPath.get(officialPath);
    const source = bySource.get(normalizeUrl(official.sourceUrl));
    const leafMatches = byLeaf.get(official.categoryPath.at(-1)) || [];
    const titleMatches = byTitle.get(titleKey(official.title)) || [];
    const mapped = (explicitRoute ? byPath.get(explicitRoute) : null)
      || exact
      || source
      || (leafMatches.length === 1 ? leafMatches[0] : null)
      || (titleMatches.length === 1 ? titleMatches[0] : null)
      || null;

    mappings.push({
      routePath: explicitRoute || (mapped ? pathKey(mapped.path) : officialPath),
      officialPath,
      count: official.count,
      productSlugs: official.productSlugs,
      virtual: !mapped,
    });
  }

  const routePaths = new Set(mappings.map((row) => row.routePath));
  for (const row of mappings) {
    const prefix = `${row.routePath}/`;
    row.hasDirectChildren = [...routePaths].some((candidate) =>
      candidate.startsWith(prefix)
      && candidate.slice(prefix.length).split("/").filter(Boolean).length === 1,
    );
  }

  fs.writeFileSync(MAP_FILE, JSON.stringify(mappings, null, 2));
  console.log(JSON.stringify({
    officialProducts: officialProducts.size,
    sanityProducts: sanityProducts.size,
    officialCategories: taxonomy.categoryCount,
    activeCategories: mappings.length,
    virtualRoutes: mappings.filter((row) => row.virtual).map((row) => row.routePath),
  }, null, 2));
}

async function smoke() {
  const mappings = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));
  const checked = new Set();
  const failures = [];

  for (const row of mappings) {
    if (!row.routePath || checked.has(row.routePath)) continue;
    checked.add(row.routePath);
    const response = await fetch(`${BASE_URL}/products/kent/${row.routePath}`, { redirect: "follow" });
    const html = await response.text();
    if (!response.ok || !html.includes("Kent Scientific")) {
      failures.push({ routePath: row.routePath, status: response.status, reason: "page failed" });
      continue;
    }
    if (!row.hasDirectChildren) {
      if (!html.includes(`${row.count} product`)) {
        failures.push({ routePath: row.routePath, count: row.count, reason: "official count missing" });
        continue;
      }
      const missingLinks = row.productSlugs.filter((slug) => !html.includes(`/products/kent/item/${slug}`));
      if (missingLinks.length) {
        failures.push({ routePath: row.routePath, reason: "official product links missing", missingLinks });
      }
    }
  }

  console.log(JSON.stringify({ checkedRoutes: checked.size, failures }, null, 2));
  if (failures.length) throw new Error(`${failures.length} Kent category pages failed exact-count validation`);
}

if (MODE === "smoke") await smoke();
else await prepare();
