#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import dotenv from "dotenv";
import * as cheerio from "cheerio";
import { createClient } from "@sanity/client";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const DRY_RUN = process.argv.includes("--dryRun");
const REFRESH = process.argv.includes("--refresh");

const BRAND_KEY = "kent";
const BRAND_TITLE = "Kent Scientific";
const BRAND_BASE = "https://www.kentscientific.com";
const CACHE_DIR = path.join(process.cwd(), ".cache", "kent-category-v22");
const PAGE_CACHE_DIR = path.join(CACHE_DIR, "pages");
const ASSET_CACHE_FILE = path.join(CACHE_DIR, "asset-cache.json");

const ROOT_SEEDS = [
  "anesthesia",
  "laboratory-animal-handling",
  "body-composition-analysis",
  "feeding-needles",
  "mobile-carts",
  "nebulizers",
  "noninvasive-blood-pressure",
  "physiological-monitoring",
  "rodent-identification",
  "surgery",
  "tail-vein-training-materials",
  "tissue-collection",
  "ventilation",
  "warming",
  "warranty",
];

const CATEGORY_TREE = new Map([
  ["anesthesia", [
    "anesthesia/anesthesia-accessories",
    "anesthesia/anesthesia-accessories-for-somnoflo",
    "anesthesia/anesthesia-accessories-for-somnosuite",
    "anesthesia/anesthesia-accessories-for-vetflo",
  ]],
  ["laboratory-animal-handling", [
    "laboratory-animal-handling/animal-holders",
    "laboratory-animal-handling/clippers",
    "laboratory-animal-handling/scales",
  ]],
  ["body-composition-analysis", []],
  ["feeding-needles", []],
  ["mobile-carts", ["mobile-carts/carts"]],
  ["nebulizers", []],
  ["noninvasive-blood-pressure", ["noninvasive-blood-pressure/noninvasive-blood-pressure-accessories"]],
  ["noninvasive-blood-pressure/noninvasive-blood-pressure-accessories", ["noninvasive-blood-pressure/noninvasive-blood-pressure-accessories/accessories-for-coda-monitor"]],
  ["noninvasive-blood-pressure/noninvasive-blood-pressure-accessories/accessories-for-coda-monitor", ["noninvasive-blood-pressure/noninvasive-blood-pressure-accessories/accessories-for-coda-monitor/coda-cuffs"]],
  ["noninvasive-blood-pressure/noninvasive-blood-pressure-accessories/accessories-for-coda-monitor/coda-cuffs", []],
  ["physiological-monitoring", ["physiological-monitoring/physiological-monitoring-accessories"]],
  ["physiological-monitoring/physiological-monitoring-accessories", [
    "physiological-monitoring/physiological-monitoring-accessories/pulse-oximetry",
    "physiological-monitoring/physiological-monitoring-accessories/temperature",
  ]],
  ["physiological-monitoring/physiological-monitoring-accessories/pulse-oximetry", []],
  ["physiological-monitoring/physiological-monitoring-accessories/temperature", []],
  ["rodent-identification", [
    "rodent-identification/ear-tags",
    "rodent-identification/rfid-transponder-system",
  ]],
  ["rodent-identification/ear-tags", []],
  ["rodent-identification/rfid-transponder-system", []],
  ["surgery", [
    "surgery/instrument-cleaning",
    "surgery/surgical-accessories",
    "surgery/surgical-instruments",
  ]],
  ["surgery/instrument-cleaning", []],
  ["surgery/surgical-accessories", ["surgery/surgical-accessories/surgical-accessories-for-surgisuite"]],
  ["surgery/surgical-accessories/surgical-accessories-for-surgisuite", []],
  ["surgery/surgical-instruments", [
    "surgery/surgical-instruments/forceps",
    "surgery/surgical-instruments/laboratory-scissors",
    "surgery/surgical-instruments/needle-holders",
    "surgery/surgical-instruments/surgical-instrument-kits",
    "surgery/surgical-instruments/surgical-tweezers",
    "surgery/surgical-instruments/wound-closure",
  ]],
  ["surgery/surgical-instruments/forceps", [
    "surgery/surgical-instruments/forceps/dressing-forceps",
    "surgery/surgical-instruments/forceps/hemostat-forceps",
  ]],
  ["surgery/surgical-instruments/forceps/dressing-forceps", []],
  ["surgery/surgical-instruments/forceps/hemostat-forceps", []],
  ["surgery/surgical-instruments/laboratory-scissors", ["surgery/surgical-instruments/laboratory-scissors/micro-scissors"]],
  ["surgery/surgical-instruments/laboratory-scissors/micro-scissors", []],
  ["surgery/surgical-instruments/needle-holders", []],
  ["surgery/surgical-instruments/surgical-instrument-kits", []],
  ["surgery/surgical-instruments/surgical-tweezers", []],
  ["surgery/surgical-instruments/wound-closure", [
    "surgery/surgical-instruments/wound-closure/autoclips",
    "surgery/surgical-instruments/wound-closure/bull-dog-clamps",
    "surgery/surgical-instruments/wound-closure/reflex-clips",
  ]],
  ["surgery/surgical-instruments/wound-closure/autoclips", []],
  ["surgery/surgical-instruments/wound-closure/bull-dog-clamps", []],
  ["surgery/surgical-instruments/wound-closure/reflex-clips", []],
  ["tail-vein-training-materials", []],
  ["tissue-collection", [
    "tissue-collection/blood-collection",
    "tissue-collection/brain-matricies",
  ]],
  ["tissue-collection/blood-collection", []],
  ["tissue-collection/brain-matricies", []],
  ["ventilation", ["ventilation/intubation"]],
  ["ventilation/intubation", []],
  ["warming", [
    "warming/warming-pads-blankets",
    "warming/water-recirculators",
  ]],
  ["warming/warming-pads-blankets", []],
  ["warming/water-recirculators", []],
  ["warranty", []],
]);

