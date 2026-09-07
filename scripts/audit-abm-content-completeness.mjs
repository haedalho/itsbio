#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { createClient } from "next-sanity";

const VERSION = "2026-08-09-search-v5";
const EXPECTED_PRODUCTS = 5144;
const EXPECTED_SERVICES = 251;
const EXPECTED_LANDINGS = 40;
const OUT = path.resolve(".cache/abm-content-completeness");
fs.mkdirSync(OUT, { recursive: true });

const projectId = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const dataset = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const apiVersion = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const client = createClient({ projectId, dataset, apiVersion, useCdn: false });

const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const lower = (value) => clean(value).toLowerCase();
const PLACEHOLDER = "This item is in the authoritative ABM inventory";
const BAD_PAGE_RE = /(?:pagenotfound|\b404\b|page\s+not\s+found|page\s+you\s+are\s+looking\s+for\s+can(?:not|'t)\s+be\s+found)/i;
const PRICE_RE = /(?:\b(?:USD|CAD)\b\s*:?)?\s*\$\s*\d|\b(?:USD|CAD)\s+\d[\d,.]*/i;
const COMMERCE_RE = /\b(?:add\s+to\s+cart|shopping\s+cart|checkout)\b/i;

function managedImage(value) {
  try {
    const url = new URL(String(value || ""));
    return url.hostname === "cdn.sanity.io" && url.pathname.startsWith("/images/9b5twpc8/");
  } catch {
    return false;
  }
}

function htmlText(value) {
  if (!value) return "";
  return clean(cheerio.load(`<div id="__audit">${String(value)}</div>`)("#__audit").text());
}

function offerText(offer) {
  if (!offer || typeof offer !== "object") return "";
  return clean([
    offer.sku,
    offer.title,
    offer.unit,
    ...(Array.isArray(offer.fields) ? offer.fields.flatMap((field) => [field?.label, field?.value]) : []),
  ].filter(Boolean).join(" "));
}

function recordContent(record) {
  const plain = [record.description, record.storage, record.materialCitation].map(clean).filter(Boolean);
  const htmlFields = [
    "introHtml",
    "specificationsHtml",
    "datasheetHtml",
    "documentsHtml",
    "faqsHtml",
    "referencesHtml",
    "reviewsHtml",
    "serviceDetailsHtml",
  ];
  const html = htmlFields.map((field) => htmlText(record[field])).filter(Boolean);
  const offer = offerText(record.serviceOffer);
  const docs = Array.isArray(record.documents) ? record.documents : [];
  return {
    text: clean([...plain, ...html, offer].filter(Boolean).join(" ")),
    specificationsText: htmlText(record.specificationsHtml),
    htmlFieldsWithText: htmlFields.filter((field) => htmlText(record[field]).length > 0),
    documents: docs.length,
    images: Array.isArray(record.images) ? record.images.length : 0,
  };
}

function blankSpecificationRows(html) {
  if (!html) return 0;
  const $ = cheerio.load(`<div id="__root">${String(html)}</div>`);
  let count = 0;
  $("#__root tr").each((_, tr) => {
    const cells = $(tr).children("td").toArray();
    if (cells.length < 2) return;
    const label = clean($(cells[0]).text());
    if (!label) return;
    const hasValue = cells.slice(1).some((cell) => {
      const node = $(cell);
      return Boolean(clean(node.text())) || Boolean(node.find("img,svg,a,button,input,select,video,audio").length);
    });
    if (!hasValue) count += 1;
  });
  return count;
}

function inventoryKey(kind, row) {
  return `${kind}:${lower(row?.sku || row?.url)}`;
}

async function mapLimit(items, limit, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await mapper(items[index], index);
    }
  }));
  return output;
}

const index = await client.fetch(`{
  "inventoryProducts": *[_type == "abmRebuildChunk" && version == $version && kind == "product"].records[]{sku,title,url,previewImage},
  "inventoryServices": *[_type == "abmRebuildChunk" && version == $version && kind == "service"].records[]{sku,title,url,previewImage},
  "detailDocs": *[_type == "abmRebuildDetailChunk" && version == $version]{_id,kind},
  "landingDocs": *[_type == "abmRebuildLandingChunk" && version == $version && kind == "service"]{_id}
}`, { version: VERSION });

const detailDocuments = (await mapLimit(index.detailDocs || [], 10, async (entry, i) => {
  if (i % 100 === 0) console.log(`[completeness] detail chunks ${i}/${index.detailDocs.length}`);
  return client.getDocument(entry._id);
})).filter(Boolean);
const landingDocuments = (await mapLimit(index.landingDocs || [], 6, async (entry) => client.getDocument(entry._id))).filter(Boolean);

