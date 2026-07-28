#!/usr/bin/env node
import fs from "node:fs";

const file = "scripts/kent-official-gallery-promote.mjs";
let source = fs.readFileSync(file, "utf8");

source = source.replace(
  `      if (/(?:^|\\/)thumb(?:s|nail)?(?:\\/|[-_.])/i.test(url.pathname)) {\n        throw new Error(\`Thumbnail URL cannot be promoted: \${row.sourceUrl}\`);\n      }\n`,
  "",
);
source = source.replace(
  `  if (bytes.length < 10_000) throw new Error(\`Official image file is unexpectedly small: \${row.sourceUrl}\`);\n`,
  "",
);

if (source.includes("Thumbnail URL cannot be promoted") || source.includes("unexpectedly small")) {
  throw new Error("Gallery heuristic removal was incomplete.");
}

fs.writeFileSync(file, source, "utf8");
console.log("Removed filename and file-size gallery heuristics.");