const FORCED_LANDING = new Set([
  "anesthesia",
  "laboratory-animal-handling",
  "laboratory-animal-handling/animal-holders",
  "noninvasive-blood-pressure",
  "physiological-monitoring",
  "physiological-monitoring/physiological-monitoring-accessories/temperature",
  "rodent-identification",
  "surgery",
  "tissue-collection/brain-matricies",
  "ventilation",
  "ventilation/intubation",
  "warming",
  "warming/warming-pads-blankets",
]);

const OFF_TOPIC_RULES = [
  { paths: ["laboratory-animal-handling", "physiological-monitoring"], containsAny: ["rovent", "ventilator"] },
  { paths: ["physiological-monitoring"], containsAny: ["anesthesia accessories for somnosuite", "anesthesia accessories for somnoflo", "accessories for coda monitor"] },
];

const PROMO_PHRASES = [
  "login to see prices",
  "get your accessories",
  "don't miss",
  "dont miss",
  "optional induction chambers and anesthesia masks are available for purchase",
];

const LAB_HANDLING_OVERRIDE = {
  introHtml: `
    <p class="category-brief">
      Kent Scientific’s animal handling products offer a variety devices to safely immobilize mice, rats and other small animals for research applications.
      <a href="https://www.kentscientific.com/products/animal-handling/#About">Learn more about animal handling…</a>
    </p>
  `,
  categoryCards: [
    {
      title: "Animal Holders",
      childPath: "laboratory-animal-handling/animal-holders",
      count: 6,
      imageUrl: "https://www.kentscientific.com/wp-content/uploads/2025/09/all-holders-3-300x300.png",
    },
    {
      title: "Clippers",
      childPath: "laboratory-animal-handling/clippers",
      count: 3,
      imageUrl: "https://www.kentscientific.com/wp-content/uploads/2025/09/ARCO-SE-clipper-2-300x300.png",
    },
    {
      title: "Scales",
      childPath: "laboratory-animal-handling/scales",
      count: 2,
      imageUrl: "https://www.kentscientific.com/wp-content/uploads/2025/09/W4000-2-300x300.png",
    },
  ],
  aboutHtml: `
    <h2 id="About" class="heading-1">About laboratory animal handling</h2>
    <p>There are several different methods of animal handling. It is important to note that improper handling causes distress and/or pain. Minimal animal handling should be the research objective. Different animals require specific methods of handling.</p>
    <section>
      <h3>Physical restraint</h3>
      <p>Physical restraint is the use of manual or mechanical means to limit some or all of an animal’s movements for the purpose of examination, collection of samples, drug administration, therapy and experimental manipulation. Animals are restrained for brief periods, usually minutes, in most research applications. Restraint devices should be suitable in size, design, and operation to minimize discomfort and injury to the animal. Restraint devices are never permanent animal housing.</p>
    </section>
    <section>
      <h3>Short term restraint</h3>
      <p>Short term restraint of laboratory animals involve animal confinement in a standard restraining device, appropriate for the species, for brief periods. Purposes include drawing blood, giving injections and examining the animal.</p>
    </section>
    <section>
      <h3>Prolonged restraint</h3>
      <p>If prolonged physical restraint is required, animals should be conditioned over a period of gradually increasing time. Certain experiments, such as NIBP measurements, require animal conditioning to reduce the level of stress thereby obtaining optimal readings.</p>
    </section>
    <p><strong><em>Note:</em></strong> <em>For the comfort and safety of the animal, certain kinds of restraint equipment, such as jackets or harnesses, should be periodically monitored for proper fit. Animals in chairs and slings require closer monitoring than those restrained by tethering jackets or harnesses. Kent Scientific offers a wide variety of animal restraint devices.</em></p>
  `,
};

