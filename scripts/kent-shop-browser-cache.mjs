#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";

import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const arg = (flag, fallback = "") => {
  const index = argv.indexOf(flag);
  return index >= 0 ? String(argv[index + 1] ?? fallback) : fallback;
};

const HEADLESS = has("--headless");
const FRESH = has("--fresh");
const INCLUDE_WARRANTY = has("--include-warranty");
const MAX_PAGES = Number(arg("--max-pages", "80")) || 80;
const LIMIT = Number(arg("--limit", "0")) || 0;
const TIMEOUT = Number(arg("--timeout", "90000")) || 90000;
const DELAY = Number(arg("--delay", "250")) || 250;
const CDP_ENDPOINT = arg("--cdp", "");

const ROOT = process.cwd();
const BASE = "https://www.kentscientific.com";
const SHOP = `${BASE}/shop/`;
const CACHE = path.join(ROOT, ".cache", "kent-shop");
const PROFILE = path.join(CACHE, "browser-profile");
const SHOP_PAGES = path.join(CACHE, "shop-pages");
const SNAPSHOTS = path.join(CACHE, "product-pages");
const SCREENSHOTS = path.join(CACHE, "screenshots");
const REPORT = path.join(CACHE, "browser-inventory.json");
const MARKDOWN = path.join(CACHE, "browser-inventory.md");
const PROGRESS = path.join(CACHE, "browser-progress.json");
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function clean(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function normalizeUrl(value, keepPage = false) {
  try {
    const url = new URL(String(value || ""), BASE);
    if (!/(^|\.)kentscientific\.com$/i.test(url.hostname)) return "";
    url.protocol = "https:";
    url.hostname = "www.kentscientific.com";
    url.hash = "";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    if (!keepPage) url.search = "";
    return url.toString();
  } catch {
    return "";
  }
}
function productSlug(value) {
  try {
    return new URL(normalizeUrl(value)).pathname.match(/^\/products\/([^/]+)\/?$/i)?.[1]?.toLowerCase() || "";
  } catch {
    return "";
  }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
function prepare() {
  fs.mkdirSync(PROFILE, { recursive: true });
  fs.mkdirSync(SHOP_PAGES, { recursive: true });
  fs.mkdirSync(SNAPSHOTS, { recursive: true });
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  if (FRESH) {
    for (const file of [REPORT, MARKDOWN, PROGRESS]) {
      if (fs.existsSync(file)) fs.rmSync(file, { force: true });
    }
    for (const dir of [SHOP_PAGES, SNAPSHOTS]) {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
async function chromiumModule() {
  try {
    return (await import("playwright-core")).chromium;
  } catch (error) {
    console.error("playwright-core가 없습니다. 먼저 npm run kent:shop:browser:setup 을 실행하세요.");
    throw error;
  }
}
async function openBrowser(chromium) {
  if (CDP_ENDPOINT) {
    const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    const context = browser.contexts()[0];
    if (!context) throw new Error("CDP Chrome context를 찾지 못했습니다.");
    return { context, close: async () => browser.close() };
  }
  const context = await chromium.launchPersistentContext(PROFILE, {
    channel: "chrome",
    headless: HEADLESS,
    locale: "en-US",
    viewport: { width: 1440, height: 1000 },
  });
  return { context, close: () => context.close() };
}
async function diagnostic(page, response) {
  const status = response?.status?.() ?? null;
  const title = clean(await page.title().catch(() => ""));
  const body = clean(await page.locator("body").innerText({ timeout: 5000 }).catch(() => ""));
  const blocked = status === 403 || /just a moment|access denied|forbidden|captcha|verify you are human|cloudflare/i.test(`${title} ${body.slice(0, 1800)}`);
  return { status, title, blocked };
}
async function gotoAllowed(page, url, label) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      let response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
      let check = await diagnostic(page, response);
      if (check.blocked && !HEADLESS) {
        await page.bringToFront();
        console.log(`\nKent 보안 확인이 감지됐어: ${url}`);
        console.log("열린 Chrome에서 페이지가 정상 표시되도록 확인한 다음 Enter를 눌러.");
        await rl.question("");
        response = await page.reload({ waitUntil: "domcontentloaded", timeout: TIMEOUT });
        check = await diagnostic(page, response);
      }
      if (check.blocked) throw new Error(`blocked_or_forbidden status=${check.status ?? "unknown"}`);
      if (check.status && check.status >= 400) throw new Error(`HTTP ${check.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        console.warn(`${label}: retry ${attempt}/3 - ${error instanceof Error ? error.message : String(error)}`);
        await sleep(1000 * attempt);
      }
    }
  }
  throw lastError || new Error(`${label}: navigation failed`);
}
async function extractShopPage(page) {
  return page.evaluate(() => {
    const abs = (href) => {
      try {
        const url = new URL(href, location.href);
        url.hash = "";
        url.hostname = "www.kentscientific.com";
        if (!url.pathname.endsWith("/")) url.pathname += "/";
        return url.toString();
      } catch {
        return "";
      }
    };
    const products = [];
    const grid = [...document.querySelectorAll("ul.products")]
      .filter((node) => !node.closest("header,footer,nav,.mega-menu,.elementor-location-header,.elementor-location-footer"))
      .sort((a, b) => b.querySelectorAll(":scope > li.product").length - a.querySelectorAll(":scope > li.product").length)[0];
    for (const card of grid?.querySelectorAll(":scope > li.product") || []) {
      const anchor = card.querySelector('a[href*="/products/"]');
      const url = abs(anchor?.getAttribute("href") || "");
      const title = (card.querySelector(".woocommerce-loop-product__title,h2,h3")?.textContent || "").replace(/\s+/g, " ").trim();
      const image = card.querySelector("img");
      if (url) products.push({ url, title, imageUrl: abs(image?.getAttribute("data-src") || image?.getAttribute("src") || "") });
    }
    const next = abs(document.querySelector(".woocommerce-pagination a.next[href], nav.woocommerce-pagination a.next[href]")?.getAttribute("href") || "");
    return { products, next };
  });
}
async function crawlShop(context) {
  const page = await context.newPage();
  const visited = [];
  const products = [];
  const errors = [];
  let current = SHOP;
  try {
    for (let pageNumber = 1; current && pageNumber <= MAX_PAGES; pageNumber += 1) {
      const url = normalizeUrl(current, true);
      if (!url || visited.includes(url)) {
        errors.push({ url, error: "pagination_loop_or_invalid_url" });
        break;
      }
      visited.push(url);
      try {
        await gotoAllowed(page, url, "Shop archive");
        await page.waitForTimeout(700);
        const html = await page.content();
        fs.writeFileSync(path.join(SHOP_PAGES, `page-${pageNumber}.html`), html, "utf8");
        const extracted = await extractShopPage(page);
        products.push(...extracted.products.map((row) => ({ ...row, shopPageUrl: url })));
        console.log(`Shop page ${pageNumber}: ${extracted.products.length} products`);
        current = extracted.next || "";
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ url, error: message });
        await page.screenshot({ path: path.join(SCREENSHOTS, `shop-${pageNumber}-error.png`), fullPage: true }).catch(() => {});
        break;
      }
    }
  } finally {
    await page.close();
  }
  if (current) errors.push({ url: current, error: `max-pages exceeded (${MAX_PAGES})` });
  return { visitedPages: visited, errors, products: uniqueBy(products, (row) => productSlug(row.url)) };
}

async function extractProduct(page, expectedSlug, status) {
  return page.evaluate(({ expectedSlug, status }) => {
    const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const abs = (href) => {
      try {
        const url = new URL(href, location.href);
        url.hash = "";
        url.hostname = "www.kentscientific.com";
        if (!url.pathname.endsWith("/")) url.pathname += "/";
        return url.toString();
      } catch {
        return "";
      }
    };
    const body = clean(document.body?.innerText || "");
    const title = clean(document.querySelector("h1.product_title,h1.entry-title,main h1,h1")?.textContent || document.title);
    const canonical = abs(document.querySelector('link[rel="canonical"]')?.getAttribute("href") || location.href);
    const strongSignal = Boolean(document.querySelector("h1.product_title,.woocommerce-product-gallery,form.cart,.product_meta")) || /\bItem\s*#/i.test(body);
    const warranty = /\bwarranty\b/i.test(`${expectedSlug} ${title} ${clean(document.querySelector(".product_meta")?.textContent)}`);
    return { status, title, canonical, valid: Boolean(status >= 200 && status < 400 && strongSignal && title), warranty };
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
      process.stdout.write(`\rProduct ${index + 1}/${selected.length}: ${candidate.slug.padEnd(50).slice(0, 50)}`);
      try {
        const response = await gotoAllowed(page, candidate.sourceUrl, `product ${candidate.slug}`);
        const status = response?.status?.() ?? 0;
        const result = await extractProduct(page, candidate.slug, status);
        const canonicalSlug = productSlug(result.canonical);
        if (!result.valid || canonicalSlug !== candidate.slug) {
          invalid.push({ ...candidate, result, reason: canonicalSlug !== candidate.slug ? "canonical_slug_mismatch" : "not_valid_product" });
        } else {
          const snapshotPath = path.join(SNAPSHOTS, `${candidate.slug}.html`);
          fs.writeFileSync(snapshotPath, await page.content(), "utf8");
          valid.push({ ...candidate, ...result, sourceUrl: result.canonical || candidate.sourceUrl, snapshotPath: path.relative(ROOT, snapshotPath), importable: INCLUDE_WARRANTY || !result.warranty });
        }
      } catch (error) {
        unresolved.push({ ...candidate, error: error instanceof Error ? error.message : String(error) });
      }
      writeJson(PROGRESS, { generatedAt: new Date().toISOString(), total: selected.length, completed: index + 1, valid, invalid, unresolved });
      await sleep(DELAY);
    }
  } finally {
    process.stdout.write("\n");
    await page.close();
  }
  return { checked: selected.length, valid, invalid, unresolved };
}
function markdown(report) {
  return [
    "# Kent Shop browser inventory",
    "",
    `- Complete: ${report.complete ? "YES" : "NO"}`,
    `- Shop pages: ${report.shop.visitedPages.length}`,
    `- Listed products: ${report.counts.listedProducts}`,
    `- Valid products: ${report.counts.validProducts}`,
    `- Importable products: ${report.counts.importableProducts}`,
    `- Invalid: ${report.counts.invalid}`,
    `- Unresolved: ${report.counts.unresolved}`,
    "",
    "## Importable",
    "",
    ...report.importableProducts.map((row) => `- ${row.title} — \`${row.slug}\``),
    "",
  ].join("\n");
}
async function main() {
  prepare();
  const chromium = await chromiumModule();
  const session = await openBrowser(chromium);
  try {
    const shop = await crawlShop(session.context);
    if (!shop.products.length) throw new Error("Chrome에서 Kent Shop 제품 링크를 찾지 못했습니다.");
    const candidates = shop.products.map((row) => ({ ...row, slug: productSlug(row.url), sourceUrl: normalizeUrl(row.url) })).filter((row) => row.slug);
    const validation = await validateProducts(session.context, candidates);
    const importableProducts = validation.valid.filter((row) => row.importable);
    const complete = LIMIT === 0 && shop.errors.length === 0 && validation.unresolved.length === 0 && validation.checked === candidates.length;
    const report = {
      generatedAt: new Date().toISOString(),
      complete,
      options: { headless: HEADLESS, includeWarranty: INCLUDE_WARRANTY, limit: LIMIT },
      shopPageCount: shop.visitedPages.length,
      counts: { listedProducts: candidates.length, validProducts: validation.valid.length, importableProducts: importableProducts.length, invalid: validation.invalid.length, unresolved: validation.unresolved.length },
      shop,
      validation,
      products: validation.valid,
      importableProducts,
    };
    writeJson(REPORT, report);
    fs.writeFileSync(MARKDOWN, markdown(report), "utf8");
    console.log(`Complete: ${complete ? "YES" : "NO"}`);
    console.log(`Shop products: ${candidates.length}`);
    console.log(`Importable: ${importableProducts.length}`);
    console.log(`Report: ${path.relative(ROOT, REPORT)}`);
  } finally {
    await session.close().catch(() => {});
    rl.close();
  }
}

main().catch((error) => {
  rl.close();
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
