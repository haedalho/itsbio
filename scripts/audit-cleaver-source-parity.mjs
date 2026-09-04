#!/usr/bin/env node

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");

const MIGRATION_KEY = "cleaver-products-2026-08-24";
const READER = "https://r.jina.ai/";
const SOURCE_HOSTS = new Set(["www.thistlescientific.com", "thistlescientific.com"]);
const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const oneLine = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\r/g, " ").replace(/\s+/g, " ").trim();
const keyOf = (value) => oneLine(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const inventory = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-product-catalog.json"), "utf8"));
const sourceMap = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-source-map.json"), "utf8"));
const inventorySkus = new Set(inventory.map((row) => normalizeSku(row.sku)));

function normalizeSourceUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!SOURCE_HOSTS.has(url.hostname.toLowerCase())) return "";
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    url.search = "";
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
    return url.toString();
  } catch {
    return "";
  }
}

const families = new Map();
for (const [rawSku, identity] of Object.entries(sourceMap)) {
  const sku = normalizeSku(rawSku);
  if (!inventorySkus.has(sku)) continue;
  const sourceUrl = normalizeSourceUrl(identity?.sourceUrl);
  if (!sourceUrl) continue;
  const list = families.get(sourceUrl) || [];
  list.push(sku);
  families.set(sourceUrl, list);
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

async function readSource(sourceUrl) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${READER}${sourceUrl}`, {
      headers: { Accept: "text/markdown,text/plain;q=0.9,*/*;q=0.8", "User-Agent": "ITS-BIO-CleaverParityAudit/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(75_000),
    });
    const text = await response.text();
    lastStatus = response.status;
    if (response.ok && text.length > 250) return text;
    if (![408, 429, 500, 502, 503, 504].includes(response.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 1600 * (2 ** attempt)));
  }
  throw new Error(`reader HTTP ${lastStatus}`);
}

function headings(markdown) {
  return [...String(markdown || "").replace(/[’]/g, "'").matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)].map((match) => ({
    level: match[1].length,
    title: oneLine(match[2]).replace(/\s*\+\s*$/, ""),
    index: match.index,
    length: match[0].length,
  }));
}

function canonical(value) {
  const key = keyOf(String(value || "").replace(/[’']/g, " "));
  if (key === "overview") return "Overview";
  if (key === "specification" || key === "specifications") return "Specifications";
  if (key === "documents" || key === "document" || key === "downloads") return "Documents";
  if (key === "what s included" || key === "whats included") return "What's Included";
  if (key === "all variations" || key === "variations") return "All Variations";
  if (key === "accessories" || key === "accessory") return "Accessories";
  if (key === "works with") return "Works With";
  if (key === "video" || key === "videos") return "Video";
  return "";
}

function section(markdown, label) {
  const list = headings(markdown);
  const start = list.find((heading) => canonical(heading.title) === label);
  if (!start) return null;
  const next = list.find((heading) => heading.index > start.index && heading.level <= start.level);
  return String(markdown).slice(start.index + start.length, next ? next.index : markdown.length).trim();
}

function plain(value) {
  return oneLine(String(value || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`>#|]/g, " "));
}

function htmlPlain(value) {
  return oneLine(String(value || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&micro;/gi, "µ"));
}

function bulletsFromAtAGlance(markdown) {
  const normalized = String(markdown || "").replace(/[’]/g, "'");
  const marker = /^\s*At a Glance\s*$/im.exec(normalized);
  if (!marker) return [];
  const tail = normalized.slice(marker.index + marker[0].length);
  const stop = /^(?:#{1,6}\s+.+|SKU\s*:|Add to quote|In stock|Out of stock|£)/im.exec(tail);
  const body = (stop ? tail.slice(0, stop.index) : tail.slice(0, 1500)).trim();
  return [...new Set(body.split("\n").map((line) => line.match(/^\s*[-*+]\s+(.+)$/)?.[1]).filter(Boolean).map(plain))];
}

function linkUrls(body, kind) {
  const out = new Set();
  for (const match of String(body || "").matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+|\/product\/[^)]+)\)/gi)) {
    const raw = match[2].replace(/&amp;/g, "&").trim();
    if (kind === "document") {
      try {
        const url = new URL(raw, "https://www.thistlescientific.com/");
        if (/\.pdf(?:$|\?)/i.test(url.toString()) || /files\.plytix\.com$/i.test(url.hostname) || /\/downloads?\//i.test(url.pathname)) out.add(url.toString());
      } catch {}
      continue;
    }
    if (kind === "product") {
      try {
        const url = new URL(raw, "https://www.thistlescientific.com/");
        if (SOURCE_HOSTS.has(url.hostname.toLowerCase()) && /\/product\//i.test(url.pathname)) out.add(normalizeSourceUrl(url.toString()));
      } catch {}
    }
  }
  return [...out];
}

function youtubeUrls(body) {
  const out = new Set();
  for (const match of String(body || "").matchAll(/https?:\/\/[^\s)>]+/gi)) {
    const url = match[0].replace(/[.,;]+$/, "");
    if (/youtu\.be|youtube\.com/i.test(url)) out.add(url);
  }
  return [...out];
}

