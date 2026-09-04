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
const SAMPLE_SKU = "CSL-MDOCUV254/3651D";
const SOURCE_HOST = "www.thistlescientific.com";
const SECTION_ENDPOINT = `https://${SOURCE_HOST}/wp-json/wp/v2/product-section`;
const USER_AGENT = "Mozilla/5.0 (compatible; ITS-BIO-CleaverCatalog/1.0; +https://itsbio.vercel.app)";
const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const cleanText = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");
const titleKey = (value) => cleanText(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const slugify = (value) => cleanText(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const inventory = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-product-catalog.json"), "utf8"));
const reviewedSkus = new Map(inventory.map((product) => [normalizeSku(product.sku), product]));
const reviewedTitles = new Map(inventory.map((product) => [titleKey(product.title), product]));
if (inventory.length !== 1432 || reviewedSkus.size !== 1432) throw new Error("Expected exactly 1,432 reviewed Cleaver product SKUs.");
if (!reviewedSkus.has(SAMPLE_SKU)) throw new Error(`Expected verification sample ${SAMPLE_SKU} in reviewed inventory.`);

const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim()).find(Boolean);
if (APPLY && !token) throw new Error("Full Thistle section migration requires the existing Production Sanity write token.");

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

async function fetchSource(rawUrl, accept = "application/json,text/html;q=0.9,*/*;q=0.8") {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.hostname !== SOURCE_HOST) throw new Error(`Unapproved Thistle source: ${url.hostname}`);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: accept,
        "Accept-Language": "en-GB,en;q=0.9",
        "Cache-Control": "no-cache",
        Referer: `https://${SOURCE_HOST}/`,
        "User-Agent": USER_AGENT,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(45_000),
    });
    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number.parseInt(response.headers.get("retry-after") || "0", 10) * 1000;
      const delay = Math.min(30_000, Math.max(retryAfter || 0, 1400 * (2 ** attempt)));
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (!response.ok) throw new Error(`Thistle source returned HTTP ${response.status}: ${url.pathname}`);
    return response;
  }
  throw new Error(`Thistle source remained rate-limited: ${url.pathname}`);
}

function productSlug(title, sku) {
  const suffix = slugify(String(sku).replace(/\$/g, "-variant"));
  const base = slugify(title).slice(0, Math.max(20, 145 - suffix.length)).replace(/-+$/g, "");
  return `${base || "cleaver-product"}-${suffix}`;
}

function internalHrefForTitle(title) {
  const match = reviewedTitles.get(titleKey(title));
  return match ? `/products/cleaver/item/${encodeURIComponent(productSlug(match.title, match.sku))}` : "";
}

