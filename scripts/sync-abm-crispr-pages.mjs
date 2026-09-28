#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import dotenv from "dotenv";
import * as cheerio from "cheerio";
import { createClient } from "@sanity/client";

import { sanitizeAbmStoredHtml } from "../lib/abm/rebuild-parser.mjs";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const PROJECT_ID =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.SANITY_STUDIO_PROJECT_ID ||
  process.env.SANITY_PROJECT_ID ||
  "9b5twpc8";
const DATASET =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_STUDIO_DATASET ||
  process.env.SANITY_DATASET ||
  "production";
const TOKEN =
  process.env.SANITY_WRITE_TOKEN ||
  process.env.SANITY_API_WRITE_TOKEN ||
  process.env.SANITY_API_TOKEN ||
  process.env.SANITY_TOKEN ||
  process.env.SANITY_AUTH_TOKEN;
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";
const DRY_RUN = process.argv.includes("--dry-run");
const REPORT_DIR = path.join(process.cwd(), ".cache", "abm-crispr-sync");
const ABM_BASE = "https://www.abmgood.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";

const PAGES = [
  {
    path: "genetic-materials/crispr",
    sourceUrl: "https://www.abmgood.com/CRISPR-Cas9-sgRNA.html",
    sourceTitle: "CRISPR Genome Editing Tools and Services",
    required: [
      "What can we help you achieve?",
      "Find CRISPR sgRNA & Genome Editing Products for Your Gene",
      "Choose the Right CRISPR/Cas9 System",
      "CRISPR/Cas9 Products & Genome Editing Tools",
      "Frequently Asked CRISPR/Cas9 Questions",
    ],
    minText: 2500,
  },
  {
    path: "genetic-materials/crispr/crispr-ko-vectors-and-virus",
    sourceUrl: "https://www.abmgood.com/crispr-knockout-library.html",
    sourceTitle: "CRISPR Knockout sgRNA Vectors & Viruses",
    required: [
      "Find Your CRISPR Knockout Product",
      "Compare CRISPR Knockout Systems",
      "CRISPR Knockout Workflow",
      "CRISPR Knockout Resources",
      "CRISPR Knockout FAQs",
    ],
    minText: 2200,
  },
  {
    path: "genetic-materials/crispr/crispr-activation-vectors",
    sourceUrl: "https://www.abmgood.com/crispr-activation-lentivirus-library.html",
    sourceTitle: "CRISPR Activation & Repression",
    required: [
      "Activate Gene Expression with dCas9-VPR",
      "Choose CRISPRa sgRNAs for Your Gene",
      "Want to Repress Gene Expression Instead?",
      "Want Epigenetic Up- or Down-Regulation?",
      "Additional Information",
    ],
    minText: 1200,
  },
  {
    path: "genetic-materials/crispr/cas9-vectors-and-virus",
    sourceUrl: "https://www.abmgood.com/cas9-expression-vectors-and-viruses.html",
    sourceTitle: "Cas9 Expression Vectors and Viruses",
    required: [
      "Cas9 Vectors and Viruses",
      "sgRNA Vectors and Viruses",
      "Additional Information",
    ],
    minText: 700,
  },
  {
    path: "genetic-materials/crispr/cas-proteins-and-crispr-screening",
    sourceUrl: "https://www.abmgood.com/cas9-proteins.html",
    sourceTitle: "Cas Proteins & CRISPR Screening",
    required: [
      "Advantages of Cas9 RNP Delivery Method",
      "CRISPR Kits",
      "Resources",
    ],
    minText: 1000,
  },
];

if (!DRY_RUN && !TOKEN) {
  throw new Error("Missing a Sanity write token.");
}

fs.mkdirSync(REPORT_DIR, { recursive: true });

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: TOKEN,
  useCdn: false,
});

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalized(value) {
  return cleanText(value)
    .replace(/&amp;/gi, "&")
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .normalize("NFKC")
    .replace(/[™®©]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stableKey(value) {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 12);
}

function stripTags(html) {
  return cleanText(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function absoluteUrl(value, baseUrl) {
  const raw = String(value || "").trim();
  if (!raw || !/^https?:|^\//i.test(raw)) return "";
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return "";
  }
}

async function fetchWithRetry(url, asBuffer = false) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent": USER_AGENT,
          accept: asBuffer
            ? "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
            : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          referer: ABM_BASE,
          "cache-control": "no-cache",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      if (asBuffer) {
        return {
          buffer: Buffer.from(await response.arrayBuffer()),
          contentType: response.headers.get("content-type") || "",
          finalUrl: response.url || url,
        };
      }
      return {
        html: await response.text(),
        contentType: response.headers.get("content-type") || "",
        finalUrl: response.url || url,
      };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 700 + attempt * 650));
    }
  }
  throw lastError;
}

function sourceHeading($, title) {
  const wanted = normalized(title);
  const headings = $("h1,h2,h3");
  const exact = headings.filter((_, node) => normalized($(node).text()) === wanted).first();
  if (exact.length) return exact;
  return headings
    .filter((_, node) => {
      const value = normalized($(node).text());
      return value.length >= 18 && (value.includes(wanted) || wanted.includes(value));
    })
    .first();
}

