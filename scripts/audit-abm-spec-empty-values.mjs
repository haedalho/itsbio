#!/usr/bin/env node
import { createClient } from "next-sanity";
import { load } from "cheerio";

const VERSION = "2026-08-09-search-v5";
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  useCdn: false,
});

const collapse = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const commerceLabel = (value) => /^(?:(?:unit\s+)?(?:price|cost|amount)(?:\s*(?:\(|-|:)?\s*(?:usd|cad)\)?)?|qty|quantity|cart|add\s+to\s+cart|order|msrp|retail(?:\s+price)?|wholesale(?:\s+price)?|usd|cad)$/i.test(collapse(value));

function parseSpecRows(html) {
  if (!collapse(html)) return [];
  const $ = load(String(html));
  const root = $(".abm-products-specification > table").first().length
    ? $(".abm-products-specification > table").first()
    : $("table").first();
  if (!root.length) return [];
  const rows = [];
  root.children("thead,tbody,tfoot").children("tr").add(root.children("tr")).each((_, row) => {
    const cells = $(row).children("td,th");
    if (!cells.length) return;
    const label = collapse($(cells[0]).text());
    if (!label) return;
    let valueText = "";
    let hasMeaningfulMedia = false;
    cells.slice(1).each((__, cell) => {
      valueText += ` ${$(cell).text()}`;
      if ($(cell).find("img[src],a[href],video,audio").length) hasMeaningfulMedia = true;
    });
    rows.push({ label, valueText: collapse(valueText), hasMeaningfulMedia, cellCount: cells.length });
  });
  return rows;
}

async function fetchOfficialRows(sourceUrl) {
  if (!/^https:\/\/www\.abmgood\.com\//i.test(String(sourceUrl || ""))) return [];
  try {
    const response = await fetch(sourceUrl, {
      headers: { "user-agent": "Mozilla/5.0 ITS-BIO ABM fidelity audit" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return [];
    const html = await response.text();
    const $ = load(html);
    const root = $(".abm-products-specification > table").first().length
      ? $(".abm-products-specification > table").first()
      : $(".abm-products-specification table").first();
    if (!root.length) return [];
    const rows = [];
    root.children("thead,tbody,tfoot").children("tr").add(root.children("tr")).each((_, row) => {
      const cells = $(row).children("td,th");
      if (!cells.length) return;
      const label = collapse($(cells[0]).text());
      if (!label) return;
      let valueText = "";
      let hasMeaningfulMedia = false;
      cells.slice(1).each((__, cell) => {
        valueText += ` ${$(cell).text()}`;
        if ($(cell).find("img[src],a[href],video,audio").length) hasMeaningfulMedia = true;
      });
      rows.push({ label, valueText: collapse(valueText), hasMeaningfulMedia });
    });
    return rows;
  } catch {
    return [];
  }
}

const chunkIds = await client.fetch(`*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
]._id`, { version: VERSION });

let totalDetailRecords = 0;
let withParsedSpecifications = 0;
const noSpec = [];
const emptyRows = [];
const suspicious = [];

for (const chunkId of chunkIds || []) {
  const records = await client.fetch(`*[_id == $id][0].records[]{
    key, sku, title, sourceUrl, specificationsHtml
  }`, { id: chunkId });

  for (const record of records || []) {
    totalDetailRecords += 1;
    const rows = parseSpecRows(record.specificationsHtml);
    if (!rows.length) {
      noSpec.push({ key: record.key, sku: record.sku, title: record.title, sourceUrl: record.sourceUrl });
      continue;
    }
    withParsedSpecifications += 1;

    const dataRows = rows.filter((row) => !commerceLabel(row.label));
    const blanks = dataRows.filter((row) => row.cellCount >= 2 && !row.valueText && !row.hasMeaningfulMedia);
    if (blanks.length) {
      emptyRows.push({
        key: record.key,
        sku: record.sku,
        title: record.title,
        sourceUrl: record.sourceUrl,
        labels: blanks.map((row) => row.label),
      });
    }

    const nonCommerceWithValue = dataRows.filter((row) => row.valueText || row.hasMeaningfulMedia);
    if (dataRows.length >= 2 && nonCommerceWithValue.length === 0) {
      suspicious.push({ key: record.key, sku: record.sku, title: record.title, sourceUrl: record.sourceUrl, issue: "all specification values blank" });
    }
  }
}

const recoverable = [];
for (const item of emptyRows) {
  const officialRows = await fetchOfficialRows(item.sourceUrl);
  const officialByLabel = new Map(officialRows.map((row) => [row.label.toLowerCase(), row]));
  const labels = item.labels.filter((label) => {
    const row = officialByLabel.get(label.toLowerCase());
    return row && (row.valueText || row.hasMeaningfulMedia);
  });
  if (labels.length) recoverable.push({ ...item, labels });
}

const report = {
  generatedAt: new Date().toISOString(),
  version: VERSION,
  chunkCount: (chunkIds || []).length,
  totalDetailRecords,
  withParsedSpecifications,
  noSpecificationsCount: noSpec.length,
  productsWithBlankValueRows: emptyRows.length,
  productsWithAllValuesBlank: suspicious.length,
  recoverableFromOfficialSource: recoverable.length,
  blankRows: emptyRows,
  recoverable,
  suspicious,
  noSpecificationsSample: noSpec.slice(0, 100),
};

console.log(JSON.stringify(report, null, 2));
