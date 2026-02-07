// scripts/rehydrate-lib.mjs
import * as cheerio from "cheerio";

/**
 * ABM: 오른쪽 본문(#abm-category-right-outer) 기준으로
 * - 상단 카테고리 네비(ul.abm-page-category-nav-list) 제거
 * - Resource 카드(이미지/링크) 추출
 * - Top Publications 테이블 추출
 * - 나머지 본문은 HTML 블록으로 저장
 */
function extractAbmRightOuter(html) {
  const $ = cheerio.load(html || "");
  const $root = $("#abm-category-right-outer");

  if (!$root.length) return { rootFound: false, rightHtml: "" };

  // 불필요 네비 제거
  $root.find("ul.abm-page-category-nav-list").remove();
  // script 제거
  $root.find("script").remove();

  // right outer 안쪽 html
  const rightHtml = $root.html() || "";
  return { rootFound: true, rightHtml };
}

function absolutizeUrl(url, baseUrl) {
  if (!url) return "";
  const u = String(url).trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("/")) return `${baseUrl}${u}`;
  return u; // 상대경로(드물게) 그대로
}

function extractResourcesFromRightHtml(rightHtml, baseUrl) {
  const $ = cheerio.load(rightHtml || "");

  // "Resource" 섹션의 카드들이 보통 ul.htmlcontent-home 안에 있음
  const items = [];
  $("ul.htmlcontent-home li").each((_, li) => {
    const $li = $(li);
    const a = $li.find("a").first();
    const href = a.attr("href") || "";

    const img = $li.find("img").first();
    const imageUrlRaw = img.attr("src") || "";

    // 제목은 strong 텍스트
    const title = $li.find(".abm-category-image-title strong").first().text().trim()
      || a.text().trim();

    // subtitle은 i 텍스트 (보통 Learning Resources)
    const subtitle = $li.find(".abm-category-image-title i").first().text().trim();

    const imageUrl = absolutizeUrl(imageUrlRaw, baseUrl);
    const hrefAbs = absolutizeUrl(href, baseUrl);

    if (hrefAbs && title) {
      items.push({
        _type: "contentResourceItem",
        title,
        subtitle: subtitle || "",
        href: hrefAbs,
        imageUrl,
      });
    }
  });

  return items;
}

function extractTopPublicationsFromRightHtml(rightHtml) {
  const $ = cheerio.load(rightHtml || "");

  // Top Publications 테이블의 citations-num 기반
  const items = [];
  $("span.citations-num").each((_, el) => {
    const no = $(el).text().trim();
    const $tr = $(el).closest("tr");
    if (!$tr.length) return;

    const text = $tr.find("td").last().text().replace(/\s+/g, " ").trim();
    const doiHref = $tr.find("a[href*='doi.org']").attr("href") || "";

    // Product: 뒤 문자열만 대충 분리
    let product = "";
    const m = text.match(/Product:\s*(.+)$/i);
    if (m) product = m[1].trim();

    const order = Number(no) || undefined;
    if (text) {
      items.push({
        _type: "contentPublicationItem",
        order,
        citation: text,
        doi: doiHref || "",
        product,
      });
    }
  });

  return items;
}

function buildContentBlocks({ rightHtml, resources, pubs }) {
  const blocks = [];

  // ✅ resources/top pubs는 있으면 블록으로
  if (resources.length) {
    blocks.push({
      _type: "contentBlockResources",
      title: "Resources",
      items: resources,
    });
  }

  if (pubs.length) {
    blocks.push({
      _type: "contentBlockPublications",
      title: "Top Publications",
      items: pubs,
    });
  }

  // ✅ 나머지는 HTML 블록 (항상 넣어: 그래야 "본문 내용"이 나옴)
  // 단, resources/top pubs 영역은 HTML에서 제거해서 중복 표시 방지
  let cleaned = rightHtml || "";
  if (cleaned) {
    const $ = cheerio.load(cleaned);

    // Resource 카드 ul 제거
    $("ul.htmlcontent-home").remove();

    // Top Publications table 제거 (citations-num 있는 테이블)
    $("span.citations-num").closest("table").remove();

    // 섹션 헤더 텍스트만 남는 경우가 있어 같이 제거(보수적으로)
    $("h3").each((_, h3) => {
      const t = $(h3).text().trim().toLowerCase();
      if (t === "resource" || t === "top publications") $(h3).remove();
    });

    cleaned = $.root().html() || "";
  }

  const htmlBlock = (cleaned || "").trim();
  if (htmlBlock) {
    blocks.unshift({
      _type: "contentBlockHtml",
      title: "Content",
      html: htmlBlock,
    });
  }

  return blocks;
}

export async function rehydrateOneCategoryFromLegacy({ client, id, brandKey, baseUrl, dryRun }) {
  const doc = await client.fetch(
    `*[_type=="category" && _id==$id][0]{_id,title,legacyHtml,"blocksCount":count(contentBlocks)}`,
    { id }
  );

  if (!doc?._id) {
    return { id, status: "skipped", reason: "not_found" };
  }

  const legacyHtml = doc.legacyHtml || "";
  if (!legacyHtml) {
    return { id, status: "skipped", title: doc.title, reason: "no_legacyHtml" };
  }

  const { rootFound, rightHtml } = extractAbmRightOuter(legacyHtml);

  if (!rootFound || !rightHtml.trim()) {
    // right outer를 못 찾으면: 그래도 전체를 html로 넣는 fallback
    const fallbackBlocks = [{
      _type: "contentBlockHtml",
      title: "Content",
      html: legacyHtml,
    }];

    if (!dryRun) {
      await client
        .patch(id)
        .set({ contentBlocks: fallbackBlocks })
        .commit({ autoGenerateArrayKeys: true });
    }

    return {
      id,
      status: dryRun ? "dryRun" : "patched",
      title: doc.title,
      rootFound,
      blocksCount: fallbackBlocks.length,
      blockTypes: fallbackBlocks.map((b) => b._type),
      note: "fallback: used full legacyHtml",
    };
  }

  const resources = extractResourcesFromRightHtml(rightHtml, baseUrl);
  const pubs = extractTopPublicationsFromRightHtml(rightHtml);

  const blocks = buildContentBlocks({ rightHtml, resources, pubs });

  if (!dryRun) {
    await client
      .patch(id)
      .set({ contentBlocks: blocks })
      .commit({ autoGenerateArrayKeys: true });
  }

  return {
    id,
    status: dryRun ? "dryRun" : "patched",
    title: doc.title,
    rootFound,
    resourcesCount: resources.length,
    pubsCount: pubs.length,
    blocksCount: blocks.length,
    blockTypes: blocks.map((b) => b._type),
  };
}
