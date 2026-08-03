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

const BASE = "https://www.kentscientific.com";
const LISTING_JSON = path.resolve(
  readArg("--listing", path.join(process.cwd(), ".cache", "kent-listing-all.json"))
);
const OUT = path.resolve(
  readArg("--out", path.join(process.cwd(), ".cache", "kent-products-from-listing.json"))
);
const CACHE_DIR = path.resolve(
  readArg("--cacheDir", path.join(process.cwd(), ".cache", "kent-product-from-listing"))
);
const DELAY_MS = Number(readArg("--delay", "250")) || 250;
const LIMIT = Number(readArg("--limit", "0")) || 0;
const CONCURRENCY = Math.max(1, Math.min(8, Number(readArg("--concurrency", "4")) || 4));
const ONLY_SLUG = readArg("--slug", "").trim();
const NO_CACHE = has("--noCache");
const VERBOSE = has("--verbose");
const MONEY_RE = /(?:[$€£¥₩]\s*\d[\d,.]*|(?:USD|EUR|GBP|JPY|KRW)\s*\d[\d,.]*|\d[\d,.]*\s*(?:USD|EUR|GBP|JPY|KRW|원))/i;
const EXCLUDED_SECTION_RE = /^(?:need help|help\s*&\s*support|call\s+\d|not sure which|how much could you save|calculate your savings|calculation based on|get early access|newsletter)/i;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

function log(...args) {
  console.log("[kent-link]", ...args);
}

function warn(...args) {
  console.warn("[kent-link]", ...args);
}

function textClean(s) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function normalizeTrailingSlashUrl(u) {
  try {
    const url = new URL(normalizeUrl(u));
    url.pathname = url.pathname.replace(/\/+$/, "") + "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return normalizeUrl(u);
  }
}

function stripHtmlTags(value) {
  return textClean(
    String(value || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&"),
  );
}

function removeResizeSuffix(value) {
  try {
    const url = new URL(String(value || ""));
    url.pathname = url.pathname.replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+$)/i, "");
    return url.toString();
  } catch {
    return String(value || "").replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+(?:\?|$))/i, "");
  }
}

function normalizeImageUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return "";
  try {
    const pathname = new URL(normalized).pathname.toLowerCase();
    if (!/\.(?:avif|gif|jpe?g|png|svg|webp)$/.test(pathname)) return "";
  } catch {
    return "";
  }
  return removeResizeSuffix(normalized);
}

function parseSrcsetLargest(srcset, canonical) {
  const candidates = String(srcset || "")
    .split(",")
    .map((entry) => {
      const [url, width] = entry.trim().split(/\s+/);
      return { url: absUrl(canonical, url), width: Number(String(width || "").replace(/\D/g, "")) || 0 };
    })
    .filter((entry) => entry.url)
    .sort((a, b) => b.width - a.width);
  return candidates[0]?.url || "";
}

function isJunkProductImage(value) {
  const url = String(value || "").toLowerCase();
  return !url || /(?:logo|favicon|sprite|icon|badge|avatar|flag|banner|placeholder)/i.test(url);
}

function chooseBestImage(values) {
  return (values || []).find((value) => value && !isJunkProductImage(value)) || "";
}