const REQUIRED_ENV = {
  projectId:
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
    process.env.SANITY_STUDIO_PROJECT_ID ||
    process.env.SANITY_PROJECT_ID,
  dataset:
    process.env.NEXT_PUBLIC_SANITY_DATASET ||
    process.env.SANITY_STUDIO_DATASET ||
    process.env.SANITY_DATASET,
  token:
    process.env.SANITY_API_TOKEN ||
    process.env.SANITY_WRITE_TOKEN ||
    process.env.SANITY_TOKEN,
};

if (!REQUIRED_ENV.projectId || !REQUIRED_ENV.dataset || !REQUIRED_ENV.token) {
  console.error("Missing Sanity env.");
  console.error("Required:");
  console.error("- NEXT_PUBLIC_SANITY_PROJECT_ID (or SANITY_STUDIO_PROJECT_ID / SANITY_PROJECT_ID)");
  console.error("- NEXT_PUBLIC_SANITY_DATASET (or SANITY_STUDIO_DATASET / SANITY_DATASET)");
  console.error("- SANITY_API_TOKEN (or SANITY_WRITE_TOKEN / SANITY_TOKEN)");
  process.exit(1);
}

fs.mkdirSync(PAGE_CACHE_DIR, { recursive: true });

const sanity = createClient({
  projectId: REQUIRED_ENV.projectId,
  dataset: REQUIRED_ENV.dataset,
  token: REQUIRED_ENV.token,
  apiVersion: "2025-02-19",
  useCdn: false,
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(text) {
  return stripTags(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

function ensureAbs(url) {
  if (!url) return "";
  const raw = String(url).trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `${BRAND_BASE}${raw}`;
  return raw;
}

function normalizeCategoryPath(pathStr) {
  const pathOnly = String(pathStr || "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/^product\//i, "")
    .replace(/\/+$/g, "")
    .replace(/\?.*$/g, "")
    .replace(/#.*$/g, "")
    .replace(/\/page\/\d+$/i, "");

  let segments = pathOnly
    .split("/")
    .map((seg) => seg.trim())
    .filter(Boolean);

  if (
    segments[0] === "anesthesia" &&
    segments[1] === "anesthesia-accessories" &&
    /^anesthesia-accessories-for-/i.test(segments[2] || "")
  ) {
    segments = [segments[0], segments[2]];
  }

  return segments.join("/");
}

function categoryPathToUrl(pathStr) {
  return `${BRAND_BASE}/product/${pathStr.replace(/^\/+|\/+$/g, "")}/`;
}

function categoryPathToInternal(pathStr) {
  return `/products/${BRAND_KEY}/${pathStr.replace(/^\/+|\/+$/g, "")}`;
}

function productUrlToSlug(url) {
  const abs = ensureAbs(url);
  const noHash = abs.replace(/#.*$/, "").replace(/\?.*$/, "").replace(/\/+$/, "");
  const match = noHash.match(/\/products\/([^/]+)$/i);
  return match?.[1] ? match[1].trim() : "";
}

function productUrlToInternal(url) {
  const slug = productUrlToSlug(url);
  return slug ? `/products/${BRAND_KEY}/item/${slug}` : "";
}

function isCategoryUrl(url) {
  return /^https?:\/\/www\.kentscientific\.com\/product\//i.test(ensureAbs(url));
}

function isProductUrl(url) {
  return /^https?:\/\/www\.kentscientific\.com\/products\//i.test(ensureAbs(url));
}

function titleFromPath(pathStr) {
  return pathStr
    .split("/")
    .filter(Boolean)
    .map((seg) =>
      seg
        .replace(/-/g, " ")
        .replace(/\b[a-z]/g, (c) => c.toUpperCase()),
    )
    .join(" / ");
}

function stableKey(value) {
  return crypto.createHash("md5").update(String(value || "")).digest("hex").slice(0, 12);
}

function htmlFragmentToString(nodeOrHtml, $ = null) {
  if (typeof nodeOrHtml === "string") return nodeOrHtml.trim();
  if ($ && typeof $.html === "function") return $.html(nodeOrHtml).trim();
  if (nodeOrHtml && nodeOrHtml.cheerio && typeof nodeOrHtml.toString === "function") {
    return nodeOrHtml.toString().trim();
  }
  return String(nodeOrHtml || "").trim();
}

function loadAssetCache() {
  try {
    return JSON.parse(fs.readFileSync(ASSET_CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveAssetCache(cache) {
  fs.mkdirSync(path.dirname(ASSET_CACHE_FILE), { recursive: true });
  fs.writeFileSync(ASSET_CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
}

const assetCache = loadAssetCache();

async function fetchWithCache(url, { kind = "page", refresh = false } = {}) {
  const key = stableKey(url);
  const ext = kind === "binary" ? ".bin" : ".html";
  const file = path.join(PAGE_CACHE_DIR, `${key}${ext}`);

  if (!refresh && fs.existsSync(file)) {
    return fs.readFileSync(file);
  }

  const headers = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    accept:
      kind === "binary"
        ? "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        : "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9,ko;q=0.8",
    referer: BRAND_BASE,
    "cache-control": "no-cache",
    pragma: "no-cache",
  };

  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(file, buf);
      await sleep(250 + attempt * 250);
      return buf;
    } catch (err) {
      lastErr = err;
      await sleep(500 + attempt * 400);
    }
  }

  if (fs.existsSync(file)) return fs.readFileSync(file);
  throw lastErr;
}

async function fetchPageHtml(url) {
  const buf = await fetchWithCache(url, { kind: "page", refresh: REFRESH });
  return buf.toString("utf8");
}

async function uploadImageToSanity(imageUrl) {
  const abs = ensureAbs(imageUrl);
  if (!abs) return { imageUrl: "", image: undefined };

  if (DRY_RUN) {
    return { imageUrl: abs, image: undefined };
  }

  if (assetCache[abs]?.assetId && assetCache[abs]?.url) {
    return {
      imageUrl: assetCache[abs].url,
      image: {
        _type: "image",
        asset: { _type: "reference", _ref: assetCache[abs].assetId },
      },
    };
  }

  const buf = await fetchWithCache(abs, { kind: "binary", refresh: REFRESH });
  const filename = path.basename(new URL(abs).pathname) || `${stableKey(abs)}.jpg`;
  const contentType =
    filename.endsWith(".png")
      ? "image/png"
      : filename.endsWith(".webp")
        ? "image/webp"
        : filename.endsWith(".svg")
          ? "image/svg+xml"
          : "image/jpeg";

  const asset = await sanity.assets.upload("image", buf, {
    filename,
    contentType,
  });

  assetCache[abs] = { assetId: asset._id, url: asset.url };
  saveAssetCache(assetCache);

  return {
    imageUrl: asset.url,
    image: {
      _type: "image",
      asset: { _type: "reference", _ref: asset._id },
    },
  };
}

function splitHeadingAndBody(html) {
  const $ = cheerio.load(`<div id="root">${html || ""}</div>`);
  const root = $("#root");
  const firstHeading = root.children("h2,h3,h4").first();
  let title = "";
  if (firstHeading.length) {
    title = stripTags(firstHeading.text());
    firstHeading.remove();
  }
  return { title, html: root.html()?.trim() || "" };
}

function shouldSkipByText(currentPath, text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  if (PROMO_PHRASES.some((phrase) => normalized.includes(phrase))) {
    return true;
  }

  for (const rule of OFF_TOPIC_RULES) {
    if (rule.paths.includes(currentPath) && rule.containsAny.some((token) => normalized.includes(token))) {
      return true;
    }
  }

  return false;
}

function blockTitleFromText(text, fallback = "") {
  const clean = decodeHtmlEntities(stripTags(text));
  return clean || fallback;
}

function makeHtmlBlock(title, html, keyHint) {
  const body = String(html || "").trim();
  if (!stripTags(body)) return null;

  return {
    _key: `html-${stableKey(`${keyHint}|${title}|${body}`)}`,
    _type: "contentBlockHtml",
    title: title || undefined,
    html: body,
  };
}

function makeCardsBlock(kind, title, items, keyHint) {
  const cleaned = (items || []).filter(Boolean);
  if (!cleaned.length) return null;
  return {
    _key: `cards-${stableKey(`${keyHint}|${kind}|${title}|${cleaned.length}`)}`,
    _type: "contentBlockCards",
    kind,
    title: title || undefined,
    items: cleaned,
  };
}

function makeCardItem({ title, subtitle, href, imageUrl, image, count, sku }) {
  const item = {
    _key: `item-${stableKey(`${title}|${href}|${sku || ""}`)}`,
    title: title || undefined,
    subtitle: subtitle || undefined,
    href: href || undefined,
    imageUrl: imageUrl || undefined,
    count: Number.isFinite(count) ? count : undefined,
    sku: sku || undefined,
  };
  if (image) item.image = image;
  return item;
}

function uniqueBy(items, keyFn) {
  const out = [];
  const seen = new Set();
  for (const item of items || []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function orderBlocks(blocks) {
  return (blocks || []).filter(Boolean);
}

function getScopedRoot($) {
  const candidates = ["#primary", "#content", "#main"];
  for (const selector of candidates) {
    const node = $(selector).first();
    if (node.length) return node;
  }
  return $.root();
}

function hasCardsBlock(blocks, kind) {
  return (blocks || []).some((b) => b?._type === "contentBlockCards" && b?.kind === kind && (b.items || []).length);
}

async function buildLabHandlingOverrideCards() {
  const items = [];

  for (const card of LAB_HANDLING_OVERRIDE.categoryCards) {
    const uploaded = await uploadImageToSanity(card.imageUrl);
    items.push(
      makeCardItem({
        title: card.title,
        href: categoryPathToInternal(card.childPath),
        imageUrl: uploaded.imageUrl,
        image: uploaded.image,
        count: Number.isFinite(card.count) ? card.count : undefined,
      }),
    );
  }

  return items;
}

async function extractLaboratoryAnimalHandlingBlocks() {
  const categoryItems = await buildLabHandlingOverrideCards();

  return orderBlocks([
    makeHtmlBlock("", LAB_HANDLING_OVERRIDE.introHtml, "laboratory-animal-handling|intro-override"),
    makeCardsBlock("category", "", categoryItems, "laboratory-animal-handling|cats-override"),
    makeHtmlBlock("About laboratory animal handling", LAB_HANDLING_OVERRIDE.aboutHtml, "laboratory-animal-handling|about-override"),
  ]);
}

async function applyPathSpecificLandingFallbacks(currentPath, $, area, blocks) {
  if (currentPath === "warming/warming-pads-blankets") {
    if (!hasCardsBlock(blocks, "product")) {
      const items = [];
      area.find("li.product-col.product").each((_i, li) => {
        const $li = $(li);
        const hrefAbs = ensureAbs(
          $li.find(".product-loop-title").attr("href") || $li.find(".product-image a").attr("href"),
        );
        if (!isProductUrl(hrefAbs)) return;

        const title =
          stripTags($li.find(".woocommerce-loop-product__title").first().text()) ||
          stripTags($li.find("h3").first().text());

        const subtitle = stripTags($li.find(".product-short-description").html() || "");
        const imageSrc =
          $li.find(".product-image img").attr("src") || $li.find(".product-image img").attr("data-src") || "";

        items.push({ hrefAbs, title, subtitle, imageSrc });
      });

      const uploadedItems = [];
      for (const item of uniqueBy(items, (it) => `${it.hrefAbs}|${it.title}`)) {
        const uploaded = await uploadImageToSanity(item.imageSrc);
        uploadedItems.push(
          makeCardItem({
            title: item.title,
            subtitle: item.subtitle,
            href: productUrlToInternal(item.hrefAbs),
            imageUrl: uploaded.imageUrl,
            image: uploaded.image,
          }),
        );
      }

      const blk = makeCardsBlock("product", "", uploadedItems, `${currentPath}|product-explicit`);
      if (blk) blocks.unshift(blk);
    }
  }

  return blocks;
}

async function extractLandingBlocks(currentPath, html) {
  const $ = cheerio.load(html);
  const area = getScopedRoot($);

  if (currentPath === "laboratory-animal-handling") {
    return extractLaboratoryAnimalHandlingBlocks();
  }

  const blocks = [];
  let pendingTitle = "";
  const directChildren = new Set(CATEGORY_TREE.get(currentPath) || []);
  const seenBlockKeys = new Set();

  const excludedClosest =
    "header, footer, nav, aside, .shop-loop-before, .shop-loop-after, .archive-products, .woocommerce-pagination, .woocommerce-ordering, .porto-product-filters, .widget_product_categories, .widget_layered_nav, .woocommerce-viewing, .gridlist-toggle";

  function pushBlock(block) {
    if (!block) return;
    const key = `${block._type}|${block.kind || ""}|${block.title || ""}|${stripTags(block.html || "").slice(0, 120)}|${(block.items || []).length}`;
    if (seenBlockKeys.has(key)) return;
    seenBlockKeys.add(key);
    blocks.push(block);
  }

  const widgetNodes = area.find("[data-element_type='widget']").toArray();

  for (const node of widgetNodes) {
    const $node = $(node);
    if ($node.closest(excludedClosest).length) continue;

    const widgetType = String($node.attr("data-widget_type") || "").trim();
    const nodeHtml = htmlFragmentToString($node, $);
    const nodeText = stripTags(nodeHtml);
    if (!nodeText) continue;
    if (shouldSkipByText(currentPath, nodeText)) continue;

    if (/heading\.default/i.test(widgetType)) {
      const title = blockTitleFromText($node.text());
      if (title) pendingTitle = title;
      continue;
    }

    if (/text-editor\.default/i.test(widgetType)) {
      const hasH1 = $node.find("h1").length > 0;
      const hasSectionHeading = $node.find("h2,h3,h4").length > 0;

      if (hasH1) {
        const introRoot = cheerio.load(`<div id="root">${nodeHtml}</div>`);
        introRoot("#root h1").first().remove();
        const introHtml = introRoot("#root").html()?.trim() || "";
        if (stripTags(introHtml)) {
          pushBlock(makeHtmlBlock("", introHtml, `${currentPath}|intro`));
        }
        pendingTitle = "";
        continue;
      }

      if (hasSectionHeading) {
        const { title, html: bodyHtml } = splitHeadingAndBody(nodeHtml);
        if (stripTags(bodyHtml || nodeHtml)) {
          pushBlock(
            makeHtmlBlock(
              title || pendingTitle || "",
              bodyHtml || nodeHtml,
              `${currentPath}|text-heading|${title || pendingTitle || ""}`,
            ),
          );
        }
        pendingTitle = "";
        continue;
      }

      if (pendingTitle && stripTags(nodeHtml).length >= 30) {
        pushBlock(makeHtmlBlock(pendingTitle, nodeHtml, `${currentPath}|pending-text|${pendingTitle}`));
        pendingTitle = "";
        continue;
      }

      if (stripTags(nodeHtml).length >= 120 && !/login to see prices/i.test(nodeText)) {
        pushBlock(makeHtmlBlock("", nodeHtml, `${currentPath}|loose-text`));
      }
      continue;
    }

    if (/wc-categories\.default/i.test(widgetType)) {
      const items = [];
      $node.find("li.product-category").each((_i, li) => {
        const $li = $(li);
        const hrefAbs = ensureAbs($li.find("a").attr("href"));
        if (!isCategoryUrl(hrefAbs)) return;

        const childPath = normalizeCategoryPath(hrefAbs);
        if (!childPath || childPath === currentPath || !directChildren.has(childPath)) return;

        const title =
          stripTags($li.find(".thumb-info-inner").first().text()) ||
          stripTags($li.find("h3").first().text()) ||
          titleFromPath(childPath);

        const countText = stripTags($li.find(".count").first().text());
        const count = Number.parseInt(countText, 10);
        const imageSrc = $li.find("img").attr("src") || $li.find("img").attr("data-src") || "";
        items.push({ title, href: childPath, count, imageSrc });
      });

      const deduped = uniqueBy(items, (item) => `${item.href}|${item.title}`);
      const uploadedItems = [];
      for (const item of deduped) {
        const uploaded = await uploadImageToSanity(item.imageSrc);
        uploadedItems.push(
          makeCardItem({
            title: item.title,
            href: categoryPathToInternal(item.href),
            imageUrl: uploaded.imageUrl,
            image: uploaded.image,
            count: Number.isFinite(item.count) ? item.count : undefined,
          }),
        );
      }

      if (uploadedItems.length) {
        pushBlock(makeCardsBlock("category", pendingTitle || "", uploadedItems, `${currentPath}|cats`));
      }
      pendingTitle = "";
      continue;
    }

    if (/woocommerce-products\.default/i.test(widgetType)) {
      const items = [];
      $node.find("li.product-col.product").each((_i, li) => {
        const $li = $(li);
        const hrefAbs = ensureAbs(
          $li.find(".product-loop-title").attr("href") || $li.find(".product-image a").attr("href"),
        );
        if (!isProductUrl(hrefAbs)) return;

        const title =
          stripTags($li.find(".woocommerce-loop-product__title").first().text()) ||
          stripTags($li.find("h3").first().text());

        const subtitle = stripTags($li.find(".product-short-description").html() || "");
        const imageSrc =
          $li.find(".product-image img").attr("src") || $li.find(".product-image img").attr("data-src") || "";

        const gtmJson = $li.find(".gtm4wp_productdata").attr("data-gtm4wp_product_data") || "";
        let sku = "";
        if (gtmJson) {
          try {
            const parsed = JSON.parse(gtmJson);
            sku = String(parsed.sku || parsed.item_id || parsed.id || "").trim();
          } catch {}
        }

        items.push({ title, subtitle, hrefAbs, imageSrc, sku });
      });

      const deduped = uniqueBy(items, (item) => `${item.hrefAbs}|${item.title}|${item.sku || ""}`);
      const uploadedItems = [];
      for (const item of deduped) {
        const uploaded = await uploadImageToSanity(item.imageSrc);
        uploadedItems.push(
          makeCardItem({
            title: item.title,
            subtitle: item.subtitle,
            href: productUrlToInternal(item.hrefAbs),
            imageUrl: uploaded.imageUrl,
            image: uploaded.image,
            sku: item.sku,
          }),
        );
      }

      if (uploadedItems.length) {
        pushBlock(
          makeCardsBlock("product", pendingTitle || "", uploadedItems, `${currentPath}|prods|${pendingTitle}`),
        );
      }
      pendingTitle = "";
      continue;
    }
  }

  if (!blocks.some((b) => b?.kind === "category") && directChildren.size) {
    const fallbackItems = [...directChildren].map((childPath) =>
      makeCardItem({
        title: titleFromPath(childPath),
        href: categoryPathToInternal(childPath),
      }),
    );
    pushBlock(makeCardsBlock("category", "", fallbackItems, `${currentPath}|cats-fallback`));
  }

  await applyPathSpecificLandingFallbacks(currentPath, $, area, blocks);
  return orderBlocks(blocks);
}

function extractListingSummary(html) {
  const $ = cheerio.load(html);
  const termHtml = $(".term-description").first().html()?.trim() || "";
  return stripTags(termHtml) || "";
}

function extractProductLinksFromPage(html) {
  const $ = cheerio.load(html);
  const root = getScopedRoot($);
  const productUrls = new Set();

  root
    .find(".archive-products .product-col.product a[href], #archive-product-block .product-col.product a[href], .elementor-widget-woocommerce-products .product-col.product a[href]")
    .each((_i, el) => {
      const href = ensureAbs($(el).attr("href"));
      if (isProductUrl(href)) productUrls.add(href);
    });

  return [...productUrls];
}

function extractChildCategoryPaths(_html, currentPath) {
  return [...(CATEGORY_TREE.get(currentPath) || [])];
}

function extractTitleAndSummary(html, currentPath) {
  const $ = cheerio.load(html);
  const root = getScopedRoot($);
  const h1 = stripTags(root.find("h1").first().text()) || titleFromPath(currentPath);
  let summary = "";

  const firstTextEditor = root
    .find(".elementor-widget-text-editor")
    .filter((_i, el) => $(el).find("h1").length > 0)
    .first();

  if (firstTextEditor.length) {
    const clone = cheerio.load(`<div id="root">${firstTextEditor.html() || ""}</div>`);
    clone("#root h1").remove();
    const p = clone("#root p").first().html() || "";
    summary = stripTags(p);
  }

  if (!summary && currentPath === "laboratory-animal-handling") {
    summary = stripTags(LAB_HANDLING_OVERRIDE.introHtml);
  }

  if (!summary) summary = extractListingSummary(html);
  return { title: h1, summary };
}

function makeDocId(pathStr) {
  return `cat_kent__${pathStr.replace(/\//g, "__")}`;
}

async function getBrandId() {
  return sanity.fetch(
    `*[_type=="brand" && (themeKey==$brandKey || slug.current==$brandKey)][0]._id`,
    { brandKey: BRAND_KEY },
  );
}

async function getExistingCategories() {
  return sanity.fetch(
    `*[_type=="category" && (
      brand->themeKey==$brandKey ||
      brand->slug.current==$brandKey ||
      themeKey==$brandKey ||
      brandSlug==$brandKey
    )]{
      _id,
      title,
      path,
      pageType
    }`,
    { brandKey: BRAND_KEY },
  );
}

async function patchCategory(docId, patch) {
  if (DRY_RUN) return;
  await sanity.createOrReplace({ _id: docId, ...patch });
}

function cleanLegacyHtml(html) {
  const $ = cheerio.load(html);
  $(".price, .elementor-widget-call-to-action, style, script, noscript").remove();
  $("a:contains('Login to see prices')").remove();
  return $("#main").html()?.trim() || html.trim();
}

async function buildCategoryRecord(pathStr) {
  const url = categoryPathToUrl(pathStr);
  const html = await fetchPageHtml(url);
  const { title, summary } = extractTitleAndSummary(html, pathStr);
  const childPaths = extractChildCategoryPaths(html, pathStr);
  const productLinks = extractProductLinksFromPage(html);
  const pageType = FORCED_LANDING.has(pathStr) ? "landing" : "listing";
  const reason = FORCED_LANDING.has(pathStr) ? "forced-landing" : `product-links:${productLinks.length}`;

  let blocks = [];
  if (pageType === "landing") {
    blocks = await extractLandingBlocks(pathStr, html);
  } else {
    const listingSummary = extractListingSummary(html);
    if (listingSummary) {
      const summaryBlock = makeHtmlBlock("", `<p>${listingSummary}</p>`, `${pathStr}|listing-summary`);
      if (summaryBlock) blocks.push(summaryBlock);
    }
  }

  return {
    pathStr,
    title,
    summary,
    pageType,
    reason,
    childPaths,
    productLinks,
    blocks: orderBlocks(blocks),
    legacyHtml: cleanLegacyHtml(html),
    sourceUrl: url,
  };
}

async function main() {
  console.log(`[INFO] existing kent docs: categories=${(await getExistingCategories()).length}`);
  console.log(`[INFO] brand=${BRAND_TITLE} seedScope=fixed seedCategories=${ROOT_SEEDS.length} createMissing=yes`);
  console.log(`[INFO] forced landing paths=${FORCED_LANDING.size}`);
  console.log(`[INFO] cacheDir=${path.relative(process.cwd(), CACHE_DIR)}`);

  const brandId = await getBrandId();
  if (!brandId) {
    throw new Error(`Kent brand not found for ${BRAND_KEY}`);
  }

  const queue = [...ROOT_SEEDS];
  const seen = new Set();
  const records = [];
  const orderMap = new Map(ROOT_SEEDS.map((p, i) => [p, i + 1]));

  while (queue.length) {
    const currentPath = normalizeCategoryPath(queue.shift());
    if (!currentPath || seen.has(currentPath)) continue;
    seen.add(currentPath);

    if (currentPath === "anesthesia") {
      const html = await fetchPageHtml(categoryPathToUrl(currentPath));
      const childPaths = extractChildCategoryPaths(html, currentPath);
      const productLinks = extractProductLinksFromPage(html);
      console.log(
        `[SKIP] category anesthesia anesthesia main preserved children=${childPaths.length} products=${productLinks.length}`,
      );
      for (const child of childPaths) {
        if (!orderMap.has(child)) orderMap.set(child, orderMap.size + 1);
        queue.push(child);
      }
      continue;
    }

    const record = await buildCategoryRecord(currentPath);
    records.push(record);

    const action = DRY_RUN ? "DRY" : "OK";
    console.log(
      `[${action}] category ${record.pathStr} ${record.title} blocks=${record.blocks.length} children=${record.childPaths.length} products=${record.productLinks.length} pageType=${record.pageType} reason=${record.reason}`,
    );

    for (const child of record.childPaths) {
      if (!orderMap.has(child)) orderMap.set(child, orderMap.size + 1);
      queue.push(child);
    }
  }

  for (const record of records) {
    const docId = makeDocId(record.pathStr);
    const patch = {
      _id: docId,
      _type: "category",
      title: record.title,
      path: record.pathStr.split("/"),
      summary: record.summary || undefined,
      pageType: record.pageType,
      sourceUrl: record.sourceUrl,
      legacyHtml: record.legacyHtml,
      contentBlocks: record.blocks,
      brand: { _type: "reference", _ref: brandId },
      brandSlug: BRAND_KEY,
      themeKey: BRAND_KEY,
      isActive: true,
      order: orderMap.get(record.pathStr) || 9999,
    };
    await patchCategory(docId, patch);
  }

  console.log(`[DONE] categories processed=${records.length}`);
  console.log("[DONE] category-only mode: product migration was not touched");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});