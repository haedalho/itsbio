#!/usr/bin/env node
/**
 * Collect the complete official ABM Service landing hierarchy (READ ONLY).
 *
 * The output contains category/landing pages only. The 251 purchasable/service
 * offering details are collected separately by abm-full-detail-collect.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { sanitizeAbmStoredHtml } from "../lib/abm/rebuild-parser.mjs";

const OUT = path.resolve(".cache/abm-service-landings");
const argv = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : fallback;
};
const WORKERS = Math.max(1, Math.min(4, Number(readArg("--workers", "2")) || 2));
const GAP_MS = Math.max(50, Number(readArg("--gap-ms", "180")) || 180);

const ROOTS = [
  { title: "Cell & Antibody Services", url: "https://www.abmgood.com/Cell-Antibody-Services.html" },
  { title: "DNA & Cloning Services", url: "https://www.abmgood.com/Custom-Cloning-Service.html" },
  { title: "Recombinant Virus Packaging", url: "https://www.abmgood.com/Virus-Packaging-Services.html" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const normalized = (value) => clean(value).replace(/&/g, "and").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
const slugify = (value) => clean(value)
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/&/g, " and ")
  .replace(/[^A-Za-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .toLowerCase();

function officialUrl(raw, base) {
  try {
    const url = new URL(String(raw || ""), base);
    if (!["abmgood.com", "www.abmgood.com"].includes(url.hostname)) return "";
    url.protocol = "https:";
    url.hostname = "www.abmgood.com";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function canonicalUrl(raw, base) {
  const value = officialUrl(raw, base);
  if (!value) return "";
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function fetchHtml(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(GAP_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-ServiceLanding/1.0; +https://itsbio.vercel.app)",
          accept: "text/html,application/xhtml+xml",
        },
      });
      clearTimeout(timer);
      if (response.status === 429) {
        await sleep(Math.max(1800 * (attempt + 1), Number(response.headers.get("retry-after") || 0) * 1000));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { html: await response.text(), finalUrl: response.url || url };
    } catch (error) {
      clearTimeout(timer);
      if (attempt === 5) throw error;
      await sleep(600 * (attempt + 1));
    }
  }
  throw new Error(`Unable to fetch ${url}`);
}

function parseTreeItem($, li, parentTitles, baseUrl) {
  const node = $(li);
  const anchor = node.children("a[href]").first().length ? node.children("a[href]").first() : node.find("a[href]").first();
  const title = clean(anchor.attr("title") || anchor.clone().children().remove().end().text() || anchor.find("img").attr("alt"));
  const sourceUrl = officialUrl(anchor.attr("href"), baseUrl);
  if (!title || !sourceUrl) return null;
  const titles = [...parentTitles, title];
  const path = titles.map(slugify);
  const children = [];
  node.children("ul").first().children("li").each((_, child) => {
    const parsed = parseTreeItem($, child, titles, baseUrl);
    if (parsed) children.push(parsed);
  });
  return { title, sourceUrl, path, children };
}

function parseServiceTree(html, root, baseUrl) {
  const $ = cheerio.load(html || "", { decodeEntities: false });
  let rootLi = null;
  $("ul.abm-category-container-content-list a[href],ul.abm-page-category-nav-list a[href]").each((_, anchor) => {
    if (rootLi) return;
    if (normalized($(anchor).text() || $(anchor).attr("title")) === normalized(root.title)) rootLi = $(anchor).closest("li");
  });
  if (!rootLi?.length) throw new Error(`${root.title}: official Service navigation root not found`);
  const parsed = parseTreeItem($, rootLi.get(0), [], baseUrl);
  if (!parsed) throw new Error(`${root.title}: official Service navigation could not be parsed`);
  return parsed;
}

function flattenTree(root) {
  const out = [];
  const visit = (node) => {
    out.push(node);
    node.children.forEach(visit);
  };
  visit(root);
  return out;
}

function extractLanding(html, sourceUrl, expectedTitle, internalRoutes) {
  const $ = cheerio.load(html || "", { decodeEntities: false });
  let root = $("#abm-category-right-outer").first();
  if (!root.length) root = $("#content").first();
  if (!root.length) root = $("main").first();
  if (!root.length) root = $("#product-product,.product-product,.main-content").first();
  if (!root.length) root = $("body").first();
  if (!root.length) throw new Error(`${expectedTitle}: page content root not found`);

  const work = root.clone();
  work.find("header,footer,nav,script,style,noscript,form,.breadcrumb,.breadcrumbs,.abm-top-nav,.abm-nav,.abm-category-container,ul.abm-page-category-nav-list").remove();
  work.find("h1,h2.abm-categories-title-h2").filter((_, heading) => normalized($(heading).text()) === normalized(expectedTitle)).first().remove();
  let htmlOut = sanitizeAbmStoredHtml(work.html() || "", sourceUrl);
  const scrub = cheerio.load(`<div id="__landing">${htmlOut}</div>`, { decodeEntities: false });
  scrub("#__landing *").toArray().reverse().forEach((element) => {
    const node = scrub(element);
    const text = clean(node.text());
    if (/(?:\$\s*\d|\b(?:USD|CAD)\s+\d)/i.test(text)) node.remove();
  });
  htmlOut = sanitizeAbmStoredHtml(scrub("#__landing").html() || "", sourceUrl);
  const routed = cheerio.load(`<div id="__landing">${htmlOut}</div>`, { decodeEntities: false });
  routed("#__landing a[href]").each((_, anchor) => {
    const node = routed(anchor);
    const rawHref = String(node.attr("href") || "").trim();
    // Preserve source-page section navigation. Rewriting these to the current
    // route used to discard #workflow/#project-inquiry and made the CTA buttons inert.
    if (/^#[A-Za-z][A-Za-z0-9_:-]*$/.test(rawHref)) {
      node.attr("href", rawHref).removeAttr("target").removeAttr("rel");
      return;
    }
    let absolute = "";
    try {
      const url = new URL(rawHref, sourceUrl);
      if (["http:", "https:"].includes(url.protocol)) absolute = url.toString();
    } catch { /* invalid link is removed below */ }
    if (!absolute) {
      node.removeAttr("href").removeAttr("target").removeAttr("rel");
      return;
    }
    const internalPath = internalRoutes.get(canonicalUrl(absolute, sourceUrl));
    node
      .attr("href", internalPath ? `/products/abm/services/${internalPath.join("/")}` : `/products/abm/legacy?u=${encodeURIComponent(absolute)}`)
      .removeAttr("target")
      .removeAttr("rel");
  });
  htmlOut = routed("#__landing").html() || "";
  if (!clean(cheerio.load(`<div>${htmlOut}</div>`)("body").text())) {
    throw new Error(`${expectedTitle}: extracted landing content is empty`);
  }
  if (/(?:\$\s*\d|\b(?:USD|CAD)\s+\d)|(?:add\s+to\s+cart|>\s*quantity\s*<)/i.test(htmlOut)) {
    throw new Error(`${expectedTitle}: commerce data remains after sanitization`);
  }
  const parsed = cheerio.load(`<div id="__landing">${htmlOut}</div>`, { decodeEntities: false });
  const images = [...new Set(parsed("#__landing img[src]").toArray().map((image) => officialUrl(parsed(image).attr("src"), sourceUrl)).filter(Boolean))];
  return { html: htmlOut, images };
}

