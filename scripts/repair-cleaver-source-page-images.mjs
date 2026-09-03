#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const VERIFY_READER_FIXTURES = process.argv.includes("--verify-reader-fixtures");
const MAP_PATH = path.join(process.cwd(), "data/cleaver-source-map.json");
const INVENTORY_PATH = path.join(process.cwd(), "data/cleaver-product-catalog.json");
const SOURCE_HOST = "www.thistlescientific.com";
const READER_ORIGIN = "https://r.jina.ai/";
const USER_AGENT = "Mozilla/5.0 (compatible; ITS-BIO-CleaverPageImageRepair/1.0; +https://itsbio.co.kr)";

const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const cleanText = (value) => String(value || "").normalize("NFKC").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

function canonicalSourceUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (!/(^|\.)thistlescientific\.com$/i.test(url.hostname)) return "";
    if (!/^https:$/.test(url.protocol)) return "";
    url.search = "";
    url.hash = "";
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}/`;
  } catch {
    return "";
  }
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&#038;/gi, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/gi, "/")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/\\\//g, "/");
}

function canonicalImageUrl(value) {
  try {
    const url = new URL(decodeHtml(String(value || "").trim()));
    if (!/(^|\.)thistlescientific\.com$/i.test(url.hostname)) return "";
    if (!/^https:$/.test(url.protocol)) return "";
    if (!/\/wp-content\/uploads\//i.test(url.pathname)) return "";
    if (/(?:^|[-_/])(?:logo|placeholder|no[-_]?image|woocommerce-placeholder|favicon|icon)(?:[-_.]|$)/i.test(url.pathname)) return "";
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9_]+$)/i, "");
    return url.toString();
  } catch {
    return "";
  }
}

function uniqueImages(values) {
  return Array.from(new Set(values.map(canonicalImageUrl).filter(Boolean)));
}

function extractOfficialProductImages(html) {
  const text = String(html || "");
  const strongest = [];
  const medium = [];
  const fallback = [];

  for (const match of text.matchAll(/\bdata-large_image\s*=\s*["']([^"']+)["']/gi)) strongest.push(match[1]);
  for (const match of text.matchAll(/\bdata-src\s*=\s*["']([^"']*\/wp-content\/uploads\/[^"']+)["']/gi)) medium.push(match[1]);

  const galleryBlocks = text.match(/<div[^>]+woocommerce-product-gallery__image[^>]*>[\s\S]*?<\/div>/gi) || [];
  for (const block of galleryBlocks) {
    for (const match of block.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) strongest.push(match[1]);
    for (const match of block.matchAll(/\bsrc\s*=\s*["']([^"']+)["']/gi)) medium.push(match[1]);
  }

  for (const match of text.matchAll(/<meta[^>]+(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["'][^>]+content\s*=\s*["']([^"']+)["'][^>]*>/gi)) fallback.push(match[1]);
  for (const match of text.matchAll(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["'][^>]*>/gi)) fallback.push(match[1]);

  const productJsonLd = text.match(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of productJsonLd) {
    if (!/"@type"\s*:\s*"Product"/i.test(block) && !/"@type"\s*:\s*\[[^\]]*"Product"/i.test(block)) continue;
    for (const match of block.matchAll(/"image"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+(?:\\.[^"\\]*)?)"/gi)) medium.push(match[1]);
    const imageArrays = block.match(/"image"\s*:\s*\[[\s\S]*?\]/gi) || [];
    for (const array of imageArrays) {
      for (const match of array.matchAll(/"(https?:\\?\/\\?\/[^"\\]+(?:\\.[^"\\]*)?)"/gi)) medium.push(match[1]);
    }
  }

  // Thistle blocks unattended HTML requests intermittently. Its read-only
  // rendered response keeps each product gallery immediately before the H1.
  // Scope markdown recovery to that small pre-title region so navigation and
  // the unrelated "Related products" carousel can never become a product image.
  const productHeading = text.search(/^#\s+.+$/m);
  if (productHeading >= 0) {
    const beforeHeading = text.slice(Math.max(0, productHeading - 12_000), productHeading);
    const lastSectionBoundary = Math.max(
      beforeHeading.lastIndexOf("\n## "),
      beforeHeading.lastIndexOf("\n Products search"),
      beforeHeading.lastIndexOf("\n[Account - Login]"),
    );
    const galleryRegion = beforeHeading.slice(Math.max(0, lastSectionBoundary));
    for (const match of galleryRegion.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+\/wp-content\/uploads\/[^)\s]+)\)/gi)) {
      strongest.push(match[1]);
    }
    for (const match of galleryRegion.matchAll(/\]\((https?:\/\/[^)\s]+\/wp-content\/uploads\/[^)\s]+)\)/gi)) {
      strongest.push(match[1]);
    }
  }

  const primary = uniqueImages(strongest);
  const secondary = uniqueImages(medium);
  const tertiary = uniqueImages(fallback);
  return Array.from(new Set([...primary, ...secondary, ...tertiary]));
}

async function fetchText(url, label, { reader = false } = {}) {
  let lastError = "";
  for (let attempt = 0; attempt < 7; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: reader ? "text/plain,text/markdown;q=0.9,*/*;q=0.8" : "text/html,application/xhtml+xml",
          "Accept-Language": "en-GB,en;q=0.9",
          Referer: `https://${SOURCE_HOST}/`,
          "User-Agent": USER_AGENT,
        },
        redirect: "follow",
        signal: AbortSignal.timeout(60_000),
      });
      if (response.ok) return await response.text();
      lastError = `${label} HTTP ${response.status}`;
      if (![408, 425, 429, 500, 502, 503, 504].includes(response.status)) {
        const error = new Error(lastError);
        error.nonRetryable = true;
        throw error;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (error?.nonRetryable) throw error;
      if (attempt === 6) throw new Error(lastError);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(35_000, 1600 * (2 ** attempt))));
  }
  throw new Error(lastError || `${label} unavailable`);
}

