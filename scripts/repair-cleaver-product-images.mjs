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
const MANUFACTURER_BRAND_ID = 1889;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const SOURCE_HOSTS = new Set(["wisertech.it", "www.aloquence.eu", "labmal.com", "www.thistlescientific.com"]);
const IMAGE_HOSTS = new Set(["wisertech.it", "cdn.myshoptet.com", "labmal.com"]);
const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");

const inventory = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-product-catalog.json"), "utf8"));
const reviewedSkus = new Map(inventory.map((row) => [normalizeSku(row.sku), row]));
if (inventory.length !== 1432 || reviewedSkus.size !== 1432) throw new Error("Expected exactly 1,432 reviewed Cleaver product SKUs.");

const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim()).find(Boolean);
if (APPLY && !token) throw new Error("Cleaver image repair requires the existing Production Sanity write token.");

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

async function pooled(items, concurrency, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const position = next;
      next += 1;
      await worker(items[position], position);
    }
  }));
}

async function retry(label, operation, attempts = 5) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = Number(error?.statusCode || error?.response?.statusCode || 0);
      if (attempt === attempts - 1 || (status && ![408, 409, 429].includes(status) && status < 500)) throw error;
      const delay = Math.min(15_000, 650 * (2 ** attempt));
      console.warn(`[Cleaver image repair] retrying ${label} in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function fetchReviewed(rawUrl, accept = "application/json,text/html;q=0.9,*/*;q=0.8") {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !SOURCE_HOSTS.has(url.hostname)) throw new Error(`Unapproved Cleaver image source: ${url.hostname}`);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { headers: { Accept: accept }, redirect: "follow", signal: AbortSignal.timeout(55_000) });
    if ([401, 403].includes(response.status)) throw new Error(`Cleaver source access denied (HTTP ${response.status}): ${url.hostname}`);
    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      const requested = Number.parseInt(response.headers.get("retry-after") || "0", 10) * 1000;
      const delay = Math.min(30_000, Math.max(requested || 0, 1400 * (2 ** attempt)));
      console.warn(`[Cleaver image repair] respecting ${url.hostname} response ${response.status} for ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (!response.ok) throw new Error(`Cleaver source returned HTTP ${response.status}: ${url.hostname}`);
    return response;
  }
  throw new Error(`Cleaver source remained temporarily unavailable: ${url.hostname}`);
}

