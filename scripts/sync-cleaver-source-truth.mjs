#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");

const APPLY = process.argv.includes("--apply");
const MIGRATION_KEY = "cleaver-products-2026-08-24";
const SOURCE_HOSTS = new Set(["www.thistlescientific.com", "thistlescientific.com"]);
const READER = "https://r.jina.ai/";
const CONCURRENCY = Math.max(1, Math.min(8, Number.parseInt(process.env.CLEAVER_SOURCE_TRUTH_CONCURRENCY || "4", 10) || 4));
const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
const oneLine = (value) => clean(value).replace(/\s+/g, " ");
const keyOf = (value) => oneLine(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");
const escapeHtml = (value) => String(value).replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[character]));

const inventory = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-product-catalog.json"), "utf8"));
const sourceMap = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-source-map.json"), "utf8"));
const inventoryBySku = new Map(inventory.map((row) => [normalizeSku(row.sku), row]));
if (inventory.length !== 1432 || inventoryBySku.size !== 1432) throw new Error("Expected exactly 1,432 reviewed Cleaver SKUs.");

function normalizeSourceUrl(value) {
  try {
    const url = new URL(String(value || ""), "https://www.thistlescientific.com/");
    if (!SOURCE_HOSTS.has(url.hostname.toLowerCase())) return "";
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
    return url.toString();
  } catch {
    return "";
  }
}

const sourceByUrl = new Map();
const identityByUrl = new Map();
for (const [rawSku, identity] of Object.entries(sourceMap)) {
  const sku = normalizeSku(rawSku);
  if (!inventoryBySku.has(sku)) continue;
  const sourceUrl = normalizeSourceUrl(identity?.sourceUrl);
  if (!sourceUrl) continue;
  const member = { sku, identity, inventory: inventoryBySku.get(sku) };
  const family = sourceByUrl.get(sourceUrl) || [];
  family.push(member);
  sourceByUrl.set(sourceUrl, family);
  if (!identityByUrl.has(sourceUrl)) identityByUrl.set(sourceUrl, member);
}
const mappedSkuCount = [...sourceByUrl.values()].reduce((total, family) => total + family.length, 0);
if (!sourceByUrl.size || mappedSkuCount < 900) throw new Error(`Cleaver source-map coverage is unexpectedly low: ${sourceByUrl.size} families / ${mappedSkuCount} SKUs.`);

const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim()).find(Boolean);
if (APPLY && !token) throw new Error("Source-truth sync requires the Production Sanity write token.");
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

async function readSource(sourceUrl) {
  const source = new URL(sourceUrl);
  if (!SOURCE_HOSTS.has(source.hostname)) throw new Error(`Unapproved source host: ${source.hostname}`);
  let lastStatus = 0;
  let lastBytes = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${READER}${sourceUrl}`, {
      headers: { Accept: "text/markdown,text/plain;q=0.9,*/*;q=0.8", "User-Agent": "ITS-BIO-CleaverSourceTruth/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(75_000),
    });
    const text = await response.text();
    lastStatus = response.status;
    lastBytes = text.length;
    if (response.ok && text.length > 250) return text;
    if (![408, 429, 500, 502, 503, 504].includes(response.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 1800 * (2 ** attempt)));
  }
  throw new Error(`reader failed: HTTP ${lastStatus}, ${lastBytes} bytes`);
}

function stripMarkdown(value) {
  return oneLine(String(value || "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`>#]/g, " ")
    .replace(/\|/g, " "));
}

