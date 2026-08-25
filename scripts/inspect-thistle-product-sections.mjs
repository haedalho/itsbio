#!/usr/bin/env node

const fetchJson = async (rawUrl) => {
  const response = await fetch(rawUrl, { headers: { Accept: "application/json,*/*;q=0.8" }, signal: AbortSignal.timeout(60000) });
  let body;
  try { body = await response.json(); } catch { body = null; }
  return { status: response.status, body, url: response.url };
};

const sku = "CSL-MDOCUV254/3651D";
const store = new URL("https://www.thistlescientific.com/wp-json/wc/store/v1/products");
store.searchParams.set("sku", sku);
store.searchParams.set("per_page", "20");
const storeResult = await fetchJson(store);
const variant = Array.isArray(storeResult.body) ? storeResult.body[0] : null;
if (!variant) throw new Error(`No microDOC variant found (${storeResult.status})`);
const parentId = Number(variant.parent || 0);
const parentResult = await fetchJson(`https://www.thistlescientific.com/wp-json/wp/v2/product/${parentId}`);
const parent = parentResult.body;
console.log(JSON.stringify({ variant: { id: variant.id, parent: parentId, sku: variant.sku, permalink: variant.permalink }, parent: { id: parent?.id, slug: parent?.slug, title: parent?.title?.rendered } }));

const typeResult = await fetchJson("https://www.thistlescientific.com/wp-json/wp/v2/types/product-section");
console.log(JSON.stringify({ typeStatus: typeResult.status, type: typeResult.body }, null, 2));

const queries = [
  "https://www.thistlescientific.com/wp-json/wp/v2/product-section?per_page=100&search=microDOC",
  `https://www.thistlescientific.com/wp-json/wp/v2/product-section?per_page=100&parent=${parentId}`,
  "https://www.thistlescientific.com/wp-json/wp/v2/product-section?per_page=100&orderby=modified&order=desc",
];

const records = new Map();
for (const url of queries) {
  const result = await fetchJson(url);
  console.log(JSON.stringify({ query: url, status: result.status, count: Array.isArray(result.body) ? result.body.length : null }));
  for (const row of Array.isArray(result.body) ? result.body : []) records.set(row.id, row);
}

const needles = ["microdoc", String(parentId), String(variant.id), sku.toLowerCase(), "specification", "document", "accessor", "included", "variation"];
const normalized = [...records.values()].map((row) => {
  const haystack = JSON.stringify(row).toLowerCase();
  const hits = needles.filter((needle) => haystack.includes(needle));
  return {
    id: row.id,
    parent: row.parent,
    slug: row.slug,
    title: row.title?.rendered || "",
    modified: row.modified,
    keys: Object.keys(row),
    hits,
    content: row.content?.rendered || "",
    excerpt: row.excerpt?.rendered || "",
    meta: row.meta,
    acf: row.acf,
    links: row._links,
  };
});
console.log(JSON.stringify({ matchedSections: normalized.filter((row) => row.hits.length).slice(0, 100), sampleSections: normalized.slice(0, 20) }, null, 2));