#!/usr/bin/env node
/**
 * ABM full rebuild census v2 (READ ONLY)
 *
 * Agreed scope:
 * - migrate all normal ABM products
 * - exclude library product branches / library SKUs
 * - keep Collection-labelled products in REVIEW unless clearly a library
 * - migrate all ABM services, including service items with Cat. No.
 * - compare to current Sanity without writing anything
 */

import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const BASE = "https://www.abmgood.com";
const OUT = path.resolve(".cache/abm-full-census");
const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8";
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";

const argv = process.argv.slice(2);
const readArg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const CONCURRENCY = Math.max(1, Math.min(8, Number(readArg("--concurrency", "4")) || 4));
const GAP_MS = Math.max(0, Number(readArg("--gap-ms", "100")) || 100);
const MAX_PAGES_PER_SEED = Math.max(20, Number(readArg("--max-pages-per-seed", "1200")) || 1200);
const MAX_TOTAL_FETCHES = Math.max(100, Number(readArg("--max-total-fetches", "20000")) || 20000);

const PRODUCT_SEEDS = [
  // General Materials
  ["General Materials", "PCR Enzymes", "/PCR-Enzymes.html", "include"],
  ["General Materials", "Enzymes & Kits", "/Molecular-Biology-Enzymes-and-Kits.html", "include"],
  ["General Materials", "Antibodies", "/antibodies.html", "include"],
  ["General Materials", "Biorepository", "/biorepository.html", "include"],
  ["General Materials", "Transfection Reagents", "/Transfection-Reagent-Protocol-Efficiency.html", "include"],
  ["General Materials", "DNA/RNA Purification", "/DNA-RNA-Purification-Kits.html", "include"],
  ["General Materials", "Gel Documentation", "/Gel-Documentation.html", "include"],
  ["General Materials", "RNA Tracking (RNA Mango)", "/RNA-Mango.html", "include"],
  ["General Materials", "Buffers & Chemicals", "/Buffers-and-Chemicals.html", "include"],
  ["General Materials", "Equipment", "/lab-equipment.html", "include"],
  ["General Materials", "DNA & Protein Ladders", "/DNA-and-Protein-Ladders.html", "include"],

  // Cellular Materials
  ["Cellular Materials", "Cell Library Collections", "/cellular-collections.html", "exclude_library"],
  ["Cellular Materials", "Special Cell Line Collections", "/Special-Cell-Line-Collection.html", "review"],
  ["Cellular Materials", "3D and Organoid", "/3d-organoid.html", "include"],
  ["Cellular Materials", "Microbial Contamination", "/microbial-contamination-control.html", "include"],
  ["Cellular Materials", "Cell Immortalization Reagents", "/Cell-Immortalization.html", "include"],
  ["Cellular Materials", "Media & Supplements", "/Media-and-Supplements.html", "include"],
  ["Cellular Materials", "Growth Factors and Cytokines", "/Growth-Factors-Cytokines.html", "include"],
  ["Cellular Materials", "Culture Consumables", "/Culture-Consumables.html", "include"],
  ["Cellular Materials", "Cell Assay Products", "/Cell-based-Assay-Products.html", "include"],
  ["Cellular Materials", "Cell Culture Equipment", "/Cell-Culture-Equipment.html", "include"],

  // Genetic Materials
  ["Genetic Materials", "Expression-Ready Libraries", "/expression-ready-libraries.html", "exclude_library"],
  ["Genetic Materials", "CRISPR", "/CRISPR-Cas9-sgRNA.html", "include"],
  ["Genetic Materials", "Expression Systems", "/expression-systems.html", "include"],
  ["Genetic Materials", "Specialized Vectors", "/Vectors.html", "include"],
  ["Genetic Materials", "Kits for Viral Vectors", "/Recombinant-Virus-Kits.html", "include"],
].map(([root, title, fallbackPath, mode]) => ({ root, title, fallbackUrl: `${BASE}${fallbackPath}`, mode }));

