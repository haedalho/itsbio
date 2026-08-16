#!/usr/bin/env node
/**
 * Audit/backfill ABM staged products whose detail page currently has no managed media.
 *
 * Safety model:
 * - already-visible media is skipped (inventory preview, staged detail images, or legacy managed image)
 * - only products with an existing staged detail record are eligible
 * - each mutation is delegated to the reviewed one-product backfill tools
 * - those tools may only change record.images and verification.hasOfficialImages
 * - default is audit-only; --apply is required for writes
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "next-sanity";
import { isManagedAbmImageUrl } from "./lib/abm-sanity-image-assets.mjs";

const argv = process.argv.slice(2);
const readArg = (name, fallback = "") => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

const VERSION = String(readArg("--version", "2026-08-09-search-v5")).trim();
const APPLY = argv.includes("--apply");
const ONLY_SKU = String(readArg("--sku", "")).trim().toLowerCase();
const MAX = Math.max(0, Number.parseInt(readArg("--max", "0"), 10) || 0);
const OUT = path.resolve(".cache/abm-missing-media-all");
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
].map((value) => String(value || "").trim()).find(Boolean) || "";
if (APPLY && !token) throw new Error("--apply requires a Sanity write token");

const client = createClient({ projectId, dataset, apiVersion, token: token || undefined, useCdn: false });

const INVENTORY_QUERY = `*[
  _type == "abmRebuildChunk"
  && version == $version
  && kind == "product"
].records[]{ sku, title, url, previewImage }`;

const DETAIL_QUERY = `*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
].records[]{ sku, sourceUrl, images }`;

const LEGACY_QUERY = `*[
  _type == "product"
  && (
    brandSlug == "abm"
    || brand->slug.current == "abm"
    || brand->themeKey == "abm"
  )
]{ sku, imageUrls, variants[]{ sku } }`;

const [inventory, details, legacy] = await Promise.all([
  client.fetch(INVENTORY_QUERY, { version: VERSION }),
  client.fetch(DETAIL_QUERY, { version: VERSION }),
  client.fetch(LEGACY_QUERY),
]);

const normalizeSku = (value) => String(value || "").trim().toLowerCase();
const managed = (value) => isManagedAbmImageUrl(String(value || "").trim());
const hasManagedArray = (values) => Array.isArray(values) && values.some(managed);

const detailBySku = new Map();
for (const row of Array.isArray(details) ? details : []) {
  const sku = normalizeSku(row?.sku);
  if (sku) detailBySku.set(sku, row);
}

const legacyImageSkus = new Set();
for (const product of Array.isArray(legacy) ? legacy : []) {
  if (!hasManagedArray(product?.imageUrls)) continue;
  const candidates = [product?.sku, ...(Array.isArray(product?.variants) ? product.variants.map((variant) => variant?.sku) : [])];
  for (const candidate of candidates) {
    const sku = normalizeSku(candidate);
    if (sku) legacyImageSkus.add(sku);
  }
}

const skipped = {
  previewImage: 0,
  stagedImages: 0,
  legacyImages: 0,
  missingDetail: 0,
  missingSku: 0,
};

const targets = [];
for (const row of Array.isArray(inventory) ? inventory : []) {
  const sku = normalizeSku(row?.sku);
  if (!sku) { skipped.missingSku += 1; continue; }
  if (ONLY_SKU && sku !== ONLY_SKU) continue;
  if (managed(row?.previewImage)) { skipped.previewImage += 1; continue; }
  const detail = detailBySku.get(sku);
  if (!detail) { skipped.missingDetail += 1; continue; }
  if (hasManagedArray(detail?.images)) { skipped.stagedImages += 1; continue; }
  if (legacyImageSkus.has(sku)) { skipped.legacyImages += 1; continue; }

  const sourceUrl = String(detail?.sourceUrl || row?.url || "").trim();
  if (!sourceUrl) continue;
  targets.push({
    sku: String(row.sku || detail.sku || "").trim(),
    title: String(row.title || "").trim(),
    sourceUrl,
  });
}

targets.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: "base" }));
const selected = MAX > 0 ? targets.slice(0, MAX) : targets;

const report = {
  generatedAt: new Date().toISOString(),
  version: VERSION,
  apply: APPLY,
  inventoryCount: Array.isArray(inventory) ? inventory.length : 0,
  detailCount: Array.isArray(details) ? details.length : 0,
  eligibleMissingMediaCount: targets.length,
  selectedCount: selected.length,
  skipped,
  targets: selected,
  results: [],
  summary: { directImage: 0, vectorMap: 0, noOfficialMediaFound: 0, failed: 0 },
};

function officialAbmUrl(value) {
  try {
    const url = new URL(value, "https://www.abmgood.com");
    const host = url.hostname.toLowerCase();
    if (host !== "abmgood.com" && !host.endsWith(".abmgood.com")) return "";
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.protocol = "https:";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

async function fetchOfficialHtml(sourceUrl) {
  const url = officialAbmUrl(sourceUrl);
  if (!url) throw new Error(`Refusing non-ABM source URL: ${sourceUrl}`);
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-MissingMedia/1.0)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.9",
        },
      });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  throw lastError || new Error("Unable to fetch official source");
}

function extractVectorMapPath(html) {
  const value = String(html || "");
  const matches = value.match(/\/vds\/map\/cat\/\d+/gi) || [];
  return matches.length ? matches[0] : "";
}

function runChild(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || "").slice(-6000),
    stderr: String(result.stderr || "").slice(-6000),
  };
}

if (APPLY) {
  for (let i = 0; i < selected.length; i += 1) {
    const target = selected[i];
    const prefix = `[${i + 1}/${selected.length}] ${target.sku}`;
    console.log(`${prefix}: checking official media`);
    const sourceUrl = officialAbmUrl(target.sourceUrl);
    if (!sourceUrl) {
      report.summary.failed += 1;
      report.results.push({ ...target, status: "failed", reason: "invalid official source URL" });
      continue;
    }

    const direct = runChild("scripts/backfill-abm-staged-product-images.mjs", [
      "--sku", target.sku,
      "--source-url", sourceUrl,
      "--version", VERSION,
      "--apply",
    ]);
    if (direct.ok) {
      report.summary.directImage += 1;
      report.results.push({ ...target, status: "direct-image" });
      console.log(`${prefix}: direct image added`);
      continue;
    }

    try {
      const html = await fetchOfficialHtml(sourceUrl);
      const mapPath = extractVectorMapPath(html);
      if (!mapPath) {
        report.summary.noOfficialMediaFound += 1;
        report.results.push({
          ...target,
          status: "no-official-media-found",
          directError: direct.stderr || direct.stdout,
        });
        console.log(`${prefix}: no direct image or Vector Map found`);
        continue;
      }

      const vector = runChild("scripts/backfill-abm-staged-vector-map.mjs", [
        "--sku", target.sku,
        "--source-url", sourceUrl,
        "--map-url", new URL(mapPath, sourceUrl).toString(),
        "--version", VERSION,
        "--apply",
      ]);
      if (vector.ok) {
        report.summary.vectorMap += 1;
        report.results.push({ ...target, status: "vector-map", mapPath });
        console.log(`${prefix}: Vector Map added`);
      } else {
        report.summary.failed += 1;
        report.results.push({
          ...target,
          status: "failed",
          mapPath,
          directError: direct.stderr || direct.stdout,
          vectorError: vector.stderr || vector.stdout,
        });
        console.error(`${prefix}: Vector Map backfill failed`);
      }
    } catch (error) {
      report.summary.failed += 1;
      report.results.push({ ...target, status: "failed", reason: error?.message || String(error) });
      console.error(`${prefix}: ${error?.message || error}`);
    }

    fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  }
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  apply: report.apply,
  inventoryCount: report.inventoryCount,
  detailCount: report.detailCount,
  eligibleMissingMediaCount: report.eligibleMissingMediaCount,
  selectedCount: report.selectedCount,
  skipped: report.skipped,
  summary: report.summary,
  sample: report.targets.slice(0, 20),
}, null, 2));
