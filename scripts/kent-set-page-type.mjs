// scripts/kent-set-page-type.mjs
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@sanity/client";

const BRAND_KEY = "kent";
const API_VERSION = "2025-02-19";

const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");

function loadEnvFiles() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, ".env.local"),
    path.join(cwd, ".env"),
  ];

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      dotenv.config({ path: file, override: false });
    }
  }
}

loadEnvFiles();

function getEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

const projectId = getEnv(
  "NEXT_PUBLIC_SANITY_PROJECT_ID",
  "SANITY_STUDIO_PROJECT_ID",
  "SANITY_PROJECT_ID",
);

const dataset = getEnv(
  "NEXT_PUBLIC_SANITY_DATASET",
  "SANITY_STUDIO_DATASET",
  "SANITY_DATASET",
);

const token = getEnv(
  "SANITY_API_TOKEN",
  "SANITY_WRITE_TOKEN",
  "SANITY_TOKEN",
  "SANITY_API_WRITE_TOKEN",
);

if (!projectId || !dataset || !token) {
  console.error("Missing Sanity env.");
  console.error("Checked .env.local / .env and process.env");
  console.error("Required:");
  console.error("- NEXT_PUBLIC_SANITY_PROJECT_ID (or SANITY_STUDIO_PROJECT_ID / SANITY_PROJECT_ID)");
  console.error("- NEXT_PUBLIC_SANITY_DATASET (or SANITY_STUDIO_DATASET / SANITY_DATASET)");
  console.error("- SANITY_API_TOKEN (or SANITY_WRITE_TOKEN / SANITY_TOKEN / SANITY_API_WRITE_TOKEN)");
  console.error("");
  console.error("Resolved values:");
  console.error(`projectId: ${projectId ? "[OK]" : "[MISSING]"}`);
  console.error(`dataset:   ${dataset ? "[OK]" : "[MISSING]"}`);
  console.error(`token:     ${token ? "[OK]" : "[MISSING]"}`);
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: API_VERSION,
  useCdn: false,
  token,
});

const CATEGORY_QUERY = `
*[
  _type == "category"
  && (!defined(isActive) || isActive == true)
  && (
    brandSlug == $brandKey
    || themeKey == $brandKey
    || brand->themeKey == $brandKey
    || brand->slug.current == $brandKey
  )
]
| order(path asc, title asc) {
  _id,
  title,
  path,
  pageType,
  sourceUrl
}
`;

const EXPLICIT_LANDING_PATHS = new Set([
  "anesthesia",
  "laboratory-animal-handling",
  "laboratory-animal-handling/animal-holders",
  "noninvasive-blood-pressure",
  "physiological-monitoring",
  "physiological-monitoring/temperature",
  "rodent-identification",
  "surgery",
  "tissue-collection/brain-matricies",
  "ventilation",
  "ventilation/intubation",
  "warming",
  "warming/warming-pads-and-blankets",
]);

function pathToStr(pathValue) {
  return Array.isArray(pathValue)
    ? pathValue.map((x) => String(x || "").trim()).filter(Boolean).join("/")
    : "";
}

function normalizeStoredPageType(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "landing" || v === "listing") return v;
  return "listing";
}

function classify(pathStr) {
  return EXPLICIT_LANDING_PATHS.has(pathStr) ? "landing" : "listing";
}

async function main() {
  const categories = await client.fetch(CATEGORY_QUERY, { brandKey: BRAND_KEY });
  const safeCategories = Array.isArray(categories) ? categories : [];

  if (!safeCategories.length) {
    console.log("No kent categories found.");
    return;
  }

  const rows = safeCategories.map((category) => {
    const pathStr = pathToStr(category?.path);
    const prevPageType = normalizeStoredPageType(category?.pageType);
    const nextPageType = classify(pathStr);

    return {
      _id: category._id,
      title: String(category?.title || "").trim(),
      pathStr,
      prevPageType,
      nextPageType,
      changed: prevPageType !== nextPageType,
      sourceUrl: String(category?.sourceUrl || "").trim(),
    };
  });

  const changedRows = rows.filter((row) => row.changed);

  console.log("");
  console.log(`Kent categories: ${rows.length}`);
  console.log(`Need changes: ${changedRows.length}`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log("");

  for (const row of rows) {
    const mark = row.changed ? "*" : " ";
    console.log(`${mark} ${row.pathStr || "(root)"} :: ${row.prevPageType} -> ${row.nextPageType}`);

    if (VERBOSE) {
      console.log(`    title="${row.title}"`);
      if (row.sourceUrl) {
        console.log(`    sourceUrl=${row.sourceUrl}`);
      }
    }
  }

  if (!APPLY) {
    console.log("");
    console.log("Dry run only.");
    console.log("Apply with:");
    console.log("node scripts/kent-set-page-type.mjs --apply");
    return;
  }

  let patched = 0;
  let failed = 0;

  for (const row of changedRows) {
    try {
      await client.patch(row._id).set({ pageType: row.nextPageType }).commit();
      patched += 1;
      console.log(`PATCHED ${row.pathStr} -> ${row.nextPageType}`);
    } catch (error) {
      failed += 1;
      console.error(`FAILED ${row.pathStr}`);
      console.error(error?.message || error);
    }
  }

  console.log("");
  console.log(`Done. patched=${patched}, failed=${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});