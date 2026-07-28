#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@sanity/client";
import * as cheerio from "cheerio";
import dotenv from "dotenv";

const root = process.cwd();
dotenv.config({ path: path.join(root, ".env.local") });

const args = process.argv.slice(2);
const argValue = (name, fallback = "") => {
  const exact = args.find((arg) => arg.startsWith(`${name}=`));
  return exact ? exact.slice(name.length + 1) : fallback;
};
const refresh = args.includes("--refresh");
const offline = args.includes("--offline");
const onlySlug = argValue("--slug").trim().toLowerCase();
const limit = Number(argValue("--limit", "0")) || 0;
const delayMs = Math.max(1000, Number(argValue("--delay", "1600")) || 1600);

const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.SANITY_STUDIO_PROJECT_ID ||
  process.env.SANITY_PROJECT_ID;
const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_STUDIO_DATASET ||
  process.env.SANITY_DATASET;

if (!projectId || !dataset) {
  console.error("Missing Sanity project ID or dataset in .env.local.");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  apiVersion: "2025-02-19",
  useCdn: false,
});

const QUERY = `*[
  _type == "product"
  && coalesce(brandSlug, themeKey, brand->slug.current, brand->themeKey) == "kent"
] | order(slug.current asc) {
  _id,
  title,
  "slug": slug.current,
  summary,
  sku,
  sourceUrl,
  productType,
  sourceIntroHtml,
  overviewHtml,
  extraHtml,
  legacyHtml,
  specsHtml,
  datasheetHtml,
  documentsHtml,
  faqsHtml,
  referencesHtml,
  reviewsHtml,
  kentSections,
  optionGroups[]{ key, name, label, options[]{ value, label } },
  variants[]{ variantId, title, sku, catNo, optionSummary, optionValues, attributes, imageUrl },
  imageUrls,
  galleryImageUrls,
  "uploadedImages": images[]{ "url": asset->url }
}`;