function safeAbsoluteUrl(value, baseUrl) {
  try {
    const url = new URL(String(value || ""), baseUrl);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function priceText(value) {
  const text = cleanText(value);
  const match = text.match(/£\s*[\d,.]+(?:\s*[–-]\s*£?\s*[\d,.]+)?(?:\s*(?:ex\.?\s*VAT|inc\.?\s*VAT))?/i);
  return match ? cleanText(match[0]) : "";
}

function packText(value) {
  const text = cleanText(value);
  const match = text.match(/\b\d+\s*\/\s*(?:Each|Pack|Box|Case|Kit|Unit|Set|Pair)\b/i);
  return match ? cleanText(match[0]) : "";
}

const SECTION_LABELS = ["Overview", "Specifications", "What's Included", "Documents", "All Variations", "Accessories"];
const canonicalSectionLabel = (value) => {
  const key = cleanText(value).replace(/\s*\+\s*$/, "").replace(/[’]/g, "'").toLowerCase();
  return SECTION_LABELS.find((label) => label.toLowerCase() === key) || "";
};

function findSectionRoot($, label) {
  const heading = $("h2,h3,h4,h5,h6,summary").filter((_, node) => canonicalSectionLabel($(node).text()) === label).first();
  if (!heading.length) return null;
  let cursor = heading;
  for (let depth = 0; depth < 7; depth += 1) {
    const next = cursor.next();
    if (next.length && cleanText(next.text()).length > 8 && !canonicalSectionLabel(next.text())) return next;
    const parent = cursor.parent();
    if (!parent.length) break;
    const knownHeadings = parent.find("h2,h3,h4,h5,h6,summary").toArray().filter((node) => canonicalSectionLabel($(node).text())).length;
    const text = cleanText(parent.text());
    if (knownHeadings === 1 && text.length > label.length + 12 && text.length < 120_000) return parent;
    cursor = parent;
  }
  return null;
}

function sanitizeOverview(root, label) {
  if (!root?.length) return "";
  const clone = root.clone();
  clone.find("script,style,iframe,video,form,button,input,select,textarea,svg,noscript").remove();
  clone.find("h2,h3,h4,h5,h6,summary").each((_, node) => {
    if (canonicalSectionLabel(clone.find(node).text()) === label) clone.find(node).remove();
  });
  clone.find("a").each((_, node) => clone.find(node).replaceWith(clone.find(node).text()));
  clone.find("*").each((_, node) => {
    for (const attribute of Object.keys(node.attribs || {})) clone.find(node).removeAttr(attribute);
  });
  const html = (clone.html() || "").trim();
  return cleanText(clone.text()).length >= 40 ? html : "";
}

function specificationRows(root, requestedSku) {
  if (!root?.length) return [];
  const sku = normalizeSku(requestedSku);
  const rows = [];
  const seen = new Set();
  const add = (label, value) => {
    const name = cleanText(label).replace(/:\s*$/, "");
    const detail = cleanText(value);
    const key = name.toLowerCase();
    if (!name || !detail || seen.has(key) || /^(?:sku|catalog(?:ue)?(?:\s+(?:no\.?|number))?|part number)$/i.test(name)) return;
    if (name.length > 120 || detail.length > 700) return;
    seen.add(key);
    rows.push({ _key: hash(`${sku}:${name}`).slice(0, 12), label: name, value: detail });
  };

  root.find("table").each((_, table) => {
    const matrix = root.find(table).find("tr").toArray().map((row) => root.find(row).find("th,td").toArray().map((cell) => cleanText(root.find(cell).text()))).filter((row) => row.length > 1);
    if (!matrix.length) return;
    const header = matrix[0];
    const matchingColumn = header.findIndex((cell) => normalizeSku(cell) === sku);
    if (matchingColumn > 0) {
      matrix.slice(1).forEach((row) => add(row[0], row[matchingColumn]));
      return;
    }
    const matchingRow = matrix.find((row) => normalizeSku(row[0]) === sku);
    if (matchingRow && matchingRow.length === header.length) header.slice(1).forEach((name, index) => add(name, matchingRow[index + 1]));
  });
  return rows.slice(0, 40);
}

function documents(root, pageUrl) {
  if (!root?.length) return [];
  const items = new Map();
  root.find("a[href]").each((_, node) => {
    const href = safeAbsoluteUrl(root.find(node).attr("href"), pageUrl);
    if (!href || !/\.pdf(?:$|\?)/i.test(href)) return;
    const raw = cleanText(root.find(node).text()).replace(/\(PDF\)$/i, "");
    const filename = decodeURIComponent(new URL(href).pathname.split("/").at(-1) || "Product document.pdf").replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
    const title = (raw || filename).slice(0, 180);
    items.set(href, { _key: hash(href).slice(0, 12), title, label: title, url: href });
  });
  return [...items.values()].slice(0, 20);
}

function includedItems(root, pageUrl) {
  if (!root?.length) return [];
  const items = new Map();
  const add = (title, context = "", sourceUrl = "", imageUrl = "") => {
    const name = cleanText(title).replace(/\s*Qty\s*:\s*\d+\s*$/i, "");
    if (!name || /^(?:view product|add to basket|order now)$/i.test(name)) return;
    const qty = cleanText(context).match(/Qty\s*:\s*(\d+)/i)?.[1] || "";
    const key = titleKey(name);
    if (!key || items.has(key)) return;
    items.set(key, { _key: hash(`included:${key}`).slice(0, 12), title: name.slice(0, 180), quantity: qty, sourceUrl, imageUrl });
  };

  root.find("a[href*='/product/']").each((_, node) => {
    const anchor = root.find(node);
    const holder = anchor.closest("tr,li,[class*='product'],[class*='item']");
    const context = cleanText((holder.length ? holder : anchor.parent()).text());
    const imageUrl = safeAbsoluteUrl((holder.length ? holder : anchor.parent()).find("img[src]").first().attr("src"), pageUrl);
    add(anchor.text(), context, safeAbsoluteUrl(anchor.attr("href"), pageUrl), imageUrl);
  });
  if (!items.size) root.find("li").each((_, node) => add(root.find(node).text(), root.find(node).text()));
  return [...items.values()].slice(0, 30);
}

function accessoryItems(root, pageUrl) {
  if (!root?.length) return [];
  const items = new Map();
  root.find("a[href*='/product/']").each((_, node) => {
    const anchor = root.find(node);
    const title = cleanText(anchor.text());
    if (!title || /^(?:view product|add to basket|order now)$/i.test(title)) return;
    const sourceUrl = safeAbsoluteUrl(anchor.attr("href"), pageUrl);
    if (!sourceUrl) return;
    const holder = anchor.closest("tr,li,[class*='product'],[class*='item'],[class*='row']");
    const contextNode = holder.length ? holder : anchor.parent();
    const context = cleanText(contextNode.text());
    const imageUrl = safeAbsoluteUrl(contextNode.find("img[src]").first().attr("src"), pageUrl);
    const key = `${titleKey(title)}:${sourceUrl}`;
    if (items.has(key)) return;
    items.set(key, {
      _key: hash(`accessory:${key}`).slice(0, 12),
      title: title.slice(0, 180),
      packSize: packText(context),
      priceText: priceText(context),
      sourceUrl,
      imageUrl,
      internalHref: internalHrefForTitle(title),
    });
  });
  return [...items.values()].slice(0, 60);
}

function variationRows(root, familyProducts) {
  const sourceRows = [];
  if (root?.length) {
    root.find("tr").each((_, row) => {
      const cells = root.find(row).find("th,td").toArray().map((cell) => cleanText(root.find(cell).text())).filter(Boolean);
      if (cells.length < 2 || /^(?:variant|item)$/i.test(cells[0])) return;
      sourceRows.push({ title: cells[0], packSize: cells.map(packText).find(Boolean) || "", priceText: cells.map(priceText).find(Boolean) || "" });
    });
  }

  const result = [];
  const seen = new Set();
  for (const product of familyProducts) {
    const sku = normalizeSku(product.sku);
    const inventoryProduct = reviewedSkus.get(sku);
    if (!inventoryProduct || seen.has(sku)) continue;
    seen.add(sku);
    const source = sourceRows.find((row) => {
      const sourceKey = titleKey(row.title);
      const inventoryKey = titleKey(inventoryProduct.title);
      return sourceKey === inventoryKey || sourceKey.includes(inventoryKey) || inventoryKey.includes(sourceKey);
    });
    const imageUrl = safeAbsoluteUrl(product.images?.[0]?.src || product.images?.[0]?.thumbnail || "", `https://${SOURCE_HOST}/`);
    result.push({
      _key: hash(`variation:${sku}`).slice(0, 12),
      title: inventoryProduct.title,
      sku: inventoryProduct.sku,
      packSize: source?.packSize || "",
      priceText: source?.priceText || "",
      imageUrl,
      internalHref: `/products/cleaver/item/${encodeURIComponent(productSlug(inventoryProduct.title, inventoryProduct.sku))}`,
    });
  }
  return result.slice(0, 100);
}

function videoItems(html, pageUrl) {
  const $ = cheerio.load(html || "");
  const urls = new Map();
  const add = (raw) => {
    const url = safeAbsoluteUrl(raw, pageUrl);
    if (!url || !/(?:youtube\.com|youtu\.be|vimeo\.com|\.mp4(?:$|\?)|\.webm(?:$|\?))/i.test(url)) return;
    let embedUrl = "";
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtube.com")) {
        const id = parsed.pathname.startsWith("/embed/") ? parsed.pathname.split("/embed/")[1]?.split("/")[0] : parsed.searchParams.get("v");
        if (id) embedUrl = `https://www.youtube.com/embed/${id}`;
      } else if (parsed.hostname === "youtu.be") {
        const id = parsed.pathname.split("/").filter(Boolean)[0];
        if (id) embedUrl = `https://www.youtube.com/embed/${id}`;
      } else if (parsed.hostname.includes("vimeo.com")) {
        const id = parsed.pathname.split("/").filter(Boolean).at(-1);
        if (id && /^\d+$/.test(id)) embedUrl = `https://player.vimeo.com/video/${id}`;
      }
    } catch {
      return;
    }
    const key = embedUrl || url;
    if (!urls.has(key)) urls.set(key, { _key: hash(`video:${key}`).slice(0, 12), title: "Product video", url, embedUrl });
  };
  $("iframe[src],video[src],source[src]").each((_, node) => add($(node).attr("src")));
  $("a[href]").each((_, node) => add($(node).attr("href")));
  return [...urls.values()].slice(0, 8);
}

