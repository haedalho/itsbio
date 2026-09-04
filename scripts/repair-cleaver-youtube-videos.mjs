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
if (!token) throw new Error("Cleaver video repair requires a Production Sanity write token.");

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

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

function youtubeEmbedUrl(raw) {
  if (!raw) return "";
  let value = String(raw).replace(/&amp;/g, "&").replace(/[.,;]+$/, "");
  try { value = decodeURIComponent(value); } catch {}
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/embed/")[1]?.split("/")[0] || "";
      else if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/shorts/")[1]?.split("/")[0] || "";
      else if (url.pathname.startsWith("/live/")) id = url.pathname.split("/live/")[1]?.split("/")[0] || "";
      else id = url.searchParams.get("v") || "";
    }
    return /^[A-Za-z0-9_-]{6,}$/.test(id) ? `https://www.youtube.com/embed/${id}` : "";
  } catch {
    return "";
  }
}

function vimeoEmbedUrl(raw) {
  try {
    const url = new URL(String(raw || ""));
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return "";
    const id = url.pathname.split("/").filter(Boolean).findLast((part) => /^\d+$/.test(part));
    return id ? `https://player.vimeo.com/video/${id}` : "";
  } catch {
    return "";
  }
}

function extractVideos(markdown) {
  const urls = new Set();
  const source = String(markdown || "");
  for (const match of source.matchAll(/https?:\/\/[^\s<>()\]"']+/gi)) {
    urls.add(match[0].replace(/&amp;/g, "&").replace(/[.,;]+$/, ""));
  }
  const videos = new Map();
  for (const url of urls) {
    const yt = youtubeEmbedUrl(url);
    const vm = vimeoEmbedUrl(url);
    const direct = /\.(?:mp4|webm)(?:$|\?)/i.test(url) ? url : "";
    const embedUrl = yt || vm;
    if (!embedUrl && !direct) continue;
    const key = embedUrl || direct;
    videos.set(key, {
      _key: hash(`video:${key}`).slice(0, 12),
      title: "Product video",
      url,
      embedUrl,
    });
  }
  return [...videos.values()].slice(0, 12);
}

async function reader(sourceUrl) {
  const url = new URL(sourceUrl);
  if (!SOURCE_HOSTS.has(url.hostname)) throw new Error(`Unapproved source host: ${url.hostname}`);
  let lastStatus = 0;
  let lastLength = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(`${READER}${sourceUrl}`, {
        headers: { Accept: "text/plain,text/markdown;q=0.9,*/*;q=0.8", "User-Agent": "ITS-BIO-CleaverVideoRepair/1.0" },
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

const missing = await client.fetch(`*[_type == "product" && migrationKey == $key && defined(sourceUrl) && (!defined(cleaverVideos) || count(cleaverVideos) == 0)]{_id,sku,sourceUrl}`, { key: MIGRATION_KEY });
const bySource = new Map();
for (const product of missing || []) {
  const sourceUrl = normalizeSourceUrl(product.sourceUrl);
  if (!sourceUrl) continue;
  const list = bySource.get(sourceUrl) || [];
  list.push(product);
  bySource.set(sourceUrl, list);
}

let familiesRead = 0;
let familiesWithVideo = 0;
let productsPatched = 0;
let patchFailures = 0;
const readerFailures = [];

await pooled([...bySource.entries()], 4, async ([sourceUrl, products]) => {
  try {
    const markdown = await reader(sourceUrl);
    familiesRead += 1;
    const videos = extractVideos(markdown);
    if (!videos.length) return;
    familiesWithVideo += 1;
    await Promise.all(products.map(async (product) => {
      try {
        await client.patch(product._id).set({ cleaverVideos: videos, cleaverSourceSectionsMigratedAt: new Date().toISOString() }).commit({ visibility: "async" });
        productsPatched += 1;
      } catch (error) {
        patchFailures += 1;
        console.warn(`[Cleaver video repair] patch ${product.sku}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }));
  } catch (error) {
    readerFailures.push({ sourceUrl, error: error instanceof Error ? error.message : String(error) });
  }
});

const totals = await client.fetch(`{
  "products": count(*[_type == "product" && migrationKey == $key]),
  "videos": count(*[_type == "product" && migrationKey == $key && count(cleaverVideos) > 0]),
  "missingWithSource": count(*[_type == "product" && migrationKey == $key && defined(sourceUrl) && (!defined(cleaverVideos) || count(cleaverVideos) == 0)])
}`, { key: MIGRATION_KEY });

console.log(JSON.stringify({
  missingBefore: missing.length,
  sourceFamiliesChecked: bySource.size,
  familiesRead,
  familiesWithVideo,
  productsPatched,
  patchFailures,
  readerFailures: readerFailures.length,
  firstReaderFailures: readerFailures.slice(0, 8),
  totals,
}));

if (patchFailures > 10) throw new Error(`Cleaver video repair had too many patch failures: ${patchFailures}`);
