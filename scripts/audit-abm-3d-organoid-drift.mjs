#!/usr/bin/env node
import crypto from "node:crypto";
import { createClient } from "next-sanity";
import * as cheerio from "cheerio";

const VERSION = "2026-08-09-search-v5";
const PROJECT_ID = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const DATASET = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const API_VERSION = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const token = [
  process.env.SANITY_WRITE_TOKEN,
  process.env.SANITY_API_WRITE_TOKEN,
  process.env.SANITY_API_TOKEN,
  process.env.SANITY_TOKEN,
  process.env.SANITY_AUTH_TOKEN,
].map((value) => String(value || "").trim()).find(Boolean) || undefined;

const client = createClient({ projectId: PROJECT_ID, dataset: DATASET, apiVersion: API_VERSION, token, useCdn: false });

const OFFICIAL_URLS = [
  "https://www.abmgood.com/3DCelMatrix.html",
  "https://www.abmgood.com/3d-organoid-services.html",
];
const MARKERS = [
  "Early Adopter Pricing",
  "3DCelMatrix™ ECM Solution Product Highlights",
  "Flexible ECM Workflows for Thin Gel, Thick Gel, and Coating Applications",
  "Simple 5-Step 3D Cell Culture Workflow",
  "3D Cell Culture Applications",
  "3DCelMatrix™ Technical Specifications",
  "Representative Organoid, Spheroid, and iPSC Culture Results",
  "Related Products for 3D Cell Culture Workflows",
  "Frequently Asked Questions About 3DCelMatrix™",
  "Your research, in 3D. Custom organoid models built around your science.",
  "Comprehensive support from start to finish",
];

const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
function textFromHtml(html) {
  const $ = cheerio.load(String(html || ""), { decodeEntities: false });
  $("script,style,noscript,svg").remove();
  return clean($.root().text());
}
function digest(value) { return crypto.createHash("sha256").update(String(value || "")).digest("hex"); }
function markerMap(text) {
  const normalized = clean(text).toLowerCase();
  return Object.fromEntries(MARKERS.map((marker) => [marker, normalized.includes(clean(marker).toLowerCase())]));
}
function metaDates(html) {
  const $ = cheerio.load(String(html || ""), { decodeEntities: false });
  const values = [];
  $("meta").each((_, el) => {
    const name = clean($(el).attr("name") || $(el).attr("property")).toLowerCase();
    const content = clean($(el).attr("content"));
    if (content && /(modified|published|date|updated)/i.test(name)) values.push({ name, content });
  });
  $("script[type='application/ld+json']").each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object") continue;
        for (const [key, value] of Object.entries(item)) {
          if (/^(dateModified|datePublished|uploadDate)$/i.test(key) && value) values.push({ name: key, content: clean(value) });
          if (value && typeof value === "object") queue.push(...(Array.isArray(value) ? value : [value]));
        }
      }
    } catch {}
  });
  return values;
}
async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(url, {
      redirect: "follow", cache: "no-store", signal: controller.signal,
      headers: { accept: "text/html,application/xhtml+xml", "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-DriftAudit/1.0)" },
    });
    const html = await response.text();
    const text = textFromHtml(html);
    return {
      requestedUrl: url, status: response.status, finalUrl: response.url || url,
      lastModified: response.headers.get("last-modified"), etag: response.headers.get("etag"),
      contentLength: response.headers.get("content-length"), htmlSha256: digest(html), textSha256: digest(text),
      htmlLength: html.length, textLength: text.length, metaDates: metaDates(html), markers: markerMap(text), textStart: text.slice(0, 3500),
    };
  } finally { clearTimeout(timer); }
}

const docs = await client.fetch(`*[_type == "abmRebuildLandingChunk" && version == $version]{_id,kind,records[]{pathKey,title,sourceUrl,collectedAt,html,images}}`, { version: VERSION });
const candidates = [];
for (const doc of docs || []) {
  for (const record of doc.records || []) {
    const identity = [record.pathKey, record.title, record.sourceUrl].map((value) => clean(value).toLowerCase()).join(" ");
    if (!/(3dcelmatrix|3d[ -]?and[ -]?organoid|3d[ -]?organoid)/i.test(identity)) continue;
    candidates.push({ docId: doc._id, kind: doc.kind, ...record, imageCount: Array.isArray(record.images) ? record.images.length : 0, storedText: textFromHtml(record.html) });
  }
}

