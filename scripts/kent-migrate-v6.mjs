// scripts/kent-migrate-v6.mjs
/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
import { createClient } from "@sanity/client";

dotenv.config({ path: ".env.local" });

const argv = process.argv.slice(2);
const hasArg = (flag) => argv.includes(flag);
const readArg = (flag, fallback = "") => {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] ?? fallback : fallback;
};

const BRAND_KEY = "kent";
const BASE = "https://www.kentscientific.com";
const CACHE_DIR = path.join(".cache", "kent-v6");
fs.mkdirSync(CACHE_DIR, { recursive: true });

const MENU_SEED_URL = readArg("--menuSeedUrl", "https://www.kentscientific.com/product/anesthesia/");
const SEED_SCOPE = readArg("--seedScope", "fixed"); // fixed | page
const CATEGORY_LIMIT = Number(readArg("--categoryLimit", "0") || "0");
const PRODUCT_LIMIT = Number(readArg("--productLimit", "0") || "0");
const DRY = hasArg("--dryRun") || hasArg("--dry");
const PRUNE_DUPLICATES = hasArg("--pruneDuplicates");
const DELETE_DUPLICATES = hasArg("--deleteDuplicates");

const FIXED_ROOT_SEEDS = [
  "https://www.kentscientific.com/product/anesthesia/",
  "https://www.kentscientific.com/product/laboratory-animal-handling/",
  "https://www.kentscientific.com/product/body-composition-analysis/",
  "https://www.kentscientific.com/product/feeding-needles/",
  "https://www.kentscientific.com/product/mobile-carts/",
  "https://www.kentscientific.com/product/nebulizers/",
  "https://www.kentscientific.com/product/noninvasive-blood-pressure/",
  "https://www.kentscientific.com/product/physiological-monitoring/",
  "https://www.kentscientific.com/product/rodent-identification/",
  "https://www.kentscientific.com/product/surgery/",
  "https://www.kentscientific.com/product/tail-vein-training-materials/",
  "https://www.kentscientific.com/product/tissue-collection/",
  "https://www.kentscientific.com/product/ventilation/",
  "https://www.kentscientific.com/product/warming/",
  "https://www.kentscientific.com/product/warranty/",
];

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId || !dataset || !token) {
  console.error("[ERR] Missing env. Need NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_WRITE_TOKEN");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  apiVersion: "2024-02-01",
  token,
  useCdn: false,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const UNWANTED = {
  earlyAccess: /Get early access to info,\s*updates,\s*and discounts/i,
  loginPrice: /Login to see prices/i,
  contactNoise: /(Need Help\?|Help & Support|Ask For Support|We reply fast)/i,
};

function toAbs(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${BASE}${url}`;
  return url;
}

function normUrl(url) {
  const abs = toAbs(url).trim();
  if (!abs) return "";
  return abs.replace(/#.*$/, "");
}

function normUrlKeepTrailing(url) {
  const abs = normUrl(url);
  if (!abs) return "";
  return abs.endsWith("/") ? abs : `${abs}/`;
}

function stripTrailingSlash(url) {
  return normUrl(url).replace(/\/$/, "");
}

function isKentCategoryUrl(url) {
  return normUrlKeepTrailing(url).startsWith(`${BASE}/product/`);
}

function isKentProductUrl(url) {
  return normUrlKeepTrailing(url).startsWith(`${BASE}/products/`);
}

function isKentPdf(url) {
  return /\.pdf(?:$|\?)/i.test(normUrl(url));
}

function isIgnorableUrl(url) {
  const raw = String(url || "").trim();
  return !raw || /^mailto:|^tel:|^javascript:/i.test(raw);
}

function isLegacyLikeUrl(url) {
  const abs = normUrl(url);
  if (!abs) return false;
  if (!abs.startsWith(BASE)) return true;
  if (isKentCategoryUrl(abs) || isKentProductUrl(abs)) return false;
  return true;
}

function categoryUrlToPath(url) {
  const abs = normUrlKeepTrailing(url);
  if (!isKentCategoryUrl(abs)) return [];
  return abs
    .replace(`${BASE}/product/`, "")
    .replace(/\/$/, "")
    .split("/")
    .map((seg) => seg.trim())
    .filter(Boolean);
}

function productUrlToSlug(url) {
  const abs = normUrlKeepTrailing(url);
  if (!isKentProductUrl(abs)) return "";
  return abs.replace(`${BASE}/products/`, "").replace(/\/$/, "").trim();
}

function buildCategoryHref(pathArr) {
  return pathArr.length ? `/products/${BRAND_KEY}/${pathArr.join("/")}` : `/products/${BRAND_KEY}`;
}

function buildProductHref(slug) {
  return `/products/${BRAND_KEY}/item/${slug}`;
}

function legacyHref(url) {
  return `/products/${BRAND_KEY}/legacy?u=${encodeURIComponent(normUrl(url))}`;
}

function resolveInternalKentHref(url) {
  if (!url) return "#";
  if (String(url).startsWith("/products/")) return url;

  const abs = normUrl(url);
  if (!abs) return "#";

  if (isKentCategoryUrl(abs)) {
    const pathArr = categoryUrlToPath(abs);
    return pathArr.length ? buildCategoryHref(pathArr) : legacyHref(abs);
  }

  if (isKentProductUrl(abs)) {
    const slug = productUrlToSlug(abs);
    return slug ? buildProductHref(slug) : legacyHref(abs);
  }

  return legacyHref(abs);
}

function pathArrToCategoryId(pathArr) {
  return `cat_kent__${pathArr.join("__")}`;
}

function slugToProductId(slug) {
  return `prod_kent__${slug.replaceAll("/", "__")}`;
}

function slugifyLoose(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/&amp;/gi, "and")
    .replace(/&/g, "and")
    .replace(/[®™]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function textClean(input) {
  return String(input || "").replace(/\s+/g, " ").trim();
}

function prettifyTitle(input) {
  const clean = textClean(input)
    .replace(/\|\s*Kent Scientific.*$/i, "")
    .replace(/–\s*KENT.*$/i, "")
    .replace(/\s*-\s*KENT.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return clean;
}

function normalizeTitle(title, fallbackSlug = "") {
  const clean = prettifyTitle(title);
  if (clean) return clean;
  return fallbackSlug
    .replaceAll("-", " ")
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim();
}

function rewriteRelativeUrls(html, baseUrl) {
  if (!html) return "";
  if (!baseUrl) return html;
  let out = html.replace(/\s(href|src)=["'](\/(?!\/)[^"']*)["']/gi, (_m, attr, p) => ` ${attr}="${baseUrl}${p}"`);
  out = out.replace(/\s(href|src)=["'](\/\/[^"']+)["']/gi, (_m, attr, p) => ` ${attr}="https:${p}"`);
  return out;
}

function rewriteAnchorsToInternalAware(html) {
  if (!html) return "";
  return html.replace(/\shref=["']([^"']+)["']/gi, (_m, url) => ` href="${resolveInternalKentHref(url)}"`);
}

function safeHtmlForStorage(html) {
  let out = String(html || "");
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = rewriteRelativeUrls(out, BASE);
  out = rewriteAnchorsToInternalAware(out);
  return out.trim();
}

async function fetchHtmlCached(url) {
  const normalized = stripTrailingSlash(url);
  const key = Buffer.from(normalized).toString("base64url");
  const fp = path.join(CACHE_DIR, `${key}.html`);

  if (fs.existsSync(fp)) return fs.readFileSync(fp, "utf-8");

  const res = await fetch(normalized, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed ${res.status} ${normalized}`);
  const html = await res.text();
  fs.writeFileSync(fp, html, "utf-8");
  await sleep(150);
  return html;
}

