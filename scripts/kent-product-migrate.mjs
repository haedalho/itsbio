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
const LIMIT = Number(readArg("--limit", "0")) || 0;
const INPUT = path.resolve(
  readArg("--input", path.join(process.cwd(), ".cache", "kent-products-from-listing.json"))
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
  env("SANITY_PROJECT_ID");

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
if (!token) {
  throw new Error("Missing Sanity write token env.");
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

async function loadExistingProducts() {
  const rows = await client.fetch(
    `*[_type=="product" && (
      brand->themeKey==$brandKey
      || brand->slug.current==$brandKey
    )]{
      _id,
      sourceUrl,
      "slug": slug.current
    }`,
    { brandKey: BRAND_KEY }
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

  const summary = firstSummary(inputProduct?.bodyTextPreview || "");
  const extraHtml = paragraphsToHtml(inputProduct?.bodyTextPreview || "");
  const documentsHtml = buildDocumentsHtml(docs);
  const contentBlocks = buildContentBlocks(inputProduct, docs, variants, categoryTitles);

  const docId = existing?._id || `product-${BRAND_KEY}-${stableKey(sourceUrl || slugCurrent, 16)}`;

  const doc = {
    _id: docId,
    _type: "product",
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
    legacyHtml: undefined,
    extraHtml: extraHtml || undefined,
    specsHtml: variants.length ? buildVariantTableHtml(variants) : undefined,
    datasheetHtml: undefined,
    documentsHtml: documentsHtml || undefined,
    faqsHtml: undefined,
    referencesHtml: undefined,
    reviewsHtml: undefined,
    imageUrls: dedupeStrings((inputProduct?.imageUrls || []).map((u) => normalizeUrl(u))).slice(0, 40),
    docs: docs.length ? docs : undefined,
    productType: variants.length || optionGroups.length ? "variant" : "simple",
    defaultVariantId: defaultVariant?.variantId || undefined,
    optionGroups: optionGroups.length ? optionGroups : undefined,
    variants: variants.length
      ? variants.map(({ __priceText, __displayPrice, __displayRegularPrice, ...rest }) => rest)
      : undefined,
    enrichedAt: new Date().toISOString(),
    contentBlocks: contentBlocks.length ? contentBlocks : undefined,
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

async function upsertProduct(doc) {
  const tx = client.transaction();
  tx.createIfNotExists({ _id: doc._id, _type: "product" });
  tx.patch(doc._id, {
    set: doc,
  });
  return tx.commit({ autoGenerateArrayKeys: true });
}

async function main() {
  log(`input: ${INPUT}`);
  log(`mode: ${DRY_RUN ? "DRY_RUN" : "APPLY"}`);

  const inputJson = JSON.parse(fs.readFileSync(INPUT, "utf8"));
  const allResults = Array.isArray(inputJson?.results) ? inputJson.results : [];
  const products = LIMIT > 0 ? allResults.slice(0, LIMIT) : allResults;

  if (!products.length) {
    throw new Error("No products in input JSON.");
  }

  const brand = await ensureBrand();
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
  log(`[DONE] ok=${ok} skip=${skip} fail=${fail} mode=${DRY_RUN ? "DRY_RUN" : "APPLY"}`);
}

main().catch((err) => {
  warn(String(err?.message || err));
  process.exit(1);
});