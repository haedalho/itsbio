// scripts/abm-fix-category-paths-from-nav.mjs
// -----------------------------------------------------------------------------
// 목적:
// - ABM category 문서 중 "루트(path 길이 1)"로 잘못 들어간 것들을
//   ABM 페이지의 왼쪽 All Products 메뉴(ul.abm-page-category-nav-list)에서
//   현재 페이지 위치를 찾아 올바른 path(루트/조상 포함)로 다시 패치한다.
// - parent(reference)도 함께 맞춘다.
// - path 충돌(같은 pathStr을 가진 다른 문서가 이미 존재)하면 기본은 SKIP.
//   (원하면 --deleteOnConflict 로 현재 문서를 삭제하도록 가능)
//
// 사용:
//   node --env-file=.env.local scripts/abm-fix-category-paths-from-nav.mjs --brand abm
//   node --env-file=.env.local scripts/abm-fix-category-paths-from-nav.mjs --brand abm --onlyBadRoots
//   node --env-file=.env.local scripts/abm-fix-category-paths-from-nav.mjs --brand abm --limit 50
//   node --env-file=.env.local scripts/abm-fix-category-paths-from-nav.mjs --brand abm --dryRun
//
// 옵션:
//   --brand abm
//   --roots general-materials,cellular-materials,genetic-materials   (기본 3개)
//   --onlyBadRoots        : path 길이 1인데 roots에 포함되지 않는 것만 처리(추천)
//   --limit 100
//   --dryRun
//   --deleteOnConflict    : path 충돌이면 현재 doc 삭제(주의)
// -----------------------------------------------------------------------------

