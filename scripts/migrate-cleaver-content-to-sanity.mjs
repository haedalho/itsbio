#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");
const cheerio = require("cheerio");

const APPLY = process.argv.includes("--apply");
const MIGRATION_KEY = "cleaver-products-2026-08-24";
const PUBLIC_HOSTS = new Set(["www.msesupplies.com", "www.thistlescientific.com"]);
const DOCUMENT_HOSTS = new Set(["cdn.shopify.com", "files.plytix.com"]);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 10;
const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const cleanText = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

const inventory = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-product-catalog.json"), "utf8"));
const sourceMap = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-source-map.json"), "utf8"));
const reviewedSkus = new Map(inventory.map((product) => [normalizeSku(product.sku), product]));
if (inventory.length !== 1432 || reviewedSkus.size !== 1432) throw new Error("Expected exactly 1,432 reviewed Cleaver product SKUs.");

const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim()).find(Boolean);
if (APPLY && !token) throw new Error("Cleaver content migration requires the existing Production Sanity write token.");

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

async function pooled(items, limit, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const current = next;
      next += 1;
      await worker(items[current], current);
    }
  }));
}

async function retry(label, operation, maximum = 5) {
  for (let attempt = 0; attempt < maximum; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = Number(error?.statusCode || error?.response?.statusCode || 0);
      if (attempt === maximum - 1 || (status && ![408, 409, 429].includes(status) && status < 500)) throw error;
      const delay = Math.min(15_000, 650 * (2 ** attempt));
      console.warn(`[Cleaver content] retrying ${label} in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function fetchPublic(rawUrl, accept = "application/json,text/html;q=0.9,*/*;q=0.8") {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !PUBLIC_HOSTS.has(url.hostname)) throw new Error(`Unapproved public Cleaver source: ${url.hostname}`);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { headers: { Accept: accept }, redirect: "follow", signal: AbortSignal.timeout(45_000) });
    if ([401, 403].includes(response.status)) throw new Error(`Public Cleaver source denied access (HTTP ${response.status}): ${url.hostname}`);
    if (response.status === 429 && attempt < 4) {
      const requested = Number.parseInt(response.headers.get("retry-after") || "0", 10) * 1000;
      const delay = Math.min(30_000, Math.max(requested || 0, 1500 * (2 ** attempt)));
      console.warn(`[Cleaver content] respecting ${url.hostname} rate limit for ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (!response.ok) throw new Error(`Public Cleaver source returned HTTP ${response.status}: ${url.hostname}`);
    return response;
  }
  throw new Error(`Public Cleaver source remained rate-limited: ${url.hostname}`);
}

function normalizeImage(value) {
  try {
    const image = new URL(String(value).startsWith("//") ? `https:${value}` : String(value));
    if (image.protocol !== "https:" || image.hostname !== "cdn.shopify.com" || !/\.(?:avif|gif|jpe?g|png|webp)$/i.test(image.pathname)) return "";
    image.searchParams.delete("width");
    image.searchParams.delete("height");
    image.hash = "";
    return image.toString();
  } catch {
    return "";
  }
}

function extractDocuments($) {
  const documents = new Map();
  $("a[href]").each((_, node) => {
    try {
      const url = new URL($(node).attr("href"));
      if (url.protocol !== "https:" || !DOCUMENT_HOSTS.has(url.hostname) || !/\.pdf$/i.test(url.pathname)) return;
      const original = cleanText($(node).text());
      const filename = decodeURIComponent(url.pathname.split("/").at(-1) || "Product document.pdf").replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
      const title = original && !/^(?:click here|download)$/i.test(original) ? original.replace(/^download\s+/i, "") : filename;
      documents.set(url.toString(), { _key: hash(url.toString()).slice(0, 12), title: title.slice(0, 160), label: title.slice(0, 160), url: url.toString() });
    } catch {
      // Non-absolute links and unsupported files are intentionally ignored.
    }
  });
  return [...documents.values()].slice(0, 8);
}

function extractSpecificationRows($, requestedSku) {
  const sku = normalizeSku(requestedSku);
  const rows = [];
  const seen = new Set();
  const add = (label, value) => {
    const name = cleanText(label).replace(/:\s*$/, "");
    const detail = cleanText(value);
    if (!name || !detail || /^(?:sku|catalog(?:ue)?(?:\s+(?:no\.?|number))?|part number)$/i.test(name) || seen.has(name.toLowerCase())) return;
    if (name.length > 110 || detail.length > 500) return;
    seen.add(name.toLowerCase());
    rows.push({ _key: hash(`${sku}:${name}`).slice(0, 12), label: name, value: detail });
  };

  $("table").each((_, table) => {
    const matrix = $(table).find("tr").toArray().map((row) => $(row).find("th,td").toArray().map((cell) => cleanText($(cell).text()))).filter((row) => row.length > 1);
    if (!matrix.length) return;
    const header = matrix[0];
    const matchingColumn = header.findIndex((cell) => normalizeSku(cell) === sku);
    if (matchingColumn > 0) {
      matrix.slice(1).forEach((row) => add(row[0], row[matchingColumn]));
      return;
    }
    const matchingRow = matrix.find((row) => normalizeSku(row[0]) === sku);
    if (matchingRow && header.length === matchingRow.length) {
      header.slice(1).forEach((label, index) => add(label, matchingRow[index + 1]));
      return;
    }
    const explicitOtherSku = matrix.some((row) => row.some((cell) => reviewedSkus.has(normalizeSku(cell)) && normalizeSku(cell) !== sku));
    if (!explicitOtherSku && matrix.every((row) => row.length === 2)) matrix.forEach((row) => add(row[0], row[1]));
  });
  return rows.slice(0, 30);
}

function cleanOverview(rawHtml, supplier = false) {
  if (!rawHtml) return "";
  const $ = cheerio.load(rawHtml);
  $("script,style,iframe,form,button,table,img,video,svg").remove();
  $("h1").remove();
  $("h2,h3,h4,h5,h6").each((_, heading) => {
    const title = cleanText($(heading).text());
    if (/^(?:specifications?|technical data|documents?|downloads?|related products?|accessories)\s*:?$/i.test(title)) $(heading).remove();
  });
  $("p,li,div").each((_, element) => {
    const text = cleanText($(element).text());
    if (!text || (supplier && /\bMSE Supplies\b|authorized supplier|check out the accessories|for accessories see page|download (?:user )?manual/i.test(text))) {
      if (!$(element).find("p,ul,ol,h2,h3,h4").length) $(element).remove();
    }
  });
  $("a").each((_, anchor) => $(anchor).replaceWith($(anchor).text()));
  $("*").each((_, element) => {
    for (const attribute of Object.keys(element.attribs || {})) $(element).removeAttr(attribute);
  });
  return ($("body").html() || "").trim();
}

function extractOverviewDetails(html) {
  const $ = cheerio.load(html || "");
  const paragraphs = $("p").toArray().map((paragraph) => cleanText($(paragraph).text())).filter((paragraph) => paragraph.length > 45 && !/^this product includes/i.test(paragraph));
  const summary = (paragraphs[0] || cleanText($("body").text())).slice(0, 340).replace(/\s+\S*$/, (tail) => tail.length > 26 ? "" : tail).trim();
  const lists = $("ul").toArray().map((list) => $(list).find("li").toArray().map((item) => cleanText($(item).text())).filter((item) => item.length > 8 && item.length < 180));
  const highlights = (lists.find((list) => list.length >= 2) || []).slice(0, 6);
  return { summary, highlights };
}

const distributorContent = new Map();
const handles = new Set();
await pooled([1, 2, 3], 3, async (page) => {
  const url = `https://www.msesupplies.com/collections/vendors?page=${page}&q=Cleaver+Scientific`;
  const $ = cheerio.load(await (await fetchPublic(url, "text/html,*/*;q=0.8")).text());
  $("a[href*='/products/']").each((_, anchor) => {
    const handle = new URL($(anchor).attr("href"), url).pathname.split("/products/").at(-1)?.split("/")[0];
    if (handle && /^[a-z0-9][a-z0-9-]*$/i.test(handle)) handles.add(handle);
  });
});

let supplierFailures = 0;
await pooled([...handles], 5, async (handle) => {
  try {
    const page = `https://www.msesupplies.com/products/${handle}`;
    const source = await (await fetchPublic(`${page}.js`)).json();
    if (!/^cleaver scientific$/i.test(cleanText(source.vendor))) return;
    const rawHtml = String(source.description || "");
    const $ = cheerio.load(rawHtml);
    const docs = extractDocuments($);
    const overviewHtml = cleanOverview(rawHtml, true);
    const { summary, highlights } = extractOverviewDetails(overviewHtml);
    const familyImages = (Array.isArray(source.images) ? source.images : []).map(normalizeImage).filter(Boolean);

    for (const variant of Array.isArray(source.variants) ? source.variants : []) {
      const sku = normalizeSku(variant.sku);
      if (!reviewedSkus.has(sku)) continue;
      const specRows = extractSpecificationRows($, sku);
      const images = [...new Set([normalizeImage(variant.featured_image?.src), ...familyImages].filter(Boolean))].slice(0, 5);
      const next = { sku, page, overviewHtml, summary, highlights, specRows, docs, images };
      const previous = distributorContent.get(sku);
      if (!previous || next.specRows.length > previous.specRows.length || next.overviewHtml.length > previous.overviewHtml.length) distributorContent.set(sku, next);
    }
  } catch (error) {
    supplierFailures += 1;
    console.warn(`[Cleaver content] reviewed supplier ${handle}: ${error.message}`);
  }
});

const manufacturerProducts = new Map();
const skus = [...reviewedSkus.keys()];
const skuBatches = Array.from({ length: Math.ceil(skus.length / 35) }, (_, index) => skus.slice(index * 35, index * 35 + 35));
await pooled(skuBatches, 4, async (batch) => {
  try {
    const url = new URL("https://www.thistlescientific.com/wp-json/wc/store/v1/products");
    url.searchParams.set("sku", batch.join(","));
    url.searchParams.set("per_page", "100");
    const source = await (await fetchPublic(url.toString())).json();
    for (const item of Array.isArray(source) ? source : []) {
      const sku = normalizeSku(item.sku);
      if (reviewedSkus.has(sku)) manufacturerProducts.set(sku, item);
    }
  } catch (error) {
    console.warn(`[Cleaver content] optional public manufacturer SKU batch: ${error.message}`);
  }
});

const parentIds = [...new Set([...manufacturerProducts.values()].map((product) => Number(product.parent)).filter((id) => Number.isSafeInteger(id) && id > 0))];
const parentBatches = Array.from({ length: Math.ceil(parentIds.length / 30) }, (_, index) => parentIds.slice(index * 30, index * 30 + 30));
const parents = new Map();
await pooled(parentBatches, 4, async (batch) => {
  try {
    const url = new URL("https://www.thistlescientific.com/wp-json/wc/store/v1/products");
    url.searchParams.set("include", batch.join(","));
    url.searchParams.set("per_page", "100");
    const source = await (await fetchPublic(url.toString())).json();
    for (const parent of Array.isArray(source) ? source : []) parents.set(Number(parent.id), parent);
  } catch (error) {
    console.warn(`[Cleaver content] optional public manufacturer family batch: ${error.message}`);
  }
});

const manufacturerContent = new Map();
for (const [sku, product] of manufacturerProducts) {
  if (distributorContent.has(sku)) continue;
  const parent = parents.get(Number(product.parent));
  const manufacturerHtml = String(parent?.description || parent?.short_description || product.description || product.short_description || "");
  const overviewHtml = cleanOverview(manufacturerHtml);
  if (cleanText(cheerio.load(overviewHtml)("body").text()).length < 70) continue;
  const { summary, highlights } = extractOverviewDetails(overviewHtml);
  manufacturerContent.set(sku, { sku, overviewHtml, summary, highlights, specRows: [], docs: [], images: [] });
}

const candidates = new Map([...manufacturerContent, ...distributorContent]);
let sourceMapGalleryCandidates = 0;
for (const [rawSku, identity] of Object.entries(sourceMap)) {
  const sku = normalizeSku(rawSku);
  if (!reviewedSkus.has(sku)) continue;
  const manufacturerImages = Array.from(new Set((Array.isArray(identity?.images) ? identity.images : [])
    .map((url) => String(url || "").trim())
    .filter((url) => /^https:\/\/(?:www\.)?thistlescientific\.com\/wp-content\/uploads\//i.test(url))));
  if (!manufacturerImages.length) continue;
  sourceMapGalleryCandidates += 1;
  const existing = candidates.get(sku) || { sku, overviewHtml: "", summary: "", highlights: [], specRows: [], docs: [], images: [] };
  candidates.set(sku, { ...existing, manufacturerImages });
}
const candidateRows = [...candidates.values()];
const sample = distributorContent.get("MSMINI10");
const stats = {
  stage: APPLY ? "apply" : "dry-run",
  reviewedInventory: inventory.length,
  reviewedSupplierFamilies: handles.size,
  supplierFailures,
  exactSupplierSkuMatches: distributorContent.size,
  manufacturerSkuMatches: manufacturerProducts.size,
  manufacturerProductFamilies: parents.size,
  enrichedProductCandidates: candidates.size,
  skuSpecificSpecifications: candidateRows.filter((row) => row.specRows.length).length,
  manufacturerDocuments: candidateRows.filter((row) => row.docs.length).length,
  manufacturerGalleryCandidates: candidateRows.filter((row) => row.images.length > 1).length,
  sourceMapGalleryCandidates,
  sample: sample && { sku: sample.sku, overviewCharacters: sample.overviewHtml.length, specifications: sample.specRows, documents: sample.docs.length, galleryImages: sample.images.length },
};
console.log(JSON.stringify(stats));
if (distributorContent.size < 300 || !sample || sample.specRows.length < 6 || sample.docs.length < 2 || sample.images.length < 3) {
  throw new Error("Reviewed Cleaver content coverage or the MSMINI10 verification sample does not meet minimum publishing requirements.");
}
if (!APPLY) process.exit(0);

const [existingProducts, existingAssets] = await Promise.all([
  client.fetch(`*[_type == "product" && migrationKey == $migrationKey]{_id,sku,summary,overviewHtml,specsHtml,docs,"images":images[]{_key,_type,sourceUrl,asset},"width":images[0].asset->metadata.dimensions.width}`, { migrationKey: MIGRATION_KEY }),
  client.fetch(`*[_type == "sanity.imageAsset" && defined(source.id) && source.name match "*Cleaver*"]{_id,"sourceId":source.id}`),
]);
const productsBySku = new Map((existingProducts || []).map((product) => [normalizeSku(product.sku), product]));
const uploadedAssets = new Map((existingAssets || []).map((asset) => [asset.sourceId, Promise.resolve(asset)]));
let published = 0;
let failures = 0;
let newAssets = 0;

async function uploadGalleryImage(url, sku) {
  const previous = uploadedAssets.get(url);
  if (previous) return previous;
  const task = (async () => {
    const source = new URL(url);
    const fetchUrl = /(^|\.)thistlescientific\.com$/i.test(source.hostname)
      ? `https://i0.wp.com/${source.hostname}${source.pathname}${source.search}`
      : url;
    const response = await fetch(fetchUrl, { headers: { Accept: "image/*,*/*;q=0.8", "User-Agent": "ITS-BIO-CleaverCatalog/2.0" }, redirect: "follow", signal: AbortSignal.timeout(40_000) });
    if ([401, 403].includes(response.status)) throw new Error(`Reviewed manufacturer gallery denied access (HTTP ${response.status})`);
    if (!response.ok) throw new Error(`Reviewed manufacturer gallery returned HTTP ${response.status}`);
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const declared = Number.parseInt(response.headers.get("content-length") || "0", 10);
    if (!contentType.startsWith("image/") || declared > MAX_IMAGE_BYTES) throw new Error("Reviewed manufacturer gallery image exceeds format or size restrictions.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1500 || bytes.length > MAX_IMAGE_BYTES) throw new Error("Reviewed manufacturer gallery image has an invalid size.");
    const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const filename = `cleaver-gallery-${sku.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${hash(url).slice(0, 12)}.${extension}`;
    const asset = await retry(`gallery image ${sku}`, () => client.assets.upload("image", bytes, { filename, contentType, source: { id: url, name: "Authorized Cleaver Scientific manufacturer gallery" } }));
    newAssets += 1;
    return asset;
  })();
  uploadedAssets.set(url, task);
  try {
    return await task;
  } catch (error) {
    uploadedAssets.delete(url);
    throw error;
  }
}

await pooled(candidateRows, 6, async (candidate) => {
  const existing = productsBySku.get(candidate.sku);
  if (!existing) return;
  try {
    const fields = { detailedContentMigratedAt: new Date().toISOString() };
    if (candidate.overviewHtml.length > String(existing.overviewHtml || "").length) {
      fields.overviewHtml = candidate.overviewHtml;
      if (candidate.summary) fields.summary = candidate.summary;
    }
    if (candidate.highlights.length) fields.highlights = candidate.highlights;
    if (candidate.specRows.length) {
      fields.specRows = candidate.specRows;
      fields.specsHtml = `<table><tbody>${candidate.specRows.map((row) => `<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`).join("")}</tbody></table>`;
    }
    if (candidate.docs.length) fields.docs = candidate.docs;

    const existingImages = Array.isArray(existing.images) ? existing.images.filter((image) => image?.asset?._ref) : [];
    const images = [];
    const knownSources = new Set();
    const manufacturerImages = candidate.manufacturerImages || [];
    const preferredImages = manufacturerImages.length ? manufacturerImages : (candidate.images || []);
    for (const imageUrl of preferredImages) {
      if (images.length >= MAX_GALLERY_IMAGES) break;
      if (knownSources.has(imageUrl)) continue;
      const asset = await uploadGalleryImage(imageUrl, candidate.sku);
      if (images.some((image) => image.asset?._ref === asset._id)) continue;
      images.push({ _key: hash(`${candidate.sku}:${imageUrl}`).slice(0, 12), _type: "image", asset: { _type: "reference", _ref: asset._id }, sourceUrl: imageUrl });
      knownSources.add(imageUrl);
    }
    if (!manufacturerImages.length) {
      for (const image of existingImages) {
        if (images.length >= MAX_GALLERY_IMAGES) break;
        if (images.some((candidateImage) => candidateImage.asset?._ref === image.asset?._ref)) continue;
        images.push(image);
      }
    }
    if (images.length && JSON.stringify(images) !== JSON.stringify(existingImages)) fields.images = images;

    await retry(`Cleaver detailed content ${candidate.sku}`, () => client.patch(existing._id).set(fields).commit({ visibility: "async" }));
    published += 1;
    if (published <= 6 || published % 25 === 0 || published === candidateRows.length) console.log(`[Cleaver content] published ${published}/${candidateRows.length}: ${candidate.sku}`);
  } catch (error) {
    failures += 1;
    console.warn(`[Cleaver content] ${candidate.sku}: ${error.message}`);
  }
});

const totals = await client.fetch(`{"products":count(*[_type == "product" && migrationKey == $key]),"gallery":count(*[_type == "product" && migrationKey == $key && count(images) > 1]),"specifications":count(*[_type == "product" && migrationKey == $key && count(specRows) > 0]),"documents":count(*[_type == "product" && migrationKey == $key && count(docs) > 0]),"highlights":count(*[_type == "product" && migrationKey == $key && count(highlights) > 0])}`, { key: MIGRATION_KEY });
console.log(JSON.stringify({ published, failures, newManagedGalleryAssets: newAssets, totals }));
if (totals.specifications < 100 || totals.documents < 200 || failures > Math.max(15, candidateRows.length * 0.1)) {
  throw new Error(`Cleaver detailed-content migration is incomplete: ${totals.specifications} specifications, ${totals.documents} document sets, ${failures} failures.`);
}
