#!/usr/bin/env node
/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import dotenv from "dotenv";
import { createClient } from "next-sanity";

const repoRoot = process.cwd();

dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const argv = process.argv.slice(2);

const hasArg = (flag) => argv.includes(flag);
const readArg = (flag, fallback = "") => {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] ?? fallback : fallback;
};

const BRAND_KEY = String(readArg("--brand", "kent")).trim() || "kent";
const APPLY = hasArg("--apply");
const FORCE = hasArg("--force");
const LIMIT = Number(readArg("--limit", "0") || "0");
const MATCH = String(readArg("--match", "") || "").trim().toLowerCase();
const SLEEP_MS = Number(readArg("--sleep", "120") || "120");

const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.SANITY_STUDIO_PROJECT_ID ||
  process.env.SANITY_PROJECT_ID;

const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_STUDIO_DATASET ||
  process.env.SANITY_DATASET;

const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ||
  process.env.SANITY_STUDIO_API_VERSION ||
  process.env.SANITY_API_VERSION ||
  "2025-01-01";

const token =
  process.env.SANITY_WRITE_TOKEN ||
  process.env.SANITY_API_TOKEN ||
  process.env.SANITY_TOKEN;

if (!projectId || !dataset || !token) {
  console.error("[ERR] Missing Sanity env.");
  console.error("Required one of:");
  console.error("- NEXT_PUBLIC_SANITY_PROJECT_ID / SANITY_STUDIO_PROJECT_ID / SANITY_PROJECT_ID");
  console.error("- NEXT_PUBLIC_SANITY_DATASET / SANITY_STUDIO_DATASET / SANITY_DATASET");
  console.error("- SANITY_WRITE_TOKEN / SANITY_API_TOKEN / SANITY_TOKEN");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: false,
});

const CACHE_DIR = path.join(repoRoot, ".cache");
const CACHE_FILE = path.join(CACHE_DIR, `${BRAND_KEY}-product-image-reupload-cache.json`);
fs.mkdirSync(CACHE_DIR, { recursive: true });

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return { byUrl: {} };
  }
}

function writeCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha1(input) {
  return crypto.createHash("sha1").update(String(input || "")).digest("hex");
}

