#!/usr/bin/env node

const fetchJson = async (url) => {
  const response = await fetch(url, { headers: { Accept: "application/json,*/*;q=0.8" }, signal: AbortSignal.timeout(60000) });
  let body;
  try { body = await response.json(); } catch { body = null; }
  return { status: response.status, body, url: response.url };
};

const sku = "CSL-MDOCUV254/3651D";
const store = new URL("https://www.thistlescientific.com/wp-json/wc/store/v1/products");
store.searchParams.set("sku", sku);
store.searchParams.set("per_page", "20");
const storeResult = await fetchJson(store);
const product = Array.isArray(storeResult.body) ? storeResult.body[0] : null;
if (!product) throw new Error(`No microDOC variant found (${storeResult.status})`);
const parentId = Number(product.parent || 0);
console.log(JSON.stringify({ storeStatus: storeResult.status, variant: { id: product.id, parent: parentId, sku: product.sku, permalink: product.permalink } }));

for (const endpoint of [
  `https://www.thistlescientific.com/wp-json/wp/v2/product/${parentId}`,
  `https://www.thistlescientific.com/wp-json/wp/v2/products/${parentId}`,
  `https://www.thistlescientific.com/wp-json/wp/v2/product?include=${parentId}`,
  `https://www.thistlescientific.com/wp-json/wp/v2/products?include=${parentId}`,
]) {
  const result = await fetchJson(endpoint);
  const sample = Array.isArray(result.body) ? result.body[0] : result.body;
  console.log(JSON.stringify({ endpoint, status: result.status, keys: sample && typeof sample === "object" ? Object.keys(sample) : [], sample }, null, 2));
}

const root = await fetchJson("https://www.thistlescientific.com/wp-json/");
const routes = root.body?.routes && typeof root.body.routes === "object" ? Object.keys(root.body.routes) : [];
const interesting = routes.filter((route) => /(product|document|download|spec|accessor|variation|bundle|composite|linked|related|woo)/i.test(route));
console.log(JSON.stringify({ rootStatus: root.status, interestingRoutes: interesting.slice(0, 300) }, null, 2));