function removeUnwantedUi($root, $) {
  $root.find("script,style,noscript,iframe,form.searchform,.searchform,.popup,.newsletter,.breadcrumbs .delimiter").remove();

  $root.find("h1,h2,h3,h4,p,div,section").each((_, el) => {
    const text = textClean($(el).text());
    if (UNWANTED.earlyAccess.test(text) || UNWANTED.contactNoise.test(text)) {
      const block = $(el).closest(".elementor-element, .e-con, .porto-block, .main-content, section, .widget");
      if (block.length) block.remove();
    }
  });
}

function extractTitleAndSummary($) {
  const h1 = prettifyTitle($("h1").first().text());
  const title = h1 || prettifyTitle($("title").first().text());
  const summary = $("p")
    .toArray()
    .map((el) => textClean($(el).text()))
    .find((text) => text.length > 40 && !UNWANTED.loginPrice.test(text));
  return { title, summary: summary ? summary.slice(0, 240) : "" };
}

function extractProductCards($, $scope) {
  const items = [];

  $scope.find("li.product").each((_, li) => {
    const $li = $(li);
    const $a = $li.find('a[href*="/products/"]').first();
    const sourceUrl = normUrlKeepTrailing($a.attr("href") || "");
    if (!sourceUrl || !isKentProductUrl(sourceUrl)) return;

    const slug = productUrlToSlug(sourceUrl);
    const title = textClean($li.find(".woocommerce-loop-product__title").first().text()) || textClean($a.text());
    if (!title || !slug) return;

    const subtitle = textClean($li.find(".product-short-description").first().text());
    const imageUrl = toAbs($li.find("img").first().attr("src") || "");
    const badge = textClean($li.find(".labels .onhot, .labels .new, .onsale").first().text());

    const gtmRaw = $li.find("span.gtm4wp_productdata").first().attr("data-gtm4wp_product_data") || "";
    let sku = "";
    if (gtmRaw) {
      try {
        const parsed = JSON.parse(
          gtmRaw.replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&#39;", "'")
        );
        sku = String(parsed?.sku || parsed?.item_id || "").trim();
      } catch {
        // noop
      }
    }

    items.push({
      title,
      subtitle,
      href: buildProductHref(slug),
      sourceUrl,
      imageUrl,
      badge,
      sku,
    });
  });

  return items;
}

