#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { createClient } from "next-sanity";
import stableCatalog from "../data/abm-stable-cell-catalog.json" with { type: "json" };
import cellModelCatalog from "../data/abm-cell-model-catalog.json" with { type: "json" };

const VERSION = String(process.env.ABM_REBUILD_VERSION || "2026-08-09-search-v5").trim();
const OUT = path.resolve(".cache/abm-stable-cell-completeness");
fs.mkdirSync(OUT, { recursive: true });

const client = createClient({
  projectId: String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim(),
  dataset: String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim(),
  apiVersion: String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim(),
  useCdn: false,
});

const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const lower = (value) => clean(value).toLowerCase();
const htmlText = (value) => value ? clean(cheerio.load(`<div id="x">${String(value)}</div>`)("#x").text()) : "";
const PLACEHOLDER = "This item is in the authoritative ABM inventory";
const OLD_STABLE_PATTERN = /stable|stably|reporter|luciferase|transduced|\bgfp\b|\brfp\b/i;

function contentText(record) {
  if (!record) return "";
  return clean([
    record.title,
    record.description,
    record.storage,
    record.materialCitation,
    htmlText(record.introHtml),
    htmlText(record.specificationsHtml),
    htmlText(record.datasheetHtml),
    htmlText(record.documentsHtml),
    htmlText(record.faqsHtml),
    htmlText(record.referencesHtml),
    htmlText(record.reviewsHtml),
  ].filter(Boolean).join(" "));
}

function managedImage(value) {
  try {
    const url = new URL(String(value || ""));
    return url.hostname === "cdn.sanity.io" && url.pathname.startsWith("/images/9b5twpc8/");
  } catch {
    return false;
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      out[index] = await fn(items[index], index);
    }
  }));
  return out;
}

const index = await client.fetch(`{
  "inventory": *[_type == "abmRebuildChunk" && version == $version && kind == "product"].records[]{sku,title,url,previewImage},
  "detailDocs": *[_type == "abmRebuildDetailChunk" && version == $version && kind == "product"]{_id},
  "legacyStable": *[
    _type == "product"
    && (!defined(isActive) || isActive == true)
    && (brandSlug == "abm" || brand._ref == "brand-abm" || brand->slug.current == "abm")
    && defined(sku)
    && sku match "T*"
    && (title match "*Stable*" || title match "*Reporter*" || title match "*Luciferase*" || title match "*Transduced*")
  ]{sku,title}
}`, { version: VERSION });

const detailDocs = (await mapLimit(index.detailDocs || [], 12, async (item, i) => {
  if (i % 100 === 0) console.log(`[stable-audit] detail chunks ${i}/${index.detailDocs.length}`);
  return client.getDocument(item._id);
})).filter(Boolean);
const details = detailDocs.flatMap((doc) => doc.records || []);

const officialProducts = Array.isArray(stableCatalog?.products) ? stableCatalog.products : [];
const officialBySku = new Map(officialProducts.map((product) => [lower(product.sku), product]).filter(([sku]) => sku));
const officialSkus = new Set(officialBySku.keys());

const inventoryBySku = new Map((index.inventory || []).map((row) => [lower(row.sku), row]).filter(([sku]) => sku));
const detailBySku = new Map();
for (const record of details) {
  const key = lower(record?.key);
  const sku = key.startsWith("product:") ? key.slice("product:".length) : lower(record?.sku);
  if (sku) detailBySku.set(sku, record);
}

const oldHeuristicSkus = new Set();
for (const product of Array.isArray(cellModelCatalog?.products) ? cellModelCatalog.products : []) {
  if (OLD_STABLE_PATTERN.test(clean(product?.title))) oldHeuristicSkus.add(lower(product?.sku));
}
for (const product of index.legacyStable || []) oldHeuristicSkus.add(lower(product?.sku));
oldHeuristicSkus.delete("");

const missingFromOldHeuristic = [...officialSkus].filter((sku) => !oldHeuristicSkus.has(sku));
const falsePositiveOldHeuristic = [...oldHeuristicSkus].filter((sku) => !officialSkus.has(sku));

