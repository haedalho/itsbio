#!/usr/bin/env node

import * as cheerio from "cheerio";
import { createClient } from "next-sanity";

const VERSION = "2026-08-09-search-v5";
const projectId = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const dataset = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const apiVersion = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const client = createClient({ projectId, dataset, apiVersion, useCdn: false });
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const lower = (value) => clean(value).toLowerCase();
const PLACEHOLDER = "This item is in the authoritative ABM inventory";
const VISIBLE_NOT_FOUND_RE = /(?:Oops! The page you are looking for can't be found\.|404\s*[-–—:]?\s*Page Not Found)/i;

function visibleText(html) {
  const $ = cheerio.load(String(html || ""));
  $("script,style,noscript,template,svg").remove();
  return clean($("body").text() || $.root().text());
}

function sample(rows, count) {
  if (rows.length <= count) return [...rows];
  const sorted = [...rows].sort((a, b) => lower(a?.sku || a?.url).localeCompare(lower(b?.sku || b?.url)));
  const out = [];
  const seen = new Set();
  for (let i = 0; i < count; i += 1) {
    const index = Math.min(sorted.length - 1, Math.floor((i * (sorted.length - 1)) / Math.max(1, count - 1)));
    const row = sorted[index];
    const key = lower(row?.sku || row?.url);
    if (key && !seen.has(key)) { seen.add(key); out.push(row); }
  }
  return out;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

const data = await client.fetch(`{
  "products": *[_type == "abmRebuildChunk" && version == $version && kind == "product"].records[]{sku,title,url},
  "services": *[_type == "abmRebuildChunk" && version == $version && kind == "service"].records[]{sku,title,url},
  "landings": *[_type == "abmRebuildLandingChunk" && version == $version && kind == "service"].records[]{pathKey,title}
}`, { version: VERSION });

const products = sample(data.products || [], 100);
for (const sku of ["G265", "TM205", "Y021101"]) {
  const row = (data.products || []).find((item) => lower(item?.sku) === lower(sku));
  if (row && !products.some((item) => lower(item?.sku || item?.url) === lower(row?.sku || row?.url))) products.push(row);
}
const services = sample(data.services || [], 40);
for (const sku of ["C144", "C151", "C152", "C153", "C154", "C155", "C156", "C157", "C192", "C193", "C314", "HC004", "HC005", "HC006", "HC009", "MultiplexMinCharge", "LV001-b", "LV001-c", "LV001-d", "LV001-e"]) {
  const row = (data.services || []).find((item) => lower(item?.sku) === lower(sku));
  if (row && !services.some((item) => lower(item?.sku || item?.url) === lower(row?.sku || row?.url))) services.push(row);
}

const targets = [
  ...products.map((row) => ({
    kind: "product",
    key: clean(row.sku || row.url),
    expectedSku: clean(row.sku),
    expectedTitle: clean(row.title),
    url: `https://itsbio.vercel.app/products/abm/staged/product/${encodeURIComponent(clean(row.sku || row.url))}`,
  })),
  ...services.map((row) => ({
    kind: "service",
    key: clean(row.sku || row.url),
    expectedSku: clean(row.sku),
    expectedTitle: clean(row.title),
    url: `https://itsbio.vercel.app/products/abm/staged/service/${encodeURIComponent(clean(row.sku || row.url))}`,
  })),
  ...(data.landings || []).map((row) => ({
    kind: "landing",
    key: clean(row.pathKey),
    expectedSku: "",
    expectedTitle: clean(row.title),
    url: `https://itsbio.vercel.app/products/abm/services/${clean(row.pathKey)}`,
  })),
];

const results = await mapLimit(targets, 8, async (target, i) => {
  if (i % 40 === 0) console.log(`[production-render] ${i}/${targets.length}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${target.url}?qa=${Date.now()}-${i}`, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "cache-control": "no-cache", "user-agent": "ITSBIO-ABM-Production-Audit/1.0" },
    });
    const html = await response.text();
    const text = visibleText(html);
    const defects = [];
    if (!response.ok) defects.push(`HTTP ${response.status}`);
    if (text.includes(PLACEHOLDER)) defects.push("migration-placeholder-visible");
    if (VISIBLE_NOT_FOUND_RE.test(text)) defects.push("page-not-found-visible");
    if (target.expectedSku && !lower(text).includes(lower(target.expectedSku))) defects.push("sku-not-visible");
    if (target.expectedTitle && !lower(text).includes(lower(target.expectedTitle))) defects.push("title-not-visible");
    if (target.kind === "landing" && text.length < 100) defects.push("landing-visible-text-too-short");
    return { ...target, status: response.status, visibleTextLength: text.length, defects };
  } catch (error) {
    return { ...target, status: 0, visibleTextLength: 0, defects: [error?.message || String(error)] };
  } finally {
    clearTimeout(timeout);
  }
});

const failures = results.filter((row) => row.defects.length);
console.log(JSON.stringify({
  products: products.length,
  services: services.length,
  landings: (data.landings || []).length,
  total: results.length,
  failures: failures.length,
  failureRows: failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
