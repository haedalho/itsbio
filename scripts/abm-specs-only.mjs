#!/usr/bin/env node
/**
 * ABM specs-only re-enricher (TAB-aware)
 * - Existing products만 대상으로 "Specifications" 탭 패널을 찾아 specsHtml만 patch
 *
 * Usage:
 *   node --env-file=.env.local scripts/abm-specs-only.mjs --only-missing
 *   node --env-file=.env.local scripts/abm-specs-only.mjs --limit 50
 *   node --env-file=.env.local scripts/abm-specs-only.mjs --all
 */

import process from "node:process";
import { createClient } from "next-sanity";

const BRAND_KEY = "abm";
const BASE = "https://www.abmgood.com";

// ---- args
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const readArg = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
};

const LIMIT = Number(readArg("--limit") || "0") || 0;
const ONLY_MISSING = has("--only-missing");
const ALL = has("--all");

// ---- env
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId || !dataset || !token) {
  console.error("Missing env. Need NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_WRITE_TOKEN");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  apiVersion: "2025-01-01",
  useCdn: false,
  token,
});

// ---- tuning
const FETCH_TIMEOUT_MS = 25000;
const FETCH_RETRY = 2;
const SLEEP_PER_ITEM_MS = 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
  for (let attempt = 0; attempt <= FETCH_RETRY; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "user-agent": "Mozilla/5.0 (ITSBIO specs-only)",
          accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      const msg = e?.name === "AbortError" ? "TIMEOUT" : (e?.message || String(e));
      console.log(`  - fetch error (${attempt + 1}/${FETCH_RETRY + 1}): ${msg}`);
      if (attempt === FETCH_RETRY) throw e;
      await sleep(700 + attempt * 600);
    }
  }
}

// ✅ 핵심: 깨진 sourceUrl/slug를 정상 ABM product URL로 보정
function normalizeToProductUrl(sourceUrlOrSlug) {
  if (!sourceUrlOrSlug) return "";
  let raw = String(sourceUrlOrSlug).trim();
  raw = raw.replace(/[\?#].*$/g, "");

  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      const pathname = u.pathname || "/";
      const fixed = new URL(pathname, BASE);
      return fixed.href;
    }
  } catch (_) {}

  try {
    const fixed = new URL(raw, BASE);
    return fixed.href;
  } catch (_) {
    return "";
  }
}

function extractBody(html) {
  const m = (html || "").match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (m?.[1] || html || "").trim();
}

