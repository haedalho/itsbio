import * as cheerio from "cheerio";
import { parseAbmRebuildDetail, cleanText, absoluteAbmUrl } from "./rebuild-parser.mjs";

const JUNK = [
  "logo", "favicon", "sprite", "flag", "payment", "social", "header", "footer", "menu", "nav", "badge",
  "request-quote", "request_quote", "request-sample", "request_sample", "intertek",
];

function validImage(url) {
  const s = String(url || "").toLowerCase();
  if (!s || JUNK.some((x) => s.includes(x))) return false;
  if (/(?:^|[-_/])(16x11|229x65)(?:[-_.\/]|$)/.test(s)) return false;

  // Normal image files plus ABM image endpoints that may omit a filename extension.
  return /\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.test(s)
    || /\/(?:assets|uploads?|storage|media|images?|product)(?:\/|%2f)/i.test(s);
}

function imageCandidatesFromValue(value) {
  const raw = String(value || "").replace(/\\\//g, "/").trim();
  if (!raw) return [];

  const candidates = [];
  const add = (valueToAdd) => {
    const cleaned = String(valueToAdd || "").trim().replace(/^['\"]|['\"]$/g, "");
    if (cleaned && !candidates.includes(cleaned)) candidates.push(cleaned);
  };

  // Direct attribute value.
  add(raw);

  // CSS url(...) values.
  for (const match of raw.matchAll(/url\(\s*(['\"]?)(.*?)\1\s*\)/gi)) add(match[2]);

  // srcset / comma-separated candidates.
  if (raw.includes(",")) {
    for (const part of raw.split(",")) add(part.trim().split(/\s+/)[0]);
  }

  // Image URLs embedded inside JSON/data attributes or inline scripts.
  const urlLike = /(?:https?:)?\/\/[^\s'\"<>\\]+|(?:\.\.\/|\.\/|\/)[^\s'\"<>\\]+/gi;
  for (const match of raw.matchAll(urlLike)) {
    const candidate = String(match[0] || "").replace(/[),;]+$/g, "");
    if (validImage(candidate)) add(candidate);
  }

  return candidates;
}

function currentImages(html, sourceUrl, expectedSku = "") {
  const $ = cheerio.load(html || "", { decodeEntities: false });
  const out = [];
  const scored = new Map();
  const expected = cleanText(expectedSku).toLowerCase();

  const add = (raw, score = 0) => {
    for (const candidate of imageCandidatesFromValue(raw)) {
      const url = absoluteAbmUrl(candidate, sourceUrl);
      if (!url || !validImage(url)) continue;
      const lower = url.toLowerCase();
      let nextScore = score;
      if (expected && lower.includes(expected)) nextScore += 100;
      if (/\/assets\/product\//i.test(url)) nextScore += 50;
      else if (/product/i.test(new URL(url).pathname)) nextScore += 25;
      if (/thumb|thumbnail|small|icon/i.test(lower)) nextScore -= 10;
      if (!scored.has(url) || scored.get(url) < nextScore) scored.set(url, nextScore);
    }
  };

  // Conventional image markup.
  $("img,source").each((_, node) => {
    const el = $(node);
    for (const attr of [
      "data-zoom-image", "data-image", "data-original", "data-src", "data-lazy-src",
      "data-large", "data-large-image", "data-full", "data-full-image", "src", "srcset", "data-srcset",
    ]) add(el.attr(attr), 30);
  });

  // ABM also exposes gallery/lightbox targets through data-* attributes on anchors/divs.
  $("*").each((_, node) => {
    const el = $(node);
    const attrs = node.attribs || {};
    const galleryContext = Boolean(
      el.closest("[class*='gallery'],[class*='product-image'],[class*='product_image'],[class*='lightbox'],[class*='fancybox'],[class*='swiper'],[class*='splide']").length,
    );
    for (const [name, value] of Object.entries(attrs)) {
      if (!/(?:src|href|image|zoom|large|full|original|thumb|gallery|fancybox|lightbox|poster|background|style)/i.test(name)) continue;
      add(value, galleryContext ? 45 : 10);
    }
  });

  // Last-resort scan for image URLs embedded in inline scripts / JSON blobs.
  for (const match of String(html || "").replace(/\\\//g, "/").matchAll(/(?:https?:)?\/\/[^\s'\"<>\\]+|(?:\.\.\/|\.\/|\/)[^\s'\"<>\\]+/gi)) {
    const candidate = String(match[0] || "").replace(/[),;]+$/g, "");
    if (validImage(candidate)) add(candidate, 0);
  }

  for (const [url, score] of [...scored.entries()].sort((a, b) => b[1] - a[1])) {
    if (score < 0) continue;
    if (!out.includes(url)) out.push(url);
  }

  // If a product/SKU-specific image was discovered, do not dilute the gallery with page illustrations.
  const skuSpecific = expected ? out.filter((url) => url.toLowerCase().includes(expected)) : [];
  if (skuSpecific.length) return skuSpecific;
  const preferred = out.filter((url) => /\/assets\/product\//i.test(url) || /product/i.test(new URL(url).pathname));
  return preferred.length ? preferred : out;
}

function pageContainsExpectedSku(html, sku) {
  const expected = cleanText(sku);
  if (!expected) return false;
  const text = cleanText(cheerio.load(html || "")("body").text());
  const escaped = expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?=$|[^A-Za-z0-9])`, "i").test(text);
}

function pageContainsExpectedTitle(html, title) {
  const expected = cleanText(title).toLowerCase();
  if (!expected) return false;
  const text = cleanText(cheerio.load(html || "")("body").text()).toLowerCase();
  return text.includes(expected);
}

export function parseAbmRebuildDetailV2(html, sourceUrl, expected = {}) {
  const result = parseAbmRebuildDetail(html, sourceUrl, expected);
  const expectedSku = cleanText(expected.sku);
  const servicePageMatched = expected.kind === "service"
    && Boolean(expectedSku)
    && (Boolean(result.serviceOffer)
      || pageContainsExpectedSku(html, expectedSku)
      || pageContainsExpectedTitle(html, expected.title));

  // Current ABM adds a Print control inside the Cat.No. table cell on many product pages,
  // resulting in values like "G898 Print". Only normalize to the expected SKU when the
  // exact expected token is independently present in the official page HTML.
  if (expectedSku && pageContainsExpectedSku(html, expectedSku)) {
    if (
      !result.sku ||
      cleanText(result.sku).toLowerCase() === `${expectedSku.toLowerCase()} print` ||
      cleanText(result.sku).toLowerCase().startsWith(`${expectedSku.toLowerCase()} `)
    ) {
      result.sku = expectedSku;
    }
  }
  if (servicePageMatched) result.sku = expectedSku;

  const foundImages = currentImages(html, sourceUrl, expectedSku);
  if (foundImages.length) result.images = foundImages;

  result.counts = {
    ...result.counts,
    images: result.images.length,
  };
  result.verification = {
    ...result.verification,
    skuMatches: expectedSku ? cleanText(result.sku).toLowerCase() === expectedSku.toLowerCase() : null,
    serviceOfferMatched: expected.kind === "service" ? servicePageMatched : result.verification?.serviceOfferMatched,
    hasImages: result.images.length > 0,
  };

  return result;
}
