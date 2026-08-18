import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import * as cheerio from "cheerio";

const APPLY = process.argv.includes("--apply");
const LEGACY_BASE = "http://itsbio.co.kr/?page_id=80";
const REPORT_DIR = path.resolve(".cache/legacy-notice-migration-v2");
const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8";
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";
const TOKEN = [
  process.env.SANITY_WRITE_TOKEN,
  process.env.SANITY_API_WRITE_TOKEN,
  process.env.SANITY_API_TOKEN,
  process.env.SANITY_TOKEN,
  process.env.SANITY_AUTH_TOKEN,
].find(Boolean) || "";

const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const makeKey = () => crypto.randomBytes(6).toString("hex");

function slugify(value) {
  return clean(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "notice";
}

async function fetchText(url, { attempts = 2, timeoutMs = 12000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; ITS-BIO-Legacy-Migration/2.0)",
          accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
        },
      });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < attempts) await sleep(600 * attempt);
    }
  }
  throw lastError || new Error(`Failed ${url}`);
}

async function fetchBinary(url, { attempts = 2, timeoutMs = 20000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "user-agent": "Mozilla/5.0 (compatible; ITS-BIO-Legacy-Migration/2.0)" },
      });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const buffer = Buffer.from(await response.arrayBuffer());
      return { contentType, buffer };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < attempts) await sleep(600 * attempt);
    }
  }
  throw lastError || new Error(`Failed binary ${url}`);
}

function parseDate(value) {
  const match = clean(value).match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return undefined;
  const [, y, m, d, hh = "00", mm = "00"] = match;
  // Keep the calendar date printed on the legacy Korean board stable. The
  // current Notice UI formats publishedAt with toISOString(), so treating the
  // printed board time as a display timestamp prevents a previous-day shift.
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${mm}:00Z`;
  return Number.isNaN(Date.parse(iso)) ? undefined : new Date(iso).toISOString();
}

function textBlock(text, style = "normal", listItem) {
  return {
    _type: "block",
    _key: makeKey(),
    style,
    ...(listItem ? { listItem, level: 1 } : {}),
    markDefs: [],
    children: [{ _type: "span", _key: makeKey(), text: clean(text), marks: [] }],
  };
}

function extractTextBlocks($, root, title) {
  const blocks = [];
  const seen = new Set();
  const ignoredExact = /^(?:제목|작성자|목록|이전글|다음글|Inquire|Search Collection)$/i;

  const add = (value, style = "normal", listItem) => {
    const text = clean(value);
    if (!text || text === title || ignoredExact.test(text)) return;
    if (/^(?:\(주\)이츠바이오|ITSBio,?\s*Inc\.|07532 서울특별시|T\s*:\s*02-3462-8658)/i.test(text)) return;
    const key = `${style}:${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push(textBlock(text, style, listItem));
  };

  root.find("h1,h2,h3,h4,h5,h6,p,li,blockquote").each((_, element) => {
    const tag = element.tagName?.toLowerCase() || "";
    const text = clean($(element).text());
    if (!text) return;
    if (/^h[1-6]$/.test(tag)) add(text, tag === "h1" ? "h2" : tag);
    else if (tag === "li") add(text, "normal", "bullet");
    else if (tag === "blockquote") add(text, "blockquote");
    else add(text);
  });

  if (!blocks.length) {
    clean(root.text()).split(/(?<=[.!?])\s+(?=[A-Z가-힣])|\n+/).forEach((part) => add(part));
  }
  return blocks.slice(0, 220);
}

function extractImages($, root, sourceUrl) {
  const images = [];
  root.find("img").each((_, element) => {
    const src = $(element).attr("data-src") || $(element).attr("data-lazy-src") || $(element).attr("src") || "";
    if (!src || /^data:/i.test(src)) return;
    const width = Number.parseInt($(element).attr("width") || "", 10) || 0;
    const height = Number.parseInt($(element).attr("height") || "", 10) || 0;
    try {
      const url = new URL(src, sourceUrl).toString();
      const fingerprint = `${url} ${$(element).attr("class") || ""} ${$(element).attr("alt") || ""}`;
      if (/logo|icon|flag|spinner|avatar|level|arrow\.png|tracking|pixel|spacer|blank\.(?:gif|png)/i.test(fingerprint)) return;
      if (width > 0 && height > 0 && width <= 16 && height <= 16) return;
      if (!images.some((item) => item.url === url)) images.push({ url, alt: clean($(element).attr("alt")) });
    } catch {}
  });
  return images.slice(0, 8);
}

function parseNotice(html, vid, sourceUrl) {
  const $ = cheerio.load(html);
  const board = $("#board01_board_box").first();
  const titleCell = $("#mb_board01_tr_title > td").first();
  const title = clean(titleCell.find("span").first().text()) || clean($("title").text()).replace(/\s*\|\s*ITSBIO.*$/i, "");
  const publishedAt = parseDate(titleCell.find("span").last().text()) || parseDate(titleCell.text());
  const author = clean($("#mb_board01_tr_user_name > td").first().text());
  const root = $("#mb_board01_tr_content > td.content-box").first();
  if (!board.length || !root.length || !title || !/itsbio/i.test(author)) return null;

  const body = extractTextBlocks($, root, title);
  const images = extractImages($, root, sourceUrl);
  const contentText = clean(root.text());
  if (!body.length && !images.length && contentText.length < 20) return null;

  return {
    vid,
    sourceUrl,
    title,
    publishedAt,
    slug: `${slugify(title)}-${vid}`.slice(0, 96),
    body,
    images,
    contentChars: contentText.length,
  };
}

