#!/usr/bin/env node
import { createClient } from "next-sanity";

const VERSION = "2026-08-09-search-v5";
const keys = ["product:g050", "product:g129"];
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  useCdn: false,
});

const docs = await client.fetch(`*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
  && count(records[key in $keys]) > 0
]{
  _id,
  records[key in $keys]{
    key, sku, title, sourceUrl, description, introHtml, specificationsHtml,
    storage, materialCitation, images, collectedAt, verification
  }
}`, { version: VERSION, keys });

const rows = (docs || []).flatMap((doc) => doc.records || []);
for (const row of rows) {
  console.log(`\n===== ${row.key} =====`);
  console.log(JSON.stringify({
    key: row.key,
    sku: row.sku,
    title: row.title,
    sourceUrl: row.sourceUrl,
    description: row.description,
    storage: row.storage,
    materialCitation: row.materialCitation,
    specificationsHtml: row.specificationsHtml,
    verification: row.verification,
  }, null, 2));
}
console.log(`\nFOUND=${rows.length}`);
if (rows.length !== 2) process.exitCode = 2;