const SERVICE_SEEDS = [
  { root: "Cell & Antibody Services", title: "Cell & Antibody Services", fallbackUrl: `${BASE}/Cell-Antibody-Services.html` },
  { root: "DNA & Cloning Services", title: "DNA & Cloning Services", fallbackUrl: `${BASE}/Custom-Cloning-Service.html` },
  { root: "Recombinant Virus Packaging", title: "Recombinant Virus Packaging", fallbackUrl: `${BASE}/Virus-Packaging-Services.html` },
];

const KNOWN_SERVICE_TITLES = new Set([
  "Cell & Antibody Services",
  "3D and Organoid Services",
  "Cell Biology Services",
  "Custom Antibody Engineering",
  "Protein Services",
  "Histology",
  "CRISPR Stable Knockout Cell Line",
  "Cell Immortalization Service",
  "Stable Cell Line Generation Service",
  "Mycoplasma Detection & Decontamination Service",
  "Cell Line Authentication Service",
  "Gene Expression Assay Service",
  "Cell Line Insurance",
  "Mouse Monoclonal Antibody Production",
  "Rabbit Monoclonal Antibody Production",
  "Custom Peptide Synthesis",
  "Custom Protein Production",
  "IHC Staining",
  "IHC Optimization",
  "Custom Tissue Microarray",
  "DNA & Cloning Services",
  "Custom CRISPR Vectors & Viruses",
  "Custom Cloning & Gene Synthesis",
  "Custom Vectors",
  "Primer & Probe Design",
  "CRISPR sgRNA Lentiviral Vectors & Viruses",
  "CRISPR sgRNA AAV Vectors & Viruses",
  "CRISPR sgRNA Adenovirus",
  "CRISPR sgRNA Non-Viral Vectors",
  "CRISPR Knock-In Repair Templates",
  "CRISPR Multiplex sgRNA Vector",
  "CRISPR Targeted Lentiviral sgRNA Library",
  "Custom Vector Design",
  "circRNA Expression Vectors",
  "Cre-Inducible Vectors (DIO)",
  "Recombinant Virus Packaging",
  "Recombinant Lentivirus",
  "Recombinant AAV",
  "Recombinant Adenovirus",
  "Recombinant Retrovirus",
]);

const SKIP_PREFIXES = [
  "/about", "/contact", "/resources", "/promotion", "/privacy", "/terms", "/rewards", "/research",
  "/collaborate", "/account", "/login", "/register", "/cart", "/blog", "/news", "/knowledge",
];

let totalFetches = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (v) => String(v || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

function normUrl(raw, base = BASE) {
  const s = String(raw || "").trim();
  if (!s || s.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(s)) return "";
  try {
    const u = new URL(s, base);
    if (!["abmgood.com", "www.abmgood.com"].includes(u.hostname)) return "";
    u.protocol = "https:";
    u.hostname = "www.abmgood.com";
    u.hash = "";
    return u.toString();
  } catch { return ""; }
}

function noQuery(raw) {
  const s = normUrl(raw);
  if (!s) return "";
  const u = new URL(s); u.search = ""; return u.toString();
}

function skipUrl(url) {
  try {
    const p = new URL(url).pathname.toLowerCase();
    if (SKIP_PREFIXES.some((x) => p.startsWith(x))) return true;
    return /\.(pdf|docx?|xlsx?|zip|png|jpe?g|gif|webp|svg|mp4)$/i.test(p);
  } catch { return true; }
}

async function fetchHtml(url, retries = 2) {
  if (++totalFetches > MAX_TOTAL_FETCHES) throw new Error(`MAX_TOTAL_FETCHES ${MAX_TOTAL_FETCHES} reached`);
  let error;
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      if (GAP_MS) await wait(GAP_MS);
      const res = await fetch(url, {
        cache: "no-store", redirect: "follow", signal: controller.signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-Rebuild/2.0; +https://itsbio.vercel.app)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.9",
        },
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      clearTimeout(timer); error = e;
      if (i < retries) await wait(400 * (i + 1));
    }
  }
  throw error;
}

function resolveAnchors(html, pageUrl) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const map = new Map();
  $("a[href]").each((_, a) => {
    const label = text($(a).text() || $(a).attr("title") || $(a).find("img").attr("alt"));
    const url = noQuery(normUrl($(a).attr("href"), pageUrl));
    if (label && url && !map.has(label)) map.set(label, url);
  });
  return map;
}

