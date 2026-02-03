// scripts/abm-enrich.mjs
import crypto from "node:crypto";
import nodePath from "node:path";
import https from "node:https";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { createClient } from "@sanity/client";

// -------------------- dotenv (.env.local) --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = nodePath.dirname(__filename);
const projectRoot = nodePath.resolve(__dirname, "..");

// ✅ Next처럼 .env.local 우선 로드
dotenv.config({ path: nodePath.join(projectRoot, ".env.local") });
dotenv.config({ path: nodePath.join(projectRoot, ".env") });

// -------------------- args --------------------
const DRY = process.argv.includes("--dry");
const ONLY_IF_EMPTY = process.argv.includes("--only-if-empty");
const LIMIT = (() => {
  const idx = process.argv.indexOf("--limit");
  if (idx >= 0) return Number(process.argv[idx + 1] || "0") || 0;
  return 0;
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
function stripBrandSuffix(title) {
  const t = String(title || "").trim();
  const i = t.indexOf("|");
  return (i >= 0 ? t.slice(0, i) : t).trim();
}

function collapseWs(s) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function hash8(input) {
  return crypto.createHash("sha1").update(String(input)).digest("hex").slice(0, 8);
}

/**
 * Node fetch(undici)가 Windows/Node24에서 특정 URL(괄호 등)로 "fetch failed" 나는 케이스가 있어
 * -> 괄호/따옴표 같은 문제 문자들을 강제로 인코딩
 */
function normalizeImgUrl(input) {
  let u = String(input || "").trim();
  if (!u) return "";

  // 공백 처리
  u = u.replace(/\s/g, "%20");

  // 괄호/따옴표 등 명시적 인코딩
  u = u
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");

  return u;
}

// -------------------- parsing helpers --------------------
function pickImgSrc($img, baseUrl) {
  if (!$img || $img.length === 0) return "";

  // 1) srcset / data-srcset 우선
  const srcset = $img.attr("srcset") || $img.attr("data-srcset") || "";
  if (srcset) {
    const first = srcset.split(",")[0]?.trim(); // "url 1x"
    const firstUrl = first?.split(" ")[0]?.trim() || "";
    if (firstUrl) {
      let u = firstUrl;
      if (u.startsWith("//")) u = "https:" + u;
      return absUrl(baseUrl, u);
    }
  }

  // 2) 여러 lazy 속성들
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

// -------------------- parsing --------------------
/**
 * Resource 파싱:
 * - "Resource" 헤더 주변에서 img 포함 a[href]를 카드로 추출
 * - img src/srcset/data-src 모두 대응
 */
function parseResourcesFromLegacyHtml(legacyHtml, baseUrl) {
  const $ = cheerio.load(legacyHtml || "");

  const resourceHeader = $("*:contains('Resource')")
    .filter((_, el) => collapseWs($(el).text()) === "Resource")
    .first();

  if (!resourceHeader.length) return [];

  const topHeader = $("*:contains('Top Publications')")
    .filter((_, el) => collapseWs($(el).text()) === "Top Publications")
    .first();

  // Resource~Top Publications 사이만 대충 슬라이스 (있으면)
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

  // href 중복 제거
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

/**
 * Top Publications 파싱 (구조 의존 X):
 * - "Top Publications"가 존재하면
 * - 페이지 전체 텍스트에서 doi: 10... 포함 라인을 찾아 상위 3개로 구성
 */
function parseTopPublicationsFromLegacyHtml(legacyHtml) {
  const $ = cheerio.load(legacyHtml || "");

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

    // DOI 추출 → doi.org URL
    let doiUrl = "";
    const m = t.match(/doi:\s*(10\.[^\s]+)/i);
    if (m?.[1]) {
      const doi = m[1].replace(/[)\],.]+$/, "");
      doiUrl = `https://doi.org/${doi}`;
    }

    // Product 분리
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

// -------------------- https fallback downloader --------------------
async function downloadViaHttps(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers,
      },
      (res) => {
        const status = res.statusCode || 0;

        // redirect 처리
        if (status >= 300 && status < 400 && res.headers.location) {
          const next = new URL(res.headers.location, url).toString();
          res.resume();
          return resolve(downloadViaHttps(next, headers));
        }

        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve({
            ok: status >= 200 && status < 300,
            status,
            headers: res.headers,
            buffer: buf,
          });
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

// -------------------- image upload --------------------
async function uploadImageToSanity(imgUrlRaw) {
  if (!imgUrlRaw) return { image: null, ok: false, reason: "empty-imgUrl", usedUrl: "" };

  const usedUrl = normalizeImgUrl(String(imgUrlRaw).trim());

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
    Referer: "https://www.abmgood.com/",
    Connection: "keep-alive",
  };

  // 1) fetch로 2회 시도
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(usedUrl, { headers, redirect: "follow" });

      if (!res.ok) {
        // fetch는 됐는데 status가 안 좋음 → https fallback으로도 한번 더 시도
        break;
      }

      const ct = res.headers.get("content-type") || "";
      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab);

      if (buf.length < 1500) {
        return {
          image: null,
          ok: false,
          reason: `too-small(${buf.length}) ct=${ct}`,
          usedUrl,
        };
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
        console.log("  [dry] upload image:", filename, "from", usedUrl, "ct=", ct, "bytes=", buf.length);
        return {
          image: { _type: "image", asset: { _type: "reference", _ref: "dry" } },
          ok: true,
          reason: "dry",
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
    } catch (e) {
      // fetch 자체가 죽음(fetch failed) → 다음 attempt 또는 https fallback
      if (attempt === 2) {
        break;
      }
    }
  }

  // 2) fetch 실패/죽음 → https 모듈로 fallback
  try {
    const r = await downloadViaHttps(usedUrl, headers);

    if (!r.ok) {
      return { image: null, ok: false, reason: `http-${r.status}(https)`, usedUrl };
    }

    const ct = String(r.headers["content-type"] || "");
    const buf = r.buffer;

    if (!buf || buf.length < 1500) {
      return {
        image: null,
        ok: false,
        reason: `too-small(${buf?.length || 0}) ct=${ct}(https)`,
        usedUrl,
      };
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
      console.log("  [dry] upload image:", filename, "from", usedUrl, "ct=", ct, "bytes=", buf.length);
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
    return {
      image: null,
      ok: false,
      reason: `fetch-error: ${String(e?.message || e)}`,
      usedUrl,
    };
  }
}

// -------------------- main --------------------
async function main() {
  console.log("[env]", {
    projectId,
    dataset,
    apiVersion,
    hasToken: !!token,
    tokenLen: token.length,
    DRY,
    ONLY_IF_EMPTY,
    LIMIT,
  });

  // ✅ ABM 카테고리 필터
  const query = `
  *[
    _type=="category"
    && (
      themeKey=="abm"
      || brand->themeKey=="abm"
      || brand->slug.current=="abm"
    )
  ]|order(_createdAt desc)[0..500]{
    _id,
    title,
    sourceUrl,
    legacyHtml,
    resources,
    topPublications
  }`;

  const all = await client.fetch(query);
  const listAll = Array.isArray(all) ? all : [];

  // ✅ legacyHtml 있는 것만 대상으로
  const list = listAll.filter(
    (d) => typeof d.legacyHtml === "string" && d.legacyHtml.trim().length > 200
  );

  console.log("[fetch]", { totalAll: listAll.length, totalWithLegacyHtml: list.length });

  const targets = LIMIT > 0 ? list.slice(0, LIMIT) : list;

  for (const doc of targets) {
    const title = stripBrandSuffix(doc.title || "");
    const baseUrl = doc.sourceUrl || "https://www.abmgood.com/";

    const hasResources = Array.isArray(doc.resources) && doc.resources.length > 0;
    const hasPubs = Array.isArray(doc.topPublications) && doc.topPublications.length > 0;

    if (ONLY_IF_EMPTY && (hasResources || hasPubs)) {
      console.log("skip (already filled):", title);
      continue;
    }

    console.log("\n▶", title);

    const resourcesParsed = parseResourcesFromLegacyHtml(doc.legacyHtml, baseUrl);
    const pubsParsed = parseTopPublicationsFromLegacyHtml(doc.legacyHtml);

    const resourcesOut = [];
    let okImages = 0;
    let failImages = 0;

    for (const r of resourcesParsed) {
      const srcRaw = r.imgSrc || "";
      const up = await uploadImageToSanity(srcRaw);

      if (!up.ok) {
        console.warn("  [img] FAIL:", up.reason, "title=", r.title, "imgUrl=", srcRaw, "usedUrl=", up.usedUrl);
        failImages++;
      } else {
        console.log("  [img] OK:", up.reason, "title=", r.title);
        okImages++;
      }

      resourcesOut.push({
        _type: "resourceCard",
        _key: `r_${hash8(r.href)}`,
        title: r.title,
        subtitle: r.subtitle || "Learning Resources",
        href: r.href,
        image: up.image || undefined,
        // ✅ 실패해도 원본 URL과 사유 저장 (디버그/재처리용)
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

    console.log("  resources:", resourcesOut.length, "pubs:", pubsOut.length);
    console.log("  images:", { ok: okImages, fail: failImages });

    if (DRY) continue;

    await client
      .patch(doc._id)
      .set({
        resources: resourcesOut,
        topPublications: pubsOut,
      })
      .commit({ autoGenerateArrayKeys: false });
  }

  console.log("\n✅ ABM enrich done.");
}

main().catch((e) => {
  console.error("[ERROR]", e?.responseBody || e);
  process.exit(1);
});
