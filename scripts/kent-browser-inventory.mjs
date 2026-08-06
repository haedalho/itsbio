#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";

import dotenv from "dotenv";
import { createClient } from "@sanity/client";

const ROOT = process.cwd();
dotenv.config({ path: path.join(ROOT, ".env.local") });

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const readArg = (flag, fallback = "") => {
  const index = argv.indexOf(flag);
  return index >= 0 ? String(argv[index + 1] ?? fallback) : fallback;
};

const HEADLESS = has("--headless");
const FRESH = has("--fresh");
const INCLUDE_WARRANTY = has("--include-warranty");
const LIMIT = Number(readArg("--limit", "0")) || 0;
const NAVIGATION_TIMEOUT_MS = Number(readArg("--timeout", "90000")) || 90000;
const MAX_ARCHIVE_PAGES = Number(readArg("--max-pages", "80")) || 80;
const PRODUCT_DELAY_MS = Number(readArg("--delay", "350")) || 350;
const CDP_ENDPOINT = readArg("--cdp", "");

const KENT_BASE = "https://www.kentscientific.com";
const OUTPUT_DIR = path.join(ROOT, ".cache", "kent-browser-inventory");
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "screenshots");
const PROFILE_DIR = path.join(OUTPUT_DIR, "chrome-profile");
const JSON_PATH = path.join(OUTPUT_DIR, "latest.json");
const MARKDOWN_PATH = path.join(OUTPUT_DIR, "latest.md");
const PROGRESS_PATH = path.join(OUTPUT_DIR, "progress.json");

const ARCHIVES = [
  {
    id: "shop",
    label: "Shop",
    rootUrl: `${KENT_BASE}/shop/`,
    pathPattern: /^\/shop(?:\/page\/\d+)?\/?$/i,
  },
  {
    id: "catalog-product",
    label: "Catalog Product",
    rootUrl: `${KENT_BASE}/brand/catalog-product/`,
    pathPattern: /^\/brand\/catalog-product(?:\/page\/\d+)?\/?$/i,
  },
  {
    id: "core-product",
    label: "Core Product",
    rootUrl: `${KENT_BASE}/brand/core-product/`,
    pathPattern: /^\/brand\/core-product(?:\/page\/\d+)?\/?$/i,
  },
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function clean(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDirs() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  if (FRESH) {
    for (const file of [JSON_PATH, MARKDOWN_PATH, PROGRESS_PATH]) {
      if (fs.existsSync(file)) fs.rmSync(file, { force: true });
    }
  }
}

function normalizeUrl(value, { keepPagination = false } = {}) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw, KENT_BASE);
    if (!/(^|\.)kentscientific\.com$/i.test(url.hostname)) return "";
    url.protocol = "https:";
    url.hostname = "www.kentscientific.com";
    url.hash = "";
    url.pathname = decodeURIComponent(url.pathname).replace(/\/{2,}/g, "/");
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    if (keepPagination) {
      const retained = new URLSearchParams();
      for (const key of ["product-page", "paged", "page"]) {
        const item = url.searchParams.get(key);
        if (item && /^\d+$/.test(item)) retained.set(key, item);
      }
      url.search = retained.toString();
    } else {
      url.search = "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function productSlug(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return "";
  try {
    const match = new URL(normalized).pathname.match(/^\/products\/([^/]+)\/?$/i);
    return match?.[1] ? decodeURIComponent(match[1]).toLowerCase() : "";
  } catch {
    return "";
  }
}

function unique(values, keyFn = (value) => String(value).toLowerCase()) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const key = keyFn(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function safeName(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "page";
}

function archiveUrlForPage(archive, pageNumber) {
  if (pageNumber <= 1) return archive.rootUrl;
  return `${archive.rootUrl.replace(/\/$/, "")}/page/${pageNumber}/`;
}

function normalizeArchiveUrl(value, archive) {
  const normalized = normalizeUrl(value, { keepPagination: true });
  if (!normalized) return "";
  return archive.pathPattern.test(new URL(normalized).pathname) ? normalized : "";
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function importPlaywright() {
  try {
    const module = await import("playwright-core");
    return module.chromium;
  } catch (error) {
    console.error("\nplaywright-core가 설치되어 있지 않습니다.");
    console.error("먼저 다음 명령을 실행하세요:");
    console.error("  npm run kent:inventory:browser:setup\n");
    throw error;
  }
}

async function openBrowser(chromium) {
  if (CDP_ENDPOINT) {
    console.log(`Connecting to Chrome via CDP: ${CDP_ENDPOINT}`);
    const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    const context = browser.contexts()[0];
    if (!context) throw new Error("CDP Chrome context를 찾지 못했습니다.");
    return { browser, context, close: async () => {} };
  }

  console.log(`Opening ${HEADLESS ? "headless" : "visible"} Google Chrome...`);
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: "chrome",
    headless: HEADLESS,
    locale: "en-US",
    viewport: { width: 1440, height: 1000 },
    ignoreHTTPSErrors: false,
    acceptDownloads: false,
  });
  return { browser: null, context, close: () => context.close() };
}

