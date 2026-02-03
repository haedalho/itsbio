// scripts/sanity-kit.mjs
import crypto from "node:crypto";
import nodePath from "node:path";
import https from "node:https";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { createClient } from "@sanity/client";
import * as cheerio from "cheerio";
import { spawn } from "node:child_process";
import fs from "node:fs";

// -------------------- dotenv (.env.local) --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = nodePath.dirname(__filename);
const projectRoot = nodePath.resolve(__dirname, "..");

dotenv.config({ path: nodePath.join(projectRoot, ".env.local") });
dotenv.config({ path: nodePath.join(projectRoot, ".env") });

// -------------------- args --------------------
const argv = process.argv.slice(2);
const cmd = argv[0] || "help";

const DRY = argv.includes("--dry");
const ONLY_IF_EMPTY = argv.includes("--only-if-empty");

const LIMIT = (() => {
  const idx = argv.indexOf("--limit");
  if (idx >= 0) return Number(argv[idx + 1] || "0") || 0;
  return 0;
})();

const THEME = (() => {
  const idx = argv.indexOf("--theme");
  if (idx >= 0) return String(argv[idx + 1] || "").trim();
  return "abm";
})();

function env(name, fallback = "") {
  return (process.env[name] || fallback).trim();
}

const projectId = env("NEXT_PUBLIC_SANITY_PROJECT_ID");
const dataset = env("NEXT_PUBLIC_SANITY_DATASET", "production");
const apiVersion = env("NEXT_PUBLIC_SANITY_API_VERSION", "2025-01-01");
const token = env("SANITY_WRITE_TOKEN");

if (!projectId) throw new Error("Missing env: NEXT_PUBLIC_SANITY_PROJECT_ID");
if (!dataset) throw new Error("Missing env: NEXT_PUBLIC_SANITY_DATASET");
if (!apiVersion) throw new Error("Missing env: NEXT_PUBLIC_SANITY_API_VERSION");
if (!token) throw new Error("Missing env: SANITY_WRITE_TOKEN");

const client = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: false,
});

// -------------------- utils --------------------
function collapseWs(s) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripBrandSuffix(title) {
  const t = String(title || "").trim();
  const i = t.indexOf("|");
  return (i >= 0 ? t.slice(0, i) : t).trim();
}

function hash8(input) {
  return crypto.createHash("sha1").update(String(input)).digest("hex").slice(0, 8);
}

function absUrl(base, maybe) {
  const u = String(maybe || "").trim();
  if (!u) return "";
  try {
    return new URL(u, base).toString();
  } catch {
    return u;
  }
}

function guessExtFromContentType(ct) {
  const v = (ct || "").toLowerCase();
  if (v.includes("png")) return ".png";
  if (v.includes("jpeg") || v.includes("jpg")) return ".jpg";
  if (v.includes("webp")) return ".webp";
  if (v.includes("gif")) return ".gif";
  return "";
}

function normalizeImgUrl(input) {
  let u = String(input || "").trim();
  if (!u) return "";
  u = u.replace(/\s/g, "%20");
  u = u
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");
  return u;
}

// -------------------- child-process runner --------------------
function runNodeScript(scriptRelPath, args = []) {
  return new Promise((resolve, reject) => {
    const full = nodePath.join(projectRoot, scriptRelPath);
    if (!fs.existsSync(full)) {
      return reject(new Error(`Script not found: ${scriptRelPath}`));
    }

    const child = spawn(process.execPath, [full, ...args], {
      cwd: projectRoot,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`Script failed (${scriptRelPath}) exit code: ${code}`));
    });
  });
}

// -------------------- HTTP helpers --------------------
const browserHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
};

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      ...browserHeaders,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: "https://www.abmgood.com/",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`fetchText failed: ${res.status} ${url}`);
  return await res.text();
}

async function downloadViaHttps(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "GET", headers }, (res) => {
      const status = res.statusCode || 0;

      if (status >= 300 && status < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        return resolve(downloadViaHttps(next, headers));
      }

      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        resolve({
          ok: status >= 200 && status < 300,
          status,
          headers: res.headers,
          buffer: Buffer.concat(chunks),
        });
      });
    });

    req.on("error", reject);
    req.end();
  });
}

