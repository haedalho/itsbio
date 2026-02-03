import sanitizeHtml from "sanitize-html";
import { createClient } from "next-sanity";

/**
 * ✅ 목표
 * - legacyHtml에서 “텍스트(intro)” + “링크 타일(tiles)”만 추출
 * - 가능한 건 sourceWpId로 내부 category reference(linkCategory)까지 자동 매핑
 *
 * ✅ WP_BASE 하드코딩 없음
 * - WP 사이트 없어져도 런타임 영향 0
 * - 추출 결과에 외부 href가 남더라도 ‘임시 데이터’일 뿐, 나중에 내부 매핑 완료하면 제거 가능
 */

// 환경변수(프로젝트에 이미 쓰는 키 우선)
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";

// ✅ write token은 노출되면 안 되므로 NEXT_PUBLIC 붙이지 말 것
const token =
  process.env.SANITY_WRITE_TOKEN ||
  process.env.SANITY_API_WRITE_TOKEN ||
  process.env.SANITY_TOKEN ||
  process.env.SANITY_API_TOKEN;

if (!token) {
  console.error(
    "Missing write token. Add one of: SANITY_WRITE_TOKEN / SANITY_API_WRITE_TOKEN / SANITY_TOKEN / SANITY_API_TOKEN"
  );
  process.exit(1);
}

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });

function decodeBasicEntities(s) {
  return (s || "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'");
}

function stripTags(s) {
  return (s || "").replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim();
}

function getWpPageId(url) {
  const m = (url || "").match(/[?&]page_id=(\d+)/i);
  return m?.[1];
}

function isBadTileTitle(t) {
  const x = (t || "").trim();
  if (!x) return true;
  if (x.length < 2) return true;
  if (x.length > 80) return true;

  const bad = ["home", "notice", "contact", "about", "promotions", "products", "resources"];
  return bad.includes(x.toLowerCase());
}

/**
 * legacyHtml에서 “타일 후보 링크들”만 추출
 * - HTML <a href="...">Title</a>
 * - Divi shortcode 내부 title/url 패턴도 일부 커버
 */
function extractTileLinksFromLegacy(raw) {
  const s = decodeBasicEntities(raw || "");
  const out = [];

  // 1) HTML anchor
  for (const m of s.matchAll(/<a[^>]+href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = (m[2] || "").trim();
    const title = stripTags(m[3] || "");
    if (!href || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    if (isBadTileTitle(title)) continue;
    out.push({ title, href, wpPageId: getWpPageId(href) });
  }

  // 2) Divi shortcode title/url
  for (const m of s.matchAll(/\[et_pb_[^\]]*?\btitle=(["'])(.*?)\1[^\]]*?\burl=(["'])(.*?)\3[^\]]*\]/gi)) {
    const title = (m[2] || "").trim();
    const href = (m[4] || "").trim();
    if (!href || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    if (isBadTileTitle(title)) continue;
    out.push({ title, href, wpPageId: getWpPageId(href) });
  }
  for (const m of s.matchAll(/\[et_pb_[^\]]*?\burl=(["'])(.*?)\1[^\]]*?\btitle=(["'])(.*?)\3[^\]]*\]/gi)) {
    const href = (m[2] || "").trim();
    const title = (m[4] || "").trim();
    if (!href || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    if (isBadTileTitle(title)) continue;
    out.push({ title, href, wpPageId: getWpPageId(href) });
  }

  // de-dupe
  const seen = new Set();
  const uniq = [];
  for (const x of out) {
    const key = `${x.title}@@${x.href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(x);
  }

  return uniq.slice(0, 30);
}

function extractIntro(raw) {
  // HTML/쇼트코드 섞여 있어도 텍스트만 뽑기
  const fixed = decodeBasicEntities(raw || "");
  const text = stripTags(
    sanitizeHtml(fixed, {
      allowedTags: ["p", "br"],
      allowedAttributes: {},
    })
  ).replace(/\s{2,}/g, " ").trim();

  if (!text) return "";
  if (text.length <= 360) return text;
  return text.slice(0, 360).replace(/\s+\S*$/, "").trim() + "…";
}

async function main() {
  // ✅ 내부 매핑 준비: 같은 brand 기준으로 sourceWpId -> category _id
  const allCats = await client.fetch(`
    *[_type=="category"]{
      _id,
      sourceWpId,
      "brandId": brand._ref
    }
  `);

  const map = new Map(); // key: brandId:wpId => categoryId
  for (const c of allCats || []) {
    if (!c?.brandId || !c?.sourceWpId) continue;
    map.set(`${c.brandId}:${String(c.sourceWpId)}`, c._id);
  }

  // ✅ 대상: legacyHtml 있고 아직 legacyMigratedAt 없는 것만
  const targets = await client.fetch(`
    *[
      _type=="category"
      && defined(legacyHtml)
      && string(legacyHtml) != ""
      && !defined(legacyMigratedAt)
    ]{
      _id,
      title,
      legacyHtml,
      "brandId": brand._ref
    }
  `);

  console.log(`Targets: ${targets.length}`);

  let ok = 0;
  let fail = 0;

  for (const doc of targets) {
    try {
      const legacy = typeof doc.legacyHtml === "string" ? doc.legacyHtml : "";
      const intro = extractIntro(legacy);
      const links = extractTileLinksFromLegacy(legacy);

      const tiles = links.map((x, idx) => {
        const wpPageId = x.wpPageId ? String(x.wpPageId) : "";
        const internalId = wpPageId ? map.get(`${doc.brandId}:${wpPageId}`) : undefined;

        const t = {
          _type: "categoryTile",
          title: x.title,
          summary: "",
          wpPageId,
          order: idx,
        };

        if (internalId) {
          t.linkCategory = { _type: "reference", _ref: internalId };
        } else {
          // 아직 내부 매핑이 안 된 링크는 임시로 보관
          t.href = x.href;
        }

        return t;
      });

      await client
        .patch(doc._id)
        .set({
          intro,
          tiles,
          legacyMigratedAt: new Date().toISOString(),
        })
        .commit({ autoGenerateArrayKeys: true });

      ok += 1;
      console.log(`✅ ${doc.title} -> tiles:${tiles.length}`);
    } catch (e) {
      fail += 1;
      console.error(`❌ ${doc.title}`, e?.message || e);
    }
  }

  console.log(`Done. ok=${ok}, fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
