#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { createClient } from "next-sanity";
import * as cheerio from "cheerio";

const VERSION = process.argv.includes("--version")
  ? process.argv[process.argv.indexOf("--version") + 1]
  : "2026-08-09-search-v5";
const OUT = path.resolve(".cache/abm-staged-link-audit");
fs.mkdirSync(OUT, { recursive: true });

const projectId = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const dataset = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const apiVersion = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const token = [
  process.env.SANITY_WRITE_TOKEN,
  process.env.SANITY_API_WRITE_TOKEN,
  process.env.SANITY_API_TOKEN,
  process.env.SANITY_TOKEN,
  process.env.SANITY_AUTH_TOKEN,
].map((value) => String(value || "").trim()).find(Boolean) || undefined;

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });
const result = await client.fetch(`{
  "inventoryProducts": *[_type == "abmRebuildChunk" && version == $version && kind == "product"].records[]{sku,url},
  "inventoryServices": *[_type == "abmRebuildChunk" && version == $version && kind == "service"].records[]{sku,url},
  "detailProducts": *[_type == "abmRebuildDetailChunk" && version == $version && kind == "product"].records[]{key,sku,images},
  "detailServices": *[_type == "abmRebuildDetailChunk" && version == $version && kind == "service"].records[]{key,sku,images},
  "serviceLandings": *[_type == "abmRebuildLandingChunk" && version == $version && kind == "service"].records[]{pathKey,images,html,children[]{image}}
}`, { version: VERSION });

const keyForInventory = (kind, row) => `${kind}:${String(row?.sku || row?.url || "").trim().toLowerCase()}`;
const cleanKey = (row) => String(row?.key || "").trim().toLowerCase();
const managed = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.hostname === "cdn.sanity.io" && url.pathname.startsWith("/images/9b5twpc8/");
  } catch { return false; }
};

function compare(kind, inventory, details, expected) {
  const inventoryKeys = inventory.map((row) => keyForInventory(kind, row));
  const detailKeys = details.map(cleanKey);
  const inventorySet = new Set(inventoryKeys);
  const detailSet = new Set(detailKeys);
  const missing = inventoryKeys.filter((key) => !detailSet.has(key));
  const extra = detailKeys.filter((key) => !inventorySet.has(key));
  const duplicates = detailKeys.filter((key, index) => detailKeys.indexOf(key) !== index);
  const unmanagedImages = details.flatMap((row) => (row.images || []).filter((url) => !managed(url)).map((url) => ({ key: row.key, url })));
  return {
    expected,
    inventory: inventory.length,
    details: details.length,
    uniqueInventoryKeys: inventorySet.size,
    uniqueDetailKeys: detailSet.size,
    missing,
    extra,
    duplicates: [...new Set(duplicates)],
    unmanagedImages,
    passed: inventory.length === expected && details.length === expected && inventorySet.size === expected && detailSet.size === expected
      && !missing.length && !extra.length && !duplicates.length && !unmanagedImages.length,
  };
}

const products = compare("product", result.inventoryProducts || [], result.detailProducts || [], 5144);
const services = compare("service", result.inventoryServices || [], result.detailServices || [], 251);
const landings = result.serviceLandings || [];
const landingImageUrls = (row) => {
  const $ = cheerio.load(`<div>${String(row.html || "")}</div>`);
  const htmlImages = $("img[src]").toArray().map((image) => String($(image).attr("src") || "").trim()).filter(Boolean);
  const childImages = (row.children || []).map((child) => String(child?.image || "").trim()).filter(Boolean);
  return [...(row.images || []), ...htmlImages, ...childImages];
};
const unmanagedLandingImages = landings.flatMap((row) => landingImageUrls(row).filter((url) => !managed(url)).map((url) => ({ pathKey: row.pathKey, url })));
const landingKeys = new Set(landings.map((row) => String(row.pathKey || "").trim()).filter(Boolean));
const sampleG094Present = (result.detailProducts || []).some((row) => cleanKey(row) === "product:g094-1mg");

const report = {
  generatedAt: new Date().toISOString(),
  version: VERSION,
  products,
  services,
  serviceLandings: {
    expected: 40,
    records: landings.length,
    uniquePaths: landingKeys.size,
    unmanagedImages: unmanagedLandingImages,
    passed: landings.length === 40 && landingKeys.size === 40 && !unmanagedLandingImages.length,
  },
  sampleG094Present,
  publicRoutesExpected: 5144 + 251,
};
report.passed = products.passed && services.passed && report.serviceLandings.passed && sampleG094Present;

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  passed: report.passed,
  products: { inventory: products.inventory, details: products.details, missing: products.missing.length },
  services: { inventory: services.inventory, details: services.details, missing: services.missing.length },
  serviceLandings: report.serviceLandings.records,
  sampleG094Present,
}, null, 2));
if (!report.passed) throw new Error("ABM staged internal-link coverage audit failed");