const CACHE_DIR = path.join(root, ".cache", "kent-official-fidelity", "http");
const OUT_DIR = path.join(root, ".cache", "kent-official-fidelity");
fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const PRICE_RE = /(?:[$€£¥₩]\s*\d[\d,.]*|(?:USD|EUR|GBP|JPY|KRW)\s*\d[\d,.]*|\d[\d,.]*\s*(?:USD|EUR|GBP|JPY|KRW|원)|\bno charge\b)/i;
const COMMERCE_RE = /login to see prices|sign in for pricing|add to cart|choose your option|quantity|calculate your savings|saved\s*\/\s*hour|annual calibration cost/i;
const SUPPORT_RE = /need help with your order|help\s*&\s*support|we(?:'|’)?re here for you|chat with an expert|ask for support|we reply fast|call 888-572-8887/i;
const WARRANTY_TERMS_RE = /coverage period|loaner equipment|expedited repairs|parts\s*&\s*labor|warranty repairs|onsite installation/i;
const WARRANTY_COLUMNS_RE = /\bstandard\b[\s\S]{0,200}\bextended\b[\s\S]{0,200}\bpremium\b/i;

function clean(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textOnly(value) {
  return clean(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function signature(value) {
  return textOnly(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(value) {
  return signature(value)
    .replace(/\bkent scientific(?: corporation)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSku(value) {
  return clean(value).toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9._/-]/g, "");
}

function canonicalSourceUrl(product) {
  const raw = clean(product.sourceUrl);
  if (raw) {
    try {
      const url = new URL(raw);
      if (/(^|\.)kentscientific\.com$/i.test(url.hostname)) {
        url.protocol = "https:";
        url.hostname = "www.kentscientific.com";
        url.hash = "";
        url.search = "";
        if (!url.pathname.endsWith("/")) url.pathname += "/";
        return url.toString();
      }
    } catch {
      // Fall through to canonical slug URL.
    }
  }
  return product.slug ? `https://www.kentscientific.com/products/${product.slug}/` : "";
}

function cachePathFor(url) {
  const hash = crypto.createHash("sha1").update(url).digest("hex");
  return path.join(CACHE_DIR, `${hash}.json`);
}

let nextRequestAt = 0;
async function fetchOfficial(url) {
  const cachePath = cachePathFor(url);
  if (!refresh && fs.existsSync(cachePath)) {
    try {
      return JSON.parse(fs.readFileSync(cachePath, "utf8"));
    } catch {
      // Ignore corrupt cache and refetch unless offline.
    }
  }
  if (offline) {
    return { requestedUrl: url, finalUrl: url, status: 0, ok: false, text: "", error: "cache_miss_offline" };
  }

  const wait = Math.max(0, nextRequestAt - Date.now());
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  nextRequestAt = Date.now() + delayMs;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let result;
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; ITS-BIO-Kent-Verification/1.0; +https://www.itsbio.co.kr)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
      },
    });
    const text = await response.text();
    result = {
      requestedUrl: url,
      finalUrl: response.url || url,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get("content-type") || "",
      text,
      error: response.ok ? "" : `${response.status} ${response.statusText}`,
    };
  } catch (error) {
    result = {
      requestedUrl: url,
      finalUrl: url,
      status: 0,
      ok: false,
      contentType: "",
      text: "",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }

  fs.writeFileSync(cachePath, JSON.stringify(result), "utf8");
  return result;
}

function firstUsefulText(values) {
  return values.map(textOnly).find((value) => value.length >= 2) || "";
}

function officialProductData(html, finalUrl) {
  const $ = cheerio.load(html || "");
  const root = $("main").first().length ? $("main").first() : $("body");
  root.find("script,style,noscript,form,input,button,select,option").remove();

  const title = firstUsefulText([
    $("h1.product_title").first().text(),
    $(".product_title").first().text(),
    root.find("h1").first().text(),
    root.find("h2").first().text(),
    $("title").text().replace(/\s*[|–—]\s*Kent Scientific.*$/i, ""),
  ]);

  const summaryNode = $(".summary.entry-summary").first().length
    ? $(".summary.entry-summary").first()
    : $(".woocommerce-product-details__short-description").first().parent();
  const summaryText = textOnly(summaryNode.text());
  const pageText = textOnly(root.text());
  const itemMatch = pageText.match(/\bItem\s*#\s*[:#]?\s*([A-Z0-9][A-Z0-9._/-]*)/i);
  const categoryMatch = pageText.match(/\bCategory\s*:\s*([^\n]+?)(?=\s+(?:Tag|Somno|The|Every|Customers|What|Need|$))/i);

  const subtitleCandidates = [
    summaryNode.find("h2,h3").first().text(),
    $(".product-subtitle,.subtitle,.product-tagline").first().text(),
  ];
  const subtitle = firstUsefulText(subtitleCandidates).replace(/^Login to see prices$/i, "");

  const introParagraphs = [];
  const introSeen = new Set();
  const introScopes = [
    $(".woocommerce-product-details__short-description").first(),
    summaryNode,
  ];
  for (const scope of introScopes) {
    scope.find("p").each((_index, node) => {
      const value = textOnly($(node).text());
      const key = signature(value);
      if (!value || value.length < 25 || introSeen.has(key)) return;
      if (PRICE_RE.test(value) || COMMERCE_RE.test(value) || SUPPORT_RE.test(value)) return;
      if (/^(?:item|category|tag)\s*#/i.test(value)) return;
      introSeen.add(key);
      introParagraphs.push(value);
    });
    if (introParagraphs.length) break;
  }

  const galleryImages = [];
  const imageSeen = new Set();
  $(".woocommerce-product-gallery img, .woocommerce-product-gallery__wrapper img, figure.woocommerce-product-gallery img").each((_index, node) => {
    const element = $(node);
    const url = clean(element.attr("data-large_image") || element.attr("data-src") || element.attr("src"));
    if (!url || /logo|icon|badge|avatar|testimonial|support|faq|newsletter/i.test(url)) return;
    let key = url;
    try {
      const parsed = new URL(url, finalUrl);
      key = parsed.pathname.replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+$)/i, "").toLowerCase();
    } catch {
      key = url.toLowerCase();
    }
    if (imageSeen.has(key)) return;
    imageSeen.add(key);
    galleryImages.push(url);
  });

  const headings = [];
  const headingSeen = new Set();
  root.find("h2,h3").each((_index, node) => {
    const value = textOnly($(node).text());
    const key = signature(value);
    if (!value || value.length > 180 || headingSeen.has(key)) return;
    if (normalizeTitle(value) === normalizeTitle(title)) return;
    if (/customers who viewed this item also viewed/i.test(value)) {
      headings.push(value);
      headingSeen.add(key);
      return;
    }
    if (SUPPORT_RE.test(value) || COMMERCE_RE.test(value)) return;
    if (/how much could you save|calculate your savings|estimated yearly operational savings|newsletter|get early access/i.test(value)) return;
    headingSeen.add(key);
    headings.push(value);
  });

  const optionLabels = [];
  const optionSeen = new Set();
  $("table.variations select option, .variations select option").each((_index, node) => {
    const value = textOnly($(node).text());
    const key = signature(value);
    if (!value || /^choose an option$/i.test(value) || optionSeen.has(key)) return;
    optionSeen.add(key);
    optionLabels.push(value);
  });

  const tables = [];
  root.find("table").each((_index, node) => {
    const value = textOnly($(node).text());
    if (!value) return;
    tables.push({
      text: value,
      warrantyLike: WARRANTY_COLUMNS_RE.test(value) && WARRANTY_TERMS_RE.test(value),
      priceLike: PRICE_RE.test(value),
    });
  });

  const category = categoryMatch?.[1] ? clean(categoryMatch[1]) : "";
  const warrantyProduct = /(?:^|\b)warranty(?:\b|\s*-)/i.test(title) || /\/product-category\/warranty\//i.test(finalUrl);

  return {
    title,
    subtitle,
    sku: itemMatch?.[1] || "",
    category,
    introParagraphs,
    galleryImages,
    headings,
    optionLabels,
    tables,
    pageText,
    warrantyProduct,
  };
}

function sourceHtml(product) {
  return [
    product.sourceIntroHtml,
    product.overviewHtml,
    product.extraHtml,
    product.legacyHtml,
    product.specsHtml,
    product.datasheetHtml,
    product.documentsHtml,
    product.faqsHtml,
    product.referencesHtml,
    product.reviewsHtml,
  ]
    .filter(Boolean)
    .join("\n");
}

function localSections(product) {
  const rows = Array.isArray(product.kentSections) ? product.kentSections : [];
  return rows
    .map((section) => ({
      title: clean(section?.title),
      type: clean(section?.type || section?.kind || section?._type),
      text: textOnly(section?.html || section?.contentHtml || section?.bodyHtml || section?.description || ""),
    }))
    .filter((section) => section.title || section.text);
}

function tokenSet(value) {
  return new Set(signature(value).split(" ").filter((token) => token.length >= 3));
}

function jaccard(a, b) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function normalizedImageKey(url) {
  const raw = clean(url);
  if (!raw) return "";
  try {
    return new URL(raw).pathname
      .replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+$)/i, "")
      .toLowerCase();
  } catch {
    return raw.split("?")[0].replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+$)/i, "").toLowerCase();
  }
}

