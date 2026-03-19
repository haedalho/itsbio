#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { load } from "cheerio";

const argv = process.argv.slice(2);

const has = (flag) => argv.includes(flag);
const readArg = (flag, fallback = "") => {
  const i = argv.indexOf(flag);
  return i >= 0 ? String(argv[i + 1] ?? fallback) : fallback;
};
const readArgs = (flag) => {
  const out = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && argv[i + 1]) out.push(String(argv[i + 1]));
  }
  return out;
};

const BASE = "https://www.kentscientific.com";
const SITEMAP_URL = readArg("--sitemap", "https://www.kentscientific.com/site-map/");
const DELAY_MS = Number(readArg("--delay", "250")) || 250;
const LIMIT = Number(readArg("--limit", "0")) || 0;
const URL_FILE = readArg("--file", "");
const SAMPLE = has("--sample");
const NO_CACHE = has("--noCache");
const VERBOSE = has("--verbose");
const OUT = path.resolve(
  readArg("--out", path.join(process.cwd(), ".cache", "kent-product-profile.json"))
);
const CACHE_DIR = path.resolve(
  readArg("--cacheDir", path.join(process.cwd(), ".cache", "kent-product-profile"))
);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

function log(...args) {
  console.log("[kent-profile]", ...args);
}

function warn(...args) {
  console.warn("[kent-profile]", ...args);
}

