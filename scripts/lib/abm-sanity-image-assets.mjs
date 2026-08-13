import crypto from "node:crypto";
import path from "node:path";

import * as cheerio from "cheerio";

const PROJECT_ID = "9b5twpc8";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const IMAGE_FIELDS = [
  "introHtml",
  "specificationsHtml",
  "datasheetHtml",
  "documentsHtml",
  "faqsHtml",
  "referencesHtml",
  "reviewsHtml",
  "serviceDetailsHtml",
];

export function isManagedAbmImageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.hostname === "cdn.sanity.io" && url.pathname.startsWith(`/images/${PROJECT_ID}/`);
  } catch {
    return false;
  }
}

function officialImageUrl(value, baseUrl) {
  try {
    const url = new URL(String(value || ""), baseUrl || "https://www.abmgood.com");
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "abmgood.com" && !hostname.endsWith(".abmgood.com")) return "";
    if (!['http:', 'https:'].includes(url.protocol)) return "";
    url.protocol = "https:";
    url.hostname = hostname;
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function filenameFor(sourceUrl, mimeType) {
  let name = "abm-image";
  try {
    name = path.basename(new URL(sourceUrl).pathname) || name;
  } catch { /* keep fallback */ }
  name = name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-140) || "abm-image";
  if (!/\.(?:png|jpe?g|webp|gif|svg)$/i.test(name)) {
    const extension = String(mimeType || "").split("/")[1]?.replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "img";
    name = `${name}.${extension}`;
  }
  return name;
}

async function downloadOfficialImage(sourceUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(sourceUrl, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const mimeType = String(response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    if (!mimeType.startsWith("image/")) throw new Error(`unexpected content-type ${mimeType || "missing"}`);
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MAX_IMAGE_BYTES) throw new Error(`image exceeds ${MAX_IMAGE_BYTES} bytes`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error(`invalid image size ${bytes.length}`);
    return { bytes, mimeType };
  } finally {
    clearTimeout(timeout);
  }
}

export function createAbmImageRehoster({ client, dryRun = false, logEvery = 50 } = {}) {
  if (!dryRun && !client) throw new Error("Sanity client is required for ABM image migration");
  const cache = new Map();
  const stats = {
    sourceCandidates: 0,
    uniqueSourceImages: 0,
    uploadedAssets: 0,
    reusedManagedAssets: 0,
    rewrittenHtmlImages: 0,
    failures: 0,
  };

  async function rehostUrl(rawUrl, baseUrl) {
    const value = String(rawUrl || "").trim();
    if (!value) return "";
    if (isManagedAbmImageUrl(value)) {
      stats.reusedManagedAssets += 1;
      return value;
    }
    const sourceUrl = officialImageUrl(value, baseUrl);
    if (!sourceUrl) throw new Error(`ABM image is neither managed nor official: ${value}`);
    stats.sourceCandidates += 1;
    if (cache.has(sourceUrl)) return await cache.get(sourceUrl);
    stats.uniqueSourceImages += 1;
    if (dryRun) {
      cache.set(sourceUrl, Promise.resolve(sourceUrl));
      return sourceUrl;
    }

    const task = (async () => {
      try {
        const { bytes, mimeType } = await downloadOfficialImage(sourceUrl);
        const digest = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16);
        const asset = await client.assets.upload("image", bytes, {
          filename: `${digest}-${filenameFor(sourceUrl, mimeType)}`,
        });
        if (!isManagedAbmImageUrl(asset?.url)) throw new Error(`Sanity returned an unmanaged image URL for ${sourceUrl}`);
        stats.uploadedAssets += 1;
        if (stats.uploadedAssets % logEvery === 0) console.log(`[ABM assets] uploaded ${stats.uploadedAssets}`);
        return asset.url;
      } catch (error) {
        stats.failures += 1;
        throw new Error(`${sourceUrl}: ${error?.message || error}`);
      }
    })();
    cache.set(sourceUrl, task);
    return await task;
  }

  async function rewriteHtml(html, baseUrl) {
    const value = String(html || "").trim();
    if (!value) return "";
    const $ = cheerio.load(`<div id="__abm_asset_root">${value}</div>`, { decodeEntities: false });
    const images = $("#__abm_asset_root img").toArray();
    for (const image of images) {
      const node = $(image);
      const source = String(node.attr("src") || node.attr("data-src") || "").trim();
      if (!source) {
        node.remove();
        continue;
      }
      const managedUrl = await rehostUrl(source, baseUrl);
      node.attr("src", managedUrl);
      for (const attribute of ["srcset", "data-src", "data-srcset", "data-original", "data-lazy-src"]) node.removeAttr(attribute);
      stats.rewrittenHtmlImages += 1;
    }
    const rewritten = $("#__abm_asset_root").html() || "";
    if (!dryRun) {
      const verify = cheerio.load(`<div>${rewritten}</div>`);
      const unmanaged = verify("img[src]").toArray().map((image) => verify(image).attr("src")).filter((url) => !isManagedAbmImageUrl(url));
      if (unmanaged.length) throw new Error(`Unmanaged ABM images remain: ${unmanaged.slice(0, 3).join(", ")}`);
    }
    return rewritten;
  }

  async function rehostUrls(urls, baseUrl) {
    const out = [];
    for (const url of Array.isArray(urls) ? urls : []) {
      const managed = await rehostUrl(url, baseUrl);
      if (managed && !out.includes(managed)) out.push(managed);
    }
    return out;
  }

  async function rehostDetailRecord(record) {
    const next = { ...record };
    for (const field of IMAGE_FIELDS) next[field] = await rewriteHtml(next[field], next.sourceUrl);
    next.images = await rehostUrls(next.images, next.sourceUrl);
    if (!dryRun && next.images.some((url) => !isManagedAbmImageUrl(url))) {
      throw new Error(`${next.key || next.sku}: unmanaged gallery image remains`);
    }
    return next;
  }

  return { rehostUrl, rehostUrls, rewriteHtml, rehostDetailRecord, stats };
}
