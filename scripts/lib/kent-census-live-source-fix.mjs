import * as cheerio from "cheerio";

import {
  KENT_BASE,
  SHOP_URL,
  clean,
  cleanTitle,
  kentCategoryPathFromHref,
  kentSlugFromHref,
  mapConcurrent,
  normalizeAbsoluteUrl,
  normalizedUrlKey,
  normalizePath,
  stripTags,
  unique,
} from "./kent-census-utils.mjs";
import { addCandidate } from "./kent-census-sources.mjs";

const MAX_SHOP_PAGES = 60;
const PAGE_CONCURRENCY = 6;
const SHOP_PAGINATION_KEYS = ["product-page", "paged", "page"];

function normalizeShopPageUrl(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw, KENT_BASE);
    if (!/(^|\.)kentscientific\.com$/i.test(url.hostname)) return "";
    if (!/^\/shop(?:\/page\/\d+)?\/?$/i.test(url.pathname)) return "";
    url.hash = "";
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase();
    const retained = new URLSearchParams();
    for (const key of SHOP_PAGINATION_KEYS) {
      const valueForKey = url.searchParams.get(key);
      if (valueForKey && /^\d+$/.test(valueForKey)) retained.set(key, valueForKey);
    }
    url.search = retained.toString();
    return url.toString();
  } catch {
    return "";
  }
}

function shopPageLinks($) {
  const links = $("a[href]")
    .toArray()
    .map((node) => normalizeShopPageUrl($(node).attr("href")))
    .filter(Boolean);

  const pageNumbers = $(".pagination, .woocommerce-pagination, nav[aria-label*='pagination' i], [class*='pagination']")
    .find("a, span")
    .toArray()
    .map((node) => Number.parseInt(clean($(node).text()), 10))
    .filter((value) => Number.isInteger(value) && value > 1 && value <= MAX_SHOP_PAGES);

  for (const pageNumber of pageNumbers) {
    links.push(`${SHOP_URL.replace(/\/$/, "")}/page/${pageNumber}/`);
  }

  return unique(links, (value) => value.toLowerCase());
}

function productScope($, anchor) {
  const element = $(anchor);
  const scope = element.closest(
    "li, article, [class*='product'], [class*='grid-item'], [class*='shop-item'], [class*='card']",
  );
  return scope.length ? scope.first() : element.parent();
}

function imageFromScope($, scope) {
  const image = scope.find("img").first();
  const srcset = clean(image.attr("data-srcset") || image.attr("srcset"));
  const srcsetUrl = srcset ? clean(srcset.split(",").pop()?.trim().split(/\s+/)[0]) : "";
  return normalizeAbsoluteUrl(
    image.attr("data-large_image") ||
      image.attr("data-lazy-src") ||
      image.attr("data-src") ||
      srcsetUrl ||
      image.attr("src") ||
      "",
  );
}

function parseShopPage(html, pageUrl, candidates) {
  const $ = cheerio.load(html);
  const seenOnPage = new Set();

  for (const anchor of $("a[href]").toArray()) {
    const href = normalizeAbsoluteUrl($(anchor).attr("href"));
    const slug = kentSlugFromHref(href);
    if (!slug) continue;
    const key = slug.toLowerCase();
    if (seenOnPage.has(key)) continue;

    const scope = productScope($, anchor);
    const title =
      scope.find(".woocommerce-loop-product__title, .product-title, [class*='product-title'], h2, h3, h4")
        .first()
        .text() ||
      $(anchor).attr("aria-label") ||
      $(anchor).attr("title") ||
      $(anchor).text();

    const cleanedTitle = cleanTitle(title, slug);
    if (!cleanedTitle) continue;

    addCandidate(candidates, {
      href,
      title: cleanedTitle,
      summary: scope.find(".excerpt, .description, .product-excerpt, [class*='description'], p").first().text(),
      imageUrl: imageFromScope($, scope),
      discoveredFrom: `shop:${pageUrl}`,
      trustedSource: "shop",
    });
    seenOnPage.add(key);
  }

  return { found: seenOnPage.size, links: shopPageLinks($) };
}