function textClean(s) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlSnippet(html, max = 1800) {
  return String(html || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function sha1(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function absUrl(base, href) {
  try {
    return new URL(String(href || ""), base).toString();
  } catch {
    return String(href || "").trim();
  }
}

function normalizeUrl(u) {
  try {
    const url = new URL(String(u || "").trim());
    url.hash = "";
    if (url.hostname === "kentscientific.com") url.hostname = "www.kentscientific.com";
    return url.toString();
  } catch {
    return String(u || "").trim();
  }
}

function dedupeStrings(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

function dedupeByHref(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const href = item.href || item.url || "";
    if (!href || seen.has(href)) continue;
    seen.add(href);
    out.push(item);
  }
  return out;
}

function slugFromProductsUrl(u) {
  try {
    const url = new URL(u);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("products");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return parts.at(-1) || "";
  } catch {
    return "";
  }
}

function pathFromProductArchiveUrl(u) {
  try {
    const url = new URL(u);
    const p = url.pathname || "";
    const idx = p.indexOf("/product/");
    if (idx === -1) return [];
    const rest = p
      .slice(idx + "/product/".length)
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
    return rest ? rest.split("/").filter(Boolean) : [];
  } catch {
    return [];
  }
}

function isProbablyProductUrl(u) {
  try {
    const url = new URL(u);
    return url.pathname.startsWith("/products/");
  } catch {
    return false;
  }
}

function looksGenericYoutube(u) {
  const s = String(u || "").toLowerCase();
  return (
    s.includes("youtube.com/user/kentscientific") ||
    s.includes("youtube.com/@kentscientific") ||
    s.includes("youtube.com/channel/") ||
    s === "https://www.youtube.com/user/kentscientific"
  );
}

const SUPPORT_PATTERNS = [
  /need help\??/i,
  /need help with your order/i,
  /help\s*&\s*support/i,
  /our product specialists/i,
  /our specialists/i,
  /we reply fast/i,
  /usually in 24 hours/i,
  /give us a call today/i,
  /call\s+888-572-8887/i,
  /chat with an expert/i,
  /contact us/i,
  /call us/i,
  /request a quote/i,
  /request quote/i,
  /get quote/i,
];

const UI_PATTERNS = [
  /^choose an option$/i,
  /^clear$/i,
  /^add to cart$/i,
  /^increase quantity$/i,
  /^decrease quantity$/i,
  /^qty$/i,
  /^\+$/i,
  /^-$/i,
  /^login to see prices$/i,
  /\bgtag\s*\(/i,
  /\b123\s*4567\s*890\b/i,
];

function isSupportText(text) {
  const s = textClean(text);
  if (!s) return false;
  return SUPPORT_PATTERNS.some((re) => re.test(s));
}

function isUiNoiseText(text) {
  const s = textClean(text);
  if (!s) return false;
  return UI_PATTERNS.some((re) => re.test(s));
}

function isNoiseText(text) {
  return isSupportText(text) || isUiNoiseText(text);
}

function stripSupportAndUiText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((v) => textClean(v))
    .filter(Boolean);

  return lines
    .filter((line) => !isNoiseText(line))
    .join("\n")
    .trim();
}

function hasMeaningfulText(text) {
  const s = textClean(text);
  if (!s) return false;
  if (isNoiseText(s)) return false;
  return true;
}

function isShortMostlyUi(text) {
  const s = textClean(text);
  if (!s) return false;
  if (s.length > 60) return false;
  if (isNoiseText(s)) return true;
  if (/^(choose|clear|add|qty|\+|-)/i.test(s)) return true;
  return false;
}

function guessSectionType(heading, blockText, hasTable, hasPdf, hasVideo, listCount) {
  const h = String(heading || "").toLowerCase();
  const t = String(blockText || "").toLowerCase();
  const combined = `${h} ${t}`;

  if (/video/.test(combined) || hasVideo) return "videos";
  if (/resource|download|document|manual|datasheet|brochure|sds|msds/.test(combined) || hasPdf) {
    return "resources";
  }
  if (/publication|paper|reference|citation/.test(combined)) return "publications";
  if (/faq|frequently asked/.test(combined)) return "faq";
  if (/comparison|compare/.test(combined)) return "comparison";
  if (/what.*get|includes|included|base system includes/.test(combined)) return "included";
  if (/feature|benefit|advantages|why /.test(combined)) return "features";
  if (/specification|technical|parameter|product specifications?/.test(combined)) return "specifications";
  if (/how to|clean|care|maintenance|instruction|instructions/.test(combined)) return "instructions";
  if (/testimonial|review|what your peers say/.test(combined)) return "testimonials";
  if (
    hasTable &&
    /item|item id|model|cat|catalog|cat\.|part|order|sku|size|length|weight|diameter|height|width/.test(combined)
  ) {
    return "variantTable";
  }
  if (hasTable) return "table";
  if (listCount >= 4) return "list";
  return "richText";
}

function summarizeTable($, tableEl) {
  const $table = $(tableEl);
  const headers = [];

  $table.find("thead th").each((_, el) => {
    const tx = textClean($(el).text());
    if (tx) headers.push(tx);
  });

  if (!headers.length) {
    $table.find("tr").first().find("th,td").each((_, el) => {
      const tx = textClean($(el).text());
      if (tx) headers.push(tx);
    });
  }

  const rows = [];

  $table.find("tbody tr").slice(0, 10).each((_, tr) => {
    const row = [];
    $(tr).find("th,td").each((__, cell) => {
      row.push(textClean($(cell).text()));
    });
    if (row.some(Boolean)) rows.push(row);
  });

  if (!rows.length) {
    $table.find("tr").slice(1, 11).each((_, tr) => {
      const row = [];
      $(tr).find("th,td").each((__, cell) => {
        row.push(textClean($(cell).text()));
      });
      if (row.some(Boolean)) rows.push(row);
    });
  }

  return {
    headers,
    rowCount: $table.find("tr").length,
    previewRows: rows,
  };
}

function isLikelyVariantHeader(header) {
  const s = String(header || "").toLowerCase();
  return /item|item id|model|cat|catalog|cat\.|part|order|sku/.test(s);
}

function extractVariantRowsFromTableSummary(summary) {
  const headers = summary?.headers || [];
  const rows = summary?.previewRows || [];
  if (!headers.length || !rows.length) return [];

  const normalizedHeaders = headers.map((h) => textClean(h));
  const hasVariantCol = normalizedHeaders.some(isLikelyVariantHeader);
  if (!hasVariantCol) return [];

  return rows.map((row) => {
    const obj = {};
    normalizedHeaders.forEach((h, i) => {
      obj[h] = textClean(row[i] || "");
    });

    let itemId = "";
    for (const key of normalizedHeaders) {
      if (isLikelyVariantHeader(key)) itemId = obj[key] || itemId;
    }

    return {
      itemId,
      values: obj,
    };
  });
}

function cleanupPreviewText(text) {
  const cleaned = stripSupportAndUiText(text);
  return cleaned
    .split("\n")
    .map((line) => textClean(line))
    .filter((line) => line && !isShortMostlyUi(line))
    .join("\n")
    .trim();
}

function cleanupSection(section, pageTitle = "") {
  const next = { ...section };

  next.heading = textClean(next.heading || "");
  next.textPreview = cleanupPreviewText(next.textPreview || "");

  if (next.heading && pageTitle && next.heading.toLowerCase() === textClean(pageTitle).toLowerCase()) {
    if (!next.textPreview && !next.tableCount && !next.pdfCount && !next.videoCount) {
      return null;
    }
  }

  const combined = `${next.heading} ${next.textPreview}`.trim();

  if (!combined && !next.tableCount && !next.pdfCount && !next.videoCount) return null;
  if (isSupportText(combined)) return null;
  if (isUiNoiseText(combined)) return null;

  if (
    next.heading &&
    !next.textPreview &&
    !next.tableCount &&
    !next.pdfCount &&
    !next.videoCount &&
    !next.bulletCount
  ) {
    return null;
  }

  return next;
}

function mergeTinySections(sections) {
  const out = [];

  for (const sec of sections) {
    const current = { ...sec };
    const textLen = textClean(current.textPreview || "").length;
    const noTables = !current.tableCount;
    const noPdfs = !current.pdfCount;
    const noVideos = !current.videoCount;
    const isTinyRichText =
      current.type === "richText" &&
      textLen > 0 &&
      textLen <= 150 &&
      noTables &&
      noPdfs &&
      noVideos;

    if (
      isTinyRichText &&
      out.length &&
      ["included", "features", "instructions", "list", "richText"].includes(out[out.length - 1].type)
    ) {
      const prev = out[out.length - 1];
      prev.textPreview = textClean(`${prev.textPreview || ""}\n• ${current.textPreview || ""}`);
      prev.htmlPreview = htmlSnippet(`${prev.htmlPreview || ""} ${current.htmlPreview || ""}`);
      prev.bulletCount = Number(prev.bulletCount || 0) + 1;
      continue;
    }

    out.push(current);
  }

  return out;
}

function sanitizeContentRootHtml(contentHtml) {
  const $$ = load(`<div id="root">${contentHtml || ""}</div>`, { decodeEntities: false });
  const $root = $$("#root");

  const removeSelectors = [
    "script",
    "style",
    "noscript",
    ".product_meta",
    ".related",
    ".upsells",
    ".cross-sells",
    ".cross_sell",
    ".product_list_widget",
    ".widget",
    ".sharedaddy",
    ".social-share",
    ".share",
    ".sticky-add-to-cart",
    ".woocommerce-product-gallery",
    ".woocommerce-tabs ul.tabs",
    ".woocommerce-breadcrumb",
    ".price",
    ".cart",
    "form.cart",
    "form.variations_form",
    ".quantity",
    ".qty",
    ".single_add_to_cart_button",
    ".reset_variations",
    ".porto-product-filters",
    ".addthis_inline_share_toolbox",
    ".yith-wcwl-add-to-wishlist",
    ".woosw-btn",
    ".wishlist",
    "footer",
    ".footer",
    ".site-footer",
  ];

  for (const sel of removeSelectors) {
    try {
      $root.find(sel).remove();
    } catch {
      // ignore
    }
  }

  $root.find("*").each((_, el) => {
    const $el = $$(el);
    const tag = (el.tagName || "").toLowerCase();

    if (["script", "style", "noscript"].includes(tag)) {
      $el.remove();
      return;
    }

    const txt = textClean($el.text());
    if (!txt) return;

    if (isNoiseText(txt) && $el.find("*").length === 0) {
      $el.remove();
      return;
    }

    if (isSupportText(txt) && txt.length < 220) {
      $el.remove();
      return;
    }

    if (/^(isoflurane, usp|ac adapters and power cords)$/i.test(txt) && $el.find("*").length === 0) {
      $el.remove();
      return;
    }
  });

  return $root.html() || "";
}

function buildSectionFromParts($, heading, parts) {
  const blockHtml = parts.join("\n");
  const $tmp = load(`<div id="tmp">${blockHtml}</div>`, { decodeEntities: false });
  const $wrap = $tmp("#tmp");

  const rawText = cleanupPreviewText($wrap.text());
  const tableEls = $wrap.find("table").toArray();
  const hasPdf = $wrap.find('a[href$=".pdf"], a[href*=".pdf?"]').length > 0;
  const hasVideo =
    $wrap.find('iframe[src*="youtube"], iframe[src*="vimeo"], video, a[href*="youtube"], a[href*="vimeo"]').length > 0;
  const bulletCount = $wrap.find("li").length;

  const section = {
    heading: textClean(heading || ""),
    type: guessSectionType(heading, rawText, tableEls.length > 0, hasPdf, hasVideo, bulletCount),
    textPreview: rawText.slice(0, 1800),
    htmlPreview: htmlSnippet(blockHtml),
    tableCount: tableEls.length,
    bulletCount,
    pdfCount: $wrap.find('a[href$=".pdf"], a[href*=".pdf?"]').length,
    videoCount: $wrap.find('iframe[src*="youtube"], iframe[src*="vimeo"], video, a[href*="youtube"], a[href*="vimeo"]').length,
    tables: tableEls.slice(0, 4).map((el) => summarizeTable($tmp, el)),
  };

  return section;
}

function extractSectionsRecursively(contentHtml, pageTitle = "") {
  const $$ = load(`<div id="root">${contentHtml || ""}</div>`, { decodeEntities: false });
  const $root = $$("#root");

  const sections = [];
  const introParts = [];
  let current = null;

  function flushCurrent() {
    if (!current) return;
    const built = buildSectionFromParts($$, current.heading, current.parts);
    const cleaned = cleanupSection(built, pageTitle);
    if (cleaned) sections.push(cleaned);
    current = null;
  }

  function pushHtml(html) {
    if (!htmlSnippet(html)) return;
    if (current) current.parts.push(html);
    else introParts.push(html);
  }

  function shouldDropTextBlock(txt) {
    if (!txt) return true;
    if (isNoiseText(txt)) return true;
    if (/^(isoflurane, usp|ac adapters and power cords)$/i.test(txt)) return true;
    return false;
  }

  function walk(nodes) {
    for (const node of nodes) {
      if (!node) continue;

      if (node.type === "text") {
        const txt = cleanupPreviewText(node.data || "");
        if (hasMeaningfulText(txt) && !shouldDropTextBlock(txt)) {
          pushHtml(`<p>${escapeHtml(txt)}</p>`);
        }
        continue;
      }

      if (node.type !== "tag") continue;

      const tag = String(node.tagName || "").toLowerCase();
      const $node = $$(node);

      if (["script", "style", "noscript"].includes(tag)) continue;

      if (["h2", "h3", "h4"].includes(tag)) {
        const heading = textClean($node.text());
        if (!heading) continue;
        if (isNoiseText(heading)) continue;
        flushCurrent();
        current = { heading, parts: [] };
        continue;
      }

      const childHeadings = $node.children("h2,h3,h4");
      if (childHeadings.length > 0) {
        walk($node.contents().toArray());
        continue;
      }

      const txt = cleanupPreviewText($node.text());
      const hasAssets = $node.find("table,iframe,video,a[href$='.pdf'],a[href*='.pdf?']").length > 0;

      if (!txt && !hasAssets) continue;
      if (shouldDropTextBlock(txt) && !hasAssets) continue;

      const outer = $$.html(node) || "";
      pushHtml(outer);
    }
  }

  walk($root.contents().toArray());
  flushCurrent();

  if (introParts.length) {
    const intro = buildSectionFromParts($$, "", introParts);
    const cleanedIntro = cleanupSection(intro, pageTitle);
    if (cleanedIntro) sections.unshift(cleanedIntro);
  }

  return mergeTinySections(
    sections.filter((sec) => {
      const combined = `${sec.heading || ""} ${sec.textPreview || ""}`.trim();
      if (!combined && !sec.tableCount && !sec.pdfCount && !sec.videoCount) return false;
      if (isNoiseText(combined)) return false;
      return true;
    })
  );
}

function collectOptionGroups($) {
  const groups = [];

  function addGroup(label, options, source = "unknown") {
    const cleanLabel = textClean(label || "");
    const cleanOptions = (options || [])
      .map((opt) => ({
        value: textClean(opt.value || ""),
        text: textClean(opt.text || opt.label || ""),
      }))
      .filter((opt) => opt.text || opt.value)
      .filter((opt) => !isNoiseText(opt.text) && !isNoiseText(opt.value))
      .filter((opt) => !/^(choose an option|\+|-|add to cart)$/i.test(opt.text));

    if (!cleanLabel && !cleanOptions.length) return;

    const key = JSON.stringify({
      label: cleanLabel.toLowerCase(),
      opts: cleanOptions.map((v) => `${v.value}||${v.text}`),
    });

    if (!addGroup._seen) addGroup._seen = new Set();
    if (addGroup._seen.has(key)) return;
    addGroup._seen.add(key);

    groups.push({
      label: cleanLabel,
      options: cleanOptions,
      source,
    });
  }

  $("form.variations_form select, form.cart select").each((_, sel) => {
    const $sel = $(sel);
    const labelId = $sel.attr("id");
    let label = "";

    if (labelId) label = textClean($(`label[for="${labelId}"]`).first().text());
    if (!label) label = textClean($sel.closest("tr").find("th,label").first().text());
    if (!label) label = textClean($sel.attr("name") || "");

    const options = [];
    $sel.find("option").each((__, opt) => {
      const value = textClean($(opt).attr("value") || "");
      const text = textClean($(opt).text());
      if (!text) return;
      if (isNoiseText(text) || isNoiseText(value)) return;
      if (/^choose an option$/i.test(text)) return;
      options.push({ value, text });
    });

    addGroup(label, options, "select");
  });

  $('form input[type="radio"], form input[type="checkbox"]').each((_, input) => {
    const $input = $(input);
    const name = textClean($input.attr("name") || "");
    const value = textClean($input.attr("value") || "");
    let label = "";

    const id = $input.attr("id");
    if (id) label = textClean($(`label[for="${id}"]`).first().text());
    if (!label) label = textClean($input.closest("label").text());
    if (!label) label = value;

    if (!name || !label) return;
    if (isNoiseText(label) || isNoiseText(value)) return;

    const existing = groups.find((g) => g.label.toLowerCase() === name.toLowerCase());
    if (existing) {
      const exists = existing.options.some((o) => o.value === value && o.text === label);
      if (!exists) existing.options.push({ value, text: label });
    } else {
      addGroup(name, [{ value, text: label }], "radio");
    }
  });

  const buttonBuckets = new Map();

  $(
    'form .button-variable-item, form .swatch, form .swatch-item, form [role="radio"], form button[data-value], form a[data-value]'
  ).each((_, el) => {
    const $el = $(el);
    const value = textClean($el.attr("data-value") || $el.attr("value") || $el.text());
    if (!value || isNoiseText(value)) return;

    const label =
      textClean($el.attr("data-attribute_name")) ||
      textClean($el.closest("[data-attribute_name]").attr("data-attribute_name")) ||
      textClean($el.closest(".variations").find("label,th").first().text()) ||
      "Option";

    if (!buttonBuckets.has(label)) buttonBuckets.set(label, []);
    buttonBuckets.get(label).push({ value, text: value });
  });

  for (const [label, opts] of buttonBuckets.entries()) {
    addGroup(label, opts, "buttons");
  }

  const rawVariationText = [];
  $(".summary, form.variations_form, form.cart")
    .find("*")
    .each((_, el) => {
      const tag = (el.tagName || "").toLowerCase();
      if (["script", "style"].includes(tag)) return;
      const txt = textClean($(el).text());
      if (!txt) return;
      if (isNoiseText(txt)) return;
      if (/^choose an option$/i.test(txt)) return;
      if (/^[-+]+$/i.test(txt)) return;
      if (/^(qty|quantity)$/i.test(txt)) return;
      if (/^add to cart$/i.test(txt)) return;
      rawVariationText.push(txt);
    });

  const curatedRawVariationText = dedupeStrings(rawVariationText)
    .filter((txt) => !isShortMostlyUi(txt))
    .slice(0, 80);

  return {
    optionGroups: groups,
    rawVariationText: curatedRawVariationText,
  };
}

function collectVariationJson($) {
  const payloads = [];

  function cleanPriceText(v) {
    const s = textClean(v || "");
    if (!s) return "";
    if (isNoiseText(s)) return "";
    if (/login to see prices/i.test(s)) return "";
    return s;
  }

  $("form.variations_form").each((_, form) => {
    const raw = $(form).attr("data-product_variations");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      payloads.push(
        ...parsed.map((item) => {
          const attrs = item?.attributes || {};
          const normalizedAttrs = {};
          for (const [k, v] of Object.entries(attrs)) {
            normalizedAttrs[k] = textClean(v || "");
          }

          const priceText = cleanPriceText(load(`<div>${item?.price_html || ""}</div>`)("div").text());

          return {
            variationId: item?.variation_id ?? "",
            sku: textClean(item?.sku || ""),
            priceText,
            displayPrice: item?.display_price ?? "",
            displayRegularPrice: item?.display_regular_price ?? "",
            isInStock: item?.is_in_stock ?? "",
            image: normalizeUrl(item?.image?.src || ""),
            attributes: normalizedAttrs,
          };
        })
      );
    } catch {
      // ignore
    }
  });

  return payloads;
}

function collectVideos($, canonical) {
  const urls = [];

  $('iframe[src], video source[src], a[href*="youtube"], a[href*="vimeo"]').each((_, el) => {
    const href = normalizeUrl(absUrl(canonical, $(el).attr("src") || $(el).attr("href") || ""));
    if (!href) return;
    urls.push(href);
  });

  return dedupeStrings(urls).filter((u) => !looksGenericYoutube(u));
}

function collectPdfs($, canonical) {
  const pdfs = [];

  $('main a[href], .summary a[href], #tab-description a[href], .woocommerce-Tabs-panel--description a[href]').each(
    (_, a) => {
      const href = normalizeUrl(absUrl(canonical, $(a).attr("href") || ""));
      if (!/\.pdf($|\?)/i.test(href)) return;

      const title = textClean($(a).text()) || path.basename(href).split("?")[0];
      if (isNoiseText(title)) return;

      pdfs.push({ title, href });
    }
  );

  return dedupeByHref(pdfs);
}

function collectRelatedProducts($, canonical) {
  const relatedProducts = [];

  $('section.related a[href*="/products/"], .related a[href*="/products/"], .upsells a[href*="/products/"]').each(
    (_, a) => {
      const href = normalizeUrl(absUrl(canonical, $(a).attr("href") || ""));
      if (!isProbablyProductUrl(href)) return;
      const label = textClean($(a).text()) || slugFromProductsUrl(href);
      if (!href || isNoiseText(label)) return;
      relatedProducts.push({ label, href });
    }
  );

  return dedupeByHref(relatedProducts);
}

function collectImages($, canonical) {
  const imageUrls = [];

  $(".woocommerce-product-gallery img, .summary img, main img").each((_, img) => {
    const src =
      $(img).attr("data-src") ||
      $(img).attr("src") ||
      $(img).attr("data-large_image") ||
      $(img).attr("data-lazy-src") ||
      "";

    const u = normalizeUrl(absUrl(canonical, src));
    if (!u) return;
    if (/logo|icon|favicon|badge|seal|trustpilot|review/i.test(u)) return;
    imageUrls.push(u);
  });

  return dedupeStrings(imageUrls).slice(0, 40);
}

function detectCommerceModel($, metaText, sections, optionGroups, variationPayloads) {
  const hasSelect = optionGroups.length > 0;
  const hasQty = $('form.cart input.qty').length > 0;
  const hasVariationForm = $("form.variations_form").length > 0;
  const hasAddToCart = $('button.single_add_to_cart_button, button[name="add-to-cart"]').length > 0;
  const hasItemNa = /item\s*#\s*[:#]?\s*n\/?a/i.test(metaText);

  const sectionNames = sections.map((s) => s.heading.toLowerCase()).join(" | ");
  const tableVariantSignal = sections.some((s) => s.type === "variantTable");
  const hasVariationJson = variationPayloads.length > 0;

  let model = "singleSku";

  if (hasVariationForm || hasVariationJson || hasSelect) model = "optionSelector";
  else if (tableVariantSignal) model = "tableVariants";
  else if (/module|system|configuration|bundle/.test(sectionNames)) model = "bundleOrSystem";
  else if (/warranty/.test(sectionNames) || /warranty/.test(metaText)) model = "serviceOrWarranty";
  else if (!hasAddToCart && hasItemNa) model = "configOrInquiry";

  return {
    model,
    hasSelect,
    hasQty,
    hasVariationForm,
    hasAddToCart,
    hasItemNa,
    hasVariationJson,
  };
}

function extractAllRelevantTables(sections) {
  const out = [];

  for (const section of sections || []) {
    for (const table of section.tables || []) {
      const rows = extractVariantRowsFromTableSummary(table);
      out.push({
        sectionHeading: section.heading || "",
        sectionType: section.type || "",
        headers: table.headers || [],
        rowCount: table.rowCount || 0,
        previewRows: table.previewRows || [],
        variantRows: rows,
      });
    }
  }

  return out;
}

function buildVariantCandidates(optionGroups, variationPayloads, allTables) {
  const variants = [];

  if (variationPayloads.length) {
    for (const item of variationPayloads) {
      variants.push({
        source: "variationJson",
        label: Object.values(item.attributes || {}).filter(Boolean).join(" / "),
        itemId: item.sku || "",
        sku: item.sku || "",
        priceText: item.priceText || "",
        displayPrice: item.displayPrice || "",
        displayRegularPrice: item.displayRegularPrice || "",
        isInStock: item.isInStock,
        image: item.image || "",
        attributes: item.attributes || {},
      });
    }
  }

  const variantTables = allTables.filter((t) => (t.variantRows || []).length > 0);
  const primaryGroup = optionGroups[0];

  if (!variants.length && primaryGroup?.options?.length && variantTables.length) {
    const firstTable = variantTables[0];
    const rows = firstTable.variantRows || [];

    if (rows.length === primaryGroup.options.length) {
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const opt = primaryGroup.options[i];
        variants.push({
          source: "matchedOptionAndTable",
          label: opt.text || opt.value || "",
          optionValue: opt.value || "",
          itemId: row.itemId || "",
          sku: row.itemId || "",
          attributes: { [primaryGroup.label || "Option"]: opt.text || opt.value || "" },
          tableValues: row.values || {},
        });
      }
    }
  }

  if (!variants.length && variantTables.length) {
    for (const table of variantTables) {
      for (const row of table.variantRows) {
        variants.push({
          source: "tableOnly",
          label: row.itemId || "",
          itemId: row.itemId || "",
          sku: row.itemId || "",
          tableValues: row.values || {},
        });
      }
    }
  }

  return variants;
}

function postCleanSections(sections, pageTitle) {
  return mergeTinySections(
    (sections || [])
      .map((sec) => cleanupSection(sec, pageTitle))
      .filter(Boolean)
      .filter((sec) => {
        const combined = `${sec.heading || ""} ${sec.textPreview || ""}`.trim();
        if (!combined && !sec.tableCount && !sec.pdfCount && !sec.videoCount) return false;
        if (isSupportText(combined)) return false;
        if (isUiNoiseText(combined)) return false;
        return true;
      })
  );
}

function parseProduct(html, url) {
  const $ = load(html, { decodeEntities: false });

  const canonical = normalizeUrl($('link[rel="canonical"]').attr("href") || url);
  const title = textClean($("h1").first().text()) || textClean($("title").text());
  const metaText = cleanupPreviewText($(".product_meta").text());

  const breadcrumbs = [];
  $(".woocommerce-breadcrumb a, nav.woocommerce-breadcrumb a, .breadcrumb a").each((_, el) => {
    const label = textClean($(el).text());
    const href = normalizeUrl(absUrl(canonical, $(el).attr("href") || ""));
    if (label) breadcrumbs.push({ label, href });
  });

  const categoryLinks = [];
  $('.product_meta a[href*="/product/"], .posted_in a[href*="/product/"], .product_cat a[href*="/product/"]').each(
    (_, el) => {
      const href = normalizeUrl(absUrl(canonical, $(el).attr("href") || ""));
      const pathArr = pathFromProductArchiveUrl(href);
      if (pathArr.length) categoryLinks.push({ href, pathArr });
    }
  );
  categoryLinks.sort((a, b) => b.pathArr.length - a.pathArr.length);

  const imageUrls = collectImages($, canonical);
  const pdfs = collectPdfs($, canonical);
  const videos = collectVideos($, canonical);
  const relatedProducts = collectRelatedProducts($, canonical);

  const { optionGroups, rawVariationText } = collectOptionGroups($);
  const variationPayloads = collectVariationJson($);

  let $contentRoot = $("#tab-description");
  if (!$contentRoot.length) $contentRoot = $("div.woocommerce-Tabs-panel--description").first();
  if (!$contentRoot.length) $contentRoot = $(".woocommerce-product-details__short-description").first();
  if (!$contentRoot.length) $contentRoot = $(".entry-summary").first();
  if (!$contentRoot.length) $contentRoot = $("main .product").first();
  if (!$contentRoot.length) $contentRoot = $("main").first();
  if (!$contentRoot.length) $contentRoot = $("body");

  const cleanedContentHtml = sanitizeContentRootHtml($contentRoot.html() || "");
  const rawSections = extractSectionsRecursively(cleanedContentHtml, title);
  const sections = postCleanSections(rawSections, title);
  const tables = extractAllRelevantTables(sections);

  const commerce = detectCommerceModel($, metaText, sections, optionGroups, variationPayloads);
  const variants = buildVariantCandidates(optionGroups, variationPayloads, tables);

  const itemMatch = metaText.match(/\bItem\s*#\s*[:#]?\s*([^\s|,]{1,120})/i);
  const sku = itemMatch ? textClean(itemMatch[1]) : "";

  const bodyTextPreview = cleanupPreviewText(
    sections
      .map((s) => [s.heading, s.textPreview].filter(Boolean).join("\n"))
      .filter(Boolean)
      .join("\n\n")
  ).slice(0, 7000);

  const quickFacts = {
    sectionCount: sections.length,
    tableCount: sections.reduce((n, s) => n + Number(s.tableCount || 0), 0),
    pdfCount: pdfs.length,
    videoCount: videos.length,
    imageCount: imageUrls.length,
    relatedCount: relatedProducts.length,
    optionGroupCount: optionGroups.length,
    variantCandidateCount: variants.length,
    hasFaq: sections.some((s) => s.type === "faq"),
    hasComparison: sections.some((s) => s.type === "comparison"),
    hasPublications: sections.some((s) => s.type === "publications"),
    hasResources: sections.some((s) => s.type === "resources"),
    hasIncluded: sections.some((s) => s.type === "included"),
    hasInstructions: sections.some((s) => s.type === "instructions"),
  };

  return {
    title,
    slug: slugFromProductsUrl(canonical),
    sourceUrl: canonical,
    sku,
    metaText,
    categoryPath: categoryLinks[0]?.pathArr || [],
    categoryLinks,
    breadcrumbs,
    commerce: {
      ...commerce,
      optionGroups,
      rawVariationText,
      variationPayloads: variationPayloads.slice(0, 80),
      variants,
    },
    quickFacts,
    sections,
    tables,
    imageUrls,
    pdfs,
    videos,
    relatedProducts,
    bodyTextPreview,
  };
}

function shouldKeepParsedProduct(parsed) {
  if (!parsed?.sourceUrl) return false;
  if (!isProbablyProductUrl(parsed.sourceUrl)) return false;
  if (!parsed?.title) return false;
  return true;
}

async function fetchText(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
        referer: `${BASE}/`,
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCached(url) {
  const key = sha1(url);
  const cacheFile = path.join(CACHE_DIR, `${key}.html`);

  if (!NO_CACHE && fs.existsSync(cacheFile)) {
    if (VERBOSE) log("cache hit", url);
    return fs.readFileSync(cacheFile, "utf8");
  }

  if (VERBOSE) log("fetch", url);
  const html = await fetchText(url);
  fs.writeFileSync(cacheFile, html, "utf8");
  await sleep(DELAY_MS);
  return html;
}

function collectProductUrlsFromSitemap(html) {
  const $ = load(html, { decodeEntities: false });
  const urls = [];

  $("a[href]").each((_, a) => {
    const href = normalizeUrl(absUrl(SITEMAP_URL, $(a).attr("href") || ""));
    if (!isProbablyProductUrl(href)) return;
    urls.push(href);
  });

  return dedupeStrings(urls).sort();
}

function readUrlInputs() {
  const urls = [];

  for (const u of readArgs("--url")) {
    urls.push(normalizeUrl(u));
  }

  if (URL_FILE) {
    const filePath = path.resolve(URL_FILE);
    if (!fs.existsSync(filePath)) throw new Error(`URL file not found: ${filePath}`);

    const lines = fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((s) => normalizeUrl(s.trim()))
      .filter(Boolean);

    urls.push(...lines);
  }

  return dedupeStrings(urls).filter(Boolean);
}

function saveSnapshot(payload) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
}

async function main() {
  log(`output: ${OUT}`);
  log(`cacheDir: ${CACHE_DIR}`);

  const output = {
    generatedAt: new Date().toISOString(),
    source: "Kent Scientific product pages",
    sitemapUrl: SITEMAP_URL,
    count: 0,
    ok: 0,
    fail: 0,
    skipped: 0,
    results: [],
  };

  try {
    let urls = readUrlInputs();

    if (!urls.length || SAMPLE) {
      const sitemapHtml = await fetchCached(SITEMAP_URL);
      const all = collectProductUrlsFromSitemap(sitemapHtml);
      urls = LIMIT > 0 ? all.slice(0, LIMIT) : all;
    }

    if (!urls.length) {
      output.results.push({
        error: "No product URLs found. Use --url, --file, or --sample --limit N",
      });
      output.count = output.results.length;
      saveSnapshot(output);
      throw new Error("No product URLs found. JSON error report was still saved.");
    }

    log(`targets: ${urls.length}`);

    for (let i = 0; i < urls.length; i += 1) {
      const url = urls[i];

      try {
        if (!isProbablyProductUrl(url)) {
          output.skipped += 1;
          process.stdout.write(
            `\r[${i + 1}/${urls.length}] ok=${output.ok} fail=${output.fail} skip=${output.skipped} SKIP`
          );
          continue;
        }

        const html = await fetchCached(url);
        const parsed = parseProduct(html, url);

        if (!shouldKeepParsedProduct(parsed)) {
          output.skipped += 1;
          process.stdout.write(
            `\r[${i + 1}/${urls.length}] ok=${output.ok} fail=${output.fail} skip=${output.skipped} SKIP`
          );
          continue;
        }

        output.results.push(parsed);
        output.ok += 1;
        output.count = output.results.length;
        saveSnapshot(output);

        process.stdout.write(
          `\r[${i + 1}/${urls.length}] ok=${output.ok} fail=${output.fail} skip=${output.skipped} ${parsed.slug || parsed.title}`
        );
      } catch (err) {
        output.fail += 1;
        output.results.push({
          sourceUrl: url,
          error: String(err?.message || err),
        });
        output.count = output.results.length;
        saveSnapshot(output);
        process.stdout.write(
          `\r[${i + 1}/${urls.length}] ok=${output.ok} fail=${output.fail} skip=${output.skipped} ERROR`
        );
      }
    }

    process.stdout.write("\n");

    output.generatedAt = new Date().toISOString();
    output.count = output.results.length;
    saveSnapshot(output);

    log(`saved: ${OUT}`);
    log(`ok=${output.ok} fail=${output.fail} skipped=${output.skipped}`);
  } catch (err) {
    output.generatedAt = new Date().toISOString();
    output.count = output.results.length;
    output.fatalError = String(err?.message || err);
    saveSnapshot(output);
    warn(String(err?.message || err));
    warn(`error report saved to: ${OUT}`);
    process.exit(1);
  }
}

main();