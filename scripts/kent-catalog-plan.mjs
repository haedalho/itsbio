#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const input = path.join(ROOT, ".cache", "kent-official-catalog-audit", "latest.json");
const outDir = path.join(ROOT, ".cache", "kent-official-catalog-plan");
const outJson = path.join(outDir, "latest.json");
const outMd = path.join(outDir, "latest.md");

if (!fs.existsSync(input)) throw new Error(`Missing audit file: ${input}`);
const audit = JSON.parse(fs.readFileSync(input, "utf8"));

const mixed = audit.matched.filter((row) => row.matchType === "mixed");
const mixedNormal = [];
const mixedDuplicateVariantSku = [];
for (const row of mixed) {
  const variants = row.matches.filter((match) => match.kind === "variant");
  if (variants.length > 1) mixedDuplicateVariantSku.push(row);
  else mixedNormal.push(row);
}

const groups = {
  earTagVariants: [],
  cablesAndTubing: [],
  powerRegionVariants: [],
  physioSuiteModules: [],
  surgiVariants: [],
  vetfloVariants: [],
  instruments: [],
  codaAccessories: [],
  otherReview: [],
};

for (const id of audit.unmatchedOfficialIds) {
  if (/^(?:M|R)LPTAG-|^TAG(?:L|LD|S)\d/i.test(id)) groups.earTagVariants.push(id);
  else if (/^PWR-AWP-/i.test(id)) groups.powerRegionVariants.push(id);
  else if (/^CBL-|TUBING/i.test(id)) groups.cablesAndTubing.push(id);
  else if (/^PS-/i.test(id)) groups.physioSuiteModules.push(id);
  else if (/^SURGI-/i.test(id)) groups.surgiVariants.push(id);
  else if (/^VETFLO-/i.test(id)) groups.vetfloVariants.push(id);
  else if (/^INS/i.test(id)) groups.instruments.push(id);
  else if (/^CODA-/i.test(id)) groups.codaAccessories.push(id);
  else groups.otherReview.push(id);
}

const plan = {
  generatedAt: new Date().toISOString(),
  writeMode: false,
  counts: {
    mixedTotal: mixed.length,
    mixedNormalParentDefaultVariant: mixedNormal.length,
    mixedDuplicateVariantSku: mixedDuplicateVariantSku.length,
    unmatchedTotal: audit.unmatchedOfficialIds.length,
    sanityOnlyProducts: audit.sanityOnlyProducts.length,
    ...Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.length])),
  },
  priorityFixes: mixedDuplicateVariantSku.map((row) => ({
    officialId: row.officialId,
    product: row.matches[0].product,
    variants: row.matches.filter((match) => match.kind === "variant").map((match) => match.variant),
    action: "manual_review_duplicate_variant_sku",
  })),
  mixedNormal,
  unmatchedGroups: groups,
  sanityOnlyProducts: audit.sanityOnlyProducts,
  rules: [
    "Do not write to Sanity from this plan.",
    "Do not create standalone products from unmatched IDs automatically.",
    "Treat ear-tag number/color rows as variants under canonical ear-tag products.",
    "Preserve Sanity-only products until separately reviewed.",
  ],
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outJson, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

const lines = [
  "# Kent catalog plan",
  "",
  `- Mixed total: ${plan.counts.mixedTotal}`,
  `- Normal parent/default-variant overlap: ${plan.counts.mixedNormalParentDefaultVariant}`,
  `- Actual duplicate variant SKU anomalies: ${plan.counts.mixedDuplicateVariantSku}`,
  `- Unmatched official IDs: ${plan.counts.unmatchedTotal}`,
  `- Ear-tag variants: ${plan.counts.earTagVariants}`,
  `- Cables/tubing: ${plan.counts.cablesAndTubing}`,
  `- Power-region variants: ${plan.counts.powerRegionVariants}`,
  `- PhysioSuite modules: ${plan.counts.physioSuiteModules}`,
  `- Surgi variants: ${plan.counts.surgiVariants}`,
  `- VetFlo variants: ${plan.counts.vetfloVariants}`,
  `- Instruments: ${plan.counts.instruments}`,
  `- CODA accessories: ${plan.counts.codaAccessories}`,
  `- Other manual review: ${plan.counts.otherReview}`,
  `- Sanity-only products: ${plan.counts.sanityOnlyProducts}`,
  "",
  "## Priority fixes",
  "",
];
for (const row of plan.priorityFixes) {
  lines.push(`- ${row.product.title} — \`${row.officialId}\``);
  for (const variant of row.variants) lines.push(`  - ${variant.optionSummary} — \`${variant.sku}\``);
}
lines.push("", "No Sanity writes are performed.", "");
fs.writeFileSync(outMd, lines.join("\n"), "utf8");

console.log(`Mixed normal overlap: ${plan.counts.mixedNormalParentDefaultVariant}`);
console.log(`Duplicate variant SKU anomalies: ${plan.counts.mixedDuplicateVariantSku}`);
console.log(`Ear-tag unmatched variants: ${plan.counts.earTagVariants}`);
console.log(`Other manual review: ${plan.counts.otherReview}`);
console.log(`Report: ${path.relative(ROOT, outMd)}`);
console.log("Sanity writes: 0");
