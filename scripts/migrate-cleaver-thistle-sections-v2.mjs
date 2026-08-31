#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");

const APPLY = process.argv.includes("--apply");
const MIGRATION_KEY = "cleaver-products-2026-08-24";
const SAMPLE_SKU = "CSL-MDOCUV254/3651D";
const SOURCE_HOST = "www.thistlescientific.com";
const READER = "https://r.jina.ai/";
const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
const oneLine = (value) => clean(value).replace(/\s+/g, " ");
const keyOf = (value) => oneLine(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");

const inventory = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-product-catalog.json"), "utf8"));
const sourceMap = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-source-map.json"), "utf8"));
if (inventory.length !== 1432 || new Set(inventory.map((row) => normalizeSku(row.sku))).size !== 1432) throw new Error("Expected exactly 1,432 reviewed Cleaver product SKUs.");

const inventoryBySku = new Map(inventory.map((row) => [normalizeSku(row.sku), row]));
const inventoryByTitle = new Map(inventory.map((row) => [keyOf(row.title), row]));
const sourceByUrl = new Map();
for (const [rawSku, identity] of Object.entries(sourceMap)) {
  const sku = normalizeSku(rawSku);
  const sourceUrl = String(identity?.sourceUrl || "").split("?")[0];
  if (!inventoryBySku.has(sku) || !sourceUrl) continue;
  const list = sourceByUrl.get(sourceUrl) || [];
  list.push({ sku, identity, inventory: inventoryBySku.get(sku) });
  sourceByUrl.set(sourceUrl, list);
}

const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim()).find(Boolean);
if (APPLY && !token) throw new Error("Full Cleaver section migration requires the Production Sanity write token.");
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

async function pooled(items, limit, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  }));
}

