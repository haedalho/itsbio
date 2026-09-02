#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const SOURCE_HOST = "www.thistlescientific.com";
const USER_AGENT = "Mozilla/5.0 (compatible; ITS-BIO-CleaverImageAudit/1.1; +https://itsbio.co.kr)";
const MAP_PATH = path.join(process.cwd(), "data/cleaver-source-map.json");
const INVENTORY_PATH = path.join(process.cwd(), "data/cleaver-product-catalog.json");

const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const cleanText = (value) => String(value || "").normalize("NFKC").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

function canonicalSourceUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    url.search = "";
    url.hash = "";
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}/`;
  } catch {
    return "";
  }
}

function canonicalImageUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (!/(^|\.)thistlescientific\.com$/i.test(url.hostname)) return "";
    if (!/^https:$/.test(url.protocol)) return "";
    if (/(?:^|[-_/])(?:logo|placeholder|no[-_]?image|woocommerce-placeholder)(?:[-_.]|$)/i.test(url.pathname)) return "";
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9_]+$)/i, "");
    return url.toString();
  } catch {
    return "";
  }
}

function productImages(product) {
  return Array.from(new Set((Array.isArray(product?.images) ? product.images : [])
    .map((image) => canonicalImageUrl(image?.src))
    .filter(Boolean)));
}

function imageFamilyTitle(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\b(?:w\s*\/\s*|with\s+)?pp\s*[-_]?\s*\d+\b/gi, " ")
    .replace(/\b(?:w\s*\/\s*|with\s+)?powerpro\s*[-_]?\s*\d+\b/gi, " ")
    .replace(/\bwith\s+(?:a\s+)?power\s+supply\b/gi, " ")
    .replace(/\bpower\s+supply\s+included\b/gi, " ")
    .replace(/[()[\]{},:+|]/g, " ")
    .replace(/[\s/_-]+/g, " ")
    .trim();
}

// Only a source title that explicitly says w/PPxxx may borrow the exact base
// package SKU image. This prevents generic 500 g / 500 ml products from being
// mistaken for electrophoresis packages simply because their SKU ends in 500.
function explicitPowerPackageBaseSku(sku, title) {
  const match = cleanText(title).match(/\b(?:w\s*\/\s*|with\s+)?PP\s*[-_]?\s*(\d+)\b/i);
  if (!match) return "";
  const power = match[1];
  const normalized = normalizeSku(sku);
  const ppSuffix = `PP${power}`;
  if (normalized.endsWith(ppSuffix)) return normalized.slice(0, -ppSuffix.length).replace(/[-_/]+$/g, "");
  if (normalized.endsWith(power)) return normalized.slice(0, -power.length).replace(/[-_/]+$/g, "");
  return "";
}

async function pooled(items, limit, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  }));
}

async function fetchJson(url, label) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en-GB,en;q=0.9",
          Referer: `https://${SOURCE_HOST}/`,
          "User-Agent": USER_AGENT,
        },
        redirect: "follow",
        signal: AbortSignal.timeout(55_000),
      });
      lastStatus = response.status;
      if (response.ok) return response.json();
      if (![408, 429, 500, 502, 503, 504].includes(response.status)) {
        throw new Error(`${label} HTTP ${response.status}`);
      }
    } catch (error) {
      if (attempt === 5) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(25_000, 1300 * (2 ** attempt))));
  }
  throw new Error(`${label} unavailable HTTP ${lastStatus}`);
}

const inventory = JSON.parse(await readFile(INVENTORY_PATH, "utf8"));
const sourceMap = JSON.parse(await readFile(MAP_PATH, "utf8"));
if (!Array.isArray(inventory) || inventory.length !== 1432) throw new Error(`Expected 1,432 Cleaver SKUs, got ${inventory?.length || 0}.`);

const reviewed = new Set(inventory.map((row) => normalizeSku(row.sku)));
const mappedSkus = Object.keys(sourceMap).map(normalizeSku).filter((sku) => reviewed.has(sku));
if (mappedSkus.length < 1300) throw new Error(`Cleaver source map coverage is unexpectedly low: ${mappedSkus.length}.`);

