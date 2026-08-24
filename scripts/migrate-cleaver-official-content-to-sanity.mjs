#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@sanity/client");

const APPLY = process.argv.includes("--apply");
const MIGRATION_KEY = "cleaver-products-2026-08-24";
const OFFICIAL_API =
  "https://www.thistlescientific.com/wp-json/wc/store/v1/products";
const OFFICIAL_HOST = "www.thistlescientific.com";
const normalizeSku = (value) =>
  String(value || "")
    .normalize("NFKC")
    .trim()
    .toUpperCase();
const cleanText = (value) =>
  String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8211;|&ndash;/gi, "–")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const hash = (value) =>
  createHash("sha256").update(String(value)).digest("hex").slice(0, 12);

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function productSlug(title, sku) {
  const suffix = slugify(String(sku || "").replace(/\$/g, "-variant"));
  const base = slugify(title)
    .slice(0, Math.max(20, 145 - suffix.length))
    .replace(/-+$/g, "");
  return `${base || "cleaver-product"}-${suffix}`;
}

function htmlListItems(value) {
  const matches = [
    ...String(value || "").matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi),
  ]
    .map((match) => cleanText(match[1]))
    .filter((item) => item.length >= 8 && item.length <= 220);
  return matches.length
    ? matches
    : cleanText(value)
        .split(/\s*[•·]\s*|\s{2,}/)
        .map(cleanText)
        .filter((item) => item.length >= 8 && item.length <= 220);
}

const inventory = JSON.parse(
  await readFile(
    path.join(process.cwd(), "data/cleaver-product-catalog.json"),
    "utf8",
  ),
);
const inventoryBySku = new Map(
  inventory.map((row) => [normalizeSku(row.sku), row]),
);
if (inventory.length !== 1432 || inventoryBySku.size !== 1432)
  throw new Error("Expected exactly 1,432 reviewed Cleaver SKUs.");

const token = [
  process.env.SANITY_WRITE_TOKEN,
  process.env.SANITY_API_WRITE_TOKEN,
  process.env.SANITY_API_TOKEN,
  process.env.SANITY_TOKEN,
  process.env.SANITY_AUTH_TOKEN,
]
  .map((value) => String(value || "").trim())
  .find(Boolean);
if (APPLY && !token)
  throw new Error(
    "Cleaver official-content migration requires the configured Production Sanity write token.",
  );

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01",
  token,
  useCdn: false,
  perspective: "published",
});

async function pooled(items, limit, worker) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const position = next;
        next += 1;
        await worker(items[position], position);
      }
    }),
  );
}

