import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

const APPLY = process.argv.includes("--apply");
const LEGACY_BASE = "http://itsbio.co.kr/?page_id=80";
const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8";
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";
const REPORT_DIR = path.resolve(".cache/legacy-notice-html");
const PINNED_VIDS = new Set([26, 32, 33]);
const TOKEN = [
  process.env.SANITY_WRITE_TOKEN,
  process.env.SANITY_API_WRITE_TOKEN,
  process.env.SANITY_API_TOKEN,
  process.env.SANITY_TOKEN,
  process.env.SANITY_AUTH_TOKEN,
].find(Boolean) || "";

const SAFE_STYLE_PROPERTIES = new Set([
  "background", "background-color",
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-style", "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
  "border-width", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-collapse", "border-spacing", "border-radius",
  "color", "display", "float",
  "font", "font-family", "font-size", "font-style", "font-weight",
  "height", "max-height", "min-height",
  "letter-spacing", "line-height",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "table-layout", "text-align", "text-decoration", "text-transform",
  "vertical-align", "white-space",
  "width", "max-width", "min-width",
]);

const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url, { attempts = 2, timeoutMs = 14000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; ITS-BIO-Legacy-Notice-Fidelity/1.0)",
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
      if (attempt < attempts) await sleep(500 * attempt);
    }
  }
  throw lastError || new Error(`Failed ${url}`);
}

function sanitizeStyle(style) {
  return String(style || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf(":");
      if (index < 1) return "";
      const property = part.slice(0, index).trim().toLowerCase();
      const value = part.slice(index + 1).trim();
      if (!SAFE_STYLE_PROPERTIES.has(property)) return "";
      if (/expression\s*\(|javascript\s*:|url\s*\(|behavior\s*:|-moz-binding/i.test(value)) return "";
      return `${property}:${value}`;
    })
    .filter(Boolean)
    .join(";");
}

function isUsefulImage($, element, sourceUrl) {
  const src = $(element).attr("data-src") || $(element).attr("data-lazy-src") || $(element).attr("src") || "";
  if (!src || /^data:/i.test(src)) return false;
  const width = Number.parseInt($(element).attr("width") || "", 10) || 0;
  const height = Number.parseInt($(element).attr("height") || "", 10) || 0;
  let url;
  try {
    url = new URL(src, sourceUrl).toString();
  } catch {
    return false;
  }
  const fingerprint = `${url} ${$(element).attr("class") || ""} ${$(element).attr("alt") || ""}`;
  if (/logo|icon|flag|spinner|avatar|level|arrow\.png|tracking|pixel|spacer|blank\.(?:gif|png)/i.test(fingerprint)) return false;
  if (width > 0 && height > 0 && width <= 16 && height <= 16) return false;
  return true;
}

async function getArchivedImageUrls(id) {
  const query = `*[_id == $id][0]{"thumbnailUrl":thumbnail.asset->url,"bodyImages":body[_type == "image"][]{"url":asset->url}}`;
  const params = `&$id=${encodeURIComponent(JSON.stringify(id))}`;
  const url = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}?query=${encodeURIComponent(query)}${params}`;
  const response = await fetch(url, { headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {} });
  if (!response.ok) throw new Error(`Sanity query ${response.status}: ${await response.text()}`);
  const result = (await response.json()).result || {};
  return [result.thumbnailUrl, ...(result.bodyImages || []).map((item) => item?.url)].filter(Boolean);
}

function sanitizeLegacyContent(html, sourceUrl, archivedUrls) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const root = $("#mb_board01_tr_content > td.content-box").first();
  if (!root.length) throw new Error("Legacy content-box not found");

  root.find("script,style,noscript,iframe,object,embed,form,input,button,textarea,select,option,link,meta,base,canvas").remove();

  let imageIndex = 0;
  root.find("img").each((_, element) => {
    if (!isUsefulImage($, element, sourceUrl)) {
      $(element).remove();
      return;
    }
    const source = $(element).attr("data-src") || $(element).attr("data-lazy-src") || $(element).attr("src") || "";
    let absolute = "";
    try { absolute = new URL(source, sourceUrl).toString(); } catch {}
    const archived = archivedUrls[imageIndex++];
    const safeSrc = archived || (/^https:\/\//i.test(absolute) ? absolute : "");
    if (!safeSrc) {
      $(element).remove();
      return;
    }
    $(element).attr("src", safeSrc);
    $(element).removeAttr("data-src data-lazy-src srcset sizes decoding fetchpriority");
    $(element).attr("loading", "lazy");
  });

  root.find("*").each((_, element) => {
    const node = $(element);
    const attributes = { ...(element.attribs || {}) };
    for (const name of Object.keys(attributes)) {
      const lower = name.toLowerCase();
      if (lower.startsWith("on") || lower === "srcdoc") node.removeAttr(name);
    }

    const style = sanitizeStyle(node.attr("style"));
    if (style) node.attr("style", style); else node.removeAttr("style");

    node.removeAttr("class id role tabindex contenteditable data-* aria-* bgcolor");

    if (element.tagName === "a") {
      const href = node.attr("href") || "";
      if (!/^(?:https?:\/\/|mailto:|tel:|\/|#)/i.test(href)) node.removeAttr("href");
      if (node.attr("href")) {
        node.attr("target", "_blank");
        node.attr("rel", "noopener noreferrer");
      }
    }
  });

  root.find("table").each((_, element) => {
    const table = $(element);
    if (!table.attr("cellspacing")) table.attr("cellspacing", "0");
  });

  return {
    html: root.html()?.trim() || "",
    usefulImages: imageIndex,
  };
}

async function patchLegacyHtml(id, legacyHtml, isPinned) {
  const endpoint = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/mutate/${DATASET}?returnIds=true`;
  const set = { legacyHtml, ...(isPinned ? { isPinned: true } : {}) };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ mutations: [{ patch: { id, set } }] }),
  });
  if (!response.ok) throw new Error(`Sanity patch ${response.status}: ${await response.text()}`);
}

