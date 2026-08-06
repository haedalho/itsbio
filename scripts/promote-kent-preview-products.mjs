import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";
const token = [
  process.env.SANITY_WRITE_TOKEN,
  process.env.SANITY_API_WRITE_TOKEN,
  process.env.SANITY_API_TOKEN,
  process.env.SANITY_TOKEN,
  process.env.SANITY_AUTH_TOKEN,
].find((value) => String(value || "").trim());

if (!token) {
  throw new Error(
    "No Sanity write token was provided. Expected SANITY_WRITE_TOKEN, SANITY_API_WRITE_TOKEN, SANITY_API_TOKEN, SANITY_TOKEN, or SANITY_AUTH_TOKEN.",
  );
}

const client = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: false,
  perspective: "published",
});

const SYSTEM_FIELDS = new Set(["_rev", "_createdAt", "_updatedAt"]);

function slugOf(document) {
  return String(document?.slug?.current || "").trim().toLowerCase();
}

function safeIdPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function withoutSystemFields(document) {
  return Object.fromEntries(
    Object.entries(document || {}).filter(([key]) => !SYSTEM_FIELDS.has(key)),
  );
}

function remapReferences(value, idMap) {
  if (Array.isArray(value)) {
    return value.map((item) => remapReferences(item, idMap));
  }
  if (!value || typeof value !== "object") return value;

  const output = {};
  for (const [key, nested] of Object.entries(value)) {
    if (key === "_ref" && typeof nested === "string" && idMap.has(nested)) {
      output[key] = idMap.get(nested);
    } else {
      output[key] = remapReferences(nested, idMap);
    }
  }
  return output;
}

function contentSummary(document) {
  return {
    slug: slugOf(document),
    title: document?.title || "",
    sourceIntroHtml: String(document?.sourceIntroHtml || "").length,
    overviewHtml: String(document?.overviewHtml || "").length,
    specsHtml: String(document?.specsHtml || "").length,
    extraHtml: String(document?.extraHtml || "").length,
    legacyHtml: String(document?.legacyHtml || "").length,
    datasheetHtml: String(document?.datasheetHtml || "").length,
    documentsHtml: String(document?.documentsHtml || "").length,
    faqsHtml: String(document?.faqsHtml || "").length,
    referencesHtml: String(document?.referencesHtml || "").length,
    reviewsHtml: String(document?.reviewsHtml || "").length,
    kentSections: Array.isArray(document?.kentSections) ? document.kentSections.length : 0,
    images: Array.isArray(document?.images) ? document.images.length : 0,
    variants: Array.isArray(document?.variants) ? document.variants.length : 0,
  };
}