import crypto from "node:crypto";
import { createClient } from "next-sanity";
import * as cheerio from "cheerio";

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
const ROOTS = String(getArg("--roots", "general-materials,cellular-materials,genetic-materials") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ONLY_BAD_ROOTS = hasFlag("--onlyBadRoots") || hasFlag("--only-bad-roots");
const LIMIT = Number(getArg("--limit", "0") || "0") || 0;
const DRY = hasFlag("--dryRun") || hasFlag("--dry");
const DELETE_ON_CONFLICT = hasFlag("--deleteOnConflict") || hasFlag("--delete-on-conflict");

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

function slugFromHref(u) {
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

function pickBestNavList($) {
  const lists = $("ul.abm-page-category-nav-list").toArray().map((el) => $(el));
  if (lists.length) {
    lists.sort((a, b) => b.find("a[href]").length - a.find("a[href]").length);
    return lists[0];
  }

  // fallback: left outer
  const left = $("#abm-category-left-outer").find("ul").first();
  if (left.length) return left;

  return null;
}

function findPathFromNav($, pageUrl) {
  const $nav = pickBestNavList($);
  if (!$nav || !$nav.length) return [];

  const page = normUrl(pageUrl);
  let filename = "";
  try {
    filename = new URL(page).pathname.split("/").pop() || "";
  } catch {
    filename = "";
  }
  const filenameLower = filename.toLowerCase();

  // 1) 정확 매칭 우선
  let $match = null;
  $nav.find("a[href]").each((_, a) => {
    const href = $(a).attr("href") || "";
    const abs = normUrl(absUrl(href, pageUrl));
    if (abs && abs === page) {
      $match = $(a);
      return false;
    }
    return;
  });

  // 2) filename 매칭(대소문자 무시)
  if (!$match && filenameLower) {
    $nav.find("a[href]").each((_, a) => {
      const href = $(a).attr("href") || "";
      const abs = absUrl(href, pageUrl);
      if (!abs) return;
      const tail = abs.toLowerCase().split("/").pop() || "";
      if (tail === filenameLower) {
        $match = $(a);
        return false;
      }
    });
  }

  if (!$match) return [];

  const slugs = [];
  let $li = $match.closest("li");

  // li -> (ul) -> (li) 로 올라가면서 조상 a[href]를 수집
  while ($li && $li.length) {
    let $a = $li.children("a[href]").first();
    if (!$a.length) $a = $li.find("> a[href]").first();
    if ($a.length) {
      const href = $a.attr("href") || "";
      const abs = absUrl(href, pageUrl);
      const slug = slugFromHref(abs);
      if (slug) slugs.push(slug);
    }
    $li = $li.parent().parent().closest("li");
  }

  // root -> leaf
  const out = slugs.reverse();

  // 중복 제거
  const dedup = [];
  for (const s of out) {
    if (!dedup.length || dedup[dedup.length - 1] !== s) dedup.push(s);
  }

  return dedup;
}

async function ensureBrand() {
  const b = await client.fetch(
    `*[_type=="brand" && (slug.current==$brand || themeKey==$brand)][0]{_id,title,"slug":slug.current,themeKey}`,
    { brand: BRAND }
  );
  if (!b?._id) throw new Error(`Brand not found: ${BRAND}`);
  return b;
}

async function getCategoryIdByPath(brandId, pathArr) {
  const pathStr = pathArr.join("/");
  const hit = await client.fetch(
    `*[_type=="category"
      && (brand._ref==$brandId || brand->slug.current==$brand || brand->themeKey==$brand || themeKey==$brand || brandSlug==$brand)
      && array::join(path,"/")==$pathStr
    ][0]{_id}`,
    { brandId, brand: BRAND, pathStr }
  );
  return hit?._id || "";
}

async function ensureCategoryStub(brandId, pathArr) {
  // 부모가 없을 때 최소 문서 생성(없으면)
  const pathStr = pathArr.join("/");
  const id = `cat_abm__${pathStr.replaceAll("/", "__")}`;
  const title = (pathArr[pathArr.length - 1] || "").replaceAll("-", " ").replaceAll("_", " ").trim();

  if (DRY) return id;

  await client.createIfNotExists({
    _id: id,
    _type: "category",
    title: title || "(untitled)",
    brand: { _type: "reference", _ref: brandId },
    path: pathArr,
    themeKey: BRAND,
    sourceUrl: `${BASE}/${(pathArr[pathArr.length - 1] || "").trim()}.html`,
    order: 0,
  });

  return id;
}

async function main() {
  const brand = await ensureBrand();

  // 대상: abm category 중 sourceUrl 있고 path 길이 1인 것들
  // onlyBadRoots면 ROOTS에 포함되는 3개는 제외
  const list = await client.fetch(
    `*[
      _type=="category"
      && (brand->slug.current==$brand || brand->themeKey==$brand || themeKey==$brand || brandSlug==$brand || brand._ref==$brandId)
      && defined(sourceUrl)
      && count(path)==1
    ]{
      _id,title,path,sourceUrl
    }|order(_createdAt asc)`,
    { brand: BRAND, brandId: brand._id }
  );

  let targets = list || [];
  if (ONLY_BAD_ROOTS) {
    targets = targets.filter((d) => !ROOTS.includes(String(d?.path?.[0] || "")));
  }
  if (LIMIT) targets = targets.slice(0, LIMIT);

  console.log(
    JSON.stringify(
      { brand: BRAND, roots: ROOTS, onlyBadRoots: ONLY_BAD_ROOTS, dryRun: DRY, deleteOnConflict: DELETE_ON_CONFLICT, targets: targets.length },
      null,
      2
    )
  );

  let patched = 0;
  let skipped = 0;
  let failed = 0;
  let deleted = 0;

  for (const d of targets) {
    const src = normUrl(d.sourceUrl);
    if (!src) {
      skipped++;
      console.log({ status: "skip", id: d._id, reason: "no-sourceUrl" });
      continue;
    }

    try {
      const html = await fetchHtml(src);
      const $ = cheerio.load(html, { decodeEntities: false });

      const pathArr = findPathFromNav($, src);

      if (!pathArr.length) {
        skipped++;
        console.log({ status: "skip", id: d._id, url: src, reason: "nav-path-not-found" });
        continue;
      }

      // root가 3개 중 하나로 시작하면 가장 이상적
      // (아니어도 pathArr 자체는 의미가 있으니 일단 진행)
      const pathStr = pathArr.join("/");

      // path 충돌 체크
      const dup = await client.fetch(
        `*[_type=="category"
          && _id!=$id
          && (brand->slug.current==$brand || brand->themeKey==$brand || themeKey==$brand || brandSlug==$brand || brand._ref==$brandId)
          && array::join(path,"/")==$pathStr
        ]{_id}[0]`,
        { id: d._id, brand: BRAND, brandId: brand._id, pathStr }
      );

      if (dup?._id) {
        if (DELETE_ON_CONFLICT && !DRY) {
          await client.delete(d._id);
          deleted++;
          console.log({ status: "deleted-on-conflict", id: d._id, conflictWith: dup._id, path: pathStr });
          continue;
        }
        skipped++;
        console.log({ status: "skip-conflict", id: d._id, conflictWith: dup._id, path: pathStr });
        continue;
      }

      // parent 확보
      let parentRef = null;
      if (pathArr.length > 1) {
        const parentPath = pathArr.slice(0, -1);
        let parentId = await getCategoryIdByPath(brand._id, parentPath);
        if (!parentId) parentId = await ensureCategoryStub(brand._id, parentPath);
        parentRef = { _type: "reference", _ref: parentId };
      }

      if (DRY) {
        console.log({ status: "dry-would-patch", id: d._id, from: (d.path || []).join("/"), to: pathStr, parent: parentRef?._ref || null });
        continue;
      }

      await client
        .patch(d._id)
        .set({
          path: pathArr,
          themeKey: BRAND,
          brand: { _type: "reference", _ref: brand._id },
          ...(parentRef ? { parent: parentRef } : { parent: null }),
        })
        .commit({ autoGenerateArrayKeys: true });

      patched++;
      console.log({ status: "patched", id: d._id, to: pathStr, parent: parentRef?._ref || null });
    } catch (e) {
      failed++;
      console.log({ status: "fail", id: d._id, url: src, error: e?.message || String(e) });
    }
  }

  console.log(JSON.stringify({ done: true, patched, skipped, failed, deleted }, null, 2));
}

main().catch((e) => {
  console.error("[FATAL]", e?.message || e);
  process.exit(1);
});