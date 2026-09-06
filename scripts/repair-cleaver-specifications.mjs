#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");

const MIGRATION_KEY = "cleaver-products-2026-08-24";
const READER = "https://r.jina.ai/";
const VERIFY_ONLY = process.argv.includes("--verify-fixture");
const APPROVED_HOSTS = new Set(["www.thistlescientific.com", "thistlescientific.com"]);
const MULTISUB_URL = "https://www.thistlescientific.com/product/multisub-mini-mini-horizontal-electrophoresis-system/";
const MULTISUB_HEADERS = ["MSMINI10", "MSMINI7", "MSMINIDUO"];
const MULTISUB_ROWS = 8;
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\r/g, "").replace(/\s+/g, " ").trim();
const normalizeSku = (value) => clean(value).normalize("NFKC").toUpperCase();

const sourceMap = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-source-map.json"), "utf8"));

function stripMarkdown(value) {
  return clean(String(value || "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, " "));
}

function splitRow(line) {
  const value = String(line || "").trim();
  if (!value.includes("|")) return [];
  return value.replace(/^\|/, "").replace(/\|$/, "").split("|").map(stripMarkdown);
}

function isDelimiterRow(row) {
  return row.length > 1 && row.every((cell) => /^[-: ]*$/.test(cell));
}

function specificationsBody(markdown) {
  const source = String(markdown || "").replace(/\r/g, "");
  const headings = [...source.matchAll(/^(#{2,6})\s+(.+?)\s*$/gm)].map((match) => ({
    index: match.index,
    end: match.index + match[0].length,
    level: match[1].length,
    title: stripMarkdown(match[2]).replace(/\s*\+\s*$/, "").trim(),
  }));
  const current = headings.find((heading) => /^specifications?$/i.test(heading.title));
  if (!current) return "";
  const boundary = headings.find((heading) => heading.index >= current.end && heading.level <= current.level);
  return source.slice(current.end, boundary?.index ?? source.length).trim();
}

function tableBlocks(body) {
  const blocks = [];
  let current = [];
  const flush = () => {
    if (current.length) blocks.push(current);
    current = [];
  };
  for (const line of String(body || "").split("\n")) {
    if (line.includes("|")) current.push(line);
    else flush();
  }
  flush();
  return blocks
    .map((block) => block.map(splitRow).filter((row) => row.length > 1 && !isDelimiterRow(row)))
    .filter((block) => block.length >= 2);
}

function normalizeHeader(value) {
  return clean(value).replace(/^SKU\s*:?\s*/i, "").trim();
}

function parseSpecificationTable(markdown, familySkus = []) {
  const blocks = tableBlocks(specificationsBody(markdown));
  const skuSet = new Set(familySkus.map(normalizeSku));
  let best = null;

  for (const rows of blocks) {
    for (let headerIndex = 0; headerIndex < Math.min(rows.length, 4); headerIndex += 1) {
      const header = rows[headerIndex];
      const recognizedSkuCount = header.slice(1).filter((cell) => skuSet.has(normalizeSku(cell))).length;
      const first = clean(header[0]);
      const looksLikeHeader = recognizedSkuCount > 0 || /^(?:sku|item|model|catalog(?:ue)?(?: no\.?| number)?|part number)$/i.test(first);
      if (!looksLikeHeader || header.length < 2) continue;

      const headers = header.slice(1).map(normalizeHeader).filter(Boolean);
      if (!headers.length) continue;
      const dataRows = [];
      for (const row of rows.slice(headerIndex + 1)) {
        const label = clean(row[0]).replace(/:\s*$/, "");
        if (!label || /^(?:sku|item|model|catalog(?:ue)?(?: no\.?| number)?|part number)$/i.test(label)) continue;
        const values = headers.map((_, index) => clean(row[index + 1] || ""));
        if (!values.some(Boolean)) continue;
        dataRows.push({ label, values });
      }
      if (!dataRows.length) continue;
      const score = recognizedSkuCount * 1000 + dataRows.length * 10 + headers.length;
      if (!best || score > best.score) best = { score, headers, rows: dataRows };
    }
  }

  if (best) return { headers: best.headers, rows: best.rows };

  // Plain two-column specification tables have no SKU header. Preserve every row.
  const twoColumn = blocks
    .filter((rows) => rows.every((row) => row.length === 2))
    .sort((a, b) => b.length - a.length)[0];
  if (!twoColumn?.length) return null;
  const rows = twoColumn
    .map((row) => ({ label: clean(row[0]).replace(/:\s*$/, ""), value: clean(row[1]) }))
    .filter((row) => row.label && row.value && !/^(?:specification|value|sku)$/i.test(row.label));
  return rows.length ? { rows } : null;
}

function specRowsForSku(parsed, sku) {
  if (!parsed) return [];
  if (!parsed.headers) {
    return parsed.rows.map((row) => ({ _key: hash(`${sku}:${row.label}`).slice(0, 12), label: row.label, value: row.value }));
  }
  const column = parsed.headers.findIndex((header) => normalizeSku(header) === normalizeSku(sku));
  if (column < 0) return [];
  return parsed.rows
    .map((row) => ({ _key: hash(`${sku}:${row.label}`).slice(0, 12), label: row.label, value: clean(row.values[column] || "") }))
    .filter((row) => row.value);
}

async function readSource(sourceUrl) {
  const parsed = new URL(sourceUrl);
  if (!APPROVED_HOSTS.has(parsed.hostname)) throw new Error(`Unapproved source host: ${parsed.hostname}`);
  let lastStatus = 0;
  let lastLength = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(`${READER}${sourceUrl}`, {
        headers: { Accept: "text/plain,text/markdown;q=0.9,*/*;q=0.8", "User-Agent": "ITS-BIO-CleaverSpecifications/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(60_000),
      });
      const text = await response.text();
      lastStatus = response.status;
      lastLength = text.length;
      if (response.ok && text.length > 250) return text;
      if (![429, 500, 502, 503, 504].includes(response.status)) break;
    } catch {
      // retry transient failures
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(20_000, 1400 * (2 ** attempt))));
  }
  throw new Error(`reader unavailable status=${lastStatus} bytes=${lastLength}`);
}

