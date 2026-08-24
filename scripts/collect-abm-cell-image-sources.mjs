#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { parseAbmRebuildDetailV2 } from "../lib/abm/rebuild-parser-v2.mjs";

const argv = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : fallback;
};

const INPUT = path.resolve(readArg("--input", "data/abm-cell-model-catalog.json"));
const CACHE_DIRECTORY = path.resolve(readArg("--cache", "/tmp/itsbio-abm-cell-detail-pages"));
const OUTPUT = path.resolve(readArg("--output", "data/abm-cell-image-sources.json.gz"));
const clean = (value) => String(value || "").normalize("NFKC").trim();
const digest = (value) => createHash("sha256").update(String(value)).digest("hex");

function strictOfficialImageUrl(value) {
  const url = new URL(clean(value));
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "abmgood.com" && !hostname.endsWith(".abmgood.com")) {
    throw new Error(`Refusing non-ABM image URL: ${value}`);
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`Unsupported image protocol: ${url.protocol}`);
  url.hash = "";
  return url.toString();
}

const catalog = JSON.parse(await readFile(INPUT, "utf8"));
const products = Array.isArray(catalog.products) ? catalog.products : [];
if (products.length !== 1629) throw new Error(`Expected 1629 CELL products, found ${products.length}`);

const records = [];
const uniqueImages = new Set();
let totalImageReferences = 0;

for (let index = 0; index < products.length; index += 1) {
  const product = products[index];
  const sourceUrl = clean(product.sourceUrl || product.url);
  const cachePath = path.join(CACHE_DIRECTORY, `${digest(sourceUrl)}.html`);
  const html = await readFile(cachePath, "utf8");
  const parsed = parseAbmRebuildDetailV2(html, sourceUrl, {
    kind: "product",
    sku: product.sku,
    title: product.title,
  });
  if (parsed?.verification?.skuMatches !== true) throw new Error(`${product.sku}: cached official page SKU mismatch`);
  const images = [...new Set((parsed.images || []).map(strictOfficialImageUrl))];
  images.forEach((image) => uniqueImages.add(image));
  totalImageReferences += images.length;
  records.push({ sku: clean(product.sku), sourceUrl, images });
  if ((index + 1) % 100 === 0 || index + 1 === products.length) {
    console.log(`[ABM CELL images] ${index + 1}/${products.length}`);
  }
}

const withoutImages = records.filter((record) => !record.images.length).map((record) => record.sku);
const payload = {
  source: "Official ABM product pages cached during the reviewed CELL detail collection",
  generatedAt: new Date().toISOString(),
  expectedProducts: products.length,
  recordsWithImages: records.length - withoutImages.length,
  recordsWithoutImages: withoutImages,
  totalImageReferences,
  uniqueImageUrls: uniqueImages.size,
  records,
};

if (payload.recordsWithImages !== 1627 || withoutImages.length !== 2) {
  throw new Error(`Unexpected CELL image coverage: with=${payload.recordsWithImages}, without=${withoutImages.length}`);
}

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, gzipSync(JSON.stringify(payload), { level: 9 }));
console.log(JSON.stringify({ output: OUTPUT, ...payload, records: undefined }, null, 2));
