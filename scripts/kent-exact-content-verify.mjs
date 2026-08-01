#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { createClient } from "@sanity/client";
import dotenv from "dotenv";

const ROOT = process.cwd();
dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const argValue = (name, fallback = "") => {
  const exact = args.find((arg) => arg.startsWith(`${name}=`));
  return exact ? exact.slice(name.length + 1) : fallback;
};

const SNAPSHOT_DIR = path.resolve(
  ROOT,
  argValue("--snapshots", "data/kent-official-source-snapshots"),
);
const OUTPUT_DIR = path.resolve(
  ROOT,
  argValue("--output", ".cache/kent-exact-content-verification"),
);
const ONLY_SLUG = argValue("--slug").trim().toLowerCase();

const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.SANITY_STUDIO_PROJECT_ID ||
  process.env.SANITY_PROJECT_ID;
const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_STUDIO_DATASET ||
  process.env.SANITY_DATASET;

if (!projectId || !dataset) {
  throw new Error("Missing Sanity project ID or dataset in .env.local/.env.");
}

const sanity = createClient({
  projectId,
  dataset,
  apiVersion: "2025-02-19",
  useCdn: false,
});

const PRODUCT_QUERY = `*[
  _type == "product"
  && slug.current in $slugs
  && (
    brandSlug == "kent"
    || themeKey == "kent"
    || brand->slug.current == "kent"
    || brand->themeKey == "kent"
  )
]{
  _id,
  title,
  "slug": slug.current,
  summary,
  sku,
  sourceUrl,
  productType,
  optionGroups[]{
    _key,
    key,
    name,
    label,
    displayType,
    options[]{ _key, value, label }
  },
  variants[]{
    _key,
    variantId,
    title,
    sku,
    catNo,
    optionSummary,
    optionValues,
    attributes,
    sourceVariationId,
    imageUrl,
    "imageAsset": image.asset->{ _id, sha1hash, originalFilename }
  },
  kentSections[]{
    _key,
    _type,
    type,
    kind,
    title,
    html,
    contentHtml,
    bodyHtml,
    description,
    imageUrl,
    imageAlt,
    items,
    links,
    documents,
    videos,
    rows
  },
  "images": images[]{
    _key,
    alt,
    "asset": asset->{ _id, sha1hash, originalFilename }
  },
  imageUrls,
  galleryImageUrls
}`;

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function canonicalText(value) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith("_"))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableSort(child)]),
  );
}

function canonicalJson(value) {
  return JSON.stringify(stableSort(value));
}

function exactString(value) {
  return decodeEntities(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    return url.toString();
  } catch {
    return raw;
  }
}

function isKentUrl(value) {
  try {
    const host = new URL(String(value || "")).hostname.toLowerCase();
    return host === "kentscientific.com" || host.endsWith(".kentscientific.com");
  } catch {
    return false;
  }
}

function isSanityAssetId(value) {
  return /^image-[a-f0-9]+-\d+x\d+-[a-z0-9]+$/i.test(String(value || ""));
}

function readSnapshots() {
  if (!fs.existsSync(SNAPSHOT_DIR)) return [];
  return fs
    .readdirSync(SNAPSHOT_DIR)
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .sort()
    .flatMap((name) => {
      const filePath = path.join(SNAPSHOT_DIR, name);
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      return rows.map((row) => ({ ...row, __file: path.relative(ROOT, filePath) }));
    });
}

function validateSnapshot(snapshot) {
  const errors = [];
  if (snapshot?.schemaVersion !== 1) errors.push("schema_version_must_be_1");
  if (!snapshot?.slug) errors.push("slug_missing");
  if (!snapshot?.sourceUrl || !isKentUrl(snapshot.sourceUrl)) errors.push("official_source_url_missing_or_not_kent");
  if (!snapshot?.checkedAt) errors.push("checked_at_missing");
  if (!snapshot?.sourcePageSha256 || !/^[a-f0-9]{64}$/i.test(snapshot.sourcePageSha256)) {
    errors.push("source_page_sha256_missing_or_invalid");
  }
  if (!snapshot?.content || typeof snapshot.content !== "object") errors.push("content_missing");
  if (!snapshot?.content?.title) errors.push("title_missing");
  if (!snapshot?.content?.itemNumber) errors.push("item_number_missing");
  if (!Array.isArray(snapshot?.content?.sections)) errors.push("sections_missing");
  if (!Array.isArray(snapshot?.content?.gallery)) errors.push("gallery_missing");
  return errors;
}