function extractCategoryCards($, $scope) {
  const items = [];

  $scope.find("li.product-category").each((_, li) => {
    const $li = $(li);
    const $a = $li.find('a[href*="/product/"]').first();
    const sourceUrl = normUrlKeepTrailing($a.attr("href") || "");
    if (!sourceUrl || !isKentCategoryUrl(sourceUrl)) return;

    const pathArr = categoryUrlToPath(sourceUrl);
    const title = textClean($li.find("h3").first().text()) || textClean($a.text());
    if (!title || !pathArr.length) return;

    const imageUrl = toAbs($li.find("img").first().attr("src") || "");
    const countTxt = textClean($li.find("mark.count").first().text());
    const count = countTxt ? Number(countTxt.replace(/[^\d]/g, "")) : undefined;

    items.push({
      title,
      href: buildCategoryHref(pathArr),
      sourceUrl,
      imageUrl,
      count,
    });
  });

  return items;
}

function extractPublications($) {
  const items = [];

  $(".porto-posts-grid .porto-tb-item.publication").each((_, el) => {
    const $a = $(el).find("h2 a").first();
    const sourceUrl = normUrl($a.attr("href") || "");
    const title = textClean($a.text());
    if (!title || !sourceUrl) return;
    items.push({ title, href: legacyHref(sourceUrl), sourceUrl });
  });

  return items;
}

function extractResources($) {
  const items = [];

  $(".elementor-widget-image-box").each((_, el) => {
    const $a = $(el).find("a[href]").first();
    const sourceUrl = normUrl($a.attr("href") || "");
    const title =
      textClean($(el).find(".elementor-image-box-title").text()) || textClean($a.text());
    const subtitle = textClean($(el).find(".elementor-image-box-description").text());
    const imageUrl = toAbs($(el).find("img").first().attr("src") || "");
    if (!title || !sourceUrl) return;
    items.push({
      title,
      subtitle,
      href: resolveInternalKentHref(sourceUrl),
      sourceUrl,
      imageUrl,
    });
  });

  return items;
}

