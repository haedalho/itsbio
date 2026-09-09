#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import * as cheerio from "cheerio";
import { createClient } from "next-sanity";

import { sanitizeAbmStoredHtml } from "../lib/abm/rebuild-parser.mjs";
import { createAbmImageRehoster, isManagedAbmImageUrl } from "./lib/abm-sanity-image-assets.mjs";

const APPLY = process.argv.includes("--apply");
const ROOT_PATH = ["cellular-materials"];
const TAXONOMY_FILE = path.resolve("data/abm-cellular-taxonomy.json");
const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_FILE, "utf8"));

const projectId = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const dataset = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const apiVersion = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const token = [
  process.env.SANITY_WRITE_TOKEN,
  process.env.SANITY_API_WRITE_TOKEN,
  process.env.SANITY_API_TOKEN,
  process.env.SANITY_TOKEN,
  process.env.SANITY_AUTH_TOKEN,
].map((value) => String(value || "").trim()).find(Boolean) || undefined;
if (APPLY && !token) throw new Error("Sanity write token is required with --apply");

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function flattenTaxonomy(items, parentPath = ROOT_PATH) {
  return items.flatMap((item, index) => {
    const pathValue = [...parentPath, item.slug];
    const current = {
      title: item.title,
      path: pathValue,
      sourceUrl: item.sourceUrl,
      order: (index + 1) * 10,
    };
    return [current, ...flattenTaxonomy(item.children || [], pathValue)];
  });
}

function urlIdentity(value) {
  try {
    const url = new URL(String(value || ""), "https://www.abmgood.com");
    return url.pathname.replace(/\/+$/, "").toLowerCase() || "/";
  } catch {
    return "";
  }
}

function htmlText(html) {
  const $ = cheerio.load(String(html || ""), { decodeEntities: false });
  $("script,style,noscript,svg").remove();
  return clean($.root().text());
}

function storedHtml(record) {
  const htmlBlock = Array.isArray(record?.contentBlocks)
    ? record.contentBlocks.find((block) => block?._type === "contentBlockHtml" && clean(block.html))
    : null;
  return clean(htmlBlock?.html) ? String(htmlBlock.html) : String(record?.legacyHtml || "");
}

function localHrefFor(sourceUrl, sourceToPath) {
  const target = sourceToPath.get(urlIdentity(sourceUrl));
  return target ? `/products/abm/${target.join("/")}` : "";
}