function recursiveStrings(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => recursiveStrings(item, output));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => recursiveStrings(item, output));
  return output;
}

function sectionLabelFromRecord(record) {
  const candidates = [record?.title?.rendered, record?.title, record?.slug, ...recursiveStrings(record).filter((value) => value.length < 80)];
  for (const candidate of candidates) {
    const label = canonicalSectionLabel(String(candidate || "").replace(/[-_]+/g, " "));
    if (label) return label;
  }
  return "";
}

function sectionHtmlFromRecord(record) {
  const strings = recursiveStrings(record).filter((value) => /<(?:table|p|ul|ol|li|a|div|section)\b/i.test(value));
  return strings.sort((a, b) => b.length - a.length)[0] || String(record?.content?.rendered || "");
}

function recordMatchesFamily(record, familyId, sourceIds, familySkus, parentSlug) {
  if (Number(record?.parent) === Number(familyId)) return true;
  const raw = JSON.stringify(record);
  if (parentSlug && (String(record?.slug || "").includes(parentSlug) || raw.includes(`\"${parentSlug}\"`))) return true;
  if (familySkus.some((sku) => sku && raw.includes(sku))) return true;
  return sourceIds.some((id) => id > 0 && new RegExp(`(?:product|parent|post)[^0-9]{0,20}${id}(?:[^0-9]|$)`, "i").test(raw));
}

