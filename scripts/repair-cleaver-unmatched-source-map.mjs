#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_HOST = "www.thistlescientific.com";
const USER_AGENT = "Mozilla/5.0 (compatible; ITS-BIO-CleaverCatalogRepair/1.0; +https://itsbio.co.kr)";
const inventoryPath = path.join(process.cwd(), "data/cleaver-product-catalog.json");
const mapPath = path.join(process.cwd(), "data/cleaver-source-map.json");
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const sourceMap = JSON.parse(await readFile(mapPath, "utf8"));

const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const key = (value) => String(value || "")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[×]/g, "x")
  .replace(/\b(?:cleaver scientific|thistle scientific)\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const tokens = (value) => new Set(key(value).split(" ").filter((token) => token.length > 1));

function similarity(a, b) {
  const ka = key(a);
  const kb = key(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;
  const aa = tokens(a);
  const bb = tokens(b);
  const intersection = [...aa].filter((token) => bb.has(token)).length;
  const union = new Set([...aa, ...bb]).size;
  const jaccard = union ? intersection / union : 0;
  const containment = ka.includes(kb) || kb.includes(ka) ? Math.min(ka.length, kb.length) / Math.max(ka.length, kb.length) : 0;
  return Math.max(jaccard, containment);
}

async function fetchJson(url) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "Accept-Language": "en-GB,en;q=0.9", Referer: `https://${SOURCE_HOST}/`, "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(45_000),
    });
    if (response.status === 429 && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(15_000, 1200 * (2 ** attempt))));
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  throw new Error("source search remained rate limited");
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

function identityFrom(candidate, fallbackTitle) {
  const sourceTitle = String(candidate?.name || fallbackTitle || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const sourceUrl = String(candidate?.permalink || "").trim();
  const sourceSlug = String(candidate?.slug || "").trim();
  const images = Array.from(new Set((Array.isArray(candidate?.images) ? candidate.images : []).map((image) => String(image?.src || "").trim()).filter((url) => /^https:\/\//i.test(url))));
  if (!sourceTitle || !sourceUrl || !sourceSlug) return null;
  return { sourceTitle, sourceUrl, sourceSlug, images };
}

const unmatched = inventory.filter((row) => !sourceMap[normalizeSku(row.sku)]);
let recovered = 0;
let failures = 0;
const ambiguous = [];
const recoveredRows = [];

await pooled(unmatched, 3, async (row) => {
  try {
    const url = new URL(`https://${SOURCE_HOST}/wp-json/wc/store/v1/products`);
    url.searchParams.set("search", row.title);
    url.searchParams.set("per_page", "30");
    const results = await fetchJson(url.toString());
    const ranked = (Array.isArray(results) ? results : [])
      .map((candidate) => ({ candidate, score: similarity(row.title, candidate?.name) }))
      .filter((entry) => entry.score >= 0.88)
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const second = ranked[1];
    if (!best || (second && second.score === best.score && key(second.candidate?.name) !== key(best.candidate?.name))) {
      ambiguous.push({ sku: row.sku, title: row.title, best: best ? { title: best.candidate?.name, score: best.score } : null });
      return;
    }
    if (best.score < 1 && best.score - (second?.score || 0) < 0.08) {
      ambiguous.push({ sku: row.sku, title: row.title, best: { title: best.candidate?.name, score: best.score } });
      return;
    }
    const identity = identityFrom(best.candidate, row.title);
    if (!identity) return;
    sourceMap[normalizeSku(row.sku)] = identity;
    recovered += 1;
    recoveredRows.push({ sku: row.sku, title: row.title, sourceTitle: identity.sourceTitle, score: best.score });
  } catch (error) {
    failures += 1;
    console.warn(`[Cleaver unmatched repair] ${row.sku}: ${error instanceof Error ? error.message : String(error)}`);
  }
});

await writeFile(mapPath, `${JSON.stringify(sourceMap, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ unmatchedBefore: unmatched.length, recovered, failures, ambiguous: ambiguous.length, recoveredRows: recoveredRows.slice(0, 30), firstAmbiguous: ambiguous.slice(0, 30), mappedAfter: Object.keys(sourceMap).length }));