async function pageDiagnostic(page, response) {
  const title = clean(await page.title().catch(() => ""));
  const bodyText = clean(await page.locator("body").innerText({ timeout: 5000 }).catch(() => ""));
  const status = response?.status?.() ?? null;
  const blocked =
    status === 403 ||
    /just a moment|attention required|access denied|forbidden|captcha|verify you are human|cloudflare/i.test(
      `${title} ${bodyText.slice(0, 1500)}`,
    );
  return { title, bodyText, status, blocked };
}

async function resolveBlock(page, url, response) {
  let diagnostic = await pageDiagnostic(page, response);
  if (!diagnostic.blocked) return diagnostic;
  if (HEADLESS) return diagnostic;

  await page.bringToFront();
  console.log("\nKent 보안 확인 또는 403 화면이 감지되었습니다.");
  console.log(`브라우저에서 아래 페이지가 정상적으로 보이도록 확인해 주세요:\n${url}`);
  await rl.question("확인을 마친 뒤 Enter를 누르세요: ");
  const retryResponse = await page.reload({ waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS }).catch(() => null);
  diagnostic = await pageDiagnostic(page, retryResponse);
  return diagnostic;
}

async function gotoWithRetry(page, url, label) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS });
      const diagnostic = await resolveBlock(page, url, response);
      if (diagnostic.blocked) {
        throw new Error(`blocked_or_forbidden status=${diagnostic.status ?? "unknown"} title=${diagnostic.title}`);
      }
      return { response, diagnostic };
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        console.warn(`${label}: retry ${attempt}/3 - ${error instanceof Error ? error.message : String(error)}`);
        await sleep(1200 * attempt);
      }
    }
  }
  throw lastError || new Error(`${label}: navigation failed`);
}

async function extractArchivePage(page, archive) {
  return page.evaluate(({ archiveId, rootUrl }) => {
    const abs = (href) => {
      try {
        const url = new URL(href, location.href);
        url.hash = "";
        url.protocol = "https:";
        url.hostname = "www.kentscientific.com";
        if (!url.pathname.endsWith("/")) url.pathname += "/";
        return url.toString();
      } catch {
        return "";
      }
    };
    const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const products = [];
    const pagination = [];
    const pageNumbers = [];

    for (const anchor of document.querySelectorAll("a[href]")) {
      const href = abs(anchor.getAttribute("href"));
      if (!href) continue;
      const url = new URL(href);
      if (/^\/products\/[^/]+\/?$/i.test(url.pathname)) {
        const scope = anchor.closest("li, article, [class*='product'], [class*='card'], [class*='grid']") || anchor.parentElement;
        const title = cleanText(
          scope?.querySelector("h1,h2,h3,h4,.woocommerce-loop-product__title,.product-title,[class*='product-title']")?.textContent ||
            anchor.getAttribute("aria-label") ||
            anchor.getAttribute("title") ||
            anchor.textContent,
        );
        const image = scope?.querySelector("img");
        products.push({
          url: href,
          title,
          imageUrl: image?.getAttribute("data-large_image") || image?.getAttribute("data-src") || image?.currentSrc || image?.src || "",
          archiveId,
          archivePage: location.href,
        });
      }

      const sameRoot = href.startsWith(rootUrl.replace(/\/$/, ""));
      if (sameRoot && (/\/page\/\d+\/?$/i.test(url.pathname) || /(?:product-page|paged|page)=\d+/i.test(url.search))) {
        pagination.push(href);
      }
    }

    for (const node of document.querySelectorAll(".pagination a, .pagination span, .woocommerce-pagination a, .woocommerce-pagination span, nav[aria-label*='pagination' i] a, nav[aria-label*='pagination' i] span")) {
      const number = Number.parseInt(cleanText(node.textContent), 10);
      if (Number.isInteger(number) && number > 1 && number < 100) pageNumbers.push(number);
    }

    return { products, pagination, pageNumbers };
  }, { archiveId: archive.id, rootUrl: archive.rootUrl });
}

