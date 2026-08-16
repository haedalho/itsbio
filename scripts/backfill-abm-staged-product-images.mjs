#!/usr/bin/env node
/**
 * Safely backfill managed images for exactly one staged ABM product.
 *
 * Default: read-only dry run.
 * Apply:   pass --apply and a Sanity write token.
 *
 * Safety guarantees:
 * - touches only one existing abmRebuildDetailChunk document
 * - matches exactly one staged product by catalog number
 * - fetches only that record's official abmgood.com source page
 * - uploads only official ABM images to Sanity
 * - preserves every field except record.images and verification.hasOfficialImages
 * - uses the chunk revision as an optimistic concurrency guard
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "next-sanity";

import { parseAbmRebuildDetailV2 } from "../lib/abm/rebuild-parser-v2.mjs";
import {
  createAbmImageRehoster,
  isManagedAbmImageUrl,
} from "./lib/abm-sanity-image-assets.mjs";

const argv = process.argv.slice(2);
const readArg = (name, fallback = "") => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : fallback;
};

const SKU = String(readArg("--sku")).trim();
const VERSION = String(readArg("--version", "2026-08-09-search-v5")).trim();
const SOURCE_OVERRIDE = String(readArg("--source-url")).trim();
const APPLY = argv.includes("--apply");
const OUT = path.resolve(".cache/abm-image-backfill");
fs.mkdirSync(OUT, { recursive: true });

if (!SKU) throw new Error("--sku is required");

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

const client = createClient({
  projectId,
  dataset,
  apiVersion,
  token: token || undefined,
  useCdn: false,
});

const CHUNK_QUERY = `*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
  && count(records[lower(sku) == lower($sku)]) > 0
][0...2]{ _id, _rev, records }`;

function assertOfficialAbmPage(value) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "abmgood.com" && !hostname.endsWith(".abmgood.com")) {
    throw new Error(`Refusing non-ABM source URL: ${value}`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Unsupported source protocol: ${url.protocol}`);
  return url.toString();
}

async function fetchOfficialHtml(sourceUrl) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(sourceUrl, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-ImageBackfill/1.0)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.9",
        },
      });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { html: await response.text(), finalUrl: assertOfficialAbmPage(response.url || sourceUrl) };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw lastError || new Error(`Unable to fetch ${sourceUrl}`);
}

function stableWithoutImageFields(record) {
  const copy = JSON.parse(JSON.stringify(record));
  delete copy.images;
  if (copy.verification && typeof copy.verification === "object") {
    delete copy.verification.hasOfficialImages;
  }
  return JSON.stringify(copy);
}

const chunks = await client.fetch(CHUNK_QUERY, { version: VERSION, sku: SKU });
if (!Array.isArray(chunks) || chunks.length !== 1) {
  throw new Error(`Expected exactly one staged detail chunk for ${SKU}; found ${Array.isArray(chunks) ? chunks.length : 0}`);
}

const chunk = chunks[0];
const matches = (chunk.records || []).map((record, index) => ({ record, index })).filter(({ record }) =>
  String(record?.sku || "").trim().toLowerCase() === SKU.toLowerCase(),
);
if (matches.length !== 1) throw new Error(`Expected exactly one ${SKU} record inside ${chunk._id}; found ${matches.length}`);

const { record, index: recordIndex } = matches[0];
const sourceUrl = assertOfficialAbmPage(SOURCE_OVERRIDE || record.sourceUrl || "");
const fetched = await fetchOfficialHtml(sourceUrl);
const parsed = parseAbmRebuildDetailV2(fetched.html, fetched.finalUrl, {
  kind: "product",
  sku: record.sku,
  title: record.title,
});

const discovered = Array.isArray(parsed?.images) ? [...new Set(parsed.images.filter(Boolean))] : [];
if (!discovered.length) throw new Error(`${SKU}: no product image candidates discovered on the official page`);

const existingManaged = Array.isArray(record.images)
  ? [...new Set(record.images.filter((url) => isManagedAbmImageUrl(url)))]
  : [];

const report = {
  generatedAt: new Date().toISOString(),
  apply: APPLY,
  version: VERSION,
  sku: SKU,
  chunkId: chunk._id,
  sourceUrl: fetched.finalUrl,
  discoveredOfficialImages: discovered,
  existingManagedImages: existingManaged,
  uploadedManagedImages: [],
  finalManagedImages: existingManaged,
  changed: false,
};

if (APPLY) {
  const rehoster = createAbmImageRehoster({ client, dryRun: false, logEvery: 1 });
  const uploaded = await rehoster.rehostUrls(discovered, fetched.finalUrl);
  const managed = [...new Set(uploaded.filter((url) => isManagedAbmImageUrl(url)))];
  if (!managed.length) throw new Error(`${SKU}: official images were found but no managed Sanity image was produced`);

  const finalManaged = [...new Set([...existingManaged, ...managed])];
  const nextRecord = {
    ...record,
    images: finalManaged,
    verification: {
      ...(record.verification || {}),
      hasOfficialImages: true,
    },
  };

  if (stableWithoutImageFields(record) !== stableWithoutImageFields(nextRecord)) {
    throw new Error(`${SKU}: safety assertion failed; a non-image field would change`);
  }

  const nextRecords = [...chunk.records];
  nextRecords[recordIndex] = nextRecord;

  if (JSON.stringify(nextRecords.filter((_, index) => index !== recordIndex)) !== JSON.stringify(chunk.records.filter((_, index) => index !== recordIndex))) {
    throw new Error(`${SKU}: safety assertion failed; another staged record would change`);
  }

  if (JSON.stringify(finalManaged) !== JSON.stringify(existingManaged)) {
    await client.patch(chunk._id).ifRevisionId(chunk._rev).set({ records: nextRecords }).commit();
    report.changed = true;
  }

  report.uploadedManagedImages = managed;
  report.finalManagedImages = finalManaged;
  report.rehostStats = rehoster.stats;
}

const reportPath = path.join(OUT, `${SKU.replace(/[^A-Za-z0-9._-]+/g, "_")}-${APPLY ? "apply" : "dry"}.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
