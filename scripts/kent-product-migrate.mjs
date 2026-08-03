#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import dotenv from "dotenv";
import { createClient } from "@sanity/client";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const argv = process.argv.slice(2);

const has = (flag) => argv.includes(flag);
const readArg = (flag, fallback = "") => {
  const i = argv.indexOf(flag);
  return i >= 0 ? String(argv[i + 1] ?? fallback) : fallback;
};

const DRY_RUN = !has("--apply");
const DEACTIVATE_MISSING = has("--deactivate-missing");
const PREVIEW_MODE = has("--preview");
const PRODUCT_DOC_TYPE = PREVIEW_MODE ? "kentPreviewProduct" : "product";
const PRODUCT_ID_PREFIX = PREVIEW_MODE ? "preview_prod" : "prod";
const DISPLAY_PRICE_RE = /(?:[$€£¥₩]\s*\d[\d,.]*(?:\s*[–-]\s*[$€£¥₩]?\s*\d[\d,.]*)?|(?:USD|EUR|GBP|JPY|KRW)\s*\d[\d,.]*|\d[\d,.]*\s*(?:USD|EUR|GBP|JPY|KRW|원))/gi;
const LIMIT = Number(readArg("--limit", "0")) || 0;
const INPUT = path.resolve(
  readArg("--input", path.join(process.cwd(), ".cache", "kent-shop-profiles.json"))
);
const BRAND_KEY = readArg("--brandKey", "kent");
const BRAND_TITLE = readArg("--brandTitle", "Kent Scientific");
const BRAND_SOURCE_URL = readArg("--brandSourceUrl", "https://www.kentscientific.com/");
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

const projectId =
  env("NEXT_PUBLIC_SANITY_PROJECT_ID") ||
  env("SANITY_STUDIO_PROJECT_ID") ||
  env("SANITY_PROJECT_ID") ||
  "9b5twpc8";

const dataset =
  env("NEXT_PUBLIC_SANITY_DATASET") ||
  env("SANITY_STUDIO_DATASET") ||
  env("SANITY_DATASET") ||
  "production";

const token =
  env("SANITY_API_TOKEN") ||
  env("SANITY_WRITE_TOKEN") ||
  env("SANITY_TOKEN");

if (!projectId) {
  throw new Error("Missing Sanity project id env.");
}
if (!dataset) {
  throw new Error("Missing Sanity dataset env.");
}
if (!token && !DRY_RUN) {
  throw new Error("Missing Sanity write token env. Apply mode requires SANITY_WRITE_TOKEN.");
}
if (!fs.existsSync(INPUT)) {
  throw new Error(`Input JSON not found: ${INPUT}`);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: API_VERSION,
  token,
  useCdn: false,
});

function log(...args) {
  console.log("[kent-product-migrate]", ...args);
}

function warn(...args) {
  console.warn("[kent-product-migrate]", ...args);
}

function textClean(s) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(u) {
  try {
    const url = new URL(String(u || "").trim());
    url.hash = "";
    if (url.hostname === "kentscientific.com") url.hostname = "www.kentscientific.com";
    return url.toString();
  } catch {
    return String(u || "").trim();
  }
}

function normalizeTrailingSlashUrl(u) {
  try {
    const url = new URL(normalizeUrl(u));
    url.pathname = url.pathname.replace(/\/+$/, "") + "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return normalizeUrl(u);
  }
}

