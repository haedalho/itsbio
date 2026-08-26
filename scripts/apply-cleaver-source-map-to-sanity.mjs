#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");

const APPLY = process.argv.includes("--apply");
const MIGRATION_KEY = "cleaver-products-2026-08-24";
const normalizeSku = (value) => String(value || "").normalize("NFKC").trim().toUpperCase();

const sourceMap = JSON.parse(await readFile(path.join(process.cwd(), "data/cleaver-source-map.json"), "utf8"));
const entries = Object.entries(sourceMap || {}).filter(([, value]) => value?.sourceTitle && value?.sourceUrl);
if (entries.length < 900) throw new Error(`Cleaver source map coverage too low: ${entries.length}`);

const token = [process.env.SANITY_WRITE_TOKEN, process.env.SANITY_API_WRITE_TOKEN, process.env.SANITY_API_TOKEN, process.env.SANITY_TOKEN, process.env.SANITY_AUTH_TOKEN]
  .map((value) => String(value || "").trim()).find(Boolean);
if (APPLY && !token) throw new Error("Cleaver source identity publish requires a Sanity write token.");

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

const products = await client.fetch(`*[_type == "product" && migrationKey == $key]{_id,sku}`, { key: MIGRATION_KEY });
const bySku = new Map((products || []).map((product) => [normalizeSku(product.sku), product]));
const matched = entries.filter(([sku]) => bySku.has(normalizeSku(sku)));
console.log(JSON.stringify({ sourceMap: entries.length, sanityProducts: bySku.size, matched: matched.length, stage: APPLY ? "apply" : "dry-run" }));

if (matched.length < 900) throw new Error(`Only ${matched.length} source identities matched reviewed Sanity products.`);
if (!APPLY) process.exit(0);

let published = 0;
let failures = 0;
let cursor = 0;
const workers = Array.from({ length: 8 }, async () => {
  while (cursor < matched.length) {
    const index = cursor++;
    const [sku, identity] = matched[index];
    const product = bySku.get(normalizeSku(sku));
    try {
      await client.patch(product._id).set({
        sourceUrl: identity.sourceUrl,
        cleaverSourceTitle: identity.sourceTitle,
      }).commit({ visibility: "async" });
      published += 1;
      if (published <= 5 || published % 100 === 0 || published === matched.length) {
        console.log(`[Cleaver identity] published ${published}/${matched.length}: ${sku}`);
      }
    } catch (error) {
      failures += 1;
      console.warn(`[Cleaver identity] ${sku}: ${error.message}`);
    }
  }
});
await Promise.all(workers);

console.log(JSON.stringify({ published, failures }));
if (failures > Math.max(10, matched.length * 0.03)) throw new Error(`Cleaver identity publish incomplete: ${failures} failures.`);
