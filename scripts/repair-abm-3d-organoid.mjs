#!/usr/bin/env node

import * as cheerio from "cheerio";
import { createClient } from "next-sanity";

import { sanitizeAbmStoredHtml } from "../lib/abm/rebuild-parser.mjs";
import { createAbmImageRehoster, isManagedAbmImageUrl } from "./lib/abm-sanity-image-assets.mjs";

const VERSION = "2026-08-09-search-v5";
const APPLY = process.argv.includes("--apply");
const CATEGORY_PATH = ["cellular-materials", "3d-and-organoid"];
const CATEGORY_PATH_KEY = CATEGORY_PATH.join("/");
const SERVICE_PATH_KEY = "cell-and-antibody-services/3d-and-organoid-services";
const MATRIX_CANONICAL = "https://www.abmgood.com/3DCelMatrix.html";
const SERVICE_CANONICAL = "https://www.abmgood.com/3d-organoid-services.html";
const MATRIX_URLS = [
  MATRIX_CANONICAL,
  "https://beta.abmgood.com/3DCelMatrix.html",
  "https://alpha.abmgood.com/3DCelMatrix.html",
];
const SERVICE_URLS = [
  SERVICE_CANONICAL,
  "https://beta.abmgood.com/3d-organoid-services.html",
  "https://alpha.abmgood.com/3d-organoid-services.html",
];

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

if (APPLY && !token) throw new Error("A Sanity write token is required with --apply");
const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function pageText(html) {
  const $ = cheerio.load(String(html || ""), { decodeEntities: false });
  $("script,style,noscript,svg").remove();
  return clean($.root().text());
}

