#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");

const MIGRATION_KEY = "cleaver-products-2026-08-24";
const READER = "https://r.jina.ai/";
const SOURCE_HOSTS = new Set(["www.thistlescientific.com", "thistlescientific.com"]);
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");

const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim()).find(Boolean);
if (!token) throw new Error("Cleaver What's Included repair requires a Production Sanity write token.");

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

function oneLine(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function keyOf(value) {
  return oneLine(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[×]/g, "x").replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeSourceUrl(value) {
  try {
    const url = new URL(String(value || ""));
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return "";
  }
}

function section(markdown, label) {
  const normalized = String(markdown || "").replace(/[’]/g, "'");
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
    .replace(/[*_`>#|]/g, " "));
}

function parseIncludedGroup(block) {
  const plain = String(block || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#|]/g, " ")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain || !/Qty\s*:/i.test(plain)) return [];

  const items = [];
  const seen = new Set();
  const regex = /(.*?)\s*Qty\s*:\s*(\d+)/gi;
  for (const match of plain.matchAll(regex)) {
    const title = stripMarkdown(match[1]).replace(/^Image:\s*/i, "").trim();
    const quantity = match[2];
    const key = keyOf(title);
    if (!key || title.length < 3 || title.length > 220 || seen.has(key)) continue;
    seen.add(key);
    items.push({
      _key: hash(`included:${key}`).slice(0, 12),
      title,
      quantity,
      sourceUrl: "",
      imageUrl: "",
    });
  }
  return items;
}

function includedGroups(markdown) {
  const body = section(markdown, "What's Included");
  if (!body) return [];
  const blocks = body.split(/\n\s*\n+/).map((block) => block.trim()).filter(Boolean);
  const groups = [];
  const signatures = new Set();
  for (const block of blocks) {
    const items = parseIncludedGroup(block);
    if (!items.length) continue;
    const signature = items.map((item) => `${keyOf(item.title)}:${item.quantity}`).join("|");
    if (!signature || signatures.has(signature)) continue;
    signatures.add(signature);
    groups.push(items);
  }
  if (!groups.length) {
    const items = parseIncludedGroup(body);
    if (items.length) groups.push(items);
  }
  return groups;
}

const STOPWORDS = new Set(["the", "and", "with", "for", "of", "a", "an", "system", "electrophoresis", "product", "complete", "including"]);
function tokens(value) {
  return keyOf(value).split(" ").filter((token) => token && !STOPWORDS.has(token));
}

function matchScore(productTitle, group) {
  const titleKey = keyOf(productTitle);
  const titleTokens = new Set(tokens(productTitle));
  let best = 0;
  for (const item of group) {
    const itemKey = keyOf(item.title);
    const itemTokens = new Set(tokens(item.title));
    let score = 0;
    if (titleKey && itemKey && (titleKey.includes(itemKey) || itemKey.includes(titleKey))) score += 120;
    for (const token of itemTokens) {
      if (!titleTokens.has(token)) continue;
      score += /^\d/.test(token) ? 24 : 8;
    }
    best = Math.max(best, score);
  }
  return best;
}

function imageFor(title, product) {
  const key = keyOf(title);
  const pools = [
    ...(product.cleaverIncludedItems || []),
    ...(product.cleaverAccessories || []),
    ...(product.cleaverVariations || []),
  ];
  const match = pools.find((item) => keyOf(item.title) === key && item.imageUrl);
  return String(match?.imageUrl || "");
}

async function reader(sourceUrl) {
  const url = new URL(sourceUrl);
  if (!SOURCE_HOSTS.has(url.hostname)) throw new Error(`Unapproved source host: ${url.hostname}`);
  let lastStatus = 0;
  let lastLength = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(`${READER}${sourceUrl}`, {
        headers: { Accept: "text/plain,text/markdown;q=0.9,*/*;q=0.8", "User-Agent": "ITS-BIO-CleaverIncludedRepair/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(60_000),
      });
      const text = await response.text();
      lastStatus = response.status;
      lastLength = text.length;
      if (response.ok && text.length > 250) return text;
      if (![429, 500, 502, 503, 504].includes(response.status)) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1500 * (2 ** attempt)));
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

const products = await client.fetch(`*[_type == "product" && migrationKey == $key && defined(sourceUrl) && count(cleaverIncludedItems) > 0]{
  _id, sku, title, cleaverSourceTitle, sourceUrl,
  cleaverIncludedItems[]{title,quantity,imageUrl},
  cleaverAccessories[]{title,imageUrl,internalHref},
  cleaverVariations[]{title,imageUrl,internalHref}
}`, { key: MIGRATION_KEY });

const bySource = new Map();
for (const product of products || []) {
  const sourceUrl = normalizeSourceUrl(product.sourceUrl);
  if (!sourceUrl) continue;
  const list = bySource.get(sourceUrl) || [];
  list.push(product);
  bySource.set(sourceUrl, list);
}

let familiesRead = 0;
let productsPatched = 0;
let ambiguousProducts = 0;
let patchFailures = 0;
const readerFailures = [];
const samples = [];

await pooled([...bySource.entries()], 4, async ([sourceUrl, familyProducts]) => {
  try {
    const markdown = await reader(sourceUrl);
    familiesRead += 1;
    const groups = includedGroups(markdown);
    if (!groups.length) return;

    for (const product of familyProducts) {
      let selected = groups[0];
      let selectedScore = groups.length === 1 ? 1 : -1;
      if (groups.length > 1) {
        const title = product.cleaverSourceTitle || product.title || "";
        const ranked = groups.map((group, index) => ({ group, index, score: matchScore(title, group) })).sort((a, b) => b.score - a.score || a.index - b.index);
        if (!ranked[0] || ranked[0].score <= 0 || (ranked[1] && ranked[1].score === ranked[0].score)) {
          ambiguousProducts += 1;
          continue;
        }
        selected = ranked[0].group;
        selectedScore = ranked[0].score;
      }

      const repaired = selected.map((item) => ({ ...item, imageUrl: imageFor(item.title, product) }));
      try {
        await client.patch(product._id).set({ cleaverIncludedItems: repaired, cleaverSourceSectionsMigratedAt: new Date().toISOString() }).commit({ visibility: "async" });
        productsPatched += 1;
        if (samples.length < 8) samples.push({ sku: product.sku, groups: groups.map((group) => group.length), selected: repaired.length, score: selectedScore });
      } catch (error) {
        patchFailures += 1;
        console.warn(`[Cleaver included repair] patch ${product.sku}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    readerFailures.push({ sourceUrl, error: error instanceof Error ? error.message : String(error) });
  }
});

console.log(JSON.stringify({
  productsBefore: products.length,
  sourceFamiliesChecked: bySource.size,
  familiesRead,
  productsPatched,
  ambiguousProducts,
  patchFailures,
  readerFailures: readerFailures.length,
  firstReaderFailures: readerFailures.slice(0, 8),
  samples,
}));

if (patchFailures > 10) throw new Error(`Cleaver What's Included repair had too many patch failures: ${patchFailures}`);
