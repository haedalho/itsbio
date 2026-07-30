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
  normalizeSku,
  stripTags,
  unique,
  canonicalSourceUrl,
} from "./kent-census-utils.mjs";

const MAX_SHOP_PAGES = 60;
const MAX_SITEMAPS = 40;
const PAGE_CONCURRENCY = 6;

export function addCandidate(candidates, input) {
  const slug = kentSlugFromHref(input.href || input.sourceUrl);
  if (!slug) return;
  const key = slug.toLowerCase();
  const current = candidates.get(key) || {
    slug,
    sourceUrl: canonicalSourceUrl(slug),
    titles: [], summaries: [], skus: [], images: [], listingPaths: [],
    discoveredFrom: [], trustedSources: [], pageValidated: false,
  };

  if (clean(input.title)) current.titles.push(cleanTitle(input.title, slug));
  if (clean(input.summary)) current.summaries.push(stripTags(input.summary));
  if (clean(input.sku)) current.skus.push(clean(input.sku));
  if (clean(input.imageUrl)) current.images.push(normalizeAbsoluteUrl(input.imageUrl));
  if (clean(input.listingPath)) current.listingPaths.push(normalizePath(input.listingPath));
  if (clean(input.discoveredFrom)) current.discoveredFrom.push(clean(input.discoveredFrom));
  if (clean(input.trustedSource)) current.trustedSources.push(clean(input.trustedSource));
  if (input.pageValidated) current.pageValidated = true;

  current.titles = unique(current.titles);
  current.summaries = unique(current.summaries);
  current.skus = unique(current.skus, normalizeSku);
  current.images = unique(current.images, normalizedUrlKey);
  current.listingPaths = unique(current.listingPaths, normalizePath);
  current.discoveredFrom = unique(current.discoveredFrom);
  current.trustedSources = unique(current.trustedSources);
  candidates.set(key, current);
}

function imageFromNode($, scope) {
  const image = scope.find("img").first();
  const srcset = clean(image.attr("data-srcset") || image.attr("srcset"));
  const srcsetUrl = srcset ? clean(srcset.split(",").pop()?.trim().split(/\s+/)[0]) : "";
  return normalizeAbsoluteUrl(
    image.attr("data-lazy-src") || image.attr("data-src") || srcsetUrl || image.attr("src") || "",
  );
}

export function collectFromCategories(categories, candidates) {
  for (const category of categories || []) {
    const listingPath = normalizePath(category.path || []);
    for (const block of category.contentBlocks || []) {
      for (const item of block?.items || []) {
        addCandidate(candidates, {
          href: item?.href || item?.url || item?.link || "",
          title: item?.title,
          summary: item?.subtitle || item?.description,
          sku: item?.sku || item?.catNo,
          imageUrl: [item?.imageUrl, item?.image, item?.src, item?.thumbnail, item?.thumb].find(
            (candidate) => typeof candidate === "string" && clean(candidate),
          ),
          listingPath,
          discoveredFrom: `contentBlock:${category._id}`,
          trustedSource: "sanity-category",
        });
      }
    }

    const html = clean(category.legacyHtml);
    if (!html) continue;
    const $ = cheerio.load(html);
    $("a[href]").each((_, anchor) => {
      const href = clean($(anchor).attr("href"));
      if (!kentSlugFromHref(href)) return;
      const card = $(anchor).closest("li.product, .product, .product-card, article, .card");
      const scope = card.length ? card : $(anchor);
      addCandidate(candidates, {
        href,
        title: scope.find(".woocommerce-loop-product__title, h1, h2, h3, h4, .product-title").first().text() ||
          $(anchor).attr("title") || $(anchor).text(),
        summary: scope.find(".excerpt, .description, .summary, p").first().text(),
        sku: scope.find(".sku, .product-sku, [class*='sku'], [class*='item-number']").first().text(),
        imageUrl: imageFromNode($, scope),
        listingPath,
        discoveredFrom: `legacyHtml:${category._id}`,
        trustedSource: "sanity-category",
      });
    });
  }
}

function shopPageLinks($) {
  return unique(
    $("a[href]").toArray().map((node) => normalizeAbsoluteUrl($(node).attr("href"))).filter((href) =>
      /^https:\/\/www\.kentscientific\.com\/shop(?:\/page\/\d+)?\/?$/i.test(href),
    ),
    normalizedUrlKey,
  );
}