function normalizeImage(raw) {
  try {
    const url = new URL(String(raw || "").trim());
    if (url.protocol !== "https:" || !IMAGE_HOSTS.has(url.hostname)) return "";
    if (!/\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname)) return "";
    if (/(?:^|[-_/])(?:logo|placeholder|no[-_]?image|woocommerce-placeholder)(?:[-_.]|$)/i.test(url.pathname)) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function imageWidth(image, fallback = 1000) {
  const srcset = String(image?.srcset || "");
  const widths = [...srcset.matchAll(/\s(\d+)w(?:,|$)/g)].map((match) => Number(match[1])).filter(Number.isFinite);
  const configured = Number(image?.width || 0);
  return Math.max(configured, ...widths, fallback);
}

const existing = await client.fetch(`*[_type == "product" && migrationKey == $key]{_id,sku,sourceUrl,"width":images[0].asset->metadata.dimensions.width,"images":images[]{_key,_type,sourceUrl,asset,"width":asset->metadata.dimensions.width,"url":asset->url}}`, { key: MIGRATION_KEY });
if (!Array.isArray(existing) || existing.length !== 1432) throw new Error(`Expected 1,432 published Cleaver products, found ${existing?.length || 0}.`);
const existingBySku = new Map(existing.map((row) => [normalizeSku(row.sku), row]));
const candidates = new Map();

function addCandidate(rawSku, rawImage, source, width, priority, page, gallery = []) {
  const sku = normalizeSku(rawSku);
  const image = normalizeImage(rawImage);
  if (!reviewedSkus.has(sku) || !image) return false;
  const old = candidates.get(sku);
  if (old && (old.width > width || (old.width === width && old.priority >= priority))) return false;
  candidates.set(sku, {
    sku,
    image,
    source,
    width,
    priority,
    page,
    gallery: [...new Set([image, ...gallery.map(normalizeImage)].filter(Boolean))].slice(0, 5),
  });
  return true;
}

const distributorUrl = (page) => `https://wisertech.it/wp-json/wc/store/v1/products?brand=${MANUFACTURER_BRAND_ID}&per_page=100&page=${page}`;
const firstResponse = await fetchReviewed(distributorUrl(1));
const totalPages = Number.parseInt(firstResponse.headers.get("x-wp-totalpages") || "1", 10);
const reportedProducts = Number.parseInt(firstResponse.headers.get("x-wp-total") || "0", 10);
if (totalPages < 10 || totalPages > 30 || reportedProducts < 1200) throw new Error(`Unexpected reviewed manufacturer catalog size: ${reportedProducts} products, ${totalPages} pages.`);

let exactManufacturerMatches = 0;
let manufacturerWithoutPhoto = 0;

function collectManufacturerDistributor(products) {
  for (const product of Array.isArray(products) ? products : []) {
    const sku = normalizeSku(product.sku);
    const isManufacturer = Array.isArray(product.brands) && product.brands.some((brand) => Number(brand.id) === MANUFACTURER_BRAND_ID && /thistle scientific/i.test(String(brand.name || "")));
    if (!reviewedSkus.has(sku) || !isManufacturer) continue;
    exactManufacturerMatches += 1;
    const photos = (Array.isArray(product.images) ? product.images : []).filter((image) => normalizeImage(image.src));
    if (!photos.length) {
      manufacturerWithoutPhoto += 1;
      continue;
    }
    const best = [...photos].sort((a, b) => imageWidth(b) - imageWidth(a))[0];
    addCandidate(sku, best.src, "Wisertech verified Thistle Scientific manufacturer photograph", imageWidth(best), 120, product.permalink || distributorUrl(1), photos.map((image) => image.src));
  }
}

collectManufacturerDistributor(await firstResponse.json());
await pooled(Array.from({ length: totalPages - 1 }, (_, index) => index + 2), 4, async (page) => {
  const response = await fetchReviewed(distributorUrl(page));
  collectManufacturerDistributor(await response.json());
});
console.log(JSON.stringify({ source: "verified Thistle Scientific distributor", catalogProducts: reportedProducts, pages: totalPages, exactManufacturerMatches, manufacturerWithoutPhoto, imageCandidates: candidates.size }));

let additionalAloquence = 0;
await pooled(["https://www.aloquence.eu/znacka/cleaver-scientific/", "https://www.aloquence.eu/znacka/cleaver-scientific/strana-2/"], 2, async (url) => {
  try {
    const $ = cheerio.load(await (await fetchReviewed(url, "text/html,*/*;q=0.8")).text());
    $("[data-micro='product']").each((_, element) => {
      const card = $(element);
      const sku = normalizeSku(card.find("[data-micro='sku']").first().text());
      const title = card.find("[data-micro='name']").first().text();
      const href = card.find("a[data-micro='url']").first().attr("href");
      const picture = card.find("img").first().attr("data-micro-image") || card.find("meta[property='og:image']").attr("content");
      if (!/cleaver scientific/i.test(title) || !href) return;
      const width = Number(new URL(picture || "https://cdn.myshoptet.com/").searchParams.get("x") || 1024);
      if (addCandidate(sku, picture, "Aloquence exact-SKU Cleaver Scientific product photograph", width, 95, new URL(href, url).toString())) additionalAloquence += 1;
    });
  } catch (error) {
    console.warn(`[Cleaver image repair] optional Aloquence catalog: ${error.message}`);
  }
});

const reviewedSpecialCases = [
  { sku: "CSLDNAKIT1", url: "https://labmal.com/product/dna-kit/" },
  { sku: "BB101", url: "https://labmal.com/product/dna-fingerprinting-electrophoresis-education-kit/" },
  { sku: "BB102", url: "https://labmal.com/product/cystic-fibrosis-electrophoresis-education-kit/" },
  { sku: "BB103", url: "https://labmal.com/product/paternity-testing-electrophoresis-education-kit/" },
  { sku: "BB104", url: "https://labmal.com/product/breast-cancer-genetics-electrophoresis-education-kit/" },
];

await pooled(reviewedSpecialCases, 2, async ({ sku, url }) => {
  if (candidates.has(sku) && candidates.get(sku).width >= 1000) return;
  try {
    const $ = cheerio.load(await (await fetchReviewed(url, "text/html,*/*;q=0.8")).text());
    const text = $("body").text().replace(/\s+/g, " ");
    const escapedSku = sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!/cleaver scientific/i.test(text) || !new RegExp(`(?:^|[^A-Z0-9])${escapedSku}(?:[^A-Z0-9]|$)`, "i").test(text)) return;
    const photos = $(".woocommerce-product-gallery__image a[href], .woocommerce-product-gallery a[href]").toArray().map((anchor) => $(anchor).attr("href")).map(normalizeImage).filter(Boolean);
    if (!photos.length) {
      const featured = normalizeImage($("meta[property='og:image']").attr("content"));
      if (featured) photos.push(featured);
    }
    addCandidate(sku, photos[0], "LabMal exact-SKU Cleaver Scientific product photograph", 500, 90, url, photos);
  } catch (error) {
    console.warn(`[Cleaver image repair] optional LabMal ${sku}: ${error.message}`);
  }
});