async function fetchProductPage(url, label) {
  try {
    return { text: await fetchText(url, label), transport: "direct" };
  } catch (directError) {
    const directMessage = directError instanceof Error ? directError.message : String(directError);
    try {
      return {
        text: await fetchText(`${READER_ORIGIN}${url}`, `${label} reader`, { reader: true }),
        transport: "reader",
      };
    } catch (readerError) {
      const readerMessage = readerError instanceof Error ? readerError.message : String(readerError);
      throw new Error(`${directMessage}; ${readerMessage}`);
    }
  }
}

async function pooled(items, limit, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
      await new Promise((resolve) => setTimeout(resolve, 450));
    }
  }));
}

if (VERIFY_READER_FIXTURES) {
  const imageFixtureUrl = "https://www.thistlescientific.com/product/multisub-mini-7cm-uv-gel-scoop/";
  const noImageFixtureUrl = "https://www.thistlescientific.com/product/ms15-lid-fitted-with-buffer-recirculation-ports-no-cables/";
  const [imageFixture, noImageFixture] = await Promise.all([
    fetchText(`${READER_ORIGIN}${imageFixtureUrl}`, "image fixture reader", { reader: true }),
    fetchText(`${READER_ORIGIN}${noImageFixtureUrl}`, "no-image fixture reader", { reader: true }),
  ]);
  const imageFixtureImages = extractOfficialProductImages(imageFixture);
  const noImageFixtureImages = extractOfficialProductImages(noImageFixture);
  if (!imageFixtureImages.some((url) => /\/MS7-UVS-1\.WEB_\.jpg$/i.test(url))) {
    throw new Error(`Reader image fixture mismatch: ${JSON.stringify(imageFixtureImages)}`);
  }
  if (noImageFixtureImages.length) {
    throw new Error(`Reader no-image fixture leaked unrelated images: ${JSON.stringify(noImageFixtureImages)}`);
  }
  console.log(JSON.stringify({ imageFixtureUrl, imageFixtureImages, noImageFixtureUrl, noImageFixtureImages }));
  process.exit(0);
}