async function loadPublicProductSections() {
  try {
    const firstUrl = new URL(SECTION_ENDPOINT);
    firstUrl.searchParams.set("per_page", "100");
    firstUrl.searchParams.set("page", "1");
    const firstResponse = await fetchSource(firstUrl.toString());
    const first = await firstResponse.json();
    const totalPages = Math.min(120, Math.max(1, Number.parseInt(firstResponse.headers.get("x-wp-totalpages") || "1", 10)));
    const pages = [Array.isArray(first) ? first : []];
    const rest = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
    await pooled(rest, 4, async (pageNumber) => {
      const url = new URL(SECTION_ENDPOINT);
      url.searchParams.set("per_page", "100");
      url.searchParams.set("page", String(pageNumber));
      const response = await fetchSource(url.toString());
      pages[pageNumber - 1] = await response.json();
    });
    return pages.flat().filter(Boolean);
  } catch (error) {
    console.warn(`[Cleaver sections] optional product-section API unavailable: ${error.message}`);
    return [];
  }
}

const manufacturerProducts = new Map();
const skus = [...reviewedSkus.keys()];
const skuBatches = Array.from({ length: Math.ceil(skus.length / 30) }, (_, index) => skus.slice(index * 30, index * 30 + 30));
await pooled(skuBatches, 4, async (batch) => {
  try {
    const url = new URL(`https://${SOURCE_HOST}/wp-json/wc/store/v1/products`);
    url.searchParams.set("sku", batch.join(","));
    url.searchParams.set("per_page", "100");
    const rows = await (await fetchSource(url.toString())).json();
    for (const product of Array.isArray(rows) ? rows : []) {
      const sku = normalizeSku(product.sku);
      if (reviewedSkus.has(sku)) manufacturerProducts.set(sku, product);
    }
  } catch (error) {
    console.warn(`[Cleaver sections] manufacturer SKU batch: ${error.message}`);
  }
});

const parentIds = [...new Set([...manufacturerProducts.values()].map((product) => Number(product.parent)).filter((id) => Number.isSafeInteger(id) && id > 0))];
const parents = new Map();
const parentBatches = Array.from({ length: Math.ceil(parentIds.length / 30) }, (_, index) => parentIds.slice(index * 30, index * 30 + 30));
await pooled(parentBatches, 4, async (batch) => {
  try {
    const url = new URL(`https://${SOURCE_HOST}/wp-json/wc/store/v1/products`);
    url.searchParams.set("include", batch.join(","));
    url.searchParams.set("per_page", "100");
    const rows = await (await fetchSource(url.toString())).json();
    for (const product of Array.isArray(rows) ? rows : []) parents.set(Number(product.id), product);
  } catch (error) {
    console.warn(`[Cleaver sections] manufacturer family batch: ${error.message}`);
  }
});