function parseShopPage(html, pageUrl, candidates) {
  const $ = cheerio.load(html);
  let found = 0;
  $("li.product, ul.products > li, .products .product, article.product").each((_, node) => {
    const card = $(node);
    const anchor = card.find("a[href]").toArray().find((item) => kentSlugFromHref($(item).attr("href")));
    if (!anchor) return;
    const href = normalizeAbsoluteUrl($(anchor).attr("href"));
    addCandidate(candidates, {
      href,
      title: card.find(".woocommerce-loop-product__title, h2, h3, .product-title").first().text() ||
        $(anchor).attr("title") || $(anchor).text(),
      summary: card.find(".excerpt, .description, .product-excerpt, p").first().text(),
      imageUrl: imageFromNode($, card),
      discoveredFrom: `shop:${pageUrl}`,
      trustedSource: "shop",
    });
    found += 1;
  });
  return { found, links: shopPageLinks($) };
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
      for (const link of parsed.links) if (!visited.has(link) && !queue.includes(link)) queue.push(link);
    } catch (error) {
      errors.push({ url: current, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { visited: [...visited], errors, cardOccurrences };
}

function parseLocs(xml) {
  return [...String(xml || "").matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => match[1].replace(/&amp;/g, "&").trim());
}

function isProductSitemapUrl(value) {
  const raw = clean(value);
  if (!/\.xml(?:\?|$)/i.test(raw)) return false;
  try {
    const name = new URL(raw, KENT_BASE).pathname.toLowerCase();
    return (name === "/wp-sitemap.xml" || /(?:^|[-_/])product(?:[-_/]|sitemap|\d|\.)/.test(name) ||
      /wp-sitemap-posts-product-\d+\.xml$/.test(name)) && !/product[_-]cat|taxonomy|tag/.test(name);
  } catch {
    return false;
  }
}

export async function collectFromSitemap(candidates, fetchPage) {
  const queue = [
    `${KENT_BASE}/wp-sitemap.xml`, `${KENT_BASE}/product-sitemap.xml`,
    `${KENT_BASE}/product-sitemap1.xml`, `${KENT_BASE}/wp-sitemap-posts-product-1.xml`,
  ];
  const visited = new Set();
  const errors = [];
  let productLocOccurrences = 0;
  while (queue.length && visited.size < MAX_SITEMAPS) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    try {
      const page = await fetchPage(current);
      for (const loc of parseLocs(page.text)) {
        if (/\.xml(?:\?|$)/i.test(loc)) {
          const next = normalizeAbsoluteUrl(loc);
          if (isProductSitemapUrl(next) && !visited.has(next) && !queue.includes(next)) queue.push(next);
          continue;
        }
        if (!kentSlugFromHref(loc)) continue;
        addCandidate(candidates, { href: loc, discoveredFrom: `sitemap:${current}` });
        productLocOccurrences += 1;
      }
    } catch (error) {
      errors.push({ url: current, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { visited: [...visited], errors, productLocOccurrences };
}

function parseItemNumber(text) {
  return stripTags(text).match(/Item\s*#\s*([A-Z0-9][A-Z0-9._/-]*)/i)?.[1] || "";
}

function parseProductPage(html, finalUrl) {
  const $ = cheerio.load(html);
  let jsonLdProduct = false;
  $("script[type='application/ld+json']").each((_, node) => {
    if (/"@type"\s*:\s*"Product"/i.test($(node).text())) jsonLdProduct = true;
  });
  const valid = /(?:^|\s)single-product(?:\s|$)/i.test(clean($("body").attr("class"))) ||
    $("h1.product_title, .product_title.entry-title, form.cart, .woocommerce-product-gallery").length > 0 ||
    jsonLdProduct;
  const slug = kentSlugFromHref(finalUrl);
  const summaryScope = $(".summary.entry-summary").first();
  const title = $("h1.product_title, h1.entry-title, main h1").first().text() ||
    $("meta[property='og:title']").attr("content") || $("title").text();
  const summary = $(".woocommerce-product-details__short-description").first().text() ||
    summaryScope.find("p").first().text() || $("meta[name='description']").attr("content") || "";
  const sku = $(".sku").first().text() || parseItemNumber(summaryScope.text()) || parseItemNumber($("body").text());
  const galleryImage = $(".woocommerce-product-gallery img, .product img.wp-post-image").first();
  const image = galleryImage.attr("data-large_image") || galleryImage.attr("data-src") || galleryImage.attr("src") ||
    $("meta[property='og:image']").attr("content") || "";
  const listingPaths = unique(
    $("a[href*='/product/']").toArray().map((node) => kentCategoryPathFromHref($(node).attr("href"))).filter(Boolean),
    normalizePath,
  );
  return {
    valid: Boolean(valid && slug), slug, title: cleanTitle(title, slug), summary: stripTags(summary),
    sku: clean(sku), imageUrl: normalizeAbsoluteUrl(image), listingPaths,
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
      errors.push({ slug: candidate.slug, url: candidate.sourceUrl,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason) });
      if (!candidate.trustedSources.length) {
        candidates.delete(candidate.slug.toLowerCase());
        rejected.push({ slug: candidate.slug, sourceUrl: candidate.sourceUrl, reason: "page_fetch_failed_untrusted" });
      }
      continue;
    }
    const { page, parsed } = result.value;
    if (!parsed.valid) {
      if (!candidate.trustedSources.length) {
        candidates.delete(candidate.slug.toLowerCase());
        rejected.push({ slug: candidate.slug, sourceUrl: candidate.sourceUrl, reason: "not_a_product_page" });
      }
      continue;
    }
    validated += 1;
    addCandidate(candidates, {
      href: page.finalUrl || candidate.sourceUrl, title: parsed.title, summary: parsed.summary,
      sku: parsed.sku, imageUrl: parsed.imageUrl, discoveredFrom: `productPage:${page.finalUrl || candidate.sourceUrl}`,
      trustedSource: "validated-product-page", pageValidated: true,
    });
    for (const listingPath of parsed.listingPaths) {
      addCandidate(candidates, {
        href: page.finalUrl || candidate.sourceUrl, listingPath,
        discoveredFrom: `productCategory:${page.finalUrl || candidate.sourceUrl}`,
        trustedSource: "validated-product-page", pageValidated: true,
      });
    }
  }
  return { checked: rows.length, validated, rejected, errors };
}