async function discoverVids() {
  const html = await fetchText(LEGACY_BASE, { attempts: 2, timeoutMs: 14000 });
  const vids = [...html.matchAll(/[?&]vid=(\d+)/gi)].map((match) => Number(match[1]));
  return [...new Set(vids)].filter(Number.isFinite).sort((a, b) => a - b);
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await worker(items[index]);
    }
  }));
  return output;
}

async function uploadImage(item, vid, index) {
  try {
    const { contentType, buffer } = await fetchBinary(item.url);
    if (!contentType.startsWith("image/") || !buffer.length || buffer.length > 15 * 1024 * 1024) return null;
    const endpoint = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/assets/images/${DATASET}?filename=${encodeURIComponent(`legacy-notice-${vid}-${index + 1}`)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": contentType },
      body: buffer,
    });
    if (!response.ok) throw new Error(`Sanity image ${response.status}: ${await response.text()}`);
    const payload = await response.json();
    const id = payload.document?._id || payload._id;
    return id ? { _type: "image", _key: makeKey(), asset: { _type: "reference", _ref: id }, ...(item.alt ? { alt: item.alt } : {}) } : null;
  } catch (error) {
    console.warn(`Image skipped vid=${vid}: ${item.url} (${error.message})`);
    return null;
  }
}

async function writeNotice(record) {
  const uploadedImages = [];
  for (let index = 0; index < record.images.length; index += 1) {
    const image = await uploadImage(record.images[index], record.vid, index);
    if (image) uploadedImages.push(image);
  }
  if (!record.body.length && !uploadedImages.length) {
    throw new Error(`Refusing empty migrated Notice vid=${record.vid}: source is image-only but no image could be archived`);
  }
  const thumbnail = uploadedImages[0]
    ? { _type: "image", asset: uploadedImages[0].asset }
    : undefined;
  const body = [
    ...record.body,
    // The first archived image is already presented as the Notice hero/thumbnail.
    // Keep remaining source images in the body without duplicating that hero.
    ...uploadedImages.slice(1),
  ];
  const doc = {
    _id: `legacy-notice-${record.vid}`,
    _type: "notice",
    title: record.title,
    slug: { _type: "slug", current: record.slug },
    publishedAt: record.publishedAt || new Date("2021-01-01T00:00:00Z").toISOString(),
    isPinned: false,
    isActive: true,
    body,
    ...(thumbnail ? { thumbnail } : {}),
    legacySource: { url: record.sourceUrl, vid: record.vid },
  };
  const endpoint = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/mutate/${DATASET}?returnIds=true`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ mutations: [{ createOrReplace: doc }] }),
  });
  if (!response.ok) throw new Error(`Sanity mutation ${response.status}: ${await response.text()}`);
}

async function main() {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  const vids = await discoverVids();
  if (!vids.length) throw new Error("No legacy Notice links found");
  console.log(`Legacy Notice links: ${vids.join(", ")}`);

  const records = (await mapLimit(vids, 6, async (vid) => {
    const sourceUrl = `${LEGACY_BASE}&vid=${vid}`;
    try {
      const html = await fetchText(sourceUrl, { attempts: 2, timeoutMs: 12000 });
      const record = parseNotice(html, vid, sourceUrl);
      if (record) console.log(`FOUND ${vid}: ${record.title} · blocks ${record.body.length} · images ${record.images.length}`);
      return record;
    } catch (error) {
      console.warn(`SKIP ${vid}: ${error.message}`);
      return null;
    }
  })).filter(Boolean);

  records.sort((a, b) => String(a.publishedAt || "").localeCompare(String(b.publishedAt || "")));
  const report = {
    generatedAt: new Date().toISOString(),
    source: LEGACY_BASE,
    apply: APPLY,
    links: vids.length,
    found: records.length,
    records: records.map((record) => ({
      vid: record.vid,
      title: record.title,
      publishedAt: record.publishedAt,
      slug: record.slug,
      sourceUrl: record.sourceUrl,
      contentChars: record.contentChars,
      bodyBlocks: record.body.length,
      bodyChars: record.body.reduce((sum, block) => sum + clean(block.children?.[0]?.text).length, 0),
      contentImages: record.images.length,
      images: record.images.map((item) => item.url),
    })),
  };

  await fs.writeFile(path.join(REPORT_DIR, "latest.json"), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(REPORT_DIR, "latest.md"), [
    "# Legacy Notice Migration v2",
    "",
    `- Source: ${LEGACY_BASE}`,
    `- Links discovered: ${vids.length}`,
    `- Valid notices: ${records.length}`,
    `- Apply mode: ${APPLY}`,
    "",
    ...report.records.map((r) => `- ${r.publishedAt?.slice(0, 10) || "date unknown"} · vid ${r.vid} · blocks ${r.bodyBlocks} · chars ${r.bodyChars} · images ${r.contentImages} · ${r.title}`),
    "",
  ].join("\n"));

  if (!APPLY) return;
  if (!TOKEN) throw new Error("--apply requires Sanity write token");
  if (records.length !== vids.length) throw new Error(`Refusing partial apply: ${records.length}/${vids.length} parsed`);

  let applied = 0;
  for (const record of records) {
    await writeNotice(record);
    applied += 1;
    console.log(`APPLIED ${applied}/${records.length}: ${record.title}`);
  }
  report.applied = applied;
  await fs.writeFile(path.join(REPORT_DIR, "latest.json"), JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