async function crawlArchive(context, archive) {
  console.log(`\n[${archive.label}] crawling archive pages...`);
  const page = await context.newPage();
  const queue = [archive.rootUrl];
  const visited = new Set();
  const products = [];
  const errors = [];

  try {
    while (queue.length && visited.size < MAX_ARCHIVE_PAGES) {
      const current = queue.shift();
      const normalizedCurrent = normalizeArchiveUrl(current, archive);
      if (!normalizedCurrent || visited.has(normalizedCurrent)) continue;
      visited.add(normalizedCurrent);

      try {
        const { response } = await gotoWithRetry(page, normalizedCurrent, `${archive.label} archive`);
        const status = response?.status?.() ?? null;
        if (status && status >= 400) throw new Error(`HTTP ${status}`);
        await page.waitForTimeout(700);
        const extracted = await extractArchivePage(page, archive);
        products.push(...extracted.products);

        for (const link of extracted.pagination) {
          const normalized = normalizeArchiveUrl(link, archive);
          if (normalized && !visited.has(normalized) && !queue.includes(normalized)) queue.push(normalized);
        }
        for (const number of extracted.pageNumbers) {
          const generated = archiveUrlForPage(archive, number);
          if (!visited.has(generated) && !queue.includes(generated)) queue.push(generated);
        }

        console.log(`[${archive.label}] page ${visited.size}: ${extracted.products.length} product links`);
        if (visited.size === 1) {
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${archive.id}-first-page.png`), fullPage: true }).catch(() => {});
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ url: normalizedCurrent, error: message });
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${archive.id}-${safeName(normalizedCurrent)}-error.png`), fullPage: true }).catch(() => {});
        console.error(`[${archive.label}] failed: ${normalizedCurrent} - ${message}`);
      }
    }
  } finally {
    await page.close();
  }

  return {
    id: archive.id,
    label: archive.label,
    rootUrl: archive.rootUrl,
    visitedPages: [...visited],
    errors,
    products: unique(products, (row) => productSlug(row.url)),
  };
}