console.log("===== SANITY LANDING CANDIDATES =====");
console.log(JSON.stringify(candidates.map((row) => ({
  docId: row.docId, kind: row.kind, pathKey: row.pathKey, title: row.title, sourceUrl: row.sourceUrl,
  collectedAt: row.collectedAt, imageCount: row.imageCount, htmlSha256: digest(row.html), textSha256: digest(row.storedText),
  storedTextLength: row.storedText.length, markers: markerMap(row.storedText), textStart: row.storedText.slice(0, 2500),
})), null, 2));

const detailMatches = await client.fetch(`*[
  _type == "abmRebuildDetailChunk" && version == $version
]{_id,kind,"matches":records[
  sku == "TM076" || sku == "tm076" || title match "*3DCelMatrix*" || sourceUrl match "*3DCelMatrix*"
]{sku,key,title,sourceUrl,collectedAt,images,previewImage,overviewHtml,specificationsHtml}}[count(matches) > 0]`, { version: VERSION });
console.log("===== SANITY DETAIL / TM076 MATCHES =====");
console.log(JSON.stringify((detailMatches || []).map((doc) => ({
  docId: doc._id,
  kind: doc.kind,
  matches: (doc.matches || []).map((row) => ({
    sku: row.sku, key: row.key, title: row.title, sourceUrl: row.sourceUrl, collectedAt: row.collectedAt,
    imageCount: Array.isArray(row.images) ? row.images.length : 0, previewImage: row.previewImage,
    overviewText: textFromHtml(row.overviewHtml).slice(0, 1000), specificationsText: textFromHtml(row.specificationsHtml).slice(0, 1000),
  })),
})), null, 2));

console.log("===== CURRENT OFFICIAL =====");
const official = [];
for (const url of OFFICIAL_URLS) {
  try { const page = await fetchPage(url); official.push(page); console.log(JSON.stringify(page, null, 2)); }
  catch (error) { console.log(JSON.stringify({ requestedUrl: url, error: String(error?.stack || error) }, null, 2)); }
}

console.log("===== PRODUCTION ROUTES =====");
for (const row of candidates) {
  const path = clean(row.pathKey).replace(/^\/+|\/+$/g, "");
  if (!path) continue;
  const routeCandidates = row.kind === "service"
    ? [`https://itsbio.vercel.app/products/abm/services/${path}`, `https://itsbio.vercel.app/products/abm/${path}`]
    : [`https://itsbio.vercel.app/products/abm/${path}`, `https://itsbio.vercel.app/products/abm/services/${path}`];
  for (const url of routeCandidates) {
    try {
      const page = await fetchPage(url);
      console.log(JSON.stringify({ pathKey: row.pathKey, kind: row.kind, ...page }, null, 2));
      if (page.status >= 200 && page.status < 400 && !/404|not found/i.test(page.textStart)) break;
    } catch (error) { console.log(JSON.stringify({ pathKey: row.pathKey, url, error: String(error?.stack || error) }, null, 2)); }
  }
}
for (const url of [
  "https://itsbio.vercel.app/products/abm/staged/product/TM076",
  "https://itsbio.vercel.app/products/abm/cellular-materials/3d-and-organoid",
  "https://itsbio.vercel.app/products/abm/cellular-materials/3d-organoid",
]) {
  try {
    const page = await fetchPage(url);
    console.log(JSON.stringify({ specialProbe: true, ...page }, null, 2));
  } catch (error) { console.log(JSON.stringify({ specialProbe: true, url, error: String(error?.stack || error) }, null, 2)); }
}

console.log("===== COMPARISON SUMMARY =====");
for (const row of candidates) {
  const sourcePath = (() => { try { return new URL(row.sourceUrl).pathname.toLowerCase(); } catch { return ""; } })();
  const matchingOfficial = official.find((page) => { try { return new URL(page.finalUrl).pathname.toLowerCase() === sourcePath; } catch { return false; } });
  console.log(JSON.stringify({
    pathKey: row.pathKey, title: row.title, sourceUrl: row.sourceUrl, collectedAt: row.collectedAt,
    sourceMatches3DCelMatrix: sourcePath === "/3dcelmatrix.html", storedMarkers: markerMap(row.storedText),
    currentOfficialMarkers: matchingOfficial?.markers || null,
    sameTextHashAsCurrentOfficial: matchingOfficial ? digest(row.storedText) === matchingOfficial.textSha256 : null,
    storedTextLength: row.storedText.length, currentOfficialTextLength: matchingOfficial?.textLength ?? null,
  }, null, 2));
}