const inventory = JSON.parse(await readFile(INVENTORY_PATH, "utf8"));
const sourceMap = JSON.parse(await readFile(MAP_PATH, "utf8"));
if (!Array.isArray(inventory) || inventory.length !== 1432) throw new Error(`Expected 1,432 Cleaver SKUs, got ${inventory?.length || 0}.`);

const reviewed = new Set(inventory.map((row) => normalizeSku(row.sku)));
const targets = [];
for (const [rawSku, identity] of Object.entries(sourceMap)) {
  const sku = normalizeSku(rawSku);
  if (!reviewed.has(sku)) continue;
  const images = uniqueImages(Array.isArray(identity?.images) ? identity.images : []);
  if (images.length) continue;
  const sourceUrl = canonicalSourceUrl(identity?.sourceUrl);
  if (!sourceUrl) continue;
  targets.push({ rawSku, sku, title: cleanText(identity?.sourceTitle), sourceUrl });
}

const byUrl = new Map();
for (const target of targets) {
  const list = byUrl.get(target.sourceUrl) || [];
  list.push(target);
  byUrl.set(target.sourceUrl, list);
}

const sourceUrls = [...byUrl.keys()];
const pageImages = new Map();
const pageFailures = [];
const officialPageNoImage = [];
const transportCounts = { direct: 0, reader: 0 };

await pooled(sourceUrls, 2, async (sourceUrl, index) => {
  try {
    const page = await fetchProductPage(sourceUrl, `product page ${index + 1}`);
    transportCounts[page.transport] += 1;
    const images = extractOfficialProductImages(page.text);
    pageImages.set(sourceUrl, images);
    if (!images.length) officialPageNoImage.push(sourceUrl);
  } catch (error) {
    pageFailures.push({ sourceUrl, error: error instanceof Error ? error.message : String(error) });
  }
});

let productsRecovered = 0;
const recoveredSamples = [];
for (const target of targets) {
  const images = pageImages.get(target.sourceUrl) || [];
  if (!images.length) continue;
  sourceMap[target.rawSku].images = images;
  productsRecovered += 1;
  if (recoveredSamples.length < 30) {
    recoveredSamples.push({ sku: target.sku, title: target.title, sourceUrl: target.sourceUrl, primary: images[0], imageCount: images.length });
  }
}

const unresolved = [];
for (const [rawSku, identity] of Object.entries(sourceMap)) {
  const sku = normalizeSku(rawSku);
  if (!reviewed.has(sku)) continue;
  const images = uniqueImages(Array.isArray(identity?.images) ? identity.images : []);
  if (images.length) continue;
  unresolved.push({ sku, title: cleanText(identity?.sourceTitle), sourceUrl: canonicalSourceUrl(identity?.sourceUrl) || null });
}

const finalWithImages = Object.values(sourceMap).filter((identity) => uniqueImages(Array.isArray(identity?.images) ? identity.images : []).length).length;
const stats = {
  stage: WRITE ? "write" : "audit",
  inventory: inventory.length,
  targetsBefore: targets.length,
  sourcePagesChecked: sourceUrls.length,
  pagesRead: pageImages.size,
  pagesWithImages: [...pageImages.values()].filter((images) => images.length).length,
  transportCounts,
  productsRecovered,
  officialPageNoImage: officialPageNoImage.length,
  pageFailures: pageFailures.length,
  finalWithImages,
  unresolvedAfter: unresolved.length,
  recoveredSamples,
  firstOfficialNoImage: officialPageNoImage.slice(0, 20),
  firstFailures: pageFailures.slice(0, 20),
  firstUnresolved: unresolved.slice(0, 40),
};
console.log(JSON.stringify(stats, null, 2));

if (pageFailures.length > Math.max(5, Math.ceil(sourceUrls.length * 0.08))) {
  throw new Error(`Too many official product-page fetch failures: ${JSON.stringify({ sourcePages: sourceUrls.length, pageFailures: pageFailures.length })}`);
}

if (WRITE) {
  await writeFile(MAP_PATH, `${JSON.stringify(sourceMap, null, 2)}\n`, "utf8");
  console.log(`[Cleaver source-page image repair] recovered ${productsRecovered} products; ${unresolved.length} remain without an official product image.`);
}