async function uploadImageToSanity(imgUrlRaw) {
  if (!imgUrlRaw) return { image: null, ok: false, reason: "empty-imgUrl", usedUrl: "" };

  const usedUrl = normalizeImgUrl(String(imgUrlRaw).trim());

  const headers = {
    ...browserHeaders,
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    Referer: "https://www.abmgood.com/",
    Connection: "keep-alive",
  };

  // 1) fetch 2회
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(usedUrl, { headers, redirect: "follow" });
      if (!res.ok) break;

      const ct = res.headers.get("content-type") || "";
      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab);

      if (buf.length < 1500) {
        return { image: null, ok: false, reason: `too-small(${buf.length}) ct=${ct}`, usedUrl };
      }

      let ext = guessExtFromContentType(ct);
      if (!ext) {
        try {
          ext = nodePath.extname(new URL(usedUrl).pathname) || ".jpg";
        } catch {
          ext = ".jpg";
        }
      }

      const filename = `abm-resource-${hash8(usedUrl)}${ext}`;

      if (DRY) {
        return {
          image: { _type: "image", asset: { _type: "reference", _ref: "dry" } },
          ok: true,
          reason: "dry(fetch)",
          usedUrl,
        };
      }

      const asset = await client.assets.upload("image", buf, {
        filename,
        contentType: ct || undefined,
      });

      return {
        image: { _type: "image", asset: { _type: "reference", _ref: asset._id } },
        ok: true,
        reason: "ok(fetch)",
        usedUrl,
      };
    } catch {
      if (attempt === 2) break;
    }
  }

  // 2) https fallback
  try {
    const r = await downloadViaHttps(usedUrl, headers);
    if (!r.ok) return { image: null, ok: false, reason: `http-${r.status}(https)`, usedUrl };

    const ct = String(r.headers["content-type"] || "");
    const buf = r.buffer;

    if (!buf || buf.length < 1500) {
      return { image: null, ok: false, reason: `too-small(${buf?.length || 0}) ct=${ct}(https)`, usedUrl };
    }

    let ext = guessExtFromContentType(ct);
    if (!ext) {
      try {
        ext = nodePath.extname(new URL(usedUrl).pathname) || ".jpg";
      } catch {
        ext = ".jpg";
      }
    }

    const filename = `abm-resource-${hash8(usedUrl)}${ext}`;

    if (DRY) {
      return {
        image: { _type: "image", asset: { _type: "reference", _ref: "dry" } },
        ok: true,
        reason: "dry(https)",
        usedUrl,
      };
    }

    const asset = await client.assets.upload("image", buf, {
      filename,
      contentType: ct || undefined,
    });

    return {
      image: { _type: "image", asset: { _type: "reference", _ref: asset._id } },
      ok: true,
      reason: "ok(https)",
      usedUrl,
    };
  } catch (e) {
    return { image: null, ok: false, reason: `fetch-error: ${String(e?.message || e)}`, usedUrl };
  }
}

// -------------------- ABM parsing --------------------
function pickImgSrc($img, baseUrl) {
  const srcset = $img.attr("srcset") || $img.attr("data-srcset") || "";
  if (srcset) {
    const first = srcset.split(",")[0]?.trim();
    const firstUrl = first?.split(" ")[0]?.trim() || "";
    if (firstUrl) {
      let u = firstUrl;
      if (u.startsWith("//")) u = "https:" + u;
      return absUrl(baseUrl, u);
    }
  }

  let raw =
    $img.attr("src") ||
    $img.attr("data-src") ||
    $img.attr("data-lazy-src") ||
    $img.attr("data-original") ||
    $img.attr("data-url") ||
    "";

  raw = String(raw || "").trim();
  if (!raw) return "";
  if (raw.startsWith("//")) raw = "https:" + raw;
  return absUrl(baseUrl, raw);
}

