#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "app/products/kent/[[...path]]/page.tsx",
  "app/products/kent/item/[...slug]/page.tsx",
  "components/products/KentProductDetailClient.tsx",
  "components/products/KentProductGalleryClient.tsx",
  "components/products/KentProductTabs.tsx",
  "studio-admin/schemaTypes/category.ts",
  "studio-admin/schemaTypes/product.ts",
  "scripts/catalog-audit.mjs",
  "scripts/kent-category-migrate.mjs",
];

const optionalEnvGroups = [
  ["NEXT_PUBLIC_SANITY_PROJECT_ID", "SANITY_STUDIO_PROJECT_ID", "SANITY_PROJECT_ID"],
  ["NEXT_PUBLIC_SANITY_DATASET", "SANITY_STUDIO_DATASET", "SANITY_DATASET"],
];
const writeTokenGroup = ["SANITY_API_TOKEN", "SANITY_WRITE_TOKEN", "SANITY_TOKEN"];

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    out[key] = value;
  }
  return out;
}

const localEnv = loadEnvFile(path.join(root, ".env.local"));
const env = { ...localEnv, ...process.env };
const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
const missingReadEnv = optionalEnvGroups
  .filter((group) => !group.some((key) => env[key]))
  .map((group) => group.join(" / "));
const hasWriteToken = writeTokenGroup.some((key) => env[key]);

const detailFile = path.join(root, "components/products/KentProductDetailClient.tsx");
const categoryFile = path.join(root, "app/products/kent/[[...path]]/page.tsx");
const detailSource = fs.existsSync(detailFile) ? fs.readFileSync(detailFile, "utf8") : "";
const categorySource = fs.existsSync(categoryFile) ? fs.readFileSync(categoryFile, "utf8") : "";

const warnings = [];
if (/Login to see prices/i.test(detailSource)) {
  warnings.push('Kent 상품 상세에 "Login to see prices" 문구가 남아 있습니다.');
}
if (!/HeroBanner|hero\.png/i.test(categorySource)) {
  warnings.push("Kent 카테고리 라우트에서 Hero 유지 여부를 확인하세요.");
}
if (!fs.existsSync(path.join(root, ".cache"))) {
  warnings.push("감사 및 migration 캐시가 아직 없습니다. 첫 실행은 네트워크 요청이 필요합니다.");
}

console.log("\n=== Kent preflight ===\n");
console.log(`Required files: ${missingFiles.length ? "FAIL" : "OK"}`);
for (const file of missingFiles) console.log(`  - missing: ${file}`);
console.log(`Sanity read env: ${missingReadEnv.length ? "FAIL" : "OK"}`);
for (const group of missingReadEnv) console.log(`  - missing one of: ${group}`);
console.log(`Sanity write token: ${hasWriteToken ? "OK" : "NOT SET (required only for migration writes)"}`);
console.log(`Warnings: ${warnings.length}`);
for (const warning of warnings) console.log(`  - ${warning}`);

console.log("\nRecommended start order:");
console.log("  1. npm run dev");
console.log("  2. Open current Kent and ABM pages in the browser");
console.log("  3. In another terminal: npm run catalog:audit");
console.log("  4. Review .cache/content-audit/latest.md");
console.log("  5. Run npm run kent:category:dry only after reviewing duplicates and missing items");
console.log("");

if (missingFiles.length || missingReadEnv.length) process.exitCode = 1;
