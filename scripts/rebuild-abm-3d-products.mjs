#!/usr/bin/env node

import * as cheerio from "cheerio";
import { createClient } from "next-sanity";

import { sanitizeAbmStoredHtml } from "../lib/abm/rebuild-parser.mjs";
import { createAbmImageRehoster, isManagedAbmImageUrl } from "./lib/abm-sanity-image-assets.mjs";

const APPLY = process.argv.includes("--apply");
const projectId = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const dataset = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const apiVersion = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const token = [
  process.env.SANITY_WRITE_TOKEN,
  process.env.SANITY_API_WRITE_TOKEN,
  process.env.SANITY_API_TOKEN,
  process.env.SANITY_TOKEN,
  process.env.SANITY_AUTH_TOKEN,
].map((v) => String(v || "").trim()).find(Boolean) || undefined;
if (APPLY && !token) throw new Error("Sanity write token is required with --apply");

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });
const clean = (v) => String(v || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PARENT = ["cellular-materials", "3d-and-organoid"];
const PAGES = [
  {
    key: "parent",
    title: "3D & Organoid",
    path: PARENT,
    canonical: "https://www.abmgood.com/3d-organoid-products.html",
    fallbacks: ["https://beta.abmgood.com/3d-organoid-products.html", "https://alpha.abmgood.com/3d-organoid-products.html"],
    order: 30,
    markers: ["3D", "Organoid"],
  },
  {
    key: "platforms",
    title: "3D Culture Platforms",
    path: [...PARENT, "3d-culture-platforms"],
    canonical: "https://www.abmgood.com/3d-culture-platforms.html",
    fallbacks: ["https://beta.abmgood.com/3d-culture-platforms.html", "https://alpha.abmgood.com/3d-culture-platforms.html"],
    order: 10,
    markers: ["SpheroWell", "3D Cell Culture"],
  },
  {
    key: "matrix",
    title: "3DCelMatrix™",
    path: [...PARENT, "3dcelmatrix"],
    canonical: "https://www.abmgood.com/3DCelMatrix.html",
    fallbacks: ["https://beta.abmgood.com/3DCelMatrix.html", "https://alpha.abmgood.com/3DCelMatrix.html"],
    order: 20,
    markers: ["3DCelMatrix", "3D Cell Culture"],
  },
];

function pageText(html) {
  const $ = cheerio.load(String(html || ""), { decodeEntities: false });
  $("script,style,noscript,svg").remove();
  return clean($.root().text());
}

async function fetchOfficial(page) {
  const attempts = [page.canonical, ...page.fallbacks];
  const failures = [];
  for (const url of attempts) {
    for (let n = 1; n <= 3; n += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 40_000);
      try {
        const res = await fetch(url, {
          cache: "no-store",
          redirect: "follow",
          signal: controller.signal,
          headers: {
            accept: "text/html,application/xhtml+xml",
            "accept-language": "en-US,en;q=0.9",
            "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-3D-Products/1.0; +https://itsbio.vercel.app)",
          },
        });
        const html = await res.text();
        const text = pageText(html);
        const finalUrl = res.url || url;
        const missing = page.markers.filter((m) => !text.toLowerCase().includes(m.toLowerCase()));
        if (res.ok && text.length > 1200 && !/pagenotfound/i.test(finalUrl) && !missing.length) {
          return { html, finalUrl };
        }
        failures.push(`${url} #${n}: HTTP ${res.status}, len=${text.length}, missing=${missing.join("|") || "none"}`);
      } catch (error) {
        failures.push(`${url} #${n}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        clearTimeout(timer);
      }
      await sleep(700 * n);
    }
  }
  throw new Error(`${page.title}: no valid official source. ${failures.slice(-9).join(" ; ")}`);
}

function pickContentRoot($) {
  for (const selector of ["#abm-category-right-outer", "#content", "main", "#product-product", ".product-product", ".main-content"]) {
    const node = $(selector).first();
    if (node.length) return node;
  }
  return $("body").first();
}

function normalizeSourceImageHosts(root, $, finalUrl) {
  let host;
  try { host = new URL(finalUrl).hostname; } catch { host = "www.abmgood.com"; }
  root.find("img").each((_, image) => {
    const node = $(image);
    const raw = clean(node.attr("src") || node.attr("data-src"));
    if (!raw) return;
    try {
      const url = new URL(raw, finalUrl);
      if (url.hostname === "abmgood.com" || url.hostname.endsWith(".abmgood.com")) {
        url.protocol = "https:";
        url.hostname = host;
        node.attr("src", url.toString());
      }
    } catch { /* sanitizer handles invalid media */ }
  });
}

function removeCommerce(root, $) {
  const commerce = /(?:^|\b)(?:price|pricing|wholesale|add to cart|buy now|apply now|early adopter|limited early access)(?:\b|$)|(?:\$\s*\d)|(?:\b(?:USD|CAD)\s*\d)/i;
  root.find("table").each((_, table) => {
    const node = $(table);
    const heads = node.find("th").toArray().map((th) => clean($(th).text()));
    const removeIndexes = heads.map((h, i) => commerce.test(h) ? i : -1).filter((i) => i >= 0);
    if (!removeIndexes.length) return;
    node.find("tr").each((__, row) => {
      const cells = $(row).children("th,td");
      [...removeIndexes].sort((a,b) => b-a).forEach((i) => cells.eq(i).remove());
    });
  });
  root.find("h1,h2,h3,h4,h5,h6,p,div,section,article,aside,a,span,li").toArray().forEach((el) => {
    const node = $(el);
    const text = clean(node.text());
    if (!text || !commerce.test(text)) return;
    if (text.length <= 180) {
      const section = node.closest("section,article").first();
      if (section.length && clean(section.text()).length <= 1000) section.remove();
      else node.remove();
    }
  });
}

function rewriteKnown3dLinks(html) {
  const $ = cheerio.load(`<div id="__root">${html}</div>`, { decodeEntities: false });
  const map = [
    [/3d-organoid-products\.html/i, "/products/abm/cellular-materials/3d-and-organoid"],
    [/3d-culture-platforms\.html/i, "/products/abm/cellular-materials/3d-and-organoid/3d-culture-platforms"],
    [/3dcelmatrix\.html/i, "/products/abm/cellular-materials/3d-and-organoid/3dcelmatrix"],
  ];
  $("#__root a[href]").each((_, anchor) => {
    const node = $(anchor);
    const href = clean(node.attr("href"));
    for (const [pattern, target] of map) {
      if (pattern.test(href)) {
        node.attr("href", target).removeAttr("target").removeAttr("rel");
        return;
      }
    }
    const label = clean(node.text());
    if (/contact.*technical|technical.*specialist/i.test(label)) {
      node.attr("href", "/contact").removeAttr("target").removeAttr("rel");
    }
  });
  return $("#__root").html() || "";
}

function extractContent(page, sourceHtml, finalUrl) {
  const $ = cheerio.load(sourceHtml, { decodeEntities: false });
  const sourceRoot = pickContentRoot($);
  if (!sourceRoot.length) throw new Error(`${page.title}: content root not found`);
  const root = sourceRoot.clone();
  root.find([
    "header", "footer", "nav", "script", "style", "noscript", "form", "input", "select", "textarea", "button",
    ".breadcrumb", ".breadcrumbs", ".abm-top-nav", ".abm-nav", ".abm-category-container", "ul.abm-page-category-nav-list",
    "#footer", ".footer", ".footer-top", ".footer-bottom",
  ].join(",")).remove();
  normalizeSourceImageHosts(root, $, finalUrl);
  removeCommerce(root, $);

  // ITS BIO already renders the category title and side navigation.
  root.find("h1,h2.abm-categories-title-h2").first().remove();
  let html = sanitizeAbmStoredHtml(root.html() || "", finalUrl);
  html = rewriteKnown3dLinks(html);
  const text = pageText(html);
  if (text.length < 900) throw new Error(`${page.title}: extracted content too short (${text.length})`);
  if (/(?:\$\s*\d)|(?:\b(?:USD|CAD)\s*\d)|Early Adopter Pricing|Limited Early Access Opportunity|Add to Cart|Buy Now/i.test(text)) {
    throw new Error(`${page.title}: commerce text remains after cleanup`);
  }
  return { html, text };
}

const parent = await client.fetch(`*[
  _type == "category"
  && array::join(path, "/") == $key
  && (brandSlug == "abm" || themeKey == "abm" || brand->themeKey == "abm" || brand->slug.current == "abm")
][0]{_id,_rev,title,path,order,brand,brandSlug,themeKey,isActive,contentBlocks}`, { key: PARENT.join("/") });
if (!parent?._id) throw new Error("Existing ABM 3D & Organoid parent category not found");

const existingBranch = await client.fetch(`*[
  _type == "category"
  && path[0] == "cellular-materials"
  && path[1] == "3d-and-organoid"
]{_id,_rev,title,path,isActive,sourceUrl,order}`, {});

const imageRehoster = createAbmImageRehoster({ client: APPLY ? client : null, dryRun: !APPLY, logEvery: 10 });
const prepared = [];
for (const page of PAGES) {
  const fetched = await fetchOfficial(page);
  const extracted = extractContent(page, fetched.html, fetched.finalUrl);
  const html = await imageRehoster.rewriteHtml(extracted.html, fetched.finalUrl);
  const text = pageText(html);
  const images = [...new Set(cheerio.load(html)("img[src]").toArray().map((img) => clean(cheerio.load(html)(img).attr("src"))).filter(Boolean))];
  if (APPLY && images.some((url) => !isManagedAbmImageUrl(url))) throw new Error(`${page.title}: unmanaged image remains`);
  prepared.push({ ...page, fetchedFrom: fetched.finalUrl, html, text, images });
}

const brandFields = {
  brand: parent.brand,
  brandSlug: parent.brandSlug || "abm",
  themeKey: parent.themeKey || "abm",
};
const allowedThirdSegments = new Set(["3d-culture-platforms", "3dcelmatrix"]);

if (APPLY) {
  const tx = client.transaction();
  const parentPrepared = prepared.find((x) => x.key === "parent");
  tx.patch(parent._id, (patch) => patch.ifRevisionId(parent._rev).set({
    title: "3D & Organoid",
    sourceUrl: parentPrepared.canonical,
    legacyHtml: parentPrepared.html,
    contentBlocks: [{ _type: "contentBlockHtml", _key: "abm-3d-organoid-products", title: "3D & Organoid", html: parentPrepared.html }],
    isActive: true,
  }));

  for (const item of prepared.filter((x) => x.key !== "parent")) {
    const existing = existingBranch.find((c) => Array.isArray(c.path) && c.path.join("/") === item.path.join("/"));
    const id = existing?._id || `category-abm-${item.key === "platforms" ? "3d-culture-platforms" : "3dcelmatrix"}`;
    tx.createOrReplace({
      _id: id,
      _type: "category",
      ...brandFields,
      title: item.title,
      path: item.path,
      order: item.order,
      sourceUrl: item.canonical,
      isActive: true,
      legacyHtml: item.html,
      contentBlocks: [{ _type: "contentBlockHtml", _key: `abm-${item.key}-current`, title: item.title, html: item.html }],
    });
  }

  // User-requested side-tab structure: only the two specified product children
  // should appear directly/virtually under 3D & Organoid. Deactivate all other
  // branches beneath this parent so active descendants cannot recreate a virtual tab.
  for (const category of existingBranch) {
    if (!Array.isArray(category.path) || category.path.length < 3) continue;
    const third = category.path[2];
    if (!allowedThirdSegments.has(third)) tx.patch(category._id, { set: { isActive: false } });
  }

  await tx.commit({ autoGenerateArrayKeys: true, visibility: "sync" });
}

const verified = APPLY ? await client.fetch(`*[
  _type == "category"
  && path[0] == "cellular-materials"
  && path[1] == "3d-and-organoid"
]{_id,title,path,isActive,sourceUrl,order,"html":contentBlocks[_type=="contentBlockHtml"][0].html}`, {}) : prepared.map((item) => ({ title: item.title, path: item.path, isActive: true, sourceUrl: item.canonical, html: item.html }));

const active = verified.filter((x) => x.isActive !== false);
const directChildren = active.filter((x) => Array.isArray(x.path) && x.path.length === 3).sort((a,b) => (a.order ?? 999) - (b.order ?? 999));
const wanted = ["3d-culture-platforms", "3dcelmatrix"];
if (directChildren.length !== 2 || directChildren.some((c, i) => c.path[2] !== wanted[i])) {
  throw new Error(`Unexpected 3D side-tab structure: ${directChildren.map((c) => c.path.join("/")).join(", ")}`);
}
for (const page of PAGES) {
  const record = active.find((x) => Array.isArray(x.path) && x.path.join("/") === page.path.join("/"));
  if (!record) throw new Error(`${page.title}: verified category missing`);
  if (record.sourceUrl !== page.canonical) throw new Error(`${page.title}: sourceUrl mismatch`);
  if (pageText(record.html).length < 900) throw new Error(`${page.title}: verified HTML too short`);
}

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  hierarchy: {
    parent: PARENT.join("/"),
    directChildren: directChildren.map((c) => ({ title: c.title, path: c.path.join("/"), sourceUrl: c.sourceUrl })),
  },
  pages: prepared.map((p) => ({ title: p.title, path: p.path.join("/"), fetchedFrom: p.fetchedFrom, sourceUrl: p.canonical, textLength: p.text.length, images: p.images.length })),
  assets: imageRehoster.stats,
}, null, 2));
