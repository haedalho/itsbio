#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const INVENTORY = path.join(ROOT, ".cache", "kent-shop", "browser-inventory.json");
const SHOP_PAGES = path.join(ROOT, ".cache", "kent-shop", "shop-pages");
const PRODUCT_PAGES = path.join(ROOT, ".cache", "kent-shop", "product-pages");

if (!fs.existsSync(INVENTORY)) {
  console.error("Kent browser cache가 없습니다. 먼저 npm run kent:shop:browser -- --fresh 를 실행하세요.");
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(INVENTORY, "utf8"));
if (!report.complete) {
  console.error("Kent browser inventory가 INCOMPLETE입니다. 403/미확인 페이지를 해결하고 browser 명령을 다시 실행하세요.");
  process.exit(1);
}

const missing = [];
for (let index = 1; index <= Number(report.shopPageCount || 0); index += 1) {
  const file = path.join(SHOP_PAGES, `page-${index}.html`);
  if (!fs.existsSync(file)) missing.push(path.relative(ROOT, file));
}
for (const product of report.products || []) {
  const file = path.join(PRODUCT_PAGES, `${product.slug}.html`);
  if (!fs.existsSync(file)) missing.push(path.relative(ROOT, file));
}
if (missing.length) {
  console.error(`Browser cache 파일 ${missing.length}개가 없습니다.`);
  console.error(missing.slice(0, 20).join("\n"));
  process.exit(1);
}

const forwarded = process.argv.slice(2).filter((value) => value !== "--refreshCache");
const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "kent-shop-sync.mjs"), ...forwarded], {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
