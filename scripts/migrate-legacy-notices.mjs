import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import * as cheerio from "cheerio";

const APPLY = process.argv.includes("--apply");
const MAX_VID_ARG = process.argv.find((arg) => arg.startsWith("--max-vid="));
const MAX_VID = Math.max(1, Number(MAX_VID_ARG?.split("=")[1] || 60));
const CONCURRENCY = 8;
const LEGACY_BASE = "http://itsbio.co.kr/?page_id=80";
const REPORT_DIR = path.resolve(".cache/legacy-notice-migration");
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const slugify = (value) => clean(value)
  .normalize("NFKD")
  .toLowerCase()
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9가-힣]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 72) || "notice";

async function fetchWithRetry(url, { attempts = 3, timeoutMs = 18000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; ITS-BIO-Legacy-Migration/1.0; +https://itsbio.co.kr)",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
        },
      });
      clearTimeout(timer);
      if (response.ok) return { response, text: await response.text() };
      lastError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
    }
    if (attempt < attempts) await sleep(800 * attempt);
  }
  throw lastError || new Error(`Failed to fetch ${url}`);
}

function findTitle($) {
  const og = clean($("meta[property='og:title']").attr("content"));
  const titleCandidates = [
    ".kboard-title h1", ".kboard-title", ".board-title", ".view-title", ".entry-title", "article h1", "main h1", "h1",
  ];
  for (const selector of titleCandidates) {
    const value = clean($(selector).first().text());
    if (value && !/^ITS ?BIO$/i.test(value) && value.length > 2) return value;
  }

  let fromLabel = "";
  $("th,td,dt,strong,b,span,div").each((_, el) => {
    if (fromLabel) return;
    if (!/^제목\s*:?$/i.test(clean($(el).text()))) return;
    const next = $(el).next();
    const candidate = clean(next.text());
    if (candidate) fromLabel = candidate.replace(/20\d{2}-\d{2}-\d{2}[\s\S]*$/, "").trim();
  });
  if (fromLabel) return fromLabel;

  if (og && !/^ITS ?BIO/i.test(og)) return og.replace(/\s*\|\s*ITSBIO.*$/i, "").trim();
  const pageTitle = clean($("title").text()).replace(/\s*\|\s*ITSBIO.*$/i, "").trim();
  return /^ITS ?BIO$/i.test(pageTitle) ? "" : pageTitle;
}

function findPublishedAt($, allText) {
  const meta = $("meta[property='article:published_time']").attr("content") || $("time").first().attr("datetime");
  if (meta && !Number.isNaN(Date.parse(meta))) return new Date(meta).toISOString();
  const match = allText.match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return undefined;
  const [, y, m, d, hh = "00", mm = "00"] = match;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${mm}:00+09:00`;
  return Number.isNaN(Date.parse(iso)) ? undefined : new Date(iso).toISOString();
}

function pickContentRoot($) {
  const selectors = [
    ".kboard-content", ".kboard-document-wrap .content-view", ".content-view", ".board-content", ".view-content",
    ".entry-content", "article .content", "article", "main .content", "main",
  ];
  let best = null;
  let bestLen = 0;
  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const len = clean($(el).text()).length;
      if (len > bestLen) {
        best = el;
        bestLen = len;
      }
    });
  }
  return best ? $(best) : $("body");
}

function stripChrome($, root) {
  root.find("script,style,noscript,iframe,form,input,button,nav,header,footer,.menu,.site-header,.site-footer,.sidebar,.breadcrumb,.pagination,.comments,.comment,.search,.kboard-control,.kboard-document-action").remove();
  root.find("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/javascript:|#respond/i.test(href)) $(el).replaceWith($(el).contents());
  });
}

function blocksFromContent($, root, title) {
  stripChrome($, root);
  const blocks = [];
  const seen = new Set();
  const addBlock = (text, style = "normal", listItem) => {
    const value = clean(text);
    if (!value || value === title || /^(제목|작성자|목록|이전글|다음글)$/i.test(value)) return;
    if (/^(\(주\)이츠바이오|ITSBio,?\s*Inc\.|07532 서울특별시|T\s*:\s*02-3462-8658)/i.test(value)) return;
    const dedupeKey = `${style}:${value}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    blocks.push({
      _type: "block",
      _key: crypto.randomBytes(6).toString("hex"),
      style,
      ...(listItem ? { listItem, level: 1 } : {}),
      markDefs: [],
      children: [{ _type: "span", _key: crypto.randomBytes(6).toString("hex"), text: value, marks: [] }],
    });
  };

  root.find("h1,h2,h3,h4,h5,h6,p,li,blockquote").each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    const value = clean($(el).text());
    if (!value) return;
    if (/^h[1-6]$/.test(tag)) addBlock(value, tag);
    else if (tag === "li") addBlock(value, "normal", "bullet");
    else if (tag === "blockquote") addBlock(value, "blockquote");
    else addBlock(value);
  });

  if (!blocks.length) {
    const text = clean(root.text())
      .replace(/^.*?작성자\s*:?\s*itsbio/i, "")
      .replace(/\(주\)이츠바이오[\s\S]*$/i, "");
    text.split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z가-힣])/).forEach((part) => addBlock(part));
  }
  return blocks.slice(0, 180);
}

