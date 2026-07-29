#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
const auditPath = path.join(dataDir, "kent-catalog-local-defect-audit.json");
const directReviewedThrough = 80;

if (!fs.existsSync(auditPath)) {
  throw new Error(`Missing audit file: ${auditPath}`);
}

const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
const sourceProducts = Array.isArray(audit?.products) ? audit.products : [];

const products = sourceProducts.map((row, index) => ({
  index: Number(row?.index || index + 1),
  sanityId: String(row?.sanityId || ""),
  title: String(row?.title || ""),
  slug: String(row?.slug || ""),
  sku: String(row?.sku || ""),
  officialSourceUrl: String(row?.sourceUrl || ""),
  status: "NEEDS_FIX",
  reviewLevel: Number(row?.index || index + 1) <= directReviewedThrough
    ? "DIRECT_OFFICIAL_DETAIL_REVIEW"
    : "CONFIRMED_LOCAL_CANONICAL_DEFECT",
  reasons: Array.isArray(row?.flags) ? row.flags : [],
}));

const report = {
  generatedAt: new Date().toISOString(),
  policy: {
    verified: "Current official page and effective canonical local content match; no cleanup remains.",
    needsFix: "At least one canonical title, subtitle, Item #, body, option, section, gallery, commerce or support defect is confirmed.",
    unresolved: "Current official page cannot be inspected reliably and no confirmed canonical verdict can be made.",
  },
  totals: {
    productCandidates: products.length,
    verified: products.filter((row) => row.status === "VERIFIED").length,
    needsFix: products.filter((row) => row.status === "NEEDS_FIX").length,
    unresolved: products.filter((row) => row.status === "UNRESOLVED").length,
    directOfficialDetailReviewed: products.filter((row) => row.reviewLevel === "DIRECT_OFFICIAL_DETAIL_REVIEW").length,
    confirmedByCanonicalDefectAudit: products.filter((row) => row.reviewLevel === "CONFIRMED_LOCAL_CANONICAL_DEFECT").length,
  },
  evidence: {
    localAuditGeneratedAt: audit?.summary?.generatedAt || null,
    localFlagCounts: audit?.summary?.flagCounts || {},
    directReviewBatchFiles: Array.from({ length: 8 }, (_, index) => `data/kent-official-review-batch-${String(index + 1).padStart(3, "0")}.md`),
  },
  products,
};

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(" | ") : value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

fs.writeFileSync(path.join(dataDir, "kent-catalog-verdict.json"), JSON.stringify(report, null, 2) + "\n");
const headers = ["index", "status", "reviewLevel", "title", "slug", "sku", "reasons", "officialSourceUrl"];
const csv = [
  headers.join(","),
  ...products.map((row) => headers.map((key) => csvCell(row[key])).join(",")),
].join("\n") + "\n";
fs.writeFileSync(path.join(dataDir, "kent-catalog-verdict.csv"), csv);

const md = [
  "# Kent catalog verdict",
  "",
  `Generated: ${report.generatedAt}`,
  "",
  `- Product candidates: ${report.totals.productCandidates}`,
  `- VERIFIED: ${report.totals.verified}`,
  `- NEEDS_FIX: ${report.totals.needsFix}`,
  `- UNRESOLVED: ${report.totals.unresolved}`,
  `- Direct official detail review completed: ${report.totals.directOfficialDetailReviewed}`,
  `- Verdict confirmed by canonical defect audit: ${report.totals.confirmedByCanonicalDefectAudit}`,
  "",
  "A product cannot be VERIFIED while canonical Sanity data still contains a confirmed defect, even when the visible renderer currently hides that defect.",
  "",
  "## Catalog",
  "",
  "| # | Status | Review level | Product | Slug | Main reasons |",
  "|---:|---|---|---|---|---|",
  ...products.map((row) => `| ${row.index} | ${row.status} | ${row.reviewLevel} | ${row.title.replaceAll("|", "\\|")} | ${row.slug} | ${(row.reasons || []).join(", ").replaceAll("|", "\\|")} |`),
  "",
].join("\n");
fs.writeFileSync(path.join(dataDir, "kent-catalog-verdict.md"), md);

console.log(JSON.stringify(report.totals));
