#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { createClient } from "next-sanity";

const argv = process.argv.slice(2);
const hasArg = (name) => argv.includes(name);
const readArg = (name, fallback) => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : fallback;
};

const APPLY = hasArg("--apply");
const AUDIT_ONLY = hasArg("--audit-only");
const START = Math.max(0, Number.parseInt(readArg("--start", "0"), 10) || 0);
const LIMIT = Math.max(0, Number.parseInt(readArg("--limit", "0"), 10) || 0);
const WORKERS = Math.max(1, Math.min(6, Number.parseInt(readArg("--workers", "3"), 10) || 3));
const CATALOG_FILE = path.resolve(readArg("--catalog", "data/abm-cell-model-catalog.json"));
const DETAIL_DIRECTORY = path.resolve(readArg("--details", "data/abm-cell-details"));
const IMAGE_SOURCE_FILE = path.resolve(readArg("--image-sources", "data/abm-cell-image-sources.json.gz"));
const REPORT_DIRECTORY = path.resolve(readArg("--report-directory", ".cache/abm-cell-sanity-migration"));

const projectId = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const dataset = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const apiVersion = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const token = [
  process.env.SANITY_WRITE_TOKEN,
  process.env.SANITY_API_WRITE_TOKEN,
  process.env.SANITY_API_TOKEN,
  process.env.SANITY_TOKEN,
  process.env.SANITY_AUTH_TOKEN,
].map((value) => String(value || "").trim()).find(Boolean) || "";

if (APPLY && !token) throw new Error("--apply requires a Sanity write token");
if (APPLY && AUDIT_ONLY) throw new Error("--apply and --audit-only cannot be combined");

const client = createClient({
  projectId,
  dataset,
  apiVersion,
  token: token || undefined,
  useCdn: false,
  perspective: "published",
});
const clean = (value) => String(value || "").normalize("NFKC").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const normalized = (value) => clean(value).toLowerCase();
const digest = (value) => createHash("sha256").update(String(value)).digest("hex");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const PRODUCT_ID_PREFIX = "product-abm-celllib-20260820-";
const MIGRATION_KEY = "abm-cell-products-2026-08-20";
const ABM_BRAND_ID = "brand-abm";
const EXPECTED_LEGACY_ABM_PRODUCTS = 1582;

const CATEGORY_BY_MODEL = {
  "Immortalized Cells": {
    id: "category-abm-aa24bc5fa6",
    path: ["cellular-materials", "cell-library-collections", "immortalized-cell-lines"],
    titles: ["Cellular Materials", "Cell Library Collections", "Immortalized Cell Lines"],
  },
  "Tumor Cells": {
    id: "category-abm-939cc0a4b2",
    path: ["cellular-materials", "cell-library-collections", "tumor-cell-lines"],
    titles: ["Cellular Materials", "Cell Library Collections", "Tumor Cell Lines – In Vitro Models for Cutting-Edge Research"],
  },
  "Primary Cells": {
    id: "category-abm-3ed8381c48",
    path: ["cellular-materials", "cell-library-collections", "primary-cells"],
    titles: ["Cellular Materials", "Cell Library Collections", "Primary Cells"],
  },
};

function productId(sku) {
  const normalizedSku = normalized(sku).replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!normalizedSku) throw new Error(`Invalid CELL SKU: ${sku}`);
  return `${PRODUCT_ID_PREFIX}${normalizedSku}`;
}

function productSlug(title, sku) {
  const suffix = normalized(sku).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const base = clean(title).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, Math.max(20, 150 - suffix.length));
  return `${base || "abm-cell"}-${suffix}`.slice(0, 160).replace(/-+$/g, "");
}

function safeOfficialUrl(value, type = "source") {
  const url = new URL(clean(value));
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "abmgood.com" && !hostname.endsWith(".abmgood.com")) {
    throw new Error(`Refusing non-ABM ${type} URL: ${value}`);
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`Unsupported ${type} URL protocol: ${url.protocol}`);
  url.hash = "";
  return url.toString();
}