function hasMeaningfulBody(body) {
  return Boolean(plain(body).replace(/^(?:accessory|pack size|price|qty|ordering|image|documents?|product flyers?|instructions?)\b/gi, "").trim());
}

const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim()).find(Boolean);
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

const rows = await client.fetch(`*[_type == "product" && migrationKey == $key]{sku,overviewHtml,specRows,docs,cleaverAtAGlance,cleaverIncludedItems,cleaverVariations,cleaverAccessories,cleaverWorksWith,cleaverVideos,cleaverSourceSectionOrder}`, { key: MIGRATION_KEY });
const bySku = new Map((rows || []).map((row) => [normalizeSku(row.sku), row]));

const failures = [];
const sourceFailures = [];
let checkedFamilies = 0;
let checkedSkus = 0;

await pooled([...families.entries()], 6, async ([sourceUrl, skus]) => {
  let markdown;
  try {
    markdown = await readSource(sourceUrl);
  } catch (error) {
    sourceFailures.push({ sourceUrl, error: error instanceof Error ? error.message : String(error) });
    return;
  }

  checkedFamilies += 1;
  const overviewBody = section(markdown, "Overview");
  const specBody = section(markdown, "Specifications");
  const docsBody = section(markdown, "Documents");
  const includedBody = section(markdown, "What's Included");
  const variationsBody = section(markdown, "All Variations");
  const accessoriesBody = section(markdown, "Accessories");
  const worksBody = section(markdown, "Works With");
  const videoBody = section(markdown, "Video");
  const sourceGlance = bulletsFromAtAGlance(markdown);
  const sourceDocs = linkUrls(docsBody, "document");
  const sourceAccessories = linkUrls(accessoriesBody, "product");
  const sourceWorks = linkUrls(worksBody, "product");
  const sourceVideos = youtubeUrls(videoBody);
  const expectedOrder = headings(markdown).map((heading) => canonical(heading.title)).filter(Boolean).filter((label, index, list) => list.indexOf(label) === index);

  for (const sku of skus) {
    checkedSkus += 1;
    const actual = bySku.get(sku);
    if (!actual) {
      failures.push({ sku, sourceUrl, field: "product", reason: "missing Sanity product" });
      continue;
    }
    const push = (field, reason) => failures.push({ sku, sourceUrl, field, reason });

    const sourceOverview = plain(overviewBody);
    const actualOverview = htmlPlain(actual.overviewHtml);
    if (sourceOverview && !actualOverview) push("Overview", "source has content but ITS BIO is empty");
    else if (!sourceOverview && actualOverview) push("Overview", "source has no Overview but ITS BIO has content");
    else if (sourceOverview && actualOverview && keyOf(sourceOverview) !== keyOf(actualOverview)) push("Overview", "text differs from source");

    const sourceHasSpecs = Boolean(specBody && (plain(specBody) || /\|/.test(specBody)));
    const actualHasSpecs = Array.isArray(actual.specRows) && actual.specRows.length > 0;
    if (sourceHasSpecs !== actualHasSpecs) push("Specifications", sourceHasSpecs ? "source has Specifications but ITS BIO is empty" : "source has no Specifications but ITS BIO has rows");

    const actualDocUrls = new Set((actual.docs || []).map((item) => String(item?.url || "")).filter(Boolean));
    if (sourceDocs.length && sourceDocs.some((url) => !actualDocUrls.has(url))) push("Documents", `missing source document URL(s): ${sourceDocs.filter((url) => !actualDocUrls.has(url)).length}`);
    if (docsBody && hasMeaningfulBody(docsBody) && !actualDocUrls.size) push("Documents", "source Documents section has content but ITS BIO is empty");
    if (!docsBody && actualDocUrls.size) push("Documents", "source has no Documents section but ITS BIO has documents");

    const actualWorks = new Set((actual.cleaverWorksWith || []).map((item) => normalizeSourceUrl(item?.sourceUrl)).filter(Boolean));
    if (sourceWorks.length && sourceWorks.some((url) => !actualWorks.has(url))) push("Works With", `missing source product(s): ${sourceWorks.filter((url) => !actualWorks.has(url)).length}`);
    if (worksBody && hasMeaningfulBody(worksBody) && !(actual.cleaverWorksWith || []).length) push("Works With", "source Works With section has content but ITS BIO is empty");
    if (!worksBody && (actual.cleaverWorksWith || []).length) push("Works With", "source has no Works With section but ITS BIO has products");

    const actualAccessories = new Set((actual.cleaverAccessories || []).map((item) => normalizeSourceUrl(item?.sourceUrl)).filter(Boolean));
    if (sourceAccessories.length && sourceAccessories.some((url) => !actualAccessories.has(url))) push("Accessories", `missing source product(s): ${sourceAccessories.filter((url) => !actualAccessories.has(url)).length}`);
    if (accessoriesBody && hasMeaningfulBody(accessoriesBody) && !(actual.cleaverAccessories || []).length) push("Accessories", "source Accessories section has content but ITS BIO is empty");
    if (!accessoriesBody && (actual.cleaverAccessories || []).length) push("Accessories", "source has no Accessories section but ITS BIO has products");

    if (sourceGlance.length) {
      const actualSet = new Set((actual.cleaverAtAGlance || []).map(keyOf));
      const missing = sourceGlance.filter((item) => !actualSet.has(keyOf(item)));
      if (missing.length) push("At a Glance", `missing ${missing.length}/${sourceGlance.length} source bullet(s)`);
    } else if ((actual.cleaverAtAGlance || []).length) push("At a Glance", "source has no At a Glance bullets but ITS BIO has bullets");

    if (sourceVideos.length && !(actual.cleaverVideos || []).length) push("Video", "source has video URL(s) but ITS BIO is empty");
    if (!videoBody && (actual.cleaverVideos || []).length) push("Video", "source has no Video section but ITS BIO has videos");

    if (Boolean(includedBody) !== Boolean((actual.cleaverIncludedItems || []).length)) push("What's Included", includedBody ? "source section exists but ITS BIO is empty" : "source section absent but ITS BIO has items");
    if (Boolean(variationsBody) !== Boolean((actual.cleaverVariations || []).length)) push("All Variations", variationsBody ? "source section exists but ITS BIO is empty" : "source section absent but ITS BIO has variations");

    const actualOrder = Array.isArray(actual.cleaverSourceSectionOrder) ? actual.cleaverSourceSectionOrder : [];
    if (expectedOrder.join("|") !== actualOrder.join("|")) push("Section order", `source=${expectedOrder.join(" > ")} actual=${actualOrder.join(" > ")}`);
  }
});