async function pool(items, workers, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      out[index] = await fn(items[index], index);
    }
  }));
  return out;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const rootPages = [];
  for (const root of ROOTS) {
    const fetched = await fetchHtml(root.url);
    rootPages.push({ root, fetched, tree: parseServiceTree(fetched.html, root, fetched.finalUrl) });
  }

  const navigation = rootPages.map((entry) => entry.tree);
  const nodes = [...new Map(navigation.flatMap(flattenTree).map((node) => [node.path.join("/"), node])).values()];
  const internalRoutes = new Map(nodes.map((node) => [canonicalUrl(node.sourceUrl, node.sourceUrl), node.path]));
  const rootHtmlByUrl = new Map(rootPages.map((entry) => [officialUrl(entry.fetched.finalUrl, entry.root.url), entry.fetched]));
  const results = await pool(nodes, WORKERS, async (node, index) => {
    if (index % 10 === 0) console.log(`[service landing] ${index}/${nodes.length}`);
    const canonical = officialUrl(node.sourceUrl, node.sourceUrl);
    const fetched = rootHtmlByUrl.get(canonical) || await fetchHtml(node.sourceUrl);
    const landing = extractLanding(fetched.html, fetched.finalUrl, node.title, internalRoutes);
    return {
      kind: "service",
      pathKey: node.path.join("/"),
      path: node.path,
      title: node.title,
      sourceUrl: fetched.finalUrl,
      html: landing.html,
      images: landing.images,
      children: node.children.map((child) => ({ title: child.title, path: child.path, sourceUrl: child.sourceUrl })),
      collectedAt: new Date().toISOString(),
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    roots: navigation.length,
    landings: results.length,
    withImages: results.filter((row) => row.images.length).length,
    emptyContent: results.filter((row) => !clean(row.html)).length,
    priceLeaks: results.filter((row) => /(?:\$\s*\d|\b(?:USD|CAD)\s+\d)/i.test(row.html)).length,
    sanityWrites: 0,
  };
  if (report.roots !== 3 || report.landings < 20 || report.emptyContent || report.priceLeaks) {
    throw new Error(`Service landing QA failed: ${JSON.stringify(report)}`);
  }
  fs.writeFileSync(path.join(OUT, "navigation.json"), JSON.stringify(navigation, null, 2));
  fs.writeFileSync(path.join(OUT, "landings.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error("[ABM service landing] FATAL", error?.stack || error);
  process.exit(1);
});
