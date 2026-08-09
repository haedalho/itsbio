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
  return /\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.test(s);
}

function currentImages(html, sourceUrl) {
  const $ = cheerio.load(html || "", { decodeEntities: false });
  const out = [];
  const add = (raw) => {
    const url = absoluteAbmUrl(raw, sourceUrl);
    if (url && validImage(url) && !out.includes(url)) out.push(url);
  };

  // Current ABM frequently exposes the primary product image as an anchor href,
  // not through the older gallery selectors.
  $("img").each((_, img) => {
    for (const attr of ["data-zoom-image", "data-image", "data-original", "data-src", "src"]) add($(img).attr(attr));
    const srcset = String($(img).attr("srcset") || $(img).attr("data-srcset") || "");
    for (const part of srcset.split(",")) add(part.trim().split(/\s+/)[0]);
  });
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    if (/\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.test(String(href || ""))) add(href);
  });

  // Prefer actual product assets over content illustrations, while keeping a fallback.
  const preferred = out.filter((u) => /\/assets\/product\//i.test(u) || /product/i.test(new URL(u).pathname));
  return preferred.length ? preferred : out;
}

function pageContainsExpectedSku(html, sku) {
  const expected = cleanText(sku);
  if (!expected) return false;
  const text = cleanText(cheerio.load(html || "")("body").text());
  const escaped = expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?=$|[^A-Za-z0-9])`, "i").test(text);
}

export function parseAbmRebuildDetailV2(html, sourceUrl, expected = {}) {
  const result = parseAbmRebuildDetail(html, sourceUrl, expected);
  const expectedSku = cleanText(expected.sku);

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

  const foundImages = currentImages(html, sourceUrl);
  if (foundImages.length) result.images = foundImages;

  result.counts = {
    ...result.counts,
    images: result.images.length,
  };
  result.verification = {
    ...result.verification,
    skuMatches: expectedSku ? cleanText(result.sku).toLowerCase() === expectedSku.toLowerCase() : null,
    hasImages: result.images.length > 0,
  };

  return result;
}
