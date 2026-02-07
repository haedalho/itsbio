/**
 * Category: introText/quickLinks/bullets/resources/topPublications -> contentBlocks 이관
 *
 * 사용:
 * 1) .env.local 에 SANITY_WRITE_TOKEN 있어야 함
 * 2) 실행:
 *    node --env-file=.env.local scripts/migrate-category-contentBlocks.mjs
 *
 * 옵션:
 *    DRY_RUN=1 node --env-file=.env.local scripts/migrate-category-contentBlocks.mjs
 *    FORCE=1   node --env-file=.env.local scripts/migrate-category-contentBlocks.mjs
 *
 * - DRY_RUN=1 : 실제 커밋 안 하고 로그만
 * - FORCE=1   : contentBlocks가 이미 있어도 덮어쓰기(주의)
 */

import { createClient } from "next-sanity";

const DRY_RUN = process.env.DRY_RUN === "1";
const FORCE = process.env.FORCE === "1";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || "production";
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId) throw new Error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID (or SANITY_PROJECT_ID)");
if (!dataset) throw new Error("Missing NEXT_PUBLIC_SANITY_DATASET (or SANITY_DATASET)");
if (!token) throw new Error("Missing SANITY_WRITE_TOKEN in .env.local");

const client = createClient({
  projectId,
  dataset,
  apiVersion: "2025-01-01",
  token,
  useCdn: false,
});

const QUERY = `
*[_type=="category"]{
  _id,
  title,
  contentBlocks,

  // legacy fields (있을 수도/없을 수도)
  introText,
  quickLinks,
  bullets,
  resources,
  topPublications
}
`;

function isNonEmptyArray(v) {
  return Array.isArray(v) && v.length > 0;
}

function isPortableTextArray(v) {
  // 대충 block/children 구조면 PortableText로 취급
  return (
    Array.isArray(v) &&
    v.some((x) => x && typeof x === "object" && (x._type === "block" || x.children || x.markDefs))
  );
}

function makeSimplePortableTextFromString(text) {
  const t = (text ?? "").toString().trim();
  if (!t) return [];
  return [
    {
      _type: "block",
      style: "normal",
      _key: cryptoRandomKey(),
      markDefs: [],
      children: [
        {
          _type: "span",
          _key: cryptoRandomKey(),
          text: t,
          marks: [],
        },
      ],
    },
  ];
}