function dedupeImageUrls(values) {
  const seen = new Set();
  const output = [];
  for (const value of values || []) {
    const url = normalizeImageUrl(value);
    if (!url || isJunkProductImage(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(url);
  }
  return output;
}

function dedupeStrings(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

function isProductDetailUrl(u) {
  try {
    const url = new URL(u);
    return url.hostname.endsWith("kentscientific.com") && url.pathname.startsWith("/products/");
  } catch {
    return false;
  }
}

function slugFromProductsUrl(u) {
  try {
    const url = new URL(u);
    const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
    const idx = parts.indexOf("products");
    return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : "";
  } catch {
    return "";
  }
}

function sha1(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function absUrl(base, href) {
  try {
    return new URL(String(href || ""), base).toString();
  } catch {
    return String(href || "").trim();
  }
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

function cleanupPreviewText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => textClean(line))
    .filter(Boolean)
    .filter((line) => !isNoiseText(line))
    .filter((line) => !/^(choose an option|clear|add to cart|qty|\+|-|quantity)$/i.test(line))
    .join("\n")
    .trim();
}

function collectImages($, canonical) {
  const imageUrls = [];

  $(
    [
      ".woocommerce-product-gallery__image a",
      ".woocommerce-product-gallery__image img",
      ".woocommerce-product-gallery__wrapper img",
      ".woocommerce-product-gallery img",
    ].join(", ")
  ).each((_, el) => {
    const $el = $(el);
    const candidates = [
      $el.attr("data-large_image"),
      $el.attr("data-src"),
      parseSrcsetLargest($el.attr("srcset"), canonical),
      $el.attr("href"),
      $el.attr("src"),
      $el.attr("data-lazy-src"),
    ]
      .filter(Boolean)
      .map((v) => normalizeImageUrl(absUrl(canonical, v)));

    const chosen = chooseBestImage(candidates);
    if (!chosen) return;
    imageUrls.push(chosen);
  });

  return dedupeImageUrls(imageUrls).slice(0, 20);
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

function collectVideos($, canonical) {
  const urls = [];
  $('iframe[src], video source[src], a[href*="youtube"], a[href*="vimeo"]').each((_, el) => {
    const href = normalizeUrl(absUrl(canonical, $(el).attr("src") || $(el).attr("href") || ""));
    if (!href) return;
    if (/youtube\.com\/user\/kentscientific/i.test(href)) return;
    urls.push(href);
  });
  $('[data-video-url]').each((_, el) => {
    const href = normalizeUrl(absUrl(canonical, $(el).attr("data-video-url") || ""));
    if (href) urls.push(href);
  });
  return dedupeStrings(urls);
}

function extractPlaylistItems($, scope, canonical) {
  // Preserve Kent's official playlist title, duration and playable source URL
  // as structured preview data instead of relying on visual widget markup.
  const items = [];
  const seen = new Set();

  scope.find('[data-video-url]').each((index, el) => {
    const node = $(el);
    const url = normalizeUrl(absUrl(canonical, node.attr("data-video-url") || ""));
    const title = textClean(node.attr("data-video-title") || node.find("button,h4").first().text());
    const duration = textClean(node.attr("data-video-duration") || "");
    if (!url || !title || seen.has(url)) return;
    seen.add(url);
    items.push({
      _key: `kent-playlist-${index}-${sha1(url).slice(0, 8)}`,
      title,
      description: duration,
      url,
    });
  });

  return items;
}

function collectRelatedProducts($, canonical) {
  const relatedProducts = [];
  const currentProductSlug = slugFromProductsUrl(canonical);

  function collectFrom(scope) {
    scope.find('a[href*="/products/"]').each((_, a) => {
      const href = normalizeTrailingSlashUrl(absUrl(canonical, $(a).attr("href") || ""));
      if (!isProductDetailUrl(href) || slugFromProductsUrl(href) === currentProductSlug) return;
      const card = $(a).closest("li.product, .product, .product-small, .product-grid-item");
      const label = textClean(
        card.find(".woocommerce-loop-product__title, h2, h3, h4").first().text() ||
        $(a).find(".woocommerce-loop-product__title, h2, h3, h4").first().text() ||
        $(a).attr("aria-label") ||
        $(a).text(),
      ).replace(MONEY_RE, "").replace(/\s+/g, " ").trim() || slugFromProductsUrl(href);
      if (!href || isNoiseText(label)) return;
      relatedProducts.push({ label, href });
    });
  }

  collectFrom($('section.related, .related, .upsells'));

  // Kent's newer Elementor product template does not consistently keep the
  // WooCommerce `.related` class. Locate the official section by its heading,
  // then use the smallest ancestor that actually owns the product cards. This
  // avoids pulling product links from the global navigation.
  $("h2,h3,h4").each((_, heading) => {
    if (!/customers who viewed this item also viewed|you may also like/i.test(textClean($(heading).text()))) return;
    let scope = $(heading);
    for (let depth = 0; depth < 7; depth += 1) {
      scope = scope.parent();
      if (!scope.length || scope.is("body,html")) break;
      const productLinks = dedupeStrings(
        scope
          .find('a[href*="/products/"]')
          .toArray()
          .map((a) => normalizeTrailingSlashUrl(absUrl(canonical, $(a).attr("href") || "")))
          .filter((href) => isProductDetailUrl(href) && slugFromProductsUrl(href) !== currentProductSlug),
      );
      if (productLinks.length >= 1 && productLinks.length <= 12) {
        collectFrom(scope);
        break;
      }
    }
  });

  return dedupeByHref(relatedProducts);
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

  const groupedInputs = new Map();
  $('form.cart input[type="radio"], form.cart input[type="checkbox"]')
    .each((_, input) => {
      const $input = $(input);
      const name = textClean($input.attr("name") || $input.attr("id") || "option");
      if (!name || /quantity|qty/i.test(name)) return;

      const id = $input.attr("id") || "";
      const $label = id ? $(`label[for="${id}"]`).first() : $input.closest("label");
      const text = textClean($label.text() || $input.closest("li,div").find("label").first().text());
      const withoutPrice = text.replace(MONEY_RE, "").replace(/\s+/g, " ").trim();
      if (!withoutPrice || isNoiseText(withoutPrice)) return;

      if (!groupedInputs.has(name)) groupedInputs.set(name, []);
      groupedInputs.get(name).push({
        value: textClean($input.attr("value") || withoutPrice),
        text: withoutPrice,
      });
    });

  for (const [name, options] of groupedInputs) {
    const first = $(`input[name="${name.replaceAll('"', '\\"')}"]`).first();
    const label = textClean(
      first.closest(".wpo-field, .form-row, fieldset, tr").find(".wpo-field-label, legend, th, > label").first().text(),
    ) || name;
    addGroup(label, options, "input");
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

  return {
    optionGroups: groups,
    rawVariationText: dedupeStrings(rawVariationText).slice(0, 80),
  };
}

function collectVariationJson($) {
  const payloads = [];

  function pickVariationImage(item) {
    const imageObj = item?.image || {};
    const candidates = [
      imageObj.full_src,
      imageObj.fullSrc,
      imageObj.src,
      imageObj.url,
      imageObj.full,
      imageObj.thumb_src,
      imageObj.thumbnail_src,
    ]
      .filter(Boolean)
      .map((v) => normalizeImageUrl(v));

    const chosen = chooseBestImage(candidates);
    return chosen ? normalizeImageUrl(removeResizeSuffix(chosen)) : "";
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

          const priceText = cleanupPreviewText(load(`<div>${item?.price_html || ""}</div>`)("div").text());

          return {
            variationId: item?.variation_id ?? "",
            sku: textClean(item?.sku || ""),
            priceText,
            displayPrice: item?.display_price ?? "",
            displayRegularPrice: item?.display_regular_price ?? "",
            isInStock: item?.is_in_stock ?? "",
            image: pickVariationImage(item),
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


function absolutizeNodeUrls($, $scope, canonical) {
  $scope.find("[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    $(el).attr("href", normalizeUrl(absUrl(canonical, href)));
  });

  $scope.find("[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    $(el).attr("src", normalizeImageUrl(absUrl(canonical, src)));
  });
}

function cleanSectionHtml($, root, canonical) {
  if (!root?.length) return "";

  const $wrap = $("<div></div>");
  root.each((_, el) => {
    $wrap.append($(el).clone());
  });

  $wrap.find([
    "script",
    "style",
    "svg",
    "noscript",
    "form.cart",
    "form.variations_form",
    ".single_variation_wrap",
    ".woocommerce-variation-add-to-cart",
    ".product_meta",
    ".related",
    ".upsells",
    ".share",
    ".yith-wcwl-add-to-wishlist",
    ".newsletter",
    ".mc4wp-form",
    ".woocommerce-tabs ul.tabs",
    ".reset_variations",
    ".quantity",
    ".price",
    ".pricing",
    ".wpo-price-container",
    ".woocommerce-Price-amount",
    ".posted_in",
    ".tagged_as",
    ".woocommerce-product-gallery",
    "img",
  ].join(", ")).remove();

  $wrap.find("*").each((_, el) => {
    const $el = $(el);
    const txt = textClean($el.text());
    if (txt && /get early access to info,\s*updates, and discounts/i.test(txt)) {
      $el.remove();
      return;
    }
    if (txt && /^(choose an option|clear|add to cart|qty|quantity)$/i.test(txt)) {
      $el.remove();
      return;
    }
    if (txt && /^login to see prices$/i.test(txt)) {
      $el.remove();
      return;
    }
    if (txt && MONEY_RE.test(txt) && $el.children().length === 0) $el.remove();
  });

  $wrap.find("table tr").each((_, el) => {
    const $row = $(el);
    if (MONEY_RE.test(textClean($row.text()))) $row.remove();
  });

  absolutizeNodeUrls($, $wrap, canonical);

  $wrap.find("[class],[style],[id]").each((_, el) => {
    $(el).removeAttr("class").removeAttr("style").removeAttr("id");
  });
  $wrap.find("*").each((_, el) => {
    for (const attribute of Object.keys(el.attribs || {})) {
      if (attribute.startsWith("data-")) $(el).removeAttr(attribute);
    }
  });

  return ($wrap.html() || "").trim();
}

function cleanSourceIntroHtml(rawHtml, canonical) {
  const raw = String(rawHtml || "").trim();
  if (!raw) return "";
  const $fragment = load(`<div id="kent-source-intro">${raw}</div>`, null, false);
  return cleanSectionHtml($fragment, $fragment("#kent-source-intro").contents(), canonical);
}

function sectionType(title) {
  const value = textClean(title).toLowerCase();
  if (/what you get|feature|benefit|highlight/.test(value)) return "features";
  if (/peer|customer|testimonial|review/.test(value)) return "reviews";
  if (/base system includes|what is included|in the box/.test(value)) return "included";
  if (/optional|add-on|add on|accessor|extend .*capabilit/.test(value)) return "addons";
  if (/specification|technical data/.test(value)) return "spec-table";
  if (/resource|document|download|manual|guide|brochure/.test(value)) return "documents";
  if (/video|playlist/.test(value)) return "videos";
  if (/publication|reference|scientific article/.test(value)) return "publications";
  if (/warranty/.test(value)) return "warranty";
  if (/faq|frequently asked/.test(value)) return "faqs";
  return "rich-text";
}

function stableSectionKey(title, index) {
  return `kent-source-${sha1(`${index}:${title}`).slice(0, 12)}`;
}

function extractElementorSections($, canonical) {
  const candidates = $("main div.elementor")
    .toArray()
    .filter((node) => !$(node).hasClass("e-loop-item"))
    .filter((node) => !$(node).find(".product-summary-wrap, .woocommerce-product-gallery, .product_meta").length)
    .map((node) => ({ node, size: textClean($(node).text()).length }))
    .filter((row) => row.size >= 300)
    .sort((a, b) => b.size - a.size);

  const root = candidates[0] ? $(candidates[0].node) : null;
  if (!root?.length) return [];

  const sections = [];
  let pendingTitle = "";

  root.children(".e-con, .elementor-section").each((index, node) => {
    const $node = $(node).clone();
    $node.find("style,script,noscript").remove();
    const heading = textClean($node.find("h2,h3,h4").first().text());
    const nodeText = textClean($node.text());
    if (!heading && nodeText.length < 30) return;
    if (heading && EXCLUDED_SECTION_RE.test(heading)) {
      pendingTitle = "";
      return;
    }

    // A heading-only Elementor container is often followed by a content
    // container whose first heading is the first feature title. When a pending
    // section title already exists, removing that content heading drops the
    // first feature name (for example SomnoSuite's flow-rate feature).
    if (heading && !pendingTitle) $node.find("h2,h3,h4").first().remove();
    const html = cleanSectionHtml($, $node, canonical);
    const bodyText = stripHtmlTags(html);

    if (heading && bodyText.length < 35) {
      pendingTitle = heading;
      return;
    }

    const title = pendingTitle || heading || "Product information";
    pendingTitle = "";
    if (!bodyText || EXCLUDED_SECTION_RE.test(title)) return;

    const type = sectionType(title);
    const items = type === "videos" ? extractPlaylistItems($, $node, canonical) : [];

    sections.push({
      _key: stableSectionKey(title, index),
      type,
      title,
      html,
      ...(items.length ? { items } : {}),
    });
  });

  return sections;
}

function extractFaqSection($) {
  const items = [];
  $("details.e-n-accordion-item").each((index, detail) => {
    const question = textClean($(detail).children("summary").first().text());
    const answerRoot = $(detail).children('[role="region"]').first();
    const answer = cleanupPreviewText(answerRoot.text());
    if (!question || !answer || isNoiseText(question)) return;
    items.push({
      _key: `kent-faq-${index}-${sha1(question).slice(0, 8)}`,
      title: question,
      description: answer,
    });
  });

  if (!items.length) return null;
  return {
    _key: "kent-source-faqs",
    type: "faqs",
    title: "FAQs",
    items,
  };
}

function extractOverviewHtml($, canonical) {
  const candidates = [
    $(".woocommerce-product-details__short-description").first(),
    $("#tab-description").first(),
    $(".woocommerce-Tabs-panel--description").first(),
  ].filter((v) => v && v.length);

  for (const root of candidates) {
    const html = cleanSectionHtml($, root, canonical);
    if (stripHtmlTags(html)) return html;
  }
  return "";
}

function extractSpecsHtml($, canonical) {
  const candidates = [
    $("#tab-additional_information").first(),
    $(".woocommerce-Tabs-panel--additional_information").first(),
    $("table.shop_attributes").first(),
  ].filter((v) => v && v.length);

  for (const root of candidates) {
    const html = cleanSectionHtml($, root, canonical);
    if (stripHtmlTags(html)) return html;
  }
  return "";
}

function extractDocumentsHtml($, canonical) {
  const nodes = [];
  $(
    [
      '#tab-description a[href$=".pdf"]',
      '.woocommerce-Tabs-panel--description a[href$=".pdf"]',
      'a[href*=".pdf?"]',
      'a[href*="youtube.com"]',
      'a[href*="youtu.be"]',
      'a[href*="vimeo.com"]',
    ].join(", ")
  ).each((_, el) => {
    nodes.push($(el).closest("p, li, div").first());
  });

  if (!nodes.length) return "";
  const $wrap = $("<div></div>");
  const seen = new Set();
  nodes.forEach((node) => {
    if (!node?.length) return;
    const html = $.html(node);
    if (!html || seen.has(html)) return;
    seen.add(html);
    $wrap.append(node.clone());
  });

  const html = cleanSectionHtml($, $wrap, canonical);
  return stripHtmlTags(html) ? html : "";
}

function parseProduct(html, url, sourceMeta = null) {
  const $ = load(html, { decodeEntities: false });
  const pageCanonical = normalizeTrailingSlashUrl($('link[rel="canonical"]').attr("href") || url);
  const canonical = normalizeTrailingSlashUrl(sourceMeta?.sourceUrl || url);
  const sourceSlug = textClean(sourceMeta?.slug || slugFromProductsUrl(canonical));
  const redirectedToDifferentProduct = Boolean(
    sourceSlug && slugFromProductsUrl(pageCanonical) && slugFromProductsUrl(pageCanonical) !== sourceSlug,
  );
  const title = textClean(sourceMeta?.title) || textClean($("h1").first().text()) || textClean($("title").text());
  const metaText = redirectedToDifferentProduct ? "" : cleanupPreviewText($(".product_meta").text());

  const itemMatch = metaText.match(/\bItem\s*#\s*[:#]?\s*([^\s|,]{1,120})/i);
  const sku = itemMatch ? textClean(itemMatch[1]) : "";

  const { optionGroups, rawVariationText } = redirectedToDifferentProduct
    ? { optionGroups: [], rawVariationText: [] }
    : collectOptionGroups($);
  const variationPayloads = redirectedToDifferentProduct ? [] : collectVariationJson($);
  const sections = redirectedToDifferentProduct ? [] : extractElementorSections($, canonical);
  const faqSection = redirectedToDifferentProduct ? null : extractFaqSection($);
  if (faqSection && !sections.some((section) => section.type === "faqs")) sections.push(faqSection);
  const pdfs = redirectedToDifferentProduct ? [] : collectPdfs($, canonical);
  const videos = redirectedToDifferentProduct ? [] : collectVideos($, canonical);

  if (videos.length && !sections.some((section) => section.type === "videos")) {
    sections.push({
      _key: "kent-source-videos",
      type: "videos",
      title: "Product videos",
      items: videos.map((video, index) => ({
        _key: `kent-video-${index}-${sha1(video).slice(0, 8)}`,
        title: `Video ${index + 1}`,
        url: video,
      })),
    });
  }

  let $contentRoot = $("#tab-description");
  if (!$contentRoot.length) $contentRoot = $("div.woocommerce-Tabs-panel--description").first();
  if (!$contentRoot.length) $contentRoot = $(".woocommerce-product-details__short-description").first();
  if (!$contentRoot.length) $contentRoot = $(".entry-summary").first();
  if (!$contentRoot.length) $contentRoot = $("main .product").first();
  if (!$contentRoot.length) $contentRoot = $("main").first();
  if (!$contentRoot.length) $contentRoot = $("body");

  const overviewHtml = cleanSourceIntroHtml(sourceMeta?.sourceIntroHtml, canonical) || extractOverviewHtml($, canonical);
  const specsHtml = extractSpecsHtml($, canonical);
  const documentsHtml = extractDocumentsHtml($, canonical);
  const bodyTextPreview = cleanupPreviewText(stripHtmlTags(overviewHtml) || $contentRoot.text()).slice(0, 5000);
  const variantImageUrls = variationPayloads.map((v) => v.image).filter(Boolean);

  return {
    title,
    slug: sourceSlug,
    sourceUrl: canonical,
    sku,
    summary: textClean(sourceMeta?.summary || ""),
    summaryHtml: String(sourceMeta?.summaryHtml || "").trim(),
    sourceIntroHtml: overviewHtml,
    kentSections: sections,
    heroImageUrl:
      normalizeImageUrl(sourceMeta?.heroImageUrl) ||
      normalizeImageUrl(collectImages($, canonical)[0]) ||
      normalizeImageUrl(variantImageUrls[0]),
    wpProductId: Number(sourceMeta?.wpProductId || 0) || undefined,
    sourceModifiedAt: sourceMeta?.modifiedAt || undefined,
    metaText,
    commerce: {
      model:
        optionGroups.length || variationPayloads.length
          ? "optionSelector"
          : sku
            ? "singleSku"
            : "unknown",
      optionGroups,
      rawVariationText,
      variationPayloads: variationPayloads.slice(0, 80),
    },
    imageUrls: dedupeImageUrls([
      sourceMeta?.heroImageUrl,
      ...(redirectedToDifferentProduct ? [] : collectImages($, canonical)),
      ...variantImageUrls,
    ]).slice(0, 1),
    pdfs,
    videos,
    relatedProducts: redirectedToDifferentProduct ? [] : collectRelatedProducts($, canonical),
    overviewHtml,
    specsHtml,
    documentsHtml,
    bodyTextPreview,
  };
}

function buildProductCategoryMap(listingJson) {
  const productMap = new Map();

  for (const category of listingJson.categories || []) {
    const rootUrl = normalizeUrl(category.rootUrl || "");
    const categoryPath = Array.isArray(category.categoryPath) ? category.categoryPath : [];
    const title = textClean(category.title || "");

    for (const productUrl of category.productUrls || []) {
      const norm = normalizeTrailingSlashUrl(productUrl);
      if (!isProductDetailUrl(norm)) continue;

      if (!productMap.has(norm)) {
        productMap.set(norm, {
          sourceUrl: norm,
          categories: [],
        });
      }

      productMap.get(norm).categories.push({
        rootUrl,
        title,
        categoryPath,
      });
    }
  }

  for (const entry of productMap.values()) {
    const seen = new Set();
    entry.categories = entry.categories.filter((cat) => {
      const key = `${cat.rootUrl}||${cat.categoryPath.join("/")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return productMap;
}

function buildProductMetaMap(listingJson) {
  const map = new Map();
  for (const product of listingJson.products || []) {
    const sourceUrl = normalizeTrailingSlashUrl(product?.sourceUrl || "");
    if (sourceUrl) map.set(sourceUrl, product);
  }
  return map;
}

function choosePrimaryCategory(categories, parsed) {
  if (!categories?.length) return null;

  const slug = String(parsed?.slug || "").toLowerCase();
  const title = String(parsed?.title || "").toLowerCase();

  const scored = categories.map((cat) => {
    let score = 0;
    const joined = (cat.categoryPath || []).join(" ").toLowerCase();
    if (slug && joined.includes(slug)) score += 10;
    if (title && joined && title.includes(joined)) score += 4;
    score += (cat.categoryPath || []).length;
    return { cat, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.cat || categories[0];
}

function saveSnapshot(payload) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
}

async function main() {
  log(`listing: ${LISTING_JSON}`);
  log(`output: ${OUT}`);
  log(`cacheDir: ${CACHE_DIR}`);

  if (!fs.existsSync(LISTING_JSON)) {
    throw new Error(`Listing JSON not found: ${LISTING_JSON}`);
  }

  const listingJson = JSON.parse(fs.readFileSync(LISTING_JSON, "utf8"));
  const productMap = buildProductCategoryMap(listingJson);
  const productMetaMap = buildProductMetaMap(listingJson);

  let productUrls = [...productMap.keys()].sort();
  if (ONLY_SLUG) productUrls = productUrls.filter((url) => slugFromProductsUrl(url) === ONLY_SLUG);
  if (LIMIT > 0) productUrls = productUrls.slice(0, LIMIT);

  const output = {
    generatedAt: new Date().toISOString(),
    source: "Kent product details joined with listing categories",
    listingFile: LISTING_JSON,
    count: 0,
    ok: 0,
    fail: 0,
    skipped: 0,
    results: [],
  };

  if (!productUrls.length) {
    saveSnapshot(output);
    throw new Error("No product URLs found in listing JSON");
  }

  output.results = Array(productUrls.length).fill(null);
  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= productUrls.length) return;
      const url = productUrls[i];

      try {
        if (!isProductDetailUrl(url)) {
          output.skipped += 1;
          output.results[i] = { sourceUrl: url, skipped: true };
        } else {
          const html = await fetchCached(url);
          const parsed = parseProduct(html, url, productMetaMap.get(url) || null);
          const sourceCategories = productMap.get(url)?.categories || [];
          const primaryCategory = productMetaMap.get(url)?.primaryCategory || choosePrimaryCategory(sourceCategories, parsed);

          output.results[i] = {
            ...parsed,
            primaryCategory,
            sourceCategories,
            categoryPathCandidates: sourceCategories.map((v) => v.categoryPath || []),
          };
          output.ok += 1;
        }
      } catch (err) {
        output.fail += 1;
        output.results[i] = { sourceUrl: url, error: String(err?.message || err) };
      }

      completed += 1;
      output.count = completed;
      if (completed % 10 === 0 || completed === productUrls.length) saveSnapshot(output);
      process.stdout.write(
        `\r[${completed}/${productUrls.length}] ok=${output.ok} fail=${output.fail} skip=${output.skipped}`,
      );
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, productUrls.length) }, () => worker()));

  process.stdout.write("\n");

  output.generatedAt = new Date().toISOString();
  output.results = output.results.filter(Boolean);
  output.count = output.results.length;
  saveSnapshot(output);

  log(`saved: ${OUT}`);
  log(`ok=${output.ok} fail=${output.fail} skipped=${output.skipped}`);
}

main().catch((err) => {
  warn(String(err?.message || err));
  process.exit(1);
});