const detailProducts = detailDocuments.filter((doc) => doc.kind === "product").flatMap((doc) => Array.isArray(doc.records) ? doc.records : []);
const detailServices = detailDocuments.filter((doc) => doc.kind === "service").flatMap((doc) => Array.isArray(doc.records) ? doc.records : []);
const landings = landingDocuments.flatMap((doc) => Array.isArray(doc.records) ? doc.records : []);

function auditDetails(kind, inventory, records, expected) {
  const inventoryKeys = inventory.map((row) => inventoryKey(kind, row));
  const recordKeys = records.map((row) => lower(row?.key));
  const inventorySet = new Set(inventoryKeys);
  const recordSet = new Set(recordKeys);
  const missing = inventoryKeys.filter((key) => !recordSet.has(key));
  const extra = recordKeys.filter((key) => !inventorySet.has(key));
  const duplicateKeys = [...new Set(recordKeys.filter((key, i) => recordKeys.indexOf(key) !== i))];

  const defects = {
    invalidSource: [],
    placeholder: [],
    emptyContent: [],
    nearEmptyContent: [],
    expectedSpecificationsMissing: [],
    badVerification: [],
    unmanagedImages: [],
    priceOrCommerceLeak: [],
    blankSpecificationRows: [],
  };

  for (const record of records) {
    const key = clean(record?.key || `${kind}:${record?.sku || "unknown"}`);
    const content = recordContent(record || {});
    const sourceAndTitle = `${record?.sourceUrl || ""} ${record?.title || ""}`;
    const allText = `${sourceAndTitle} ${content.text}`;

    if (!clean(record?.sourceUrl) || BAD_PAGE_RE.test(sourceAndTitle)) defects.invalidSource.push(key);
    if (allText.includes(PLACEHOLDER)) defects.placeholder.push(key);
    if (!content.text && content.documents === 0) defects.emptyContent.push(key);
    else if (content.text.length < 50 && content.documents === 0) defects.nearEmptyContent.push({ key, textLength: content.text.length, text: content.text.slice(0, 120) });
    if (record?.verification?.hasSpecifications === true && !content.specificationsText) defects.expectedSpecificationsMissing.push(key);
    if (
      !clean(record?.title)
      || record?.verification?.skuMatches !== true
      || record?.verification?.priceLeak !== false
      || (kind === "service" && record?.verification?.serviceOfferMatched !== true)
    ) defects.badVerification.push(key);
    for (const image of Array.isArray(record?.images) ? record.images : []) {
      if (!managedImage(image)) defects.unmanagedImages.push({ key, image });
    }
    if (PRICE_RE.test(content.text) || COMMERCE_RE.test(content.text)) defects.priceOrCommerceLeak.push(key);
    const blankRows = blankSpecificationRows(record?.specificationsHtml);
    if (blankRows) defects.blankSpecificationRows.push({ key, rows: blankRows });
  }

  const hardDefectCount = missing.length + extra.length + duplicateKeys.length
    + defects.invalidSource.length + defects.placeholder.length + defects.emptyContent.length
    + defects.expectedSpecificationsMissing.length + defects.badVerification.length
    + defects.unmanagedImages.length + defects.priceOrCommerceLeak.length;

  return {
    expected,
    inventory: inventory.length,
    details: records.length,
    uniqueInventoryKeys: inventorySet.size,
    uniqueDetailKeys: recordSet.size,
    missing,
    extra,
    duplicateKeys,
    defects,
    hardDefectCount,
    passed: inventory.length === expected
      && records.length === expected
      && inventorySet.size === expected
      && recordSet.size === expected
      && hardDefectCount === 0,
  };
}

const products = auditDetails("product", index.inventoryProducts || [], detailProducts, EXPECTED_PRODUCTS);
const services = auditDetails("service", index.inventoryServices || [], detailServices, EXPECTED_SERVICES);