function parseLandingContentBlocks(html) {
  const $ = cheerio.load(html, { decodeEntities: false });

  const $main = $("#content").length
    ? $("#content")
    : $(".main-content").length
    ? $(".main-content")
    : $("main").length
    ? $("main")
    : $.root();

  removeUnwantedUi($main, $);

  const blocks = [];
  const firstText = $main.find(".elementor-widget-text-editor").first();

  if (firstText.length) {
    const h1Text = textClean(firstText.find("h1").first().text());
    const ps = firstText
      .find("p")
      .slice(0, 2)
      .toArray()
      .map((p) => $.html(p))
      .join("");
    const introHtml = `${h1Text ? `<h1>${h1Text}</h1>` : ""}${ps}`;
    if (textClean(cheerio.load(introHtml).text()).length > 30) {
      blocks.push({
        _type: "contentBlockHtml",
        title: h1Text || "Overview",
        html: safeHtmlForStorage(introHtml),
      });
    }
  }

  const widgets = $main.find(".elementor-element").toArray();

  for (let i = 0; i < widgets.length; i += 1) {
    const $el = $(widgets[i]);
    const $textWidget = $el.find(".elementor-widget-text-editor").first();
    const h2Text = textClean($textWidget.find("h2").first().text());

    if (!h2Text || UNWANTED.earlyAccess.test(h2Text)) continue;

    const widgetHtml = $textWidget.html() || "";
    const $$ = cheerio.load(widgetHtml, { decodeEntities: false });
    $$("h2").first().remove();
    const bodyHtml = safeHtmlForStorage($$.root().html() || "");

    blocks.push({ _type: "contentBlockHtml", title: h2Text, html: bodyHtml });

    let j = i + 1;
    while (j < widgets.length) {
      const $next = $(widgets[j]);
      const nextH2 = textClean($next.find(".elementor-widget-text-editor h2").first().text());
      if (nextH2) break;

      if ($next.find("ul.products li.product").length) {
        const items = extractProductCards($, $next);
        if (items.length) {
          blocks.push({
            _type: "contentBlockCards",
            title: h2Text,
            kind: "product",
            items,
          });
        }
      }

      if ($next.find("li.product-category").length) {
        const items = extractCategoryCards($, $next);
        if (items.length) {
          blocks.push({
            _type: "contentBlockCards",
            title: h2Text,
            kind: "category",
            items,
          });
        }
      }

      j += 1;
      if (j - i > 14) break;
    }
  }

  const publications = extractPublications($);
  if (publications.length) {
    blocks.push({
      _type: "contentBlockCards",
      title: "Scientific articles and publications",
      kind: "publication",
      items: publications,
    });
  }

  const resources = extractResources($);
  if (resources.length) {
    blocks.push({
      _type: "contentBlockCards",
      title: "Resources",
      kind: "resource",
      items: resources,
    });
  }

  return blocks.filter((block, index) => {
    if (block._type !== "contentBlockHtml") return true;
    const len = textClean(cheerio.load(String(block.html || "")).text()).length;
    const next = blocks[index + 1];
    const hasCardsNext =
      next && next._type === "contentBlockCards" && next.title === block.title;
    return len >= 25 || hasCardsNext;
  });
}

function discoverChildCategories(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const found = new Set();

  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href") || "";
    if (isIgnorableUrl(raw)) return;

    const url = normUrlKeepTrailing(raw);
    if (!url || !isKentCategoryUrl(url)) return;

    const pathArr = categoryUrlToPath(url);
    if (!pathArr.length) return;

    found.add(url);
  });

  return [...found];
}

function discoverProductUrls(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const found = new Set();

  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href") || "";
    if (isIgnorableUrl(raw)) return;

    const url = normUrlKeepTrailing(raw);
    if (!url || !isKentProductUrl(url)) return;

    const slug = productUrlToSlug(url);
    if (!slug) return;

    found.add(url);
  });

  return [...found];
}

async function getBrandRef() {
  const brand = await sanity.fetch(
    `*[_type == "brand" && (themeKey == $brandKey || slug.current == $brandKey)][0]{ _id, title }`,
    { brandKey: BRAND_KEY }
  );

  if (!brand?._id) {
    throw new Error(`[ERR] brand '${BRAND_KEY}' not found in Sanity`);
  }

  return brand;
}

