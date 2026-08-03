#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const BASE = "https://www.kentscientific.com";
const READER_BASE = "https://r.jina.ai/http://www.kentscientific.com";
const API_PATH = "/wp-json/wp/v2";
const argv = process.argv.slice(2);

function readArg(flag, fallback = "") {
  const index = argv.indexOf(flag);
  return index >= 0 ? String(argv[index + 1] ?? fallback) : fallback;
}

const OUT = path.resolve(readArg("--out", path.join(ROOT, "data", "kent-current-taxonomy.json")));
const DELAY_MS = Number(readArg("--delay", "250")) || 250;
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

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

function sourceUrl(endpoint, page) {
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

function readerUrl(url) {
  return `${READER_BASE}${url.pathname}${url.search}`;
}

function unwrapReaderPayload(text, url) {
  let raw = String(text || "");
  const marker = "Markdown Content:";
  const index = raw.indexOf(marker);
  if (index >= 0) raw = raw.slice(index + marker.length);
  raw = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  try {
    return JSON.parse(raw);
  } catch (error) {
    const preview = raw.slice(0, 300).replace(/\s+/g, " ");
    throw new Error(`Invalid Kent taxonomy JSON from ${url}: ${error instanceof Error ? error.message : error}; ${preview}`);
  }
}

async function fetchPage(endpoint, page, attempt = 1) {
  const source = sourceUrl(endpoint, page);
  const url = readerUrl(source);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/plain,application/json;q=0.9,*/*;q=0.8",
        "user-agent": "ITSBIO Kent taxonomy collector/1.0",
      },
      redirect: "follow",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return unwrapReaderPayload(await response.text(), source.toString());
  } catch (error) {
    if (attempt < 4) {
      await sleep(1000 * attempt);
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
      await sleep(DELAY_MS);
      continue;
    }

    const code = String(payload?.code || "");
    if (code === "rest_post_invalid_page_number") break;
    throw new Error(`Unexpected ${endpoint} payload on page ${page}: ${JSON.stringify(payload).slice(0, 300)}`);
  }
  return rows;
}

function makeCategoryIndex(terms) {
  const rawById = new Map(terms.map((term) => [Number(term.id), term]));
  const records = [];

  for (const term of terms) {
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
    const categoryPath = linkedPath.length ? linkedPath : chainPath;

    records.push({
      id: Number(term.id),
      parentId: Number(term.parent || 0),
      title: cleanText(term.name),
      slug: String(term.slug || "").trim(),
      count: Number(term.count || 0),
      sourceUrl: normalizeUrl(term.link),
      categoryPath,
      categoryPathTitles: chain.map((item) => cleanText(item.name)).filter(Boolean),
      productSlugs: [],
    });
  }

  const byId = new Map(records.map((record) => [record.id, record]));
  return { records, byId };
}

async function main() {
  console.log("[kent-taxonomy] Reading current Kent product categories through the reader endpoint");
  const [terms, rawProducts] = await Promise.all([fetchAll("product_cat"), fetchAll("product")]);
  const { records: categories, byId } = makeCategoryIndex(terms);

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
      if (category) category.productSlugs.push(product.slug);
    }
  }

  for (const category of categories) {
    category.productSlugs = [...new Set(category.productSlugs)].sort();
  }

  const categoryCountMismatches = categories
    .filter((category) => category.count !== category.productSlugs.length)
    .map((category) => ({
      id: category.id,
      path: category.categoryPath.join("/"),
      termCount: category.count,
      productCount: category.productSlugs.length,
    }));

  const payload = {
    generatedAt: new Date().toISOString(),
    source: `${BASE}${API_PATH}`,
    transport: "r.jina.ai reader mirror",
    publishedProductCount: products.length,
    categoryCount: categories.length,
    categoryCountMismatchCount: categoryCountMismatches.length,
    categoryCountMismatches,
    categories: categories.sort(
      (a, b) => a.categoryPath.length - b.categoryPath.length || a.categoryPath.join("/").localeCompare(b.categoryPath.join("/")),
    ),
    products: products.sort((a, b) => a.slug.localeCompare(b.slug)),
  };

  if (payload.publishedProductCount < 190) {
    throw new Error(`Safety stop: only ${payload.publishedProductCount} published Kent products were collected.`);
  }
  if (payload.categoryCount < 70) {
    throw new Error(`Safety stop: only ${payload.categoryCount} Kent categories were collected.`);
  }
  if (categoryCountMismatches.length) {
    throw new Error(`Safety stop: ${categoryCountMismatches.length} category term counts do not match product memberships.`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`[kent-taxonomy] Products: ${payload.publishedProductCount}`);
  console.log(`[kent-taxonomy] Categories: ${payload.categoryCount}`);
  console.log(`[kent-taxonomy] Saved: ${path.relative(ROOT, OUT)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