function findImages($, root, sourceUrl) {
  const urls = [];
  root.find("img").each((_, img) => {
    const src = $(img).attr("data-src") || $(img).attr("data-lazy-src") || $(img).attr("src") || "";
    if (!src || /^data:/i.test(src)) return;
    try {
      const absolute = new URL(src, sourceUrl).toString();
      if (/logo|icon|flag|spinner|avatar|level/i.test(absolute)) return;
      if (!urls.includes(absolute)) urls.push(absolute);
    } catch {}
  });
  return urls.slice(0, 12);
}

function parseLegacyNotice(html, vid, url) {
  const $ = cheerio.load(html);
  const allText = clean($("body").text());
  const title = findTitle($);
  const publishedAt = findPublishedAt($, allText);
  const root = pickContentRoot($);
  const body = blocksFromContent($, root, title);
  const images = findImages($, root, url);

  const looksLikeNotice = Boolean(
    title &&
    title.length >= 3 &&
    body.length > 0 &&
    (/작성자\s*:?\s*itsbio/i.test(allText) || /page_id=80/i.test(url)) &&
    !/page not found|404|nothing found/i.test(allText)
  );

  if (!looksLikeNotice) return null;
  const baseSlug = slugify(title);
  return {
    vid,
    sourceUrl: url,
    title,
    publishedAt,
    body,
    images,
    slug: `${baseSlug}-${vid}`.slice(0, 96),
  };
}

async function discoverVids() {
  const vids = new Set();
  try {
    const { text } = await fetchWithRetry(LEGACY_BASE, { attempts: 2, timeoutMs: 12000 });
    for (const match of text.matchAll(/[?&]vid=(\d+)/gi)) vids.add(Number(match[1]));
  } catch (error) {
    console.warn(`Legacy list unavailable; probing detail IDs instead: ${error.message}`);
  }
  if (vids.size < 3) {
    for (let vid = 1; vid <= MAX_VID; vid += 1) vids.add(vid);
  }
  return [...vids].sort((a, b) => a - b);
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function runner() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) break;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runner()));
  return results;
}