const landingDefects = {
  duplicatePaths: [],
  missingPath: [],
  invalidSource: [],
  placeholder: [],
  emptyContent: [],
  nearEmptyContent: [],
  unmanagedImages: [],
  priceOrCommerceLeak: [],
};
const landingPaths = landings.map((row) => clean(row?.pathKey));
landingDefects.duplicatePaths = [...new Set(landingPaths.filter((key, i) => key && landingPaths.indexOf(key) !== i))];
for (const landing of landings) {
  const pathKey = clean(landing?.pathKey);
  if (!pathKey) landingDefects.missingPath.push(landing?._key || "unknown");
  const text = htmlText(landing?.html);
  const childText = clean((Array.isArray(landing?.children) ? landing.children : []).flatMap((child) => [child?.title, child?.description, child?.text]).filter(Boolean).join(" "));
  const combined = clean(`${text} ${childText}`);
  const sourceAndCombined = `${landing?.sourceUrl || ""} ${combined}`;
  if (landing?.sourceUrl && BAD_PAGE_RE.test(landing.sourceUrl)) landingDefects.invalidSource.push(pathKey || "unknown");
  if (sourceAndCombined.includes(PLACEHOLDER)) landingDefects.placeholder.push(pathKey || "unknown");
  if (!combined && !(Array.isArray(landing?.children) && landing.children.length)) landingDefects.emptyContent.push(pathKey || "unknown");
  else if (combined.length < 50 && !(Array.isArray(landing?.children) && landing.children.length)) landingDefects.nearEmptyContent.push({ pathKey, textLength: combined.length });

  const imageUrls = [
    ...(Array.isArray(landing?.images) ? landing.images : []),
    ...(Array.isArray(landing?.children) ? landing.children.map((child) => child?.image).filter(Boolean) : []),
  ];
  const $ = cheerio.load(`<div>${String(landing?.html || "")}</div>`);
  imageUrls.push(...$("img[src]").toArray().map((image) => clean($(image).attr("src"))).filter(Boolean));
  for (const image of imageUrls) if (!managedImage(image)) landingDefects.unmanagedImages.push({ pathKey, image });
  if (PRICE_RE.test(combined) || COMMERCE_RE.test(combined)) landingDefects.priceOrCommerceLeak.push(pathKey || "unknown");
}

const rabbitPath = "cell-and-antibody-services/custom-antibody-engineering/rabbit-monoclonal-antibody-production";
const rabbit = landings.find((row) => clean(row?.pathKey) === rabbitPath);
const rabbitText = htmlText(rabbit?.html);
const rabbitRequired = [
  "Rabbit monoclonal antibodies are key tools",
  "PHASE I Services: Antigen Production",
  "PHASE V Service: Stable Cell Line Development",
  "Comparison of Rabbit Monoclonal Antibody Generation Methods",
  "What process do you use to generate rabbit monoclonal antibody?",
];
const rabbitMissing = rabbitRequired.filter((phrase) => !rabbitText.includes(phrase));

const landingHardDefectCount = landingDefects.duplicatePaths.length + landingDefects.missingPath.length
  + landingDefects.invalidSource.length + landingDefects.placeholder.length + landingDefects.emptyContent.length
  + landingDefects.unmanagedImages.length + landingDefects.priceOrCommerceLeak.length + rabbitMissing.length;

const serviceLandings = {
  expected: EXPECTED_LANDINGS,
  records: landings.length,
  uniquePaths: new Set(landingPaths.filter(Boolean)).size,
  defects: landingDefects,
  rabbit: {
    present: Boolean(rabbit),
    textLength: rabbitText.length,
    missingRequiredSections: rabbitMissing,
  },
  hardDefectCount: landingHardDefectCount,
  passed: landings.length === EXPECTED_LANDINGS
    && new Set(landingPaths.filter(Boolean)).size === EXPECTED_LANDINGS
    && Boolean(rabbit)
    && landingHardDefectCount === 0,
};

function recordFor(kind, sku) {
  const key = `${kind}:${lower(sku)}`;
  return (kind === "product" ? detailProducts : detailServices).find((row) => lower(row?.key) === key);
}
const knownTargets = {};
for (const sku of ["G265", "TM205"]) {
  const row = recordFor("product", sku);
  const content = recordContent(row || {});
  knownTargets[sku] = {
    present: Boolean(row),
    sourceUrl: row?.sourceUrl || "",
    title: row?.title || "",
    contentTextLength: content.text.length,
    specificationsTextLength: content.specificationsText.length,
    images: content.images,
    documents: content.documents,
    invalidSource: Boolean(row && BAD_PAGE_RE.test(`${row.sourceUrl || ""} ${row.title || ""}`)),
    placeholder: Boolean(row && `${content.text} ${row.title || ""}`.includes(PLACEHOLDER)),
  };
}

function deterministicSample(rows, count) {
  if (rows.length <= count) return rows;
  const sorted = [...rows].sort((a, b) => lower(a?.sku || a?.url).localeCompare(lower(b?.sku || b?.url)));
  const picked = [];
  const seen = new Set();
  for (let i = 0; i < count; i += 1) {
    const index = Math.min(sorted.length - 1, Math.floor((i * (sorted.length - 1)) / Math.max(1, count - 1)));
    const row = sorted[index];
    const key = lower(row?.sku || row?.url);
    if (key && !seen.has(key)) { seen.add(key); picked.push(row); }
  }
  return picked;
}