function chooseContentRoot($, heading) {
  for (const selector of [
    "#abm-category-right-outer",
    ".abm-category-right-outer",
    "#abm-category-right",
    ".abm-category-right",
    ".category-content",
    ".category-page-content",
    ".main-content",
    "main",
    "#content",
  ]) {
    const match = heading.closest(selector);
    if (match.length) return match.first();
  }

  let current = heading.parent();
  let best = heading.parent();
  let guard = 0;
  while (current.length && guard < 8) {
    const textLength = cleanText(current.text()).length;
    if (textLength > cleanText(best.text()).length && textLength < 120000) best = current;
    if (textLength > 2500 && current.find("table,img,h2,h3").length >= 2) return current;
    current = current.parent();
    guard += 1;
  }
  return best.length ? best : $("body");
}

function removeSourceChrome($root, $) {
  const removeSelectors = [
    "script",
    "style",
    "noscript",
    "header",
    "footer",
    "nav",
    "aside",
    ".breadcrumb",
    ".breadcrumbs",
    ".page-breadcrumbs",
    ".abm-page-category-nav-list",
    "#abm-category-left-outer",
    ".abm-category-left-outer",
    "#column-left",
    ".column-left",
    ".sidebar",
    ".side-bar",
    ".newsletter",
    ".footer",
    ".site-footer",
    ".customer-service",
    ".social-links",
    ".toolbar",
    ".product-social-links",
  ];
  $root.find(removeSelectors.join(",")).remove();

  $root.find("a,button").each((_, element) => {
    const label = normalized($(element).text());
    const href = String($(element).attr("href") || "");
    if (
      /login to see prices|add to cart|checkout|request a quote|request quote|buy now/.test(label) ||
      /\/checkout|\/cart|customer\/account|request[-_/]?quote/i.test(href)
    ) {
      $(element).remove();
    }
  });
}

function extractOfficialFragment(page, sourceHtml) {
  const $ = cheerio.load(sourceHtml, { decodeEntities: false });
  const heading = sourceHeading($, page.sourceTitle);
  if (!heading.length) {
    throw new Error(`Official heading not found: ${page.sourceTitle}`);
  }

  const root = chooseContentRoot($, heading);
  removeSourceChrome(root, $);

  // If a broad fallback root was necessary, keep the actual official content
  // column rather than any sibling navigation that may still be present.
  const refreshedHeading = sourceHeading($, page.sourceTitle);
  let fragmentRoot = refreshedHeading.length ? chooseContentRoot($, refreshedHeading) : root;
  if (!fragmentRoot.length) fragmentRoot = root;

  const raw = fragmentRoot.html() || "";
  const sanitized = sanitizeAbmStoredHtml(raw, page.sourceUrl, {
    preserveLandingInteractions: true,
  });

  if (!sanitized) throw new Error(`Sanitized content is empty for ${page.path}`);
  return sanitized;
}

function filenameFromUrl(url, contentType) {
  try {
    const value = decodeURIComponent(path.basename(new URL(url).pathname) || "");
    if (value && value.includes(".")) return value.slice(0, 180);
  } catch {}

  const ext =
    /svg/i.test(contentType) ? ".svg" :
    /png/i.test(contentType) ? ".png" :
    /webp/i.test(contentType) ? ".webp" :
    /gif/i.test(contentType) ? ".gif" :
    ".jpg";
  return `abm-crispr-${stableKey(url)}${ext}`;
}

const assetCache = new Map();

