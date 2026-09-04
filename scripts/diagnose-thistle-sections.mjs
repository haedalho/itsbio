#!/usr/bin/env node

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const cheerio = require("cheerio");

const HOST = "www.thistlescientific.com";
const BASE = `https://${HOST}`;
const SAMPLE_SKU = "CSL-MDOCUV254/3651D";
const headers = {
  Accept: "application/json,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
  Referer: `${BASE}/`,
  "User-Agent": "Mozilla/5.0 (compatible; ITS-BIO-CleaverCatalog/1.0; +https://itsbio.vercel.app)",
};

async function json(url) {
  const response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(45_000) });
  const text = await response.text();
  console.log(`[diagnose] ${new URL(url).pathname}${new URL(url).search}: HTTP ${response.status}, bytes=${text.length}`);
  if (!response.ok) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function compact(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function collectInteresting(value, path = "root", out = [], depth = 0) {
  if (out.length >= 120 || depth > 7 || value == null) return out;
  if (typeof value === "string") {
    if (/(spec|dimension|weight|document|manual|pdf|accessor|included|include:|variation|microdoc|filter|transilluminator|datasheet|flyer)/i.test(value)) {
      out.push({ path, value: compact(value, 360) });
    }
    return out;
  }
  if (Array.isArray(value)) {
    value.slice(0, 80).forEach((item, index) => collectInteresting(item, `${path}[${index}]`, out, depth + 1));
    return out;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (/(spec|document|accessor|include|variation|meta|acf|field|pdf|file|manual)/i.test(key)) {
        out.push({ path: `${path}.${key}`, value: typeof item === "string" ? compact(item, 360) : `[${Array.isArray(item) ? `array:${item.length}` : typeof item}]` });
      }
      collectInteresting(item, `${path}.${key}`, out, depth + 1);
      if (out.length >= 120) break;
    }
  }
  return out;
}

const productsUrl = new URL(`${BASE}/wp-json/wc/store/v1/products`);
productsUrl.searchParams.set("sku", SAMPLE_SKU);
productsUrl.searchParams.set("per_page", "10");
const products = await json(productsUrl.toString());
const sample = Array.isArray(products) ? products[0] : null;
if (!sample) throw new Error(`Unable to resolve ${SAMPLE_SKU} through Woo Store API.`);

const familyId = Number(sample.parent) || Number(sample.id);
const wpProducts = await json(`${BASE}/wp-json/wp/v2/product?include=${familyId}&per_page=1&context=view`);
const wpProduct = Array.isArray(wpProducts) ? wpProducts[0] : null;
if (!wpProduct) throw new Error(`Unable to resolve WordPress product ${familyId}.`);

console.log("[diagnose] sample", JSON.stringify({ id: sample.id, parent: sample.parent, sku: sample.sku, name: sample.name, permalink: sample.permalink }));
console.log("[diagnose] wp product keys", JSON.stringify(Object.keys(wpProduct)));
console.log("[diagnose] wp product scalar summary", JSON.stringify(Object.fromEntries(Object.entries(wpProduct).filter(([, value]) => ["string","number","boolean"].includes(typeof value)).map(([key, value]) => [key, compact(value, 180)]))));
console.log("[diagnose] interesting REST paths", JSON.stringify(collectInteresting(wpProduct)));

const rendered = String(wpProduct.content?.rendered || "");
const $ = cheerio.load(rendered);
const headings = $("h1,h2,h3,h4,h5,h6,summary,strong").toArray().map((node) => compact($(node).text(), 160)).filter(Boolean);
const tables = $("table").toArray().map((table, index) => ({
  index,
  rows: $(table).find("tr").toArray().slice(0, 8).map((row) => $(row).find("th,td").toArray().map((cell) => compact($(cell).text(), 100))),
}));
const pdfs = $("a[href]").toArray().map((node) => ({ title: compact($(node).text(), 160), href: $(node).attr("href") })).filter((row) => /\.pdf(?:$|\?)/i.test(row.href || ""));
const productLinks = $("a[href*='/product/']").toArray().slice(0, 80).map((node) => ({ title: compact($(node).text(), 160), href: $(node).attr("href") }));
const text = compact($("body").text(), 5000);
console.log("[diagnose] content", JSON.stringify({ bytes: rendered.length, textLength: $("body").text().replace(/\s+/g," ").trim().length, headings, tableCount: tables.length, tables, pdfs, productLinks, markers: {
  overview: /microDOC|researcher/i.test(text),
  included: /Each microDOC unit includes|What(?:'|’)?s Included/i.test(text),
  specifications: /Specifications|Unit Dimensions|Analysis Software/i.test(text),
  documents: /Documents|MANUAL|Product Flyers/i.test(text),
  accessories: /Accessories|SYBR filter|White Light Illuminator/i.test(text),
}}));

const api = await json(`${BASE}/wp-json/`);
const routes = Object.keys(api?.routes || {}).filter((route) => /product|section|document|accessor|variation|spec|include|file|download|woo/i.test(route));
console.log("[diagnose] candidate routes", JSON.stringify(routes));

const sectionRecords = await json(`${BASE}/wp-json/wp/v2/product-section?per_page=100&context=view`);
console.log("[diagnose] product-section records", JSON.stringify((Array.isArray(sectionRecords) ? sectionRecords : []).map((record) => ({ id: record.id, slug: record.slug, parent: record.parent, title: compact(record.title?.rendered || record.title, 140), keys: Object.keys(record), interesting: collectInteresting(record).slice(0, 12) }))));