function cryptoRandomKey() {
  // sanity _key 용도(유니크만 보장되면 됨)
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

function normalizeLinkItem(x) {
  if (!x) return null;
  if (typeof x === "string") {
    // "Label|https://..." 이런 식이 있으면 분리 시도
    const s = x.trim();
    const parts = s.split("|").map((p) => p.trim());
    if (parts.length === 2 && /^https?:\/\//i.test(parts[1])) {
      return { _type: "contentLinkItem", _key: cryptoRandomKey(), label: parts[0], href: parts[1] };
    }
    return null;
  }
  const label = (x.label ?? x.title ?? x.text ?? "").toString().trim();
  const href = (x.href ?? x.url ?? x.link ?? "").toString().trim();
  if (!label || !href) return null;
  return { _type: "contentLinkItem", _key: cryptoRandomKey(), label, href };
}

function normalizeBullet(x) {
  if (!x) return null;
  if (typeof x === "string") {
    const s = x.trim();
    return s ? s : null;
  }
  if (typeof x === "object") {
    const s = (x.text ?? x.title ?? x.label ?? "").toString().trim();
    return s ? s : null;
  }
  return null;
}

function normalizeResourceItem(x) {
  if (!x) return null;

  // 기대 형태(대충): {title, desc, href, file} / {label, href} / {text, url} 등 섞여있을 수 있음
  const title = (x.title ?? x.label ?? x.name ?? x.text ?? "").toString().trim();
  const desc = (x.desc ?? x.description ?? x.summary ?? "").toString().trim();
  const href = (x.href ?? x.url ?? x.link ?? "").toString().trim();

  // file이 sanity file object일 수도: {asset:{_ref:...}} 또는 {asset->_id...} 형태였을 수도
  const file = x.file && typeof x.file === "object" ? x.file : undefined;

  if (!title && !href && !file) return null;

  const item = { _type: "contentResourceItem", _key: cryptoRandomKey() };
  if (title) item.title = title;
  else item.title = "(untitled)";

  if (desc) item.desc = desc;
  if (href) item.href = href;
  if (file) item.file = file;

  return item;
}

function normalizePublicationItem(x) {
  if (!x) return null;

  // 기대: {title, authors, journal, year, doi, href}
  const title = (x.title ?? x.name ?? x.text ?? "").toString().trim();
  const authors = (x.authors ?? x.author ?? "").toString().trim();
  const journal = (x.journal ?? x.source ?? "").toString().trim();
  const yearRaw = x.year ?? x.publishedYear ?? null;
  const year = typeof yearRaw === "number" ? yearRaw : parseInt((yearRaw ?? "").toString(), 10);
  const doi = (x.doi ?? "").toString().trim();
  const href = (x.href ?? x.url ?? x.link ?? "").toString().trim();

  if (!title && !doi && !href) return null;

  const item = { _type: "contentPublicationItem", _key: cryptoRandomKey() };
  item.title = title || "(untitled)";
  if (authors) item.authors = authors;
  if (journal) item.journal = journal;
  if (!Number.isNaN(year) && Number.isFinite(year)) item.year = year;
  if (doi) item.doi = doi;
  if (href) item.href = href;

  return item;
}

function buildContentBlocks(doc) {
  const blocks = [];

  // 1) introText -> RichText 블록
  if (doc.introText) {
    let body = [];
    if (typeof doc.introText === "string") body = makeSimplePortableTextFromString(doc.introText);
    else if (isPortableTextArray(doc.introText)) body = doc.introText;
    else if (Array.isArray(doc.introText)) {
      // 배열인데 PortableText 아닌 경우: 문자열 배열일 수도
      const joined = doc.introText.map((x) => (typeof x === "string" ? x : "")).filter(Boolean).join("\n");
      body = makeSimplePortableTextFromString(joined);
    } else if (typeof doc.introText === "object") {
      // {text: "..."} 형태 방어
      const t = (doc.introText.text ?? doc.introText.value ?? "").toString().trim();
      body = makeSimplePortableTextFromString(t);
    }

    if (isNonEmptyArray(body)) {
      blocks.push({
        _type: "contentBlockRichText",
        _key: cryptoRandomKey(),
        title: "Intro",
        body,
      });
    }
  }

  // 2) quickLinks -> Links 블록
  if (isNonEmptyArray(doc.quickLinks)) {
    const items = doc.quickLinks.map(normalizeLinkItem).filter(Boolean);
    if (items.length) {
      blocks.push({
        _type: "contentBlockLinks",
        _key: cryptoRandomKey(),
        title: "Quick Links",
        items,
      });
    }
  }

  // 3) bullets -> Bullets 블록
  if (isNonEmptyArray(doc.bullets)) {
    const items = doc.bullets.map(normalizeBullet).filter(Boolean);
    if (items.length) {
      blocks.push({
        _type: "contentBlockBullets",
        _key: cryptoRandomKey(),
        title: "Highlights",
        items,
      });
    }
  }

  // 4) resources -> Resources 블록
  if (isNonEmptyArray(doc.resources)) {
    const items = doc.resources.map(normalizeResourceItem).filter(Boolean);
    if (items.length) {
      blocks.push({
        _type: "contentBlockResources",
        _key: cryptoRandomKey(),
        title: "Resources",
        items,
      });
    }
  }

  // 5) topPublications -> Publications 블록
  if (isNonEmptyArray(doc.topPublications)) {
    const items = doc.topPublications.map(normalizePublicationItem).filter(Boolean);
    if (items.length) {
      blocks.push({
        _type: "contentBlockPublications",
        _key: cryptoRandomKey(),
        title: "Top Publications",
        items,
      });
    }
  }

  return blocks;
}

async function main() {
  const docs = await client.fetch(QUERY);
  console.log(`Found categories: ${docs.length}`);

  let updated = 0;
  let skipped = 0;

  for (const doc of docs) {
    const hasBlocks = isNonEmptyArray(doc.contentBlocks);
    if (hasBlocks && !FORCE) {
      skipped++;
      continue;
    }

    const newBlocks = buildContentBlocks(doc);

    // 새로 만들 게 없으면 스킵
    if (!newBlocks.length) {
      skipped++;
      continue;
    }

    console.log(
      `\n[${doc._id}] ${doc.title ?? ""}\n  - hasBlocks: ${hasBlocks}\n  - newBlocks: ${newBlocks
        .map((b) => b._type)
        .join(", ")}`
    );

    if (DRY_RUN) {
      updated++;
      continue;
    }

    // 기존 legacy 필드들은 이관 후 제거(원하면 유지할 수도 있는데, 통합한다고 했으니 기본은 unset)
    const patch = client
      .patch(doc._id)
      .set({ contentBlocks: newBlocks })
      .unset(["introText", "quickLinks", "bullets", "resources", "topPublications"]);

    await patch.commit({ autoGenerateArrayKeys: true });
    updated++;
  }

  console.log(`\nDone. updated=${updated}, skipped=${skipped}, dryRun=${DRY_RUN}, force=${FORCE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