function pageScope($) {
  for (const sel of ["#abm-category-right-outer", "#content", "main", ".main-content", ".container"]) {
    const el = $(sel).first(); if (el.length) return el;
  }
  return $("body");
}

function parsePage(html, url) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const scope = pageScope($).clone();
  scope.find("header,footer,nav,script,style,noscript,.breadcrumb,ul.abm-page-category-nav-list").remove();
  const bodyText = text(scope.text());
  const sku = bodyText.match(/Cat\.?\s*No\.?\s*[:#]?\s*([A-Za-z0-9._/+\-]+)/i)?.[1] || "";
  const tabs = ["Specifications", "Datasheet", "Documents", "FAQs", "References", "Reviews"]
    .filter((name) => scope.find("a,button,li").toArray().some((el) => text($(el).text()).toLowerCase() === name.toLowerCase())).length;
  const pageTitle = text(scope.find("h1").first().text() || scope.find("h2.abm-categories-title-h2").first().text() || $("h1").first().text() || $("title").first().text()).replace(/\s*\|.*$/, "");
  const isProduct = Boolean(sku || tabs >= 2);
  const categoryMarker = Boolean($("#abm-category-right-outer,.abm-categories-text,h2.abm-categories-title-h2").length);

  const links = new Map();
  scope.find("a[href]").each((_, a) => {
    const label = text($(a).text() || $(a).attr("title") || $(a).find("img").attr("alt"));
    const href = normUrl($(a).attr("href"), url);
    if (!label || !href || skipUrl(href)) return;
    const key = noQuery(href);
    if (!key || key === noQuery(url)) return;
    if (!links.has(key)) links.set(key, { url: key, label });
  });

  const pagination = [];
  $(".pagination a[href],a[rel='next'][href]").each((_, a) => {
    const href = normUrl($(a).attr("href"), url);
    if (href && new URL(href).pathname === new URL(url).pathname && new URL(href).search) pagination.push(href);
  });

  return { title: pageTitle, sku, isProduct, categoryMarker, links: [...links.values()], pagination: [...new Set(pagination)] };
}

function looksCatalogish(link) {
  if (!link?.url || skipUrl(link.url)) return false;
  const p = new URL(link.url).pathname.toLowerCase();
  if (p === "/" || p === "/browse") return false;
  if (/\.(html?)$/i.test(p)) return true;
  if (!/\.[a-z0-9]{2,5}$/i.test(p)) return true;
  return false;
}

function libraryLabel(label) { return /\blibrar(?:y|ies)\b/i.test(label || ""); }
function collectionLabel(label) { return /\bcollections?\b/i.test(label || ""); }

async function crawlProductSeed(seed, resolvedUrl) {
  const queue = [{ url: resolvedUrl, path: [seed.root, seed.title], mode: seed.mode, depth: 0 }];
  const seen = new Set();
  const products = [];
  const exclusions = [];
  const failures = [];

  while (queue.length && seen.size < MAX_PAGES_PER_SEED && totalFetches < MAX_TOTAL_FETCHES) {
    const item = queue.shift();
    if (!item?.url || seen.has(item.url)) continue;
    seen.add(item.url);
    try {
      const html = await fetchHtml(item.url, 1);
      const parsed = parsePage(html, item.url);
      if (parsed.isProduct) {
        const title = parsed.title || "";
        if (item.mode === "exclude_library" || libraryLabel(title)) {
          exclusions.push({ status: "EXCLUDE_LIBRARY", sku: parsed.sku, title, url: item.url, categoryPath: item.path, reason: "library product/branch" });
        } else {
          const status = item.mode === "review" || collectionLabel(title) ? "REVIEW" : "INCLUDE";
          products.push({ status, sku: parsed.sku, title, url: item.url, categoryPath: item.path, reason: status === "REVIEW" ? "collection-labelled product requires review" : "normal product" });
        }
        continue;
      }

      // Same-page pagination stays in the same category context.
      for (const next of parsed.pagination) if (!seen.has(next)) queue.push({ ...item, url: next });

      if (!parsed.categoryMarker && item.depth > 0) continue;
      for (const link of parsed.links) {
        if (!looksCatalogish(link)) continue;
        if (libraryLabel(link.label)) {
          exclusions.push({ status: "EXCLUDE_LIBRARY", sku: "", title: link.label, url: link.url, categoryPath: [...item.path, link.label], reason: "library sub-branch intentionally not crawled" });
          continue;
        }
        const nextMode = item.mode === "review" || collectionLabel(link.label) ? "review" : item.mode;
        queue.push({ url: link.url, path: [...item.path, link.label].slice(0, 6), mode: nextMode, depth: item.depth + 1 });
      }
    } catch (e) {
      failures.push({ url: item.url, path: item.path, error: String(e?.message || e) });
    }
  }
  return { seed, resolvedUrl, pagesVisited: seen.size, products, exclusions, failures };
}

async function crawlServiceSeed(seed, resolvedUrl) {
  const queue = [{ url: resolvedUrl, path: [seed.root], depth: 0 }];
  const seen = new Set();
  const services = new Map();
  const failures = [];

  while (queue.length && seen.size < MAX_PAGES_PER_SEED && totalFetches < MAX_TOTAL_FETCHES) {
    const item = queue.shift();
    if (!item?.url || seen.has(item.url)) continue;
    seen.add(item.url);
    try {
      const html = await fetchHtml(item.url, 1);
      const parsed = parsePage(html, item.url);
      const title = parsed.title || item.path.at(-1) || seed.title;
      const known = KNOWN_SERVICE_TITLES.has(title) || /\b(service|packaging|production|synthesis|design|optimization|authentication|insurance|staining|microarray)\b/i.test(title);
      if (known || parsed.isProduct || item.depth === 0) {
        services.set(noQuery(item.url), {
          title, sku: parsed.sku || "", url: noQuery(item.url), path: item.path, isServiceItem: parsed.isProduct,
        });
      }
      if (item.depth >= 4) continue;
      for (const link of parsed.links) {
        if (!looksCatalogish(link)) continue;
        const label = link.label;
        const looksService = KNOWN_SERVICE_TITLES.has(label) || /\b(service|packaging|production|synthesis|design|optimization|authentication|insurance|staining|microarray|vector|virus|probe|primer)\b/i.test(label);
        if (!looksService) continue;
        queue.push({ url: link.url, path: [...item.path, label].slice(0, 6), depth: item.depth + 1 });
      }
    } catch (e) {
      failures.push({ url: item.url, path: item.path, error: String(e?.message || e) });
    }
  }
  return { seed, resolvedUrl, pagesVisited: seen.size, services: [...services.values()], failures };
}

function dedupeProducts(rows) {
  const byUrl = new Map();
  for (const row of rows) {
    const key = noQuery(row.url) || `${row.sku}::${row.title}`;
    if (!key) continue;
    const existing = byUrl.get(key);
    if (!existing) byUrl.set(key, { ...row, listingPaths: [row.categoryPath] });
    else {
      const trail = row.categoryPath.join(" > ");
      if (!existing.listingPaths.some((x) => x.join(" > ") === trail)) existing.listingPaths.push(row.categoryPath);
      if (row.status === "REVIEW") existing.status = "REVIEW";
    }
  }
  return [...byUrl.values()];
}

async function pool(items, fn) {
  const out = new Array(items.length); let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (true) { const i = cursor++; if (i >= items.length) return; out[i] = await fn(items[i], i); }
  });
  await Promise.all(workers); return out;
}