function sectionComparable(section) {
  const items = [
    ...(Array.isArray(section?.items) ? section.items : []),
    ...(Array.isArray(section?.links) ? section.links : []),
    ...(Array.isArray(section?.documents) ? section.documents : []),
    ...(Array.isArray(section?.videos) ? section.videos : []),
  ].map((item) => ({
    title: exactString(item?.title || item?.label || item?.text || ""),
    description: canonicalText(item?.description || item?.html || item?.value || ""),
    url: normalizeUrl(item?.url || item?.href || ""),
    imageUrl: String(item?.imageUrl || "").trim(),
  }));

  return {
    title: exactString(section?.title || ""),
    type: exactString(section?.type || section?.kind || section?._type || ""),
    text: canonicalText(
      [
        section?.html,
        section?.contentHtml,
        section?.bodyHtml,
        section?.description,
      ]
        .filter(Boolean)
        .join(" "),
    ),
    items,
    rows: Array.isArray(section?.rows) ? stableSort(section.rows) : [],
    imageUrl: String(section?.imageUrl || "").trim(),
  };
}

function sectionFingerprint(section) {
  return sha256(canonicalJson(sectionComparable(section)));
}

function optionGroupsComparable(groups) {
  return (Array.isArray(groups) ? groups : []).map((group) => ({
    key: exactString(group?.key || group?.name || ""),
    label: exactString(group?.label || group?.name || ""),
    displayType: exactString(group?.displayType || ""),
    options: (Array.isArray(group?.options) ? group.options : []).map((option) => ({
      value: exactString(option?.value || ""),
      label: exactString(option?.label || option?.value || ""),
    })),
  }));
}

function variantsComparable(variants) {
  return (Array.isArray(variants) ? variants : []).map((variant) => ({
    variantId: exactString(variant?.variantId || ""),
    title: exactString(variant?.title || ""),
    sku: exactString(variant?.sku || ""),
    catNo: exactString(variant?.catNo || ""),
    optionSummary: exactString(variant?.optionSummary || ""),
    optionValues: stableSort(variant?.optionValues || {}),
    attributes: stableSort(variant?.attributes || {}),
    sourceVariationId: exactString(variant?.sourceVariationId || ""),
    imageAssetId: exactString(variant?.imageAsset?._id || ""),
    imageSha1: exactString(variant?.imageAsset?.sha1hash || ""),
    legacyImageUrl: exactString(variant?.imageUrl || ""),
  }));
}

function galleryComparable(product) {
  return (Array.isArray(product?.images) ? product.images : []).map((image, index) => ({
    order: index + 1,
    assetId: exactString(image?.asset?._id || ""),
    sha1: exactString(image?.asset?.sha1hash || ""),
    alt: exactString(image?.alt || ""),
  }));
}

function compareExact(label, actual, expected, flags, details) {
  if (canonicalJson(actual) === canonicalJson(expected)) return;
  flags.push(`${label}_mismatch`);
  details[label] = { actual, expected };
}