async function fetchOfficial(label, urls, requiredMarkers) {
  const failures = [];
  for (const sourceUrl of urls) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 35_000);
      try {
        const response = await fetch(sourceUrl, {
          cache: "no-store",
          redirect: "follow",
          signal: controller.signal,
          headers: {
            accept: "text/html,application/xhtml+xml",
            "accept-language": "en-US,en;q=0.9",
            "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-3D-Repair/1.0; +https://itsbio.vercel.app)",
          },
        });
        const html = await response.text();
        const finalUrl = response.url || sourceUrl;
        const text = pageText(html);
        const missing = requiredMarkers.filter((marker) => !text.includes(marker));
        if (
          response.ok
          && !/pagenotfound/i.test(new URL(finalUrl).pathname)
          && !/page you are looking for can(?:not|'t) be found/i.test(text)
          && !missing.length
        ) {
          return { html, finalUrl, requestedUrl: sourceUrl };
        }
        failures.push(`${sourceUrl} attempt ${attempt}: HTTP ${response.status}; missing=${missing.join(",") || "none"}`);
      } catch (error) {
        failures.push(`${sourceUrl} attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        clearTimeout(timer);
      }
      await sleep(900 * attempt);
    }
  }
  throw new Error(`${label}: no current official ABM host was reachable and valid. ${failures.slice(-9).join(" | ")}`);
}

function pickContentRoot($) {
  for (const selector of ["#abm-category-right-outer", "#content", "main", "#product-product", ".product-product", ".main-content"]) {
    const root = $(selector).first();
    if (root.length) return root;
  }
  return $("body").first();
}

function normalizeOfficialImageHosts(work, $, finalUrl) {
  let host = "www.abmgood.com";
  try { host = new URL(finalUrl).hostname; } catch { /* canonical host */ }
  work.find("img").each((_, image) => {
    const node = $(image);
    const raw = String(node.attr("src") || node.attr("data-src") || "").trim();
    if (!raw) return;
    try {
      const url = new URL(raw, finalUrl);
      if (url.hostname === "abmgood.com" || url.hostname.endsWith(".abmgood.com")) {
        url.protocol = "https:";
        url.hostname = host;
        node.attr("src", url.toString());
      }
    } catch { /* sanitizer will handle or discard */ }
  });
}

function removeSourceChrome(work) {
  work.find([
    "header", "footer", "nav", "script", "style", "noscript", "form", "input", "select", "textarea", "button",
    ".breadcrumb", ".breadcrumbs", ".abm-top-nav", ".abm-nav", ".abm-category-container", "ul.abm-page-category-nav-list",
    "#footer", ".footer", ".footer-top", ".footer-bottom",
  ].join(",")).remove();
}

function removeSmallMarkerBlocks(work, $, patterns) {
  work.find("h1,h2,h3,h4,h5,h6,p,div,section,article,aside,a,span").toArray().forEach((element) => {
    const node = $(element);
    const text = clean(node.text());
    if (!text || !patterns.some((pattern) => pattern.test(text))) return;
    if (text.length <= 220) {
      const section = node.closest("section,article").first();
      const sectionText = clean(section.text());
      if (section.length && sectionText.length <= 1400) section.remove();
      else node.remove();
    }
  });
}

function cleanupMatrixSource(sourceHtml, finalUrl) {
  const $ = cheerio.load(sourceHtml, { decodeEntities: false });
  const root = pickContentRoot($);
  if (!root.length) throw new Error("3DCelMatrix: source content root was not found");
  const work = root.clone();
  removeSourceChrome(work);
  normalizeOfficialImageHosts(work, $, finalUrl);

  work.find("h1,h2.abm-categories-title-h2").filter((_, heading) => /^(?:3D\s*(?:and|&)\s*Organoid|3DCelMatrix(?:™)?(?:\s+ECM\s+Solution)?)$/i.test(clean($(heading).text()))).remove();
  work.find("a").filter((_, anchor) => /^Apply Now$/i.test(clean($(anchor).text()))).remove();
  removeSmallMarkerBlocks(work, $, [
    /^Limited Early Access Opportunity$/i,
    /^Apply for 3DCelMatrix.*Early Adopter Pricing$/i,
  ]);

  let html = sanitizeAbmStoredHtml(work.html() || "", finalUrl);
  const routed = cheerio.load(`<div id="__matrix">${html}</div>`, { decodeEntities: false });

  routed("#__matrix a[href]").each((_, anchor) => {
    const node = routed(anchor);
    const label = clean(node.text());
    const href = String(node.attr("href") || "").trim();
    if (/^Apply Now$/i.test(label)) { node.remove(); return; }
    if (/View Product Page/i.test(label) || /3DCell?Matrix.*tm076/i.test(href)) {
      node.attr("href", "/products/abm/staged/product/TM076").removeAttr("target").removeAttr("rel");
      return;
    }
    if (/Contact a Technical Specialist/i.test(label)) {
      node.attr("href", "/contact").removeAttr("target").removeAttr("rel");
    }
  });

  const relatedSkus = ["G7540", "G7541", "G7542", "G7543", "TM209", "TM210"];
  routed("#__matrix tr").each((_, row) => {
    const cells = routed(row).children("th,td");
    if (!cells.length) return;
    const sku = clean(cells.eq(0).text()).toUpperCase();
    if (!relatedSkus.includes(sku)) return;
    const href = `/products/abm/staged/product/${encodeURIComponent(sku)}`;
    if (!cells.eq(0).find("a").length) cells.eq(0).html(`<a href="${href}">${sku}</a>`);
    const productCell = cells.eq(1);
    if (productCell.length && !productCell.find("a").length) productCell.wrapInner(`<a href="${href}"></a>`);
  });

  html = routed("#__matrix").html() || "";
  return `<div class="organoid-page matrix-page">${html}</div>`;
}

function cleanupServiceSource(sourceHtml, finalUrl) {
  const $ = cheerio.load(sourceHtml, { decodeEntities: false });
  const root = pickContentRoot($);
  if (!root.length) throw new Error("3D Organoid service: source content root was not found");
  const work = root.clone();
  removeSourceChrome(work);
  normalizeOfficialImageHosts(work, $, finalUrl);
  work.find("h1,h2.abm-categories-title-h2").filter((_, heading) => /^3D\s*(?:and|&)\s*Organoid Services$/i.test(clean($(heading).text()))).remove();

  work.find("h1,h2,h3,h4,h5,h6").filter((_, heading) => /Submit your organoid services project form/i.test(clean($(heading).text()))).each((_, heading) => {
    const node = $(heading);
    const section = node.closest("section,article").first();
    if (section.length && clean(section.text()).length <= 1800) section.remove();
    else node.remove();
  });

  let html = sanitizeAbmStoredHtml(work.html() || "", finalUrl);
  const routed = cheerio.load(`<div id="__service">${html}</div>`, { decodeEntities: false });
  routed("#__service a[href]").each((_, anchor) => {
    const node = routed(anchor);
    const label = clean(node.text());
    const href = String(node.attr("href") || "").trim();
    if (/Submit Project Inquiry/i.test(label)) {
      node.attr("href", "/quote?product=3D%20and%20Organoid%20Services").removeAttr("target").removeAttr("rel");
      return;
    }
    if (/^#(?:workflow|models|top|how-it-works)/i.test(href)) node.removeAttr("target").removeAttr("rel");
  });
  html = routed("#__service").html() || "";
  if (!/class=["'][^"']*organoid-page/i.test(html)) html = `<div class="organoid-page">${html}</div>`;
  return html;
}

function validateMatrix(html) {
  const text = pageText(html);
  const required = [
    "3DCelMatrix™ ECM Solution Product Highlights",
    "Flexible ECM Workflows for Thin Gel, Thick Gel, and Coating Applications",
    "Simple 5-Step 3D Cell Culture Workflow",
    "3D Cell Culture Applications",
    "3DCelMatrix™ Technical Specifications",
    "Representative Organoid, Spheroid, and iPSC Culture Results",
    "Related Products for 3D Cell Culture Workflows",
    "Frequently Asked Questions About 3DCelMatrix™",
  ];
  const missing = required.filter((marker) => !text.includes(marker));
  if (missing.length) throw new Error(`3DCelMatrix sections missing: ${missing.join(" | ")}`);
  for (const sku of ["TM076", "G7540", "G7541", "G7542", "G7543", "TM209", "TM210"]) {
    if (!text.includes(sku)) throw new Error(`3DCelMatrix related/spec catalog number missing: ${sku}`);
  }
  if (/(?:\$\s*\d|\b(?:USD|CAD)\s+\d)|Early Adopter Pricing|Limited Early Access Opportunity|\bApply Now\b/i.test(text)) {
    throw new Error("3DCelMatrix commerce campaign data remains after cleanup");
  }
  return text;
}

function validateService(html) {
  const text = pageText(html);
  const required = [
    "Your research, in 3D. Custom organoid models built around your science.",
    "A project-based process built around you",
    "Organoid model options for custom development",
    "Additional testing to support downstream applications",
    "Comprehensive support from start to finish",
    "Purpose-built for every stage of drug discovery and disease research",
    "Frequently asked questions",
  ];
  const missing = required.filter((marker) => !text.includes(marker));
  if (missing.length) throw new Error(`3D Organoid service sections missing: ${missing.join(" | ")}`);
  if (/Submit your organoid services project form/i.test(text)) throw new Error("Source project form shell remains in service landing");
  if (/(?:\$\s*\d|\b(?:USD|CAD)\s+\d)/i.test(text)) throw new Error("Commerce data remains in 3D Organoid service landing");
  return text;
}

const categoryTarget = await client.fetch(
  `*[
    _type == "category"
    && array::join(path, "/") == $pathKey
    && (
      brandSlug == "abm"
      || themeKey == "abm"
      || brand->themeKey == "abm"
      || brand->slug.current == "abm"
    )
  ][0]{_id,_rev,title,path,sourceUrl,contentBlocks}`,
  { pathKey: CATEGORY_PATH_KEY },
);
if (!categoryTarget?._id) throw new Error(`ABM category not found: ${CATEGORY_PATH_KEY}`);

const serviceTarget = await client.fetch(
  `*[
    _type == "abmRebuildLandingChunk"
    && version == $version
    && kind == "service"
    && $pathKey in records[].pathKey
  ][0]{_id,_rev,"record":records[pathKey == $pathKey][0]}`,
  { version: VERSION, pathKey: SERVICE_PATH_KEY },
);
if (!serviceTarget?._id || !serviceTarget.record?._key) throw new Error(`ABM service landing not found: ${SERVICE_PATH_KEY}`);

const matrixFetched = await fetchOfficial("3DCelMatrix", MATRIX_URLS, [
  "3DCelMatrix™ ECM Solution Product Highlights",
  "3DCelMatrix™ Technical Specifications",
  "Frequently Asked Questions About 3DCelMatrix™",
]);
const serviceFetched = await fetchOfficial("3D Organoid service", SERVICE_URLS, [
  "Your research, in 3D. Custom organoid models built around your science.",
  "Comprehensive support from start to finish",
  "Frequently asked questions",
]);

const matrixExtracted = cleanupMatrixSource(matrixFetched.html, matrixFetched.finalUrl);
const serviceExtracted = cleanupServiceSource(serviceFetched.html, serviceFetched.finalUrl);
validateMatrix(matrixExtracted);
validateService(serviceExtracted);

const imageRehoster = createAbmImageRehoster({ client: APPLY ? client : null, dryRun: !APPLY, logEvery: 10 });
const matrixHtml = await imageRehoster.rewriteHtml(matrixExtracted, matrixFetched.finalUrl);
const serviceHtml = await imageRehoster.rewriteHtml(serviceExtracted, serviceFetched.finalUrl);
const matrixText = validateMatrix(matrixHtml);
const serviceText = validateService(serviceHtml);

function managedImagesFromHtml(html) {
  const $ = cheerio.load(String(html || ""), { decodeEntities: false });
  return [...new Set($("img[src]").toArray().map((image) => clean($(image).attr("src"))).filter(Boolean))];
}

const matrixImages = managedImagesFromHtml(matrixHtml);
const serviceImagesFromHtml = managedImagesFromHtml(serviceHtml);
const existingServiceManaged = Array.isArray(serviceTarget.record.images)
  ? serviceTarget.record.images.map(clean).filter((url) => url && isManagedAbmImageUrl(url))
  : [];
const serviceImages = serviceImagesFromHtml.length ? serviceImagesFromHtml : existingServiceManaged;
if (APPLY) {
  if (matrixImages.some((url) => !isManagedAbmImageUrl(url))) throw new Error("Unmanaged 3DCelMatrix image remains after repair");
  if (serviceImages.some((url) => !isManagedAbmImageUrl(url))) throw new Error("Unmanaged organoid service image remains after repair");
  if (matrixImages.length < 8) throw new Error(`Expected at least 8 managed 3DCelMatrix images, found ${matrixImages.length}`);
  if (serviceImages.length < 5) throw new Error(`Expected at least 5 managed organoid service images, found ${serviceImages.length}`);
}

const categoryBlockKey = categoryTarget.contentBlocks?.find((block) => block?._type === "contentBlockHtml")?._key || "3dcelmatrix-current";
const categoryPatch = {
  sourceUrl: MATRIX_CANONICAL,
  legacyHtml: matrixHtml,
  contentBlocks: [{
    _type: "contentBlockHtml",
    _key: categoryBlockKey,
    title: "3DCelMatrix™",
    html: matrixHtml,
  }],
};
const serviceRecord = {
  ...serviceTarget.record,
  sourceUrl: SERVICE_CANONICAL,
  html: serviceHtml,
  images: serviceImages,
  collectedAt: new Date().toISOString(),
};

if (APPLY) {
  await client.transaction()
    .patch(categoryTarget._id, (patch) => patch.ifRevisionId(categoryTarget._rev).set(categoryPatch))
    .patch(serviceTarget._id, (patch) => patch.ifRevisionId(serviceTarget._rev).set({ [`records[_key=="${serviceTarget.record._key}"]`]: serviceRecord }))
    .commit({ autoGenerateArrayKeys: true, visibility: "sync" });
}

const verifiedCategory = APPLY ? await client.fetch(
  `*[_id == $id][0]{sourceUrl,contentBlocks[] {_key,_type,title,html}}`,
  { id: categoryTarget._id },
) : { ...categoryTarget, ...categoryPatch };
const verifiedService = APPLY ? await client.fetch(
  `*[_id == $id][0].records[pathKey == $pathKey][0]{sourceUrl,html,images,collectedAt}`,
  { id: serviceTarget._id, pathKey: SERVICE_PATH_KEY },
) : serviceRecord;

const verifiedMatrixHtml = verifiedCategory?.contentBlocks?.find((block) => block?._type === "contentBlockHtml")?.html || "";
const verifiedMatrixText = validateMatrix(verifiedMatrixHtml);
const verifiedServiceText = validateService(verifiedService?.html || "");
if (verifiedCategory?.sourceUrl !== MATRIX_CANONICAL) throw new Error("3DCelMatrix category source URL verification failed");
if (verifiedService?.sourceUrl !== SERVICE_CANONICAL) throw new Error("3D Organoid service source URL verification failed");

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  category: {
    id: categoryTarget._id,
    path: CATEGORY_PATH_KEY,
    fetchedFrom: matrixFetched.finalUrl,
    sourceUrl: verifiedCategory.sourceUrl,
    textLength: verifiedMatrixText.length,
    images: managedImagesFromHtml(verifiedMatrixHtml).length,
  },
  service: {
    documentId: serviceTarget._id,
    pathKey: SERVICE_PATH_KEY,
    fetchedFrom: serviceFetched.finalUrl,
    sourceUrl: verifiedService.sourceUrl,
    textLength: verifiedServiceText.length,
    images: verifiedService.images?.length || 0,
  },
  assets: imageRehoster.stats,
}, null, 2));
