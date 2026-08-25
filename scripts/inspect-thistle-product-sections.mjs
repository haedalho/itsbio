#!/usr/bin/env node

const sku = "CSL-MDOCUV254/3651D";
const base = new URL("https://www.thistlescientific.com/wp-json/wc/store/v1/products");
base.searchParams.set("sku", sku);
base.searchParams.set("per_page", "20");
const response = await fetch(base, { headers: { Accept: "application/json,*/*;q=0.8" }, signal: AbortSignal.timeout(60000) });
console.log(JSON.stringify({ status: response.status, url: response.url }));
if (!response.ok) process.exit(1);
const rows = await response.json();
const product = Array.isArray(rows) ? rows[0] : null;
if (!product) throw new Error("No microDOC variant found");
console.log(JSON.stringify({
  productKeys: Object.keys(product),
  id: product.id,
  parent: product.parent,
  name: product.name,
  sku: product.sku,
  permalink: product.permalink,
  description: product.description,
  short_description: product.short_description,
  attributes: product.attributes,
  variations: product.variations,
  extensions: product.extensions,
  images: product.images,
}, null, 2));
if (Number(product.parent) > 0) {
  const parentUrl = new URL("https://www.thistlescientific.com/wp-json/wc/store/v1/products");
  parentUrl.searchParams.set("include", String(product.parent));
  parentUrl.searchParams.set("per_page", "20");
  const parentResponse = await fetch(parentUrl, { headers: { Accept: "application/json,*/*;q=0.8" }, signal: AbortSignal.timeout(60000) });
  const parents = parentResponse.ok ? await parentResponse.json() : [];
  const parent = Array.isArray(parents) ? parents[0] : null;
  console.log(JSON.stringify({
    parentStatus: parentResponse.status,
    parentKeys: parent ? Object.keys(parent) : [],
    id: parent?.id,
    name: parent?.name,
    sku: parent?.sku,
    permalink: parent?.permalink,
    description: parent?.description,
    short_description: parent?.short_description,
    attributes: parent?.attributes,
    variations: parent?.variations,
    extensions: parent?.extensions,
    images: parent?.images,
  }, null, 2));
}