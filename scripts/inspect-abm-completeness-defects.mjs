#!/usr/bin/env node
import { createClient } from "next-sanity";

const VERSION = "2026-08-09-search-v5";
const KEYS = [
  "product:y021101", "product:tm205",
  "service:c144", "service:c151", "service:c152", "service:c153", "service:c154", "service:c155", "service:c156", "service:c157",
  "service:c192", "service:c193", "service:c314",
  "service:hc004", "service:hc005", "service:hc006", "service:hc009",
  "service:multiplexmincharge", "service:lv001-b", "service:lv001-c", "service:lv001-d", "service:lv001-e",
];

const client = createClient({
  projectId: String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim(),
  dataset: String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim(),
  apiVersion: String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim(),
  useCdn: false,
});

const docs = await client.fetch(`*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && count(records[key in $keys]) > 0
]{
  _id,
  kind,
  "matches": records[key in $keys]
}`, { version: VERSION, keys: KEYS });

const rows = docs.flatMap((doc) => (doc.matches || []).map((record) => ({ chunkId: doc._id, ...record })));
rows.sort((a, b) => String(a.key).localeCompare(String(b.key)));
console.log(JSON.stringify(rows, null, 2));
if (rows.length !== KEYS.length) {
  console.error(`Expected ${KEYS.length} records, found ${rows.length}`);
  process.exitCode = 1;
}