async function fetchOfficial(page) {
  const failures = [];
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(page.sourceUrl, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.9",
          "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-Cellular-Taxonomy/1.0; +https://itsbio.vercel.app)",
        },
      });
      const html = await response.text();
      const text = htmlText(html);
      if (response.ok && text.length > 120 && !/pagenotfound/i.test(response.url || "")) {
        return { html, finalUrl: response.url || page.sourceUrl };
      }
      failures.push(`#${attempt} HTTP ${response.status}, len=${text.length}`);
    } catch (error) {
      failures.push(`#${attempt} ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timer);
    }
    await sleep(800 * attempt);
  }
  throw new Error(`${page.title}: official source unavailable (${failures.join("; ")})`);
}

function pickContentRoot($) {
  for (const selector of ["#abm-category-right-outer", "#content", "main", ".main-content", "body"]) {
    const node = $(selector).first();
    if (node.length) return node;
  }
  return $("body").first();
}

function extractCategoryHtml(page, sourceHtml, finalUrl, sourceToPath) {
  const $ = cheerio.load(sourceHtml, { decodeEntities: false });
  const sourceRoot = pickContentRoot($);
  if (!sourceRoot.length) throw new Error(`${page.title}: content root not found`);
  const root = sourceRoot.clone();
  root.find([
    "header", "footer", "nav", "script", "style", "noscript", "form", "input", "select", "textarea",
    ".breadcrumb", ".breadcrumbs", ".abm-top-nav", ".abm-nav", ".abm-category-container",
    "ul.abm-page-category-nav-list", "#footer", ".footer", ".footer-top", ".footer-bottom",
    ".price", ".product-price", "[class*='price-box']", "[class*='add-to-cart']", "[class*='shopping-cart']",
  ].join(",")).remove();
  root.find("h2.abm-categories-title-h2").first().remove();

  let html = sanitizeAbmStoredHtml(root.html() || "", finalUrl);
  const rewritten = cheerio.load(`<div id="__category_root">${html}</div>`, { decodeEntities: false });
  rewritten("#__category_root a[href]").each((_, anchor) => {
    const node = rewritten(anchor);
    const localHref = localHrefFor(node.attr("href"), sourceToPath);
    if (localHref) node.attr("href", localHref).removeAttr("target").removeAttr("rel");
  });
  html = rewritten("#__category_root").html() || "";
  const text = htmlText(html);
  if (text.length < 60) throw new Error(`${page.title}: extracted category content too short (${text.length})`);
  if (/(?:\$\s*\d)|(?:\b(?:USD|CAD)\s*\d)|Add to Cart|Buy Now/i.test(text)) {
    throw new Error(`${page.title}: commerce text remains after cleanup`);
  }
  return html;
}

function deterministicId(pathValue) {
  const digest = crypto.createHash("sha1").update(pathValue.join("/")).digest("hex").slice(0, 16);
  return `category-abm-cellular-${digest}`;
}

const root = await client.fetch(`*[
  _type == "category"
  && array::join(path, "/") == "cellular-materials"
  && (brandSlug == "abm" || themeKey == "abm" || brand->themeKey == "abm" || brand->slug.current == "abm")
][0]{_id,_rev,title,path,brand,brandSlug,themeKey,isActive}`, {});
if (!root?._id) throw new Error("Existing ABM Cellular Materials root category not found");

const existing = await client.fetch(`*[
  _type == "category"
  && path[0] == "cellular-materials"
]{_id,_rev,title,path,sourceUrl,isActive,order,legacyHtml,contentBlocks}`, {});

const pages = flattenTaxonomy(taxonomy);
const expectedPaths = new Set(pages.map((page) => page.path.join("/")));
if (pages.length !== 56 || expectedPaths.size !== pages.length) {
  throw new Error(`Cellular taxonomy manifest is invalid: nodes=${pages.length}, uniquePaths=${expectedPaths.size}`);
}

const sourceToPath = new Map(pages.map((page) => [urlIdentity(page.sourceUrl), page.path]));
const existingByPath = new Map(existing.map((record) => [Array.isArray(record.path) ? record.path.join("/") : "", record]));
const existingBySource = new Map();
for (const record of existing) {
  const identity = urlIdentity(record.sourceUrl);
  if (!identity || existingBySource.has(identity)) continue;
  existingBySource.set(identity, record);
}

const imageRehoster = createAbmImageRehoster({ client: APPLY ? client : null, dryRun: !APPLY, logEvery: 10 });
const prepared = [];
for (const page of pages) {
  const pathKey = page.path.join("/");
  const exact = existingByPath.get(pathKey);
  const equivalent = existingBySource.get(urlIdentity(page.sourceUrl));
  const exactHasContent = Boolean(exact && (storedHtml(exact) || (Array.isArray(exact.contentBlocks) && exact.contentBlocks.length)));
  let contentBlocks = exactHasContent ? exact.contentBlocks : null;
  let legacyHtml = exactHasContent ? exact.legacyHtml : "";
  let contentOrigin = exactHasContent ? "existing-path" : "";

  if (!contentBlocks?.length && equivalent?.contentBlocks?.length) {
    contentBlocks = equivalent.contentBlocks;
    legacyHtml = equivalent.legacyHtml || "";
    contentOrigin = "existing-source";
  } else if (!storedHtml({ contentBlocks, legacyHtml }) && storedHtml(equivalent)) {
    legacyHtml = storedHtml(equivalent);
    contentBlocks = [{ _type: "contentBlockHtml", _key: `abm-cellular-${crypto.createHash("sha1").update(pathKey).digest("hex").slice(0, 12)}`, title: page.title, html: legacyHtml }];
    contentOrigin = "existing-source";
  }

  if (!contentBlocks?.length && clean(legacyHtml)) {
    contentBlocks = [{ _type: "contentBlockHtml", _key: `abm-cellular-${crypto.createHash("sha1").update(pathKey).digest("hex").slice(0, 12)}`, title: page.title, html: legacyHtml }];
  }

  if (!contentBlocks?.length && !clean(legacyHtml)) {
    const fetched = await fetchOfficial(page);
    let html = extractCategoryHtml(page, fetched.html, fetched.finalUrl, sourceToPath);
    html = await imageRehoster.rewriteHtml(html, fetched.finalUrl);
    if (APPLY) {
      const verify = cheerio.load(html);
      const unmanaged = verify("img[src]").toArray().map((image) => verify(image).attr("src")).filter((url) => !isManagedAbmImageUrl(url));
      if (unmanaged.length) throw new Error(`${page.title}: unmanaged image remains`);
    }
    legacyHtml = html;
    contentBlocks = [{ _type: "contentBlockHtml", _key: `abm-cellular-${crypto.createHash("sha1").update(pathKey).digest("hex").slice(0, 12)}`, title: page.title, html }];
    contentOrigin = "official-source";
  }

  prepared.push({ page, exact, contentBlocks, legacyHtml, contentOrigin });
  console.log(`[prepare] ${pathKey} (${exact ? "update" : "create"}; ${contentOrigin})`);
}

if (APPLY) {
  const brandFields = {
    brand: root.brand,
    brandSlug: root.brandSlug || "abm",
    themeKey: root.themeKey || "abm",
  };
  for (let offset = 0; offset < prepared.length; offset += 8) {
    const transaction = client.transaction();
    for (const item of prepared.slice(offset, offset + 8)) {
      const values = {
        ...brandFields,
        title: item.page.title,
        path: item.page.path,
        sourceUrl: item.page.sourceUrl,
        order: item.page.order,
        isActive: true,
        contentBlocks: item.contentBlocks || [],
        ...(clean(item.legacyHtml) ? { legacyHtml: item.legacyHtml } : {}),
      };
      if (item.exact) transaction.patch(item.exact._id, { set: values });
      else transaction.create({ _id: deterministicId(item.page.path), _type: "category", ...values });
    }
    await transaction.commit({ autoGenerateArrayKeys: true, visibility: "sync" });
  }
}

if (APPLY) {
  const verified = await client.fetch(`*[
    _type == "category"
    && path[0] == "cellular-materials"
    && isActive != false
  ]{_id,title,path,sourceUrl,contentBlocks}`, {});
  const verifiedByPath = new Map(verified.map((record) => [Array.isArray(record.path) ? record.path.join("/") : "", record]));
  const missing = pages.filter((page) => !verifiedByPath.has(page.path.join("/")));
  const empty = pages.filter((page) => {
    const record = verifiedByPath.get(page.path.join("/"));
    return record && (!Array.isArray(record.contentBlocks) || !record.contentBlocks.length);
  });
  if (missing.length || empty.length) {
    throw new Error(`Cellular taxonomy verification failed: missing=${missing.length}, empty=${empty.length}`);
  }
}

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  nodes: pages.length,
  created: prepared.filter((item) => !item.exact).length,
  updated: prepared.filter((item) => item.exact).length,
  fetched: prepared.filter((item) => item.contentOrigin === "official-source").length,
  cloned: prepared.filter((item) => item.contentOrigin === "existing-source").length,
  assets: imageRehoster.stats,
}, null, 2));