function parseIntroQuickBulletsFromHtml(html, baseUrl) {
  const $ = cheerio.load(html || "");
  const h1 = $("h1").first();

  // intro
  let intro = "";
  if (h1.length) {
    let cur = h1.next();
    let guard = 0;
    while (cur.length && guard++ < 40) {
      const tag = (cur[0]?.tagName || "").toLowerCase();
      const t = collapseWs(cur.text());
      const hasManyLinks = cur.find("a").length >= 3;

      if (tag === "p" && t.length >= 40 && !hasManyLinks) {
        intro = t;
        break;
      }
      if ((tag === "div" || tag === "section") && t.length >= 40 && !hasManyLinks) {
        const p = cur.find("p").first();
        const pt = collapseWs(p.text());
        if (pt.length >= 40) {
          intro = pt;
          break;
        }
      }
      cur = cur.next();
    }
  }

  // quickLinks (h1 아래 “링크가 3개 이상 붙어 있는” 블록)
  const quickLinks = [];
  const blocks = [];
  if (h1.length) {
    let cur = h1.next();
    let guard = 0;
    while (cur.length && guard++ < 25) {
      const aCount = cur.find("a").length;
      if (aCount >= 3) blocks.push(cur);
      cur = cur.next();
    }
  }
  if (blocks.length) {
    const best = blocks[0];
    best.find("a").each((_, a) => {
      const $a = $(a);
      const t = collapseWs($a.text());
      const href = absUrl(baseUrl, $a.attr("href"));
      if (!t || !href) return;
      quickLinks.push({ title: stripBrandSuffix(t), href });
    });
  }

  // bullets
  const bullets = [];
  $("ul li a").each((_, a) => {
    const $a = $(a);
    const t = collapseWs($a.text());
    const href = absUrl(baseUrl, $a.attr("href"));
    if (!t || !href) return;
    if (t.length > 2 && t.length < 90) bullets.push({ title: stripBrandSuffix(t), href });
  });

  const seen = new Set();
  const bulletsUniq = [];
  for (const b of bullets) {
    if (seen.has(b.href)) continue;
    seen.add(b.href);
    bulletsUniq.push(b);
  }

  return {
    intro: intro || "",
    quickLinks,
    bullets: bulletsUniq.slice(0, 80),
  };
}

function parseResourcesFromHtml(html, baseUrl) {
  const $ = cheerio.load(html || "");

  const resourceHeader = $("*:contains('Resource')")
    .filter((_, el) => collapseWs($(el).text()) === "Resource")
    .first();

  if (!resourceHeader.length) return [];

  const topHeader = $("*:contains('Top Publications')")
    .filter((_, el) => collapseWs($(el).text()) === "Top Publications")
    .first();

  const fullHtml = $.html();
  const rHtml = $.html(resourceHeader);
  const tHtml = topHeader.length ? $.html(topHeader) : "";

  const rIdx = rHtml ? fullHtml.indexOf(rHtml) : -1;
  const tIdx = tHtml ? fullHtml.indexOf(tHtml) : -1;

  const slice =
    rIdx >= 0 && tIdx > rIdx ? fullHtml.slice(rIdx, tIdx) : fullHtml.slice(Math.max(0, rIdx));

  const $$ = cheerio.load(slice);

  const candidates = [];
  $$("a").each((_, a) => {
    const $a = $$(a);
    const $img = $a.find("img").first();
    if ($img.length === 0) return;

    const href = absUrl(baseUrl, $a.attr("href"));
    if (!href) return;

    const imgSrc = pickImgSrc($img, baseUrl);
    const alt = collapseWs($img.attr("alt"));
    const rawText = collapseWs($a.text());

    const title = stripBrandSuffix(rawText || alt);
    if (!title) return;

    candidates.push({ title, href, imgSrc });
  });

  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    if (seen.has(c.href)) continue;
    seen.add(c.href);
    out.push({
      title: c.title,
      subtitle: "Learning Resources",
      href: c.href,
      imgSrc: c.imgSrc,
    });
  }

  return out.slice(0, 30);
}

