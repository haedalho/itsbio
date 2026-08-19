#!/usr/bin/env node
import { createClient } from "next-sanity";
import { JSDOM } from "jsdom";

const VERSION = "2026-08-09-search-v5";
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  useCdn: false,
});

const collapse = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const commerceLabel = (value) => /^(?:(?:unit\s+)?(?:price|cost|amount)(?:\s*(?:\(|-|:)?\s*(?:usd|cad)\)?)?|qty|quantity|cart|add\s+to\s+cart|order|msrp|retail(?:\s+price)?|wholesale(?:\s+price)?|usd|cad)$/i.test(collapse(value));

function directCells(row) {
  return Array.from(row.children).filter((cell) => /^(TD|TH)$/i.test(cell.tagName));
}

function parseSpecRows(html) {
  if (!collapse(html)) return [];
  const dom = new JSDOM(String(html));
  const doc = dom.window.document;
  const root = doc.querySelector(".abm-products-specification > table") || doc.querySelector("table");
  if (!root) return [];
  const rows = Array.from(root.querySelectorAll(":scope > tbody > tr, :scope > thead > tr, :scope > tfoot > tr, :scope > tr"));
  return rows.map((row) => {
    const cells = directCells(row);
    const label = collapse(cells[0]?.textContent || "");
    const valueText = collapse(cells.slice(1).map((cell) => cell.textContent || "").join(" "));
    const hasMeaningfulMedia = cells.slice(1).some((cell) => cell.querySelector("img[src], a[href], video, audio"));
    return { label, valueText, hasMeaningfulMedia, cellCount: cells.length };
  }).filter((row) => row.label);
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
    const dom = new JSDOM(html, { url: sourceUrl });
    const doc = dom.window.document;
    const root = doc.querySelector(".abm-products-specification > table") || doc.querySelector(".abm-products-specification table");
    if (!root) return [];
    return Array.from(root.querySelectorAll(":scope > tbody > tr, :scope > thead > tr, :scope > tfoot > tr, :scope > tr")).map((row) => {
      const cells = directCells(row);
      return {
        label: collapse(cells[0]?.textContent || ""),
        valueText: collapse(cells.slice(1).map((cell) => cell.textContent || "").join(" ")),
        hasMeaningfulMedia: cells.slice(1).some((cell) => cell.querySelector("img[src], a[href], video, audio")),
      };
    }).filter((row) => row.label);
  } catch {
    return [];
  }
}

const records = await client.fetch(`*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
].records[]{
  key,
  sku,
  title,
  sourceUrl,
  specificationsHtml
}`, { version: VERSION });

const all = Array.isArray(records) ? records : [];
const noSpec = [];
const emptyRows = [];
const suspicious = [];

for (const record of all) {
  const rows = parseSpecRows(record.specificationsHtml);
  if (!rows.length) {
    noSpec.push({ key: record.key, sku: record.sku, title: record.title, sourceUrl: record.sourceUrl });
    continue;
  }

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
  totalDetailRecords: all.length,
  withParsedSpecifications: all.length - noSpec.length,
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