function mergeArchiveProducts(archives) {
  const map = new Map();
  for (const archive of archives) {
    for (const product of archive.products) {
      const slug = productSlug(product.url);
      if (!slug) continue;
      const current = map.get(slug) || {
        slug,
        sourceUrl: normalizeUrl(product.url),
        listingTitles: [],
        listingImages: [],
        discoveredFrom: [],
      };
      if (product.title) current.listingTitles.push(product.title);
      if (product.imageUrl) current.listingImages.push(product.imageUrl);
      current.discoveredFrom.push({ archive: archive.id, page: product.archivePage });
      current.listingTitles = unique(current.listingTitles);
      current.listingImages = unique(current.listingImages);
      current.discoveredFrom = unique(current.discoveredFrom, (row) => `${row.archive}|${row.page}`);
      map.set(slug, current);
    }
  }
  return [...map.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

async function extractProductPage(page, expectedSlug, response) {
  const status = response?.status?.() ?? null;
  return page.evaluate(({ expectedSlug, status }) => {
    const cleanText = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const abs = (href) => {
      try {
        const url = new URL(href, location.href);
        url.hash = "";
        url.protocol = "https:";
        url.hostname = "www.kentscientific.com";
        if (!url.pathname.endsWith("/")) url.pathname += "/";
        return url.toString();
      } catch {
        return "";
      }
    };

    const bodyText = cleanText(document.body?.innerText || "");
    const title = cleanText(
      document.querySelector("h1.product_title, h1.entry-title, main h1, article h1, h1")?.textContent ||
        document.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
        document.title,
    );
    const canonical = abs(document.querySelector('link[rel="canonical"]')?.getAttribute("href") || location.href);
    const bodyClass = document.body?.className || "";
    const ogType = cleanText(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).toLowerCase();
    let jsonLdProduct = false;
    for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
      if (/"@type"\s*:\s*"Product"/i.test(node.textContent || "")) jsonLdProduct = true;
    }
    const itemMatch = bodyText.match(/\bItem\s*#\s*[:#]?\s*([A-Z0-9][A-Z0-9._/ -]{0,80})/i);
    const itemNumber = cleanText(
      document.querySelector(".sku, [class*='sku'], [class*='item-number']")?.textContent || itemMatch?.[1] || "",
    ).split(/\s+(?:Categories?|Tags?|Need Help|Category)\b/i)[0];
    const categoryText = cleanText(
      document.querySelector(".posted_in, [class*='posted_in'], .product_meta")?.textContent || "",
    );
    const categories = [...document.querySelectorAll(".posted_in a, .product_meta a[href*='/product-category/']")]
      .map((node) => cleanText(node.textContent))
      .filter(Boolean);
    const images = [...document.querySelectorAll(".woocommerce-product-gallery img, [class*='product-gallery'] img, .product img.wp-post-image, main img")]
      .map((image) => image.getAttribute("data-large_image") || image.getAttribute("data-src") || image.currentSrc || image.src || "")
      .map(abs)
      .filter(Boolean);
    const optionGroups = [...document.querySelectorAll("form.variations_form select, form.cart select")]
      .map((select) => {
        const id = select.getAttribute("id");
        const label = cleanText(
          (id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent : "") ||
            select.closest("tr")?.querySelector("th,label")?.textContent ||
            select.getAttribute("name") || "",
        );
        const options = [...select.querySelectorAll("option")]
          .map((option) => ({ value: cleanText(option.value), label: cleanText(option.textContent) }))
          .filter((option) => option.value || (option.label && !/^choose an option$/i.test(option.label)));
        return { label, options };
      })
      .filter((group) => group.label || group.options.length);
    const strongSignal =
      /(?:^|\s)single-product(?:\s|$)/i.test(bodyClass) ||
      Boolean(document.querySelector("h1.product_title, .woocommerce-product-gallery, form.cart, .product_meta")) ||
      jsonLdProduct ||
      ogType === "product" ||
      /\bItem\s*#/i.test(bodyText);
    const outOfStock = /\bout of stock\b/i.test(bodyText) || Boolean(document.querySelector(".out-of-stock"));
    const warranty = /\bwarranty\b/i.test(`${expectedSlug} ${title} ${categoryText}`);

    return {
      status,
      finalUrl: abs(location.href),
      canonical,
      title,
      itemNumber,
      categories: [...new Set(categories)],
      categoryText,
      imageUrls: [...new Set(images)].slice(0, 20),
      optionGroups,
      outOfStock,
      warranty,
      valid: Boolean(status && status >= 200 && status < 400 && strongSignal && title),
      signals: { bodyClass, ogType, jsonLdProduct, strongSignal },
    };
  }, { expectedSlug, status });
}

async function validateProducts(context, candidates) {
  const page = await context.newPage();
  const valid = [];
  const invalid = [];
  const unresolved = [];
  const selected = LIMIT > 0 ? candidates.slice(0, LIMIT) : candidates;

  try {
    for (let index = 0; index < selected.length; index += 1) {
      const candidate = selected[index];
      process.stdout.write(`\rValidating ${index + 1}/${selected.length}: ${candidate.slug.padEnd(55).slice(0, 55)}`);
      try {
        const { response } = await gotoWithRetry(page, candidate.sourceUrl, `product ${candidate.slug}`);
        const status = response?.status?.() ?? null;
        const extracted = await extractProductPage(page, candidate.slug, response);
        const finalSlug = productSlug(extracted.canonical || extracted.finalUrl);

        if (status === 404 || status === 410 || !extracted.valid || finalSlug !== candidate.slug) {
          invalid.push({
            ...candidate,
            result: extracted,
            reason: status === 404 || status === 410 ? `HTTP ${status}` : finalSlug !== candidate.slug ? "redirected_to_different_product" : "not_a_valid_product_page",
          });
        } else {
          valid.push({
            ...candidate,
            ...extracted,
            sourceUrl: normalizeUrl(extracted.canonical || candidate.sourceUrl),
            importable: INCLUDE_WARRANTY || !extracted.warranty,
            excludedReason: !INCLUDE_WARRANTY && extracted.warranty ? "warranty" : "",
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        unresolved.push({ ...candidate, error: message });
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `product-${safeName(candidate.slug)}-error.png`), fullPage: true }).catch(() => {});
      }

      writeJson(PROGRESS_PATH, {
        generatedAt: new Date().toISOString(),
        total: selected.length,
        completed: index + 1,
        valid,
        invalid,
        unresolved,
      });
      await sleep(PRODUCT_DELAY_MS);
    }
  } finally {
    process.stdout.write("\n");
    await page.close();
  }

  return { checked: selected.length, valid, invalid, unresolved };
}

async function fetchSanityProducts() {
  const projectId =
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
    process.env.SANITY_STUDIO_PROJECT_ID ||
    process.env.SANITY_PROJECT_ID;
  const dataset =
    process.env.NEXT_PUBLIC_SANITY_DATASET ||
    process.env.SANITY_STUDIO_DATASET ||
    process.env.SANITY_DATASET;

  if (!projectId || !dataset) {
    console.warn("Sanity 환경변수가 없어 기존 제품 비교를 건너뜁니다.");
    return [];
  }

  const sanity = createClient({ projectId, dataset, apiVersion: "2025-02-19", useCdn: false });
  return sanity.fetch(`*[_type == "product" && (
    brandSlug == "kent" || themeKey == "kent" || brand->slug.current == "kent" || brand->themeKey == "kent"
  )]{ _id, title, "slug": slug.current, sku, sourceUrl, isActive, listingPaths }`);
}

function compareWithSanity(siteProducts, sanityProducts) {
  const existingBySlug = new Map();
  const existingByUrl = new Map();
  for (const product of sanityProducts || []) {
    const slug = clean(product.slug).toLowerCase();
    const url = normalizeUrl(product.sourceUrl).toLowerCase();
    if (slug) existingBySlug.set(slug, [...(existingBySlug.get(slug) || []), product]);
    if (url) existingByUrl.set(url, [...(existingByUrl.get(url) || []), product]);
  }

  const matchedIds = new Set();
  const missingInSanity = [];
  const matched = [];
  const duplicateExisting = [];

  for (const product of siteProducts) {
    const matches = unique(
      [...(existingBySlug.get(product.slug) || []), ...(existingByUrl.get(normalizeUrl(product.sourceUrl).toLowerCase()) || [])],
      (row) => row._id,
    );
    if (!matches.length) {
      missingInSanity.push(product);
      continue;
    }
    matches.forEach((row) => matchedIds.add(row._id));
    matched.push({ product, existing: matches[0] });
    if (matches.length > 1) duplicateExisting.push({ product, existing: matches });
  }

  const sanityOnly = (sanityProducts || []).filter((product) => !matchedIds.has(product._id));
  return { matched, missingInSanity, duplicateExisting, sanityOnly };
}

function renderMarkdown(report) {
  const lines = [
    "# Kent live browser inventory",
    "",
    `- 실행 시각: ${report.generatedAt}`,
    `- 완료 판정: ${report.complete ? "COMPLETE" : "INCOMPLETE"}`,
    `- 목록에서 발견한 고유 URL: ${report.counts.discoveredUrls}`,
    `- 현재 열리는 실제 제품 페이지: ${report.counts.validProductPages}`,
    `- 가져오기 대상 제품: ${report.counts.importableProducts}`,
    `- Warranty 제외: ${report.counts.excludedWarranty}`,
    `- 삭제·비상품·다른 페이지로 이동: ${report.counts.invalidPages}`,
    `- 확인 불가능한 페이지: ${report.counts.unresolvedPages}`,
    `- Kent 원본에 있고 Sanity에 없음: ${report.counts.missingInSanity}`,
    `- Sanity에만 있음: ${report.counts.sanityOnly}`,
    `- Sanity 중복 후보: ${report.counts.duplicateExisting}`,
    "",
    "## Archive coverage",
    "",
  ];

  for (const archive of report.archives) {
    lines.push(`- **${archive.label}**: ${archive.visitedPages.length} pages · ${archive.products.length} products · ${archive.errors.length} errors`);
  }

  lines.push("", `## IMPORTABLE PRODUCTS (${report.importableProducts.length})`, "");
  for (const product of report.importableProducts) {
    lines.push(`- **${product.title}** — \`${product.slug}\`${product.itemNumber ? ` · Item # ${product.itemNumber}` : ""}`);
  }

  lines.push("", `## MISSING IN SANITY (${report.comparison.missingInSanity.length})`, "");
  if (!report.comparison.missingInSanity.length) lines.push("- 없음");
  for (const product of report.comparison.missingInSanity) lines.push(`- **${product.title}** — ${product.sourceUrl}`);

  lines.push("", `## SANITY ONLY (${report.comparison.sanityOnly.length})`, "");
  if (!report.comparison.sanityOnly.length) lines.push("- 없음");
  for (const product of report.comparison.sanityOnly) lines.push(`- **${product.title || product._id}** — \`${product.slug || "no-slug"}\` · ${product.sourceUrl || "no source URL"}`);

  lines.push("", `## INVALID CURRENT LISTINGS (${report.validation.invalid.length})`, "");
  if (!report.validation.invalid.length) lines.push("- 없음");
  for (const product of report.validation.invalid) lines.push(`- \`${product.slug}\` — ${product.reason} · ${product.sourceUrl}`);

  lines.push("", `## UNRESOLVED (${report.validation.unresolved.length})`, "");
  if (!report.validation.unresolved.length) lines.push("- 없음");
  for (const product of report.validation.unresolved) lines.push(`- \`${product.slug}\` — ${product.error} · ${product.sourceUrl}`);

  lines.push(
    "",
    "## Rules",
    "",
    "- Shop, Catalog Product, Core Product의 현재 목록에 나타나는 URL만 후보로 삼는다.",
    "- 후보 상세페이지를 실제 Chrome으로 열고 상품 신호가 확인된 경우에만 실제 제품으로 인정한다.",
    "- 404, 410, 비상품 페이지, 다른 slug로 이동한 URL은 가져오지 않는다.",
    "- Warranty는 별도로 기록하고 기본 가져오기 대상에서는 제외한다.",
    "- 목록 또는 상세페이지에 미확인 오류가 하나라도 있으면 COMPLETE로 판정하지 않는다.",
    "- 이 명령은 Sanity를 수정하지 않는다.",
    "",
  );
  return lines.join("\n");
}

async function main() {
  ensureDirs();
  const chromium = await importPlaywright();
  const browserSession = await openBrowser(chromium);

  try {
    const archives = [];
    for (const archive of ARCHIVES) archives.push(await crawlArchive(browserSession.context, archive));

    const candidates = mergeArchiveProducts(archives);
    if (!candidates.length) throw new Error("현재 Kent 목록 페이지에서 제품 URL을 찾지 못했습니다.");
    console.log(`\nUnique listed product URLs: ${candidates.length}`);

    const validation = await validateProducts(browserSession.context, candidates);
    const importableProducts = validation.valid.filter((product) => product.importable);
    const sanityProducts = await fetchSanityProducts();
    const comparison = compareWithSanity(importableProducts, sanityProducts);
    const archiveErrors = archives.reduce((sum, archive) => sum + archive.errors.length, 0);
    const complete = archiveErrors === 0 && validation.unresolved.length === 0 && validation.checked === candidates.length;

    const report = {
      generatedAt: new Date().toISOString(),
      complete,
      options: { headless: HEADLESS, includeWarranty: INCLUDE_WARRANTY, limit: LIMIT, cdpEndpoint: CDP_ENDPOINT || null },
      counts: {
        discoveredUrls: candidates.length,
        validProductPages: validation.valid.length,
        importableProducts: importableProducts.length,
        excludedWarranty: validation.valid.filter((product) => product.warranty && !product.importable).length,
        invalidPages: validation.invalid.length,
        unresolvedPages: validation.unresolved.length,
        sanityProducts: sanityProducts.length,
        missingInSanity: comparison.missingInSanity.length,
        sanityOnly: comparison.sanityOnly.length,
        duplicateExisting: comparison.duplicateExisting.length,
      },
      archives,
      candidates,
      validation,
      importableProducts,
      comparison,
    };

    writeJson(JSON_PATH, report);
    fs.writeFileSync(MARKDOWN_PATH, renderMarkdown(report), "utf8");

    console.log("\n=== Kent live browser inventory ===");
    console.log(`Complete: ${complete ? "YES" : "NO"}`);
    console.log(`Listed unique URLs: ${report.counts.discoveredUrls}`);
    console.log(`Valid live products: ${report.counts.validProductPages}`);
    console.log(`Importable products: ${report.counts.importableProducts}`);
    console.log(`Excluded warranty: ${report.counts.excludedWarranty}`);
    console.log(`Invalid listings: ${report.counts.invalidPages}`);
    console.log(`Unresolved: ${report.counts.unresolvedPages}`);
    console.log(`Missing in Sanity: ${report.counts.missingInSanity}`);
    console.log(`Sanity only: ${report.counts.sanityOnly}`);
    console.log(`Report: ${path.relative(ROOT, MARKDOWN_PATH)}`);
    console.log(`Data:   ${path.relative(ROOT, JSON_PATH)}`);
  } finally {
    await browserSession.close().catch(() => {});
    rl.close();
  }
}

main().catch((error) => {
  rl.close();
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