async function sanityInventory() {
  const query = `{
    "products": *[_type=="product" && !(_id in path("drafts.**")) && (brandSlug=="abm" || brand->slug.current=="abm" || brand->themeKey=="abm")]{_id,title,sku,"slug":slug.current,sourceUrl,categoryPath,isActive},
    "productDrafts": count(*[_type=="product" && _id in path("drafts.**") && (brandSlug=="abm" || brand->slug.current=="abm" || brand->themeKey=="abm")]),
    "categories": *[_type=="category" && !(_id in path("drafts.**")) && (brandSlug=="abm" || themeKey=="abm" || brand->slug.current=="abm" || brand->themeKey=="abm")]{_id,title,path,sourceUrl,isActive},
    "categoryDrafts": count(*[_type=="category" && _id in path("drafts.**") && (brandSlug=="abm" || themeKey=="abm" || brand->slug.current=="abm" || brand->themeKey=="abm")])
  }`;
  const u = new URL(`https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}`); u.searchParams.set("query", query);
  try { const r = await fetch(u); if (!r.ok) throw new Error(`HTTP ${r.status}`); return (await r.json()).result || {}; }
  catch (e) { return { error: String(e?.message || e) }; }
}

function writeJson(name, value) { fs.writeFileSync(path.join(OUT, name), JSON.stringify(value, null, 2)); }
function csvCell(v) { const s = Array.isArray(v) ? v.join(" > ") : String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s; }
function writeProductCsv(name, rows) {
  const head = ["status","sku","title","url","categoryPath","listingPaths","reason"];
  const lines = [head.join(",")];
  for (const r of rows) lines.push(head.map((k) => csvCell(k === "listingPaths" ? (r.listingPaths || []).map((p) => p.join(" > ")).join(" | ") : r[k])).join(","));
  fs.writeFileSync(path.join(OUT, name), lines.join("\n") + "\n");
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("[ABM v2] resolving current official links...");
  const home = await fetchHtml(`${BASE}/`);
  const browse = await fetchHtml(`${BASE}/browse`);
  const anchors = new Map([...resolveAnchors(home, `${BASE}/`), ...resolveAnchors(browse, `${BASE}/browse`)]);

  const productSeeds = PRODUCT_SEEDS.map((s) => ({ ...s, url: anchors.get(s.title) || s.fallbackUrl }));
  const serviceSeeds = SERVICE_SEEDS.map((s) => ({ ...s, url: anchors.get(s.title) || s.fallbackUrl }));

  const excludedSeedBranches = productSeeds.filter((s) => s.mode === "exclude_library").map((s) => ({
    status: "EXCLUDE_LIBRARY", sku: "", title: s.title, url: s.url, categoryPath: [s.root, s.title], reason: "large library/catalog seed branch intentionally not crawled",
  }));

  const crawlSeeds = productSeeds.filter((s) => s.mode !== "exclude_library");
  console.log(`[ABM v2] crawling ${crawlSeeds.length} product branches; ${excludedSeedBranches.length} library branches excluded`);
  const productRuns = await pool(crawlSeeds, async (seed, i) => {
    console.log(`[product seed ${i+1}/${crawlSeeds.length}] ${seed.root} > ${seed.title}`);
    return crawlProductSeed(seed, seed.url);
  });

  console.log(`[ABM v2] crawling ${serviceSeeds.length} service roots`);
  const serviceRuns = await pool(serviceSeeds, async (seed, i) => {
    console.log(`[service seed ${i+1}/${serviceSeeds.length}] ${seed.title}`);
    return crawlServiceSeed(seed, seed.url);
  });

  const productRows = dedupeProducts(productRuns.flatMap((r) => r.products));
  const include = productRows.filter((r) => r.status === "INCLUDE");
  const review = productRows.filter((r) => r.status === "REVIEW");
  const excluded = [...excludedSeedBranches, ...productRuns.flatMap((r) => r.exclusions)];
  const services = [...new Map(serviceRuns.flatMap((r) => r.services).map((s) => [noQuery(s.url), s])).values()];
  const failures = [...productRuns.flatMap((r) => r.failures), ...serviceRuns.flatMap((r) => r.failures)];

  const sanity = await sanityInventory();
  const sanityProducts = Array.isArray(sanity.products) ? sanity.products : [];
  const sanityUrls = new Set(sanityProducts.map((p) => noQuery(p.sourceUrl)).filter(Boolean));
  const officialNormal = [...include, ...review];
  const officialUrls = new Set(officialNormal.map((p) => noQuery(p.url)).filter(Boolean));
  const missingFromSanity = officialNormal.filter((p) => !sanityUrls.has(noQuery(p.url)));
  const sanityOnly = sanityProducts.filter((p) => p.sourceUrl && !officialUrls.has(noQuery(p.sourceUrl)));

  const summary = {
    generatedAt: new Date().toISOString(), totalFetches,
    scope: { normalProducts: "include", libraryProducts: "exclude", collectionLabelledProducts: "review", services: "include all", sanityWrites: 0 },
    product: {
      seedBranches: productSeeds.length, crawledBranches: crawlSeeds.length, excludedLibrarySeedBranches: excludedSeedBranches.length,
      pagesVisited: productRuns.reduce((n,r)=>n+r.pagesVisited,0), include: include.length, review: review.length,
      excludedLibraryRecords: excluded.length,
    },
    services: { roots: serviceSeeds.length, pagesVisited: serviceRuns.reduce((n,r)=>n+r.pagesVisited,0), records: services.length, serviceItemsWithSku: services.filter((s)=>s.sku).length },
    failures: failures.length,
    sanity: {
      error: sanity.error || null, publishedProducts: sanityProducts.length, productDrafts: Number(sanity.productDrafts||0),
      publishedCategories: Array.isArray(sanity.categories) ? sanity.categories.length : 0, categoryDrafts: Number(sanity.categoryDrafts||0),
      officialNormalProductsMissingFromSanity: missingFromSanity.length, sanityProductsOutsideNormalCensus: sanityOnly.length,
    },
  };

  writeJson("resolved-product-seeds.json", productSeeds);
  writeJson("product-runs.json", productRuns.map((r)=>({seed:r.seed,resolvedUrl:r.resolvedUrl,pagesVisited:r.pagesVisited,failures:r.failures.length})));
  writeJson("products-include.json", include);
  writeJson("products-review.json", review);
  writeJson("products-exclude-library.json", excluded);
  writeJson("services.json", services);
  writeJson("failures.json", failures);
  writeJson("sanity-inventory.json", sanity);
  writeJson("missing-from-sanity.json", missingFromSanity);
  writeJson("sanity-only.json", sanityOnly);
  writeJson("summary.json", summary);
  writeProductCsv("products-include.csv", include);
  writeProductCsv("products-review.csv", review);
  writeProductCsv("products-exclude-library.csv", excluded);

  const md = `# ABM full rebuild census v2\n\nGenerated: ${summary.generatedAt}\n\n## Scope\n- Normal Product: **include**\n- Library Product: **exclude**\n- Collection-labelled product: **review**\n- Service: **include all**\n- Sanity writes: **0**\n\n## Products\n- Seed branches: **${summary.product.seedBranches}**\n- Crawled normal/review branches: **${summary.product.crawledBranches}**\n- Large-library seed branches excluded: **${summary.product.excludedLibrarySeedBranches}**\n- Pages visited: **${summary.product.pagesVisited}**\n- INCLUDE: **${summary.product.include}**\n- REVIEW: **${summary.product.review}**\n- EXCLUDE_LIBRARY records: **${summary.product.excludedLibraryRecords}**\n\n## Services\n- Service roots: **${summary.services.roots}**\n- Pages visited: **${summary.services.pagesVisited}**\n- Service records: **${summary.services.records}**\n- Service items with Cat.No: **${summary.services.serviceItemsWithSku}**\n\n## Current Sanity\n- Published ABM products: **${summary.sanity.publishedProducts}**\n- Product drafts: **${summary.sanity.productDrafts}**\n- Published ABM categories: **${summary.sanity.publishedCategories}**\n- Category drafts: **${summary.sanity.categoryDrafts}**\n- Official normal/review products missing from Sanity: **${summary.sanity.officialNormalProductsMissingFromSanity}**\n- Sanity products outside this normal census: **${summary.sanity.sanityProductsOutsideNormalCensus}**\n\nFetch failures: **${summary.failures}**\n`;
  fs.writeFileSync(path.join(OUT, "summary.md"), md);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => { console.error("[ABM census v2] FATAL", e?.stack || e); process.exit(1); });