const productsBySku = new Map();
const skuBatches = Array.from({ length: Math.ceil(mappedSkus.length / 30) }, (_, index) => mappedSkus.slice(index * 30, index * 30 + 30));
const skuFailures = [];
await pooled(skuBatches, 3, async (batch, index) => {
  try {
    const url = new URL(`https://${SOURCE_HOST}/wp-json/wc/store/v1/products`);
    url.searchParams.set("sku", batch.join(","));
    url.searchParams.set("per_page", "100");
    const rows = await fetchJson(url.toString(), `SKU batch ${index + 1}`);
    for (const product of Array.isArray(rows) ? rows : []) {
      const sku = normalizeSku(product?.sku);
      if (sku && reviewed.has(sku)) productsBySku.set(sku, product);
    }
  } catch (error) {
    skuFailures.push({ batch: index + 1, error: error instanceof Error ? error.message : String(error) });
  }
});

const parentIds = [...new Set([...productsBySku.values()]
  .map((product) => Number(product?.parent))
  .filter((id) => Number.isSafeInteger(id) && id > 0))];
const parentsById = new Map();
const parentBatches = Array.from({ length: Math.ceil(parentIds.length / 30) }, (_, index) => parentIds.slice(index * 30, index * 30 + 30));
const parentFailures = [];
await pooled(parentBatches, 3, async (batch, index) => {
  try {
    const url = new URL(`https://${SOURCE_HOST}/wp-json/wc/store/v1/products`);
    url.searchParams.set("include", batch.join(","));
    url.searchParams.set("per_page", "100");
    const rows = await fetchJson(url.toString(), `parent batch ${index + 1}`);
    for (const product of Array.isArray(rows) ? rows : []) {
      const id = Number(product?.id);
      if (Number.isSafeInteger(id) && id > 0) parentsById.set(id, product);
    }
  } catch (error) {
    parentFailures.push({ batch: index + 1, error: error instanceof Error ? error.message : String(error) });
  }
});

if (productsBySku.size < 1200 || skuFailures.length > 5 || parentFailures.length > 5) {
  throw new Error(`Official Thistle image audit coverage failed: ${JSON.stringify({ exactSkuRows: productsBySku.size, skuFailures: skuFailures.length, parentFailures: parentFailures.length })}`);
}

const direct = new Map();
for (const sku of mappedSkus) {
  const product = productsBySku.get(sku);
  if (!product) continue;
  const variationImages = productImages(product);
  const parent = Number(product.parent) > 0 ? parentsById.get(Number(product.parent)) : null;
  const parentImages = productImages(parent);
  const images = Array.from(new Set([...variationImages, ...parentImages]));
  if (!images.length) continue;
  direct.set(sku, {
    images,
    mode: variationImages.length ? "exact-sku" : "official-parent",
    sourceUrl: canonicalSourceUrl(sourceMap[sku]?.sourceUrl || product?.permalink || parent?.permalink),
    familyTitle: imageFamilyTitle(sourceMap[sku]?.sourceTitle || product?.name || parent?.name),
  });
}

function uniqueDonorMap(entries, keySelector) {
  const buckets = new Map();
  for (const [sku, candidate] of entries) {
    const key = keySelector(sku, candidate);
    if (!key) continue;
    const list = buckets.get(key) || [];
    list.push({ sku, ...candidate });
    buckets.set(key, list);
  }
  const result = new Map();
  for (const [key, list] of buckets) {
    const primaryUrls = [...new Set(list.map((item) => item.images?.[0]).filter(Boolean))];
    if (primaryUrls.length !== 1) continue;
    const donor = list.find((item) => item.images?.[0] === primaryUrls[0]);
    if (donor) result.set(key, donor);
  }
  return result;
}

const bySourceUrl = uniqueDonorMap(direct.entries(), (_sku, candidate) => candidate.sourceUrl);
const byFamilyTitle = uniqueDonorMap(direct.entries(), (_sku, candidate) => candidate.familyTitle);