async function discoverVids() {
  const html = await fetchText(LEGACY_BASE);
  return [...new Set([...html.matchAll(/[?&]vid=(\d+)/gi)].map((match) => Number(match[1])))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

async function main() {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  const vids = await discoverVids();
  if (!vids.length) throw new Error("No legacy Notice IDs discovered");
  if (APPLY && !TOKEN) throw new Error("--apply requires Sanity write token");

  const records = [];
  for (const vid of vids) {
    const id = `legacy-notice-${vid}`;
    const sourceUrl = `${LEGACY_BASE}&vid=${vid}`;
    const sourceHtml = await fetchText(sourceUrl);
    const archivedUrls = await getArchivedImageUrls(id);
    const sanitized = sanitizeLegacyContent(sourceHtml, sourceUrl, archivedUrls);
    if (!sanitized.html || sanitized.html.length < 20) throw new Error(`Refusing empty legacy HTML for ${id}`);
    const isPinned = PINNED_VIDS.has(vid);
    if (APPLY) await patchLegacyHtml(id, sanitized.html, isPinned);
    records.push({ id, vid, sourceUrl, htmlChars: sanitized.html.length, sourceImages: sanitized.usefulImages, archivedImages: archivedUrls.length, isPinned });
    console.log(`${APPLY ? "PATCHED" : "READY"} ${id} · html ${sanitized.html.length} · images ${sanitized.usefulImages}/${archivedUrls.length}${isPinned ? " · PINNED" : ""}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    apply: APPLY,
    source: LEGACY_BASE,
    found: records.length,
    records,
  };
  await fs.writeFile(path.join(REPORT_DIR, "latest.json"), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(REPORT_DIR, "latest.md"), [
    "# Legacy Notice HTML Fidelity",
    "",
    `- Apply: ${APPLY}`,
    `- Notices: ${records.length}`,
    "",
    ...records.map((record) => `- ${record.id} · HTML ${record.htmlChars} chars · images ${record.sourceImages}/${record.archivedImages}${record.isPinned ? " · PINNED" : ""}`),
    "",
  ].join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