async function fetchOfficial(url) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== OFFICIAL_HOST ||
    !parsed.pathname.startsWith("/wp-json/wc/store/v1/products")
  ) {
    throw new Error(
      `Unapproved Cleaver official API endpoint: ${parsed.hostname}${parsed.pathname}`,
    );
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(parsed, {
      headers: { Accept: "application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(55_000),
    });
    if ([401, 403].includes(response.status))
      throw new Error(
        `Official Cleaver API denied access (HTTP ${response.status}).`,
      );
    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      const delay = Math.min(20_000, 1200 * 2 ** attempt);
      console.warn(
        `[Cleaver official content] waiting ${delay}ms after HTTP ${response.status}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (!response.ok)
      throw new Error(`Official Cleaver API returned HTTP ${response.status}.`);
    return response.json();
  }
  throw new Error("Official Cleaver API remained temporarily unavailable.");
}

function productLink(rawSku) {
  const sku = normalizeSku(rawSku);
  const row = inventoryBySku.get(sku);
  if (!row) return null;
  return {
    _key: hash(`related:${sku}`),
    _type: "cleaverRelatedProduct",
    sku,
    title: cleanText(row.title),
    href: `/products/cleaver/item/${encodeURIComponent(productSlug(row.title, row.sku))}`,
  };
}

function related(rawSkus, limit = 16) {
  return [...new Set(rawSkus.map(normalizeSku))]
    .map(productLink)
    .filter(Boolean)
    .slice(0, limit);
}

const HORIZONTAL_VIDEO = {
  _key: "multisub-cast-run",
  _type: "cleaverVideo",
  title:
    "How To Cast And Run An Agarose Gel in the multiSUB Mini Electrophoresis System",
  url: "https://www.youtube.com/watch?v=zXgM10ghY_w",
  embedUrl: "https://www.youtube-nocookie.com/embed/zXgM10ghY_w",
};
const VERTICAL_VIDEO = {
  _key: "omnipage-mini-cast-run",
  _type: "cleaverVideo",
  title: "Cast And Run A Polyacrylamide Gel – omniPAGE Mini Vertical",
  url: "https://www.youtube.com/watch?v=x4X6WdOFHjk",
  embedUrl: "https://www.youtube-nocookie.com/embed/x4X6WdOFHjk",
};
const WAVE_VIDEO = {
  _key: "wave-maxi-cast-run",
  _type: "cleaverVideo",
  title: "How To Cast and Run a Polyacrylamide Gel in the WAVE Maxi Vertical",
  url: "https://www.youtube.com/watch?v=529G-tXO5s4",
  embedUrl: "https://www.youtube-nocookie.com/embed/529G-tXO5s4",
};
const MIDI96_VIDEO = {
  _key: "midi96-comparison",
  _type: "cleaverVideo",
  title:
    "Cleaver Scientific High Throughput Agarose Electrophoresis System Comparison",
  url: "https://www.youtube.com/watch?v=wXXo2dZlW2o",
  embedUrl: "https://www.youtube-nocookie.com/embed/wXXo2dZlW2o",
};

function videosForSku(sku) {
  if (/^MSMIDI96/.test(sku)) return [MIDI96_VIDEO];
  if (/^VS20WAVE(?:D|SYS)/.test(sku)) return [WAVE_VIDEO];
  if (/^(?:CVS10D|CVS10PRE|CVS10TETRAD)/.test(sku)) return [VERTICAL_VIDEO];
  if (
    /^(?:MSMINI(?:7|10|DUO)|MSMIDI(?:7|10|DUO)|MSCHOICE(?:7|10|15|TRIO|ST20|ST25)|MSMAXI(?:10|15|20|25|DUO)|MSSCREEN)/.test(
      sku,
    )
  )
    return [HORIZONTAL_VIDEO];
  return [];
}

function includedItem(sku, quantity = 1, title) {
  const linked = productLink(sku);
  return {
    _key: hash(`included:${sku}:${title || ""}`),
    _type: "cleaverIncludedItem",
    sku: normalizeSku(sku),
    title: title || linked?.title || normalizeSku(sku),
    quantity,
    ...(linked?.href ? { href: linked.href } : {}),
  };
}

function includedForSku(sku) {
  if (/^MSMINI(?:7|10|DUO)$/.test(sku)) {
    const trays =
      sku === "MSMINI7"
        ? ["MS7-UV7"]
        : sku === "MSMINI10"
          ? ["MS7-UV10"]
          : ["MS7-UV7", "MS7-UV10"];
    return [
      ...trays.map((tray) => includedItem(tray)),
      includedItem("MS7LID"),
      includedItem("MS7TANK"),
      includedItem("MS7-8-1", 2),
      includedItem("MS7-WP"),
      includedItem("MS7-LG"),
      includedItem("MS7-UVDAM"),
      includedItem("CSL-CAB"),
    ];
  }
  if (/^MSMIDI(?:7|10|DUO)$/.test(sku)) {
    const trays =
      sku === "MSMIDI7"
        ? ["MS10-UV7"]
        : sku === "MSMIDI10"
          ? ["MS10-UV10"]
          : ["MS10-UV7", "MS10-UV10"];
    return [
      ...trays.map((tray) => includedItem(tray)),
      includedItem("MS10LID"),
      includedItem("MS10TANK"),
      includedItem("MS10-16-1", 2),
      includedItem("MS10-WP"),
      includedItem("MS10-LG"),
      includedItem("MS10-UVDAM"),
      includedItem("CSL-CAB"),
    ];
  }
  if (/^MSMAXI(?:10|15|20|25|DUO)$/.test(sku)) {
    const trayMap = {
      MSMAXI10: ["MS20-UV10"],
      MSMAXI15: ["MS20-UV15"],
      MSMAXI20: ["MS20-UV20"],
      MSMAXI25: ["MS20-UV25"],
      MSMAXIDUO: ["MS20-UV10", "MS20-UV20"],
    };
    return [
      ...(trayMap[sku] || []).map((tray) => includedItem(tray)),
      includedItem("MS20LID"),
      includedItem("MS20TANK"),
      includedItem("MS20-20-1", 2),
      includedItem("MS20-WP"),
      includedItem("MS20-LG", 2),
      includedItem("MS20-UVDAM"),
      includedItem("CSL-CAB"),
    ];
  }
  if (/^MSMIDI96/.test(sku)) {
    return [
      includedItem(sku.includes("1M") ? "MS10-UV96-1M" : "MS10-UV96-2M"),
      includedItem("MS10-UV96"),
      includedItem("MS10LID"),
      includedItem("MS10TANK"),
      includedItem("MS10-WP"),
      includedItem("MS10-LG"),
      includedItem("MS10-UVDAM"),
      includedItem("CSL-CAB"),
    ];
  }
  return [];
}

const MINI_ACCESSORIES = [
  "MS7-UV10",
  "MS7-LG",
  "MS7-WP",
  "MSMINIBSB",
  "MS7-UV7",
  "MSMINICP",
  "MS7-NE",
  "MS7-UVDAM",
  "MS7-PE",
  "MS7-UVS",
  "MS7LID",
  "MS7TANK",
  "CSL-CAB",
  "MS7/10-FC",
];
const MIDI_ACCESSORIES = [
  "MS10-LG",
  "MS10-WP",
  "MSMIDICP",
  "MS10-UVDAM",
  "MS10-UV10",
  "MS10-UV7",
  "MS10-NE",
  "MS10-PE",
  "MS10-UVS",
  "MS10LID",
  "MS10TANK",
  "CSL-CAB",
  "MS7/10-FC",
];
const MAXI_ACCESSORIES = [
  "MS20-UV10",
  "MS20-UV15",
  "MS20-UV20",
  "MS20-UV25",
  "MS20-LG",
  "MS20-WP",
  "MS20-NE",
  "MS20-PE",
  "MS20-UVS",
  "MS20LID",
  "MS20TANK",
  "CSL-CAB",
];
const OMNIPAGE_MINI_ACCESSORIES = [
  "RPW0.2-100",
  "CVS10EXCASTER",
  "CVS10EXCASTERSYS",
  "VS10DCAST",
  "VS10ICB",
  "CVS10DIRM",
  "VS10DCASTM",
  "VS10DP",
  "CVS10KEY",
  "VS10TANK",
  "CSL-CAB",
];

function accessoriesForSku(sku) {
  if (/^MSMINI(?:7|10|DUO)$/.test(sku)) return related(MINI_ACCESSORIES);
  if (/^MSMIDI(?:7|10|DUO)$/.test(sku)) return related(MIDI_ACCESSORIES);
  if (/^MSMAXI(?:10|15|20|25|DUO)$/.test(sku)) return related(MAXI_ACCESSORIES);
  if (/^MSMIDI96/.test(sku))
    return related([
      "MS10-UV96",
      "MS10LID",
      "MS10TANK",
      "MS10-UV96ST",
      "MS10-LG",
      "MS10-WP",
      "MS10-UVDAM",
    ]);
  if (/^(?:CVS10D|CVS10PRE|CVS10TETRAD)/.test(sku))
    return related(OMNIPAGE_MINI_ACCESSORIES);
  return [];
}

const existing = await client.fetch(
  `*[_type == "product" && migrationKey == $key]{_id,sku,overviewHtml,highlights}`,
  { key: MIGRATION_KEY },
);
if (!Array.isArray(existing) || existing.length !== inventory.length)
  throw new Error(
    `Expected ${inventory.length} published Cleaver products, found ${existing?.length || 0}.`,
  );
const apiRows = [];
const batches = Array.from(
  { length: Math.ceil(inventory.length / 35) },
  (_, index) => inventory.slice(index * 35, index * 35 + 35),
);
await pooled(batches, 4, async (batch) => {
  const url = new URL(OFFICIAL_API);
  url.searchParams.set("sku", batch.map((row) => row.sku).join(","));
  url.searchParams.set("per_page", "100");
  const rows = await fetchOfficial(url.toString());
  apiRows.push(...(Array.isArray(rows) ? rows : []));
});

const officialBySku = new Map();
const families = new Map();
for (const row of apiRows) {
  const sku = normalizeSku(row.sku);
  if (!inventoryBySku.has(sku) || officialBySku.has(sku)) continue;
  officialBySku.set(sku, row);
  const parent = Number(row.parent || 0);
  if (parent > 0) {
    if (!families.has(parent)) families.set(parent, []);
    families.get(parent).push(sku);
  }
}

const patches = [];
let withVariants = 0;
let withVideos = 0;
let withIncluded = 0;
let withAccessories = 0;
let withOfficialOverview = 0;

for (const row of existing) {
  const sku = normalizeSku(row.sku);
  const official = officialBySku.get(sku);
  const parent = Number(official?.parent || 0);
  const variants =
    parent > 0
      ? related(
          (families.get(parent) || []).filter((member) => member !== sku),
          24,
        )
      : [];
  const videos = videosForSku(sku);
  const included = includedForSku(sku);
  const accessories = accessoriesForSku(sku);
  const sourceUrl = official?.permalink
    ? String(official.permalink).split("?")[0]
    : "";
  const overviewHtml = String(official?.description || "").trim();
  const highlights = htmlListItems(official?.short_description).slice(0, 6);
  if (variants.length) withVariants += 1;
  if (videos.length) withVideos += 1;
  if (included.length) withIncluded += 1;
  if (accessories.length) withAccessories += 1;
  if (overviewHtml) withOfficialOverview += 1;
  if (!official && !videos.length && !included.length && !accessories.length)
    continue;
  patches.push({
    _id: row._id,
    sku,
    overviewHtml: row.overviewHtml ? "" : overviewHtml,
    highlights:
      Array.isArray(row.highlights) && row.highlights.length ? [] : highlights,
    cleaverContent: {
      _type: "cleaverOfficialContent",
      sourceUrl,
      familyId: parent ? String(parent) : "",
      videos,
      included,
      variants,
      accessories,
    },
  });
}

const summary = {
  stage: APPLY ? "apply" : "dry-run",
  inventory: inventory.length,
  exactOfficialSkuMatches: officialBySku.size,
  officialVariationFamilies: families.size,
  patches: patches.length,
  withOfficialOverview,
  withVariants,
  withVideos,
  withIncluded,
  withAccessories,
  sample: patches.find((row) => row.sku === "MSMINI10"),
};
console.log(JSON.stringify(summary));

if (
  officialBySku.size < 1300 ||
  families.size < 150 ||
  withVariants < 250 ||
  withVideos < 20 ||
  withIncluded < 10 ||
  withAccessories < 10 ||
  !summary.sample?.cleaverContent?.videos?.length
) {
  throw new Error(
    "Cleaver official-content coverage failed the reviewed migration thresholds.",
  );
}
if (!APPLY) process.exit(0);

let published = 0;
let failures = 0;
await pooled(patches, 8, async (row) => {
  try {
    const patch = client
      .patch(row._id)
      .set({
        cleaverContent: row.cleaverContent,
        officialContentMigratedAt: new Date().toISOString(),
      });
    const missing = {};
    if (row.overviewHtml) missing.overviewHtml = row.overviewHtml;
    if (row.highlights.length) missing.highlights = row.highlights;
    if (Object.keys(missing).length) patch.setIfMissing(missing);
    await patch.commit({ visibility: "async" });
    published += 1;
    if (published <= 8 || published % 100 === 0 || published === patches.length)
      console.log(
        `[Cleaver official content] published ${published}/${patches.length}: ${row.sku}`,
      );
  } catch (error) {
    failures += 1;
    console.warn(`[Cleaver official content] ${row.sku}: ${error.message}`);
  }
});

let final;
for (let attempt = 0; attempt < 8; attempt += 1) {
  final = await client.fetch(
    `{"products":count(*[_type == "product" && migrationKey == $key && defined(cleaverContent)]),"variants":count(*[_type == "product" && migrationKey == $key && count(cleaverContent.variants)>0]),"videos":count(*[_type == "product" && migrationKey == $key && count(cleaverContent.videos)>0]),"included":count(*[_type == "product" && migrationKey == $key && count(cleaverContent.included)>0]),"accessories":count(*[_type == "product" && migrationKey == $key && count(cleaverContent.accessories)>0]),"mini":*[_type == "product" && migrationKey == $key && sku == "MSMINI10"][0]{"videos":count(cleaverContent.videos),"included":count(cleaverContent.included),"variants":count(cleaverContent.variants),"accessories":count(cleaverContent.accessories)}}`,
    { key: MIGRATION_KEY },
  );
  if (
    final.products >= 1300 &&
    final.videos >= 20 &&
    final.mini?.videos &&
    final.mini?.included
  )
    break;
  if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, 1200));
}
console.log(JSON.stringify({ published, failures, final }));
if (
  failures > Math.max(15, patches.length * 0.06) ||
  final.products < 1300 ||
  final.videos < 20 ||
  !final.mini?.videos ||
  !final.mini?.included
) {
  throw new Error(
    `Cleaver official-content production verification failed with ${failures} write failures.`,
  );
}