function extractCategoryTrail($) {
  const path = [];
  const titles = [];

  $("nav.woocommerce-breadcrumb a[href], .woocommerce-breadcrumb a[href], .breadcrumb a[href]").each(
    (_, el) => {
      const href = normUrlKeepTrailing($(el).attr("href") || "");
      if (!isKentCategoryUrl(href)) return;

      const pathArr = categoryUrlToPath(href);
      if (!pathArr.length) return;

      const title = normalizeTitle($(el).text(), pathArr[pathArr.length - 1]);
      path.length = 0;
      titles.length = 0;

      for (const seg of pathArr) path.push(seg);
      for (let i = 0; i < pathArr.length; i += 1) {
        titles[i] = i === pathArr.length - 1 ? title : titles[i] || normalizeTitle(pathArr[i], pathArr[i]);
      }
    }
  );

  if (!path.length) {
    const categoryText = textClean($(".product_meta").text());
    const match = categoryText.match(/Category:\s*([^\n]+)/i);
    if (match?.[1]) {
      const label = textClean(match[1]).split("Tag:")[0].trim();
      if (label) {
        path.push(slugifyLoose(label));
        titles.push(label);
      }
    }
  }

  return { categoryPath: path, categoryPathTitles: titles };
}

function extractSku($root, $) {
  const skuText = textClean($root.find(".sku, .product_meta .sku_wrapper .sku").first().text());
  if (skuText) return skuText;

  const metaText = textClean($root.find(".product_meta").text());
  const itemMatch = metaText.match(/Item\s*#\s*([^\s]+)/i);
  if (itemMatch?.[1] && !/^n\/a$/i.test(itemMatch[1])) return itemMatch[1].trim();

  const gtm = $("span.gtm4wp_productdata").first().attr("data-gtm4wp_product_data") || "";
  if (gtm) {
    try {
      const parsed = JSON.parse(
        gtm.replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&#39;", "'")
      );
      return String(parsed?.sku || parsed?.item_id || "").trim();
    } catch {
      return "";
    }
  }

  return "";
}

function extractImages($root, $) {
  const found = [];
  const seen = new Set();

  $root.find("img").each((_, img) => {
    const src = toAbs(
      $(img).attr("data-large_image") ||
        $(img).attr("data-src") ||
        $(img).attr("src") ||
        ""
    );
    const low = src.toLowerCase();

    if (!src) return;
    if (seen.has(src)) return;
    if (/logo|flag|badge|icon/i.test(low)) return;
    if (/\/(?:kr|us)\.png$/i.test(low)) return;

    seen.add(src);
    found.push(src);
  });

  return found;
}

function extractVariantData($root, $) {
  const optionGroups = [];
  const variants = [];

  $root.find("form.variations_form select, form.cart select").each((_, select) => {
    const $select = $(select);
    const name = ($select.attr("name") || "option").trim();

    const label = textClean(
      $select.closest("tr, .value, .variations, .cart").prev("label, th").first().text() ||
        $select.closest("tr").find("th,label").first().text() ||
        name.replace(/^attribute_/, "")
    );

    const options = $select
      .find("option")
      .toArray()
      .map((opt) => ({
        value: textClean($(opt).attr("value") || ""),
        label: textClean($(opt).text()),
      }))
      .filter((opt) => opt.label && !/^choose an option$/i.test(opt.label));

    if (options.length) {
      optionGroups.push({
        name,
        label: label || name,
        options,
      });
    }
  });

  const formAttr = $root.find("form.variations_form").attr("data-product_variations") || "";
  if (formAttr) {
    try {
      const parsed = JSON.parse(formAttr.replaceAll("&quot;", '"'));
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          variants.push({
            sku: textClean(item?.sku || item?.variation_id || ""),
            title: textClean(item?.variation_description || item?.sku || ""),
            optionSummary: Object.values(item?.attributes || {})
              .map((v) => textClean(v))
              .filter(Boolean)
              .join(" / "),
            attributes: item?.attributes || {},
            imageUrl: item?.image?.src ? toAbs(item.image.src) : "",
            sourceVariationId: item?.variation_id ? String(item.variation_id) : "",
          });
        }
      }
    } catch {
      // noop
    }
  }

  if (!optionGroups.length) {
    const heading = $root.find(
      'label:contains("Option"), h3:contains("Option"), h4:contains("Option"), strong:contains("Option")'
    ).first();

    const labels = [];
    heading.nextAll("ul").first().find("li").each((_, li) => {
      const text = textClean($(li).text());
      if (text) labels.push({ value: slugifyLoose(text), label: text });
    });

    if (labels.length) {
      optionGroups.push({ name: "option", label: "Option", options: labels });
    }
  }

  if (!variants.length && optionGroups.length === 1) {
    for (const option of optionGroups[0].options) {
      variants.push({
        sku: "",
        title: option.label,
        optionSummary: option.label,
        attributes: { [optionGroups[0].name]: option.value || option.label },
        imageUrl: "",
        sourceVariationId: "",
      });
    }
  }

  return {
    hasVariants: optionGroups.some((group) => group.options.length > 1),
    optionGroups,
    variants,
  };
}