function parseTopPublicationsFromHtml(html) {
  const $ = cheerio.load(html || "");

  const hasHeader =
    $("*:contains('Top Publications')")
      .filter((_, el) => collapseWs($(el).text()) === "Top Publications")
      .length > 0;

  if (!hasHeader) return [];

  const text = collapseWs($.text()).replace(/(01|02|03)\s+/g, "\n$1 ");
  const lines = text
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const doiLines = lines.filter((x) => /doi:\s*10\./i.test(x));

  const uniq = [];
  const seen = new Set();
  for (const t of doiLines) {
    if (seen.has(t)) continue;
    seen.add(t);
    uniq.push(t);
  }

  const pubs = [];
  for (const t of uniq) {
    if (pubs.length >= 3) break;

    let doiUrl = "";
    const m = t.match(/doi:\s*(10\.[^\s]+)/i);
    if (m?.[1]) {
      const doi = m[1].replace(/[)\],.]+$/, "");
      doiUrl = `https://doi.org/${doi}`;
    }

    let citation = t;
    let product = "";
    const pm = t.match(/\bProduct:\s*(.+)$/i);
    if (pm?.[1]) {
      product = collapseWs(pm[1]);
      citation = collapseWs(t.replace(pm[0], ""));
    }

    pubs.push({
      order: pubs.length + 1,
      citation,
      doi: doiUrl || undefined,
      product: product || undefined,
    });
  }

  return pubs;
}

// -------------------- commands: sanity / abm --------------------
async function cmdHelp() {
  console.log(`
Usage:
  node scripts/sanity-kit.mjs test
  node scripts/sanity-kit.mjs abm:count [--theme abm]
  node scripts/sanity-kit.mjs abm:extract [--limit N] [--dry]
  node scripts/sanity-kit.mjs abm:transform [--limit N] [--only-if-empty] [--dry]
  node scripts/sanity-kit.mjs abm:enrich [--theme abm] [--limit N] [--only-if-empty] [--dry]
  node scripts/sanity-kit.mjs abm:sync [--theme abm] [--limit N] [--only-if-empty] [--dry]

Notes:
  - abm:extract / abm:transform 은 기존 스크립트를 "그대로" 호출합니다.
    (scripts/extract-abm.mjs, scripts/abm-transform.mjs 가 있어야 함)
  - abm:enrich 는 legacyHtml(or sourceUrl)에서 intro/quickLinks/bullets/resources/topPublications를 채우고,
    resource 이미지는 Sanity asset로 업로드합니다.
  - "전체"로 하려면 --limit 을 빼고 abm:sync 실행하세요.
`);
}

async function cmdTest() {
  console.log("[env]", {
    projectId,
    dataset,
    apiVersion,
    hasToken: !!token,
    tokenLen: token.length,
  });

  const r = await client.fetch(`*[_type=="notice"][0]{_id,title}`);
  console.log("OK", r);
}

async function cmdAbmCount(themeKey) {
  const n = await client.fetch(
    `count(*[_type=="category" && (themeKey==$k || brand->themeKey==$k || brand->slug.current==$k)])`,
    { k: themeKey }
  );
  console.log(`ABM category count (${themeKey}) =`, n);
}

async function cmdAbmExtract() {
  const args = [];
  if (DRY) args.push("--dry");
  if (LIMIT > 0) args.push("--limit", String(LIMIT));

  console.log("[run] extract-abm.mjs", args.join(" "));
  await runNodeScript("scripts/extract-abm.mjs", args);
}

async function cmdAbmTransform() {
  const args = [];
  if (DRY) args.push("--dry");
  if (ONLY_IF_EMPTY) args.push("--only-if-empty");
  if (LIMIT > 0) args.push("--limit", String(LIMIT));

  console.log("[run] abm-transform.mjs", args.join(" "));
  await runNodeScript("scripts/abm-transform.mjs", args);
}