function headings(markdown) {
  const out = [];
  const regex = /^(#{1,6})\s+(.+?)\s*$/gm;
  for (const match of markdown.replace(/[’]/g, "'").matchAll(regex)) {
    out.push({ level: match[1].length, title: oneLine(match[2]).replace(/\s*\+\s*$/, ""), index: match.index, length: match[0].length });
  }
  return out;
}

const LABELS = new Map([
  ["overview", "Overview"], ["specification", "Specifications"], ["specifications", "Specifications"],
  ["what s included", "What's Included"], ["whats included", "What's Included"],
  ["video", "Video"], ["videos", "Video"], ["documents", "Documents"], ["document", "Documents"], ["downloads", "Documents"],
  ["all variations", "All Variations"], ["variations", "All Variations"], ["accessories", "Accessories"], ["accessory", "Accessories"],
  ["works with", "Works With"],
]);
function canonicalLabel(value) {
  return LABELS.get(keyOf(String(value || "").replace(/[’']/g, " "))) || "";
}

function sectionInfo(markdown, rawTitle) {
  const list = headings(markdown);
  const targetKey = keyOf(String(rawTitle || "").replace(/[’']/g, " "));
  const requestedLabel = canonicalLabel(rawTitle);
  const start = list.find((heading) => keyOf(heading.title.replace(/[’']/g, " ")) === targetKey || (requestedLabel && canonicalLabel(heading.title) === requestedLabel));
  if (!start) return null;
  const from = start.index + start.length;
  const next = list.find((heading) => heading.index > start.index && heading.level <= start.level);
  const to = next ? next.index : markdown.length;
  return { ...start, body: markdown.slice(from, to).trim() };
}

function sourceSectionOrder(markdown) {
  const seen = new Set();
  const order = [];
  for (const heading of headings(markdown)) {
    const label = canonicalLabel(heading.title);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    order.push(label);
  }
  return order;
}

function paragraphsHtml(body) {
  const blocks = String(body || "").split(/\n\s*\n/).map(stripMarkdown).filter((text) => text.length > 15 && !/^image:/i.test(text));
  return blocks.slice(0, 16).map((text) => `<p>${escapeHtml(text)}</p>`).join("\n");
}

function overviewHtml(markdown) {
  const info = sectionInfo(markdown, "Overview");
  if (!info || stripMarkdown(info.body).length < 30) return "";
  return paragraphsHtml(info.body);
}

function atAGlance(markdown) {
  const explicit = sectionInfo(markdown, "At a Glance");
  let body = explicit?.body || "";
  if (!body) {
    const normalized = markdown.replace(/[’]/g, "'");
    const marker = /^\s*At a Glance\s*$/im.exec(normalized);
    if (marker) {
      const tail = normalized.slice(marker.index + marker[0].length);
      const stop = /^(?:#{1,6}\s+.+|Item\s*$|SKU\s*:|Add to quote|In stock)/im.exec(tail);
      body = (stop ? tail.slice(0, stop.index) : tail.slice(0, 1200)).trim();
    }
  }
  if (!body) return [];
  const items = [];
  for (const line of body.split("\n")) {
    const match = line.match(/^\s*[-*+]\s+(.+)$/);
    if (!match) continue;
    const text = stripMarkdown(match[1]);
    if (text.length > 3 && text.length < 300) items.push(text);
  }
  return [...new Set(items)].slice(0, 12);
}

function splitTableRow(line) {
  const value = line.trim();
  if (!value.includes("|")) return [];
  return value.replace(/^\|/, "").replace(/\|$/, "").split("|").map(stripMarkdown);
}

function specificationRows(markdown, requestedSku) {
  const info = sectionInfo(markdown, "Specifications");
  if (!info) return [];
  const matrix = info.body.split("\n").filter((line) => line.includes("|")).map(splitTableRow)
    .filter((row) => row.length > 1 && !row.every((cell) => /^[-: ]*$/.test(cell)));
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
      for (const row of matrix.slice(h + 1)) if (row.length > column) add(row[0], row[column]);
      break;
    }
  }
  if (!rows.length) {
    const matchingRow = matrix.find((row) => normalizeSku(row[0]) === sku);
    const header = matrix[0] || [];
    if (matchingRow && matchingRow.length === header.length) header.slice(1).forEach((label, index) => add(label, matchingRow[index + 1]));
  }
  if (!rows.length && matrix.every((row) => row.length === 2)) matrix.forEach((row) => add(row[0], row[1]));
  return rows.slice(0, 50);
}

function documentItems(markdown) {
  const info = sectionInfo(markdown, "Documents");
  if (!info) return [];
  const out = new Map();
  let group = "Documents";
  const lines = info.body.split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const heading = line.match(/^\s*#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      group = stripMarkdown(heading[1]).replace(/\s*\+\s*$/, "") || "Documents";
      continue;
    }
    const plain = stripMarkdown(line);
    const nextMeaningful = lines.slice(lineIndex + 1).find((candidate) => candidate.trim());
    if (plain && plain.length <= 100 && !/https?:\/\//i.test(line) && nextMeaningful && /(?:^\s*[-*+]\s+|\[[^\]]+\]\()/i.test(nextMeaningful)) {
      group = plain;
      continue;
    }
    for (const match of line.matchAll(/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/gi)) {
      const url = match[2].replace(/&amp;/g, "&").trim();
      let parsed;
      try { parsed = new URL(url); } catch { continue; }
      const looksLikeDocument = /\.pdf(?:$|\?)/i.test(url) || /files\.plytix\.com$/i.test(parsed.hostname) || /\/downloads?\//i.test(parsed.pathname);
      if (!looksLikeDocument) continue;
      const filename = decodeURIComponent(parsed.pathname.split("/").at(-1) || "Product document").replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
      const title = (stripMarkdown(match[1]).replace(/\(PDF\)$/i, "") || filename || "Product document").slice(0, 180);
      out.set(url, { _key: hash(url).slice(0, 12), title, label: title, group: group.slice(0, 120), url });
    }
  }
  if (!out.size) {
    for (const match of info.body.matchAll(/https?:\/\/[^\s)>]+/gi)) {
      const url = match[0].replace(/[.,;]+$/, "");
      let parsed;
      try { parsed = new URL(url); } catch { continue; }
      if (!/\.pdf(?:$|\?)/i.test(url) && !/files\.plytix\.com$/i.test(parsed.hostname)) continue;
      const title = decodeURIComponent(parsed.pathname.split("/").at(-1) || "Product document").replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
      out.set(url, { _key: hash(url).slice(0, 12), title, label: title, group: "Documents", url });
    }
  }
  return [...out.values()].slice(0, 30);
}

function resolveProductLink(sourceUrl, fallbackTitle = "") {
  const normalizedUrl = normalizeSourceUrl(sourceUrl);
  const member = identityByUrl.get(normalizedUrl);
  if (!member) return { title: fallbackTitle, sourceUrl: normalizedUrl || sourceUrl, imageUrl: "", internalHref: "", sku: "" };
  const identity = member.identity || {};
  const sourceSlug = String(identity.sourceSlug || "").trim();
  return {
    title: String(identity.sourceTitle || fallbackTitle || member.inventory.title).trim(),
    sku: member.inventory.sku,
    sourceUrl: normalizedUrl,
    imageUrl: String(identity.images?.[0] || ""),
    internalHref: sourceSlug ? `/products/cleaver/item/${encodeURIComponent(sourceSlug)}` : "",
  };
}

function linkedProducts(markdown, label, prefix) {
  const info = sectionInfo(markdown, label);
  if (!info) return [];
  const out = new Map();
  for (const match of info.body.matchAll(/\[([^\]]+)\]\((https?:\/\/(?:www\.)?thistlescientific\.com\/product\/[^)]+|\/product\/[^)]+)\)/gi)) {
    const rawTitle = stripMarkdown(match[1]);
    if (!rawTitle || /^(?:view product|add to basket|order now)$/i.test(rawTitle)) continue;
    const resolved = resolveProductLink(match[2], rawTitle);
    const key = normalizeSourceUrl(resolved.sourceUrl) || keyOf(resolved.title);
    if (!key || out.has(key)) continue;
    const context = info.body.slice(Math.max(0, match.index - 120), Math.min(info.body.length, match.index + match[0].length + 220));
    out.set(key, {
      _key: hash(`${prefix}:${key}`).slice(0, 12), title: resolved.title.slice(0, 180), sku: resolved.sku,
      packSize: oneLine(context).match(/\b\d+\s*\/\s*(?:Each|Pack|Box|Case|Kit|Unit|Set|Pair)\b/i)?.[0] || "",
      priceText: "", sourceUrl: resolved.sourceUrl, imageUrl: resolved.imageUrl, internalHref: resolved.internalHref,
    });
  }
  return [...out.values()].slice(0, 80);
}

function includedItems(markdown) {
  const info = sectionInfo(markdown, "What's Included");
  if (!info) return [];
  const linked = linkedProducts(markdown, "What's Included", "included").map((item) => ({
    _key: item._key, title: item.title, quantity: "", sourceUrl: item.sourceUrl, imageUrl: item.imageUrl,
  }));
  const out = new Map(linked.map((item) => [keyOf(item.title), item]));
  const plain = info.body.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`#|]/g, " ").replace(/\s+/g, " ");
  for (const match of plain.matchAll(/(.{3,180}?)\s+Qty\s*:\s*(\d+)/gi)) {
    const title = oneLine(match[1]).replace(/^.*?(?=(?:microDOC|multiSUB|omni|Power|Cleaver|[A-Z][A-Za-z0-9]))/, "").replace(/\s*Qty\s*:.*$/i, "");
    const key = keyOf(title);
    if (!key) continue;
    const prior = out.get(key);
    out.set(key, prior ? { ...prior, quantity: match[2] } : { _key: hash(`included:${key}`).slice(0, 12), title, quantity: match[2], sourceUrl: "", imageUrl: "" });
  }
  return [...out.values()].slice(0, 40);
}

function variationItems(markdown, family) {
  if (!sectionInfo(markdown, "All Variations")) return [];
  return family.map(({ sku, identity, inventory: row }) => ({
    _key: hash(`variation:${sku}`).slice(0, 12), title: String(identity?.sourceTitle || row.title), sku: row.sku,
    packSize: "", priceText: "", imageUrl: String(identity?.images?.[0] || ""),
    internalHref: identity?.sourceSlug ? `/products/cleaver/item/${encodeURIComponent(identity.sourceSlug)}` : "",
  })).slice(0, 100);
}

function videoItems(markdown) {
  const info = sectionInfo(markdown, "Video");
  if (!info) return [];
  const out = new Map();
  const add = (rawUrl, title = "Product video") => {
    const url = String(rawUrl || "").replace(/&amp;/g, "&").replace(/[.,;]+$/, "");
    let parsed;
    try { parsed = new URL(url); } catch { return; }
    let embedUrl = "";
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (id) embedUrl = `https://www.youtube.com/embed/${id}`;
    } else if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com") {
      const id = parsed.pathname.startsWith("/embed/") ? parsed.pathname.split("/embed/")[1]?.split("/")[0] : parsed.searchParams.get("v");
      if (id) embedUrl = `https://www.youtube.com/embed/${id}`;
    }
    if (!embedUrl && !/\.(?:mp4|webm)(?:$|\?)/i.test(url)) return;
    const key = embedUrl || url;
    if (!out.has(key)) out.set(key, { _key: hash(`video:${key}`).slice(0, 12), title: oneLine(title).slice(0, 180) || "Product video", url, embedUrl });
  };
  for (const match of info.body.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi)) add(match[2], stripMarkdown(match[1]));
  for (const match of info.body.matchAll(/https?:\/\/[^\s)>]+/gi)) add(match[0]);
  return [...out.values()].slice(0, 10);
}

const EXTRA_IGNORE = /^(?:product enquiry|enquiry|related products?|you may also like|share|description|additional information|reviews?|delivery|basket|cart|contact|categories|brands|search|newsletter|recent posts?)$/i;
function extraSections(markdown, order) {
  const list = headings(markdown);
  const known = list.filter((heading) => canonicalLabel(heading.title));
  if (known.length < 2) return [];
  const levelCounts = new Map();
  for (const heading of known) levelCounts.set(heading.level, (levelCounts.get(heading.level) || 0) + 1);
  const productLevel = [...levelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const first = known[0].index;
  const last = known.at(-1).index;
  const extras = [];
  for (const heading of list) {
    if (heading.level !== productLevel || heading.index < first || heading.index > last) continue;
    if (canonicalLabel(heading.title) || /^at a glance$/i.test(heading.title) || EXTRA_IGNORE.test(heading.title)) continue;
    const info = sectionInfo(markdown, heading.title);
    if (!info) continue;
    const html = paragraphsHtml(info.body);
    if (stripMarkdown(info.body).length < 35 || !html) continue;
    extras.push({ _key: hash(`extra:${heading.title}`).slice(0, 12), title: heading.title.slice(0, 120), html });
    if (!order.includes(heading.title)) {
      const previousKnown = [...list].reverse().find((candidate) => candidate.index < heading.index && canonicalLabel(candidate.title));
      const previousLabel = previousKnown ? canonicalLabel(previousKnown.title) : "";
      const insertion = previousLabel ? order.lastIndexOf(previousLabel) + 1 : order.length;
      order.splice(Math.max(0, insertion), 0, heading.title);
    }
  }
  return extras.slice(0, 12);
}

const candidates = new Map();
const failed = new Map();
let completed = 0;

async function processFamily(sourceUrl, family) {
  try {
    const markdown = await readSource(sourceUrl);
    const order = sourceSectionOrder(markdown);
    const docs = documentItems(markdown);
    const accessories = linkedProducts(markdown, "Accessories", "accessory");
    const worksWith = linkedProducts(markdown, "Works With", "works-with");
    const included = includedItems(markdown);
    const variations = variationItems(markdown, family);
    const videos = videoItems(markdown);
    const overview = overviewHtml(markdown);
    const glance = atAGlance(markdown);
    const extras = extraSections(markdown, order);

    const docsInfo = sectionInfo(markdown, "Documents");
    if (docsInfo && docs.length === 0 && /(\.pdf\b|files\.plytix\.com|download)/i.test(docsInfo.body)) throw new Error("Documents section contains download evidence but no document was parsed");
    const worksInfo = sectionInfo(markdown, "Works With");
    if (worksInfo && worksWith.length === 0 && /(?:thistlescientific\.com)?\/product\//i.test(worksInfo.body)) throw new Error("Works With contains product links but none were parsed");
    const accessoriesInfo = sectionInfo(markdown, "Accessories");
    if (accessoriesInfo && accessories.length === 0 && /(?:thistlescientific\.com)?\/product\//i.test(accessoriesInfo.body)) throw new Error("Accessories contains product links but none were parsed");

    for (const member of family) {
      candidates.set(member.sku, {
        sku: member.sku, sourceUrl, overviewHtml: overview, specRows: specificationRows(markdown, member.sku), docs,
        includedItems: included, variations, accessories, worksWith, videos, atAGlance: glance,
        sectionOrder: [...order], extraSections: extras,
      });
    }
    failed.delete(sourceUrl);
  } catch (error) {
    failed.set(sourceUrl, { sourceUrl, error: error instanceof Error ? error.message : String(error) });
  }
}

await pooled([...sourceByUrl.entries()], CONCURRENCY, async ([sourceUrl, family]) => {
  await processFamily(sourceUrl, family);
  completed += 1;
  if (completed <= 5 || completed % 50 === 0 || completed === sourceByUrl.size) console.log(`[Cleaver source truth] ${completed}/${sourceByUrl.size} families, candidates=${candidates.size}, failures=${failed.size}`);
});
for (let pass = 1; pass <= 3 && failed.size; pass += 1) {
  await new Promise((resolve) => setTimeout(resolve, 5000 * pass));
  const pending = [...failed.keys()];
  await pooled(pending, 2, async (sourceUrl) => processFamily(sourceUrl, sourceByUrl.get(sourceUrl)));
  console.log(`[Cleaver source truth] retry ${pass}: remaining=${failed.size}`);
}

const coverage = {
  overview: [...candidates.values()].filter((row) => row.overviewHtml).length,
  specifications: [...candidates.values()].filter((row) => row.specRows.length).length,
  documents: [...candidates.values()].filter((row) => row.docs.length).length,
  included: [...candidates.values()].filter((row) => row.includedItems.length).length,
  variations: [...candidates.values()].filter((row) => row.variations.length).length,
  accessories: [...candidates.values()].filter((row) => row.accessories.length).length,
  worksWith: [...candidates.values()].filter((row) => row.worksWith.length).length,
  videos: [...candidates.values()].filter((row) => row.videos.length).length,
  atAGlance: [...candidates.values()].filter((row) => row.atAGlance.length).length,
};
console.log(JSON.stringify({ stage: APPLY ? "apply" : "dry-run", inventory: inventory.length, mappedSkuCount, families: sourceByUrl.size, candidates: candidates.size, failedFamilies: failed.size, coverage, firstFailures: [...failed.values()].slice(0, 12) }));
if (failed.size) throw new Error(`Source-truth sync refused partial coverage: ${failed.size} manufacturer families failed.`);
if (candidates.size !== mappedSkuCount) throw new Error(`Source-truth candidate mismatch: expected ${mappedSkuCount}, got ${candidates.size}.`);
if (!APPLY) process.exit(0);

const existing = await client.fetch(`*[_type == "product" && migrationKey == $key]{_id,sku}`, { key: MIGRATION_KEY });
const bySku = new Map((existing || []).map((row) => [normalizeSku(row.sku), row]));
const missingTargets = [...candidates.keys()].filter((sku) => !bySku.has(sku));
if (missingTargets.length) throw new Error(`Sanity is missing ${missingTargets.length} mapped Cleaver SKUs; first=${missingTargets.slice(0, 12).join(",")}`);

let published = 0;
const publishFailures = [];
await pooled([...candidates.values()], 5, async (candidate) => {
  const target = bySku.get(candidate.sku);
  try {
    await client.patch(target._id).set({
      sourceUrl: candidate.sourceUrl,
      cleaverSourceSectionsMigratedAt: new Date().toISOString(),
      overviewHtml: candidate.overviewHtml || "",
      specRows: candidate.specRows,
      docs: candidate.docs,
      cleaverIncludedItems: candidate.includedItems,
      cleaverVariations: candidate.variations,
      cleaverAccessories: candidate.accessories,
      cleaverWorksWith: candidate.worksWith,
      cleaverVideos: candidate.videos,
      cleaverAtAGlance: candidate.atAGlance,
      cleaverSourceSectionOrder: candidate.sectionOrder,
      cleaverExtraSections: candidate.extraSections,
    }).commit({ visibility: "sync" });
    published += 1;
    if (published <= 5 || published % 100 === 0 || published === candidates.size) console.log(`[Cleaver source truth] published ${published}/${candidates.size}: ${candidate.sku}`);
  } catch (error) {
    publishFailures.push({ sku: candidate.sku, error: error instanceof Error ? error.message : String(error) });
  }
});
if (publishFailures.length) throw new Error(`Source-truth publish failed for ${publishFailures.length} SKUs: ${JSON.stringify(publishFailures.slice(0, 12))}`);

const after = await client.fetch(`*[_type == "product" && migrationKey == $key]{sku,overviewHtml,specRows,docs,cleaverIncludedItems,cleaverVariations,cleaverAccessories,cleaverWorksWith,cleaverVideos,cleaverAtAGlance,cleaverSourceSectionOrder,cleaverExtraSections}`, { key: MIGRATION_KEY });
const afterBySku = new Map((after || []).map((row) => [normalizeSku(row.sku), row]));
const mismatches = [];
const count = (value) => Array.isArray(value) ? value.length : 0;
for (const [sku, candidate] of candidates) {
  const actual = afterBySku.get(sku);
  if (!actual) { mismatches.push({ sku, field: "document", expected: "present", actual: "missing" }); continue; }
  const checks = [
    ["overviewHtml", Boolean(candidate.overviewHtml), Boolean(actual.overviewHtml)], ["specRows", candidate.specRows.length, count(actual.specRows)],
    ["docs", candidate.docs.length, count(actual.docs)], ["included", candidate.includedItems.length, count(actual.cleaverIncludedItems)],
    ["variations", candidate.variations.length, count(actual.cleaverVariations)], ["accessories", candidate.accessories.length, count(actual.cleaverAccessories)],
    ["worksWith", candidate.worksWith.length, count(actual.cleaverWorksWith)], ["videos", candidate.videos.length, count(actual.cleaverVideos)],
    ["atAGlance", candidate.atAGlance.length, count(actual.cleaverAtAGlance)], ["sectionOrder", candidate.sectionOrder.length, count(actual.cleaverSourceSectionOrder)],
    ["extraSections", candidate.extraSections.length, count(actual.cleaverExtraSections)],
  ];
  for (const [field, expected, actualValue] of checks) if (expected !== actualValue) mismatches.push({ sku, field, expected, actual: actualValue });
  const expectedDocUrls = candidate.docs.map((item) => item.url).sort().join("|");
  const actualDocUrls = (actual.docs || []).map((item) => item.url).sort().join("|");
  if (expectedDocUrls !== actualDocUrls) mismatches.push({ sku, field: "docUrls", expected: expectedDocUrls, actual: actualDocUrls });
}
console.log(JSON.stringify({ published, verified: candidates.size - new Set(mismatches.map((item) => item.sku)).size, mismatchCount: mismatches.length, firstMismatches: mismatches.slice(0, 20) }));
if (mismatches.length) throw new Error(`Post-publish source-truth verification failed with ${mismatches.length} mismatches.`);
