#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const taxonomy = JSON.parse(await readFile("data/abm-genetic-taxonomy.json", "utf8"));
const payload = JSON.parse(gunzipSync(await readFile("data/abm-genetic-content.json.gz")).toString("utf8"));

function flatten(nodes, parent = ["genetic-materials"]) {
  return nodes.flatMap((node) => {
    const nodePath = [...parent, node.slug];
    return [{ ...node, path: nodePath.join("/") }, ...flatten(node.children || [], nodePath)];
  });
}

const failures = [];
const nodes = flatten(taxonomy);
const expectedPaths = new Set(["genetic-materials", ...nodes.map((node) => node.path)]);
const actualPaths = new Set(Object.keys(payload.records || {}));
const serialized = JSON.stringify(payload);

if (nodes.length !== 31) failures.push(`Expected 31 descendants, found ${nodes.length}`);
if (payload.count !== 32 || actualPaths.size !== 32) failures.push(`Expected 32 content pages, found ${actualPaths.size}`);
for (const expected of expectedPaths) {
  if (!actualPaths.has(expected)) failures.push(`Missing content snapshot: ${expected}`);
}
for (const actual of actualPaths) {
  if (!expectedPaths.has(actual)) failures.push(`Unexpected content snapshot: ${actual}`);
}
if ([...expectedPaths].some((path) => path.includes("RNAi-shRNA-sirna-shrna-rnai-lentivirus"))) {
  failures.push("Legacy RNAi pseudo-category leaked into the canonical taxonomy");
}
if (/(?:\b(?:USD|CAD)\b\s*:?)?\s*\$\s*\d|\b(?:USD|CAD)\s+\d[\d,.]*/i.test(serialized)) {
  failures.push("Currency value leaked into Genetic Materials content");
}
if (/\b(?:add\s+to\s+cart|shopping\s+cart|checkout)\b/i.test(serialized)) {
  failures.push("Commerce UI leaked into Genetic Materials content");
}

const targeted = payload.records?.["genetic-materials/specialized-vectors/targeted-cell-apoptosis-adenoviruses"]?.html || "";
for (const sku of ["G3000", "G3001", "G3002"]) {
  if (!targeted.includes(sku)) failures.push(`Targeted Cell page is missing ${sku}`);
}
if (!/<img\b/i.test(targeted)) failures.push("Targeted Cell page is missing its mechanism image");

const imageCount = Object.values(payload.records || {}).reduce(
  (count, record) => count + ((String(record.html || "").match(/<img\b/gi) || []).length),
  0,
);
const tableCount = Object.values(payload.records || {}).reduce(
  (count, record) => count + ((String(record.html || "").match(/<table\b/gi) || []).length),
  0,
);

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

console.log(`PASS: ${nodes.length} descendants, ${actualPaths.size} pages, ${imageCount} images, ${tableCount} tables, 0 commerce leaks`);
