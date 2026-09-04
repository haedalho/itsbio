#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");

const MIGRATION_KEY = "cleaver-products-2026-08-24";
const READER = "https://r.jina.ai/";
const VERIFY_FIXTURE = process.argv.includes("--verify-fixture");
const APPROVED_HOSTS = new Set(["www.thistlescientific.com", "thistlescientific.com"]);
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");
const oneLine = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const normalizeSku = (value) => oneLine(value).normalize("NFKC").toUpperCase();

const sourceMap = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-source-map.json"), "utf8"));
function htmlEscape(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function stripMarkdown(value) {
  return oneLine(String(value || "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#|]/g, " "));
}

function cleanTitle(value) {
  return oneLine(value).replace(/\s*\+\s*$/, "").replace(/^#+\s*/, "").trim();
}

function titleKey(value) {
  return cleanTitle(value).toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");
}

const KNOWN = new Set([
  "overview",
  "specifications",
  "what's included",
  "video",
  "videos",
  "documents",
  "all variations",
  "accessories",
  "works with",
]);

const TARGET_WORKS_WITH_FIXTURE = "https://www.thistlescientific.com/product/multisub-mini-7cm-uv-gel-scoop/";
const TARGET_WORKS_WITH_TITLES = [
  "multiSUB Mini DUO with mini runVIEW gel viewer",
  "multiSUB Mini, Mini Horizontal Electrophoresis System",
];

async function readSource(sourceUrl) {
  const parsed = new URL(sourceUrl);
  if (!APPROVED_HOSTS.has(parsed.hostname)) throw new Error(`Unapproved source host: ${parsed.hostname}`);
  let lastStatus = 0;
  let lastLength = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(`${READER}${sourceUrl}`, {
        headers: { Accept: "text/plain,text/markdown;q=0.9,*/*;q=0.8", "User-Agent": "ITS-BIO-CleaverFidelity/1.1" },
        redirect: "follow",
        signal: AbortSignal.timeout(60_000),
      });
      const text = await response.text();
      lastStatus = response.status;
      lastLength = text.length;
      if (response.ok && text.length > 250) return text;
      if (![429, 500, 502, 503, 504].includes(response.status)) break;
    } catch {
      // Retry transient source/reader errors.
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(20_000, 1400 * (2 ** attempt))));
  }
  throw new Error(`reader unavailable status=${lastStatus} bytes=${lastLength}`);
}

function extractAtAGlance(markdown) {
  const lines = String(markdown || "").replace(/\r/g, "").split("\n");
  let start = lines.findIndex((line) => /^\s*(?:#{1,6}\s*)?at\s+a\s+glance\s*$/i.test(stripMarkdown(line)));
  if (start < 0) start = lines.findIndex((line) => /\bat\s+a\s+glance\b/i.test(stripMarkdown(line)));
  if (start < 0) return [];

  const items = [];
  const seen = new Set();
  const add = (raw) => {
    const text = stripMarkdown(raw)
      .replace(/^[-*+•]\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .replace(/^Image:\s*/i, "")
      .trim();
    if (!text || text.length < 3 || text.length > 500) return;
    if (/^(?:item|choose an option|select|order now|add to quote|in stock|sku\s*:|qty\s*:|poa|£)/i.test(text)) return;
    const itemKey = text.toLowerCase();
    if (seen.has(itemKey)) return;
    seen.add(itemKey);
    items.push(text);
  };

  for (let index = start + 1; index < Math.min(lines.length, start + 80); index += 1) {
    const raw = lines[index];
    const plain = stripMarkdown(raw);
    if (!plain) continue;
    if (/^#{2,6}\s+.+/i.test(raw) && /overview|specifications|documents|what's included|video|all variations|accessories/i.test(plain)) break;
    if (/^(?:overview|specifications|documents|what's included|video|all variations|accessories)\s*\+?$/i.test(plain)) break;
    if (/^item$/i.test(plain) || /^choose an option$/i.test(plain)) break;
    if (/^(?:£\s*[\d,.]+|poa\b)/i.test(plain)) break;
    add(raw);
  }

  return items.slice(0, 20);
}

function extractAccordionSections(markdown) {
  const source = String(markdown || "").replace(/\r/g, "");
  const headings = [...source.matchAll(/^(#{2,6})\s+(.+?)\s*$/gm)].map((match) => ({
    index: match.index,
    end: match.index + match[0].length,
    level: match[1].length,
    rawTitle: match[2],
  }));
  const matches = headings.filter((heading) => /\+\s*$/.test(heading.rawTitle));
  const sections = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const title = cleanTitle(current.rawTitle);
    if (!title) continue;
    const from = current.end;
    const boundary = headings.find((heading) => heading.index >= from && heading.level <= current.level);
    const to = boundary?.index ?? source.length;
    sections.push({ title, body: source.slice(from, to).trim() });
  }
  return sections;
}

function packText(value) {
  return oneLine(value).match(/\b\d+\s*\/\s*(?:Each|Pack|Box|Case|Kit|Unit|Set|Pair)\b/i)?.[0] || "";
}

function priceText(value) {
  return oneLine(value).match(/£\s*[\d,.]+(?:\s*[–-]\s*£?\s*[\d,.]+)?(?:\s*(?:ex\.?\s*VAT|inc\.?\s*VAT))?/i)?.[0] || "";
}

function normalizeSourceUrl(value) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}/`;
  } catch {
    return "";
  }
}

const identityBySourceUrl = new Map();
for (const [sku, identity] of Object.entries(sourceMap || {})) {
  const sourceUrl = normalizeSourceUrl(identity?.sourceUrl);
  if (sourceUrl && !identityBySourceUrl.has(sourceUrl)) identityBySourceUrl.set(sourceUrl, { sku, ...identity });
}

function extractWorksWith(body) {
  const items = new Map();
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/(?:www\.)?thistlescientific\.com\/product\/[^)]+)\)/gi;
  for (const match of String(body || "").matchAll(linkPattern)) {
    const title = stripMarkdown(match[1]);
    if (!title || /^(?:view product|add to basket|image:)/i.test(title)) continue;
    const sourceUrl = normalizeSourceUrl(match[2]);
    if (!sourceUrl || items.has(sourceUrl)) continue;
    const identity = identityBySourceUrl.get(sourceUrl);
    const context = String(body || "").slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 400);
    const sourceSlug = new URL(sourceUrl).pathname.split("/").filter(Boolean).at(-1) || "";
    items.set(sourceUrl, {
      _key: hash(`works-with:${sourceUrl}`).slice(0, 12),
      title: title.slice(0, 180),
      sku: identity?.sku || "",
      packSize: packText(context),
      priceText: priceText(context),
      sourceUrl,
      imageUrl: String(identity?.images?.[0] || ""),
      internalHref: sourceSlug ? `/products/cleaver/item/${sourceSlug}` : "",
    });
  }
  return [...items.values()].slice(0, 60);
}

function simpleHtml(markdown) {
  const lines = String(markdown || "").split("\n");
  const html = [];
  let list = [];
  const flushList = () => {
    if (!list.length) return;
    html.push(`<ul>${list.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || /^\[?(?:input|button)\b/i.test(line)) {
      flushList();
      continue;
    }
    if (/^!\[/.test(line) || /^Image:/i.test(stripMarkdown(line))) continue;
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    if (bullet) {
      const text = stripMarkdown(bullet[1]);
      if (text) list.push(text);
      continue;
    }
    flushList();
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      const text = stripMarkdown(heading[1]);
      if (text) html.push(`<h3>${htmlEscape(text)}</h3>`);
      continue;
    }
    const text = stripMarkdown(line);
    if (!text || /^(?:price|qty|add to basket|add to quote|order now)$/i.test(text)) continue;
    html.push(`<p>${htmlEscape(text)}</p>`);
  }
  flushList();
  return html.join("\n").slice(0, 30_000);
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

if (VERIFY_FIXTURE) {
  const markdown = await readSource(TARGET_WORKS_WITH_FIXTURE);
  const sections = extractAccordionSections(markdown);
  const worksWithSection = sections.find((item) => titleKey(item.title) === "works with");
  const worksWith = worksWithSection ? extractWorksWith(worksWithSection.body) : [];
  const actual = worksWith.map((item) => titleKey(item.title));
  const expected = TARGET_WORKS_WITH_TITLES.map(titleKey);
  if (actual.length !== expected.length || expected.some((title) => !actual.includes(title))) {
    throw new Error(`Works With fixture mismatch: ${JSON.stringify(worksWith.map((item) => item.title))}`);
  }
  if (/related products|stay curious|head office|newsletter signup/i.test(worksWithSection?.body || "")) {
    throw new Error("Works With fixture includes content beyond its manufacturer accordion boundary.");
  }
  console.log(JSON.stringify({ sourceUrl: TARGET_WORKS_WITH_FIXTURE, worksWith }));
  process.exit(0);
}

const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim()).find(Boolean);
if (!token) throw new Error("Cleaver source fidelity repair requires a Production Sanity write token.");

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
  const list = families.get(sourceUrl) || [];
  list.push(product);
  families.set(sourceUrl, list);
}

let familiesRead = 0;
let familiesWithAtAGlance = 0;
let familiesWithWorksWith = 0;
let productsPatched = 0;
let patchFailures = 0;
const readerFailures = [];
const unknownSectionCounts = new Map();
const samples = [];
let targetWorksWithVerified = false;

await pooled([...families.entries()], 4, async ([sourceUrl, familyProducts]) => {
  try {
    const markdown = await readSource(sourceUrl);
    familiesRead += 1;
    const atAGlance = extractAtAGlance(markdown);
    if (atAGlance.length) familiesWithAtAGlance += 1;
    const sourceSections = extractAccordionSections(markdown);
    const sourceSectionOrder = sourceSections.map((item) => item.title);
    const worksWithSection = sourceSections.find((item) => titleKey(item.title) === "works with");
    const worksWith = worksWithSection ? extractWorksWith(worksWithSection.body) : [];
    if (worksWith.length) familiesWithWorksWith += 1;
    const extraSections = sourceSections
      .filter((item) => !KNOWN.has(titleKey(item.title)))
      .map((item) => ({
        _key: hash(`${sourceUrl}:${item.title}`).slice(0, 12),
        title: item.title,
        html: simpleHtml(item.body),
      }));

    if (extraSections.some((section) => /related products|stay curious|head office|newsletter signup/i.test(section.html))) {
      throw new Error(`Accordion boundary leak detected for ${sourceUrl}`);
    }
    if (normalizeSourceUrl(sourceUrl) === TARGET_WORKS_WITH_FIXTURE) {
      const actual = worksWith.map((item) => titleKey(item.title));
      const expected = TARGET_WORKS_WITH_TITLES.map(titleKey);
      if (actual.length !== expected.length || expected.some((title) => !actual.includes(title))) {
        throw new Error(`Works With fixture mismatch: ${JSON.stringify(worksWith.map((item) => item.title))}`);
      }
      targetWorksWithVerified = true;
    }

    for (const section of extraSections) unknownSectionCounts.set(section.title, (unknownSectionCounts.get(section.title) || 0) + 1);

    for (const product of familyProducts) {
      const patch = {
        cleaverAtAGlance: atAGlance,
        cleaverSourceSectionOrder: sourceSectionOrder,
        cleaverExtraSections: extraSections,
        cleaverWorksWith: worksWith,
        cleaverSourceSectionsMigratedAt: new Date().toISOString(),
      };
      try {
        await client.patch(product._id).set(patch).commit({ visibility: "async" });
        productsPatched += 1;
        if (samples.length < 8 && atAGlance.length) samples.push({ sku: product.sku, atAGlance: atAGlance.slice(0, 3), sectionOrder: sourceSectionOrder });
      } catch (error) {
        patchFailures += 1;
        console.warn(`[Cleaver fidelity] patch ${product.sku}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    readerFailures.push({ sourceUrl, error: error instanceof Error ? error.message : String(error) });
  }
});

const totals = await client.fetch(`{
  "products": count(*[_type == "product" && migrationKey == $key]),
  "atAGlance": count(*[_type == "product" && migrationKey == $key && count(cleaverAtAGlance) > 0]),
  "sourceOrder": count(*[_type == "product" && migrationKey == $key && count(cleaverSourceSectionOrder) > 0]),
  "extraSections": count(*[_type == "product" && migrationKey == $key && count(cleaverExtraSections) > 0]),
  "worksWith": count(*[_type == "product" && migrationKey == $key && count(cleaverWorksWith) > 0])
}`, { key: MIGRATION_KEY });

console.log(JSON.stringify({
  sourceFamilies: families.size,
  familiesRead,
  familiesWithAtAGlance,
  familiesWithWorksWith,
  productsPatched,
  patchFailures,
  readerFailures: readerFailures.length,
  firstReaderFailures: readerFailures.slice(0, 10),
  unknownSections: [...unknownSectionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30),
  samples,
  totals,
}));

if (!targetWorksWithVerified) throw new Error("Required MS7-UVS Works With fixture was not verified.");
if (patchFailures > Math.max(10, productsPatched * 0.03)) throw new Error(`Cleaver fidelity patch failures too high: ${patchFailures}`);