async function uploadOfficialAsset(url) {
  if (assetCache.has(url)) return assetCache.get(url);
  const { buffer, contentType, finalUrl } = await fetchWithRetry(url, true);
  if (!buffer.length) throw new Error(`Empty image response: ${url}`);

  if (DRY_RUN) {
    assetCache.set(url, url);
    return url;
  }

  const filename = filenameFromUrl(finalUrl || url, contentType);
  const assetType = /svg/i.test(contentType) || /\.svg(?:$|[?#])/i.test(finalUrl || url)
    ? "file"
    : "image";
  const asset = await sanity.assets.upload(assetType, buffer, {
    filename,
    contentType: contentType || undefined,
  });
  if (!asset?.url) throw new Error(`Sanity asset upload failed: ${url}`);
  assetCache.set(url, asset.url);
  return asset.url;
}

async function rehostImages(html, baseUrl) {
  const $ = cheerio.load(`<div id="__root">${html}</div>`, { decodeEntities: false });
  const images = $("#__root img").toArray();
  const migrated = [];
  const failures = [];

  for (const image of images) {
    const raw = String($(image).attr("src") || "").trim();
    const source = absoluteUrl(raw, baseUrl);
    if (!source || !/^https?:\/\//i.test(source)) continue;
    try {
      const managed = await uploadOfficialAsset(source);
      $(image).attr("src", managed);
      $(image).removeAttr("srcset").removeAttr("data-src").removeAttr("data-original");
      migrated.push({ source, managed });
    } catch (error) {
      failures.push({ source, error: String(error?.message || error) });
    }
  }

  if (failures.length) {
    throw new Error(
      `Official image migration failed: ${failures.map((item) => item.source).join(", ")}`,
    );
  }

  return {
    html: $("#__root").html()?.trim() || "",
    images: migrated,
  };
}

function verifyPage(page, html, imageCount) {
  const text = stripTags(html);
  const normalizedText = normalized(text);
  const failures = [];

  if (!normalizedText.includes(normalized(page.sourceTitle))) {
    failures.push(`missing title: ${page.sourceTitle}`);
  }
  for (const required of page.required) {
    if (!normalizedText.includes(normalized(required))) {
      failures.push(`missing required section: ${required}`);
    }
  }
  if (text.length < page.minText) {
    failures.push(`content too short: ${text.length} < ${page.minText}`);
  }

  const commerceLeak =
    /(?:USD|CAD)\s*\$?\s*\d|\$\s*\d[\d,.]*/i.test(text) ||
    /login to see prices|add to cart|shopping cart|checkout/i.test(text);
  if (commerceLeak) failures.push("commerce/price text leaked into migrated content");

  if (/Applied Biological Materials Inc\.\s*\(abm\)\s*\|\s*#1-3671/i.test(text)) {
    failures.push("source footer leaked into migrated content");
  }

  const imageSources = [];
  const $ = cheerio.load(`<div id="__root">${html}</div>`, { decodeEntities: false });
  $("#__root img[src]").each((_, image) => imageSources.push(String($(image).attr("src") || "")));
  const unmanaged = imageSources.filter((src) => /^https?:\/\//i.test(src) && !/cdn\.sanity\.io/i.test(src));
  if (!DRY_RUN && unmanaged.length) {
    failures.push(`unmanaged official images remain: ${unmanaged.join(", ")}`);
  }
  if (imageSources.length !== imageCount) {
    failures.push(`image census mismatch: html=${imageSources.length}, migrated=${imageCount}`);
  }

  return {
    ok: failures.length === 0,
    failures,
    textLength: text.length,
    images: imageSources.length,
  };
}

async function getCategory(pathString) {
  return sanity.fetch(
    `*[_type=="category" && (
      brandSlug=="abm" ||
      themeKey=="abm" ||
      brand->themeKey=="abm" ||
      brand->slug.current=="abm"
    ) && array::join(path, "/")==$path][0]{
      _id,title,path,sourceUrl,pageType
    }`,
    { path: pathString },
  );
}

async function syncPage(page) {
  console.log(`[FETCH] ${page.path} <- ${page.sourceUrl}`);
  const response = await fetchWithRetry(page.sourceUrl, false);
  const sourceDom = cheerio.load(response.html || "", { decodeEntities: false });
  const sourceStyles = sourceDom("style")
    .toArray()
    .map((node) => sourceDom(node).html() || "")
    .filter(Boolean)
    .join("\n\n");
  const sourceStyleName = page.path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") + "-source-styles.css";
  fs.writeFileSync(path.join(REPORT_DIR, sourceStyleName), sourceStyles, "utf8");

  const officialHtml = extractOfficialFragment(page, response.html);
  const rehosted = await rehostImages(officialHtml, page.sourceUrl);
  const verification = verifyPage(page, rehosted.html, rehosted.images.length);
  const snapshotName = page.path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") + ".html";
  fs.writeFileSync(path.join(REPORT_DIR, snapshotName), rehosted.html, "utf8");
  if (!verification.ok) {
    throw new Error(`${page.path}: ${verification.failures.join("; ")}`);
  }

  const category = await getCategory(page.path);
  if (!category?._id) {
    throw new Error(`Existing ABM category not found: ${page.path}`);
  }

  const contentBlock = {
    _key: `crispr-${stableKey(page.path)}`,
    _type: "contentBlockHtml",
    title: page.sourceTitle,
    html: rehosted.html,
  };

  if (!DRY_RUN) {
    await sanity
      .patch(category._id)
      .set({
        title: page.sourceTitle,
        sourceUrl: page.sourceUrl,
        pageType: "landing",
        legacyHtml: rehosted.html,
        contentBlocks: [contentBlock],
      })
      .commit();
  }

  console.log(
    `[${DRY_RUN ? "DRY" : "OK"}] ${page.path} text=${verification.textLength} images=${verification.images}`,
  );

  return {
    path: page.path,
    sourceUrl: page.sourceUrl,
    sourceTitle: page.sourceTitle,
    categoryId: category._id,
    previousTitle: category.title,
    textLength: verification.textLength,
    images: verification.images,
    requiredSections: page.required,
    verification,
  };
}

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    projectId: PROJECT_ID,
    dataset: DATASET,
    pages: [],
  };

  for (const page of PAGES) {
    report.pages.push(await syncPage(page));
  }

  const output = path.join(REPORT_DIR, "report.json");
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(`[DONE] synced ${report.pages.length} CRISPR category pages`);
  console.log(`[DONE] report: ${path.relative(process.cwd(), output)}`);
}

main().catch((error) => {
  console.error("[FAIL]", error);
  process.exit(1);
});
