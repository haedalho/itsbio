#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseAbmRebuildDetailV2 } from "../lib/abm/rebuild-parser-v2.mjs";

const CATALOG_FILE = path.resolve("data/abm-stable-cell-catalog.json");
const OUT_DIR = path.resolve(".cache/abm-stable-gallery-audit");
const EXPECTED = 1102;
const WORKERS = Math.max(1, Math.min(6, Number(process.env.STABLE_GALLERY_AUDIT_WORKERS || 4) || 4));
const GAP_MS = Math.max(100, Number(process.env.STABLE_GALLERY_AUDIT_GAP_MS || 250) || 250);
const USER_AGENT = "Mozilla/5.0 (compatible; ITSBIO-StableGalleryAudit/1.0)";

const clean = (v) => String(v || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
if (!Array.isArray(catalog.products) || catalog.products.length !== EXPECTED) {
  throw new Error(`Expected ${EXPECTED} Stable products, got ${catalog.products?.length || 0}`);
}

function officialImageUrl(value, baseUrl) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const u = new URL(raw, baseUrl);
    const host = u.hostname.toLowerCase();
    if (host !== "abmgood.com" && !host.endsWith(".abmgood.com")) return "";
    if (!["http:", "https:"].includes(u.protocol)) return "";
    if (!/\/assets\/product\//i.test(u.pathname)) return "";
    u.protocol = "https:";
    u.hash = "";
    return u.toString();
  } catch { return ""; }
}

async function fetchHtml(url) {
  let last;
  for (let attempt = 1; attempt <= 7; attempt++) {
    await sleep(GAP_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40_000);
    try {
      const r = await fetch(url, {
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml", "accept-language": "en-US,en;q=0.9" },
      });
      clearTimeout(timer);
      if (r.status === 429 || r.status === 408 || r.status >= 500) {
        last = new Error(`HTTP ${r.status}`);
        await sleep(Math.max(Number(r.headers.get("retry-after") || 0) * 1000, 1200 * attempt));
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { html: await r.text(), finalUrl: r.url || url };
    } catch (e) {
      clearTimeout(timer);
      last = e;
      if (attempt < 7) await sleep(1000 * attempt);
    }
  }
  throw last;
}

async function inspect(product, index) {
  const sku = clean(product.sku);
  const sourceUrl = clean(product.sourceUrl);
  try {
    const { html, finalUrl } = await fetchHtml(sourceUrl);
    const detail = parseAbmRebuildDetailV2(html, finalUrl, {
      sku,
      title: clean(product.title),
      url: sourceUrl,
      unit: clean(product.unit),
      kind: "product",
    });
    const images = [...new Set((Array.isArray(detail.images) ? detail.images : [])
      .map((u) => officialImageUrl(u, finalUrl)).filter(Boolean))];
    if ((index + 1) % 50 === 0) console.log(`[stable gallery audit] ${index + 1}/${EXPECTED}`);
    return { sku, title: clean(product.title), sourceUrl, images, count: images.length, status: "ok" };
  } catch (e) {
    return { sku, title: clean(product.title), sourceUrl, images: [], count: 0, status: "error", error: String(e?.stack || e) };
  }
}

async function pool(items, workers, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: workers }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const rows = await pool(catalog.products, WORKERS, inspect);
const errors = rows.filter((r) => r.status !== "ok");
const distribution = {};
for (const row of rows.filter((r) => r.status === "ok")) distribution[row.count] = (distribution[row.count] || 0) + 1;
const multi = rows.filter((r) => r.status === "ok" && r.count > 1).sort((a, b) => b.count - a.count || a.sku.localeCompare(b.sku));
const maxCount = Math.max(...rows.filter((r) => r.status === "ok").map((r) => r.count), 0);
const totalImages = rows.reduce((n, r) => n + r.count, 0);
const summary = {
  products: rows.length,
  ok: rows.length - errors.length,
  errors: errors.length,
  totalOfficialGalleryImages: totalImages,
  productsWithMultipleImages: multi.length,
  maxImagesPerProduct: maxCount,
  distribution,
  suspiciousOver12: rows.filter((r) => r.count > 12).map((r) => ({ sku: r.sku, count: r.count })),
};
fs.writeFileSync(path.join(OUT_DIR, "rows.json"), JSON.stringify(rows, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "multi-image-products.json"), JSON.stringify(multi, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log("Top multi-image products:");
multi.slice(0, 40).forEach((r) => console.log(`${r.sku}\t${r.count}\t${r.title}`));
if (errors.length) {
  console.error("Fetch/parse errors:", errors.slice(0, 20).map((r) => ({ sku: r.sku, error: r.error })));
  throw new Error(`Stable gallery audit failed for ${errors.length} products`);
}
if (rows.some((r) => r.count < 1)) throw new Error(`Stable gallery audit found products without official gallery images`);
if (summary.suspiciousOver12.length) throw new Error(`Stable gallery audit found suspicious products with >12 images`);
