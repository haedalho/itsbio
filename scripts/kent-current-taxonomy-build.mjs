#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const BASE = "https://www.kentscientific.com";
const API_PATH = "/wp-json/wp/v2";
const READER_BASE = "https://r.jina.ai/http://www.kentscientific.com";
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "data", "kent-current-taxonomy.json"));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeHtml(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&reg;/gi, "®")
    .replace(/&trade;/gi, "™")
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
  try {
    const url = new URL(String(value || ""), BASE);
    url.hash = "";
    url.search = "";
    if (url.hostname === "kentscientific.com") url.hostname = "www.kentscientific.com";
    if (!/\.[a-z0-9]{2,8}$/i.test(url.pathname)) url.pathname = url.pathname.replace(/\/+$/, "") + "/";
    return url.toString();
  } catch {
    return "";
  }
}

function categoryPathFromLink(link) {
  try {
    const parts = new URL(String(link || ""), BASE).pathname.replace(/^\/+|\/+$/g, "").split("/");
    const index = parts.indexOf("product");
    return index >= 0 ? parts.slice(index + 1).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function apiUrl(endpoint, page) {
  const url = new URL(`${BASE}${API_PATH}/${endpoint}`);
  url.searchParams.set("per_page", String(PAGE_SIZE));
  url.searchParams.set("page", String(page));
  url.searchParams.set("orderby", "id");
  url.searchParams.set("order", "asc");
  if (endpoint === "product_cat") {
    url.searchParams.set("hide_empty", "false");
    url.searchParams.set("_fields", "id,parent,name,slug,count,link");
  } else {
    url.searchParams.set("_fields", "id,status,slug,link,product_cat,modified_gmt,title");
  }
  return url;
}

function unwrapReaderJson(text, sourceUrl) {
  let raw = String(text || "");
  const marker = "Markdown Content:";
  const index = raw.indexOf(marker);
  if (index >= 0) raw = raw.slice(index + marker.length);
  raw = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid Kent JSON from ${sourceUrl}: ${error instanceof Error ? error.message : error}`);
  }
}

async function fetchPage(endpoint, page, attempt = 1) {
  const source = apiUrl(endpoint, page);
  const readerUrl = `${READER_BASE}${source.pathname}${source.search}`;
  try {
    const response = await fetch(readerUrl, {
      headers: {
        accept: "text/plain,application/json;q=0.9,*/*;q=0.8",
        "user-agent": "ITSBIO Kent exact taxonomy builder/1.0",
      },
      redirect: "follow",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return unwrapReaderJson(await response.text(), source.toString());
  } catch (error) {
    if (attempt < 4) {
      await sleep(attempt * 1000);
      return fetchPage(endpoint, page, attempt + 1);
    }
    throw error;
  }
}

async function fetchAll(endpoint) {
  const rows = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const payload = await fetchPage(endpoint, page);
    if (Array.isArray(payload)) {
      if (!payload.length) break;
      rows.push(...payload);
      if (payload.length < PAGE_SIZE) break;
      await sleep(250);
      continue;
    }
    if (String(payload?.code || "") === "rest_post_invalid_page_number") break;
    throw new Error(`Unexpected ${endpoint} payload on page ${page}`);
  }
  return rows;
}

function makeCategoryRecords(terms) {
  const rawById = new Map(terms.map((term) => [Number(term.id), term]));
  return terms.map((term) => {
    const chain = [];
    const seen = new Set();
    let current = term;
    while (current && !seen.has(Number(current.id))) {
      seen.add(Number(current.id));
      chain.unshift(current);
      current = Number(current.parent || 0) ? rawById.get(Number(current.parent)) : null;
    }
    const linkedPath = categoryPathFromLink(term.link);
    const chainPath = chain.map((item) => String(item.slug || "").trim()).filter(Boolean);
    return {
      id: Number(term.id),
      parentId: Number(term.parent || 0),
      title: cleanText(term.name),
      slug: String(term.slug || "").trim(),
      count: Number(term.count || 0),
      sourceUrl: normalizeUrl(term.link),
      categoryPath: linkedPath.length ? linkedPath : chainPath,
      categoryPathTitles: chain.map((item) => cleanText(item.name)).filter(Boolean),
      directProductSlugs: [],
      productSlugs: [],
    };
  });
}

function descendantIds(categoryId, childrenByParent, memo) {
  if (memo.has(categoryId)) return memo.get(categoryId);
  const out = new Set([categoryId]);
  for (const childId of childrenByParent.get(categoryId) || []) {
    for (const id of descendantIds(childId, childrenByParent, memo)) out.add(id);
  }
  memo.set(categoryId, out);
  return out;
}

async function main() {
  console.log("[kent-taxonomy] Building exact current category memberships");
  const [terms, rawProducts] = await Promise.all([fetchAll("product_cat"), fetchAll("product")]);
  const categories = makeCategoryRecords(terms);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const childrenByParent = new Map();

  for (const category of categories) {
    if (!childrenByParent.has(category.parentId)) childrenByParent.set(category.parentId, []);
    childrenByParent.get(category.parentId).push(category.id);
  }

  const products = rawProducts
    .filter((product) => product?.status === "publish" && product?.slug && product?.link)
    .map((product) => ({
      id: Number(product.id),
      slug: String(product.slug || "").trim(),
      title: cleanText(product.title?.rendered),
      sourceUrl: normalizeUrl(product.link),
      modifiedAt: product.modified_gmt ? `${product.modified_gmt}Z` : "",
      categoryIds: Array.isArray(product.product_cat) ? product.product_cat.map(Number).filter(Boolean) : [],
    }));

  for (const product of products) {
    for (const categoryId of product.categoryIds) {
      const category = byId.get(categoryId);
      if (category) category.directProductSlugs.push(product.slug);
    }
  }

  const descendantMemo = new Map();
  for (const category of categories) {
    category.directProductSlugs = [...new Set(category.directProductSlugs)].sort();
    const combined = new Set();
    for (const descendantId of descendantIds(category.id, childrenByParent, descendantMemo)) {
      for (const slug of byId.get(descendantId)?.directProductSlugs || []) combined.add(slug);
    }
    category.productSlugs = [...combined].sort();
  }

  const mismatches = categories
    .filter((category) => category.count !== category.productSlugs.length)
    .map((category) => ({
      id: category.id,
      path: category.categoryPath.join("/"),
      termCount: category.count,
      exactProductCount: category.productSlugs.length,
    }));

  const payload = {
    generatedAt: new Date().toISOString(),
    source: `${BASE}${API_PATH}`,
    transport: "r.jina.ai reader mirror",
    publishedProductCount: products.length,
    categoryCount: categories.length,
    countMismatchCount: mismatches.length,
    countMismatches: mismatches,
    categories: categories.sort(
      (a, b) => a.categoryPath.length - b.categoryPath.length || a.categoryPath.join("/").localeCompare(b.categoryPath.join("/")),
    ),
    products: products.sort((a, b) => a.slug.localeCompare(b.slug)),
  };

  if (payload.publishedProductCount !== 204) {
    throw new Error(`Safety stop: expected 204 products, collected ${payload.publishedProductCount}.`);
  }
  if (payload.categoryCount < 60) {
    throw new Error(`Safety stop: only ${payload.categoryCount} categories were collected.`);
  }
  if (mismatches.length) {
    throw new Error(`Safety stop: ${mismatches.length} category counts still differ from exact memberships: ${JSON.stringify(mismatches)}`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`[kent-taxonomy] Products: ${payload.publishedProductCount}`);
  console.log(`[kent-taxonomy] Categories: ${payload.categoryCount}`);
  console.log(`[kent-taxonomy] All ${payload.categoryCount} category counts match exact product memberships.`);
  console.log(`[kent-taxonomy] Saved: ${path.relative(ROOT, OUT)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
