#!/usr/bin/env node
import { createClient } from "next-sanity";
import * as cheerio from "cheerio";

const VERSION = "2026-08-09-search-v5";
const KEYS = [
  "product:y058813", "product:q5102", "product:q5126", "product:tm166", "product:tm068", "product:g990",
  "product:lv003", "product:lv053-g2500", "product:lv003-g2500",
  "product:aav1002", "product:aav1003", "product:aav1004", "product:aav1001", "product:aav1006", "product:aav1005", "product:lv053",
];
const clean = (v) => String(v || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const client = createClient({
  projectId: String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim(),
  dataset: String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim(),
  apiVersion: String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim(),
  useCdn: false,
});
const docs = await client.fetch(`*[_type == "abmRebuildDetailChunk" && version == $version && count(records[key in $keys]) > 0]{"matches":records[key in $keys]}`, { version: VERSION, keys: KEYS });
const rows = [];
for (const record of docs.flatMap((d) => d.matches || [])) {
  const $ = cheerio.load(`<div id="root">${String(record.specificationsHtml || "")}</div>`);
  const tableRows = [];
  $("#root tr").each((i, tr) => {
    const cells = $(tr).children("th,td").toArray().map((cell) => ({ tag: cell.tagName, text: clean($(cell).text()), html: clean($(cell).html()) }));
    tableRows.push({ index: i, cells });
  });
  rows.push({ key: record.key, sku: record.sku, title: record.title, sourceUrl: record.sourceUrl, verification: record.verification, specificationsHtml: record.specificationsHtml, tableRows });
}
rows.sort((a,b) => a.key.localeCompare(b.key));
console.log(JSON.stringify(rows, null, 2));
if (rows.length !== KEYS.length) { console.error(`Expected ${KEYS.length}, got ${rows.length}`); process.exitCode = 1; }
