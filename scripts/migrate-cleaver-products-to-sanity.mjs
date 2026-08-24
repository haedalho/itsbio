#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");
const cheerio = require("cheerio");

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const ENRICH = argv.includes("--enrich");
const ROOT = process.cwd();
const MIGRATION_KEY = "cleaver-products-2026-08-24";
const BRAND_ID = "brand-cleaver";
const OFFICIAL_HOSTS = new Set(["www.thistlescientific.com", "thistlescientific.com", "www.cleaverscientific.com", "cleaverscientific.com", "files.plytix.com"]);

const inventory = JSON.parse(await readFile(path.join(ROOT, "data/cleaver-product-catalog.json"), "utf8"));
const categories = JSON.parse(await readFile(path.join(ROOT, "data/cleaver-categories.json"), "utf8"));
const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim())
  .find(Boolean);

if ((APPLY || ENRICH) && !token) throw new Error("Cleaver migration requires an existing Production Sanity write token.");

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

const clean = (value) => String(value || "").normalize("NFKC").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const normalize = (value) => clean(value).toLowerCase();
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");
const slugify = (value) => clean(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const productId = (sku) => `product-cleaver-${hash(normalize(sku)).slice(0, 24)}`;
const productSlug = (title, sku) => {
  const suffix = slugify(String(sku).replace(/\$/g, "-variant"));
  return `${slugify(title).slice(0, Math.max(20, 145 - suffix.length)).replace(/-+$/g, "") || "cleaver-product"}-${suffix}`;
};

function classify(sku, title) {
  const value = `${sku} ${title}`.toLowerCase();
  if (/\bstudent\b|\beducation\b|\bteaching\b|^tgt|^labset/.test(value)) return ["teaching-and-education", /student|^tgt/.test(value) ? "student-electrophoresis-systems" : "teaching-kits-and-accessories"];
  if (/^csr-|\bbeta\s+(?:radiation\s+)?shield|\bgamma\s+(?:radiation\s+)?shield|radiation shield|pipette shield/.test(value)) return ["general-laboratory-products", "radiation-protection"];
  if (/glove\s*box|uv\s*(?:sterili[sz]ation\s*)?cabinet|pcr\s*(?:cabinet|hood|chamber)|^csl-gb|^csl-uvcab/.test(value)) return ["general-laboratory-products", "glove-boxes-and-pcr-cabinets"];
  if (/safe\s*tray|spill\s*tray|biohazard|\btray\s*liner|^t[oy]\d/.test(value)) return ["general-laboratory-products", "laboratory-safety-and-accessories"];
  if (/omnipette|ezeepette|epette|\bpipett(?:e|or|ing)\b|^cv(?:-|\d)|multichannel pipette/.test(value)) return ["general-laboratory-products", "liquid-handling"];
  if (/vortex|shaker|\bmixer\b|hybridisation|hybridization|\bincubat|orbital|rocker|rotator|^si-/.test(value)) return ["general-laboratory-products", "mixers-shakers-and-incubators"];
  if (/water\s*bath|\bstirring\s*bath|aqualab|water\s*still|water distill/.test(value)) return ["general-laboratory-products", "water-baths-and-stills"];
  if (/centrifuge|ezeefuge|\bph\s*meter|portable meter|conductivity meter|magnetic stirr/.test(value)) return ["general-laboratory-products", "centrifuges-and-meters"];
  if (/cellulose acetate|haemoglobin|hemoglobin|cellas|^csl-ca(?:hb)?/.test(value)) return ["electrophoresis-equipment", "cellulose-acetate"];
  if (/comet\s*assay|^csl-com/.test(value)) return ["electrophoresis-equipment", "comet-assay"];
  if (/\bdgge\b|isoelectric|\bief\b|dna sequencing|^csq/.test(value)) return ["electrophoresis-equipment", "dgge-and-sequencing"];
  if (/power\s*supply|powerpro|nanopac|power\s*pro|^pp\d|^eps\d/.test(value) && !/with (?:a |\d+v )?power supply|package with power supply/.test(value)) return ["electrophoresis-equipment", "power-supplies"];
  if (/omniblot|miniblot|\bblotter\b|semi[ -]?dry|electroblot|western blot|vacuum blot|^sd\d/.test(value)) return ["electrophoresis-equipment", "electroblotters"];
  if (/transilluminator|blue light illuminator|uv illuminator|^csl-uvt/.test(value)) return ["gel-documentation", "transilluminators"];
  if (/microdoc|omnidoc|gelone|gellite|gelpro|gel documentation|chemidoc|geldoc|gel imaging|camera|imaging filter|^mu-/.test(value)) return ["gel-documentation", /filter|camera|hood|replacement|accessor|^mu-/.test(value) ? "imaging-accessories" : "gel-documentation-systems"];
  if (/dna ladder|dna marker|protein marker|loading dye|gel stain|\brunsafe\b|sybr|ethidium|\bagarose\s*(?:powder|tablet|gel reagent)|^csl-mdna|^csl-ag\d/.test(value)) return ["electrophoresis-reagents", /ladder|marker|stain|dye|runsafe|sybr|ethidium/.test(value) ? "dna-ladders-and-stains" : "agarose-and-gel-reagents"];
  if (/\btbe\b|\btae\b|running buffer|transfer buffer|buffer concentrate|^csl-tbep/.test(value)) return ["electrophoresis-reagents", "buffers-and-components"];
  if (/omnipage|propage|\bpage\s+system|vertical electrophoresis|vertical gel|glass plates?|bonded spacer|^vs\d|^cvs\d|^hpage/.test(value)) return ["electrophoresis-equipment", "page-tanks"];
  if (/multisub|runview|runstation|clearsight|agarose electrophoresis|horizontal electrophoresis|gel tray|flexicaster|^ms(?:mini|midi|choice|maxi|screen|\d)|^cs[lt]-rv/.test(value)) return ["electrophoresis-equipment", "agarose-gel-tanks"];
  if (/comb|electrode|casting|platinum wire|gel scoop|electrophoresis cable/.test(value)) return ["electrophoresis-equipment", "spares-and-accessories"];
  if (/reagent|agarose|buffer|precast|lysis|gel pack/.test(value)) return ["electrophoresis-reagents", "agarose-and-gel-reagents"];
  return ["general-laboratory-products", "laboratory-safety-and-accessories"];
}

const categoryMap = new Map();
for (const root of categories) {
  categoryMap.set(root.slug, { id: `category-cleaver-${root.slug}`, path: [root.slug], titles: [root.title], title: root.title, sourceUrl: root.sourceUrl });
  for (const child of root.children) categoryMap.set(`${root.slug}/${child.slug}`, { id: `category-cleaver-${root.slug}-${child.slug}`, path: [root.slug, child.slug], titles: [root.title, child.title], title: child.title, parent: `category-cleaver-${root.slug}` });
}

if (inventory.length !== 1432) throw new Error(`Expected 1,432 reviewed Cleaver products; received ${inventory.length}.`);
const skuSet = new Set();
const slugSet = new Set();
const categoryCounts = {};
for (const product of inventory) {
  if (!clean(product.sku) || !clean(product.title)) throw new Error("Cleaver inventory contains a blank SKU or title.");
  if (skuSet.has(normalize(product.sku))) throw new Error(`Duplicate reviewed SKU: ${product.sku}`);
  skuSet.add(normalize(product.sku));
  const slug = productSlug(product.title, product.sku);
  if (slugSet.has(slug)) throw new Error(`Duplicate Cleaver product slug: ${slug}`);
  slugSet.add(slug);
  const category = classify(product.sku, product.title).join("/");
  if (!categoryMap.has(category)) throw new Error(`Unknown Cleaver category: ${category}`);
  categoryCounts[category] = (categoryCounts[category] || 0) + 1;
}

console.log(JSON.stringify({ stage: ENRICH ? "enrich" : APPLY ? "seed" : "dry-run", productCount: inventory.length, categoryCounts }, null, 2));
if (!APPLY && !ENRICH) process.exit(0);

async function retry(label, operation, maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = Number(error?.statusCode || error?.response?.statusCode || 0);
      if (attempt === maxAttempts - 1 || (status && status !== 408 && status !== 409 && status !== 429 && status < 500)) throw error;
      const wait = Math.min(15_000, 750 * (2 ** attempt));
      console.warn(`[Cleaver] retrying ${label} after ${wait}ms`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

async function seedCatalog() {
  const existingBrand = await client.fetch(`*[_type == "brand" && (slug.current in ["cleaver", "cleaverscientific"] || themeKey in ["cleaver", "cleaverscientific"])][0]{_id}`);
  const brandId = existingBrand?._id || BRAND_ID;

  if (!existingBrand) {
    await client.createIfNotExists({ _id: BRAND_ID, _type: "brand", title: "Cleaver Scientific", slug: { _type: "slug", current: "cleaver" }, themeKey: "cleaver", sourceUrl: "https://www.thistlescientific.com/brands/thistle-scientific-ltd/" });
  }

  let categoryTransaction = client.transaction();
  for (const category of categoryMap.values()) {
    const document = {
      _id: category.id,
      _type: "category",
      title: category.title,
      brand: { _type: "reference", _ref: brandId },
      themeKey: "cleaver",
      path: category.path,
      isActive: true,
      pageType: category.path.length === 1 ? "landing" : "listing",
      order: [...categoryMap.keys()].indexOf(category.path.join("/")),
      ...(category.sourceUrl ? { sourceUrl: category.sourceUrl } : {}),
      ...(category.parent ? { parent: { _type: "reference", _ref: category.parent } } : {}),
    };
    categoryTransaction = categoryTransaction.createOrReplace(document);
  }
  await retry("Cleaver categories", () => categoryTransaction.commit({ visibility: "async" }));

  const existingRows = await client.fetch(`*[_type == "product" && migrationKey == $migrationKey]{_id, sku, "hasManagedImage": defined(images[0].asset)}`, { migrationKey: MIGRATION_KEY });
  const existingById = new Map((existingRows || []).map((row) => [row._id, row]));
  const batchSize = 30;

  for (let start = 0; start < inventory.length; start += batchSize) {
    let transaction = client.transaction();
    for (const row of inventory.slice(start, start + batchSize)) {
      const classification = classify(row.sku, row.title);
      const category = categoryMap.get(classification.join("/"));
      const id = productId(row.sku);
      const document = {
        _id: id,
        _type: "product",
        migrationKey: MIGRATION_KEY,
        title: clean(row.title),
        sku: clean(row.sku),
        slug: { _type: "slug", current: productSlug(row.title, row.sku) },
        brand: { _type: "reference", _ref: brandId },
        brandSlug: "cleaver",
        brandName: "Cleaver Scientific",
        categoryRef: { _type: "reference", _ref: category.id },
        categoryPath: category.path,
        categoryPathTitles: category.titles,
        listingPaths: [category.path[0], category.path.join("/")],
        isActive: true,
        productType: "simple",
        order: row.order,
      };
      if (existingById.has(id)) {
        const fields = { ...document };
        delete fields._id;
        delete fields._type;
        transaction = transaction.patch(id, (patch) => patch.set(fields));
      } else transaction = transaction.createIfNotExists(document);
    }
    await retry(`Cleaver products ${start + 1}-${Math.min(start + batchSize, inventory.length)}`, () => transaction.commit({ visibility: "async" }));
    if (start % 150 === 0 || start + batchSize >= inventory.length) console.log(`[Cleaver] seeded ${Math.min(start + batchSize, inventory.length)}/${inventory.length} products`);
  }

  const count = await client.fetch(`count(*[_type == "product" && migrationKey == $migrationKey])`, { migrationKey: MIGRATION_KEY });
  console.log(JSON.stringify({ seededProducts: count, expectedProducts: inventory.length, brandId, categories: categoryMap.size }));
  if (count !== inventory.length) throw new Error(`Sanity contains ${count} Cleaver products; expected ${inventory.length}.`);
}

function officialUrl(value, base = "https://www.thistlescientific.com") {
  if (!value) return "";
  try {
    const url = new URL(String(value), base);
    if (url.protocol !== "https:" || !OFFICIAL_HOSTS.has(url.hostname.toLowerCase())) return "";
    return url.toString();
  } catch {
    return "";
  }
}

async function fetchOfficial(url, accept = "application/json,text/html;q=0.9,*/*;q=0.8") {
  const safeUrl = officialUrl(url);
  if (!safeUrl) throw new Error(`Unapproved Cleaver source URL: ${url}`);
  const response = await fetch(safeUrl, { headers: { Accept: accept }, signal: AbortSignal.timeout(25_000), redirect: "follow" });
  if (response.status === 401 || response.status === 403) throw new Error(`Manufacturer source denied access (HTTP ${response.status}); stopping without bypassing its access controls.`);
  if (!response.ok) return null;
  return response;
}

function htmlSummary(html) {
  if (!html) return "";
  const $ = cheerio.load(String(html));
  $("script,style,form,button,input,.price,.woocommerce-Price-amount,.add_to_cart_button").remove();
  $("a").each((_, item) => $(item).replaceWith($(item).text()));
  return clean($.text()).slice(0, 480);
}

function safeHtml(html) {
  if (!html) return "";
  const $ = cheerio.load(String(html));
  $("script,style,form,button,input,iframe,.price,.woocommerce-Price-amount,.add_to_cart_button").remove();
  $("a").each((_, item) => $(item).replaceWith($(item).text()));
  return clean($.text()) ? $("body").html() || "" : "";
}

function pageDetails(html, sourceUrl) {
  const $ = cheerio.load(html);
  const heading = clean($("h1").first().text());
  const skuValues = new Set();
  $(".sku, [itemprop=sku], [data-sku]").each((_, item) => {
    const value = clean($(item).attr("data-sku") || $(item).text());
    if (value) skuValues.add(normalize(value));
  });

  $("table tr").each((_, item) => {
    const cells = $(item).find("th,td").map((__, cell) => clean($(cell).text())).get();
    if (normalize(cells[0]) === "sku") for (const value of cells.slice(1)) if (value) skuValues.add(normalize(value));
  });

  const imageUrls = new Set();
  const ogImage = officialUrl($("meta[property='og:image']").attr("content"), sourceUrl);
  if (ogImage) imageUrls.add(ogImage);
  $(".woocommerce-product-gallery img, .product-gallery img, [class*=product-gallery] img, .woocommerce-product-gallery__image a").each((_, item) => {
    const raw = $(item).attr("data-large_image") || $(item).attr("data-src") || $(item).attr("src") || $(item).attr("href");
    const image = officialUrl(raw, sourceUrl);
    if (image && !/logo|icon|placeholder|lockup|payment/i.test(image)) imageUrls.add(image);
  });

  const docs = [];
  $("a[href]").each((_, item) => {
    const href = officialUrl($(item).attr("href"), sourceUrl);
    if (!href || !(href.toLowerCase().includes(".pdf") || new URL(href).hostname === "files.plytix.com")) return;
    const label = clean($(item).text()) || "Product document";
    if (!docs.some((document) => document.url === href)) docs.push({ _key: hash(href).slice(0, 12), title: label, label, url: href });
  });

  let overview = $(".woocommerce-product-details__short-description, .woocommerce-Tabs-panel--description, #tab-description, .product-overview").first().html() || "";
  let specs = $(".woocommerce-product-attributes, .shop_attributes, .specifications table").first().toString() || "";
  $("h2,h3,h4,button,summary,[class*=accordion]").each((_, item) => {
    const title = normalize($(item).text());
    if (!overview && (title === "overview" || title.startsWith("overview +"))) {
      overview = $(item).next().html() || $(item).parent().next().html() || "";
    }
    if (!specs && title.startsWith("specifications")) {
      specs = $(item).parent().find("table").first().toString() || $(item).next().find("table").first().toString() || $(item).next("table").toString() || "";
    }
  });

  const variations = [];
  $("form.variations_form[data-product_variations]").each((_, item) => {
    try {
      const parsed = JSON.parse($(item).attr("data-product_variations") || "[]");
      for (const variation of Array.isArray(parsed) ? parsed : []) {
        const sku = clean(variation.sku);
        if (!sku) continue;
        skuValues.add(normalize(sku));
        variations.push({ sku: normalize(sku), image: officialUrl(variation.image?.full_src || variation.image?.src, sourceUrl) });
      }
    } catch {}
  });

  return { heading, skus: [...skuValues], images: [...imageUrls].slice(0, 6), docs: docs.slice(0, 12), overviewHtml: safeHtml(overview), specsHtml: safeHtml(specs), variations, sourceUrl };
}

const FAMILY_PAGES = [
  ["multisub mini", "https://www.thistlescientific.com/product/multisub-mini-mini-horizontal-electrophoresis-system/"],
  ["multisub midi96", "https://www.thistlescientific.com/product/multisub-midi96-96-well-electrophoresis-system/"],
  ["multisub midi", "https://www.thistlescientific.com/product/multisub-midi-midi-horizontal-electrophoresis-system/"],
  ["multisub choice", "https://www.thistlescientific.com/product/multisub-choice-wide-midi-horizontal-electrophoresis-system/"],
  ["multisub maxi", "https://www.thistlescientific.com/product/multisub-maxi-maxi-horizontal-electrophoresis-system/"],
  ["multisub screen", "https://www.thistlescientific.com/product/multisub-screen-high-throughput-horizontal-electrophoresis-system/"],
  ["omnipage mini wide", "https://www.thistlescientific.com/product/omnipage-mini-wide-vertical-protein-electrophoresis-system/"],
  ["omnipage mini", "https://www.thistlescientific.com/product/omnipage-mini-vertical-protein-electrophoresis-system/"],
  ["propage", "https://www.thistlescientific.com/product/propage-2-mini-page-system-for-2-gels/"],
  ["omniblot", "https://www.thistlescientific.com/product/omniblot-blotter/"],
  ["powerpro", "https://www.thistlescientific.com/product/powerpro-300-power-supply-300v-700ma-150w/"],
  ["nanopac", "https://www.thistlescientific.com/product/nanopac-300p-power-supply-300v-400ma-60w/"],
  ["runview", "https://www.thistlescientific.com/product/runview-real-time-gel-visualisation-system/"],
  ["microdoc", "https://www.thistlescientific.com/product/microdoc-gel-documentation-hood-with-screen/"],
  ["omnidoc", "https://www.thistlescientific.com/product/omnidoc-gel-documentation-system/"],
  ["omnipette", "https://www.thistlescientific.com/product/omnipette/"],
  ["comet assay", "https://www.thistlescientific.com/product/comet-assay-tanks-for-10-40-slides/"],
  ["gamma shield", "https://www.thistlescientific.com/product/gamma-shield-hourglass-flat-base/"],
];

async function enrichCatalog() {
  const recordsBySku = new Map(inventory.map((row) => [normalize(row.sku), row]));
  const sourceBySku = new Map();
  const familyDetails = new Map();
  const detailByUrl = new Map();
  const pendingPages = new Map();
  const assetByUrl = new Map();
  let htmlAvailable = true;

  for (const [family, url] of FAMILY_PAGES) {
    try {
      const response = await fetchOfficial(url, "text/html,*/*;q=0.8");
      if (!response) continue;
      const details = pageDetails(await response.text(), url);
      familyDetails.set(family, details);
      detailByUrl.set(url, details);
      for (const sku of details.skus) if (recordsBySku.has(sku)) sourceBySku.set(sku, details);
      for (const variation of details.variations) if (recordsBySku.has(variation.sku)) sourceBySku.set(variation.sku, { ...details, images: [...new Set([variation.image, ...details.images].filter(Boolean))] });
    } catch (error) {
      console.warn(`[Cleaver] family page ${family}: ${error.message}`);
      if (/denied access/.test(error.message)) {
        htmlAvailable = false;
        console.warn("[Cleaver] manufacturer HTML pages are restricted; continuing with the public product API only");
        break;
      }
    }
  }

  let storeAvailable = true;
  const skuRows = [...recordsBySku.keys()];
  for (let start = 0; start < skuRows.length && storeAvailable; start += 35) {
    const searchUrl = new URL("https://www.thistlescientific.com/wp-json/wc/store/v1/products");
    searchUrl.searchParams.set("sku", skuRows.slice(start, start + 35).join(","));
    searchUrl.searchParams.set("per_page", "100");
    try {
      const response = await fetchOfficial(searchUrl.toString());
      if (!response || !(response.headers.get("content-type") || "").includes("json")) {
        storeAvailable = false;
        break;
      }
      const results = await response.json();
      if (!Array.isArray(results)) { storeAvailable = false; break; }
      for (const item of results) {
        const sku = normalize(item.sku);
        const sourceUrl = officialUrl(item.permalink);
        if (!recordsBySku.has(sku) || !sourceUrl) continue;
        sourceBySku.set(sku, {
          heading: clean(item.name),
          skus: [sku],
          images: (item.images || []).map((image) => officialUrl(image.src)).filter(Boolean).slice(0, 6),
          docs: [],
          overviewHtml: safeHtml(item.description || item.short_description),
          specsHtml: "",
          variations: [],
          sourceUrl,
        });
        pendingPages.set(sourceUrl, sku);
      }
      if (start % 175 === 0) console.log(`[Cleaver] reviewed ${Math.min(start + 35, skuRows.length)}/${skuRows.length} official catalog numbers; ${sourceBySku.size} exact source matches`);
    } catch (error) {
      if (/denied access/.test(error.message)) throw error;
      console.warn(`[Cleaver] official product API unavailable: ${error.message}`);
      storeAvailable = false;
    }
  }

  for (const root of htmlAvailable ? categories : []) {
    try {
      const response = await fetchOfficial(root.sourceUrl, "text/html,*/*;q=0.8");
      if (!response) continue;
      const $ = cheerio.load(await response.text());
      $("a[href*='/product/']").each((_, item) => {
        const sourceUrl = officialUrl($(item).attr("href"), root.sourceUrl);
        const text = normalize($(item).find("h2,h3,.woocommerce-loop-product__title").first().text() || $(item).attr("aria-label") || $(item).text());
        if (!sourceUrl || !text) return;
        const exact = inventory.find((row) => normalize(row.title) === text);
        if (exact) pendingPages.set(sourceUrl, normalize(exact.sku));
      });
    } catch (error) {
      console.warn(`[Cleaver] official category ${root.slug}: ${error.message}`);
      if (/denied access/.test(error.message)) {
        htmlAvailable = false;
        break;
      }
    }
  }

  let pageIndex = 0;
  for (const [url, requestedSku] of htmlAvailable ? [...pendingPages.entries()].slice(0, 550) : []) {
    pageIndex += 1;
    try {
      let details = detailByUrl.get(url);
      if (!details) {
        const response = await fetchOfficial(url, "text/html,*/*;q=0.8");
        if (!response) continue;
        details = pageDetails(await response.text(), url);
        detailByUrl.set(url, details);
      }
      if (recordsBySku.has(requestedSku)) sourceBySku.set(requestedSku, { ...sourceBySku.get(requestedSku), ...details, images: details.images.length ? details.images : sourceBySku.get(requestedSku)?.images || [] });
      for (const sku of details.skus) if (recordsBySku.has(sku)) sourceBySku.set(sku, details);
      for (const variation of details.variations) if (recordsBySku.has(variation.sku)) sourceBySku.set(variation.sku, { ...details, images: [...new Set([variation.image, ...details.images].filter(Boolean))] });
      if (pageIndex % 50 === 0) console.log(`[Cleaver] reviewed ${pageIndex} official product pages; ${sourceBySku.size} verified product matches`);
    } catch (error) {
      console.warn(`[Cleaver] official product page failed: ${error.message}`);
      if (/denied access/.test(error.message)) {
        htmlAvailable = false;
        break;
      }
    }
  }

  async function uploadManagedImage(url, sku) {
    const safe = officialUrl(url);
    if (!safe) return null;
    if (assetByUrl.has(safe)) return assetByUrl.get(safe);
    const response = await fetchOfficial(safe, "image/*,*/*;q=0.5");
    if (!response || !(response.headers.get("content-type") || "").startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1_500 || bytes.length > 15_000_000) return null;
    const extension = (new URL(safe).pathname.match(/\.(?:png|jpe?g|webp|gif)$/i)?.[0] || ".jpg").toLowerCase();
    const asset = await retry(`image ${sku}`, () => client.assets.upload("image", bytes, { filename: `cleaver-${slugify(sku)}-${hash(safe).slice(0, 10)}${extension}`, contentType: response.headers.get("content-type") || undefined }));
    const reference = { _key: hash(safe).slice(0, 12), _type: "image", asset: { _type: "reference", _ref: asset._id }, sourceUrl: safe };
    assetByUrl.set(safe, reference);
    return reference;
  }

  let enriched = 0;
  let withImages = 0;
  let withDocuments = 0;
  let imageFetchAvailable = true;
  for (const row of inventory) {
    const sku = normalize(row.sku);
    let details = sourceBySku.get(sku);
    if (!details) {
      const family = [...familyDetails.entries()].find(([name]) => normalize(row.title).startsWith(name));
      if (family) {
        const hasExactVariation = family[1].skus.includes(sku);
        if (hasExactVariation) details = family[1];
      }
    }
    if (!details) continue;

    const images = [];
    for (const url of imageFetchAvailable ? details.images.slice(0, 4) : []) {
      try {
        const image = await uploadManagedImage(url, row.sku);
        if (image && !images.some((existing) => existing.asset._ref === image.asset._ref)) images.push(image);
      } catch (error) {
        console.warn(`[Cleaver] image ${row.sku}: ${error.message}`);
        if (/denied access/.test(error.message)) {
          imageFetchAvailable = false;
          console.warn("[Cleaver] manufacturer image downloads are restricted; continuing with verified product descriptions");
          break;
        }
      }
    }

    const fields = {
      sourceUrl: details.sourceUrl,
      enrichedAt: new Date().toISOString(),
      ...(details.overviewHtml ? { overviewHtml: details.overviewHtml, summary: htmlSummary(details.overviewHtml) } : {}),
      ...(details.specsHtml ? { specsHtml: details.specsHtml } : {}),
      ...(details.docs?.length ? { docs: details.docs } : {}),
      ...(images.length ? { images } : {}),
    };
    await retry(`product enrichment ${row.sku}`, () => client.patch(productId(row.sku)).set(fields).commit({ visibility: "async" }));
    enriched += 1;
    if (images.length) withImages += 1;
    if (details.docs?.length) withDocuments += 1;
    if (enriched % 50 === 0) console.log(`[Cleaver] enriched ${enriched} exact products; ${withImages} with managed Sanity images`);
  }

  console.log(JSON.stringify({ reviewedProducts: inventory.length, exactOfficialMatches: sourceBySku.size, enriched, withManagedImages: withImages, withDocuments, uniqueManagedImages: assetByUrl.size, manufacturerApiAvailable: storeAvailable }));
}

if (APPLY) await seedCatalog();
if (ENRICH) await enrichCatalog();
