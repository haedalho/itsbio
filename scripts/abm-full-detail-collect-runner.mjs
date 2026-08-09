#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourcePath = path.resolve("scripts/abm-full-detail-collect.mjs");
const fixedPath = path.resolve("scripts/.abm-full-detail-collect-fixed.mjs");
let source = fs.readFileSync(sourcePath, "utf8");
const bad = String.raw`\s*</i.test(htmls);`;
const good = String.raw`\s*<)/i.test(htmls);`;
if (!source.includes(bad)) throw new Error("Expected collector regex typo was not found");
source = source.replace(bad, good);
fs.writeFileSync(fixedPath, source, "utf8");
try {
  await import(`${pathToFileURL(fixedPath).href}?v=${Date.now()}`);
} finally {
  try { fs.unlinkSync(fixedPath); } catch {}
}