const officialProducts = [];
const officialBatches = Array.from({ length: Math.ceil(inventory.length / 35) }, (_, index) => inventory.slice(index * 35, index * 35 + 35));
await pooled(officialBatches, 4, async (batch) => {
  const url = new URL("https://www.thistlescientific.com/wp-json/wc/store/v1/products");
  url.searchParams.set("sku", batch.map((row) => row.sku).join(","));
  url.searchParams.set("per_page", "100");
  try {
    const rows = await (await fetchReviewed(url.toString())).json();
    officialProducts.push(...(Array.isArray(rows) ? rows : []));
  } catch (error) {
    console.warn(`[Cleaver image repair] optional manufacturer family verification: ${error.message}`);
  }
});

const officialFamilies = new Map();
for (const product of officialProducts) {
  const sku = normalizeSku(product.sku);
  if (!reviewedSkus.has(sku)) continue;
  const keys = [];
  if (Number(product.parent) > 0) keys.push(`parent:${product.parent}`);
  if (product.images?.[0]?.id) keys.push(`image:${product.images[0].id}`);
  if (product.parent && product.permalink) keys.push(`page:${new URL(product.permalink).pathname}`);
  for (const key of keys) {
    if (!officialFamilies.has(key)) officialFamilies.set(key, []);
    officialFamilies.get(key).push(sku);
  }
}

let confirmedFamilyRecoveries = 0;
for (const members of officialFamilies.values()) {
  const donors = members.flatMap((sku) => {
    const direct = candidates.get(sku);
    const current = existingBySku.get(sku);
    const uploaded = Array.isArray(current?.images) ? [...current.images].filter((image) => image.asset?._ref).sort((a, b) => Number(b.width || 0) - Number(a.width || 0))[0] : undefined;
    return [...(direct ? [{ ...direct, donor: sku }] : []), ...(uploaded && Number(uploaded.width || 0) >= 900 ? [{ sku, donor: sku, width: uploaded.width, image: uploaded.url, assetRef: uploaded.asset._ref, source: "Manufacturer-confirmed Cleaver product family", priority: 60, page: current.sourceUrl, gallery: [] }] : [])];
  }).sort((a, b) => b.width - a.width || b.priority - a.priority);
  if (!donors.length) continue;
  for (const sku of members) {
    const current = existingBySku.get(sku);
    if (!current || Number(current.width || 0) > 0 || candidates.has(sku)) continue;
    const donor = donors[0];
    candidates.set(sku, { ...donor, sku, source: `${donor.source}; officially confirmed shared product family`, priority: 55 });
    confirmedFamilyRecoveries += 1;
  }
}