function dedupeStrings(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

function stableKey(input, len = 12) {
  return crypto.createHash("sha1").update(String(input)).digest("hex").slice(0, len);
}

function safeSlug(input, fallback = "kent-product") {
  const base = String(input || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/®|™|©/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");

  return base || fallback;
}

function stripHtmlCssNoise(text) {
  return String(text || "")
    .replace(/\.single_variation_wrap\{[^}]+\}/g, " ")
    .replace(/display\s*:\s*none\s*!important;?/gi, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/;+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DROP_LINE_PATTERNS = [
  /^need help\??$/i,
  /^need help with your order/i,
  /^help\s*&\s*support$/i,
  /^our product specialists/i,
  /^our specialists/i,
  /^we reply fast/i,
  /^usually in 24 hours/i,
  /^give us a call today/i,
  /^call\s+888-572-8887/i,
  /^chat with an expert/i,
  /^contact us$/i,
  /^call us$/i,
  /^request a quote$/i,
  /^request quote$/i,
  /^get quote$/i,
  /^choose an option$/i,
  /^clear$/i,
  /^add to cart$/i,
  /^increase quantity$/i,
  /^decrease quantity$/i,
  /^qty$/i,
  /^\+$/i,
  /^-$/i,
  /^login to see prices$/i,
  /^categories:/i,
  /^tag:/i,
  /^tags:/i,
  /^item #/i,
  /^sku:/i,
  /^\.single_variation_wrap/i,
  /^isoflurane, usp$/i,
  /^ac adapters and power cords$/i,
  /^3 accessory connector$/i,
];

function isDropLine(line) {
  const s = textClean(stripHtmlCssNoise(line));
  if (!s) return true;
  return DROP_LINE_PATTERNS.some((re) => re.test(s));
}

function cleanNarrativeText(text) {
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => textClean(stripHtmlCssNoise(line)))
    .filter(Boolean)
    .filter((line) => !isDropLine(line));

  return lines.join("\n").trim();
}

function firstSummary(text, maxLen = 280) {
  const cleaned = cleanNarrativeText(text);
  if (!cleaned) return "";
  const first = cleaned.split("\n").find(Boolean) || cleaned;
  return first.length > maxLen ? `${first.slice(0, maxLen - 1).trim()}…` : first;
}

function paragraphsFromText(text) {
  const cleaned = cleanNarrativeText(text);
  if (!cleaned) return [];
  return cleaned
    .split(/\n{2,}|\n/)
    .map((p) => textClean(p))
    .filter(Boolean)
    .filter((p) => !isDropLine(p));
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function paragraphsToHtml(text) {
  const parts = paragraphsFromText(text);
  if (!parts.length) return "";
  return parts.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n");
}

function ptBlockFromText(text) {
  const clean = textClean(text);
  return {
    _type: "block",
    _key: stableKey(`block:${clean}`),
    style: "normal",
    markDefs: [],
    children: [
      {
        _type: "span",
        _key: stableKey(`span:${clean}`),
        text: clean,
        marks: [],
      },
    ],
  };
}

function richTextFromPlainText(text) {
  return paragraphsFromText(text).map(ptBlockFromText);
}

function labelFromAttrKey(key) {
  const s = String(key || "")
    .replace(/^attribute_/i, "")
    .replace(/^pa_/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!s) return "";
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

function optionGroupDisplayType(source) {
  const s = String(source || "").toLowerCase();
  return s === "select" ? "select" : "button";
}

function makeOptionGroups(optionGroups) {
  return (optionGroups || [])
    .map((group, idx) => {
      const label = textClean(group?.label || group?.name || `Option ${idx + 1}`);
      const key = safeSlug(group?.label || group?.name || `option-${idx + 1}`, `option-${idx + 1}`);

      const options = (group?.options || [])
        .map((opt, j) => {
          const value = textClean(opt?.value || opt?.text || "");
          const text = textClean(opt?.text || opt?.value || "");
          if (!value && !text) return null;
          return {
            _key: stableKey(`opt:${key}:${value || text}:${j}`),
            _type: "optionValue",
            value: value || text,
            label: text || value,
          };
        })
        .filter(Boolean);

      if (!options.length) return null;

      return {
        _key: stableKey(`group:${key}:${idx}`),
        _type: "optionGroup",
        key,
        name: key,
        label,
        displayType: optionGroupDisplayType(group?.source),
        options,
      };
    })
    .filter(Boolean);
}

function makeVariants(product) {
  const baseTitle = textClean(product?.title || "");
  const payloads = Array.isArray(product?.commerce?.variationPayloads)
    ? product.commerce.variationPayloads
    : [];

  return payloads
    .map((v, idx) => {
      const attrs = v?.attributes || {};
      const attrEntries = Object.entries(attrs)
        .map(([k, value]) => [textClean(k), textClean(value)])
        .filter(([, value]) => value);

      const optionSummary = attrEntries.map(([, value]) => value).join(" / ");
      const title =
        optionSummary
          ? `${baseTitle} - ${optionSummary}`
          : baseTitle || textClean(v?.sku || `Variant ${idx + 1}`);

      const optionValues = attrEntries.map(([k, value], i) => ({
        _key: stableKey(`ov:${title}:${k}:${value}:${i}`),
        _type: "optionValuePair",
        key: safeSlug(k, `option-${i + 1}`),
        label: labelFromAttrKey(k),
        value,
      }));

      const rawAttributes = attrEntries.map(([k, value], i) => ({
        _key: stableKey(`attr:${title}:${k}:${value}:${i}`),
        _type: "attributePair",
        key: k,
        value,
      }));

      const variantId =
        textClean(v?.variationId || "") ||
        textClean(v?.sku || "") ||
        stableKey(`variant:${product?.sourceUrl}:${idx}`, 16);

      const sku = textClean(v?.sku || "");
      const imageUrl = normalizeUrl(v?.image || "");
      const displayPrice =
        v?.displayPrice !== undefined && v?.displayPrice !== null ? String(v.displayPrice) : "";
      const displayRegularPrice =
        v?.displayRegularPrice !== undefined && v?.displayRegularPrice !== null
          ? String(v.displayRegularPrice)
          : "";
      const priceText = textClean(v?.priceText || "");

      return {
        _key: stableKey(`variant:${variantId}:${idx}`),
        _type: "variant",
        variantId,
        title,
        sku,
        catNo: sku,
        optionSummary,
        optionValues,
        attributes: rawAttributes,
        imageUrl: imageUrl || undefined,
        sourceVariationId: textClean(v?.variationId || "") || undefined,
        __priceText: priceText,
        __displayPrice: displayPrice,
        __displayRegularPrice: displayRegularPrice,
      };
    })
    .filter(Boolean);
}

function buildVariantTableHtml(variants) {
  if (!variants.length) return "";

  const optionLabels = [];
  for (const variant of variants) {
    for (const ov of variant.optionValues || []) {
      if (ov?.label && !optionLabels.includes(ov.label)) optionLabels.push(ov.label);
    }
  }

  const headers = ["Variant", "SKU", ...optionLabels, "Price"];
  const rows = variants.map((variant) => {
    const valueMap = new Map((variant.optionValues || []).map((ov) => [ov.label, ov.value]));
    const price =
      textClean(variant.__priceText || "") ||
      textClean(variant.__displayPrice || "") ||
      textClean(variant.__displayRegularPrice || "");

    return {
      title: textClean(variant.title || ""),
      sku: textClean(variant.sku || ""),
      options: optionLabels.map((label) => textClean(valueMap.get(label) || "")),
      price,
    };
  });

  return `
<table>
  <thead>
    <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
  </thead>
  <tbody>
    ${rows
      .map(
        (row) => `
      <tr>
        <td>${escapeHtml(row.title)}</td>
        <td>${escapeHtml(row.sku)}</td>
        ${row.options.map((v) => `<td>${escapeHtml(v)}</td>`).join("")}
        <td>${escapeHtml(row.price)}</td>
      </tr>
    `
      )
      .join("")}
  </tbody>
</table>
  `.trim();
}

function buildDocuments(product) {
  const out = [];

  for (const pdf of product?.pdfs || []) {
    const url = normalizeUrl(pdf?.href || "");
    if (!url) continue;
    out.push({
      _key: stableKey(`doc:pdf:${url}`),
      _type: "docItem",
      title: textClean(pdf?.title || "PDF"),
      label: "PDF",
      url,
    });
  }

  for (let i = 0; i < (product?.videos || []).length; i += 1) {
    const url = normalizeUrl(product.videos[i] || "");
    if (!url) continue;
    out.push({
      _key: stableKey(`doc:video:${url}`),
      _type: "docItem",
      title: `Video ${i + 1}`,
      label: "Video",
      url,
    });
  }

  return out;
}

function buildDocumentsHtml(docs) {
  if (!docs.length) return "";
  return `
<ul>
${docs
  .map(
    (doc) =>
      `  <li><a href="${escapeHtml(doc.url)}" target="_blank" rel="noreferrer">${escapeHtml(
        doc.title || doc.label || doc.url
      )}</a>${doc.label ? ` <span>(${escapeHtml(doc.label)})</span>` : ""}</li>`
  )
  .join("\n")}
</ul>
  `.trim();
}

function buildContentBlocks(product, docs, variants, categoryTitles) {
  const blocks = [];

  const overviewBody = richTextFromPlainText(product?.bodyTextPreview || "");
  if (overviewBody.length) {
    blocks.push({
      _key: stableKey(`cb:overview:${product.sourceUrl}`),
      _type: "contentBlockRichText",
      title: "Overview",
      body: overviewBody,
    });
  }

  const optionGroups = makeOptionGroups(product?.commerce?.optionGroups || []);
  if (optionGroups.length) {
    for (const group of optionGroups) {
      const items = (group.options || []).map((opt, i) => ({
        _key: stableKey(`cb:opt:${group.key}:${opt.value}:${i}`),
        _type: "contentBlockBulletItem",
        text: textClean(opt.label || opt.value || ""),
      }));

      if (items.length) {
        blocks.push({
          _key: stableKey(`cb:group:${group.key}`),
          _type: "contentBlockBullets",
          title: group.label || "Options",
          items,
        });
      }
    }
  }

  const variantHtml = buildVariantTableHtml(variants);
  if (variantHtml) {
    blocks.push({
      _key: stableKey(`cb:variants:${product.sourceUrl}`),
      _type: "contentBlockHtml",
      title: "Ordering Options",
      html: variantHtml,
    });
  }

  if (docs.length) {
    blocks.push({
      _key: stableKey(`cb:docs:${product.sourceUrl}`),
      _type: "contentBlockLinks",
      title: "Documents & Videos",
      items: docs.map((doc, i) => ({
        _key: stableKey(`cb:docs:item:${doc.url}:${i}`),
        _type: "contentBlockLinkItem",
        title: textClean(doc.title || doc.label || doc.url),
        href: doc.url,
      })),
    });
  }

  const imageUrls = dedupeStrings(product?.imageUrls || []).slice(0, 12);
  if (imageUrls.length) {
    blocks.push({
      _key: stableKey(`cb:gallery:${product.sourceUrl}`),
      _type: "contentBlockResources",
      title: "Gallery Images",
      items: imageUrls.map((url, i) => ({
        _key: stableKey(`cb:gallery:item:${url}:${i}`),
        _type: "contentBlockResourceItem",
        title: `${textClean(product?.title || "Product")} Image ${i + 1}`,
        href: url,
        imageUrl: url,
      })),
    });
  }

  const relatedItems = (product?.relatedProducts || [])
    .map((item, i) => {
      const href = normalizeUrl(item?.href || "");
      const title = textClean(item?.label || "");
      if (!href || !title) return null;
      return {
        _key: stableKey(`cb:related:${href}:${i}`),
        _type: "contentBlockLinkItem",
        title,
        href,
      };
    })
    .filter(Boolean);

  if (relatedItems.length) {
    blocks.push({
      _key: stableKey(`cb:related:${product.sourceUrl}`),
      _type: "contentBlockLinks",
      title: "Related Products",
      items: relatedItems,
    });
  }

  if (categoryTitles.length) {
    blocks.push({
      _key: stableKey(`cb:cats:${product.sourceUrl}`),
      _type: "contentBlockBullets",
      title: "Category Path",
      items: categoryTitles.map((title, i) => ({
        _key: stableKey(`cb:cats:item:${title}:${i}`),
        _type: "contentBlockBulletItem",
        text: title,
      })),
    });
  }

  return blocks;
}

const OFFICIAL_FIRST_FEATURE_TITLE_BY_SLUG = {
  "aeroneb-lab-control-module": "Maintain molecular integrity",
  "coda-high-throughput-system": "Multifunctional monitoring capability",
  "coda-monitor": "MRI compatible",
  "far-infrared-warming-pads-with-controller": "Far infrared warming",
  "mousestat-jr": "Fits in the palm of your hand",
  "physiosuite": "Include up to 3 modules in one unit",
  "righttemp-jr": "Far infrared warming",
  "righttemp": "Far infrared warming",
  "rovent-jr": "Fully automatic with touchscreen control",
  "rovent": "RightTemp® homeothermic warming",
  "somnoflo": "Extreme precision & accuracy, flow rates as low as 100mL/min",
  "somnosuite": "Flow Rates from 25 mL to 1 L",
  "surgisuite": "Comply with regulatory guidelines",
  "vaporizer-with-vetflo-single-channel-anesthesia-stand": "Brand new vaporizer canisters",
  "vetflo-four-channel-anesthesia-stand": "Superior design",
  "vetflo-single-channel-anesthesia-stand": "Superior design",
  "vetflo-six-channel-anesthesia-stand": "Superior design",
  "vetflo-two-channel-anesthesia-stand": "Superior design",
};

const VERIFIED_RELATED_PRODUCTS_BY_SLUG = {
  somnosuite: [
    ["SurgiSuite – For Rats", "surgisuite"],
    ["SurgiSuite – For Mice", "surgisuite"],
    ["Anesthesia Masks Breathing Circuits for SomnoSuite®", "anesthesia-masks-breathing-circuits-for-somnosuite"],
  ],
  "mousestat-jr": [
    ["Pulse Oximeter Paw Sensors MRI Compatible – MRI Sensor for Rats", "pulse-oximeter-paw-sensors-mri-compatible"],
    ["Pulse Oximeter Paw Sensors MRI Compatible – MRI Sensor for Mice", "pulse-oximeter-paw-sensors-mri-compatible"],
    ["RightTemp® Jr.", "righttemp-jr"],
    ["PhysioSuite®", "physiosuite"],
  ],
  physiosuite: [
    ["RightTemp® Jr.", "righttemp-jr"],
    ["Pulse Oximeter Whole Body Sensors MRI Compatible", "pulse-oximeter-whole-body-sensors-mri-compatible"],
    ["Pulse Oximeter Paw Sensors MRI Compatible", "pulse-oximeter-paw-sensors-mri-compatible"],
  ],
  "rovent-jr": [
    ["RightTemp® Jr.", "righttemp-jr"],
    ["Endotracheal Tubes for Rodent Intubation", "endotracheal-tubes"],
    ["Endotracheal Intubation Kits for Mouse and Rat Anesthesia", "endotracheal-intubation-kits"],
  ],
  rovent: [
    ["Intubation Stands", "intubation-stands"],
    ["Endotracheal Tubes for Rodent Intubation", "endotracheal-tubes"],
    ["Endotracheal Intubation Kits for Mouse and Rat Anesthesia", "endotracheal-intubation-kits"],
  ],
  somnoflo: [
    ["Far Infrared Warming Pads with Controller for Small Animal Recovery", "far-infrared-warming-pads-with-controller"],
    ["RightTemp® Jr.", "righttemp-jr"],
    ["PhysioSuite®", "physiosuite"],
  ],
  surgisuite: [
    ["Replacement Surgical Field Covers", "replacement-surgical-field-covers"],
    ["Mouse Retractor Set", "mouse-retractor-set"],
    ["PhysioSuite®", "physiosuite"],
  ],
  "vaporizer-with-vetflo-single-channel-anesthesia-stand": [
    ["SomnoFlo®", "somnoflo"],
    ["RightTemp® Jr.", "righttemp-jr"],
    ["Anesthesia Masks Breathing Circuits for Traditional Vaporizers", "anesthesia-masks-breathing-circuits-for-traditional-vaporizers"],
  ],
  "righttemp-jr": [
    ["RightTemp® Sensor for Animal or Warming Pad", "righttemp-sensor-for-animal-or-warming-pad"],
    ["Far Infrared Warming Pad for Small Animal Recovery", "far-infrared-warming-pad"],
    ["Disposable Sleeve Protectors for DCT-15 and DCT-20 Far Infrared Warming Pads", "disposable-sleeve-protectors-for-dct-15-and-dct-20-far-infrared-warming-pads"],
  ],
  "coda-high-throughput-system": [
    ["CODA® High Throughput VPR Cuffs", "coda-high-throughput-vpr-cuffs"],
    ["CODA® High Throughput Cuff Kits", "coda-high-throughput-cuff-kits"],
    ["CODA® Animal Holders", "coda-animal-holders"],
  ],
  "coda-monitor": [
    ["CODA® Monitor Occlusion Cuff Kits", "coda-monitor-occlusion-cuff-kits"],
    ["CODA® Monitor VPR Cuff Kits", "coda-monitor-vpr-cuff-kits"],
    ["CODA® Monitor Animal Holders", "nose-cone-animal-holders-with-stand"],
  ],
};

function restoreFirstFeatureHeading(product, section) {
  const type = String(section?.type || section?.kind || "").toLowerCase();
  const title = OFFICIAL_FIRST_FEATURE_TITLE_BY_SLUG[String(product?.slug || "")];
  const html = String(section?.html || "");
  if (!title || !/feature|benefit|what-you-get/.test(type) || !html || /<h[2-4]\b/i.test(html.slice(0, 220))) return section;
  return { ...section, html: `<h3>${title}</h3>${html}` };
}

function officialSections(product) {
  const sourceSections = Array.isArray(product?.kentSections)
    ? product.kentSections
        .filter((section) => section && typeof section === "object")
        .map((rawSection, sectionIndex) => {
          const section = restoreFirstFeatureHeading(product, rawSection);
          return ({
          ...section,
          _key: section._key || stableKey(`kent-section:${section.title || sectionIndex}`),
          _type: "kentSourceSection",
          items: Array.isArray(section.items)
            ? section.items
                .filter((item) => item && typeof item === "object")
                .map((item, itemIndex) => ({
                  ...item,
                  _key: item._key || stableKey(`kent-section-item:${section.title || sectionIndex}:${item.title || itemIndex}`),
                  _type: "kentSourceSectionItem",
                }))
            : undefined,
          });
        })
    : [];

  const storedRelated = Array.isArray(product?.relatedProducts) && product.relatedProducts.length
    ? product.relatedProducts
    : (VERIFIED_RELATED_PRODUCTS_BY_SLUG[String(product?.slug || "")] || []).map(([label, slug]) => ({
        label,
        href: `https://www.kentscientific.com/products/${slug}/`,
      }));

  const relatedItems = storedRelated
    .flatMap((item, itemIndex) => {
      const href = normalizeTrailingSlashUrl(item?.href || item?.url || "");
      const title = textClean(item?.label || item?.title || "").replace(DISPLAY_PRICE_RE, "").replace(/\s+/g, " ").trim();
      if (!href || !title) return [];
      return [{
        _key: stableKey(`kent-related-item:${href}:${itemIndex}`),
        _type: "kentSourceSectionItem",
        title,
        href,
      }];
    });

  if (!relatedItems.length) return sourceSections;
  return [{
    _key: stableKey(`kent-related:${product?.sourceUrl || product?.slug || "product"}`),
    _type: "kentSourceSection",
    type: "related-products",
    title: "Customers who viewed this item also viewed",
    items: relatedItems,
  }, ...sourceSections];
}

function buildListingPaths(sourceCategories) {
  return dedupeStrings(
    (sourceCategories || [])
      .map((cat) => Array.isArray(cat?.categoryPath) ? cat.categoryPath.join("/") : "")
      .filter(Boolean)
  );
}

function categoryPathTitlesFromIndex(categoryPath, categoryIndexByPath) {
  const titles = [];
  for (let i = 0; i < categoryPath.length; i += 1) {
    const partial = categoryPath.slice(0, i + 1).join("/");
    const hit = categoryIndexByPath.get(partial);
    if (hit?.title) titles.push(hit.title);
  }
  return titles;
}

function choosePrimaryCategoryDoc(product, categoryIndexByPath) {
  const candidates = [];

  const direct = Array.isArray(product?.primaryCategory?.categoryPath)
    ? product.primaryCategory.categoryPath
    : [];
  if (direct.length) candidates.push(direct);

  for (const item of product?.sourceCategories || []) {
    if (Array.isArray(item?.categoryPath) && item.categoryPath.length) {
      candidates.push(item.categoryPath);
    }
  }

  candidates.sort((a, b) => b.length - a.length);

  for (const pathArr of candidates) {
    const key = pathArr.join("/");
    const hit = categoryIndexByPath.get(key);
    if (hit) {
      return {
        doc: hit,
        path: pathArr,
      };
    }
  }

  return {
    doc: null,
    path: direct.length ? direct : [],
  };
}

async function ensureBrand() {
  const existing = await client.fetch(
    `*[_type=="brand" && (themeKey==$brandKey || slug.current==$brandKey || title==$brandTitle)][0]{
      _id, title, themeKey, "slug": slug.current
    }`,
    { brandKey: BRAND_KEY, brandTitle: BRAND_TITLE }
  );

  if (existing?._id) return existing;

  const doc = {
    _id: `brand-${BRAND_KEY}`,
    _type: "brand",
    title: BRAND_TITLE,
    slug: { _type: "slug", current: BRAND_KEY },
    themeKey: BRAND_KEY,
    sourceUrl: BRAND_SOURCE_URL,
    order: 0,
  };

  if (DRY_RUN) {
    log(`[DRY] brand create ${doc._id}`);
    return { _id: doc._id, title: doc.title, themeKey: doc.themeKey, slug: BRAND_KEY };
  }

  await client.createIfNotExists(doc);
  log(`[OK] brand ${doc._id}`);
  return { _id: doc._id, title: doc.title, themeKey: doc.themeKey, slug: BRAND_KEY };
}

async function loadKentCategories() {
  const rows = await client.fetch(
    `*[_type=="category" && (
      brand->themeKey==$brandKey
      || brand->slug.current==$brandKey
      || themeKey==$brandKey
    ) && defined(path)]{
      _id,
      title,
      path,
      sourceUrl
    }`,
    { brandKey: BRAND_KEY }
  );

  const index = new Map();
  for (const row of rows || []) {
    const pathArr = Array.isArray(row?.path) ? row.path : [];
    if (!pathArr.length) continue;
    index.set(pathArr.join("/"), row);
  }
  return {
    rows: rows || [],
    index,
  };
}

function loadShopManifest(inputJson) {
  const candidates = [
    inputJson?.listingFile,
    path.join(process.cwd(), ".cache", "kent-shop-all.json"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = path.resolve(String(candidate));
    if (!fs.existsSync(resolved)) continue;
    const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
    if (Array.isArray(parsed?.categories)) return parsed;
  }
  return null;
}

async function ensureShopCategories(inputJson, brand) {
  if (PREVIEW_MODE) {
    log("preview mode: production category documents are read-only");
    return;
  }

  const manifest = loadShopManifest(inputJson);
  if (!manifest) {
    warn("Kent Shop manifest not found; existing Sanity categories will be used.");
    return;
  }

  const existingRows = await client.fetch(
    `*[_type=="category" && (
      brand->themeKey==$brandKey || brand->slug.current==$brandKey || themeKey==$brandKey
    ) && defined(path)]{ _id, path }`,
    { brandKey: BRAND_KEY },
  );
  const existingByPath = new Map(
    (existingRows || []).map((row) => [(row.path || []).join("/"), row._id]),
  );
  const resolvedIdByPath = new Map();
  const categories = [...manifest.categories]
    .filter((category) => Array.isArray(category?.categoryPath) && category.categoryPath.length)
    .sort((a, b) => a.categoryPath.length - b.categoryPath.length || a.categoryPath.join("/").localeCompare(b.categoryPath.join("/")));

  for (let index = 0; index < categories.length; index += 1) {
    const category = categories[index];
    const pathArr = category.categoryPath;
    const pathKey = pathArr.join("/");
    const parentKey = pathArr.slice(0, -1).join("/");
    const id = existingByPath.get(pathKey) || `cat_${BRAND_KEY}__${pathArr.join("__")}`;
    const parentId = parentKey ? resolvedIdByPath.get(parentKey) || existingByPath.get(parentKey) : "";
    resolvedIdByPath.set(pathKey, id);

    const doc = {
      _id: id,
      _type: "category",
      brand: { _type: "reference", _ref: brand._id },
      themeKey: BRAND_KEY,
      isActive: true,
      title: textClean(category.title || pathArr.at(-1)),
      path: pathArr,
      sourceUrl: normalizeTrailingSlashUrl(category.sourceUrl || category.rootUrl || "") || undefined,
      parent: parentId ? { _type: "reference", _ref: parentId } : undefined,
      order: index + 1,
    };

    if (DRY_RUN) continue;
    const tx = client.transaction();
    tx.createIfNotExists({ _id: id, _type: "category" });
    tx.patch(id, { set: doc, ...(parentId ? {} : { unset: ["parent"] }) });
    await tx.commit({ autoGenerateArrayKeys: true });
  }

  log(`shop categories: ${categories.length}${DRY_RUN ? " (dry)" : ""}`);
}

async function loadExistingProducts() {
  const rows = await client.fetch(
    `*[_type==$productType && (
      brand->themeKey==$brandKey
      || brand->slug.current==$brandKey
    )]{
      _id,
      sourceUrl,
      "slug": slug.current,
      images[]{
        _key,
        sourceUrl,
        asset->{ _id, url }
      }
    }`,
    { brandKey: BRAND_KEY, productType: PRODUCT_DOC_TYPE }
  );

  const bySourceUrl = new Map();
  const bySlug = new Map();

  for (const row of rows || []) {
    const src = normalizeTrailingSlashUrl(row?.sourceUrl || "");
    const slug = textClean(row?.slug || "");
    if (src) bySourceUrl.set(src, row);
    if (slug) bySlug.set(slug, row);
  }

  return { rows: rows || [], bySourceUrl, bySlug };
}

function buildProductDoc(inputProduct, ctx) {
  const sourceUrl = normalizeTrailingSlashUrl(inputProduct?.sourceUrl || "");
  const title = textClean(inputProduct?.title || "");
  const slugCurrent = safeSlug(inputProduct?.slug || title, `kent-${stableKey(sourceUrl, 8)}`);
  const existing =
    ctx.existing.bySourceUrl.get(sourceUrl) ||
    ctx.existing.bySlug.get(slugCurrent) ||
    null;

  const resolvedCategory = choosePrimaryCategoryDoc(inputProduct, ctx.categories.index);
  const primaryCategoryDoc = resolvedCategory.doc;
  const primaryPath = Array.isArray(resolvedCategory.path) ? resolvedCategory.path : [];
  const categoryTitles = categoryPathTitlesFromIndex(primaryPath, ctx.categories.index);

  const listingPaths = buildListingPaths(inputProduct?.sourceCategories || []);
  const docs = buildDocuments(inputProduct);
  const variants = makeVariants(inputProduct);
  const optionGroups = makeOptionGroups(inputProduct?.commerce?.optionGroups || []);
  const defaultVariant =
    variants.find((v) => textClean(v?.sku || "") && textClean(v?.sku || "") === textClean(inputProduct?.sku || "")) ||
    variants[0] ||
    null;

  const summary =
    textClean(inputProduct?.summary || "") ||
    firstSummary(inputProduct?.bodyTextPreview || "");
  const sections = officialSections(inputProduct);

  const docId = existing?._id || `${PRODUCT_ID_PREFIX}_${BRAND_KEY}__${slugCurrent.replaceAll("/", "__")}`;

  const doc = {
    _id: docId,
    _type: PRODUCT_DOC_TYPE,
    isActive: true,
    brand: { _type: "reference", _ref: ctx.brand._id },
    title,
    summary: summary || undefined,
    sku: textClean(inputProduct?.sku || "") || undefined,
    slug: { _type: "slug", current: slugCurrent },
    categoryRef: primaryCategoryDoc?._id
      ? { _type: "reference", _ref: primaryCategoryDoc._id }
      : undefined,
    categoryPath: primaryPath.length ? primaryPath : undefined,
    listingPaths: listingPaths.length ? listingPaths : undefined,
    categoryPathTitles: categoryTitles.length ? categoryTitles : undefined,
    order: ctx.orderMap.get(sourceUrl) ?? 0,
    sourceUrl: sourceUrl || undefined,
    sourceIntroHtml: String(inputProduct?.sourceIntroHtml || inputProduct?.overviewHtml || "").trim(),
    overviewHtml: "",
    legacyHtml: "",
    extraHtml: "",
    specsHtml: "",
    datasheetHtml: "",
    documentsHtml: "",
    faqsHtml: "",
    referencesHtml: "",
    reviewsHtml: "",
    docs: docs.length ? docs : undefined,
    kentSections: sections,
    sourceProductId: Number(inputProduct?.wpProductId || 0) || undefined,
    sourceModifiedAt: inputProduct?.sourceModifiedAt || undefined,
    productType: variants.length || optionGroups.length ? "variant" : "simple",
    defaultVariantId: defaultVariant?.variantId || undefined,
    optionGroups: optionGroups.length ? optionGroups : undefined,
    variants: variants.length
      ? variants.map(({ __priceText, __displayPrice, __displayRegularPrice, ...rest }) => rest)
      : undefined,
    enrichedAt: new Date().toISOString(),
    contentBlocks: [],
  };

  return {
    doc,
    sourceUrl,
    slugCurrent,
    title,
    primaryCategoryDoc,
    primaryPath,
    listingPaths,
    variantsCount: variants.length,
    optionGroupCount: optionGroups.length,
    heroImageUrl: normalizeUrl(inputProduct?.heroImageUrl || inputProduct?.imageUrls?.[0] || ""),
    existing,
  };
}

function buildOrderMap(inputJson) {
  const map = new Map();
  let seq = 1;

  for (const item of inputJson?.results || []) {
    const src = normalizeTrailingSlashUrl(item?.sourceUrl || "");
    if (!src) continue;
    if (!map.has(src)) {
      map.set(src, seq);
      seq += 1;
    }
  }

  return map;
}

async function fetchImage(url) {
  const response = await fetch(url, {
    headers: {
      accept: "image/*,*/*;q=0.8",
      referer: "https://www.kentscientific.com/",
      "user-agent": "ITSBIO Kent Shop migration/1.0",
    },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Hero image HTTP ${response.status}: ${url}`);
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || undefined,
  };
}

function existingHero(existing, sourceUrl) {
  return (existing?.images || []).find(
    (image) => normalizeUrl(image?.sourceUrl || "") === normalizeUrl(sourceUrl) && image?.asset?._id && image?.asset?.url,
  );
}

async function resolveHeroMedia(built) {
  const sourceUrl = built.heroImageUrl;
  if (!sourceUrl) return { images: [], kentOfficialGallery: [], status: "UNVERIFIED" };

  let assetId = "";
  let assetUrl = "";
  const reusable = existingHero(built.existing, sourceUrl);

  if (reusable) {
    assetId = reusable.asset._id;
    assetUrl = reusable.asset.url;
  } else {
    const image = await fetchImage(sourceUrl);
    const extension = String(image.contentType || "").includes("png") ? "png" : "jpg";
    const asset = await client.assets.upload("image", image.buffer, {
      filename: `kent-${built.slugCurrent}-${stableKey(sourceUrl, 10)}.${extension}`,
      contentType: image.contentType,
    });
    assetId = asset._id;
    assetUrl = asset.url;
  }

  return {
    images: [{
      _key: stableKey(`hero:${sourceUrl}`),
      _type: "image",
      asset: { _type: "reference", _ref: assetId },
      caption: built.title,
      sourceUrl,
    }],
    kentOfficialGallery: [{
      _key: stableKey(`official-hero:${sourceUrl}`),
      _type: "kentOfficialGalleryItem",
      sourceUrl: assetUrl,
      alt: built.title,
      order: 0,
    }],
    status: "APPROVED",
  };
}

async function upsertProduct(doc) {
  const tx = client.transaction();
  tx.createIfNotExists({ _id: doc._id, _type: PRODUCT_DOC_TYPE });
  tx.patch(doc._id, {
    set: doc,
    unset: ["imageUrls", "galleryImageUrls", "imageFiles"],
  });
  return tx.commit({ autoGenerateArrayKeys: true });
}

async function reconcileInactiveProducts(existing, sourceProducts) {
  const sourceUrls = new Set(
    sourceProducts.map((product) => normalizeTrailingSlashUrl(product?.sourceUrl || "")).filter(Boolean),
  );
  const sourceSlugs = new Set(sourceProducts.map((product) => safeSlug(product?.slug || product?.title || "")).filter(Boolean));
  const stale = existing.rows.filter((product) => {
    const sourceUrl = normalizeTrailingSlashUrl(product?.sourceUrl || "");
    const slug = textClean(product?.slug || "");
    return !(sourceUrl && sourceUrls.has(sourceUrl)) && !(slug && sourceSlugs.has(slug));
  });

  log(`Sanity-only products outside current Shop: ${stale.length}`);
  for (const product of stale) log(`  preserve${DEACTIVATE_MISSING ? " + deactivate" : ""}: ${product.slug || product._id}`);

  if (DRY_RUN || !DEACTIVATE_MISSING || !stale.length) return;
  for (const product of stale) {
    await client.patch(product._id).set({ isActive: false }).commit();
  }
}

async function main() {
  log(`input: ${INPUT}`);
  log(`mode: ${DRY_RUN ? "DRY_RUN" : "APPLY"}`);
  log(`document type: ${PRODUCT_DOC_TYPE}${PREVIEW_MODE ? " (preview-only)" : ""}`);

  const inputJson = JSON.parse(fs.readFileSync(INPUT, "utf8"));
  const allResults = Array.isArray(inputJson?.results) ? inputJson.results : [];
  const products = LIMIT > 0 ? allResults.slice(0, LIMIT) : allResults;

  if (!products.length) {
    throw new Error("No products in input JSON.");
  }

  const brand = await ensureBrand();
  await ensureShopCategories(inputJson, brand);
  const categories = await loadKentCategories();
  const existing = await loadExistingProducts();
  const orderMap = buildOrderMap(inputJson);

  log(`brand: ${brand._id}`);
  log(`categories: ${categories.rows.length}`);
  log(`existing products: ${existing.rows.length}`);
  log(`targets: ${products.length}`);

  const ctx = { brand, categories, existing, orderMap };

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (let i = 0; i < products.length; i += 1) {
    const item = products[i];

    try {
      const built = buildProductDoc(item, ctx);

      if (!built.title || !built.sourceUrl) {
        skip += 1;
        process.stdout.write(`\r[${i + 1}/${products.length}] ok=${ok} skip=${skip} fail=${fail} SKIP`);
        continue;
      }

      if (!built.primaryPath.length) {
        warn(`no categoryPath for ${built.sourceUrl}`);
      }

      if (DRY_RUN) {
        ok += 1;
        process.stdout.write(
          `\r[${i + 1}/${products.length}] ok=${ok} skip=${skip} fail=${fail} ${built.slugCurrent}`
        );
        if (i < 5) {
          console.log("");
          log(
            `[DRY] ${built.doc._id} title="${built.title}" category="${built.primaryPath.join("/") || "-"}" variants=${built.variantsCount} options=${built.optionGroupCount}`
          );
        }
        continue;
      }

      const media = await resolveHeroMedia(built);
      built.doc.images = media.images;
      built.doc.kentOfficialGallery = media.kentOfficialGallery;
      built.doc.kentOfficialGalleryStatus = media.status;
      built.doc.kentOfficialSourceUrl = built.sourceUrl;
      built.doc.kentOfficialGalleryVerifiedAt = new Date().toISOString();
      await upsertProduct(built.doc);
      ok += 1;
      process.stdout.write(
        `\r[${i + 1}/${products.length}] ok=${ok} skip=${skip} fail=${fail} ${built.slugCurrent}`
      );
    } catch (err) {
      fail += 1;
      console.log("");
      warn(`FAIL ${item?.sourceUrl || item?.title || "unknown"} :: ${String(err?.message || err)}`);
    }
  }

  process.stdout.write("\n");
  await reconcileInactiveProducts(existing, allResults);
  log(`[DONE] ok=${ok} skip=${skip} fail=${fail} mode=${DRY_RUN ? "DRY_RUN" : "APPLY"}`);

  if (fail > 0 || skip > 0 || ok !== products.length) {
    throw new Error(
      `Incomplete Kent Shop migration: expected=${products.length} ok=${ok} skip=${skip} fail=${fail}`,
    );
  }
}

main().catch((err) => {
  warn(String(err?.message || err));
  process.exit(1);
});
