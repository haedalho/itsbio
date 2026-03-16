// scripts/kent-set-page-type.mjs
/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@sanity/client";

const BRAND_KEY = "kent";
const API_VERSION = "2025-02-19";
const APPLY = process.argv.includes("--apply");

function loadEnvFiles() {
  const cwd = process.cwd();
  for (const file of [path.join(cwd, ".env.local"), path.join(cwd, ".env")]) {
    if (fs.existsSync(file)) dotenv.config({ path: file, override: false });
  }
}

loadEnvFiles();

function getEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && String(value).trim()) return String(value).trim();
  }
  return "";
}

const projectId = getEnv("NEXT_PUBLIC_SANITY_PROJECT_ID", "SANITY_STUDIO_PROJECT_ID", "SANITY_PROJECT_ID");
const dataset = getEnv("NEXT_PUBLIC_SANITY_DATASET", "SANITY_STUDIO_DATASET", "SANITY_DATASET");
const token = getEnv("SANITY_API_TOKEN", "SANITY_WRITE_TOKEN", "SANITY_TOKEN", "SANITY_API_WRITE_TOKEN");

if (!projectId || !dataset || !token) {
  console.error("Missing Sanity env.");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: API_VERSION,
  useCdn: false,
  token,
});

const QUERY = `
*[
  _type == "category"
  && (!defined(isActive) || isActive == true)
  && (
    brandSlug == $brandKey
    || themeKey == $brandKey
    || brand->themeKey == $brandKey
    || brand->slug.current == $brandKey
  )
] | order(path asc, title asc) {
  _id,
  title,
  path,
  pageType,
  contentBlocks,
  summary,
  legacyHtml,
  parent->{ _id }
}
`;

function pathToStr(pathValue) {
  return Array.isArray(pathValue)
    ? pathValue.map((item) => String(item || "").trim()).filter(Boolean).join("/")
    : "";
}

function roughTextLenFromHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

function hasMeaningfulBlocks(blocks) {
  const list = Array.isArray(blocks) ? blocks : [];
  return list.some((block) => {
    if (block?._type === "contentBlockCards") return Array.isArray(block.items) && block.items.length > 0;
    if (block?._type === "contentBlockHtml") return roughTextLenFromHtml(block.html || "") >= 40;
    return false;
  });
}

function mainPageType(category, allCategories) {
  const pathStr = pathToStr(category.path);
  if (pathStr === "anesthesia") return "landing";

  const hasDirectChildren = allCategories.some((item) => {
    const itemStr = pathToStr(item.path);
    return itemStr && itemStr.startsWith(`${pathStr}/`) && item.path.length === category.path.length + 1;
  });

  if (hasDirectChildren) return "landing";
  if (hasMeaningfulBlocks(category.contentBlocks) && roughTextLenFromHtml(category.legacyHtml || "") >= 120) return "landing";
  return "listing";
}

async function main() {
  const categories = await client.fetch(QUERY, { brandKey: BRAND_KEY });
  const safe = Array.isArray(categories) ? categories : [];

  if (!safe.length) {
    console.log("No kent categories found.");
    return;
  }

  const rows = safe.map((category) => {
    const prev = String(category?.pageType || "listing").trim().toLowerCase() === "landing" ? "landing" : "listing";
    const next = mainPageType(category, safe);
    return {
      _id: category._id,
      title: String(category?.title || "").trim(),
      pathStr: pathToStr(category?.path),
      prev,
      next,
      changed: prev !== next,
    };
  });

  console.log(`Kent categories: ${rows.length}`);
  console.log(`Need changes: ${rows.filter((row) => row.changed).length}`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log("");

  for (const row of rows) {
    const mark = row.changed ? "*" : " ";
    console.log(`${mark} ${row.pathStr || "(root)"} :: ${row.prev} -> ${row.next}`);
  }

  if (!APPLY) return;

  for (const row of rows.filter((row) => row.changed)) {
    await client.patch(row._id).set({ pageType: row.next }).commit();
    console.log(`PATCHED ${row.pathStr} -> ${row.next}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