async function cmdAbmEnrich(themeKey) {
  // ✅ 전체 위해 상한 넉넉히
  const q = `
  *[
    _type=="category"
    && (
      themeKey==$k
      || brand->themeKey==$k
      || brand->slug.current==$k
    )
  ]|order(_createdAt desc)[0..50000]{
    _id, title, sourceUrl, legacyHtml,
    intro, quickLinks, bullets, resources, topPublications
  }`;

  const all = await client.fetch(q, { k: themeKey });
  const listAll = Array.isArray(all) ? all : [];
  const targets = LIMIT > 0 ? listAll.slice(0, LIMIT) : listAll;

  console.log("[fetch]", { total: listAll.length, target: targets.length });

  for (const doc of targets) {
    const title = stripBrandSuffix(doc.title || "");
    const baseUrl = doc.sourceUrl || "https://www.abmgood.com/";

    const hasIntro = !!(doc.intro && String(doc.intro).trim());
    const hasQuick = Array.isArray(doc.quickLinks) && doc.quickLinks.length > 0;
    const hasBullets = Array.isArray(doc.bullets) && doc.bullets.length > 0;
    const hasResources = Array.isArray(doc.resources) && doc.resources.length > 0;
    const hasPubs = Array.isArray(doc.topPublications) && doc.topPublications.length > 0;

    if (ONLY_IF_EMPTY && (hasIntro || hasQuick || hasBullets || hasResources || hasPubs)) {
      continue;
    }

    console.log("\n▶", title);

    let html = String(doc.legacyHtml || "").trim();
    if (!html) {
      if (!doc.sourceUrl) {
        console.log("  skip: no legacyHtml & no sourceUrl");
        continue;
      }
      try {
        html = await fetchText(doc.sourceUrl);
      } catch (e) {
        console.warn("  FAIL: fetch html", e?.message || e);
        continue;
      }
    }

    const { intro, quickLinks, bullets } = parseIntroQuickBulletsFromHtml(html, baseUrl);
    const resourcesParsed = parseResourcesFromHtml(html, baseUrl);
    const pubsParsed = parseTopPublicationsFromHtml(html);

    const resourcesOut = [];
    let okImages = 0;
    let failImages = 0;

    for (const r of resourcesParsed) {
      const srcRaw = r.imgSrc || "";
      const up = await uploadImageToSanity(srcRaw);

      if (!up.ok) failImages++;
      else okImages++;

      resourcesOut.push({
        _type: "resourceCard",
        _key: `r_${hash8(r.href)}`,
        title: r.title,
        subtitle: r.subtitle || "Learning Resources",
        href: r.href,
        image: up.image || undefined,
        meta: {
          _type: "object",
          imageUrlRaw: srcRaw || undefined,
          imageUrlUsed: up.usedUrl || undefined,
          imageStatus: up.ok ? "ok" : "fail",
          imageReason: up.reason || undefined,
        },
      });
    }

    const pubsOut = pubsParsed.map((p) => ({
      _type: "topPublication",
      _key: `p_${p.order}`,
      order: p.order,
      citation: p.citation,
      doi: p.doi,
      product: p.product,
    }));

    const quickOut = (quickLinks || []).slice(0, 60).map((x) => ({
      _type: "quickLink",
      _key: `q_${hash8(x.href)}`,
      title: x.title,
      href: x.href,
    }));

    const bulletOut = (bullets || []).slice(0, 120).map((x) => ({
      _type: "bulletLink",
      _key: `b_${hash8(x.href)}`,
      title: x.title,
      href: x.href,
    }));

    console.log("  intro:", intro ? "ok" : "empty");
    console.log("  quickLinks:", quickOut.length, "bullets:", bulletOut.length);
    console.log("  resources:", resourcesOut.length, "pubs:", pubsOut.length);
    console.log("  images:", { ok: okImages, fail: failImages });

    if (DRY) continue;

    await client
      .patch(doc._id)
      .set({
        intro: intro || "",
        quickLinks: quickOut,
        bullets: bulletOut,
        resources: resourcesOut,
        topPublications: pubsOut,
        legacyHtml: html,
      })
      .commit({ autoGenerateArrayKeys: false });
  }

  console.log("\n✅ enrich done.");
}

async function cmdAbmSync(themeKey) {
  console.log("[sync]", { theme: themeKey, DRY, ONLY_IF_EMPTY, LIMIT });

  // 1) extract (기존 스크립트 호출)
  await cmdAbmExtract();

  // 2) transform (기존 스크립트 호출)
  await cmdAbmTransform();

  // 3) enrich (내장)
  await cmdAbmEnrich(themeKey);

  console.log("\n✅ abm:sync done.");
}

// -------------------- main --------------------
async function main() {
  if (cmd === "help" || cmd === "--help" || cmd === "-h") return await cmdHelp();
  if (cmd === "test") return await cmdTest();

  if (cmd === "abm:count") return await cmdAbmCount(THEME);
  if (cmd === "abm:extract") return await cmdAbmExtract();
  if (cmd === "abm:transform") return await cmdAbmTransform();
  if (cmd === "abm:enrich") return await cmdAbmEnrich(THEME);
  if (cmd === "abm:sync") return await cmdAbmSync(THEME);

  return await cmdHelp();
}

main().catch((e) => {
  console.error("[ERROR]", e?.responseBody || e);
  process.exit(1);
});