const nextMap = structuredClone(sourceMap);
let alreadyExact = 0;
let primaryChanged = 0;
let recoveredMissing = 0;
let directOfficial = 0;
let inheritedSameSource = 0;
let inheritedPowerPackage = 0;
let inheritedTitleFamily = 0;
let unresolvedNoOfficialImage = 0;
const samples = [];
const targets = new Set(["MINIAGAROSEPACK", "MINIAGAROSEPACK500", "CHOICEAGAROSEPACK", "CHOICEAGAROSEPACK500", "MS10TANK", "SCREENAGAROSEPACK"]);

for (const rawSku of Object.keys(nextMap)) {
  const sku = normalizeSku(rawSku);
  if (!reviewed.has(sku)) continue;
  const identity = nextMap[rawSku];
  const oldImages = Array.from(new Set((Array.isArray(identity?.images) ? identity.images : []).map(canonicalImageUrl).filter(Boolean)));
  const oldPrimary = oldImages[0] || "";
  const product = productsBySku.get(sku);
  const sourceUrl = canonicalSourceUrl(identity?.sourceUrl || product?.permalink);
  const familyTitle = imageFamilyTitle(identity?.sourceTitle || product?.name);

  let candidate = direct.get(sku);
  let mode = candidate?.mode || "";
  if (candidate) directOfficial += 1;

  if (!candidate && sourceUrl) {
    const donor = bySourceUrl.get(sourceUrl);
    if (donor && donor.sku !== sku) {
      candidate = donor;
      mode = "same-official-source-page";
      inheritedSameSource += 1;
    }
  }

  if (!candidate) {
    const baseSku = explicitPowerPackageBaseSku(sku, identity?.sourceTitle || product?.name);
    const donor = baseSku ? direct.get(baseSku) : null;
    if (donor) {
      candidate = donor;
      mode = `explicit-power-package:${baseSku}`;
      inheritedPowerPackage += 1;
    }
  }

  if (!candidate && familyTitle) {
    const donor = byFamilyTitle.get(familyTitle);
    if (donor && donor.sku !== sku) {
      candidate = donor;
      mode = "verified-title-family";
      inheritedTitleFamily += 1;
    }
  }

  const nextImages = candidate?.images || [];
  if (!nextImages.length) {
    identity.images = [];
    unresolvedNoOfficialImage += 1;
  } else {
    identity.images = nextImages;
    const nextPrimary = nextImages[0];
    if (oldPrimary === nextPrimary) alreadyExact += 1;
    else {
      primaryChanged += 1;
      if (!oldPrimary) recoveredMissing += 1;
    }
  }

  if (targets.has(sku)) {
    samples.push({
      sku,
      title: identity?.sourceTitle || "",
      mode: mode || "unresolved",
      oldPrimary: oldPrimary || null,
      newPrimary: identity.images?.[0] || null,
      imageCount: identity.images?.length || 0,
    });
  }
}

const finalWithImages = Object.values(nextMap).filter((identity) => Array.isArray(identity?.images) && identity.images.length).length;
const stats = {
  stage: WRITE ? "write" : "audit",
  inventory: inventory.length,
  sourceMapped: mappedSkus.length,
  exactSkuRows: productsBySku.size,
  parentRows: parentsById.size,
  directOfficial,
  alreadyExact,
  primaryChanged,
  recoveredMissing,
  inheritedSameSource,
  inheritedPowerPackage,
  inheritedTitleFamily,
  unresolvedNoOfficialImage,
  finalWithImages,
  skuFailures: skuFailures.length,
  parentFailures: parentFailures.length,
  samples,
};
console.log(JSON.stringify(stats, null, 2));

const mini500 = samples.find((item) => item.sku === "MINIAGAROSEPACK500");
const choice500 = samples.find((item) => item.sku === "CHOICEAGAROSEPACK500");
if (finalWithImages < 1200 || !mini500?.newPrimary || !choice500?.newPrimary) {
  throw new Error(`Representative-image audit failed mandatory coverage/examples: ${JSON.stringify({ finalWithImages, mini500, choice500 })}`);
}

if (WRITE) {
  await writeFile(MAP_PATH, `${JSON.stringify(nextMap, null, 2)}\n`, "utf8");
  console.log(`[Cleaver representative image audit] wrote ${Object.keys(nextMap).length} source identities.`);
}