export async function collectFromShop(candidates, fetchPage) {
  const queue = [SHOP_URL];
  const visited = new Set();
  const errors = [];
  let cardOccurrences = 0;

  while (queue.length && visited.size < MAX_SHOP_PAGES) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    try {
      const page = await fetchPage(current);
      const parsed = parseShopPage(page.text, page.finalUrl || current, candidates);
      cardOccurrences += parsed.found;
      for (const link of parsed.links) {
        if (!visited.has(link) && !queue.includes(link)) queue.push(link);
      }
    } catch (error) {
      errors.push({ url: current, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { visited: [...visited], errors, cardOccurrences };
}

function parseItemNumber(text) {
  return stripTags(text).match(/Item\s*#\s*([A-Z0-9][A-Z0-9._/-]*)/i)?.[1] || "";
}

function productPageSignals($) {
  const bodyText = stripTags($("body").text());
  const bodyClass = clean($("body").attr("class"));
  const ogType = clean($("meta[property='og:type']").attr("content")).toLowerCase();
  let jsonLdProduct = false;

  $("script[type='application/ld+json']").each((_, node) => {
    if (/"@type"\s*:\s*"Product"/i.test($(node).text())) jsonLdProduct = true;
  });

  return {
    bodyText,
    strong:
      /(?:^|\s)single-product(?:\s|$)/i.test(bodyClass) ||
      $("h1.product_title, .product_title.entry-title, form.cart, .woocommerce-product-gallery").length > 0 ||
      jsonLdProduct ||
      ogType === "product" ||
      /\bItem\s*#\s*[A-Z0-9]/i.test(bodyText),
  };
}

function parseProductPage(html, finalUrl) {
  const $ = cheerio.load(html);
  const slug = kentSlugFromHref(finalUrl);
  const signals = productPageSignals($);
  const title =
    $("h1.product_title, h1.entry-title, main h1, article h1, h1").first().text() ||
    $("meta[property='og:title']").attr("content") ||
    $("title").text();
  const cleanedTitle = cleanTitle(title, slug);
  const looksBlocked = /just a moment|attention required|access denied|captcha/i.test(
    `${cleanedTitle} ${signals.bodyText.slice(0, 500)}`,
  );

  const summaryScope = $(".summary.entry-summary, .product-summary, [class*='product-summary']").first();
  const summary =
    $(".woocommerce-product-details__short-description, [class*='short-description']").first().text() ||
    summaryScope.find("p").first().text() ||
    $("meta[name='description']").attr("content") ||
    "";
  const sku =
    $(".sku, [class*='sku'], [class*='item-number']").first().text() ||
    parseItemNumber(summaryScope.text()) ||
    parseItemNumber(signals.bodyText);
  const galleryImage = $(
    ".woocommerce-product-gallery img, .product img.wp-post-image, [class*='product-gallery'] img, main img",
  ).first();
  const image =
    galleryImage.attr("data-large_image") ||
    galleryImage.attr("data-src") ||
    galleryImage.attr("src") ||
    $("meta[property='og:image']").attr("content") ||
    "";
  const listingPaths = unique(
    $("a[href*='/product/']")
      .toArray()
      .map((node) => kentCategoryPathFromHref($(node).attr("href")))
      .filter(Boolean),
    normalizePath,
  );

  return {
    valid: Boolean(slug && cleanedTitle && signals.strong && !looksBlocked),
    slug,
    title: cleanedTitle,
    summary: stripTags(summary),
    sku: clean(sku),
    imageUrl: normalizeAbsoluteUrl(image),
    listingPaths,
    diagnostic: {
      title: cleanedTitle,
      hasStrongProductSignal: signals.strong,
      looksBlocked,
      bodyPreview: signals.bodyText.slice(0, 180),
    },
  };
}

export async function enrichAndValidateCandidates(candidates, fetchPage, skipProductPages) {
  const rows = [...candidates.values()];
  const rejected = [];
  const errors = [];

  if (skipProductPages) {
    for (const row of rows) {
      if (!row.trustedSources.length) {
        candidates.delete(row.slug.toLowerCase());
        rejected.push({ slug: row.slug, sourceUrl: row.sourceUrl, reason: "untrusted_without_page_validation" });
      }
    }
    return { checked: 0, validated: 0, rejected, errors };
  }

  const results = await mapConcurrent(rows, PAGE_CONCURRENCY, async (candidate) => {
    const page = await fetchPage(candidate.sourceUrl);
    return { candidate, page, parsed: parseProductPage(page.text, page.finalUrl || candidate.sourceUrl) };
  });

  let validated = 0;
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const candidate = rows[index];

    if (result.status === "rejected") {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      errors.push({ slug: candidate.slug, url: candidate.sourceUrl, error: message });
      if (!candidate.trustedSources.length) {
        candidates.delete(candidate.slug.toLowerCase());
        rejected.push({ slug: candidate.slug, sourceUrl: candidate.sourceUrl, reason: "page_fetch_failed_untrusted" });
      }
      continue;
    }

    const { page, parsed } = result.value;
    if (!parsed.valid) {
      if (!candidate.trustedSources.length) candidates.delete(candidate.slug.toLowerCase());
      rejected.push({
        slug: candidate.slug,
        sourceUrl: candidate.sourceUrl,
        reason: candidate.trustedSources.length ? "trusted_shop_page_not_validated" : "not_a_product_page",
        diagnostic: parsed.diagnostic,
      });
      continue;
    }

    validated += 1;
    addCandidate(candidates, {
      href: page.finalUrl || candidate.sourceUrl,
      title: parsed.title,
      summary: parsed.summary,
      sku: parsed.sku,
      imageUrl: parsed.imageUrl,
      discoveredFrom: `productPage:${page.finalUrl || candidate.sourceUrl}`,
      trustedSource: "validated-product-page",
      pageValidated: true,
    });

    for (const listingPath of parsed.listingPaths) {
      addCandidate(candidates, {
        href: page.finalUrl || candidate.sourceUrl,
        listingPath,
        discoveredFrom: `productCategory:${page.finalUrl || candidate.sourceUrl}`,
        trustedSource: "validated-product-page",
        pageValidated: true,
      });
    }
  }

  return { checked: rows.length, validated, rejected, errors };
}