function shouldRepair(row, candidate) {
  const width = Number(row?.width || 0);
  if (!width) return true;
  if (candidate.width >= 950 && width < 950 && candidate.width > width * 1.15) return true;
  return candidate.width >= 1200 && candidate.width >= width * 1.4 && width < 1800;
}

const repairs = [...candidates.values()].filter((candidate) => {
  const row = existingBySku.get(candidate.sku);
  return row && shouldRepair(row, candidate);
}).sort((a, b) => {
  if (a.sku === "CSLDNAKIT1") return -1;
  if (b.sku === "CSLDNAKIT1") return 1;
  return Number(Number(existingBySku.get(a.sku)?.width || 0) > 0)
    - Number(Number(existingBySku.get(b.sku)?.width || 0) > 0);
});

const missingBefore = existing.filter((row) => !Number(row.width || 0)).length;
const lowBefore = existing.filter((row) => Number(row.width || 0) > 0 && Number(row.width || 0) < 1000).length;
const missingRecoveries = repairs.filter((row) => !Number(existingBySku.get(row.sku)?.width || 0)).length;
const qualityUpgrades = repairs.length - missingRecoveries;
const dna = candidates.get("CSLDNAKIT1");
const lowSample = candidates.get("MS7-LG");

console.log(JSON.stringify({
  stage: APPLY ? "apply" : "dry-run",
  inventory: inventory.length,
  currentPhotographs: inventory.length - missingBefore,
  missingBefore,
  lowResolutionBefore: lowBefore,
  exactManufacturerMatches,
  manufacturerWithoutPhoto,
  additionalAloquence,
  officiallyConfirmedFamilies: officialFamilies.size,
  confirmedFamilyRecoveries,
  missingRecoveries,
  qualityUpgrades,
  totalRepairs: repairs.length,
  expectedProductsWithPhotographs: inventory.length - missingBefore + missingRecoveries,
  samples: [dna, lowSample].filter(Boolean).map((item) => ({ sku: item.sku, currentWidth: Number(existingBySku.get(item.sku)?.width || 0), replacementWidth: item.width, source: item.source, gallery: item.gallery?.length || 0 })),
}));

const initialMigration = missingBefore >= 500;
if (exactManufacturerMatches < 1200 || (initialMigration && (missingRecoveries < 500 || qualityUpgrades < 50)) || !dna || !lowSample || lowSample.width < 950) {
  throw new Error("Reviewed Cleaver image-repair coverage or mandatory example products failed verification.");
}
if (!APPLY) process.exit(0);
if (!repairs.length) {
  console.log("[Cleaver image repair] all reviewed product photographs are already up to date.");
  process.exit(0);
}

const oldAssets = await client.fetch(`*[_type == "sanity.imageAsset" && defined(source.id) && source.name match "*Cleaver*"]{_id,"sourceId":source.id}`);
const assets = new Map((oldAssets || []).map((asset) => [asset.sourceId, Promise.resolve(asset)]));
let published = 0;
let failures = 0;
let uploaded = 0;

