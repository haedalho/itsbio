#!/usr/bin/env node
/**
 * One-product ABM Vector Map backfill.
 *
 * Default is dry-run. `--apply` is required to upload/patch Sanity.
 * Only `records[matched].images` and `verification.hasOfficialImages` may change.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "next-sanity";
import { chromium } from "playwright";
import { isManagedAbmImageUrl } from "./lib/abm-sanity-image-assets.mjs";

const argv = process.argv.slice(2);
const readArg = (name, fallback = "") => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

const SKU = String(readArg("--sku")).trim();
const SOURCE_URL = String(readArg("--source-url")).trim();
const MAP_URL = String(readArg("--map-url")).trim();
const VERSION = String(readArg("--version", "2026-08-09-search-v5")).trim();
const APPLY = argv.includes("--apply");
const OUT = path.resolve(".cache/abm-vector-map-backfill");
fs.mkdirSync(OUT, { recursive: true });

if (!SKU || !SOURCE_URL || !MAP_URL) throw new Error("--sku, --source-url, and --map-url are required");

function officialAbmUrl(value) {
  const url = new URL(value, "https://www.abmgood.com");
  const host = url.hostname.toLowerCase();
  if (host !== "abmgood.com" && !host.endsWith(".abmgood.com")) throw new Error(`Refusing non-ABM URL: ${value}`);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`Unsupported protocol: ${url.protocol}`);
  url.protocol = "https:";
  url.hash = "";
  return url.toString();
}

const sourceUrl = officialAbmUrl(SOURCE_URL);
const mapUrl = officialAbmUrl(MAP_URL);
if (!new URL(mapUrl).pathname.startsWith("/vds/map/cat/")) throw new Error(`Refusing unexpected Vector Map path: ${mapUrl}`);

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

const CHUNK_QUERY = `*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
  && count(records[lower(sku) == lower($sku)]) > 0
][0...2]{ _id, _rev, records }`;

function tokenPresent(html, tokenValue) {
  const escaped = tokenValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?=$|[^A-Za-z0-9])`, "i").test(html);
}

function stableWithoutAllowedImageFields(record) {
  const copy = JSON.parse(JSON.stringify(record));
  delete copy.images;
  if (copy.verification && typeof copy.verification === "object") delete copy.verification.hasOfficialImages;
  return JSON.stringify(copy);
}

async function fetchText(url) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-VectorMap-Backfill/1.0)",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
    },
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return { text: await response.text(), finalUrl: officialAbmUrl(response.url || url) };
}

const chunks = await client.fetch(CHUNK_QUERY, { version: VERSION, sku: SKU });
if (!Array.isArray(chunks) || chunks.length !== 1) throw new Error(`Expected exactly one staged chunk for ${SKU}; found ${Array.isArray(chunks) ? chunks.length : 0}`);
const chunk = chunks[0];
const matches = (chunk.records || []).map((record, index) => ({ record, index })).filter(({ record }) =>
  String(record?.sku || "").trim().toLowerCase() === SKU.toLowerCase(),
);
if (matches.length !== 1) throw new Error(`Expected exactly one ${SKU} record in ${chunk._id}; found ${matches.length}`);
const { record, index } = matches[0];

const storedSource = officialAbmUrl(record.sourceUrl || sourceUrl);
if (new URL(storedSource).pathname !== new URL(sourceUrl).pathname) {
  throw new Error(`${SKU}: stored source URL does not match reviewed source page`);
}

const source = await fetchText(sourceUrl);
if (!tokenPresent(source.text, SKU)) throw new Error(`${SKU}: catalog number not found in reviewed source HTML`);
const expectedMapPath = new URL(mapUrl).pathname;
if (!source.text.includes(expectedMapPath)) throw new Error(`${SKU}: reviewed source HTML does not reference ${expectedMapPath}`);

const existingManaged = Array.isArray(record.images) ? [...new Set(record.images.filter((url) => isManagedAbmImageUrl(url)))] : [];
if (existingManaged.length) throw new Error(`${SKU}: managed images already exist; refusing one-off Vector Map backfill`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 760 }, deviceScaleFactor: 2 });
await page.goto(mapUrl, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);
const svgCount = await page.locator("svg").count();
if (svgCount < 1) throw new Error(`${SKU}: Vector Map rendered without SVG`);

const svgs = page.locator("svg");
let bestIndex = -1;
let bestArea = 0;
for (let i = 0; i < svgCount; i += 1) {
  const box = await svgs.nth(i).boundingBox();
  const area = box ? box.width * box.height : 0;
  if (area > bestArea) { bestArea = area; bestIndex = i; }
}
if (bestIndex < 0 || bestArea < 10000) throw new Error(`${SKU}: no usable Vector Map SVG found`);

const bodyText = await page.locator("body").innerText();
if (!/SV40T\s+tsA58/i.test(bodyText) || !/pLenti-SV40-T-tsA58/i.test(bodyText)) {
  throw new Error(`${SKU}: rendered Vector Map identity check failed`);
}

const screenshotPath = path.join(OUT, `${SKU}-vector-map.png`);
const png = await svgs.nth(bestIndex).screenshot({ path: screenshotPath, animations: "disabled" });
await browser.close();
if (!png?.length || png.length < 10_000) throw new Error(`${SKU}: rendered Vector Map PNG is unexpectedly small`);

const report = {
  generatedAt: new Date().toISOString(),
  apply: APPLY,
  sku: SKU,
  version: VERSION,
  sourceUrl: source.finalUrl,
  mapUrl,
  chunkId: chunk._id,
  svgCount,
  renderedArea: bestArea,
  pngBytes: png.length,
  existingManagedImages: existingManaged,
  uploadedAssetUrl: "",
  changed: false,
};

if (APPLY) {
  const asset = await client.assets.upload("image", png, { filename: `ABM-${SKU}-vector-map.png` });
  if (!isManagedAbmImageUrl(asset?.url)) throw new Error(`${SKU}: Sanity returned an unmanaged image URL`);

  const nextRecord = {
    ...record,
    images: [asset.url],
    verification: { ...(record.verification || {}), hasOfficialImages: true },
  };
  if (stableWithoutAllowedImageFields(record) !== stableWithoutAllowedImageFields(nextRecord)) {
    throw new Error(`${SKU}: non-image staged data would change`);
  }

  const nextRecords = [...chunk.records];
  nextRecords[index] = nextRecord;
  const beforeOthers = JSON.stringify(chunk.records.filter((_, i) => i !== index));
  const afterOthers = JSON.stringify(nextRecords.filter((_, i) => i !== index));
  if (beforeOthers !== afterOthers) throw new Error(`${SKU}: another record in the chunk would change`);

  await client.patch(chunk._id).ifRevisionId(chunk._rev).set({ records: nextRecords }).commit();
  const verified = await client.fetch(`*[_id == $id][0].records[lower(sku) == lower($sku)][0]{sku, images, verification}`, { id: chunk._id, sku: SKU });
  if (!Array.isArray(verified?.images) || verified.images[0] !== asset.url) throw new Error(`${SKU}: post-write verification failed`);

  report.uploadedAssetUrl = asset.url;
  report.changed = true;
  report.verified = verified;
}

fs.writeFileSync(path.join(OUT, `${SKU}-${APPLY ? "apply" : "dry"}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