function compareProduct(product, snapshot) {
  const flags = [];
  const details = {};
  const expected = snapshot.content || {};

  if (!product) {
    return {
      status: "BLOCKED",
      flags: ["sanity_product_missing"],
      details: {},
    };
  }

  if (exactString(product.title) !== exactString(expected.title)) {
    flags.push("title_mismatch");
    details.title = { actual: exactString(product.title), expected: exactString(expected.title) };
  }

  if (exactString(product.summary) !== exactString(expected.subtitle || "")) {
    flags.push("subtitle_mismatch");
    details.subtitle = { actual: exactString(product.summary), expected: exactString(expected.subtitle || "") };
  }

  if (exactString(product.sku) !== exactString(expected.itemNumber)) {
    flags.push("item_number_mismatch");
    details.itemNumber = { actual: exactString(product.sku), expected: exactString(expected.itemNumber) };
  }

  const actualSourceUrl = normalizeUrl(product.sourceUrl);
  const expectedSourceUrl = normalizeUrl(snapshot.sourceUrl);
  if (actualSourceUrl !== expectedSourceUrl) {
    flags.push("source_url_mismatch");
    details.sourceUrl = { actual: actualSourceUrl, expected: expectedSourceUrl };
  }

  compareExact(
    "option_groups",
    optionGroupsComparable(product.optionGroups),
    Array.isArray(expected.optionGroups) ? expected.optionGroups : [],
    flags,
    details,
  );

  compareExact(
    "variants",
    variantsComparable(product.variants),
    Array.isArray(expected.variants) ? expected.variants : [],
    flags,
    details,
  );

  const localSections = (Array.isArray(product.kentSections) ? product.kentSections : []).map((section, index) => ({
    order: index + 1,
    title: exactString(section?.title || ""),
    type: exactString(section?.type || section?.kind || section?._type || ""),
    contentSha256: sectionFingerprint(section),
  }));
  const expectedSections = (Array.isArray(expected.sections) ? expected.sections : []).map((section, index) => ({
    order: Number(section?.order || index + 1),
    title: exactString(section?.title || ""),
    type: exactString(section?.type || ""),
    contentSha256: exactString(section?.contentSha256 || ""),
  }));
  compareExact("sections", localSections, expectedSections, flags, details);

  const localGallery = galleryComparable(product);
  const expectedGallery = (Array.isArray(expected.gallery) ? expected.gallery : []).map((image, index) => ({
    order: Number(image?.order || index + 1),
    assetId: exactString(image?.sanityAssetId || ""),
    sha1: exactString(image?.sha1 || ""),
    alt: exactString(image?.alt || ""),
  }));
  compareExact("gallery", localGallery, expectedGallery, flags, details);

  const legacyUrls = [
    ...(Array.isArray(product.imageUrls) ? product.imageUrls : []),
    ...(Array.isArray(product.galleryImageUrls) ? product.galleryImageUrls : []),
    ...(Array.isArray(product.variants) ? product.variants.map((variant) => variant?.imageUrl) : []),
    ...(Array.isArray(product.kentSections) ? product.kentSections.flatMap((section) => [
      section?.imageUrl,
      ...(Array.isArray(section?.items) ? section.items.map((item) => item?.imageUrl) : []),
    ]) : []),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const kentRuntimeUrls = legacyUrls.filter(isKentUrl);
  if (kentRuntimeUrls.length) {
    flags.push("kent_hosted_image_url_present");
    details.kentHostedImageUrls = kentRuntimeUrls;
  }

  for (const image of localGallery) {
    if (!isSanityAssetId(image.assetId) || !/^[a-f0-9]{40}$/i.test(image.sha1)) {
      flags.push("gallery_asset_unmanaged_or_incomplete");
      break;
    }
  }

  const serious = [...new Set(flags)];
  return {
    status: serious.length ? "NEEDS_FIX" : "VERIFIED",
    flags: serious,
    details,
  };
}

function writeOutputs(report) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, "latest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const lines = [
    "# Kent exact content verification",
    "",
    `Generated: ${report.generatedAt}`,
    `Snapshot directory: ${report.snapshotDirectory}`,
    `Snapshots: ${report.counts.snapshots}`,
    `VERIFIED: ${report.counts.verified}`,
    `NEEDS_FIX: ${report.counts.needsFix}`,
    `BLOCKED: ${report.counts.blocked}`,
    "",
    "A product is VERIFIED only when title, subtitle, Item #, source URL, option order, variant order, section order and hashes, and Sanity gallery asset order and hashes all match its approved official snapshot.",
    "",
  ];

  for (const status of ["BLOCKED", "NEEDS_FIX", "VERIFIED"]) {
    lines.push(`## ${status}`, "");
    const rows = report.products.filter((row) => row.status === status);
    if (!rows.length) {
      lines.push("- None", "");
      continue;
    }
    for (const row of rows) {
      lines.push(
        `### ${row.slug || row.file}`,
        `- Snapshot: ${row.file}`,
        `- Official source: ${row.sourceUrl || "missing"}`,
        `- Checked at: ${row.checkedAt || "missing"}`,
        `- Flags: ${row.flags.length ? row.flags.join(", ") : "none"}`,
        "",
      );
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "latest.md"), lines.join("\n"), "utf8");
}