const example = bySku.get("MSO-1-12/22DS");
const fixtureFailures = [];
if (!example) fixtureFailures.push("MSO-1-12/22DS missing");
else {
  const expectedGlance = ["Molded, 1 mm thick double-sided comb.", "12/22 well.", "For MSMINIONE Large Tray."];
  if (keyOf(htmlPlain(example.overviewHtml)) !== keyOf("Comb 12/22, 1mm thick DS")) fixtureFailures.push("MSO-1-12/22DS Overview mismatch");
  if ((example.specRows || []).length !== 3) fixtureFailures.push(`MSO-1-12/22DS Specifications expected 3 got ${(example.specRows || []).length}`);
  if ((example.docs || []).length !== 2) fixtureFailures.push(`MSO-1-12/22DS Documents expected 2 got ${(example.docs || []).length}`);
  if ((example.cleaverWorksWith || []).length !== 1 || normalizeSku(example.cleaverWorksWith?.[0]?.sku) !== "MSMINIONE") fixtureFailures.push("MSO-1-12/22DS Works With mismatch");
  const actualGlance = new Set((example.cleaverAtAGlance || []).map(keyOf));
  if (expectedGlance.some((item) => !actualGlance.has(keyOf(item)))) fixtureFailures.push("MSO-1-12/22DS At a Glance mismatch");
}

console.log(JSON.stringify({ families: families.size, checkedFamilies, checkedSkus, sourceFailures: sourceFailures.length, parityFailures: failures.length, fixtureFailures, firstSourceFailures: sourceFailures.slice(0, 12), firstParityFailures: failures.slice(0, 40) }));
if (sourceFailures.length) throw new Error(`Independent Cleaver parity audit could not read ${sourceFailures.length} source families.`);
if (fixtureFailures.length) throw new Error(`Cleaver exact regression fixture failed: ${fixtureFailures.join("; ")}`);
if (failures.length) throw new Error(`Independent Cleaver source parity audit found ${failures.length} mismatches.`);
