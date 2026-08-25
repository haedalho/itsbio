#!/usr/bin/env node

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
  console.log(`[diagnose] ${new URL(url).pathname}: HTTP ${response.status}`);
  if (!response.ok) return null;
  return response.json();
}

const apiIndex = await json(`${BASE}/wp-json/`);
const routeKeys = Object.keys(apiIndex?.routes || {}).filter((route) => /product|section|document|accessor|variation|spec|include/i.test(route));
console.log("[diagnose] matching routes", JSON.stringify(routeKeys));

const productsUrl = new URL(`${BASE}/wp-json/wc/store/v1/products`);
productsUrl.searchParams.set("sku", SAMPLE_SKU);
productsUrl.searchParams.set("per_page", "10");
const products = await json(productsUrl.toString());
const sample = Array.isArray(products) ? products[0] : null;
console.log("[diagnose] sample product keys", JSON.stringify(Object.keys(sample || {})));
console.log("[diagnose] sample product summary", JSON.stringify(sample && {
  id: sample.id,
  parent: sample.parent,
  name: sample.name,
  slug: sample.slug,
  sku: sample.sku,
  permalink: sample.permalink,
  attributes: sample.attributes,
  variations: sample.variations,
  extensions: sample.extensions,
  descriptionLength: String(sample.description || "").length,
  shortDescriptionLength: String(sample.short_description || "").length,
}));

if (sample?.parent) {
  const parentUrl = new URL(`${BASE}/wp-json/wc/store/v1/products`);
  parentUrl.searchParams.set("include", String(sample.parent));
  parentUrl.searchParams.set("per_page", "10");
  const parents = await json(parentUrl.toString());
  const parent = Array.isArray(parents) ? parents[0] : null;
  console.log("[diagnose] sample parent summary", JSON.stringify(parent && {
    id: parent.id,
    parent: parent.parent,
    name: parent.name,
    slug: parent.slug,
    sku: parent.sku,
    attributes: parent.attributes,
    variations: parent.variations,
    extensions: parent.extensions,
    descriptionLength: String(parent.description || "").length,
    shortDescriptionLength: String(parent.short_description || "").length,
  }));
}

const sectionsUrl = new URL(`${BASE}/wp-json/wp/v2/product-section`);
sectionsUrl.searchParams.set("per_page", "100");
sectionsUrl.searchParams.set("context", "view");
const sections = await json(sectionsUrl.toString());
console.log("[diagnose] product-section count", Array.isArray(sections) ? sections.length : 0);
for (const section of Array.isArray(sections) ? sections : []) {
  console.log("[diagnose] product-section", JSON.stringify(section));
}