function textClean(input) {
  return String(input || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSanityCdn(url) {
  return String(url || "").includes("cdn.sanity.io/images/");
}

function normalizeUrl(value) {
  let raw = String(value || "").trim();
  if (!raw) return "";

  raw = raw.replace(/&amp;/g, "&").replace(/\\u0026/g, "&");

  // 확장자 뒤에 잘못 붙은 슬래시 제거
  raw = raw.replace(/\.(png|jpe?g|webp|gif|bmp|svg)\/(?=[?#]|$)/gi, ".$1");

  try {
    const u = new URL(raw);
    u.hash = "";
    u.pathname = u.pathname.replace(
      /\.(png|jpe?g|webp|gif|bmp|svg)\/$/i,
      ".$1"
    );
    return u.toString();
  } catch {
    return raw.replace(
      /\.(png|jpe?g|webp|gif|bmp|svg)\/(?=[?#]|$)/gi,
      ".$1"
    );
  }
}

function uniqueStrings(values) {
  const out = [];
  const seen = new Set();

  for (const value of values || []) {
    const v = normalizeUrl(value);
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }

  return out;
}

function looksLikeImageUrl(url) {
  const u = String(url || "").toLowerCase();
  if (!u) return false;

  return (
    /\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(u) ||
    u.includes("/wp-content/uploads/") ||
    u.includes("/cdn-cgi/image/") ||
    u.includes("image")
  );
}

function isJunkImage(url) {
  const u = String(url || "").toLowerCase();
  return (
    !u ||
    u.includes("logo") ||
    u.includes("icon") ||
    u.includes("favicon") ||
    u.includes("sprite") ||
    u.includes("header") ||
    u.includes("footer") ||
    u.includes("banner") ||
    u.includes("seal") ||
    u.includes("badge") ||
    u.includes("doubleclick") ||
    u.includes("gravatar")
  );
}

function guessExt(contentType, url) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("bmp")) return "bmp";
  if (ct.includes("svg")) return "svg";

  const m = String(url || "")
    .toLowerCase()
    .match(/\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/);
  if (m) return m[1].replace("jpeg", "jpg");

  return "jpg";
}

function buildCandidateUrls(url) {
  const base = normalizeUrl(url);
  if (!base) return [];

  const out = [];
  const push = (v) => {
    const n = normalizeUrl(v);
    if (n && !out.includes(n)) out.push(n);
  };

  push(base);

  // 혹시 끝 슬래시 흔적이 남아있으면 제거본도 시도
  push(base.replace(/\/$/, ""));

  // 썸네일(-100x100 등)이면 원본도 시도
  push(
    base.replace(
      /-\d{2,4}x\d{2,4}(?=\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$))/i,
      ""
    )
  );

  return out;
}

async function fetchBinary(url, timeoutMs = 35000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        accept: "image/*,*/*;q=0.8",
        referer: "https://www.kentscientific.com/",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const contentType = res.headers.get("content-type") || "";
    const buf = Buffer.from(await res.arrayBuffer());

    return { buf, contentType };
  } finally {
    clearTimeout(timer);
  }
}

async function uploadImageFromUrl(url, cache) {
  const candidates = buildCandidateUrls(url);

  for (const sourceUrl of candidates) {
    if (!sourceUrl || isJunkImage(sourceUrl) || !looksLikeImageUrl(sourceUrl)) {
      continue;
    }

    const cached = cache.byUrl[sourceUrl];
    if (cached?.assetId && cached?.assetUrl) {
      return {
        assetId: cached.assetId,
        assetUrl: cached.assetUrl,
        sourceUrl,
      };
    }

    try {
      const { buf, contentType } = await fetchBinary(sourceUrl);
      if (!buf?.length) continue;

      const ext = guessExt(contentType, sourceUrl);
      const filename = `${BRAND_KEY}-${sha1(sourceUrl).slice(0, 12)}.${ext}`;

      const asset = await sanity.assets.upload("image", buf, {
        filename,
        contentType: contentType || undefined,
      });

      const out = {
        assetId: asset._id,
        assetUrl: asset.url,
      };

      cache.byUrl[sourceUrl] = out;

      return {
        ...out,
        sourceUrl,
      };
    } catch {
      // 다음 후보 URL 시도
    }
  }

  return null;
}

function docLooksAlreadyUploaded(doc) {
  const existingImages = Array.isArray(doc.images) ? doc.images : [];
  const existingImageUrls = Array.isArray(doc.imageUrls) ? doc.imageUrls : [];

  const hasUploadedAsset = existingImages.some((img) => img?.asset?._id);
  const nonEmptyUrls = existingImageUrls.filter(Boolean);

  if (!hasUploadedAsset) return false;
  if (!nonEmptyUrls.length) return true;

  return nonEmptyUrls.every((u) => isSanityCdn(u));
}

function collectSourceCandidates(doc) {
  const fromImageUrls = Array.isArray(doc.imageUrls) ? doc.imageUrls : [];
  const fromImages = Array.isArray(doc.images)
    ? doc.images.map((img) => img?.sourceUrl || "").filter(Boolean)
    : [];

  return uniqueStrings([...fromImages, ...fromImageUrls]).filter(
    (u) => !isSanityCdn(u)
  );
}

function buildPreservedImages(doc) {
  const existingImages = Array.isArray(doc.images) ? doc.images : [];
  const out = [];
  const seenAsset = new Set();

  for (const img of existingImages) {
    const assetId = img?.asset?._id || "";
    const assetUrl = img?.asset?.url || img?.asset?._url || "";
    const sourceUrl = normalizeUrl(img?.sourceUrl || "");
    const caption = textClean(img?.caption || "");

    if (!assetId || !assetUrl) continue;
    if (seenAsset.has(assetId)) continue;
    seenAsset.add(assetId);

    out.push({
      assetId,
      assetUrl,
      sourceUrl,
      caption,
    });
  }

  return out;
}

function buildImagePatchItems(entries) {
  return entries.map((entry) => ({
    _type: "image",
    asset: {
      _type: "reference",
      _ref: entry.assetId,
    },
    caption: entry.caption || "",
    sourceUrl: entry.sourceUrl || "",
  }));
}

async function main() {
  const cache = readCache();

  console.log(
    `[kent-image-reupload] brand=${BRAND_KEY} apply=${APPLY ? "yes" : "no"} force=${FORCE ? "yes" : "no"} limit=${LIMIT || "ALL"} match=${MATCH || "-"}`
  );

  const query = `
    *[
      _type == "product"
      && isActive != false
      && (
        brand->slug.current == $brand
        || brand->themeKey == $brand
      )
    ] | order(title asc) {
      _id,
      title,
      "slug": slug.current,
      imageUrls,
      images[]{
        caption,
        sourceUrl,
        "asset": asset->{
          _id,
          url
        }
      }
    }
  `;

  let docs = await sanity.fetch(query, { brand: BRAND_KEY });

  if (MATCH) {
    docs = docs.filter((doc) => {
      const hay = `${doc.title || ""} ${doc.slug || ""}`.toLowerCase();
      return hay.includes(MATCH);
    });
  }

  if (LIMIT > 0) {
    docs = docs.slice(0, LIMIT);
  }

  console.log(`[kent-image-reupload] target docs=${docs.length}`);

  let done = 0;
  let skipped = 0;
  let patched = 0;
  let failed = 0;
  let uploadedAssets = 0;

  for (const doc of docs) {
    done += 1;
    const label = `${doc.title || "(untitled)"} [${doc.slug || doc._id}]`;

    try {
      const alreadyGood = docLooksAlreadyUploaded(doc);
      if (alreadyGood && !FORCE) {
        skipped += 1;
        console.log(`[SKIP] already uploaded: ${label}`);
        continue;
      }

      const preserved = buildPreservedImages(doc);
      const candidates = collectSourceCandidates(doc);

      if (!candidates.length && preserved.length && !FORCE) {
        skipped += 1;
        console.log(`[SKIP] no external sources, existing uploaded images preserved: ${label}`);
        continue;
      }

      if (!candidates.length && !preserved.length) {
        skipped += 1;
        console.log(`[SKIP] no image sources: ${label}`);
        continue;
      }

      const mergedEntries = [...preserved];
      const seenSource = new Set(
        mergedEntries.map((x) => normalizeUrl(x.sourceUrl || "")).filter(Boolean)
      );
      const seenAsset = new Set(mergedEntries.map((x) => x.assetId).filter(Boolean));

      for (const sourceUrl of candidates) {
        if (!sourceUrl) continue;
        if (seenSource.has(sourceUrl) && !FORCE) continue;

        const up = await uploadImageFromUrl(sourceUrl, cache);
        if (!up?.assetId || !up?.assetUrl) {
          console.log(`  - image upload fail: ${sourceUrl}`);
          continue;
        }

        if (seenAsset.has(up.assetId)) continue;

        mergedEntries.push({
          assetId: up.assetId,
          assetUrl: up.assetUrl,
          sourceUrl: up.sourceUrl,
          caption: "",
        });

        seenAsset.add(up.assetId);
        if (up.sourceUrl) {
          seenSource.add(normalizeUrl(up.sourceUrl));
        }
        uploadedAssets += 1;
      }

      if (!mergedEntries.length) {
        skipped += 1;
        console.log(`[SKIP] merged result empty: ${label}`);
        continue;
      }

      const nextImageUrls = uniqueStrings(
        mergedEntries.map((entry) => entry.assetUrl).filter(Boolean)
      );

      const nextImages = buildImagePatchItems(mergedEntries);

      if (!APPLY) {
        patched += 1;
        console.log(
          `[DRY] ${label} -> images=${nextImages.length} imageUrls=${nextImageUrls.length} preserved=${preserved.length} candidates=${candidates.length}`
        );
      } else {
        await sanity
          .patch(doc._id)
          .set({
            images: nextImages,
            imageUrls: nextImageUrls,
          })
          .commit({ autoGenerateArrayKeys: true });

        patched += 1;
        console.log(
          `[OK] ${label} -> images=${nextImages.length} imageUrls=${nextImageUrls.length} preserved=${preserved.length} candidates=${candidates.length}`
        );
      }

      if (done % 10 === 0) {
        writeCache(cache);
      }

      if (SLEEP_MS > 0) {
        await sleep(SLEEP_MS);
      }
    } catch (err) {
      failed += 1;
      console.log(`[FAIL] ${label} :: ${err?.message || err}`);
      if (SLEEP_MS > 0) {
        await sleep(Math.max(150, SLEEP_MS));
      }
    }
  }

  writeCache(cache);

  console.log("");
  console.log("[kent-image-reupload] DONE");
  console.log(`  target=${docs.length}`);
  console.log(`  patched=${patched}`);
  console.log(`  skipped=${skipped}`);
  console.log(`  failed=${failed}`);
  console.log(`  uploadedAssets=${uploadedAssets}`);
  console.log(`  apply=${APPLY}`);
}

main().catch((err) => {
  console.error("[kent-image-reupload] ERROR", err?.message || err);
  process.exit(1);
});