const defects = {
  missingInventory: [],
  missingDetail: [],
  placeholder: [],
  emptyOrNearEmptyDetail: [],
  noVisibleManagedImage: [],
  missingSpecies: [],
  missingTissue: [],
  missingGeneAndAccession: [],
  missingGrowthProperties: [],
};

const rows = [];
for (const [sku, official] of officialBySku) {
  const inventory = inventoryBySku.get(sku);
  const detail = detailBySku.get(sku);
  const text = contentText(detail);
  const detailImages = Array.isArray(detail?.images) ? detail.images.filter(managedImage) : [];
  const previewManaged = managedImage(inventory?.previewImage);

  if (!inventory) defects.missingInventory.push(sku);
  if (!detail) defects.missingDetail.push(sku);
  if (detail && `${detail.title || ""} ${text}`.includes(PLACEHOLDER)) defects.placeholder.push(sku);
  if (detail && text.length < 50) defects.emptyOrNearEmptyDetail.push(sku);
  if (!previewManaged && detailImages.length === 0) defects.noVisibleManagedImage.push(sku);
  if (!clean(official?.species)) defects.missingSpecies.push(sku);
  if (!clean(official?.tissue)) defects.missingTissue.push(sku);
  if (!clean(official?.geneName) && !clean(official?.accessionNumber)) defects.missingGeneAndAccession.push(sku);
  if (!clean(official?.growthProperties)) defects.missingGrowthProperties.push(sku);

  rows.push({
    sku: official.sku,
    title: official.title,
    sourceUrl: official.sourceUrl,
    inventory: Boolean(inventory),
    detail: Boolean(detail),
    placeholder: Boolean(detail && `${detail.title || ""} ${text}`.includes(PLACEHOLDER)),
    detailTextLength: text.length,
    hasVisibleManagedImage: previewManaged || detailImages.length > 0,
    species: official.species,
    tissue: official.tissue,
    tissueSystem: official.tissueSystem,
    geneName: official.geneName,
    accessionNumber: official.accessionNumber,
    growthProperties: official.growthProperties,
    productType: official.productType,
  });
}

const summary = {
  officialCount: officialSkus.size,
  officialExpectedCount: Number(stableCatalog?.expectedCount || 0),
  previousHeuristicCount: oldHeuristicSkus.size,
  missingFromPreviousStablePage: missingFromOldHeuristic.length,
  falsePositivesOnPreviousStablePage: falsePositiveOldHeuristic.length,
  inventoryPresent: officialSkus.size - defects.missingInventory.length,
  missingInventory: defects.missingInventory.length,
  detailPresent: officialSkus.size - defects.missingDetail.length,
  missingDetail: defects.missingDetail.length,
  placeholder: defects.placeholder.length,
  emptyOrNearEmptyDetail: defects.emptyOrNearEmptyDetail.length,
  noVisibleManagedImage: defects.noVisibleManagedImage.length,
  missingSpecies: defects.missingSpecies.length,
  missingTissue: defects.missingTissue.length,
  missingGeneAndAccession: defects.missingGeneAndAccession.length,
  missingGrowthProperties: defects.missingGrowthProperties.length,
};

const report = {
  generatedAt: new Date().toISOString(),
  version: VERSION,
  source: stableCatalog?.source,
  summary,
  previousHeuristic: {
    missingOfficialSkus: missingFromOldHeuristic,
    falsePositiveSkus: falsePositiveOldHeuristic,
  },
  defects,
  products: rows,
};

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  summary,
  samples: {
    missingFromPreviousStablePage: missingFromOldHeuristic.slice(0, 20),
    falsePositiveOldStablePage: falsePositiveOldHeuristic.slice(0, 20),
    missingDetail: defects.missingDetail.slice(0, 20),
    placeholder: defects.placeholder.slice(0, 20),
    noImage: defects.noVisibleManagedImage.slice(0, 20),
  },
}, null, 2));
