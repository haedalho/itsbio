#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import stableCatalog from "../data/abm-stable-cell-catalog.json" with { type: "json" };

const OUT = path.resolve(".cache/abm-stable-detail/inventory.json");
const products = Array.isArray(stableCatalog?.products) ? stableCatalog.products : [];
const expected = Number(stableCatalog?.expectedCount || 0);
if (!expected || products.length !== expected) {
  throw new Error(`Stable authoritative catalog is incomplete: expected=${expected}, products=${products.length}`);
}

const normalized = products.map((product) => {
  const sku = String(product?.sku || "").trim();
  const title = String(product?.title || "").trim();
  const url = String(product?.sourceUrl || "").trim();
  if (!sku || !title || !url) throw new Error(`Stable detail inventory row missing sku/title/url: ${JSON.stringify(product)}`);
  return {
    sku,
    title,
    url,
    unit: String(product?.unit || "").trim(),
    searchCategory: "Stable Cell Lines",
    filterId: "25",
    filterTitle: "Stable Cell Lines",
    filterPath: ["Cellular Materials", "Cell Library Collections", "Stable Cell Lines"],
    listingFilters: [{
      id: "25",
      title: "Stable Cell Lines",
      path: ["Cellular Materials", "Cell Library Collections", "Stable Cell Lines"],
    }],
    stableMembership: true,
    primaryCategory: String(product?.primaryCategory || "").trim(),
  };
});

const payload = {
  generatedAt: new Date().toISOString(),
  source: stableCatalog?.searchSource || stableCatalog?.source,
  products: normalized,
  services: [],
  excluded: [],
  productRuns: [{ title: "Stable Cell Lines", expected, got: normalized.length, complete: normalized.length === expected }],
  serviceRuns: [{ title: "Stable Cell Lines services", expected: 0, got: 0, complete: true }],
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
console.log(JSON.stringify({ output: OUT, products: normalized.length, source: payload.source, sample: normalized.slice(0, 3) }, null, 2));