function localImages(product) {
  const uploaded = (product.uploadedImages || []).map((row) => row?.url);
  const verified = product.galleryImageUrls || [];
  const raw = product.imageUrls || [];
  return [...uploaded, ...verified, ...raw].map(clean).filter(Boolean);
}

function compareProduct(product, official, fetchResult) {
  const flags = [];
  const localHtml = sourceHtml(product);
  const localText = textOnly(localHtml);
  const localSectionRows = localSections(product);
  const localHeadingText = localSectionRows.map((section) => section.title).join(" | ");
  const localImageKeys = new Set(localImages(product).map(normalizedImageKey).filter(Boolean));
  const officialImageKeys = new Set(official.galleryImages.map(normalizedImageKey).filter(Boolean));

  if (!fetchResult.ok) {
    return {
      status: "UNRESOLVED",
      flags: [`official_fetch_failed:${fetchResult.error || fetchResult.status || "unknown"}`],
    };
  }
  if (official.warrantyProduct) {
    return { status: "EXCLUDE", flags: ["warranty_or_service_product"] };
  }

  if (!official.title) flags.push("official_title_missing");
  if (official.title && normalizeTitle(product.title) !== normalizeTitle(official.title)) flags.push("title_mismatch");
  if (official.sku && normalizeSku(product.sku) !== normalizeSku(official.sku)) flags.push("item_number_mismatch");
  if (!official.sku && !product.sku) flags.push("item_number_unresolved");

  const officialIntro = official.introParagraphs.join(" ");
  if (officialIntro) {
    if (!localText) flags.push("local_intro_missing");
    else if (jaccard(officialIntro, localText) < 0.42) flags.push("intro_content_mismatch");
  }

  if (official.galleryImages.length) {
    if (!localImageKeys.size) flags.push("local_gallery_missing");
    else {
      const overlap = [...officialImageKeys].some((key) => localImageKeys.has(key));
      if (!overlap) flags.push("gallery_mismatch");
    }
  }

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const optionGroups = Array.isArray(product.optionGroups) ? product.optionGroups : [];
  if (official.optionLabels.length && !variants.length && !optionGroups.length) flags.push("official_options_missing_locally");
  if (!official.optionLabels.length && (variants.length > 1 || optionGroups.length)) flags.push("unexpected_local_options");

  const localCombined = `${localHtml}\n${JSON.stringify(product.kentSections || [])}`;
  if (PRICE_RE.test(localCombined) || COMMERCE_RE.test(localCombined)) flags.push("price_or_commerce_contamination");
  if (SUPPORT_RE.test(localCombined)) flags.push("supplier_support_contamination");

  const duplicateSectionKeys = new Set();
  const duplicateSections = [];
  for (const section of localSectionRows) {
    const key = `${signature(section.title)}|${signature(section.text).slice(0, 300)}`;
    if (!key.replace("|", "")) continue;
    if (duplicateSectionKeys.has(key)) duplicateSections.push(section.title || section.type || "untitled");
    duplicateSectionKeys.add(key);
  }
  if (duplicateSections.length) flags.push("duplicate_local_sections");

  const officialHeadings = official.headings.filter((heading) => !/need help|help & support|how much could you save/i.test(heading));
  if (officialHeadings.length && localSectionRows.length) {
    const missingHeadings = officialHeadings.filter((heading) => {
      const normalized = signature(heading);
      return !localSectionRows.some((section) => {
        const candidate = signature(section.title);
        return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate);
      });
    });
    if (missingHeadings.length >= Math.max(2, Math.ceil(officialHeadings.length * 0.35))) flags.push("section_structure_incomplete");
  }

  const localSpecs = [product.specsHtml, ...localSectionRows.filter((section) => /spec/i.test(section.title) || /spec/i.test(section.type)).map((section) => section.text)]
    .filter(Boolean)
    .join(" ");
  if (WARRANTY_COLUMNS_RE.test(localSpecs) && WARRANTY_TERMS_RE.test(localSpecs)) flags.push("warranty_repeated_as_specifications");

  const seriousFlags = flags.filter((flag) => !["item_number_unresolved"].includes(flag));
  return { status: seriousFlags.length ? "NEEDS_FIX" : "VERIFIED", flags };
}

