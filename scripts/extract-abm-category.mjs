// scripts/extract-abm-category.mjs
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import * as cheerio from "cheerio";

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

function normalizeText(s) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absolutifyUrl(raw, baseUrl) {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^\/\//.test(v)) return `https:${v}`;
  if (v.startsWith("/")) return `${baseUrl}${v}`;
  return v; // 상대경로(rare) 그대로
}

function stripScripts(html) {
  let out = html || "";
  out = out.replace(/<script[^>]*type=["']application\/ld\+json["'][\s\S]*?<\/script>/gi, "");
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  return out;
}

function stripAbmTopNavList(html) {
  // 유저가 말한 "상단 카테고리 네비 리스트" 제거 (abm-page-category-nav-list)
  return (html || "").replace(
    /<ul[^>]*class=["'][^"']*\babm-page-category-nav-list\b[^"']*["'][\s\S]*?<\/ul>/gi,
    ""
  );
}

function rewriteRelativeUrls(html, baseUrl) {
  if (!html) return "";
  let out = html;

  // src="/..." href="/..."
  out = out.replace(
    /\s(href|src)=["'](\/(?!\/)[^"']*)["']/gi,
    (_m, attr, p) => ` ${attr}="${baseUrl}${p}"`
  );
  // protocol-relative
  out = out.replace(
    /\s(href|src)=["'](\/\/[^"']+)["']/gi,
    (_m, attr, p) => ` ${attr}="https:${p}"`
  );

  return out;
}

function pickRoot($) {
  // 1) 가장 확실: id
  let root = $("#abm-category-right-outer").first();
  if (root.length) return root;

  // 2) col-md-9 + “카테고리 타이틀” 포함한 컨테이너를 찾기
  const candidates = $(".col-md-9, .col-lg-9, .col-sm-12, .col-xs-12").toArray();
  for (const el of candidates) {
    const $el = $(el);
    if ($el.find("h2.abm-categories-title-h2").length) return $el;
  }

  // 3) 마지막 fallback: 본문 텍스트가 있는 블럭
  root = $(".abm-categories-text").first().parent();
  if (root.length) return root;

  return null;
}

function extractTitle($, root) {
  const t =
    normalizeText(root?.find("h2.abm-categories-title-h2").first().text()) ||
    normalizeText($("h2.abm-categories-title-h2").first().text()) ||
    normalizeText($("h1").first().text()) ||
    normalizeText($("title").first().text()) ||
    "";
  // "|" 이후 브랜드명 제거
  return t.includes("|") ? normalizeText(t.split("|")[0]) : t;
}

function extractIntroHtml($, root, baseUrl) {
  // 대부분: .abm-categories-text
  const box = root.find(".abm-categories-text").first();
  if (!box.length) return "";
  let html = $.html(box);
  html = stripScripts(html);
  html = stripAbmTopNavList(html);
  html = rewriteRelativeUrls(html, baseUrl);
  html = html.trim();
  if (normalizeText(html).length < 20) return "";
  return html;
}

function extractResources($, root, baseUrl) {
  // General Materials 스타일: ul.htmlcontent-home > li ... img + title
  const list = root.find("ul.htmlcontent-home").first();
  if (!list.length) return [];

  const items = [];
  const lis = list.find("li").toArray();

  for (const li of lis) {
    const $li = $(li);

    const a = $li.find("a").first();
    const href = absolutifyUrl(a.attr("href"), baseUrl);

    const img = $li.find("img").first();
    const rawSrc = img.attr("src") || "";
    const imageUrl = absolutifyUrl(rawSrc, baseUrl);

    // 제목은 strong 또는 이미지 밑 title영역에서
    let title =
      normalizeText($li.find(".abm-category-image-title strong").first().text()) ||
      normalizeText($li.find("strong").first().text()) ||
      normalizeText(img.attr("alt")) ||
      "";

    // 서브타이틀은 i 또는 default
    let subtitle =
      normalizeText($li.find(".abm-category-image-title i").first().text()) ||
      normalizeText($li.find("i").first().text()) ||
      "Learning Resources";

    // 이상하게 CRISPR로 잘못 들어오던 경우: alt/title이 틀린 원본이 있을 수 있으니 title이 비면 skip
    if (!href || !title) continue;

    items.push({
      _type: "contentResourceItem",
      title,
      subtitle,
      href,
      imageUrl,
      meta: {
        imageUrlRaw: rawSrc,
        imageUrlUsed: imageUrl,
        imageStatus: imageUrl ? "ok" : "missing",
        imageReason: imageUrl ? "" : "no src",
      },
    });
  }

  return items;
}

function extractTopPublications($, root, baseUrl) {
  // 보통: h3 "Top Publications" 다음 table
  // 케이스: citations-num span
  const pubs = [];

  // citations-num이 있는 테이블을 우선 찾음
  const table = root.find("table").filter((_i, el) => $(el).find(".citations-num").length > 0).first();
  if (!table.length) return pubs;

  const rows = table.find("tr").toArray();
  for (const tr of rows) {
    const $tr = $(tr);
    const noText =
      normalizeText($tr.find(".citations-num").first().text()) ||
      normalizeText($tr.find("td").first().text());

    const order = parseInt(String(noText).replace(/\D/g, ""), 10);
    const td = $tr.find("td").eq(1);

    // citation 텍스트
    const citation = normalizeText(td.text());
    if (!citation) continue;

    // doi 링크
    let doi = "";
    const doiA = td.find("a").toArray().map((a) => $(a).attr("href")).find((h) => /doi\.org/i.test(h || ""));
    if (doiA) doi = absolutifyUrl(doiA, baseUrl);

    // product: "Product:" 이후 텍스트를 대충 파싱
    let product = "";
    const m = citation.match(/Product:\s*(.+)$/i);
    if (m) product = normalizeText(m[1]);

    pubs.push({
      _type: "contentPublicationItem",
      order: Number.isFinite(order) ? order : undefined,
      citation,
      doi,
      product,
    });
  }

  // order 없는 것 뒤로
  pubs.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return pubs;
}

function extractHtmlBlock($, root, baseUrl) {
  // ✅ 우리가 원하는 "오른쪽 내용 전체" = root에서 상단 nav / resources / pubs 제거한 나머지
  const work = root.clone();

  // 제거 1: 상단 카테고리 네비 리스트
  work.find("ul.abm-page-category-nav-list").remove();

  // 제거 2: Resource 카드 영역(General 같은 페이지에서 중복 렌더 방지)
  work.find("ul.htmlcontent-home").remove();

  // 제거 3: Top Publications 테이블(중복 렌더 방지)
  work.find("table").filter((_i, el) => $(el).find(".citations-num").length > 0).remove();

  // 제거 4: 스크립트
  work.find("script").remove();

  // 제목(h2)은 우리 페이지 타이틀로 이미 쓰니까 본문에서는 제거(원하면 유지 가능)
  work.find("h2.abm-categories-title-h2").first().remove();

  let html = work.html() || "";
  html = stripScripts(html);
  html = stripAbmTopNavList(html);
  html = rewriteRelativeUrls(html, baseUrl);
  html = html.trim();

  // ✅ 너무 짧으면 fallback: .abm-categories-text만이라도
  if (normalizeText(html).length < 20) {
    const text = root.find(".abm-categories-text").first();
    if (text.length) {
      let fb = $.html(text);
      fb = stripScripts(fb);
      fb = stripAbmTopNavList(fb);
      fb = rewriteRelativeUrls(fb, baseUrl);
      fb = fb.trim();
      if (normalizeText(fb).length >= 20) html = fb;
    } else {
      html = "";
    }
  }

  return html;
}

function buildContentBlocks({ html, resources, pubs }) {
  const blocks = [];

  if (html && normalizeText(html).length >= 20) {
    blocks.push({
      _type: "contentBlockHtml",
      title: "Content",
      html,
    });
  }

  if (Array.isArray(resources) && resources.length) {
    blocks.push({
      _type: "contentBlockResources",
      title: "Resources",
      items: resources,
    });
  }

  if (Array.isArray(pubs) && pubs.length) {
    blocks.push({
      _type: "contentBlockPublications",
      title: "Top Publications",
      items: pubs,
    });
  }

  return blocks;
}

async function main() {
  const htmlPath = arg("--html");
  const baseUrl = arg("--baseUrl") || "https://www.abmgood.com";
  const outPath = arg("--out");

  if (!htmlPath) {
    console.error("Usage: node scripts/extract-abm-category.mjs --html <file.html> --baseUrl https://www.abmgood.com [--out out.json]");
    process.exit(1);
  }

  const abs = path.isAbsolute(htmlPath) ? htmlPath : path.join(process.cwd(), htmlPath);
  const raw = fs.readFileSync(abs, "utf8");

  const $ = cheerio.load(raw);
  const root = pickRoot($);

  const rootFound = !!(root && root.length);
  if (!rootFound) {
    const res = {
      title: "",
      rootFound: false,
      introHtmlLen: 0,
      resourcesCount: 0,
      pubsCount: 0,
      highlightsCount: 0,
      contentBlockTypes: [],
    };
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  }

  const title = extractTitle($, root);
  const introHtml = extractIntroHtml($, root, baseUrl);
  const resources = extractResources($, root, baseUrl);
  const pubs = extractTopPublications($, root, baseUrl);
  const html = extractHtmlBlock($, root, baseUrl);
  const contentBlocks = buildContentBlocks({ html, resources, pubs });

  const summary = {
    title,
    rootFound,
    legacyHtmlLen: raw.length,
    introHtmlLen: introHtml.length,
    resourcesCount: resources.length,
    pubsCount: pubs.length,
    highlightsCount: 0,
    resourceFirst: resources[0] || null,
    pubFirst: pubs[0] || null,
    contentBlockTypes: contentBlocks.map((b) => b._type),
  };

  if (outPath) {
    const outAbs = path.isAbsolute(outPath) ? outPath : path.join(process.cwd(), outPath);
    const payload = {
      title,
      introHtml,
      resources,
      pubs,
      contentBlocks,
      meta: {
        baseUrl,
        extractedAt: new Date().toISOString(),
      },
    };
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, JSON.stringify(payload, null, 2), "utf8");
    console.log(JSON.stringify(summary, null, 2));
    console.log(`Wrote: ${outAbs}`);
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