function extractDocsAndPdfLinks($root, $) {
  const docs = [];
  const seen = new Set();

  $root.find("a[href]").each((_, el) => {
    const href = normUrl($(el).attr("href") || "");
    if (!href || !isKentPdf(href)) return;

    const label = textClean($(el).text()) || "Document";
    if (seen.has(href)) return;

    seen.add(href);
    docs.push({ title: label, label, url: href });
  });

  return docs;
}

function extractHtmlSection($root, $, headingRegex) {
  const headings = $root.find("h2, h3, h4").toArray();

  for (const heading of headings) {
    const $heading = $(heading);
    const title = textClean($heading.text());
    if (!headingRegex.test(title)) continue;

    const chunks = [`<h2>${title}</h2>`];
    let cursor = $heading.next();

    while (cursor.length) {
      if (/^h[2-4]$/i.test(cursor[0]?.tagName || "")) break;
      chunks.push($.html(cursor));
      cursor = cursor.next();
    }

    return safeHtmlForStorage(chunks.join(""));
  }

  return "";
}

function extractProductContent(html, sourceUrl) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const $root = $(".product.type-product, .single-product .product, main").first().length
    ? $(".product.type-product, .single-product .product, main").first()
    : $.root();

  removeUnwantedUi($root, $);

  const { title, summary } = extractTitleAndSummary($);
  const slug = productUrlToSlug(sourceUrl);
  const sku = extractSku($root, $);
  const { categoryPath, categoryPathTitles } = extractCategoryTrail($);
  const imageUrls = extractImages($root, $);
  const variantData = extractVariantData($root, $);
  const docs = extractDocsAndPdfLinks($root, $);

  const descriptionHtml = safeHtmlForStorage(
    $root
      .find(".woocommerce-product-details__short-description, .summary .woocommerce-product-details__short-description")
      .first()
      .html() || extractHtmlSection($root, $, /(what you get|base system includes|why use|overview|description)/i)
  );

  const specsHtml = safeHtmlForStorage(
    $root
      .find("#tab-additional_information, .woocommerce-Tabs-panel--additional_information table, table.shop_attributes")
      .first()
      .html() || extractHtmlSection($root, $, /(specification|specifications|additional information)/i)
  );

  const referencesHtml = extractHtmlSection($root, $, /reference/i);
  const faqsHtml = extractHtmlSection($root, $, /frequently asked questions|faq/i);
  const documentsHtml = docs.length
    ? safeHtmlForStorage(
        `<ul>${docs.map((doc) => `<li><a href="${doc.url}">${doc.label}</a></li>`).join("")}</ul>`
      )
    : "";

  return {
    title: normalizeTitle(title, slug),
    slug,
    sku,
    summary,
    categoryPath,
    categoryPathTitles,
    imageUrls,
    docs,
    specsHtml,
    extraHtml: descriptionHtml,
    datasheetHtml: documentsHtml,
    documentsHtml,
    faqsHtml,
    referencesHtml,
    reviewsHtml: "",
    legacyHtml: safeHtmlForStorage($root.html() || html),
    productType: variantData.hasVariants ? "variant" : "simple",
    optionGroups: variantData.optionGroups,
    variants: variantData.variants,
  };
}

