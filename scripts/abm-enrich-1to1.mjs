#!/usr/bin/env node
/**
 * scripts/abm-enrich-1to1.mjs
 *
 * Usage:
 *  node --env-file=.env.local scripts/abm-enrich-1to1.mjs --slug blastaq-2x-qpcr-mastermix --dump
 *  node --env-file=.env.local scripts/abm-enrich-1to1.mjs --url https://www.abmgood.com/blastaq-2x-qpcr-mastermix.html --print-only --dump
 *  node --env-file=.env.local scripts/abm-enrich-1to1.mjs --from-sanity --limit 30
 *
 * Options:
 *  --dry         patch 안 함
 *  --print-only  fetch+parse만 하고 종료
 *  --keep-price  specsHtml에서 Price 제거 안 함
 *  --dump        tmp/에 parsed json/html 덤프
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import * as cheerio from "cheerio";
import { createClient } from "next-sanity";

const BASE = "https://www.abmgood.com";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const readArg = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  return args[i + 1];
};

const SLUG_ARG = readArg("--slug");
const URL_ARG = readArg("--url");
const FROM_SANITY = has("--from-sanity");
const LIMIT = Number(readArg("--limit") || "0") || 0;

const DRY = has("--dry");
const PRINT_ONLY = has("--print-only");
const KEEP_PRICE = has("--keep-price");
const DUMP = has("--dump");

// ---- sanity env
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_WRITE_TOKEN;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";

if (!projectId || !dataset || !token) {
  console.error(
    "[ERROR] Missing env. Need NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_WRITE_TOKEN"
  );
  process.exit(1);
}

const sanity = createClient({ projectId, dataset, apiVersion, useCdn: false, token });

const TAB_LABELS = ["Specifications", "Datasheet", "Documents", "FAQs", "References", "Reviews"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeAbmUrl(u) {
  if (!u) return "";
  let s = String(u).trim();
  s = s.replace(/[\?#].*$/g, "");
  try {
    s = new URL(s, BASE + "/").toString();
  } catch {}
  return s;
}

function absUrl(u, base) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (s.startsWith("//")) return "https:" + s;
  if (/^https?:\/\//i.test(s)) return s;
  try {
    return new URL(s, base).toString();
  } catch {
    return s;
  }
}

function normText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function looksLikeImageUrl(u) {
  const s = String(u || "").toLowerCase();
  return (
    /\.(png|jpe?g|webp|gif)(\?.*)?$/.test(s) ||
    s.includes("/image/cache/") ||
    s.includes("/assets/images/")
  );
}

function pickImgUrlFromNode($el, baseUrl) {
  const attrs = [
    "data-zoom-image",
    "data-large-image",
    "data-image",
    "data-original",
    "data-src",
    "data-lazy",
    "data-lazy-src",
  ];

  for (const a of attrs) {
    const v = $el.attr(a);
    if (v && looksLikeImageUrl(v)) return absUrl(v, baseUrl);
  }

  const srcset = $el.attr("srcset") || $el.attr("data-srcset") || "";
  if (srcset) {
    const parts = srcset
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1] || "";
    const url = last.split(/\s+/)[0] || "";
    if (url && looksLikeImageUrl(url)) return absUrl(url, baseUrl);
  }

  const src = $el.attr("src") || "";
  if (src && looksLikeImageUrl(src)) return absUrl(src, baseUrl);

  return "";
}

function rewriteRelativeUrls(html, baseUrl) {
  if (!html) return "";
  const $ = cheerio.load(html, { decodeEntities: false });

  $("[href]").each((_, el) => {
    const v = $(el).attr("href");
    if (v) $(el).attr("href", absUrl(v, baseUrl));
  });

  $("[src]").each((_, el) => {
    const v = $(el).attr("src");
    if (v) $(el).attr("src", absUrl(v, baseUrl));
  });

  $("[srcset]").each((_, el) => {
    const v = $(el).attr("srcset");
    if (!v) return;
    const fixed = v
      .split(",")
      .map((part) => {
        const p = part.trim();
        if (!p) return "";
        const [u, size] = p.split(/\s+/);
        const fu = absUrl(u, baseUrl);
        return size ? `${fu} ${size}` : fu;
      })
      .filter(Boolean)
      .join(", ");
    $(el).attr("srcset", fixed);
  });

  return $.root().html() || "";
}

function removePriceRows(html) {
  if (KEEP_PRICE) return html || "";
  let out = html || "";
  out = out.replace(
    /<tr[^>]*>[\s\S]*?<t[hd][^>]*>\s*price\s*<\/t[hd]>[\s\S]*?<\/tr>/gi,
    ""
  );
  out = out.replace(/<tr[^>]*>[\s\S]*?<\/tr>/gi, (tr) =>
    /\bprice\b/i.test(tr) && /\$|usd|krw|eur|gbp/i.test(tr) ? "" : tr
  );
  return out;
}

function pickProductScope($) {
  for (const sel of ["#content", "main", ".product-product", ".product-info", "body"]) {
    const el = $(sel).first();
    if (el.length) {
      el.find("script,noscript,style,header,footer,nav").remove();
      return el;
    }
  }
  return $("body");
}

/** ---- gallery: "갤러리 컨테이너"만 잡아서 추출(잡이미지 혼입 방지) */
function findBestGalleryContainer($scope, $) {
  // 우선순위: ABM(OpenCart)에서 자주 쓰는 컨테이너
  const primary = ["#image-additional", ".image-additional", ".thumbnails", ".product-images", ".product-image"];

  for (const sel of primary) {
    const el = $scope.find(sel).filter((_, x) => $(x).find("img").length >= 2).first();
    if (el.length) return el;
  }

  // fallback: 점수 기반
  const selectorCandidates = [
    ".product-media",
    ".gallery",
    ".swiper",
    ".slick",
    ".owl-carousel",
  ];

  const scored = [];

  for (const sel of selectorCandidates) {
    $scope.find(sel).each((_, el) => {
      const $el = $(el);
      const aImgs = $el.find("a[href]").filter((_, a) => looksLikeImageUrl($(a).attr("href"))).length;
      const imgs = $el.find("img").length;
      const score = aImgs * 3 + imgs;
      if (score >= 6) scored.push({ el: $el, score });
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.el || null;
}

function extractGalleryImageUrls($scope, baseUrl, $) {
  const container = findBestGalleryContainer($scope, $) || $scope;

  const out = [];

  // 1) a[href] 우선 (대개 큰 이미지)
  container.find("a[href]").each((_, a) => {
    const href = $(a).attr("href") || "";
    if (looksLikeImageUrl(href)) out.push(absUrl(href, baseUrl));
  });

  // 2) img 속성들(zoom/large/srcset/src)
  container.find("img").each((_, img) => {
    const u = pickImgUrlFromNode($(img), baseUrl);
    if (u) out.push(u);
  });

  // 순서 유지 중복 제거
  const seen = new Set();
  return out.filter((u) => (seen.has(u) ? false : (seen.add(u), true)));
}

function toImageFiles(imageUrls) {
  return (imageUrls || []).map((u) => {
    try {
      const p = new URL(u).pathname;
      return decodeURIComponent(p.split("/").pop() || "");
    } catch {
      return "";
    }
  });
}

/** ---- tabs: nav의 href(#id) -> tab-pane innerHTML 그대로 */
function findTabNav($scope, $) {
  const candidates = [];
  $scope.find("ul,ol,div,nav").each((_, el) => {
    const $el = $(el);
    const links = $el.find("a");
    if (links.length < 3) return;

    const hits = new Set();
    links.each((__, a) => {
      const t = normText($(a).text()).toLowerCase();
      for (const L of TAB_LABELS) if (t === L.toLowerCase()) hits.add(L);
    });

    if (hits.size >= 3) candidates.push({ el: $el, hit: hits.size });
  });

  candidates.sort((a, b) => b.hit - a.hit);
  return candidates[0]?.el || null;
}

function extractTabHrefMap($nav, $) {
  const map = new Map();
  if (!$nav) return map;

  $nav.find("a").each((_, a) => {
    const label = normText($(a).text());
    const key = TAB_LABELS.find((L) => L.toLowerCase() === label.toLowerCase());
    if (!key) return;

    const href = ($(a).attr("href") || $(a).attr("data-target") || "").trim();
    if (href.startsWith("#")) map.set(key, href);
  });

  return map;
}

function extractTabPaneHtml($scope, $, baseUrl) {
  const nav = findTabNav($scope, $);
  const hrefMap = nav ? extractTabHrefMap(nav, $) : new Map();

  const out = {
    specsHtml: "",
    datasheetHtml: "",
    documentsHtml: "",
    faqsHtml: "",
    referencesHtml: "",
    reviewsHtml: "",
    docs: [],
    debugTabHref: Object.fromEntries([...hrefMap.entries()]),
  };

  // 1) 탭 pane HTML
  for (const label of TAB_LABELS) {
    const href = hrefMap.get(label);
    if (!href) continue;

    const id = href.replace(/^#/, "");
    const pane = $scope.find(`#${id}`).first();
    if (!pane.length) continue;

    const inner = pane.html() || "";
    const fixed = rewriteRelativeUrls(inner, baseUrl).trim();

    if (label === "Specifications") out.specsHtml = removePriceRows(fixed);
    if (label === "Datasheet") out.datasheetHtml = fixed;
    if (label === "Documents") out.documentsHtml = fixed;
    if (label === "FAQs") out.faqsHtml = fixed;
    if (label === "References") out.referencesHtml = fixed;
    if (label === "Reviews") out.reviewsHtml = fixed;
  }

  // 2) docs 링크 파싱 (✅ 여기 버그 수정됨: cheerio 인스턴스 분리)
  const docs = [];

  const scanLinks = ($root, $fn) => {
    $root.find("a[href]").each((_, a) => {
      const raw = $fn(a).attr("href") || "";
      const href = absUrl(raw, baseUrl);
      if (!href) return;
      if (!/\.(pdf|doc|docx)(\?|#|$)/i.test(href)) return;

      const label = normText($fn(a).text()) || path.basename(href.split("?")[0]);
      docs.push({ url: href, label });
    });
  };

  if (out.documentsHtml) {
    const $d = cheerio.load(`<div>${out.documentsHtml}</div>`, { decodeEntities: false });
    scanLinks($d("div"), $d);
  } else {
    // documentsHtml이 없을 때는 scope 전체에서 pdf/doc 링크 fallback 탐색
    scanLinks($scope, $);
  }

  const seen = new Set();
  out.docs = docs.filter((d) => (seen.has(d.url) ? false : (seen.add(d.url), true)));

  return out;
}

function extractCatNo($scope) {
  const t = normText($scope.text());
  const m = t.match(/Cat\.\s*No\.\s*([A-Z0-9-]+)/i);
  if (m?.[1]) return m[1].trim();
  return "";
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "Mozilla/5.0 (ITSBIO 1to1 Enricher)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return await res.text();
}

function parseAbmDetail(html, url) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const $scope = pickProductScope($);

  const catNo = extractCatNo($scope);
  const imageUrls = extractGalleryImageUrls($scope, url, $);
  const imageFiles = toImageFiles(imageUrls);
  const sections = extractTabPaneHtml($scope, $, url);

  return { url, catNo, imageUrls, imageFiles, ...sections };
}

// ---- sanity queries
const PRODUCT_BY_SLUG_Q = `*[_type=="product" && slug.current==$slug][0]{_id,title,"slug":slug.current,sourceUrl}`;
const ABM_PRODUCTS_Q = `
*[
  _type=="product"
  && !(_id in path("drafts.**"))
  && (brand->themeKey=="abm" || brand->slug.current=="abm")
  && defined(sourceUrl)
] | order(_createdAt asc){
  _id,title,"slug":slug.current,sourceUrl
}
`;

async function runOne(url) {
  const u = normalizeAbmUrl(url);
  console.log("\n[FETCH]", u);

  const html = await fetchHtml(u);
  const parsed = parseAbmDetail(html, u);

  console.log("  - catNo:", parsed.catNo || "(none)");
  console.log("  - imageUrls:", parsed.imageUrls.length);
  console.log("  - specsHtml:", (parsed.specsHtml || "").length);
  console.log("  - documentsHtml:", (parsed.documentsHtml || "").length, "docs:", (parsed.docs || []).length);
  console.log("  - tab href map:", parsed.debugTabHref);

  if (DUMP) {
    fs.mkdirSync("tmp", { recursive: true });
    const safe = u.split("/").pop()?.replace(/[^a-z0-9._-]+/gi, "-") || "abm";
    fs.writeFileSync(path.join("tmp", `${safe}.parsed.json`), JSON.stringify(parsed, null, 2), "utf-8");
    fs.writeFileSync(path.join("tmp", `${safe}.specs.html`), parsed.specsHtml || "", "utf-8");
    fs.writeFileSync(path.join("tmp", `${safe}.documents.html`), parsed.documentsHtml || "", "utf-8");
  }

  return parsed;
}

async function patchSanity(productId, parsed) {
  // ✅ 프론트가 보는 필드명에 맞춰 patch
  const patch = {
    ...(parsed.catNo ? { catNo: parsed.catNo, sku: parsed.catNo } : {}),
    imageUrls: parsed.imageUrls,
    imageFiles: parsed.imageFiles,

    specsHtml: parsed.specsHtml || "",
    datasheetHtml: parsed.datasheetHtml || "",
    documentsHtml: parsed.documentsHtml || "",
    faqsHtml: parsed.faqsHtml || "",
    referencesHtml: parsed.referencesHtml || "",
    reviewsHtml: parsed.reviewsHtml || "",

    // ✅ ProductTabs가 docs[].label/url을 보므로 label로 저장
    docs: (parsed.docs || []).map((d) => ({
      _type: "docItem",
      label: d.label,
      url: d.url,
    })),

    enrichedAt: new Date().toISOString(),
  };

  if (DRY) {
    console.log("  - [DRY] patch keys:", Object.keys(patch));
    return;
  }

  await sanity.patch(productId).set(patch).commit({ autoGenerateArrayKeys: true });
  console.log("  - ✅ patched:", productId);
}

async function main() {
  if (URL_ARG) {
    const parsed = await runOne(URL_ARG);
    if (PRINT_ONLY) return;
    console.log("[INFO] --url 모드는 patch 대상이 없어서 종료. patch하려면 --slug 또는 --from-sanity 사용.");
    return;
  }

  if (SLUG_ARG) {
    const row = await sanity.fetch(PRODUCT_BY_SLUG_Q, { slug: SLUG_ARG });
    if (!row?._id || !row?.sourceUrl) {
      console.error("[ERROR] product not found by slug or missing sourceUrl:", SLUG_ARG);
      process.exit(1);
    }
    const parsed = await runOne(row.sourceUrl);
    if (PRINT_ONLY) return;
    await patchSanity(row._id, parsed);
    return;
  }

  if (FROM_SANITY) {
    const list = await sanity.fetch(ABM_PRODUCTS_Q);
    const targets = Array.isArray(list) ? list : [];
    const sliced = LIMIT > 0 ? targets.slice(0, LIMIT) : targets;

    console.log("[TARGETS]", sliced.length);

    for (let i = 0; i < sliced.length; i++) {
      const p = sliced[i];
      console.log(`\n[${i + 1}/${sliced.length}] ${p.slug || p._id}`);
      const parsed = await runOne(p.sourceUrl);
      if (!PRINT_ONLY) await patchSanity(p._id, parsed);
      await sleep(600);
    }
    return;
  }

  console.log(`
No mode selected.

Examples:
  node --env-file=.env.local scripts/abm-enrich-1to1.mjs --slug blastaq-2x-qpcr-mastermix --dump
  node --env-file=.env.local scripts/abm-enrich-1to1.mjs --url https://www.abmgood.com/blastaq-2x-qpcr-mastermix.html --print-only --dump
  node --env-file=.env.local scripts/abm-enrich-1to1.mjs --from-sanity --limit 30
`);
}

main().catch((e) => {
  console.error("\n[abm-enrich-1to1] ERROR:", e?.message || e);
  process.exit(1);
});