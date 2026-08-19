#!/usr/bin/env node
import fs from "node:fs";

const projectId = "9b5twpc8";
const dataset = "production";
const apiVersion = "2025-02-19";
const base = `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`;

async function runQuery(query) {
  const url = `${base}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Sanity query failed: ${response.status} ${await response.text()}`);
  const json = await response.json();
  return json.result;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[‐‑‒–—―−]/g, "-")
    .trim()
    .toUpperCase();
}

function usable(value) {
  return Boolean(value && value !== "N/A" && value !== "NA" && value !== "-");
}

const abmQuery = `*[
  _type == "abmRebuildChunk"
  && version == "2026-08-09-search-v5"
  && kind in ["product", "service"]
].records[]{kind, sku, title}`;

const kentQuery = `*[
  _type == "product"
  && (!defined(isActive) || isActive == true)
  && (
    brandSlug == "kent"
    || brand->slug.current == "kent"
    || brand->themeKey == "kent"
  )
]{title, sku, variants[]{sku, catNo}}`;

const [abmRows, kentRows] = await Promise.all([runQuery(abmQuery), runQuery(kentQuery)]);

const abm = new Map();
for (const row of Array.isArray(abmRows) ? abmRows : []) {
  const key = normalize(row?.sku);
  if (!usable(key)) continue;
  const list = abm.get(key) || [];
  list.push({ kind: row?.kind || "", title: row?.title || "", sku: row?.sku || "" });
  abm.set(key, list);
}

const kent = new Map();
for (const row of Array.isArray(kentRows) ? kentRows : []) {
  const values = [row?.sku, ...(Array.isArray(row?.variants) ? row.variants.flatMap((v) => [v?.sku, v?.catNo]) : [])];
  for (const raw of values) {
    const key = normalize(raw);
    if (!usable(key)) continue;
    const list = kent.get(key) || [];
    const entry = { title: row?.title || "", sku: String(raw || "") };
    if (!list.some((item) => item.title === entry.title && item.sku === entry.sku)) list.push(entry);
    kent.set(key, list);
  }
}

const overlaps = [...abm.keys()]
  .filter((key) => kent.has(key))
  .sort((a, b) => a.localeCompare(b))
  .map((value) => ({ value, abm: abm.get(value), kent: kent.get(value) }));

const output = {
  generatedAt: new Date().toISOString(),
  abmUniqueSkuCount: abm.size,
  kentUniqueItemCount: kent.size,
  overlapCount: overlaps.length,
  overlaps,
};

fs.writeFileSync("data/_catalog-overlap-temp.json", `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