async function runConcurrent(items, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

const previewDocuments = await client.fetch(
  `*[_type == "kentPreviewProduct" && defined(slug.current)] | order(_updatedAt desc)`,
);
const productionDocuments = await client.fetch(
  `*[_type == "product" && defined(slug.current) && (
    brandSlug == "kent" || brand->slug.current == "kent" || brand->themeKey == "kent"
  )] | order(_updatedAt desc)`,
);

if (!Array.isArray(previewDocuments) || previewDocuments.length === 0) {
  throw new Error("No published kentPreviewProduct documents were found; refusing to modify production.");
}

const previewBySlug = new Map();
for (const document of previewDocuments) {
  const slug = slugOf(document);
  if (!slug || previewBySlug.has(slug)) continue;
  previewBySlug.set(slug, document);
}

const productionBySlug = new Map();
for (const document of productionDocuments) {
  const slug = slugOf(document);
  if (!slug) continue;
  const list = productionBySlug.get(slug) || [];
  list.push(document);
  productionBySlug.set(slug, list);
}

const idMap = new Map();
for (const [slug, preview] of previewBySlug.entries()) {
  const existing = productionBySlug.get(slug) || [];
  const primaryId = existing[0]?._id || `kent-product-${safeIdPart(slug)}`;
  idMap.set(preview._id, primaryId);
}

const writes = [];
const duplicateSlugs = [];
for (const [slug, preview] of previewBySlug.entries()) {
  const existing = productionBySlug.get(slug) || [];
  const targetIds = existing.length
    ? existing.map((document) => document._id)
    : [idMap.get(preview._id)];

  if (targetIds.length > 1) duplicateSlugs.push({ slug, ids: targetIds });

  for (const targetId of targetIds) {
    const promoted = remapReferences(withoutSystemFields(preview), idMap);
    promoted._id = targetId;
    promoted._type = "product";
    promoted.brandSlug = promoted.brandSlug || "kent";
    promoted.isActive = promoted.isActive !== false;
    promoted.promotedFromPreviewId = preview._id;
    promoted.promotedFromPreviewAt = new Date().toISOString();
    writes.push({ slug, targetId, document: promoted });
  }
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.resolve(".cache", "kent-sanity-promotion");
await fs.mkdir(backupDir, { recursive: true });
const backupPath = path.join(backupDir, `kent-sanity-before-${timestamp}.json`);
await fs.writeFile(
  backupPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      projectId,
      dataset,
      previewCount: previewDocuments.length,
      previewUniqueSlugCount: previewBySlug.size,
      productionCount: productionDocuments.length,
      duplicateSlugs,
      previewDocuments,
      productionDocuments,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`Backup written: ${backupPath}`);
console.log(`Preview documents: ${previewDocuments.length} (${previewBySlug.size} unique slugs)`);
console.log(`Existing production Kent documents: ${productionDocuments.length}`);
console.log(`Documents to create/replace: ${writes.length}`);
console.log(`Duplicate production slugs synchronized: ${duplicateSlugs.length}`);

await runConcurrent(writes, 4, async ({ slug, targetId, document }, index) => {
  await client.createOrReplace(document, { visibility: "sync" });
  if ((index + 1) % 20 === 0 || index + 1 === writes.length) {
    console.log(`Promoted ${index + 1}/${writes.length}: ${slug} -> ${targetId}`);
  }
});

const verification = await client.fetch(
  `{
    "previewCount": count(*[_type == "kentPreviewProduct" && defined(slug.current)]),
    "productionCount": count(*[_type == "product" && defined(slug.current) && (
      brandSlug == "kent" || brand->slug.current == "kent" || brand->themeKey == "kent"
    )]),
    "somnofloPreview": *[_type == "kentPreviewProduct" && slug.current == "somnoflo-o2care"][0],
    "somnofloProduction": *[_type == "product" && slug.current == "somnoflo-o2care" && (
      brandSlug == "kent" || brand->slug.current == "kent" || brand->themeKey == "kent"
    )][0]
  }`,
);

if (!verification?.somnofloProduction) {
  throw new Error("Promotion verification failed: production somnoflo-o2care was not found.");
}

const previewSummary = contentSummary(verification.somnofloPreview);
const productionSummary = contentSummary(verification.somnofloProduction);
const fieldsToCompare = [
  "sourceIntroHtml",
  "overviewHtml",
  "specsHtml",
  "extraHtml",
  "legacyHtml",
  "datasheetHtml",
  "documentsHtml",
  "faqsHtml",
  "referencesHtml",
  "reviewsHtml",
  "kentSections",
  "images",
  "variants",
];
const mismatches = fieldsToCompare.filter(
  (field) => previewSummary[field] !== productionSummary[field],
);

console.log("SomnoFlo preview summary:", JSON.stringify(previewSummary, null, 2));
console.log("SomnoFlo production summary:", JSON.stringify(productionSummary, null, 2));

if (mismatches.length) {
  throw new Error(`Promotion verification failed for somnoflo-o2care fields: ${mismatches.join(", ")}`);
}

const reportPath = path.join(backupDir, `kent-sanity-promotion-report-${timestamp}.json`);
await fs.writeFile(
  reportPath,
  JSON.stringify(
    {
      completedAt: new Date().toISOString(),
      previewCount: verification.previewCount,
      productionCount: verification.productionCount,
      promotedUniqueSlugs: previewBySlug.size,
      writeCount: writes.length,
      duplicateSlugs,
      somnofloPreview: previewSummary,
      somnofloProduction: productionSummary,
      verified: true,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`Promotion verified. Report written: ${reportPath}`);