function renderMarkdown(report) {
  const { summary, products } = report;
  const lines = [
    "# Kent official fidelity verification",
    "",
    `Generated: ${summary.generatedAt}`,
    `Mode: ${summary.mode}`,
    `Request delay: ${summary.delayMs} ms`,
    `Products checked: ${summary.checked}`,
    `VERIFIED: ${summary.VERIFIED}`,
    `NEEDS_FIX: ${summary.NEEDS_FIX}`,
    `UNRESOLVED: ${summary.UNRESOLVED}`,
    `EXCLUDE: ${summary.EXCLUDE}`,
    "",
    "## Flag counts",
    "",
    ...Object.entries(summary.flagCounts).map(([flag, count]) => `- ${flag}: ${count}`),
    "",
  ];

  for (const status of ["NEEDS_FIX", "UNRESOLVED", "EXCLUDE", "VERIFIED"]) {
    const rows = products.filter((row) => row.status === status);
    lines.push(`## ${status}`, "");
    if (!rows.length) {
      lines.push("- None", "");
      continue;
    }
    for (const row of rows) {
      lines.push(
        `### ${row.title || row.slug || row.id}`,
        `- slug: ${row.slug || "missing"}`,
        `- source: ${row.sourceUrl || "missing"}`,
        `- official final URL: ${row.finalUrl || "unresolved"}`,
        `- Item #: local=${row.localSku || "missing"}, official=${row.officialSku || "missing"}`,
        `- official images / local images: ${row.officialImageCount} / ${row.localImageCount}`,
        `- official headings / local sections: ${row.officialHeadingCount} / ${row.localSectionCount}`,
        `- flags: ${row.flags.length ? row.flags.join(", ") : "none"}`,
        "",
      );
    }
  }
  return lines.join("\n");
}