const productSample = deterministicSample(index.inventoryProducts || [], 80);
for (const sku of ["G265", "TM205"]) {
  const row = (index.inventoryProducts || []).find((item) => lower(item?.sku) === lower(sku));
  if (row && !productSample.some((item) => lower(item?.sku || item?.url) === lower(row?.sku || row?.url))) productSample.push(row);
}
const serviceSample = deterministicSample(index.inventoryServices || [], 30);

async function fetchProduction(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}qa=${Date.now()}-${Math.random().toString(36).slice(2)}`, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "cache-control": "no-cache", "user-agent": "ITSBIO-ABM-Completeness-Audit/1.0" },
    });
    const html = await response.text();
    return { ok: response.ok, status: response.status, html };
  } finally {
    clearTimeout(timer);
  }
}

const productionTargets = [
  ...productSample.map((row) => ({ kind: "product", id: clean(row.sku || row.url), expected: clean(row.sku), url: `https://itsbio.vercel.app/products/abm/staged/product/${encodeURIComponent(clean(row.sku || row.url))}` })),
  ...serviceSample.map((row) => ({ kind: "service", id: clean(row.sku || row.url), expected: clean(row.sku), url: `https://itsbio.vercel.app/products/abm/staged/service/${encodeURIComponent(clean(row.sku || row.url))}` })),
  ...landings.map((row) => ({ kind: "landing", id: clean(row.pathKey), expected: "", url: `https://itsbio.vercel.app/products/abm/services/${clean(row.pathKey)}` })),
];
const productionChecks = await mapLimit(productionTargets, 8, async (target, i) => {
  if (i % 40 === 0) console.log(`[completeness] production sample ${i}/${productionTargets.length}`);
  try {
    const response = await fetchProduction(target.url);
    const text = htmlText(response.html);
    const defects = [];
    if (!response.ok) defects.push(`HTTP ${response.status}`);
    if (text.includes(PLACEHOLDER)) defects.push("migration-placeholder");
    if (BAD_PAGE_RE.test(text)) defects.push("page-not-found-content");
    if (target.expected && !lower(text).includes(lower(target.expected))) defects.push("expected-sku-not-rendered");
    if (target.kind === "landing" && text.length < 80) defects.push("landing-rendered-content-too-short");
    return { ...target, status: response.status, textLength: text.length, defects };
  } catch (error) {
    return { ...target, status: 0, textLength: 0, defects: [error?.message || String(error)] };
  }
});
const productionFailures = productionChecks.filter((row) => row.defects.length);

const report = {
  generatedAt: new Date().toISOString(),
  version: VERSION,
  products,
  services,
  serviceLandings,
  knownTargets,
  productionSample: {
    products: productSample.length,
    services: serviceSample.length,
    landings: landings.length,
    total: productionChecks.length,
    failures: productionFailures,
    passed: productionFailures.length === 0,
  },
};
report.passed = products.passed && services.passed && serviceLandings.passed && report.productionSample.passed;

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify({
  passed: report.passed,
  products: {
    inventory: products.inventory,
    details: products.details,
    missing: products.missing.length,
    hardDefects: products.hardDefectCount,
    emptyContent: products.defects.emptyContent.length,
    nearEmptyContent: products.defects.nearEmptyContent.length,
    invalidSource: products.defects.invalidSource.length,
    expectedSpecificationsMissing: products.defects.expectedSpecificationsMissing.length,
  },
  services: {
    inventory: services.inventory,
    details: services.details,
    missing: services.missing.length,
    hardDefects: services.hardDefectCount,
    emptyContent: services.defects.emptyContent.length,
    nearEmptyContent: services.defects.nearEmptyContent.length,
    invalidSource: services.defects.invalidSource.length,
    expectedSpecificationsMissing: services.defects.expectedSpecificationsMissing.length,
  },
  serviceLandings: {
    records: serviceLandings.records,
    hardDefects: serviceLandings.hardDefectCount,
    emptyContent: serviceLandings.defects.emptyContent.length,
    nearEmptyContent: serviceLandings.defects.nearEmptyContent.length,
    rabbitTextLength: serviceLandings.rabbit.textLength,
    rabbitMissingRequiredSections: serviceLandings.rabbit.missingRequiredSections.length,
  },
  knownTargets,
  productionSample: { total: productionChecks.length, failures: productionFailures.length },
}, null, 2));

console.log(fs.readFileSync(path.join(OUT, "summary.json"), "utf8"));
if (!report.passed) {
  console.error("ABM strict content completeness audit found defects. See .cache/abm-content-completeness/report.json");
  process.exitCode = 1;
}