async function upsertCategory({ brandId, url, order = 9999 }) {
  const sourceUrl = normUrlKeepTrailing(url);
  const html = await fetchHtmlCached(sourceUrl);
  const $ = cheerio.load(html, { decodeEntities: false });
  const { title, summary } = extractTitleAndSummary($);
  const pathArr = categoryUrlToPath(sourceUrl);

  if (!pathArr.length) return { childCategories: [], productUrls: [] };

  const contentBlocks = parseLandingContentBlocks(html);
  const parentPath = pathArr.slice(0, -1);
  const parentId = parentPath.length ? pathArrToCategoryId(parentPath) : undefined;
  const id = pathArrToCategoryId(pathArr);

  const doc = {
    _id: id,
    _type: "category",
    brand: { _type: "reference", _ref: brandId },
    themeKey: BRAND_KEY,
    brandSlug: BRAND_KEY,
    isActive: true,
    title: normalizeTitle(title, pathArr[pathArr.length - 1]),
    path: pathArr,
    parent: parentId ? { _type: "reference", _ref: parentId } : undefined,
    order,
    sourceUrl,
    summary: summary || "",
    legacyHtml: safeHtmlForStorage(html),
    contentBlocks,
  };

  if (!DRY) {
    await sanity
      .transaction()
      .createIfNotExists({ _id: id, _type: "category" })
      .patch(id, (p) => p.set(doc))
      .commit({ visibility: "sync" });
  }

  console.log(
    `${DRY ? "[DRY]" : "[OK]"} category ${id} ${doc.title} blocks=${contentBlocks.length}`
  );

  return {
    childCategories: discoverChildCategories(html),
    productUrls: discoverProductUrls(html),
  };
}

async function upsertProduct({ brandId, url }) {
  const sourceUrl = normUrlKeepTrailing(url);
  const slug = productUrlToSlug(sourceUrl);
  if (!slug) return;

  const html = await fetchHtmlCached(sourceUrl);
  const parsed = extractProductContent(html, sourceUrl);
  const productId = slugToProductId(slug);
  const categoryId = parsed.categoryPath.length
    ? pathArrToCategoryId(parsed.categoryPath)
    : undefined;

  const doc = {
    _id: productId,
    _type: "product",
    brand: { _type: "reference", _ref: brandId },
    isActive: true,
    title: parsed.title,
    sku: parsed.sku || "",
    slug: { _type: "slug", current: slug },
    categoryRef: categoryId ? { _type: "reference", _ref: categoryId } : undefined,
    categoryPath: parsed.categoryPath,
    categoryPathTitles: parsed.categoryPathTitles,
    sourceUrl,
    legacyHtml: parsed.legacyHtml,
    specsHtml: parsed.specsHtml,
    extraHtml: parsed.extraHtml,
    datasheetHtml: parsed.datasheetHtml,
    documentsHtml: parsed.documentsHtml,
    faqsHtml: parsed.faqsHtml,
    referencesHtml: parsed.referencesHtml,
    reviewsHtml: parsed.reviewsHtml,
    imageUrls: parsed.imageUrls,
    docs: parsed.docs,
    enrichedAt: new Date().toISOString(),

    // variant 지원
    productType: parsed.productType,
    optionGroups: parsed.optionGroups,
    variants: parsed.variants,
  };

  if (!DRY) {
    await sanity
      .transaction()
      .createIfNotExists({ _id: productId, _type: "product" })
      .patch(productId, (p) => p.set(doc))
      .commit({ visibility: "sync" });
  }

  console.log(
    `${DRY ? "[DRY]" : "[OK]"} product ${productId} ${parsed.title} variants=${parsed.variants.length} sku=${parsed.sku || "-"} category=${parsed.categoryPath.join("/") || "-"}`
  );
}