function stripScripts(html) {
  return (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .trim();
}

function rewriteRelativeUrls(html) {
  let out = html || "";
  out = out.replace(/\s(href|src)=["'](\/(?!\/)[^"']*)["']/gi, (_m, attr, p) => ` ${attr}="${BASE}${p}"`);
  out = out.replace(/\s(href|src)=["'](\/\/[^"']+)["']/gi, (_m, attr, p2) => ` ${attr}="https:${p2}"`);
  return out;
}

// ✅ Price 행 제거(원하면 여기 주석 처리 가능)
function removePriceRowsFromTables(html) {
  let out = html || "";
  out = out.replace(/<tr[^>]*>[\s\S]*?<t[hd][^>]*>\s*price\s*<\/t[hd]>[\s\S]*?<\/tr>/gi, "");
  out = out.replace(/<tr[^>]*>[\s\S]*?\bprice\b[\s\S]*?<\/tr>/gi, (tr) =>
    /\$|usd|krw|eur|gbp|price/i.test(tr) ? "" : tr
  );
  return out;
}

/**
 * ✅ 너가 캡처한 화면(탭 UI) 대응:
 * 1) "Specifications" 탭 링크(<a ... href="#SOMEID">Specifications</a>)를 찾는다
 * 2) 그 SOMEID(탭 패널 id)를 찾는다
 * 3) <div id="SOMEID" ...> ... </div> 내부를 통째로 specs로 저장한다
 *
 * 헤딩/테이블만 찾는 방식은 탭 구조에서 실패해서 specsLen=0이 나옴.
 */
function extractSpecificationsSection(bodyHtml) {
  const html = bodyHtml || "";
  if (!html) return "";

  // ---- A) 탭 링크에서 target id 찾기 (Bootstrap류: href="#xxx", data-target="#xxx", data-bs-target="#xxx")
  // "Specifications" 텍스트를 포함하는 <a ...> 를 먼저 찾는다
  const tabLinkRe =
    /<a\b[^>]*(?:href|data-target|data-bs-target)=["']#([^"']+)["'][^>]*>\s*Specifications\s*<\/a>/i;

  const tabLinkMatch = html.match(tabLinkRe);
  const targetId = tabLinkMatch?.[1]?.trim();

  // ---- B) target 패널 추출
  if (targetId) {
    // <div id="targetId" ...> ... </div> 를 크게 잡는다
    // tab-pane / panel 등 class가 섞여 있어도 id 기준으로 잡는다
    const panelRe = new RegExp(
      `<([a-z]+)\\b[^>]*\\bid=["']${escapeRegExp(targetId)}["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
      "i"
    );
    const panelMatch = html.match(panelRe);
    if (panelMatch?.[0]) {
      const panelHtml = panelMatch[0].trim();

      // panel 내부에 table이 있으면 table만 모아서 저장(더 깔끔)
      const tables = panelHtml.match(/<table[\s\S]*?<\/table>/gi) || [];
      if (tables.length) return tables.join("\n");

      // table이 없으면 패널 전체를 저장(너가 캡처한 것은 table+텍스트 혼합일 수도 있음)
      return panelHtml;
    }
  }

  // ---- C) 혹시 id를 못 찾으면 class/id로 직접 잡기
  // ex) id="specifications" / class="specifications" / class="tab-pane" 안에서 Specifications 패널
  const directPanelRe =
    /<([a-z]+)\b[^>]*(?:id|class)=["'][^"']*(specifications|specs)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i;
  const directMatch = html.match(directPanelRe);
  if (directMatch?.[0]) {
    const block = directMatch[0].trim();
    const tables = block.match(/<table[\s\S]*?<\/table>/gi) || [];
    if (tables.length) return tables.join("\n");
    return block;
  }

  // ---- D) 최후 fallback: spec 관련 table, 또는 가장 큰 table
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  for (const t of tables) {
    const low = t.toLowerCase();
    if (low.includes("spec") || low.includes("specification") || low.includes("parameter")) {
      return t;
    }
  }
  if (tables.length) {
    let best = "";
    for (const t of tables) if (t.length > best.length) best = t;
    return best;
  }

  return "";
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchTargets() {
  const q = `
*[
  _type=="product"
  && !(_id in path("drafts.**"))
  && (brand->themeKey==$brandKey || brand->slug.current==$brandKey)
  && defined(sourceUrl)
  ${ALL ? "" : ONLY_MISSING ? "&& (!defined(specsHtml) || specsHtml == \"\")" : ""}
]
| order(_updatedAt asc){
  _id,
  title,
  "slug": slug.current,
  sourceUrl,
  specsHtml
}
`;
  const rows = await sanity.fetch(q, { brandKey: BRAND_KEY });
  const list = Array.isArray(rows) ? rows : [];
  return LIMIT > 0 ? list.slice(0, LIMIT) : list;
}

async function patchSpecs(productId, specsHtml) {
  await sanity.patch(productId).set({ specsHtml }).commit({ autoGenerateArrayKeys: true });
}

async function main() {
  const targets = await fetchTargets();
  console.log("Targets:", targets.length);
  if (!targets.length) return;

  let ok = 0;
  let fail = 0;
  let skip = 0;

  for (let i = 0; i < targets.length; i++) {
    const p = targets[i];
    const label = p?.slug || p?._id;
    console.log(`\n[${i + 1}/${targets.length}] ${label}`);

    const url = normalizeToProductUrl(p.sourceUrl || p.slug);
    console.log("  - url:", url);

    if (!url || !/abmgood\.com/i.test(url)) {
      console.log("  - invalid url (skip)");
      skip++;
      await sleep(SLEEP_PER_ITEM_MS);
      continue;
    }

    let html;
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        console.log("  - fetch failed:", res.status);
        fail++;
        await sleep(SLEEP_PER_ITEM_MS);
        continue;
      }
      html = await res.text();
    } catch (e) {
      console.log("  - fetch error:", e?.message || e);
      fail++;
      await sleep(SLEEP_PER_ITEM_MS);
      continue;
    }

    let body = extractBody(html);
    body = stripScripts(body);
    body = rewriteRelativeUrls(body);

    let specs = extractSpecificationsSection(body);
    specs = removePriceRowsFromTables(specs);

    const specsLen = (specs || "").trim().length;
    console.log("  - specsLen:", specsLen);

    if (!specsLen) {
      // 디버깅 힌트: 정말 HTML에 "Specifications" 자체가 없는 경우는 JS로 API 로드일 확률이 큼
      const hasWord = /Specifications/i.test(body);
      console.log("  - bodyHasWord(Specifications):", hasWord);
      console.log("  - no specs extracted (skip patch)");
      skip++;
      await sleep(SLEEP_PER_ITEM_MS);
      continue;
    }

    try {
      await patchSpecs(p._id, specs.trim());
      ok++;
      console.log("  - patched specsHtml ✅");
    } catch (e) {
      fail++;
      console.log("  - patch failed:", e?.message || e);
    }

    await sleep(SLEEP_PER_ITEM_MS);
  }

  console.log("\nDone.");
  console.log("OK:", ok);
  console.log("FAIL:", fail);
  console.log("SKIP:", skip);
}

main().catch((e) => {
  console.error("\n[abm-specs-only] ERROR", e?.message || e);
  process.exit(1);
});
