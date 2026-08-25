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

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { ...headers, ...(options.headers || {}) },
    redirect: "follow",
    signal: AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  console.log(`[diagnose] ${new URL(url).pathname}${new URL(url).search}: HTTP ${response.status}, bytes=${text.length}`);
  let body = null;
  try { body = JSON.parse(text); } catch {}
  return { response, text, body };
}

const api = await request(`${BASE}/wp-json/`);
const apiIndex = api.body;
console.log("[diagnose] namespaces", JSON.stringify(apiIndex?.namespaces || []));
const routeKeys = Object.keys(apiIndex?.routes || {}).filter((route) => /product|section|document|accessor|variation|spec|include|acf|meta|jet|elementor|woo/i.test(route));
console.log("[diagnose] matching routes", JSON.stringify(routeKeys));

const types = await request(`${BASE}/wp-json/wp/v2/types`);
console.log("[diagnose] WP types", JSON.stringify(Object.keys(types.body || {})));
for (const [name, type] of Object.entries(types.body || {})) {
  if (/product|section|document|accessor|variation/i.test(`${name} ${type?.name || ""} ${type?.rest_base || ""}`)) {
    console.log("[diagnose] relevant WP type", JSON.stringify({ name, rest_base: type?.rest_base, rest_namespace: type?.rest_namespace }));
  }
}

const productsUrl = new URL(`${BASE}/wp-json/wc/store/v1/products`);
productsUrl.searchParams.set("sku", SAMPLE_SKU);
productsUrl.searchParams.set("per_page", "10");
const productsResponse = await request(productsUrl.toString());
const products = productsResponse.body;
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

let parent = null;
if (sample?.parent) {
  const parentUrl = new URL(`${BASE}/wp-json/wc/store/v1/products`);
  parentUrl.searchParams.set("include", String(sample.parent));
  parentUrl.searchParams.set("per_page", "10");
  const parentsResponse = await request(parentUrl.toString());
  const parents = parentsResponse.body;
  parent = Array.isArray(parents) ? parents[0] : null;
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

for (const id of [sample?.parent, sample?.id].filter(Boolean)) {
  const wc3 = await request(`${BASE}/wp-json/wc/v3/products/${id}`);
  if (wc3.body && !wc3.body.code) {
    console.log(`[diagnose] wc/v3 product ${id} keys`, JSON.stringify(Object.keys(wc3.body)));
    console.log(`[diagnose] wc/v3 product ${id} metadata`, JSON.stringify({ meta_data: wc3.body.meta_data, attributes: wc3.body.attributes, grouped_products: wc3.body.grouped_products }));
  } else {
    console.log(`[diagnose] wc/v3 product ${id} response`, JSON.stringify(wc3.body));
  }
}

for (const restBase of ["product", "products", "product_variation", "product-variation"]) {
  const probe = await request(`${BASE}/wp-json/wp/v2/${restBase}?include=${sample?.parent || 1140}&per_page=1`);
  console.log(`[diagnose] wp/v2/${restBase} response`, JSON.stringify(probe.body)?.slice(0, 1500));
}

const sectionsUrl = new URL(`${BASE}/wp-json/wp/v2/product-section`);
sectionsUrl.searchParams.set("per_page", "100");
sectionsUrl.searchParams.set("context", "view");
const sectionsResponse = await request(sectionsUrl.toString());
const sections = sectionsResponse.body;
console.log("[diagnose] product-section count", Array.isArray(sections) ? sections.length : 0);
for (const section of Array.isArray(sections) ? sections : []) {
  console.log("[diagnose] product-section", JSON.stringify(section));
}

const samplePageUrl = sample?.permalink || `${BASE}/product/microdoc-gel-documentation-hood-with-screen/?attribute_pa_item=microdoc-system-with-254-365nm-uv-transilluminator-analysis-software`;
for (const suffix of ["", "&output=1", "&amp=1", "&ss=global"]) {
  const page = await request(`${samplePageUrl}${suffix}`, {
    headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
  });
  console.log("[diagnose] page markers", JSON.stringify({
    suffix,
    overview: /Overview/i.test(page.text),
    specifications: /Specifications/i.test(page.text),
    included: /What(?:'|&#0?39;|’)?s Included/i.test(page.text),
    documents: /Documents/i.test(page.text),
    variations: /All Variations/i.test(page.text),
    accessories: /Accessories/i.test(page.text),
  }));
}
