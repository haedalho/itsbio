// scripts/abm-sync-all-products-nav.mjs
// -----------------------------------------------------------------------------
// ABM All Products 메뉴(ul.abm-page-category-nav-list)를 파싱해서
// Sanity category 트리를 1:1로 동기화한다.
//
// - ABM에 있는 것: 없으면 생성, 있으면 path/parent/order/title/sourceUrl/isActive만 맞춘다(본문은 건드리지 않음)
// - ABM에 없는 것(우리 Sanity에만 존재): 삭제하지 않고 isActive=false로 "제거(숨김)"
// - 절대 ABM에 있는 건 삭제하지 않음
//
// 사용:
//   node --env-file=.env.local scripts/abm-sync-all-products-nav.mjs --brand abm --seed https://www.abmgood.com/general-materials.html
//   node --env-file=.env.local scripts/abm-sync-all-products-nav.mjs --brand abm --dryRun
//
// 옵션:
//   --seed <url>          기본: https://www.abmgood.com/general-materials.html
//   --brand abm
//   --dryRun
//   --deactivateExtras    기본 true (ABM에 없는 카테고리 isActive=false)
//   --limit 0             (0이면 전체)
// -----------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { createClient } from "next-sanity";

const argv = process.argv.slice(2);
const hasFlag = (k) => argv.includes(k);
const getArg = (k, fallback = null) => {
  const i = argv.indexOf(k);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  if (!v || v.startsWith("--")) return fallback;
  return v;
};

const BRAND = String(getArg("--brand", "abm") || "abm").trim().toLowerCase();
const SEED = String(getArg("--seed", "https://www.abmgood.com/general-materials.html") || "").trim();
const DRY = hasFlag("--dryRun") || hasFlag("--dry");
const DEACTIVATE_EXTRAS = !hasFlag("--noDeactivateExtras") && !hasFlag("--no-deactivate-extras");
const LIMIT = Number(getArg("--limit", "0") || "0") || 0;

const PROJECT_ID = (process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "").trim();
const DATASET = (process.env.NEXT_PUBLIC_SANITY_DATASET || "").trim();
const API_VERSION = (process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const TOKEN = (process.env.SANITY_WRITE_TOKEN || "").trim();

if (!PROJECT_ID || !DATASET) throw new Error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET");
if (!TOKEN) throw new Error("Missing SANITY_WRITE_TOKEN");

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: TOKEN,
  useCdn: false,
});

const BASE = "https://www.abmgood.com";
const ABM_ROOTS = ["general-materials", "cellular-materials", "genetic-materials"];

const headers = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml",
  "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
  referer: "https://www.abmgood.com/",
};

