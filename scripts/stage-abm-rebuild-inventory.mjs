#!/usr/bin/env node
/**
 * Stage the reviewed ABM rebuild inventory into compact Sanity documents.
 *
 * IMPORTANT:
 * - Writes ONLY _type == "abmRebuildChunk".
 * - Never creates/patches/deletes production `product` or `category` documents.
 * - Product/Service records are chunked to stay well below the Sanity document quota.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "next-sanity";

const argv = process.argv.slice(2);
const readArg = (name, fallback = "") => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

const PRODUCTS_FILE = path.resolve(readArg("--products", ".cache/abm-v5/products.json"));
const SERVICES_FILE = path.resolve(readArg("--services", ".cache/abm-v5/services.json"));
const VERSION = readArg("--version", "2026-08-09-search-v5");
const CHUNK_SIZE = Math.max(10, Math.min(50, Number(readArg("--chunk-size", "25")) || 25));
const DRY = argv.includes("--dry");
const OUT = path.resolve(".cache/abm-rebuild-staging");
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
].map((x) => String(x || "").trim()).find(Boolean) || "";

if (!fs.existsSync(PRODUCTS_FILE)) throw new Error(`Products file not found: ${PRODUCTS_FILE}`);
if (!fs.existsSync(SERVICES_FILE)) throw new Error(`Services file not found: ${SERVICES_FILE}`);
if (!DRY && !token) throw new Error("No Sanity write token available");

const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
const services = JSON.parse(fs.readFileSync(SERVICES_FILE, "utf8"));
if (!Array.isArray(products) || products.length !== 5144) throw new Error(`Expected 5144 Products, got ${products?.length}`);
if (!Array.isArray(services) || services.length !== 251) throw new Error(`Expected 251 Services, got ${services?.length}`);

function normalizeRecord(row, kind) {
  return {
    _key: `${kind}-${String(row.sku || row.url || Math.random()).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 90)}`,
    kind,
    sku: String(row.sku || "").trim(),
    title: String(row.title || "").trim(),
    url: String(row.url || "").trim(),
    unit: String(row.unit || "").trim(),
    searchCategory: String(row.searchCategory || "").trim(),
    filterTitle: String(row.filterTitle || "").trim(),
    filterPath: Array.isArray(row.filterPath) ? row.filterPath.map(String) : [],
    listingFilters: Array.isArray(row.listingFilters)
      ? row.listingFilters.map((x) => ({
          _key: String(x.id || x.title || "filter").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80),
          id: String(x.id || ""),
          title: String(x.title || ""),
          path: Array.isArray(x.path) ? x.path.map(String) : [],
        }))
      : [],
  };
}

function chunks(rows, kind) {
  const out = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const index = Math.floor(i / CHUNK_SIZE);
    out.push({
      _id: `abm-rebuild-${kind}-chunk-${String(index).padStart(4, "0")}`,
      _type: "abmRebuildChunk",
      version: VERSION,
      kind,
      chunkIndex: index,
      chunkSize: Math.min(CHUNK_SIZE, rows.length - i),
      totalRecords: rows.length,
      source: "https://www.abmgood.com/search",
      inventoryGeneratedAt: "2026-08-09T12:12:28.744Z",
      records: rows.slice(i, i + CHUNK_SIZE).map((x) => normalizeRecord(x, kind)),
    });
  }
  return out;
}

const productChunks = chunks(products, "product");
const serviceChunks = chunks(services, "service");
const docs = [...productChunks, ...serviceChunks];
const expectedIds = new Set(docs.map((x) => x._id));

const report = {
  generatedAt: new Date().toISOString(),
  dryRun: DRY,
  version: VERSION,
  chunkSize: CHUNK_SIZE,
  products: products.length,
  services: services.length,
  productChunks: productChunks.length,
  serviceChunks: serviceChunks.length,
  totalStagingDocuments: docs.length,
  productionProductWrites: 0,
  productionCategoryWrites: 0,
};

if (!DRY) {
  const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });
  const existing = await client.fetch(`*[_type=="abmRebuildChunk"]{_id,version,kind,chunkIndex}`);
  const stale = (existing || []).filter((x) => !expectedIds.has(x._id));

  for (let i = 0; i < docs.length; i += 40) {
    let tx = client.transaction();
    for (const doc of docs.slice(i, i + 40)) tx = tx.createOrReplace(doc);
    await tx.commit({ autoGenerateArrayKeys: true });
    console.log(`[stage] ${Math.min(i + 40, docs.length)}/${docs.length}`);
  }

  if (stale.length) {
    for (let i = 0; i < stale.length; i += 100) {
      let tx = client.transaction();
      for (const doc of stale.slice(i, i + 100)) tx = tx.delete(doc._id);
      await tx.commit();
    }
  }

  const verification = await client.fetch(`{
    "docs": *[_type=="abmRebuildChunk" && version==$version]{_id,kind,chunkIndex,totalRecords,"count":count(records)},
    "otherVersions": count(*[_type=="abmRebuildChunk" && version!=$version]),
    "productionProducts": count(*[_type=="product" && (brandSlug=="abm" || brand->slug.current=="abm" || brand->themeKey=="abm")])
  }`, { version: VERSION });

  const stagedProductRecords = (verification.docs || []).filter((x) => x.kind === "product").reduce((n, x) => n + Number(x.count || 0), 0);
  const stagedServiceRecords = (verification.docs || []).filter((x) => x.kind === "service").reduce((n, x) => n + Number(x.count || 0), 0);
  Object.assign(report, {
    verifiedStagingDocuments: verification.docs?.length || 0,
    stagedProductRecords,
    stagedServiceRecords,
    otherStagingVersions: verification.otherVersions || 0,
    currentProductionAbmProductsUntouched: verification.productionProducts || 0,
    staleStagingDocsRemoved: stale.length,
  });

  if (stagedProductRecords !== 5144 || stagedServiceRecords !== 251 || verification.docs.length !== docs.length) {
    throw new Error(`Staging verification mismatch: ${JSON.stringify(report)}`);
  }
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(
  path.join(OUT, "report.md"),
  `# ABM rebuild staging\n\n- Version: **${VERSION}**\n- Products staged: **${report.stagedProductRecords ?? report.products}**\n- Services staged: **${report.stagedServiceRecords ?? report.services}**\n- Product chunks: **${report.productChunks}**\n- Service chunks: **${report.serviceChunks}**\n- Total staging documents: **${report.totalStagingDocuments}**\n- Production Product writes: **0**\n- Production Category writes: **0**\n- Current production ABM Products untouched: **${report.currentProductionAbmProductsUntouched ?? "dry run"}**\n`,
);
console.log(JSON.stringify(report, null, 2));