async function cleanupDuplicates() {
  const data = await sanity.fetch(
    `
  {
    "categories": *[_type == "category" && (brand->themeKey == $brandKey || brand->slug.current == $brandKey || themeKey == $brandKey || brandSlug == $brandKey)]{
      _id,
      title,
      path,
      "pathStr": array::join(path, "/")
    },
    "products": *[_type == "product" && (brand->themeKey == $brandKey || brand->slug.current == $brandKey)]{
      _id,
      title,
      "slug": slug.current
    }
  }
  `,
    { brandKey: BRAND_KEY }
  );

  const deleteIds = [];

  const categoryBuckets = new Map();
  for (const cat of data.categories || []) {
    const key = cat.pathStr || "";
    if (!key) continue;
    if (!categoryBuckets.has(key)) categoryBuckets.set(key, []);
    categoryBuckets.get(key).push(cat);
  }

  for (const [key, cats] of categoryBuckets.entries()) {
    const deterministicId = pathArrToCategoryId(key.split("/"));
    for (const cat of cats) {
      if (cat._id !== deterministicId) deleteIds.push(cat._id);
    }
  }

  const productBuckets = new Map();
  for (const product of data.products || []) {
    const key = product.slug || "";
    if (!key) continue;
    if (!productBuckets.has(key)) productBuckets.set(key, []);
    productBuckets.get(key).push(product);
  }

  for (const [slug, products] of productBuckets.entries()) {
    const deterministicId = slugToProductId(slug);
    for (const product of products) {
      if (product._id !== deterministicId) deleteIds.push(product._id);
    }
  }

  if (!deleteIds.length) {
    console.log("[OK] no duplicate category/product docs found");
    return;
  }

  console.log(`[INFO] duplicate docs found: ${deleteIds.length}`);
  deleteIds.forEach((id) => console.log("  -", id));

  if (!DELETE_DUPLICATES || DRY) return;

  let tx = sanity.transaction();
  for (const id of deleteIds) tx = tx.delete(id);
  await tx.commit({ visibility: "sync" });
  console.log(`[OK] deleted duplicates: ${deleteIds.length}`);
}

function getSeedCategories(seedUrl) {
  if (SEED_SCOPE === "page") {
    if (!isKentCategoryUrl(seedUrl)) {
      throw new Error(
        "[ERR] --seedScope page requires a Kent category URL, e.g. https://www.kentscientific.com/product/anesthesia/"
      );
    }
    return [seedUrl];
  }

  return FIXED_ROOT_SEEDS.map((url) => normUrlKeepTrailing(url));
}

async function main() {
  const brand = await getBrandRef();
  const seedUrl = normUrlKeepTrailing(MENU_SEED_URL);
  const seedCategories = getSeedCategories(seedUrl);

  console.log(
    `[INFO] brand=${brand.title} seedScope=${SEED_SCOPE} seedCategories=${seedCategories.length}`
  );

  const categoryQueue = [...seedCategories];
  const categoryVisited = new Set();
  const productQueue = new Set();
  const categoryOrder = new Map(seedCategories.map((url, index) => [url, index + 1]));

  let categoryProcessed = 0;

  while (categoryQueue.length) {
    const url = categoryQueue.shift();
    if (!url || categoryVisited.has(url)) continue;
    categoryVisited.add(url);

    if (CATEGORY_LIMIT > 0 && categoryProcessed >= CATEGORY_LIMIT) break;

    const { childCategories, productUrls } = await upsertCategory({
      brandId: brand._id,
      url,
      order: categoryOrder.get(url) ?? 9999,
    });

    categoryProcessed += 1;

    for (const child of childCategories) {
      if (!categoryVisited.has(child)) {
        if (!categoryOrder.has(child)) categoryOrder.set(child, 5000 + categoryOrder.size);
        categoryQueue.push(child);
      }
    }

    for (const productUrl of productUrls) {
      if (isKentProductUrl(productUrl)) productQueue.add(productUrl);
    }
  }

  console.log(
    `[DONE] categories processed=${categoryProcessed} queuedProducts=${productQueue.size}`
  );

  let productProcessed = 0;
  for (const url of productQueue) {
    if (PRODUCT_LIMIT > 0 && productProcessed >= PRODUCT_LIMIT) break;
    await upsertProduct({ brandId: brand._id, url });
    productProcessed += 1;
  }

  console.log(`[DONE] products processed=${productProcessed}`);

  if (PRUNE_DUPLICATES) {
    await cleanupDuplicates();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});