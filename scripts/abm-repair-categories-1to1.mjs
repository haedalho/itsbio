// scripts/abm-repair-categories-1to1.mjs
import "dotenv/config";
import { createClient } from "@sanity/client";
import * as cheerio from "cheerio";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");

const LIMIT = (() => {
  const i = argv.indexOf("--limit");
  if (i >= 0) return Number(argv[i + 1] || "0") || 0;
  return 0;
})();

function must(name) {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const client = createClient({
  projectId: must("NEXT_PUBLIC_SANITY_PROJECT_ID"),
  dataset: must("NEXT_PUBLIC_SANITY_DATASET"),
  apiVersion: (process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim(),
  token: must("SANITY_WRITE_TOKEN"),
  useCdn: false,
});

const BASE = "https://www.abmgood.com";

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

function collapseWs(s) {
  return String(s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function stripBrandSuffix(title) {
  const t = collapseWs(title);
  const i = t.indexOf("|");
  return (i >= 0 ? t.slice(0, i) : t).trim();
}

function slugFromUrl(u) {
  try {
    const p = new URL(u).pathname; // /qpcr.html
    const name = p.split("/").pop() || "";
    const noExt = name.replace(/\.html$/i, "");
    return noExt.trim();
  } catch {
    return "";
  }
}

function absUrl(raw, base) {
  const v = String(raw || "").trim();
  if (!v) return "";
  try {
    return new URL(v, base).toString();
  } catch {
    return v;
  }
}

function rewriteRelativeUrls(html, baseUrl) {
  if (!html) return "";
  let out = html;

  out = out.replace(/\s(href|src)=["'](\/(?!\/)[^"']*)["']/gi, (_m, attr, p) => ` ${attr}="${baseUrl}${p}"`);
  out = out.replace(/\s(href|src)=["'](\/\/[^"']+)["']/gi, (_m, attr, p) => ` ${attr}="https:${p}"`);

  return out;
}

/** ✅ 규칙: Request Free Sample 제거 */
function stripRequestFreeSampleCheerio($root) {
  // a[href*="/free-sample"] 제거
  $root.find("a[href*='/free-sample']").remove();
  $root.find("a[href*='abmgood.com/free-sample']").remove();
  // 버튼 이미지 제거
  $root.find("img[src*='Request-Free-Sample-Button']").remove();
  // alt 기반도 제거
  $root.find("img[alt*='Request Free Sample']").remove();
}

function extractBreadcrumbs($, pageUrl) {
  // 다양한 breadcrumb 패턴 대응
  const links = [];

  const pick = (sel) => {
    $(sel)
      .find("a")
      .each((_, a) => {
        const t = collapseWs($(a).text());
        const href = absUrl($(a).attr("href") || "", pageUrl);
        if (!t || !href) return;
        links.push({ t, href });
      });

    // 마지막 crumb이 <a>가 아닐 수도 있어서 li 텍스트도 보조로
    $(sel)
      .find("li")
      .each((_, li) => {
        const t = collapseWs($(li).text());
        if (!t) return;
        // 링크로 이미 들어간 건 제외
        if (links.some((x) => x.t === t)) return;
        links.push({ t, href: "" });
      });
  };

  pick("ul.breadcrumb");
  pick("ol.breadcrumb");
  pick("nav[aria-label='breadcrumb']");

  // Home 제거 + category만 남기기(보통 .html 링크)
  const cleaned = links
    .map((x) => ({ title: x.t, url: x.href }))
    .filter((x) => x.title && x.title.toLowerCase() !== "home");

  // url이 없으면 slug 못 뽑으니 title만으로 유지(최후)
  const crumbs = cleaned
    .map((c) => {
      const url = c.url ? normUrl(c.url) : "";
      const slug = url ? slugFromUrl(url) : "";
      return { ...c, url, slug };
    })
    // category page crumb만: 보통 .html
    .filter((c) => !c.url || /\.html$/i.test(c.url));

  // 중복 제거(가끔 li 텍스트가 섞여)
  const out = [];
  const seen = new Set();
  for (const c of crumbs) {
    const key = `${c.title}__${c.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }

  return out;
}

function pickRightOuter($) {
  // ABM 카테고리 오른쪽 영역
  let root = $("#abm-category-right-outer").first();
  if (root.length) return root;

  // fallback
  root = $("#content").first();
  if (root.length) return root;

  return $("body");
}

function extractResources($, $root, baseUrl) {
  const items = [];
  const list = $root.find("ul.htmlcontent-home").first();
  if (!list.length) return items;

  list.find("li").each((i, li) => {
    const $li = $(li);
    const a = $li.find("a").first();
    const href = absUrl(a.attr("href") || "", baseUrl);
    if (!href) return;

    const img = $li.find("img").first();
    const imageUrl = absUrl(img.attr("src") || "", baseUrl);

    const title =
      collapseWs($li.find(".abm-category-image-title strong").first().text()) ||
      collapseWs($li.find("strong").first().text()) ||
      collapseWs(img.attr("alt")) ||
      "";

    const subtitle = collapseWs($li.find(".abm-category-image-title i").first().text()) || "Learning Resources";
    if (!title) return;

    items.push({
      _type: "contentResourceItem",
      title,
      subtitle,
      href,
      imageUrl,
    });
  });

  return items;
}

function extractPubs($, $root, baseUrl) {
  const items = [];
  const table = $root
    .find("table")
    .filter((_, el) => $(el).find(".citations-num").length > 0)
    .first();

  if (!table.length) return items;

  table.find("tr").each((_, tr) => {
    const $tr = $(tr);
    const no = collapseWs($tr.find(".citations-num").first().text());
    const order = Number(String(no).replace(/\D/g, "")) || undefined;

    const tds = $tr.find("td");
    if (tds.length < 2) return;

    const citation = collapseWs(tds.eq(1).text());
    if (!citation) return;

    const doi = absUrl(tds.eq(1).find("a[href*='doi.org']").attr("href") || "", baseUrl);
    const m = citation.match(/Product:\s*(.+)$/i);
    const product = m ? collapseWs(m[1]) : "";

    items.push({
      _type: "contentPublicationItem",
      order,
      citation,
      doi,
      product,
    });
  });

  return items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function buildContentBlocksOrdered($, $rightOuter, baseUrl) {
  // clone해서 정리
  const $work = $rightOuter.clone();

  // 상단 nav 제거
  $work.find("ul.abm-page-category-nav-list").remove();
  // script 제거
  $work.find("script").remove();

  // ✅ Request Free Sample 제거(규칙)
  stripRequestFreeSampleCheerio($work);

  // title(h2)는 페이지 타이틀로 쓰므로 본문에선 제거
  $work.find("h2.abm-categories-title-h2").first().remove();

  // resources/pubs 추출은 원본에서
  const resources = extractResources($, $rightOuter, baseUrl);
  const pubs = extractPubs($, $rightOuter, baseUrl);

  // marker로 치환해서 순서 유지
  const MARK_RES = "__ITSBIO_RES__";
  const MARK_PUB = "__ITSBIO_PUB__";

  const $res = $work.find("ul.htmlcontent-home").first();
  if ($res.length) $res.replaceWith(`<!--${MARK_RES}-->`);

  const $pubTable = $work
    .find("table")
    .filter((_, el) => $(el).find(".citations-num").length > 0)
    .first();
  if ($pubTable.length) $pubTable.replaceWith(`<!--${MARK_PUB}-->`);

  // heading 정리(중복 방지)
  $work.find("h3").each((_, h3) => {
    const t = collapseWs($(h3).text()).toLowerCase();
    if (t === "resource" || t === "resources" || t === "top publications") $(h3).remove();
  });

  let html = ($work.html() || "").trim();
  html = rewriteRelativeUrls(html, baseUrl);

  // marker split
  const parts = html.split(new RegExp(`<!--(${MARK_RES}|${MARK_PUB})-->`));

  const blocks = [];
  const pushHtml = (h) => {
    const hh = String(h || "").trim();
    if (!hh) return;
    const txt = collapseWs(hh.replace(/<[^>]*>/g, ""));
    if (txt.length < 5 && !hh.toLowerCase().includes("<table")) return;
    blocks.push({ _type: "contentBlockHtml", title: "Content", html: hh });
  };

  for (let i = 0; i < parts.length; i++) {
    const token = parts[i];
    if (token === MARK_RES) {
      if (resources.length) blocks.push({ _type: "contentBlockResources", title: "Resources", items: resources });
      continue;
    }
    if (token === MARK_PUB) {
      if (pubs.length) blocks.push({ _type: "contentBlockPublications", title: "Top Publications", items: pubs });
      continue;
    }
    pushHtml(token);
  }

  return blocks;
}

async function ensureCategoryByPath({ brandId, title, pathArr, sourceUrl, parentId }) {
  const pathStr = pathArr.join("/");

  const existing = await client.fetch(
    `*[_type=="category" && (themeKey=="abm" || brand._ref==$brandId) && array::join(path,"/")==$pathStr]{_id}[0]`,
    { brandId, pathStr }
  );

  if (existing?._id) {
    if (DRY) return existing._id;
    await client
      .patch(existing._id)
      .set({
        title,
        path: pathArr,
        sourceUrl,
        themeKey: "abm",
        brand: { _type: "reference", _ref: brandId },
        ...(parentId ? { parent: { _type: "reference", _ref: parentId } } : { parent: null }),
      })
      .commit();
    return existing._id;
  }

  // create new
  const newId = `cat_abm__${pathStr.replaceAll("/", "__")}`;

  if (DRY) return newId;

  await client.createIfNotExists({
    _id: newId,
    _type: "category",
    title,
    path: pathArr,
    sourceUrl,
    themeKey: "abm",
    brand: { _type: "reference", _ref: brandId },
    ...(parentId ? { parent: { _type: "reference", _ref: parentId } } : {}),
  });

  return newId;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return await res.text();
}

async function main() {
  const brand = await client.fetch(
    `*[_type=="brand" && (themeKey=="abm" || slug.current=="abm")][0]{_id,title,themeKey,"slug":slug.current}`
  );
  if (!brand?._id) throw new Error("ABM brand not found");

  const list = await client.fetch(
    `*[
      _type=="category"
      && (themeKey=="abm" || brand._ref==$brandId || brand->themeKey=="abm" || brand->slug.current=="abm")
      && defined(sourceUrl)
      && sourceUrl match "https://www.abmgood.com/*"
    ]{
      _id, title, path, sourceUrl
    } | order(_createdAt asc)`,
    { brandId: brand._id }
  );

  const targets = LIMIT > 0 ? list.slice(0, LIMIT) : list;
  console.log(`[targets] ${targets.length} (dry=${DRY})`);

  for (let i = 0; i < targets.length; i++) {
    const c = targets[i];
    const sourceUrl = normUrl(c.sourceUrl);
    if (!sourceUrl) continue;

    console.log(`\n[${i + 1}/${targets.length}] ${c._id}`);
    console.log(` - sourceUrl: ${sourceUrl}`);

    const html = await fetchHtml(sourceUrl);
    const $ = cheerio.load(html);

    const crumbs = extractBreadcrumbs($, sourceUrl);
    // crumbs에서 slug 없는 애는 제외
    const crumbsWithSlug = crumbs.filter((x) => x.slug);

    // path 후보: breadcrumb slug 순서대로
    const pathArr = crumbsWithSlug.map((x) => x.slug);

    // title 후보: h2 우선
    const h2 = stripBrandSuffix(collapseWs($("h2.abm-categories-title-h2").first().text()));
    const title = h2 || stripBrandSuffix(crumbsWithSlug.at(-1)?.title || c.title || "");

    if (!pathArr.length) {
      console.log(" - ⚠️ no breadcrumbs -> skip path fix, only contentBlocks refresh");
    } else {
      console.log(` - path: ${pathArr.join(" / ")}`);
      console.log(` - title: ${title}`);
    }

    // 1) 중간 카테고리 생성/패치 (virtual 제거)
    let parentId = null;
    for (let d = 0; d < pathArr.length; d++) {
      const p = pathArr.slice(0, d + 1);
      const crumb = crumbsWithSlug[d];
      const t = stripBrandSuffix(crumb?.title || humanizeFallback(p[p.length - 1]));
      const u = crumb?.url || `${BASE}/${p[p.length - 1]}.html`;
      const id = await ensureCategoryByPath({
        brandId: brand._id,
        title: t,
        pathArr: p,
        sourceUrl: u,
        parentId,
      });
      parentId = id;
    }

    // 2) 현재 문서 contentBlocks 재생성 (순서 유지 + sample 제거)
    const rightOuter = pickRightOuter($);
    const blocks = buildContentBlocksOrdered($, rightOuter, BASE);

    console.log(` - blocks: ${blocks.map((b) => b._type).join(", ") || "(none)"}`);

    if (DRY) continue;

    // path 충돌 체크(같은 pathStr의 다른 문서가 있으면 현재 doc path는 건드리지 않고 blocks만 갱신)
    let canPatchPath = true;
    if (pathArr.length) {
      const pathStr = pathArr.join("/");
      const dup = await client.fetch(
        `*[_type=="category" && _id!=$id && (themeKey=="abm" || brand._ref==$brandId) && array::join(path,"/")==$pathStr]{_id}`,
        { id: c._id, brandId: brand._id, pathStr }
      );
      if (Array.isArray(dup) && dup.length) {
        canPatchPath = false;
        console.log(` - ⚠️ path conflict -> keep current doc path, please delete duplicates later: ${dup.map((x) => x._id).join(", ")}`);
      }
    }

    const patch = client.patch(c._id).set({
      title: title || c.title,
      themeKey: "abm",
      brand: { _type: "reference", _ref: brand._id },
      sourceUrl,
      legacyHtml: html,
      contentBlocks: blocks,
      ...(canPatchPath && pathArr.length ? { path: pathArr } : {}),
      ...(canPatchPath && pathArr.length > 1
        ? { parent: { _type: "reference", _ref: `cat_abm__${pathArr.slice(0, -1).join("/").replaceAll("/", "__")}` } }
        : {}),
    });

    await patch.commit({ autoGenerateArrayKeys: true });
    console.log(" - ✅ patched");
  }

  console.log("\nDONE.");
}

function humanizeFallback(seg) {
  return String(seg || "").replaceAll("-", " ").replaceAll("_", " ").trim();
}

main().catch((e) => {
  console.error("[ERROR]", e?.message || e);
  process.exit(1);
});