const publicSectionRecords = await loadPublicProductSections();
const families = new Map();
for (const [sku, product] of manufacturerProducts) {
  const familyId = Number(product.parent) > 0 ? Number(product.parent) : Number(product.id);
  if (!Number.isSafeInteger(familyId) || familyId <= 0) continue;
  const family = families.get(familyId) || { id: familyId, parent: parents.get(familyId), products: [] };
  family.products.push({ ...product, sku });
  if (!family.parent) family.parent = parents.get(familyId) || (Number(product.parent) > 0 ? null : product);
  families.set(familyId, family);
}

const candidates = new Map();
let pageFailures = 0;
await pooled([...families.values()], 4, async (family) => {
  const familyProducts = family.products;
  const sourceIds = [family.id, ...familyProducts.map((product) => Number(product.id))].filter((id) => Number.isSafeInteger(id));
  const familySkus = familyProducts.map((product) => normalizeSku(product.sku));
  const parentSlug = String(family.parent?.slug || "");
  const pageUrl = safeAbsoluteUrl(family.parent?.permalink || familyProducts[0]?.permalink, `https://${SOURCE_HOST}/`);
  let html = "";
  if (pageUrl) {
    try {
      html = await (await fetchSource(pageUrl, "text/html,*/*;q=0.8")).text();
    } catch (error) {
      pageFailures += 1;
      if (pageFailures <= 8) console.warn(`[Cleaver sections] product page ${pageUrl}: ${error.message}`);
    }
  }

  const page$ = cheerio.load(html || "");
  const restRecords = publicSectionRecords.filter((record) => recordMatchesFamily(record, family.id, sourceIds, familySkus, parentSlug));
  const restByLabel = new Map();
  for (const record of restRecords) {
    const label = sectionLabelFromRecord(record);
    const sectionHtml = sectionHtmlFromRecord(record);
    if (label && sectionHtml && (!restByLabel.has(label) || sectionHtml.length > restByLabel.get(label).length)) restByLabel.set(label, sectionHtml);
  }

  const roots = new Map();
  for (const label of SECTION_LABELS) {
    const pageRoot = html ? findSectionRoot(page$, label) : null;
    if (pageRoot?.length) roots.set(label, { root: pageRoot, url: pageUrl });
    else if (restByLabel.has(label)) {
      const rest$ = cheerio.load(restByLabel.get(label));
      roots.set(label, { root: rest$("body"), url: pageUrl || `https://${SOURCE_HOST}/` });
    }
  }

  const overviewSource = roots.get("Overview");
  const overviewHtml = overviewSource ? sanitizeOverview(overviewSource.root, "Overview") : "";
  const included = roots.get("What's Included") ? includedItems(roots.get("What's Included").root, roots.get("What's Included").url) : [];
  const docs = roots.get("Documents") ? documents(roots.get("Documents").root, roots.get("Documents").url) : [];
  const accessories = roots.get("Accessories") ? accessoryItems(roots.get("Accessories").root, roots.get("Accessories").url) : [];
  const variations = variationRows(roots.get("All Variations")?.root || null, familyProducts);
  const videos = videoItems([html, ...restRecords.map(sectionHtmlFromRecord)].join("\n"), pageUrl || `https://${SOURCE_HOST}/`);

  for (const product of familyProducts) {
    const sku = normalizeSku(product.sku);
    const specs = roots.get("Specifications") ? specificationRows(roots.get("Specifications").root, sku) : [];
    const fallbackHtml = String(family.parent?.description || family.parent?.short_description || product.description || product.short_description || "");
    const finalOverview = overviewHtml || sanitizeOverview(cheerio.load(fallbackHtml)("body"), "Overview");
    candidates.set(sku, {
      sku,
      sourceUrl: pageUrl,
      overviewHtml: finalOverview,
      specRows: specs,
      docs,
      includedItems: included,
      variations,
      accessories,
      videos,
      sectionLabels: [...roots.keys()],
    });
  }
});