const snapshots = readSnapshots().filter((snapshot) => {
  if (!ONLY_SLUG) return true;
  return String(snapshot?.slug || "").trim().toLowerCase() === ONLY_SLUG;
});

const duplicateSlugs = snapshots
  .map((snapshot) => String(snapshot?.slug || "").trim().toLowerCase())
  .filter((slug, index, values) => slug && values.indexOf(slug) !== index);

const validSnapshots = [];
const rows = [];

for (const snapshot of snapshots) {
  const errors = validateSnapshot(snapshot);
  if (errors.length) {
    rows.push({
      slug: String(snapshot?.slug || ""),
      file: snapshot.__file,
      sourceUrl: String(snapshot?.sourceUrl || ""),
      checkedAt: String(snapshot?.checkedAt || ""),
      status: "BLOCKED",
      flags: errors,
      details: {},
    });
  } else {
    validSnapshots.push(snapshot);
  }
}

for (const slug of [...new Set(duplicateSlugs)]) {
  for (const snapshot of validSnapshots.filter((row) => String(row.slug).toLowerCase() === slug)) {
    rows.push({
      slug,
      file: snapshot.__file,
      sourceUrl: snapshot.sourceUrl,
      checkedAt: snapshot.checkedAt,
      status: "BLOCKED",
      flags: ["duplicate_snapshot_slug"],
      details: {},
    });
  }
}

const nonDuplicateSnapshots = validSnapshots.filter(
  (snapshot) => !duplicateSlugs.includes(String(snapshot.slug).toLowerCase()),
);
const slugs = nonDuplicateSnapshots.map((snapshot) => String(snapshot.slug).trim());
const products = slugs.length ? await sanity.fetch(PRODUCT_QUERY, { slugs }) : [];
const productBySlug = new Map((products || []).map((product) => [String(product.slug || "").toLowerCase(), product]));

for (const snapshot of nonDuplicateSnapshots) {
  const slug = String(snapshot.slug).trim().toLowerCase();
  const result = compareProduct(productBySlug.get(slug), snapshot);
  rows.push({
    slug,
    file: snapshot.__file,
    sourceUrl: snapshot.sourceUrl,
    checkedAt: snapshot.checkedAt,
    sourcePageSha256: snapshot.sourcePageSha256,
    status: result.status,
    flags: result.flags,
    details: result.details,
  });
}

if (!snapshots.length) {
  rows.push({
    slug: "",
    file: path.relative(ROOT, SNAPSHOT_DIR),
    sourceUrl: "",
    checkedAt: "",
    status: "BLOCKED",
    flags: ["no_approved_official_snapshots"],
    details: {},
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  snapshotDirectory: path.relative(ROOT, SNAPSHOT_DIR),
  sanity: { projectId, dataset, writes: 0 },
  kentWebRequests: 0,
  counts: {
    snapshots: snapshots.length,
    verified: rows.filter((row) => row.status === "VERIFIED").length,
    needsFix: rows.filter((row) => row.status === "NEEDS_FIX").length,
    blocked: rows.filter((row) => row.status === "BLOCKED").length,
  },
  products: rows.sort((left, right) => String(left.slug || left.file).localeCompare(String(right.slug || right.file))),
};

writeOutputs(report);

console.log("=== Kent exact content verification ===");
console.log(`Snapshots: ${report.counts.snapshots}`);
console.log(`VERIFIED: ${report.counts.verified}`);
console.log(`NEEDS_FIX: ${report.counts.needsFix}`);
console.log(`BLOCKED: ${report.counts.blocked}`);
console.log("Kent web requests: 0");
console.log("Sanity writes: 0");
console.log(`Report: ${path.relative(ROOT, path.join(OUTPUT_DIR, "latest.md"))}`);
console.log(`Data:   ${path.relative(ROOT, path.join(OUTPUT_DIR, "latest.json"))}`);

if (strict && (report.counts.needsFix > 0 || report.counts.blocked > 0)) {
  process.exit(1);
}
