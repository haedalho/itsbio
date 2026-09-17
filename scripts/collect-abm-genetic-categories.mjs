#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import * as cheerio from "cheerio";

import { sanitizeAbmStoredHtml } from "../lib/abm/rebuild-parser.mjs";

const taxonomyPath = path.resolve("data/abm-genetic-taxonomy.json");
const outputPath = path.resolve("data/abm-genetic-content.json.gz");
const cacheDirectory = "/tmp/genetic-official";
const userAgent = "ITSBIO-ABM-Genetic-Category-Migration/1.0";

const taxonomy = JSON.parse(await readFile(taxonomyPath, "utf8"));
const records = [];

function flatten(nodes, parentPath = ["genetic-materials"]) {
  return nodes.flatMap((node) => {
    const nodePath = [...parentPath, node.slug];
    return [{ ...node, path: nodePath }, ...flatten(node.children || [], nodePath)];
  });
}

const pages = [
  {
    path: ["genetic-materials"],
    title: "Genetic Materials",
    sourceUrl: "https://www.abmgood.com/genetic-materials.html",
  },
  ...flatten(taxonomy),
];

function cacheFilename(pathSegments) {
  return `${pathSegments.join("__")}.html`;
}

async function officialHtml(page) {
  const cachePath = path.join(cacheDirectory, cacheFilename(page.path));
  try {
    const cached = await readFile(cachePath, "utf8");
    if (cached.includes("abm-category-right-outer") && cached.length > 10_000) return cached;
  } catch {
    // Missing cache entries are fetched from the official source below.
  }

  const response = await fetch(page.sourceUrl, {
    cache: "no-store",
    headers: { accept: "text/html", "user-agent": userAgent },
  });
  if (!response.ok) throw new Error(`${page.path.join("/")}: official HTTP ${response.status}`);
  const html = await response.text();
  if (!html.includes("abm-category-right-outer") || html.length < 10_000) {
    throw new Error(`${page.path.join("/")}: incomplete official page`);
  }
  return html;
}

function extractCategoryHtml(page, html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const root = $("#abm-category-right-outer").first();
  if (!root.length) throw new Error(`${page.path.join("/")}: category content root is missing`);

  root.find("script,noscript,style,form,input,select,textarea,button").remove();
  root.find("h1,h2").filter((_, element) => {
    const label = $(element).text().replace(/\s+/g, " ").trim().toLowerCase();
    return label === page.title.toLowerCase();
  }).first().remove();

  const sanitized = sanitizeAbmStoredHtml(root.html() || "", page.sourceUrl);
  if (sanitized.length < 40) throw new Error(`${page.path.join("/")}: extracted content is empty`);
  return sanitized;
}

for (const [index, page] of pages.entries()) {
  const html = await officialHtml(page);
  const contentHtml = extractCategoryHtml(page, html);
  records.push({
    path: page.path.join("/"),
    title: page.title,
    sourceUrl: page.sourceUrl,
    html: contentHtml,
  });
  console.log(`[${index + 1}/${pages.length}] ${page.path.join("/")} (${contentHtml.length.toLocaleString()} chars)`);
}

const payload = {
  source: "Official ABM category pages",
  generatedAt: new Date().toISOString(),
  count: records.length,
  records: Object.fromEntries(records.map((record) => [record.path, record])),
};

await writeFile(outputPath, gzipSync(JSON.stringify(payload), { level: 9 }));
console.log(`Wrote ${records.length} Genetic Materials pages to ${outputPath}`);