let products = await sanity.fetch(QUERY);
if (onlySlug) products = products.filter((product) => clean(product.slug).toLowerCase() === onlySlug);
if (limit > 0) products = products.slice(0, limit);

const rows = [];
for (let index = 0; index < products.length; index += 1) {
  const product = products[index];
  const sourceUrl = canonicalSourceUrl(product);
  process.stdout.write(`[${index + 1}/${products.length}] ${product.slug || product.title} ... `);

  if (!sourceUrl) {
    rows.push({
      id: product._id,
      title: clean(product.title),
      slug: clean(product.slug),
      sourceUrl: "",
      finalUrl: "",
      localSku: clean(product.sku),
      officialSku: "",
      officialImageCount: 0,
      localImageCount: localImages(product).length,
      officialHeadingCount: 0,
      localSectionCount: localSections(product).length,
      status: "UNRESOLVED",
      flags: ["missing_source_url_and_slug"],
    });
    console.log("UNRESOLVED");
    continue;
  }

  const fetched = await fetchOfficial(sourceUrl);
  const official = fetched.ok ? officialProductData(fetched.text, fetched.finalUrl || sourceUrl) : {
    title: "",
    subtitle: "",
    sku: "",
    category: "",
    introParagraphs: [],
    galleryImages: [],
    headings: [],
    optionLabels: [],
    tables: [],
    pageText: "",
    warrantyProduct: false,
  };
  const compared = compareProduct(product, official, fetched);
  const row = {
    id: product._id,
    title: clean(product.title),
    slug: clean(product.slug),
    sourceUrl,
    finalUrl: fetched.finalUrl || sourceUrl,
    fetchStatus: fetched.status,
    localSku: clean(product.sku),
    officialSku: clean(official.sku),
    officialTitle: clean(official.title),
    officialSubtitle: clean(official.subtitle),
    officialCategory: clean(official.category),
    officialIntroParagraphs: official.introParagraphs.length,
    officialImageCount: official.galleryImages.length,
    localImageCount: localImages(product).length,
    officialHeadingCount: official.headings.length,
    localSectionCount: localSections(product).length,
    officialOptionCount: official.optionLabels.length,
    localVariantCount: Array.isArray(product.variants) ? product.variants.length : 0,
    localOptionGroupCount: Array.isArray(product.optionGroups) ? product.optionGroups.length : 0,
    status: compared.status,
    flags: compared.flags,
  };
  rows.push(row);
  console.log(`${row.status}${row.flags.length ? ` (${row.flags.join(", ")})` : ""}`);
}

const statuses = ["VERIFIED", "NEEDS_FIX", "UNRESOLVED", "EXCLUDE"];
const allFlags = rows.flatMap((row) => row.flags);
const summary = {
  generatedAt: new Date().toISOString(),
  mode: offline ? "offline-cache-only" : refresh ? "live-refresh" : "cache-first-live",
  delayMs,
  checked: rows.length,
  ...Object.fromEntries(statuses.map((status) => [status, rows.filter((row) => row.status === status).length])),
  flagCounts: Object.fromEntries(
    [...new Set(allFlags)].sort().map((flag) => [flag, allFlags.filter((candidate) => candidate === flag).length]),
  ),
};

const report = { summary, products: rows };
fs.writeFileSync(path.join(OUT_DIR, "latest.json"), JSON.stringify(report, null, 2), "utf8");
fs.writeFileSync(path.join(OUT_DIR, "latest.md"), renderMarkdown(report), "utf8");
console.log("\n", JSON.stringify(summary, null, 2));
console.log("Report: .cache/kent-official-fidelity/latest.md");
