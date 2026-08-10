#!/usr/bin/env node
/** Stage reviewed ABM Service landing pages only. */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "next-sanity";
import { createAbmImageRehoster, isManagedAbmImageUrl } from "./lib/abm-sanity-image-assets.mjs";

const argv = process.argv.slice(2);
const readArg = (name, fallback = "") => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : fallback;
};
const INPUT = path.resolve(readArg("--input", ".cache/abm-service-landings/landings.json"));
const VERSION = readArg("--version", "2026-08-09-search-v5");
const MAX_BYTES = Math.max(100_000, Math.min(900_000, Number(readArg("--max-bytes", "700000")) || 700_000));
const DRY = argv.includes("--dry");
const REPLACE = argv.includes("--replace");
const OUT = path.resolve(".cache/abm-service-landing-staging");
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

if (!fs.existsSync(INPUT)) throw new Error(`Service landing input not found: ${INPUT}`);
if (!DRY && !token) throw new Error("No Sanity write token available");
const rows = JSON.parse(fs.readFileSync(INPUT, "utf8"));
if (!Array.isArray(rows) || rows.length < 20) throw new Error(`Expected the complete Service landing tree, got ${rows?.length || 0}`);
const client = !DRY ? createClient({ projectId, dataset, apiVersion, token, useCdn: false }) : null;
const imageRehoster = createAbmImageRehoster({ client, dryRun: DRY });

const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const safeUrl = (value) => {
  try {
    const url = new URL(clean(value));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
};
const hasCommerce = (value) => /(?:\$\s*\d|\b(?:USD|CAD)\s+\d)|(?:add\s+to\s+cart|>\s*quantity\s*<)|"(?:price|cost|amount|currency|cart|quantity)"\s*:/i.test(String(value || ""));

const records = [];
for (let index = 0; index < rows.length; index++) {
  const row = rows[index];
  const pathValue = Array.isArray(row.path) ? row.path.map(clean).filter(Boolean) : [];
  const pathKey = pathValue.join("/");
  const sourceUrl = safeUrl(row.sourceUrl);
  const html = await imageRehoster.rewriteHtml(String(row.html || "").trim(), sourceUrl);
  const images = await imageRehoster.rehostUrls(Array.isArray(row.images) ? [...new Set(row.images.map(safeUrl).filter(Boolean))] : [], sourceUrl);
  const children = await Promise.all(Array.isArray(row.children) ? row.children.map(async (child, childIndex) => {
    const childSourceUrl = safeUrl(child.sourceUrl);
    const childImage = safeUrl(child.image);
    return {
      _key: `child-${childIndex}-${clean(child.title).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 60)}`,
      title: clean(child.title),
      path: Array.isArray(child.path) ? child.path.map(clean).filter(Boolean) : [],
      sourceUrl: childSourceUrl,
      image: childImage ? await imageRehoster.rehostUrl(childImage, childSourceUrl || sourceUrl) : "",
    };
  }) : []);
  const record = {
    _key: `service-landing-${pathKey.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80) || index}`,
    kind: "service",
    pathKey,
    path: pathValue,
    title: clean(row.title),
    sourceUrl,
    html,
    images,
    children,
    collectedAt: clean(row.collectedAt),
  };
  if (!record.pathKey || !record.title || !record.sourceUrl || !record.html) throw new Error(`Invalid Service landing record at index ${index}`);
  if (hasCommerce(JSON.stringify(record))) throw new Error(`${record.pathKey}: commerce data remains in Service landing`);
  if (!DRY && (
    record.images.some((url) => !isManagedAbmImageUrl(url))
    || record.children.some((child) => child.image && !isManagedAbmImageUrl(child.image))
  )) throw new Error(`${record.pathKey}: unmanaged landing image remains`);
  records.push(record);
}

const chunks = [];
let current = [];
let currentBytes = 0;
for (const record of records) {
  const bytes = Buffer.byteLength(JSON.stringify(record));
  if (bytes > MAX_BYTES) throw new Error(`${record.pathKey}: record exceeds ${MAX_BYTES} bytes`);
  if (current.length && currentBytes + bytes > MAX_BYTES) {
    chunks.push(current);
    current = [];
    currentBytes = 0;
  }
  current.push(record);
  currentBytes += bytes;
}
if (current.length) chunks.push(current);

const docs = chunks.map((chunk, chunkIndex) => ({
  _id: `abm-rebuild-landing-service-chunk-${String(chunkIndex).padStart(4, "0")}`,
  _type: "abmRebuildLandingChunk",
  version: VERSION,
  kind: "service",
  chunkIndex,
  totalRecords: records.length,
  records: chunk,
}));
const expectedIds = new Set(docs.map((doc) => doc._id));
const report = {
  generatedAt: new Date().toISOString(),
  dryRun: DRY,
  version: VERSION,
  serviceLandings: records.length,
  chunks: docs.length,
  productionProductWrites: 0,
  productionCategoryWrites: 0,
  sanityAssetWrites: imageRehoster.stats.uploadedAssets,
  imageMigration: imageRehoster.stats,
};

if (!DRY) {
  let transaction = client.transaction();
  for (const doc of docs) transaction = transaction.createOrReplace(doc);
  await transaction.commit({ autoGenerateArrayKeys: true });
  if (REPLACE) {
    const existing = await client.fetch(`*[_type == "abmRebuildLandingChunk" && version == $version && kind == "service"]._id`, { version: VERSION });
    const stale = existing.filter((id) => !expectedIds.has(id));
    if (stale.length) {
      let cleanup = client.transaction();
      for (const id of stale) cleanup = cleanup.delete(id);
      await cleanup.commit();
    }
    report.staleChunksRemoved = stale.length;
  }
  report.verified = await client.fetch(`{
    "docs": count(*[_type == "abmRebuildLandingChunk" && version == $version && kind == "service"]),
    "records": count(*[_type == "abmRebuildLandingChunk" && version == $version && kind == "service"].records[])
  }`, { version: VERSION });
  if (report.verified.docs !== docs.length || report.verified.records !== records.length) {
    throw new Error(`Service landing staging verification failed: ${JSON.stringify(report)}`);
  }
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