async function upload(candidate, imageUrl = candidate.image) {
  if (candidate.assetRef && imageUrl === candidate.image) return { _id: candidate.assetRef };
  const previous = assets.get(imageUrl);
  if (previous) return previous;
  const task = (async () => {
    const response = await fetch(imageUrl, { headers: { Accept: "image/*,*/*;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(45_000) });
    if ([401, 403].includes(response.status)) throw new Error(`Reviewed product image access denied (HTTP ${response.status})`);
    if (!response.ok) throw new Error(`Reviewed product image returned HTTP ${response.status}`);
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/")) throw new Error(`Unsupported reviewed image type: ${contentType}`);
    const declared = Number.parseInt(response.headers.get("content-length") || "0", 10);
    if (declared > MAX_IMAGE_BYTES) throw new Error("Reviewed product image exceeds the configured size limit.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1200 || bytes.length > MAX_IMAGE_BYTES) throw new Error("Reviewed product image has an invalid file size.");
    const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const filename = `cleaver-original-${candidate.sku.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${hash(imageUrl).slice(0, 12)}.${extension}`;
    const asset = await retry(`managed original ${candidate.sku}`, () => client.assets.upload("image", bytes, { filename, contentType, source: { id: imageUrl, name: candidate.source } }));
    uploaded += 1;
    return asset;
  })();
  assets.set(imageUrl, task);
  try {
    return await task;
  } catch (error) {
    assets.delete(imageUrl);
    throw error;
  }
}

await pooled(repairs, 6, async (candidate) => {
  const row = existingBySku.get(candidate.sku);
  if (!row) return;
  try {
    const primaryAsset = await upload(candidate);
    const primary = { _key: hash(`${candidate.sku}:${candidate.image}`).slice(0, 12), _type: "image", asset: { _type: "reference", _ref: primaryAsset._id }, ...(candidate.assetRef ? {} : { sourceUrl: candidate.image }) };
    const preserved = (Array.isArray(row.images) ? row.images : [])
      .filter((image) => image.asset?._ref && image.asset._ref !== primaryAsset._id)
      .map(({ _key, _type, sourceUrl, asset }) => ({ _key, _type: _type || "image", ...(sourceUrl ? { sourceUrl } : {}), asset }));
    const images = [primary, ...preserved];
    if (candidate.sku === "CSLDNAKIT1") {
      for (const imageUrl of candidate.gallery.slice(1, 5)) {
        if (images.length >= 5) break;
        const asset = await upload(candidate, imageUrl);
        if (images.some((image) => image.asset._ref === asset._id)) continue;
        images.push({ _key: hash(`${candidate.sku}:${imageUrl}`).slice(0, 12), _type: "image", asset: { _type: "reference", _ref: asset._id }, sourceUrl: imageUrl });
      }
    }
    await retry(`Cleaver original image ${candidate.sku}`, () => client.patch(row._id).set({ images, imageQualityRepairedAt: new Date().toISOString(), imageQualitySource: candidate.source }).commit({ visibility: "async" }));
    published += 1;
    if (published <= 8 || published % 25 === 0 || published === repairs.length) console.log(`[Cleaver image repair] published ${published}/${repairs.length}: ${candidate.sku}`);
  } catch (error) {
    failures += 1;
    console.warn(`[Cleaver image repair] ${candidate.sku}: ${error.message}`);
  }
});

const final = await client.fetch(`{"total":count(*[_type == "product" && migrationKey == $key]),"photographs":count(*[_type == "product" && migrationKey == $key && defined(images[0].asset)]),"lowResolution":count(*[_type == "product" && migrationKey == $key && images[0].asset->metadata.dimensions.width < 1000]),"dna":*[_type == "product" && migrationKey == $key && sku == "CSLDNAKIT1"][0]{"images":count(images),"width":images[0].asset->metadata.dimensions.width},"loadingGuides":*[_type == "product" && migrationKey == $key && sku == "MS7-LG"][0]{"width":images[0].asset->metadata.dimensions.width}}`, { key: MIGRATION_KEY });
console.log(JSON.stringify({ published, failures, uploadedManagedAssets: uploaded, before: { photographs: inventory.length - missingBefore, lowResolution: lowBefore }, after: final }));
if (final.photographs < 1200 || !final.dna?.images || Number(final.loadingGuides?.width || 0) < 950 || failures > Math.max(15, repairs.length * 0.08)) {
  throw new Error(`Cleaver image repair verification failed: ${final.photographs} products, ${failures} failures.`);
}