async function pooled(items, limit, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  }));
}

async function verifyFixture() {
  const markdown = await readSource(MULTISUB_URL);
  const parsed = parseSpecificationTable(markdown, MULTISUB_HEADERS);
  if (!parsed?.headers || parsed.rows.length !== MULTISUB_ROWS) throw new Error(`multiSUB specification fixture rows mismatch: ${JSON.stringify(parsed)}`);
  const actualHeaders = parsed.headers.map(normalizeSku);
  if (actualHeaders.length !== MULTISUB_HEADERS.length || MULTISUB_HEADERS.some((sku, index) => actualHeaders[index] !== sku)) {
    throw new Error(`multiSUB specification fixture headers mismatch: ${JSON.stringify(parsed.headers)}`);
  }
  console.log(JSON.stringify({ fixture: "MSMINI10", headers: parsed.headers, rows: parsed.rows.length }));
}

if (VERIFY_ONLY) {
  await verifyFixture();
  process.exit(0);
}

const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim()).find(Boolean);
if (!token) throw new Error("Cleaver specification repair requires a Production Sanity write token.");

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

const products = await client.fetch(`*[_type == "product" && migrationKey == $key]{_id,sku,sourceUrl}`, { key: MIGRATION_KEY });
const bySku = new Map((products || []).map((product) => [normalizeSku(product.sku), product]));
const families = new Map();
for (const [rawSku, identity] of Object.entries(sourceMap || {})) {
  const sku = normalizeSku(rawSku);
  const product = bySku.get(sku);
  const sourceUrl = String(identity?.sourceUrl || product?.sourceUrl || "").split("?")[0];
  if (!product || !sourceUrl) continue;
  const family = families.get(sourceUrl) || [];
  family.push(product);
  families.set(sourceUrl, family);
}

await verifyFixture();

let familiesRead = 0;
let familiesWithSpecifications = 0;
let matrixFamilies = 0;
let twoColumnFamilies = 0;
let productsPatched = 0;
let matrixProductsPatched = 0;
let patchFailures = 0;
const readerFailures = [];
const samples = [];

await pooled([...families.entries()], 4, async ([sourceUrl, familyProducts]) => {
  try {
    const markdown = await readSource(sourceUrl);
    familiesRead += 1;
    const parsed = parseSpecificationTable(markdown, familyProducts.map((product) => product.sku));
    if (!parsed) return;
    familiesWithSpecifications += 1;
    if (parsed.headers) matrixFamilies += 1;
    else twoColumnFamilies += 1;

    for (const product of familyProducts) {
      const specRows = specRowsForSku(parsed, product.sku);
      const patch = {};
      if (specRows.length) patch.specRows = specRows;
      if (parsed.headers?.length && parsed.rows.length) {
        patch.cleaverSpecificationMatrix = {
          headers: parsed.headers,
          rows: parsed.rows.map((row, index) => ({ _key: hash(`${sourceUrl}:spec:${index}:${row.label}`).slice(0, 12), label: row.label, values: row.values })),
        };
      }
      if (!Object.keys(patch).length) continue;
      try {
        await client.patch(product._id).set(patch).commit({ visibility: "async" });
        productsPatched += 1;
        if (patch.cleaverSpecificationMatrix) matrixProductsPatched += 1;
        if (samples.length < 10) samples.push({ sku: product.sku, headers: parsed.headers || [], rows: parsed.rows.length, skuRows: specRows.length });
      } catch (error) {
        patchFailures += 1;
        console.warn(`[Cleaver specifications] patch ${product.sku}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    readerFailures.push({ sourceUrl, error: error instanceof Error ? error.message : String(error) });
  }
});

const totals = await client.fetch(`{
  "products": count(*[_type == "product" && migrationKey == $key]),
  "specRows": count(*[_type == "product" && migrationKey == $key && count(specRows) > 0]),
  "specMatrices": count(*[_type == "product" && migrationKey == $key && count(cleaverSpecificationMatrix.rows) > 0])
}`, { key: MIGRATION_KEY });

console.log(JSON.stringify({
  sourceFamilies: families.size,
  familiesRead,
  familiesWithSpecifications,
  matrixFamilies,
  twoColumnFamilies,
  productsPatched,
  matrixProductsPatched,
  patchFailures,
  readerFailures: readerFailures.length,
  firstReaderFailures: readerFailures.slice(0, 10),
  samples,
  totals,
}));

if (patchFailures > Math.max(10, productsPatched * 0.03)) throw new Error(`Cleaver specification patch failures too high: ${patchFailures}`);