function escapeHtml(value) {
  return clean(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function keyFor(value, prefix = "item") {
  return `${prefix}-${digest(value).slice(0, 24)}`;
}

async function readLocalData() {
  const [catalog, detailManifest, imagePayload] = await Promise.all([
    readFile(CATALOG_FILE, "utf8").then(JSON.parse),
    readFile(path.join(DETAIL_DIRECTORY, "manifest.json"), "utf8").then(JSON.parse),
    readFile(IMAGE_SOURCE_FILE).then((bytes) => JSON.parse(gunzipSync(bytes).toString("utf8"))),
  ]);
  const products = Array.isArray(catalog.products) ? catalog.products : [];
  if (products.length !== 1629) throw new Error(`Expected 1629 CELL catalog products, found ${products.length}`);
  if (detailManifest.complete !== true || detailManifest.collected !== 1629) throw new Error("CELL detail manifest is incomplete");
  if (imagePayload.expectedProducts !== 1629 || imagePayload.recordsWithImages !== 1627) {
    throw new Error("CELL image source manifest is incomplete");
  }
  if (imagePayload.totalImageReferences !== 2089 || imagePayload.uniqueImageUrls !== 2081) {
    throw new Error("CELL image source manifest counts changed unexpectedly");
  }

  const details = new Map();
  for (const filename of (await readdir(DETAIL_DIRECTORY)).filter((name) => name.endsWith(".json.gz")).sort()) {
    const shard = JSON.parse(gunzipSync(await readFile(path.join(DETAIL_DIRECTORY, filename))).toString("utf8"));
    for (const [sku, detail] of Object.entries(shard)) {
      if (details.has(normalized(sku))) throw new Error(`Duplicate detail SKU: ${sku}`);
      details.set(normalized(sku), detail);
    }
  }
  const images = new Map((imagePayload.records || []).map((record) => [normalized(record.sku), record]));
  if (details.size !== products.length || images.size !== products.length) {
    throw new Error(`Local CELL corpus mismatch: catalog=${products.length}, details=${details.size}, images=${images.size}`);
  }
  for (const product of products) {
    const sku = normalized(product.sku);
    const detail = details.get(sku);
    const imageRecord = images.get(sku);
    if (normalized(detail?.sku) !== sku || normalized(imageRecord?.sku) !== sku) throw new Error(`${product.sku}: local SKU mismatch`);
    if (normalized(imageRecord?.sourceUrl) !== normalized(product.sourceUrl || product.url)) throw new Error(`${product.sku}: image source page mismatch`);
    for (const imageUrl of imageRecord.images || []) safeOfficialUrl(imageUrl, "image");
  }
  return { products, details, images, detailManifest, imagePayload };
}

async function fetchSanityState() {
  return client.fetch(`{
    "brand": *[_type == "brand" && _id == $brandId][0]{_id,title,"slug":slug.current,themeKey},
    "categories": *[_type == "category" && _id in $categoryIds]{_id,title,path,"brandRef":brand._ref},
    "legacyAbmCount": count(*[
      _type == "product"
      && (brand._ref == $brandId || brandSlug == "abm" || brand->slug.current == "abm" || brand->themeKey == "abm")
      && !(migrationKey == $migrationKey)
    ]),
    "legacyProducts": *[_type == "product" && !(migrationKey == $migrationKey)]{_id,sku,"slug":slug.current,sourceUrl},
    "cellProducts": *[_type == "product" && migrationKey == $migrationKey]{
      _id,title,sku,"slug":slug.current,sourceUrl,specsHtml,categoryPath,categoryPathTitles,listingPaths,
      "brandRef":brand._ref,"categoryRef":categoryRef._ref,
      images[]{_key,caption,sourceUrl,"assetRef":asset._ref,"assetUrl":asset->url},imageUrls
    }
  }`, {
    brandId: ABM_BRAND_ID,
    categoryIds: Object.values(CATEGORY_BY_MODEL).map((category) => category.id),
    migrationKey: MIGRATION_KEY,
  });
}

function validateSanityDependencies(state) {
  if (state?.brand?._id !== ABM_BRAND_ID || state?.brand?.themeKey !== "abm") throw new Error("Sanity ABM brand reference is missing or invalid");
  const categories = new Map((state.categories || []).map((category) => [category._id, category]));
  for (const expected of Object.values(CATEGORY_BY_MODEL)) {
    const actual = categories.get(expected.id);
    if (!actual || actual.brandRef !== ABM_BRAND_ID || JSON.stringify(actual.path) !== JSON.stringify(expected.path)) {
      throw new Error(`Sanity CELL category is missing or changed: ${expected.id}`);
    }
  }
  if (state.legacyAbmCount !== EXPECTED_LEGACY_ABM_PRODUCTS) {
    throw new Error(`Refusing migration: expected ${EXPECTED_LEGACY_ABM_PRODUCTS} untouched legacy ABM products, found ${state.legacyAbmCount}`);
  }
}

function assertNoLegacyCollisions(products, state) {
  const sku = new Map();
  const sourceUrl = new Map();
  const slug = new Map();
  const id = new Map();
  for (const product of state.legacyProducts || []) {
    if (product._id) id.set(product._id, product._id);
    if (normalized(product.sku)) sku.set(normalized(product.sku), product._id);
    if (normalized(product.sourceUrl)) sourceUrl.set(normalized(product.sourceUrl), product._id);
    if (normalized(product.slug)) slug.set(normalized(product.slug), product._id);
  }
  const collisions = [];
  for (const product of products) {
    const generatedSlug = productSlug(product.title, product.sku);
    const ids = [...new Set([
      id.get(productId(product.sku)),
      sku.get(normalized(product.sku)),
      sourceUrl.get(normalized(product.sourceUrl || product.url)),
      slug.get(normalized(generatedSlug)),
    ].filter(Boolean))];
    if (ids.length) collisions.push({ sku: product.sku, ids });
  }
  if (collisions.length) throw new Error(`CELL products collide with existing documents: ${JSON.stringify(collisions.slice(0, 20))}`);
}

async function fetchImageBytes(imageUrl) {
  let lastError = new Error(`Unable to fetch ${imageUrl}`);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(imageUrl, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-Cell-Sanity-Migration/1.0)",
          referer: "https://www.abmgood.com/",
        },
      });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!contentType.startsWith("image/")) throw new Error(`Unexpected content type ${contentType || "unknown"}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 128) throw new Error(`Image is unexpectedly small (${bytes.length} bytes)`);
      if (bytes.length > 95_000_000) throw new Error(`Image exceeds the 95 MB upload safety limit (${bytes.length} bytes)`);
      return { bytes, contentType };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < 4) await delay(1200 * (attempt + 1));
    }
  }
  throw lastError;
}

function filenameFor(imageUrl, sku, contentType) {
  let basename = "image";
  try { basename = decodeURIComponent(new URL(imageUrl).pathname.split("/").filter(Boolean).at(-1) || "image"); } catch { /* validated earlier */ }
  basename = basename.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-120) || "image";
  if (!/\.[a-z0-9]{2,8}$/i.test(basename)) {
    const extension = contentType.split("/")[1]?.replace("jpeg", "jpg").replace(/[^a-z0-9]+/g, "") || "img";
    basename = `${basename}.${extension}`;
  }
  return `${clean(sku).replace(/[^A-Za-z0-9._-]+/g, "-")}-${basename}`.slice(-180);
}

async function uploadProductImages(product, imageRecord, existingDocument) {
  const existingBySource = new Map((existingDocument?.images || [])
    .filter((image) => image?.sourceUrl && image?.assetRef && image?.assetUrl)
    .map((image) => [normalized(image.sourceUrl), image]));
  const images = [];
  const imageUrls = [];
  let uploaded = 0;
  let reused = 0;
  for (const rawUrl of imageRecord.images || []) {
    const sourceUrl = safeOfficialUrl(rawUrl, "image");
    const existing = existingBySource.get(normalized(sourceUrl));
    if (existing) {
      images.push({
        _key: existing._key || keyFor(sourceUrl, "image"),
        _type: "image",
        asset: { _type: "reference", _ref: existing.assetRef },
        caption: existing.caption || `${clean(product.title)} — official ABM image`,
        sourceUrl,
      });
      imageUrls.push(existing.assetUrl);
      reused += 1;
      continue;
    }
    const fetched = await fetchImageBytes(sourceUrl);
    const asset = await client.assets.upload("image", fetched.bytes, {
      filename: filenameFor(sourceUrl, product.sku, fetched.contentType),
      source: { id: sourceUrl, name: "Official ABM product page", url: sourceUrl },
    });
    if (!asset?._id || !asset?.url || !String(asset.url).includes("cdn.sanity.io")) {
      throw new Error(`${product.sku}: Sanity did not return a managed image asset`);
    }
    images.push({
      _key: keyFor(sourceUrl, "image"),
      _type: "image",
      asset: { _type: "reference", _ref: asset._id },
      caption: `${clean(product.title)} — official ABM image`,
      sourceUrl,
    });
    imageUrls.push(asset.url);
    uploaded += 1;
  }
  return { images, imageUrls: [...new Set(imageUrls)], uploaded, reused };
}

function buildProductDocument(product, detail, category, index, media) {
  const sourceUrl = safeOfficialUrl(detail.sourceUrl || product.sourceUrl || product.url);
  const description = clean(detail.description);
  const docs = Array.isArray(detail.documents) ? detail.documents.map((document) => ({
    _key: keyFor(document.url || document.title, "doc"),
    _type: "docItem",
    title: clean(document.title || "Document"),
    label: clean(document.section),
    url: safeOfficialUrl(document.url, "document"),
  })) : [];
  return {
    _id: productId(product.sku),
    _type: "product",
    migrationKey: MIGRATION_KEY,
    title: clean(product.title || detail.title),
    isActive: true,
    brand: { _type: "reference", _ref: ABM_BRAND_ID },
    ...(description ? { summary: description } : {}),
    sku: clean(product.sku),
    slug: { _type: "slug", current: productSlug(product.title || detail.title, product.sku) },
    categoryRef: { _type: "reference", _ref: category.id },
    categoryPath: category.path,
    listingPaths: [category.path.join("/")],
    categoryPathTitles: category.titles,
    order: index,
    sourceUrl,
    ...(description ? { extraHtml: `<p>${escapeHtml(description)}</p>` } : {}),
    specsHtml: String(detail.specificationsHtml || ""),
    datasheetHtml: String(detail.datasheetHtml || ""),
    documentsHtml: String(detail.documentsHtml || ""),
    faqsHtml: String(detail.faqsHtml || ""),
    referencesHtml: String(detail.referencesHtml || ""),
    reviewsHtml: String(detail.reviewsHtml || ""),
    imageUrls: media.imageUrls,
    images: media.images,
    docs,
    productType: "simple",
  };
}

async function pool(items, workers, mapper) {
  let cursor = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

async function audit(local) {
  const rows = await client.fetch(`*[_type == "product" && migrationKey == $migrationKey]{
    _id,title,sku,"slug":slug.current,sourceUrl,specsHtml,"brandRef":brand._ref,"categoryRef":categoryRef._ref,
    categoryPath,categoryPathTitles,listingPaths,
    images[]{sourceUrl,"assetRef":asset._ref,"assetUrl":asset->url},imageUrls
  }`, { migrationKey: MIGRATION_KEY });
  const expectedBySku = new Map(local.products.map((product) => [normalized(product.sku), product]));
  const actualBySku = new Map((rows || []).map((product) => [normalized(product.sku), product]));
  const missing = [...expectedBySku.keys()].filter((sku) => !actualBySku.has(sku));
  const extra = [...actualBySku.keys()].filter((sku) => !expectedBySku.has(sku));
  const invalid = [];
  let expectedImageReferences = 0;
  let actualImageReferences = 0;
  for (const product of local.products) {
    const sku = normalized(product.sku);
    const row = actualBySku.get(sku);
    const expectedImages = local.images.get(sku)?.images || [];
    expectedImageReferences += expectedImages.length;
    if (!row) continue;
    actualImageReferences += (row.images || []).length;
    const category = CATEGORY_BY_MODEL[product.modelType];
    const managed = (row.images || []).every((image) => image.assetRef && String(image.assetUrl || "").includes(`cdn.sanity.io/images/${projectId}/${dataset}/`));
    const sources = new Set((row.images || []).map((image) => normalized(image.sourceUrl)));
    const imageCoverage = expectedImages.every((image) => sources.has(normalized(image))) && sources.size === expectedImages.length;
    if (
      row._id !== productId(product.sku)
      || row.brandRef !== ABM_BRAND_ID
      || row.categoryRef !== category?.id
      || normalized(row.sourceUrl) !== normalized(product.sourceUrl || product.url)
      || !clean(row.specsHtml)
      || !managed
      || !imageCoverage
    ) invalid.push(product.sku);
  }
  const legacyAbmCount = await client.fetch(`count(*[
    _type == "product"
    && (brand._ref == $brandId || brandSlug == "abm" || brand->slug.current == "abm" || brand->themeKey == "abm")
    && !(migrationKey == $migrationKey)
  ])`, {
    brandId: ABM_BRAND_ID,
    migrationKey: MIGRATION_KEY,
  });
  const report = {
    generatedAt: new Date().toISOString(),
    expectedProducts: local.products.length,
    actualProducts: rows.length,
    missing,
    extra,
    invalid,
    expectedImageReferences,
    actualImageReferences,
    legacyAbmCount,
    complete: rows.length === local.products.length && !missing.length && !extra.length && !invalid.length
      && expectedImageReferences === actualImageReferences && legacyAbmCount === EXPECTED_LEGACY_ABM_PRODUCTS,
  };
  await mkdir(REPORT_DIRECTORY, { recursive: true });
  await writeFile(path.join(REPORT_DIRECTORY, "audit.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.complete) process.exitCode = 1;
  return report;
}

const local = await readLocalData();
if (AUDIT_ONLY) {
  await audit(local);
} else {
  const state = await fetchSanityState();
  validateSanityDependencies(state);
  assertNoLegacyCollisions(local.products, state);
  const existingById = new Map((state.cellProducts || []).map((product) => [product._id, product]));
  const selected = LIMIT ? local.products.slice(START, START + LIMIT) : local.products.slice(START);
  if (!selected.length) throw new Error(`No CELL products selected for start=${START}, limit=${LIMIT}`);

  const allSlugs = local.products.map((product) => productSlug(product.title, product.sku));
  if (new Set(allSlugs).size !== allSlugs.length) throw new Error("Generated CELL product slugs are not unique");
  let maxDocumentBytes = 0;
  let maxDocumentSku = "";
  for (const product of selected) {
    const sku = normalized(product.sku);
    const detail = local.details.get(sku);
    const category = CATEGORY_BY_MODEL[product.modelType];
    if (!detail || !category) throw new Error(`${product.sku}: incomplete local migration input`);
    const document = buildProductDocument(product, detail, category, local.products.indexOf(product), { images: [], imageUrls: [] });
    const bytes = Buffer.byteLength(JSON.stringify(document));
    if (bytes > maxDocumentBytes) {
      maxDocumentBytes = bytes;
      maxDocumentSku = product.sku;
    }
    if (bytes > 900_000) throw new Error(`${product.sku}: product document exceeds the 900 KB migration safety limit`);
  }

  const plan = {
    generatedAt: new Date().toISOString(),
    apply: APPLY,
    projectId,
    dataset,
    start: START,
    limit: LIMIT || null,
    selected: selected.length,
    expectedTotal: local.products.length,
    existingCellProducts: existingById.size,
    legacyAbmProductsPreserved: state.legacyAbmCount,
    imageRecords: selected.filter((product) => (local.images.get(normalized(product.sku))?.images || []).length > 0).length,
    imageReferences: selected.reduce((total, product) => total + (local.images.get(normalized(product.sku))?.images || []).length, 0),
    maxDocumentBytes,
    maxDocumentSku,
    collisions: 0,
  };
  console.log(JSON.stringify(plan, null, 2));
  await mkdir(REPORT_DIRECTORY, { recursive: true });

  if (!APPLY) {
    await writeFile(path.join(REPORT_DIRECTORY, "dry-run.json"), `${JSON.stringify(plan, null, 2)}\n`);
  } else {
    let completed = 0;
    const results = await pool(selected, WORKERS, async (product) => {
      const sku = normalized(product.sku);
      const detail = local.details.get(sku);
      const imageRecord = local.images.get(sku);
      const category = CATEGORY_BY_MODEL[product.modelType];
      if (!detail || !imageRecord || !category) throw new Error(`${product.sku}: incomplete local migration input`);
      const existing = existingById.get(productId(product.sku));
      if (existing && normalized(existing.sku) !== sku) throw new Error(`${product.sku}: scoped ID is owned by another SKU`);
      const media = await uploadProductImages(product, imageRecord, existing);
      const document = buildProductDocument(product, detail, category, local.products.indexOf(product), media);
      await client.createOrReplace(document, { visibility: "async" });
      completed += 1;
      if (completed % 10 === 0 || completed === selected.length) console.log(`[ABM CELL Sanity] ${completed}/${selected.length}`);
      return { sku: product.sku, id: document._id, images: media.images.length, uploaded: media.uploaded, reused: media.reused };
    });
    const report = {
      ...plan,
      completed: results.length,
      images: results.reduce((total, result) => total + result.images, 0),
      uploaded: results.reduce((total, result) => total + result.uploaded, 0),
      reused: results.reduce((total, result) => total + result.reused, 0),
      results,
    };
    const batchName = `apply-${String(START).padStart(4, "0")}-${String(selected.length).padStart(4, "0")}.json`;
    await writeFile(path.join(REPORT_DIRECTORY, batchName), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
  }
}
