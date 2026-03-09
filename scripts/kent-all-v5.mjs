// scripts/kent-all-v5.mjs
/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
import { createClient } from "@sanity/client";

dotenv.config({ path: ".env.local" });

/**
 * ✅ Categories (Kent landing-like)
 *   node scripts/kent-all-v5.mjs --onlyCategories --menuSeedUrl https://www.kentscientific.com/product/anesthesia/
 *   node scripts/kent-all-v5.mjs --onlyCategories --menuSeedUrl https://www.kentscientific.com/product/anesthesia/ --seedScope page
 *   node scripts/kent-all-v5.mjs --onlyCategories --menuSeedUrl https://www.kentscientific.com/product/anesthesia/ --categoryLimit 30
 *
 * Env:
 *  NEXT_PUBLIC_SANITY_PROJECT_ID
 *  NEXT_PUBLIC_SANITY_DATASET
 *  SANITY_WRITE_TOKEN
 */

const argv = process.argv.slice(2);
const hasArg = (k) => argv.includes(k);
const readArg = (k, def = "") => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] ?? def : def;
};

const BRAND_KEY = "kent";
const BASE = "https://www.kentscientific.com";

const ONLY_CATEGORIES = hasArg("--onlyCategories");
const ONLY_PRODUCTS = hasArg("--onlyProducts"); // (placeholder)
const MENU_SEED_URL = readArg("--menuSeedUrl", "");
const SEED_SCOPE = readArg("--seedScope", "menu"); // menu | page
const CATEGORY_LIMIT = Number(readArg("--categoryLimit", "0") || "0");
const DRY = hasArg("--dryRun") || hasArg("--dry");

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId || !dataset || !token) {
  console.error("[ERR] Missing env. Need NEXT_PUBLIC_SANITY_PROJECT_ID/NEXT_PUBLIC_SANITY_DATASET/SANITY_WRITE_TOKEN");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  apiVersion: "2024-02-01",
  token,
  useCdn: false,
});

const CACHE_DIR = path.join(".cache", "kent-v5");
fs.mkdirSync(CACHE_DIR, { recursive: true });