async function reader(sourceUrl) {
  const url = new URL(sourceUrl);
  if (url.hostname !== SOURCE_HOST && url.hostname !== "thistlescientific.com") throw new Error(`Unapproved source host: ${url.hostname}`);
  const target = `${READER}${sourceUrl}`;
  let last = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(target, {
      headers: { Accept: "text/plain,text/markdown;q=0.9,*/*;q=0.8", "User-Agent": "ITS-BIO-CleaverCatalog/2.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
    });
    last = await response.text();
    if (response.ok && last.length > 250) return last;
    if (![429, 500, 502, 503, 504].includes(response.status)) throw new Error(`reader HTTP ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, 1500 * (2 ** attempt)));
  }
  throw new Error(`reader unavailable (${last.length} bytes)`);
}

function section(markdown, label) {
  const normalized = markdown.replace(/[’]/g, "'");
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = new RegExp(`^#{2,6}\\s+${escaped}\\s*(?:\\+)?\\s*$`, "im").exec(normalized);
  if (!start) return "";
  const from = start.index + start[0].length;
  const tail = normalized.slice(from);
  const next = /^#{2,6}\s+.+$/m.exec(tail);
  return (next ? tail.slice(0, next.index) : tail).trim();
}

function stripMarkdown(value) {
  return oneLine(String(value || "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, " ")
    .replace(/\|/g, " "));
}

function overviewHtml(markdown) {
  const body = section(markdown, "Overview");
  if (stripMarkdown(body).length < 40) return "";
  const paragraphs = body.split(/\n\s*\n/).map(stripMarkdown).filter((row) => row.length > 20 && !/^image:/i.test(row));
  return paragraphs.slice(0, 12).map((row) => `<p>${row.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join("\n");
}

function splitTableRow(line) {
  const value = line.trim();
  if (!value.includes("|")) return [];
  return value.replace(/^\|/, "").replace(/\|$/, "").split("|").map(stripMarkdown);
}

function specificationRows(markdown, requestedSku) {
  const body = section(markdown, "Specifications");
  const lines = body.split("\n").filter((line) => line.includes("|"));
  const matrix = lines.map(splitTableRow).filter((row) => row.length > 1 && !row.every((cell) => /^[-: ]*$/.test(cell)));
  const sku = normalizeSku(requestedSku);
  const rows = [];
  const seen = new Set();
  const add = (label, value) => {
    const name = oneLine(label).replace(/:\s*$/, "");
    const detail = oneLine(value);
    const key = name.toLowerCase();
    if (!name || !detail || seen.has(key) || /^(?:sku|catalog(?:ue)?(?: no\.?| number)?|part number)$/i.test(name)) return;
    if (name.length > 120 || detail.length > 700) return;
    seen.add(key);
    rows.push({ _key: hash(`${sku}:${name}`).slice(0, 12), label: name, value: detail });
  };
  for (let h = 0; h < matrix.length; h += 1) {
    const header = matrix[h];
    const column = header.findIndex((cell) => normalizeSku(cell) === sku);
    if (column > 0) {
      for (const row of matrix.slice(h + 1)) {
        if (row.length <= column) continue;
        add(row[0], row[column]);
      }
      break;
    }
  }
  if (!rows.length) {
    for (const row of matrix) {
      if (row.length === 2) add(row[0], row[1]);
    }
  }
  return rows.slice(0, 40);
}

function documents(markdown) {
  const body = section(markdown, "Documents");
  const out = new Map();
  for (const match of body.matchAll(/\[([^\]]*)\]\((https?:\/\/[^)]+\.pdf(?:\?[^)]*)?)\)/gi)) {
    const url = match[2].replace(/&amp;/g, "&");
    const filename = decodeURIComponent(new URL(url).pathname.split("/").at(-1) || "Product document.pdf").replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
    const title = stripMarkdown(match[1]) || filename;
    out.set(url, { _key: hash(url).slice(0, 12), title: title.slice(0, 180), label: title.slice(0, 180), url });
  }
  if (!out.size) {
    for (const match of body.matchAll(/(https?:\/\/\S+\.pdf(?:\?\S*)?)/gi)) {
      const url = match[1].replace(/[)>.,]+$/, "");
      const title = decodeURIComponent(new URL(url).pathname.split("/").at(-1) || "Product document.pdf").replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
      out.set(url, { _key: hash(url).slice(0, 12), title, label: title, url });
    }
  }
  return [...out.values()].slice(0, 20);
}

function includedItems(markdown) {
  const body = section(markdown, "What's Included");
  const plain = body.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`#|]/g, " ").replace(/\s+/g, " ");
  const items = new Map();
  const add = (title, qty = "") => {
    const name = oneLine(title).replace(/^(?:image:\s*)/i, "").replace(/\s*Qty\s*:.*$/i, "");
    if (name.length < 3 || name.length > 180 || /^(?:what's included|qty|add to basket|view product)$/i.test(name)) return;
    const key = keyOf(name);
    if (!key || items.has(key)) return;
    items.set(key, { _key: hash(`included:${key}`).slice(0, 12), title: name, quantity: String(qty || ""), sourceUrl: "", imageUrl: "" });
  };
  const regex = /(.{3,180}?)\s+Qty\s*:\s*(\d+)/gi;
  for (const match of plain.matchAll(regex)) add(match[1].replace(/^.*?(?=(?:microDOC|multiSUB|omni|Power|Cleaver|[A-Z][A-Za-z0-9]))/, ""), match[2]);
  if (!items.size) {
    body.split("\n").map(stripMarkdown).filter(Boolean).forEach((line) => {
      const match = line.match(/^(.*?)(?:\s+Qty\s*:\s*(\d+))$/i);
      if (match) add(match[1], match[2]);
    });
  }
  return [...items.values()].slice(0, 30);
}

function packText(value) {
  return oneLine(value).match(/\b\d+\s*\/\s*(?:Each|Pack|Box|Case|Kit|Unit|Set|Pair)\b/i)?.[0] || "";
}
function priceText(value) {
  return oneLine(value).match(/£\s*[\d,.]+(?:\s*[–-]\s*£?\s*[\d,.]+)?(?:\s*(?:ex\.?\s*VAT|inc\.?\s*VAT))?/i)?.[0] || "";
}
function internalHref(title) {
  const row = inventoryByTitle.get(keyOf(title));
  if (!row) return "";
  return `/products/cleaver?q=${encodeURIComponent(row.sku)}`;
}

function accessoryItems(markdown) {
  const body = section(markdown, "Accessories");
  const lines = body.split("\n").map(stripMarkdown).filter(Boolean);
  const items = new Map();
  const ignore = /^(?:accessory|pack\/size|price|qty|add to basket|view product|n\/a|\/|image:|£)/i;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (ignore.test(line) || /^\d+\s*\/\s*/i.test(line) || /^\[?input/i.test(line) || line.length < 4 || line.length > 180) continue;
    const context = lines.slice(i, i + 5).join(" ");
    if (!/(?:\/\s*(?:Each|Pack|Box|Case|Kit|Unit|Set|Pair)|£|View Product|Add to Basket)/i.test(context)) continue;
    const name = line.replace(/^Image:\s*/i, "");
    if (/^(?:standard uv transilluminator|dual wavelength uv transilluminator|.*filter.*|.*illuminator.*|.*software.*|.*accessor.*|.*electrode.*|.*tray.*|.*comb.*|.*lid.*|.*cable.*|.*adapter.*|.*stand.*|.*plate.*|.*spacer.*|.*module.*|.*cassette.*|.*holder.*|.*tank.*|.*platform.*|.*guide.*|.*dam.*|.*power.*|.*blot.*|.*system.*)/i.test(name)) {
      const key = keyOf(name);
      if (!items.has(key)) items.set(key, { _key: hash(`accessory:${key}`).slice(0, 12), title: name, packSize: packText(context), priceText: priceText(context), sourceUrl: "", imageUrl: "", internalHref: internalHref(name) });
    }
  }
  for (const match of body.matchAll(/\[([^\]]+)\]\((https?:\/\/(?:www\.)?thistlescientific\.com\/product\/[^)]+)\)/gi)) {
    const title = stripMarkdown(match[1]);
    if (!title || /^view product$/i.test(title)) continue;
    const key = keyOf(title);
    const prior = items.get(key) || {};
    items.set(key, { _key: hash(`accessory:${key}`).slice(0, 12), title: title.slice(0, 180), packSize: prior.packSize || "", priceText: prior.priceText || "", sourceUrl: match[2], imageUrl: "", internalHref: internalHref(title) });
  }
  return [...items.values()].slice(0, 60);
}

function videos(markdown) {
  const out = new Map();
  const add = (url) => {
    let embedUrl = "";
    try {
      const parsed = new URL(url);
      if (/youtube\.com$/i.test(parsed.hostname) || /(^|\.)youtube\.com$/i.test(parsed.hostname)) {
        const id = parsed.pathname.startsWith("/embed/") ? parsed.pathname.split("/embed/")[1]?.split("/")[0] : parsed.searchParams.get("v");
        if (id) embedUrl = `https://www.youtube.com/embed/${id}`;
      } else if (parsed.hostname === "youtu.be") {
        const id = parsed.pathname.split("/").filter(Boolean)[0];
        if (id) embedUrl = `https://www.youtube.com/embed/${id}`;
      } else if (/(^|\.)vimeo\.com$/i.test(parsed.hostname)) {
        const id = parsed.pathname.split("/").filter(Boolean).at(-1);
        if (/^\d+$/.test(id || "")) embedUrl = `https://player.vimeo.com/video/${id}`;
      }
    } catch { return; }
    const key = embedUrl || url;
    if (!out.has(key)) out.set(key, { _key: hash(`video:${key}`).slice(0, 12), title: "Product video", url, embedUrl });
  };
  for (const match of markdown.matchAll(/https?:\/\/[^\s)>]+(?:youtube\.com|youtu\.be|vimeo\.com|\.mp4|\.webm)[^\s)>]*/gi)) add(match[0].replace(/[.,]+$/, ""));
  for (const match of markdown.matchAll(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[A-Za-z0-9_-]+|youtu\.be\/[A-Za-z0-9_-]+|vimeo\.com\/\d+)/gi)) add(match[0]);
  return [...out.values()].slice(0, 8);
}

function variations(family) {
  return family.map(({ sku, identity, inventory: row }) => ({
    _key: hash(`variation:${sku}`).slice(0, 12),
    title: row.title,
    sku: row.sku,
    packSize: "",
    priceText: "",
    imageUrl: String(identity?.images?.[0] || ""),
    internalHref: `/products/cleaver?q=${encodeURIComponent(row.sku)}`,
  })).slice(0, 100);
}

const candidates = new Map();
const failures = [];
let completedFamilies = 0;
await pooled([...sourceByUrl.entries()], 4, async ([sourceUrl, family]) => {
  try {
    const markdown = await reader(sourceUrl);
    const shared = {
      sourceUrl,
      overviewHtml: overviewHtml(markdown),
      docs: documents(markdown),
      includedItems: includedItems(markdown),
      variations: variations(family),
      accessories: accessoryItems(markdown),
      videos: videos(markdown),
    };
    for (const member of family) candidates.set(member.sku, { ...shared, sku: member.sku, specRows: specificationRows(markdown, member.sku) });
  } catch (error) {
    failures.push({ sourceUrl, error: error instanceof Error ? error.message : String(error) });
  }
  completedFamilies += 1;
  if (completedFamilies <= 5 || completedFamilies % 50 === 0 || completedFamilies === sourceByUrl.size) console.log(`[Cleaver reader] families ${completedFamilies}/${sourceByUrl.size}, candidates=${candidates.size}, failures=${failures.length}`);
});

const sample = candidates.get(SAMPLE_SKU);
const coverage = {
  overview: [...candidates.values()].filter((row) => row.overviewHtml).length,
  specifications: [...candidates.values()].filter((row) => row.specRows.length).length,
  included: [...candidates.values()].filter((row) => row.includedItems.length).length,
  documents: [...candidates.values()].filter((row) => row.docs.length).length,
  variations: [...candidates.values()].filter((row) => row.variations.length > 1).length,
  accessories: [...candidates.values()].filter((row) => row.accessories.length).length,
  videos: [...candidates.values()].filter((row) => row.videos.length).length,
};
const stats = {
  stage: APPLY ? "apply" : "dry-run",
  reviewedInventory: inventory.length,
  mappedSkus: Object.keys(sourceMap).length,
  manufacturerFamilies: sourceByUrl.size,
  candidates: candidates.size,
  readerFailures: failures.length,
  coverage,
  sample: sample && { sku: sample.sku, overviewCharacters: sample.overviewHtml.length, specifications: sample.specRows.length, included: sample.includedItems.length, documents: sample.docs.length, variations: sample.variations.length, accessories: sample.accessories.length, videos: sample.videos.length },
  firstFailures: failures.slice(0, 8),
};
console.log(JSON.stringify(stats));
if (!sample || sample.overviewHtml.length < 180 || sample.specRows.length < 6 || sample.includedItems.length < 2 || sample.docs.length < 2 || sample.variations.length < 10 || sample.accessories.length < 4) {
  throw new Error(`Cleaver reader fixture failed: ${JSON.stringify(stats.sample || null)}`);
}
if (candidates.size < 900 || failures.length > Math.max(40, sourceByUrl.size * 0.12)) throw new Error(`Cleaver reader coverage incomplete: ${candidates.size} candidates, ${failures.length} family failures.`);
if (!APPLY) process.exit(0);

const existing = await client.fetch(`*[_type == "product" && migrationKey == $key]{_id,sku}`, { key: MIGRATION_KEY });
const bySku = new Map((existing || []).map((row) => [normalizeSku(row.sku), row]));
let published = 0;
let publishFailures = 0;
await pooled([...candidates.values()], 6, async (candidate) => {
  const target = bySku.get(candidate.sku);
  if (!target) return;
  try {
    const fields = { cleaverSourceSectionsMigratedAt: new Date().toISOString(), sourceUrl: candidate.sourceUrl };
    if (candidate.overviewHtml) fields.overviewHtml = candidate.overviewHtml;
    if (candidate.specRows.length) fields.specRows = candidate.specRows;
    if (candidate.docs.length) fields.docs = candidate.docs;
    if (candidate.includedItems.length) fields.cleaverIncludedItems = candidate.includedItems;
    if (candidate.variations.length) fields.cleaverVariations = candidate.variations;
    if (candidate.accessories.length) fields.cleaverAccessories = candidate.accessories;
    if (candidate.videos.length) fields.cleaverVideos = candidate.videos;
    await client.patch(target._id).set(fields).commit({ visibility: "async" });
    published += 1;
    if (published <= 5 || published % 50 === 0) console.log(`[Cleaver reader] published ${published}/${candidates.size}: ${candidate.sku}`);
  } catch (error) {
    publishFailures += 1;
    console.warn(`[Cleaver reader] publish ${candidate.sku}: ${error instanceof Error ? error.message : String(error)}`);
  }
});
const totals = await client.fetch(`{
  "products": count(*[_type == "product" && migrationKey == $key]),
  "included": count(*[_type == "product" && migrationKey == $key && count(cleaverIncludedItems) > 0]),
  "variations": count(*[_type == "product" && migrationKey == $key && count(cleaverVariations) > 1]),
  "accessories": count(*[_type == "product" && migrationKey == $key && count(cleaverAccessories) > 0]),
  "videos": count(*[_type == "product" && migrationKey == $key && count(cleaverVideos) > 0])
}`, { key: MIGRATION_KEY });
console.log(JSON.stringify({ published, publishFailures, totals }));
if (publishFailures > Math.max(15, candidates.size * 0.08) || totals.included < 50 || totals.variations < 50 || totals.accessories < 50) throw new Error(`Cleaver reader migration incomplete after publish: failures=${publishFailures}, totals=${JSON.stringify(totals)}`);