async function uploadImage(url, filenameHint) {
  if (!APPLY || !TOKEN) return null;
  try {
    const { response } = await fetchWithRetry(url, { attempts: 2, timeoutMs: 20000 });
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > 12 * 1024 * 1024) return null;
    const endpoint = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/assets/images/${DATASET}?filename=${encodeURIComponent(filenameHint)}`;
    const uploaded = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": contentType },
      body: buffer,
    });
    if (!uploaded.ok) throw new Error(`Sanity image upload ${uploaded.status}: ${await uploaded.text()}`);
    const json = await uploaded.json();
    return json.document?._id || json._id || null;
  } catch (error) {
    console.warn(`Image skipped ${url}: ${error.message}`);
    return null;
  }
}

async function sanityMutation(doc) {
  const endpoint = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/mutate/${DATASET}?returnIds=true`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ mutations: [{ createOrReplace: doc }] }),
  });
  if (!response.ok) throw new Error(`Sanity mutation ${response.status}: ${await response.text()}`);
  return response.json();
}

async function main() {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  const vids = await discoverVids();
  console.log(`Checking ${vids.length} legacy notice candidates (max vid ${MAX_VID})`);

  const records = (await mapLimit(vids, CONCURRENCY, async (vid) => {
    const url = `${LEGACY_BASE}&vid=${vid}`;
    try {
      const { text } = await fetchWithRetry(url, { attempts: 2, timeoutMs: 10000 });
      const record = parseLegacyNotice(text, vid, url);
      if (record) console.log(`FOUND vid=${vid}: ${record.title}`);
      return record;
    } catch (error) {
      console.warn(`vid=${vid} skipped: ${error.message}`);
      return null;
    }
  })).filter(Boolean);

  const unique = records.filter((record, index, all) =>
    all.findIndex((candidate) => candidate.title === record.title && candidate.publishedAt === record.publishedAt) === index
  );
  unique.sort((a, b) => String(a.publishedAt || "").localeCompare(String(b.publishedAt || "")));

  const report = {
    generatedAt: new Date().toISOString(),
    source: LEGACY_BASE,
    apply: APPLY,
    checked: vids.length,
    found: unique.length,
    records: unique.map(({ body, ...record }) => ({ ...record, bodyBlocks: body.length })),
  };
  await fs.writeFile(path.join(REPORT_DIR, "latest.json"), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(REPORT_DIR, "latest.md"), [
    "# Legacy Notice Migration",
    "",
    `- Source: ${LEGACY_BASE}`,
    `- Checked candidates: ${vids.length}`,
    `- Valid notices: ${unique.length}`,
    `- Apply mode: ${APPLY}`,
    "",
    ...unique.map((r) => `- ${r.publishedAt?.slice(0, 10) || "date unknown"} · vid ${r.vid} · ${r.title}`),
    "",
  ].join("\n"));

  if (!APPLY) {
    console.log(`Dry run complete: ${unique.length} valid notices. Report: ${REPORT_DIR}/latest.md`);
    return;
  }
  if (!TOKEN) throw new Error("--apply requires a Sanity write token");
  if (!unique.length) throw new Error("Refusing to apply because no legacy notices were discovered");

  let applied = 0;
  for (const record of unique) {
    let thumbnail;
    const firstImage = record.images[0];
    if (firstImage) {
      const assetId = await uploadImage(firstImage, `legacy-notice-${record.vid}`);
      if (assetId) thumbnail = { _type: "image", asset: { _type: "reference", _ref: assetId } };
    }
    const doc = {
      _id: `legacy-notice-${record.vid}`,
      _type: "notice",
      title: record.title,
      slug: { _type: "slug", current: record.slug },
      publishedAt: record.publishedAt || new Date("2021-01-01T00:00:00+09:00").toISOString(),
      isPinned: false,
      isActive: true,
      body: record.body,
      ...(thumbnail ? { thumbnail } : {}),
      legacySource: { url: record.sourceUrl, vid: record.vid },
    };
    await sanityMutation(doc);
    applied += 1;
    console.log(`APPLIED ${applied}/${unique.length}: ${record.title}`);
  }

  report.applied = applied;
  await fs.writeFile(path.join(REPORT_DIR, "latest.json"), JSON.stringify(report, null, 2));
  console.log(`Applied ${applied} legacy notices to Sanity.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