const UNWANTED = {
  earlyAccess: /Get early access to info,\s*updates,\s*and discounts/i,
  loginPrice: /Login to see prices/i,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toAbs(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return BASE + url;
  return url;
}

function normUrl(u) {
  const url = toAbs(u).replace(/#.*$/, "");
  return url.endsWith("/") ? url : url + "/";
}

function isKentCategoryUrl(u) {
  const url = normUrl(u);
  return url.startsWith(`${BASE}/product/`);
}

function isKentProductUrl(u) {
  const url = normUrl(u);
  return url.startsWith(`${BASE}/products/`);
}

function urlToPathArr(categoryUrl) {
  const u = normUrl(categoryUrl);
  const p = u.replace(`${BASE}/product/`, "").replace(/\/$/, "");
  if (!p) return [];
  return p.split("/").map((s) => s.trim()).filter(Boolean);
}

function titleCaseFromSlug(s) {
  return (s || "")
    .replaceAll("-", " ")
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim();
}

function pathArrToId(pathArr) {
  return `cat_kent__${pathArr.join("__")}`;
}

function textClean(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function prettifyTitle(t) {
  const x = textClean(t);
  if (!x) return "";
  return x
    .replace(/\|\s*Kent Scientific.*$/i, "")
    .replace(/–\s*KENT.*$/i, "")
    .replace(/\s*-\s*KENT.*$/i, "")
    .trim();
}

function rewriteRelativeUrls(html, baseUrl) {
  if (!html) return "";
  if (!baseUrl) return html;
  let out = html.replace(/\s(href|src)=["'](\/(?!\/)[^"']*)["']/gi, (_m, attr, p) => ` ${attr}="${baseUrl}${p}"`);
  out = out.replace(/\s(href|src)=["'](\/\/[^"']+)["']/gi, (_m, attr, p2) => ` ${attr}="https:${p2}"`);
  return out;
}

function roughTextLenFromHtml(html) {
  const t = (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return t.length;
}

async function fetchHtmlCached(url) {
  const key = Buffer.from(url).toString("base64url");
  const fp = path.join(CACHE_DIR, `${key}.html`);
  if (fs.existsSync(fp)) return fs.readFileSync(fp, "utf-8");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed ${res.status} ${url}`);
  const html = await res.text();
  fs.writeFileSync(fp, html, "utf-8");

  await sleep(120);
  return html;
}

function removeUnwantedUi($root, $) {
  // remove early access/newsletter section
  $root.find("h1,h2,h3").each((_, el) => {
    const t = textClean($(el).text());
    if (UNWANTED.earlyAccess.test(t)) {
      const $blk = $(el).closest(".elementor-element, .e-con, .porto-block, .main-content");
      if ($blk.length) $blk.remove();
      else $(el).parent().remove();
    }
  });

  // remove scripts/styles
  $root.find("script,style,noscript").remove();
}

function extractTitleAndSummary($) {
  const h1 = prettifyTitle($("h1").first().text());
  const title = h1 || prettifyTitle($("title").text());
  let summary = "";
  const p = $("p").toArray().map((el) => textClean($(el).text())).find((x) => x.length > 40);
  if (p) summary = p.slice(0, 240);
  return { title, summary };
}

function tryExtractSkuFromGtm($li) {
  const span = $li.find("span.gtm4wp_productdata").first();
  const raw = span.attr("data-gtm4wp_product_data");
  if (!raw) return "";
  try {
    const jsonStr = raw
      .replaceAll("&quot;", '"')
      .replaceAll("&amp;", "&")
      .replaceAll("&#39;", "'");

    const obj = JSON.parse(jsonStr);
    const sku = obj?.sku || obj?.item_id || obj?.id;
    return sku ? String(sku).trim() : "";
  } catch {
    return "";
  }
}

function extractProductCards($, $scope) {
  const items = [];
  $scope.find("li.product").each((_, li) => {
    const $li = $(li);

    // href
    const a = $li.find('a[href*="/products/"]').first();
    const href = normUrl(a.attr("href") || "");
    if (!href || !isKentProductUrl(href)) return;

    const title = textClean($li.find(".woocommerce-loop-product__title").first().text()) || textClean(a.text());
    if (!title) return;

    const subtitle = textClean($li.find(".product-short-description").first().text());
    const img = $li.find("img").first();
    const imageUrl = toAbs(img.attr("src") || "");

    let badge = "";
    const hot = textClean($li.find(".labels .onhot").first().text());
    if (hot) badge = hot;

    const sku = tryExtractSkuFromGtm($li);

    items.push({
      title,
      subtitle,
      href,
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
    const a = $li.find('a[href*="/product/"]').first();
    const href = normUrl(a.attr("href") || "");
    if (!href || !isKentCategoryUrl(href)) return;

    const title = textClean($li.find("h3").first().text()) || textClean(a.text());
    if (!title) return;

    const img = $li.find("img").first();
    const imageUrl = toAbs(img.attr("src") || "");

    const countTxt = textClean($li.find("mark.count").first().text());
    const count = countTxt ? Number(countTxt.replace(/[^\d]/g, "")) : undefined;

    items.push({ title, href, imageUrl, count });
  });
  return items;
}

function extractPublications($) {
  const items = [];
  $(".porto-posts-grid .porto-tb-item.publication").each((_, el) => {
    const a = $(el).find("h2 a").first();
    const href = normUrl(a.attr("href") || "");
    const title = textClean(a.text());
    if (!title || !href) return;
    items.push({ title, href });
  });
  return items;
}

function extractResources($) {
  const items = [];
  $(".elementor-widget-image-box").each((_, el) => {
    const a = $(el).find("a[href]").first();
    const href = toAbs(a.attr("href") || "");
    const title = textClean($(el).find(".elementor-image-box-title").text()) || textClean(a.text());
    const subtitle = textClean($(el).find(".elementor-image-box-description").text());
    const img = $(el).find("img").first();
    const imageUrl = toAbs(img.attr("src") || "");
    if (!href || !title) return;
    items.push({ title, subtitle, href, imageUrl });
  });
  return items;
}

/**
 * Parse landing blocks from a category page HTML.
 * - Intro: first text-editor widget with h1
 * - For each H2 text-editor widget, collect:
 *   - contentBlockHtml(title=h2, html=its body)
 *   - lookahead widgets within this section for product grids and category grids
 * - Then append publications/resources
 */
function parseLandingContentBlocks(html) {
  const $ = cheerio.load(html, { decodeEntities: false });

  const $main =
    $("#content").length ? $("#content") :
    $(".main-content").length ? $(".main-content") :
    $("main").length ? $("main") :
    $.root();

  removeUnwantedUi($main, $);

  const blocks = [];

  // Intro
  const $firstText = $main.find(".elementor-widget-text-editor").first();
  if ($firstText.length) {
    const h1Text = textClean($firstText.find("h1").first().text());
    const ps = $firstText.find("p").slice(0, 2).toArray().map((p) => $.html(p)).join("");
    const introHtml = `${h1Text ? `<h1>${h1Text}</h1>` : ""}${ps}`;
    if (textClean(cheerio.load(introHtml).text()).length > 30) {
      blocks.push({
        _type: "contentBlockHtml",
        title: h1Text || "Overview",
        html: introHtml,
      });
    }
  }

  // Elementor blocks scan
  const widgets = $main.find(".elementor-element").toArray();

  for (let i = 0; i < widgets.length; i++) {
    const $el = $(widgets[i]);
    const $textWidget = $el.find(".elementor-widget-text-editor").first();

    const h2Text = textClean($textWidget.find("h2").first().text());
    if (!h2Text) continue;
    if (UNWANTED.earlyAccess.test(h2Text)) continue;

    // body html from this widget without the first h2
    const widgetHtml = $textWidget.html() || "";
    const $$ = cheerio.load(widgetHtml, { decodeEntities: false });
    $$("h2").first().remove();
    const bodyHtml = $$.root().html() || "";

    // html block (can be empty marker)
    blocks.push({
      _type: "contentBlockHtml",
      title: h2Text,
      html: bodyHtml,
    });

    // look ahead until next section(h2)
    let j = i + 1;
    while (j < widgets.length) {
      const $next = $(widgets[j]);
      const nextH2 = textClean($next.find(".elementor-widget-text-editor h2").first().text());
      if (nextH2) break;

      // products grid
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

      // categories grid
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

      j++;
      if (j - i > 14) break;
    }
  }

  // Publications/resources (global)
  const pubs = extractPublications($);
  if (pubs.length) {
    blocks.push({
      _type: "contentBlockCards",
      title: "Scientific articles and publications",
      kind: "publication",
      items: pubs,
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

  // Cleanup: drop html blocks that are basically empty AND have no cards right after
  const cleaned = [];
  for (let k = 0; k < blocks.length; k++) {
    const b = blocks[k];
    if (b._type === "contentBlockHtml") {
      const len = roughTextLenFromHtml(b.html || "");
      const next = blocks[k + 1];
      const hasCardsNext = next && next._type === "contentBlockCards" && next.title === b.title;
      if (len < 25 && !hasCardsNext) continue;
    }
    cleaned.push(b);
  }

  // Final: rewrite relative urls, normalize card urls
  for (const b of cleaned) {
    if (b._type === "contentBlockHtml" && b.html) b.html = rewriteRelativeUrls(b.html, BASE);
    if (b._type === "contentBlockCards" && Array.isArray(b.items)) {
      b.items = b.items.map((it) => ({
        ...it,
        href: it.href ? normUrl(it.href) : it.href,
        imageUrl: it.imageUrl ? toAbs(it.imageUrl) : it.imageUrl,
      }));
    }
  }

  return cleaned;
}

function discoverChildCategories(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const $main =
    $("#content").length ? $("#content") :
    $(".main-content").length ? $(".main-content") :
    $("main").length ? $("main") :
    $.root();

  removeUnwantedUi($main, $);

  const urls = [];
  $main.find('li.product-category a[href*="/product/"]').each((_, a) => {
    const u = normUrl($(a).attr("href") || "");
    if (isKentCategoryUrl(u)) urls.push(u);
  });

  const seen = new Set();
  const out = [];
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

async function seedFromMegaMenu(menuUrl) {
  const html = await fetchHtmlCached(menuUrl);
  const $ = cheerio.load(html, { decodeEntities: false });

  const links = [];
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") || "";
    const url = normUrl(href);
    if (!isKentCategoryUrl(url)) return;
    links.push(url);
  });

  const seen = new Set();
  const unique = [];
  for (const u of links) {
    if (seen.has(u)) continue;
    seen.add(u);
    unique.push(u);
  }
  return unique;
}

async function upsertCategory({ url, order = 9999 }) {
  const html = await fetchHtmlCached(url);
  const $ = cheerio.load(html, { decodeEntities: false });
  const { title, summary } = extractTitleAndSummary($);

  const pathArr = urlToPathArr(url);
  const id = pathArrToId(pathArr);

  const contentBlocks = parseLandingContentBlocks(html);

  const doc = {
    _id: id,
    _type: "category",

    // ✅ 라우팅/쿼리에서 잡히도록 보조키들
    themeKey: BRAND_KEY,
    brandSlug: BRAND_KEY,

    title: title || titleCaseFromSlug(pathArr[pathArr.length - 1] || "category"),
    path: pathArr,
    order,
    sourceUrl: url,
    summary: summary || "",
    isActive: true,

    contentBlocks,
  };

  if (DRY) {
    console.log("[DRY] category", id, doc.title, "blocks:", contentBlocks.length);
    return;
  }

  await sanity
    .transaction()
    .createIfNotExists({ _id: id, _type: "category" })
    .patch(id, (p) => p.set(doc))
    .commit({ visibility: "sync" });

  console.log("[OK] category", id, doc.title, "blocks:", contentBlocks.length);
}

async function main() {
  if (!ONLY_CATEGORIES && !ONLY_PRODUCTS) {
    console.log("[INFO] use --onlyCategories (products not implemented in this v5)");
    process.exit(0);
  }

  if (ONLY_PRODUCTS) {
    console.log("[WARN] --onlyProducts not implemented in this v5. Do categories first.");
    process.exit(0);
  }

  if (ONLY_CATEGORIES) {
    if (!MENU_SEED_URL) {
      console.error("[ERR] --menuSeedUrl required.");
      process.exit(1);
    }

    const seedUrl = normUrl(MENU_SEED_URL);
    if (!isKentCategoryUrl(seedUrl)) {
      console.error("[ERR] menuSeedUrl must be a Kent category URL like https://www.kentscientific.com/product/anesthesia/");
      process.exit(1);
    }

    let seed = [];
    if (SEED_SCOPE === "page") {
      seed = [seedUrl];
      console.log("[INFO] seedScope=page => only starting from:", seedUrl);
    } else {
      console.log("[INFO] seedScope=menu => seeding from mega menu of:", seedUrl);
      seed = await seedFromMegaMenu(seedUrl);
      console.log("[INFO] mega seed size:", seed.length);
    }

    const queue = [];
    const orderMap = new Map(); // url -> order
    seed.forEach((u, idx) => {
      queue.push(u);
      orderMap.set(u, idx + 1);
    });

    const visited = new Set();
    let processed = 0;

    while (queue.length) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;
      visited.add(url);

      if (CATEGORY_LIMIT > 0 && processed >= CATEGORY_LIMIT) break;

      const order = orderMap.get(url) ?? 9999;

      const html = await fetchHtmlCached(url);
      await upsertCategory({ url, order });
      processed++;

      // BFS children discovery (thumbnail categories)
      const kids = discoverChildCategories(html);
      for (const k of kids) {
        if (visited.has(k)) continue;
        if (!orderMap.has(k)) orderMap.set(k, 5000 + orderMap.size);
        queue.push(k);
      }
    }

    console.log("[DONE] categories processed:", processed);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});