const sample = candidates.get(SAMPLE_SKU);
const stats = {
  stage: APPLY ? "apply" : "dry-run",
  reviewedInventory: inventory.length,
  manufacturerSkuMatches: manufacturerProducts.size,
  manufacturerFamilies: families.size,
  publicProductSectionRecords: publicSectionRecords.length,
  pageFailures,
  candidates: candidates.size,
  coverage: {
    overview: [...candidates.values()].filter((row) => row.overviewHtml).length,
    specifications: [...candidates.values()].filter((row) => row.specRows.length).length,
    included: [...candidates.values()].filter((row) => row.includedItems.length).length,
    documents: [...candidates.values()].filter((row) => row.docs.length).length,
    variations: [...candidates.values()].filter((row) => row.variations.length > 1).length,
    accessories: [...candidates.values()].filter((row) => row.accessories.length).length,
    videos: [...candidates.values()].filter((row) => row.videos.length).length,
  },
  sample: sample && {
    sku: sample.sku,
    sectionLabels: sample.sectionLabels,
    overviewCharacters: sample.overviewHtml.length,
    specifications: sample.specRows.length,
    included: sample.includedItems.length,
    documents: sample.docs.length,
    variations: sample.variations.length,
    accessories: sample.accessories.length,
    videos: sample.videos.length,
  },
};
console.log(JSON.stringify(stats));

if (!sample || sample.overviewHtml.length < 180 || sample.specRows.length < 6 || sample.includedItems.length < 2 || sample.docs.length < 2 || sample.variations.length < 10 || sample.accessories.length < 4) {
  throw new Error(`Thistle six-section verification failed for ${SAMPLE_SKU}; refusing to publish incomplete source content.`);
}
if (manufacturerProducts.size < 900 || candidates.size < 900) throw new Error("Manufacturer product coverage is unexpectedly low; refusing to publish a partial Cleaver section migration.");
if (!APPLY) process.exit(0);

const existingProducts = await client.fetch(`*[_type == "product" && migrationKey == $key]{_id,sku,sourceUrl,overviewHtml,specRows,docs}`, { key: MIGRATION_KEY });
const productsBySku = new Map((existingProducts || []).map((product) => [normalizeSku(product.sku), product]));
let published = 0;
let failures = 0;

await pooled([...candidates.values()], 6, async (candidate) => {
  const existing = productsBySku.get(candidate.sku);
  if (!existing) return;
  try {
    const fields = { cleaverSourceSectionsMigratedAt: new Date().toISOString() };
    if (candidate.sourceUrl) fields.sourceUrl = candidate.sourceUrl;
    if (candidate.overviewHtml) fields.overviewHtml = candidate.overviewHtml;
    if (candidate.specRows.length) fields.specRows = candidate.specRows;
    if (candidate.docs.length) fields.docs = candidate.docs;
    if (candidate.includedItems.length) fields.cleaverIncludedItems = candidate.includedItems;
    if (candidate.variations.length) fields.cleaverVariations = candidate.variations;
    if (candidate.accessories.length) fields.cleaverAccessories = candidate.accessories;
    if (candidate.videos.length) fields.cleaverVideos = candidate.videos;
    await client.patch(existing._id).set(fields).commit({ visibility: "async" });
    published += 1;
    if (published <= 6 || published % 50 === 0 || published === candidates.size) console.log(`[Cleaver sections] published ${published}/${candidates.size}: ${candidate.sku}`);
  } catch (error) {
    failures += 1;
    console.warn(`[Cleaver sections] ${candidate.sku}: ${error.message}`);
  }
});

const totals = await client.fetch(`{
  "products": count(*[_type == "product" && migrationKey == $key]),
  "included": count(*[_type == "product" && migrationKey == $key && count(cleaverIncludedItems) > 0]),
  "variations": count(*[_type == "product" && migrationKey == $key && count(cleaverVariations) > 1]),
  "accessories": count(*[_type == "product" && migrationKey == $key && count(cleaverAccessories) > 0]),
  "videos": count(*[_type == "product" && migrationKey == $key && count(cleaverVideos) > 0])
}`, { key: MIGRATION_KEY });
console.log(JSON.stringify({ published, failures, totals }));
if (failures > Math.max(15, candidates.size * 0.08) || totals.included < 50 || totals.variations < 50 || totals.accessories < 50) {
  throw new Error(`Cleaver six-section migration incomplete after publish: ${failures} failures, ${totals.included} included, ${totals.variations} variations, ${totals.accessories} accessories.`);
}
