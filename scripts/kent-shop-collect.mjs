#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const BASE = "https://www.kentscientific.com";
const API = `${BASE}/wp-json/wp/v2`;
const argv = process.argv.slice(2);

function readArg(flag, fallback = "") {
  const index = argv.indexOf(flag);
  return index >= 0 ? String(argv[index + 1] ?? fallback) : fallback;
}

const OUT = path.resolve(readArg("--out", path.join(ROOT, ".cache", "kent-shop-all.json")));
const DELAY_MS = Number(readArg("--delay", "150")) || 150;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&hellip;/gi, "…")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&rsquo;/gi, "’")
    .replace(/&lsquo;/gi, "‘")
    .replace(/&rdquo;/gi, "”")
    .replace(/&ldquo;/gi, "“")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw, BASE);
    url.hash = "";
    url.search = "";
    if (url.hostname === "kentscientific.com") url.hostname = "www.kentscientific.com";
    if (!/\.[a-z0-9]{2,8}$/i.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\/+$/, "") + "/";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function categoryPathFromLink(link) {
  try {
    const pathname = new URL(link).pathname.replace(/^\/+|\/+$/g, "");
    const parts = pathname.split("/");
    const index = parts.indexOf("product");
    return index >= 0 ? parts.slice(index + 1).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "ITSBIO Kent Shop migration/1.0",
    },
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok) {
    if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 4) {
      await sleep(750 * attempt);
      return fetchJson(url, attempt + 1);
    }
    throw new Error(`Kent API HTTP ${response.status}: ${url}`);
  }

  return {
    rows: await response.json(),
    total: Number(response.headers.get("x-wp-total") || 0),
    totalPages: Number(response.headers.get("x-wp-totalpages") || 1),
  };
}

async function fetchAll(endpoint, query = {}) {
  const firstUrl = new URL(`${API}/${endpoint}`);
  firstUrl.searchParams.set("per_page", "100");
  firstUrl.searchParams.set("page", "1");
  Object.entries(query).forEach(([key, value]) => firstUrl.searchParams.set(key, String(value)));

  const first = await fetchJson(firstUrl);
  const rows = [...first.rows];

  for (let page = 2; page <= first.totalPages; page += 1) {
    const pageUrl = new URL(firstUrl);
    pageUrl.searchParams.set("page", String(page));
    await sleep(DELAY_MS);
    const result = await fetchJson(pageUrl);
    rows.push(...result.rows);
  }

  return { rows, total: first.total || rows.length, totalPages: first.totalPages };
}

function embeddedFeaturedImage(product) {
  const media = product?._embedded?.["wp:featuredmedia"]?.[0];
  return normalizeUrl(media?.source_url || media?.media_details?.sizes?.full?.source_url || "");
}

function makeCategoryIndex(terms) {
  const byId = new Map(terms.map((term) => [Number(term.id), term]));
  const byPath = new Map();

  for (const term of terms) {
    const pathFromLink = categoryPathFromLink(term.link || "");
    const chain = [];
    const seen = new Set();
    let current = term;

    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      chain.unshift(current);
      current = current.parent ? byId.get(Number(current.parent)) : null;
    }

    const chainPath = chain.map((item) => String(item.slug || "").trim()).filter(Boolean);
    const categoryPath = pathFromLink.length ? pathFromLink : chainPath;
    const record = {
      id: Number(term.id),
      parentId: Number(term.parent || 0),
      title: cleanText(term.name),
      slug: String(term.slug || ""),
      count: Number(term.count || 0),
      sourceUrl: normalizeUrl(term.link || ""),
      categoryPath,
      categoryPathTitles: chain.map((item) => cleanText(item.name)).filter(Boolean),
    };
    byId.set(record.id, { ...term, __record: record });
    if (categoryPath.length) byPath.set(categoryPath.join("/"), record);
  }

  return {
    byId: new Map([...byId].map(([id, term]) => [id, term.__record]).filter(([, value]) => value)),
    categories: [...byPath.values()].sort(
      (a, b) => a.categoryPath.length - b.categoryPath.length || a.categoryPath.join("/").localeCompare(b.categoryPath.join("/")),
    ),
  };
}

function save(payload) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  console.log("[kent-shop] Reading published Kent Shop products from WordPress REST API");

  const [productResult, termResult] = await Promise.all([
    fetchAll("product", { _embed: "1", orderby: "id", order: "asc" }),
    fetchAll("product_cat", { hide_empty: "false", orderby: "id", order: "asc" }),
  ]);

  const categoryIndex = makeCategoryIndex(termResult.rows);
  const products = productResult.rows
    .filter((product) => product?.status === "publish" && product?.link)
    .map((product, index) => {
      const sourceUrl = normalizeUrl(product.link);
      const categories = (product.product_cat || [])
        .map((id) => categoryIndex.byId.get(Number(id)))
        .filter(Boolean)
        .sort((a, b) => b.categoryPath.length - a.categoryPath.length);

      return {
        order: index + 1,
        wpProductId: Number(product.id),
        modifiedAt: product.modified_gmt ? `${product.modified_gmt}Z` : "",
        slug: String(product.slug || ""),
        title: cleanText(product.title?.rendered),
        summaryHtml: decodeHtml(product.excerpt?.rendered || "").trim(),
        summary: cleanText(product.excerpt?.rendered),
        sourceIntroHtml: decodeHtml(product.content?.rendered || "").trim(),
        sourceUrl,
        heroImageUrl: embeddedFeaturedImage(product),
        categoryIds: (product.product_cat || []).map(Number),
        sourceCategories: categories.map((category) => ({
          rootUrl: category.sourceUrl,
          title: category.title,
          categoryPath: category.categoryPath,
          categoryPathTitles: category.categoryPathTitles,
        })),
        primaryCategory: categories[0] || null,
      };
    });

  const productUrlsByCategory = new Map();
  for (const product of products) {
    for (const category of product.sourceCategories) {
      const key = category.categoryPath.join("/");
      if (!productUrlsByCategory.has(key)) productUrlsByCategory.set(key, []);
      productUrlsByCategory.get(key).push(product.sourceUrl);
    }
  }

  const categories = categoryIndex.categories.map((category) => ({
    ...category,
    rootUrl: category.sourceUrl,
    productUrls: [...new Set(productUrlsByCategory.get(category.categoryPath.join("/")) || [])],
  }));

  const payload = {
    generatedAt: new Date().toISOString(),
    source: `${API}/product`,
    shopUrl: `${BASE}/shop/`,
    apiReportedProductCount: productResult.total,
    publishedProductCount: products.length,
    categoryCount: categories.length,
    productUrlCount: products.length,
    productUrls: products.map((product) => product.sourceUrl),
    categories,
    products,
  };

  if (payload.publishedProductCount !== payload.apiReportedProductCount) {
    throw new Error(
      `Safety stop: API reports ${payload.apiReportedProductCount} products but ${payload.publishedProductCount} published products were collected.`,
    );
  }

  save(payload);
  console.log(`[kent-shop] Products: ${payload.publishedProductCount}`);
  console.log(`[kent-shop] Categories: ${payload.categoryCount}`);
  console.log(`[kent-shop] Saved: ${path.relative(ROOT, OUT)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
