#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { createClient } from "next-sanity";

const VERSION = "2026-08-09-search-v5";
const EXPECTED_PRODUCTS = 5144;
const EXPECTED_SERVICES = 251;
const EXPECTED_LANDINGS = 40;
const OUT = path.resolve(".cache/abm-content-completeness-v2");
fs.mkdirSync(OUT, { recursive: true });

const client = createClient({
  projectId: String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim(),
  dataset: String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim(),
  apiVersion: String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim(),
  useCdn: false,
});

const clean = (v) => String(v || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const lower = (v) => clean(v).toLowerCase();
const htmlText = (v) => v ? clean(cheerio.load(`<div id="x">${String(v)}</div>`)("#x").text()) : "";
const PRICE_RE = /(?:\b(?:USD|CAD)\b\s*:?)?\s*\$\s*\d|\b(?:USD|CAD)\s+\d[\d,.]*/i;
const COMMERCE_RE = /\b(?:add\s+to\s+cart|shopping\s+cart|checkout)\b/i;
const PLACEHOLDER = "This item is in the authoritative ABM inventory";

function isBadPage(record) {
  const source = clean(record?.sourceUrl);
  const title = clean(record?.title);
  let sourceBad = !source;
  try {
    const url = new URL(source);
    sourceBad ||= /(?:^|\/)pagenotfound(?:[/?#.]|$)/i.test(url.pathname) || /(?:^|\/)404(?:[/?#.]|$)/i.test(url.pathname);
  } catch {
    sourceBad = true;
  }
  const titleBad = /page\s+not\s+found|page\s+you\s+are\s+looking\s+for\s+can(?:not|'t)\s+be\s+found/i.test(title);
  return sourceBad || titleBad;
}

function managedImage(v) {
  try {
    const u = new URL(String(v || ""));
    return u.hostname === "cdn.sanity.io" && u.pathname.startsWith("/images/9b5twpc8/");
  } catch { return false; }
}

function recordContent(r) {
  const htmlFields = ["introHtml","specificationsHtml","datasheetHtml","documentsHtml","faqsHtml","referencesHtml","reviewsHtml","serviceDetailsHtml"];
  const text = clean([
    r.description, r.storage, r.materialCitation,
    ...htmlFields.map((f) => htmlText(r[f])),
    r.serviceOffer?.sku, r.serviceOffer?.title, r.serviceOffer?.unit,
    ...(Array.isArray(r.serviceOffer?.fields) ? r.serviceOffer.fields.flatMap((f) => [f?.label, f?.value]) : []),
  ].filter(Boolean).join(" "));
  return { text, docs: Array.isArray(r.documents) ? r.documents.length : 0, specs: htmlText(r.specificationsHtml) };
}

function blankSpecRows(r) {
  if (!r.specificationsHtml) return [];
  const $ = cheerio.load(`<div id="root">${String(r.specificationsHtml)}</div>`);
  const rows = [];
  $("#root tr").each((_, tr) => {
    const cells = $(tr).children("td").toArray();
    if (cells.length < 2) return;
    const label = clean($(cells[0]).text());
    if (!label) return;
    const values = cells.slice(1);
    const hasValue = values.some((cell) => clean($(cell).text()) || $(cell).find("img,svg,a,button,input,select,video,audio").length);
    if (!hasValue) rows.push(label);
  });
  return rows;
}

async function mapLimit(items, limit, fn) {
  const output = new Array(items.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, async () => {
    while (true) { const i = cursor++; if (i >= items.length) return; output[i] = await fn(items[i], i); }
  }));
  return output;
}

const index = await client.fetch(`{
  "inventoryProducts": *[_type == "abmRebuildChunk" && version == $version && kind == "product"].records[]{sku,url},
  "inventoryServices": *[_type == "abmRebuildChunk" && version == $version && kind == "service"].records[]{sku,url},
  "detailDocs": *[_type == "abmRebuildDetailChunk" && version == $version]{_id,kind},
  "landingDocs": *[_type == "abmRebuildLandingChunk" && version == $version && kind == "service"]{_id}
}`, { version: VERSION });

const detailDocs = (await mapLimit(index.detailDocs || [], 12, async (x, i) => {
  if (i % 100 === 0) console.log(`[audit-v2] detail chunks ${i}/${index.detailDocs.length}`);
  return client.getDocument(x._id);
})).filter(Boolean);
const landingDocs = (await mapLimit(index.landingDocs || [], 8, (x) => client.getDocument(x._id))).filter(Boolean);
const products = detailDocs.filter((d) => d.kind === "product").flatMap((d) => d.records || []);
const services = detailDocs.filter((d) => d.kind === "service").flatMap((d) => d.records || []);
const landings = landingDocs.flatMap((d) => d.records || []);

function audit(kind, inventory, records, expected) {
  const inventoryKeys = inventory.map((r) => `${kind}:${lower(r.sku || r.url)}`);
  const detailKeys = records.map((r) => lower(r.key));
  const iSet = new Set(inventoryKeys), dSet = new Set(detailKeys);
  const defects = {
    missing: inventoryKeys.filter((k) => !dSet.has(k)),
    extra: detailKeys.filter((k) => !iSet.has(k)),
    duplicate: [...new Set(detailKeys.filter((k, i) => detailKeys.indexOf(k) !== i))],
    invalidSource: [], placeholder: [], empty: [], nearEmpty: [], expectedSpecsMissing: [], badVerification: [], unmanagedImages: [], priceOrCommerce: [], blankSpecRows: [],
  };
  for (const r of records) {
    const k = clean(r.key || `${kind}:unknown`); const c = recordContent(r);
    if (isBadPage(r)) defects.invalidSource.push(k);
    if (`${r.title || ""} ${c.text}`.includes(PLACEHOLDER)) defects.placeholder.push(k);
    if (!c.text && c.docs === 0) defects.empty.push(k);
    else if (c.text.length < 50 && c.docs === 0) defects.nearEmpty.push({ key: k, textLength: c.text.length, text: c.text });
    if (r.verification?.hasSpecifications === true && !c.specs) defects.expectedSpecsMissing.push(k);
    if (!clean(r.title) || r.verification?.skuMatches !== true || r.verification?.priceLeak !== false || (kind === "service" && r.verification?.serviceOfferMatched !== true)) defects.badVerification.push(k);
    for (const image of Array.isArray(r.images) ? r.images : []) if (!managedImage(image)) defects.unmanagedImages.push({ key: k, image });
    if (PRICE_RE.test(c.text) || COMMERCE_RE.test(c.text)) defects.priceOrCommerce.push(k);
    const blank = blankSpecRows(r); if (blank.length) defects.blankSpecRows.push({ key: k, labels: blank });
  }
  const hard = defects.missing.length + defects.extra.length + defects.duplicate.length + defects.invalidSource.length + defects.placeholder.length + defects.empty.length + defects.nearEmpty.length + defects.expectedSpecsMissing.length + defects.badVerification.length + defects.unmanagedImages.length + defects.priceOrCommerce.length;
  return { expected, inventory: inventory.length, details: records.length, uniqueInventory: iSet.size, uniqueDetails: dSet.size, hardDefects: hard, defects, passed: inventory.length === expected && records.length === expected && iSet.size === expected && dSet.size === expected && hard === 0 };
}

const productAudit = audit("product", index.inventoryProducts || [], products, EXPECTED_PRODUCTS);
const serviceAudit = audit("service", index.inventoryServices || [], services, EXPECTED_SERVICES);

const landingPaths = landings.map((r) => clean(r.pathKey)).filter(Boolean);
const landingDefects = { missingPath: [], duplicatePath: [], empty: [], nearEmpty: [], placeholder: [], unmanagedImages: [], priceOrCommerce: [] };
landingDefects.duplicatePath = [...new Set(landingPaths.filter((k, i) => landingPaths.indexOf(k) !== i))];
for (const r of landings) {
  const p = clean(r.pathKey); if (!p) landingDefects.missingPath.push(r._key || "unknown");
  const $ = cheerio.load(`<div id="root">${String(r.html || "")}</div>`); const text = clean($("#root").text());
  const childText = clean((r.children || []).flatMap((c) => [c?.title,c?.description,c?.text]).filter(Boolean).join(" "));
  const combined = clean(`${text} ${childText}`);
  if (!combined && !(r.children || []).length) landingDefects.empty.push(p || "unknown");
  else if (combined.length < 50 && !(r.children || []).length) landingDefects.nearEmpty.push({ pathKey: p, textLength: combined.length });
  if (combined.includes(PLACEHOLDER)) landingDefects.placeholder.push(p || "unknown");
  const images = [...(r.images || []), ...(r.children || []).map((c) => c?.image).filter(Boolean), ...$("img[src]").toArray().map((img) => clean($(img).attr("src"))).filter(Boolean)];
  for (const image of images) if (!managedImage(image)) landingDefects.unmanagedImages.push({ pathKey: p, image });
  if (PRICE_RE.test(combined) || COMMERCE_RE.test(combined)) landingDefects.priceOrCommerce.push(p || "unknown");
}
const landingHard = Object.values(landingDefects).reduce((sum, rows) => sum + rows.length, 0);
const landingAudit = { expected: EXPECTED_LANDINGS, records: landings.length, uniquePaths: new Set(landingPaths).size, hardDefects: landingHard, defects: landingDefects, passed: landings.length === EXPECTED_LANDINGS && new Set(landingPaths).size === EXPECTED_LANDINGS && landingHard === 0 };

const lookup = (kind, sku) => (kind === "product" ? products : services).find((r) => lower(r.key) === `${kind}:${lower(sku)}`);
const known = {};
for (const [kind, sku] of [["product","G265"],["product","TM205"],["product","Y021101"],["service","C144"],["service","C151"],["service","C155"],["service","C192"],["service","C193"],["service","C314"],["service","HC004"],["service","LV001-b"],["service","MultiplexMinCharge"]]) {
  const r = lookup(kind, sku); const c = recordContent(r || {});
  known[`${kind}:${sku}`] = { present: Boolean(r), title: r?.title || "", sourceUrl: r?.sourceUrl || "", textLength: c.text.length, badPage: r ? isBadPage(r) : true, skuMatches: r?.verification?.skuMatches, serviceOfferMatched: r?.verification?.serviceOfferMatched };
}

const report = { generatedAt: new Date().toISOString(), version: VERSION, products: productAudit, services: serviceAudit, serviceLandings: landingAudit, known };
report.passed = productAudit.passed && serviceAudit.passed && landingAudit.passed;
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  passed: report.passed,
  products: { inventory: productAudit.inventory, details: productAudit.details, hardDefects: productAudit.hardDefects, blankSpecWarnings: productAudit.defects.blankSpecRows.length },
  services: { inventory: serviceAudit.inventory, details: serviceAudit.details, hardDefects: serviceAudit.hardDefects, blankSpecWarnings: serviceAudit.defects.blankSpecRows.length },
  landings: { records: landingAudit.records, hardDefects: landingAudit.hardDefects },
  known,
}, null, 2));
if (!report.passed) process.exitCode = 1;