function sha1Hex(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}
function collapseWs(s) {
  return String(s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
function normUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  try {
    const x = new URL(s, BASE);
    x.hash = "";
    x.search = "";
    return x.toString();
  } catch {
    return s;
  }
}
function absUrl(raw, base) {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("//")) return `https:${v}`;
  try {
    return new URL(v, base || BASE).toString();
  } catch {
    return v;
  }
}
function slugFromUrl(u) {
  try {
    const p = new URL(u, BASE).pathname;
    const name = (p.split("/").pop() || "").trim();
    return name.replace(/\.html$/i, "").trim();
  } catch {
    return "";
  }
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, { headers, redirect: "follow", cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function pickNavList($) {
  const lists = $("ul.abm-page-category-nav-list")
    .toArray()
    .map((el) => $(el));
  if (!lists.length) return null;
  lists.sort((a, b) => b.find("a[href]").length - a.find("a[href]").length);
  return lists[0];
}

function parseAllProductsTree($, baseUrl) {
  const $nav = pickNavList($);
  if (!$nav || !$nav.length) throw new Error("Cannot find ul.abm-page-category-nav-list (All Products)");

  const nodes = new Map();

  function upsertNode(pathArr, title, url, order, parentStr) {
    const pathStr = pathArr.join("/");
    if (!pathStr) return;
    if (!nodes.has(pathStr)) {
      nodes.set(pathStr, { path: pathArr, pathStr, title, url, order, parentStr });
    }
  }

  function walk($ul, parentPath) {
    const lis = $ul.children("li").toArray();
    lis.forEach((li, idx) => {
      const $li = $(li);
      const $a = $li.children("a[href]").first();
      if (!$a.length) return;

      const title = collapseWs($a.text());
      const href = String($a.attr("href") || "").trim();
      if (!href) return;

      const url = normUrl(absUrl(href, baseUrl));
      if (!url || !url.startsWith(BASE) || !url.toLowerCase().endsWith(".html")) return;

      const slug = slugFromUrl(url);
      if (!slug) return;

      const pathArr = [...parentPath, slug];
      const parentStr = parentPath.length ? parentPath.join("/") : "";

      upsertNode(pathArr, title || slug, url, idx, parentStr);

      const $child = $li.children("ul").first();
      if ($child.length) walk($child, pathArr);
    });
  }

  walk($nav, []);

  // ABM 3루트 아래만 유지
  return [...nodes.values()].filter((n) => ABM_ROOTS.includes(n.path[0]));
}

async function getBrandRef() {
  const b = await client.fetch(
    `*[_type=="brand" && (slug.current==$brand || themeKey==$brand)][0]{_id,title,"slug":slug.current,themeKey}`,
    { brand: BRAND }
  );
  if (!b?._id) throw new Error(`Brand not found: ${BRAND}`);
  return b;
}

async function getExistingCategories() {
  const rows = await client.fetch(
    `*[
      _type=="category"
      && (brand->slug.current==$brand || brand->themeKey==$brand || themeKey==$brand || brandSlug==$brand)
    ]{
      _id,title,path,sourceUrl,order,isActive,parent
    }`,
    { brand: BRAND }
  );

  const byPath = new Map();
  const byUrl = new Map();

  for (const r of rows || []) {
    const pathStr = Array.isArray(r?.path) ? r.path.join("/") : "";
    if (pathStr) byPath.set(pathStr, r);
    const u = normUrl(r?.sourceUrl || "");
    if (u) byUrl.set(u, r);
  }

  return { rows: rows || [], byPath, byUrl };
}

function preferredIdForPath(pathArr) {
  const pathStr = pathArr.join("/");
  return `cat_${BRAND}__${pathStr.replaceAll("/", "__")}`;
}

async function main() {
  console.log(JSON.stringify({ brand: BRAND, seed: SEED, dryRun: DRY, deactivateExtras: DEACTIVATE_EXTRAS }, null, 2));

  const brand = await getBrandRef();
  const html = await fetchHtml(SEED);
  const $ = cheerio.load(html, { decodeEntities: false });

  const canon = parseAllProductsTree($, SEED);
  const canonByPath = new Map(canon.map((n) => [n.pathStr, n]));
  const canonUrls = new Set(canon.map((n) => n.url));

  canon.sort((a, b) => a.path.length - b.path.length);

  const existing = await getExistingCategories();

  let created = 0;
  let patched = 0;
  let failed = 0;

  // pathStr -> _id
  const idByPath = new Map();
  for (const r of existing.rows) {
    const pathStr = Array.isArray(r?.path) ? r.path.join("/") : "";
    if (pathStr && r?._id) idByPath.set(pathStr, r._id);
  }

  const targets = LIMIT ? canon.slice(0, LIMIT) : canon;

  let tx = client.transaction();
  let txCount = 0;

  const flush = async () => {
    if (DRY) {
      tx = client.transaction();
      txCount = 0;
      return;
    }
    if (txCount === 0) return;
    await tx.commit({ autoGenerateArrayKeys: true });
    tx = client.transaction();
    txCount = 0;
  };

  for (const n of targets) {
    try {
      const pathStr = n.pathStr;
      const url = n.url;
      const title = n.title || slugFromUrl(url);
      const order = typeof n.order === "number" ? n.order : 0;

      // 기존 문서 찾기: path 우선, 없으면 url
      const ex = existing.byPath.get(pathStr) || existing.byUrl.get(url);

      const id = ex?._id || preferredIdForPath(n.path);
      const parentPathStr = n.parentStr || "";
      const parentId = parentPathStr ? (idByPath.get(parentPathStr) || "") : "";

      if (!ex) {
        idByPath.set(pathStr, id);
        if (!DRY) {
          tx = tx.createIfNotExists({
            _id: id,
            _type: "category",
            title,
            brand: { _type: "reference", _ref: brand._id },
            themeKey: BRAND,
            path: n.path,
            parent: parentId ? { _type: "reference", _ref: parentId } : undefined,
            sourceUrl: url,
            order,
            isActive: true,
          });
          txCount++;
        }
        created++;
      }

      if (!DRY) {
        // ✅ 체이닝 set() 대신 patch(id, {set:...})
        tx = tx.patch(id, {
          set: {
            title,
            brand: { _type: "reference", _ref: brand._id },
            themeKey: BRAND,
            path: n.path,
            parent: parentId ? { _type: "reference", _ref: parentId } : null,
            sourceUrl: url,
            order,
            isActive: true,
          },
        });
        txCount++;
      }

      idByPath.set(pathStr, id);
      patched++;

      if (txCount >= 80) await flush();
    } catch (e) {
      failed++;
      console.error("FAIL:", n.pathStr, e?.message || e);
    }
  }

  await flush();

  let deactivated = 0;

  if (DEACTIVATE_EXTRAS) {
    const extras = existing.rows.filter((r) => {
      const pathStr = Array.isArray(r?.path) ? r.path.join("/") : "";
      const url = normUrl(r?.sourceUrl || "");
      const inCanon = (pathStr && canonByPath.has(pathStr)) || (url && canonUrls.has(url));
      return !inCanon;
    });

    if (!DRY) {
      let tx2 = client.transaction();
      let c = 0;

      for (const r of extras) {
        // ✅ 여기도 patch(id,{set:{...}})
        tx2 = tx2.patch(r._id, {
          set: { isActive: false, order: 999999 },
        });
        c++;

        if (c >= 120) {
          await tx2.commit({ autoGenerateArrayKeys: true });
          tx2 = client.transaction();
          c = 0;
        }
      }
      if (c > 0) await tx2.commit({ autoGenerateArrayKeys: true });
    }

    deactivated = extras.length;
  }

  const outPath = path.resolve(".cache/abm_all_products_tree.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ seed: SEED, count: canon.length, nodes: canon }, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        done: true,
        seed: SEED,
        canonCount: canon.length,
        created,
        patched,
        failed,
        deactivated,
        wrote: outPath,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error("[FATAL]", e?.message || e);
  process.exit(1);
});