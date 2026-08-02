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
const valueOf = (name, fallback = "") => {
  const found = args.find((arg) => arg.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : fallback;
};

const SNAPSHOT_DIR = path.resolve(ROOT, valueOf("--snapshots", "data/kent-official-source-snapshots"));
const OUTPUT_DIR = path.resolve(ROOT, valueOf("--output", ".cache/kent-exact-content-verification"));
const ONLY_SLUG = valueOf("--slug").trim().toLowerCase();

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_STUDIO_PROJECT_ID || process.env.SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_STUDIO_DATASET || process.env.SANITY_DATASET;
if (!projectId || !dataset) throw new Error("Missing Sanity project ID or dataset in .env.local/.env.");

const sanity = createClient({ projectId, dataset, apiVersion: "2025-02-19", useCdn: false });

const QUERY = `*[
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
  sourceIntroHtml,
  optionGroups[]{ key, name, label, displayType, options[]{ value, label } },
  variants[]{
    variantId,
    title,
    sku,
    catNo,
    optionSummary,
    optionValues,
    attributes,
    sourceVariationId,
    imageUrl,
    "imageAsset": image.asset->{ _id, sha1hash }
  },
  kentSections[]{
    _type,
    type,
    kind,
    title,
    html,
    contentHtml,
    bodyHtml,
    description,
    imageUrl,
    items,
    links,
    documents,
    videos,
    rows
  },
  "images": images[]{ alt, "asset": asset->{ _id, sha1hash } },
  imageUrls,
  galleryImageUrls
}`;

function decode(value) {
  return String(value ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function exact(value) {
  return decode(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function text(value) {
  return exact(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith("_"))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, stable(child)]),
  );
}

function same(a, b) {
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
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

function validAssetId(value) {
  return /^image-[a-f0-9]+-\d+x\d+-[a-z0-9]+$/i.test(String(value || ""));
}

function snapshots() {
  if (!fs.existsSync(SNAPSHOT_DIR)) return [];
  return fs.readdirSync(SNAPSHOT_DIR)
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .sort()
    .flatMap((name) => {
      const file = path.join(SNAPSHOT_DIR, name);
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      return (Array.isArray(parsed) ? parsed : [parsed]).map((row) => ({ ...row, __file: path.relative(ROOT, file) }));
    });
}

function validate(snapshot) {
  const errors = [];
  if (snapshot?.schemaVersion !== 2) errors.push("schema_version_must_be_2");
  if (!snapshot?.slug) errors.push("slug_missing");
  if (!snapshot?.sourceUrl || !isKentUrl(snapshot.sourceUrl)) errors.push("official_source_url_missing_or_not_kent");
  if (!snapshot?.checkedAt) errors.push("checked_at_missing");
  if (!/^[a-f0-9]{64}$/i.test(String(snapshot?.sourcePageSha256 || ""))) errors.push("source_page_sha256_missing_or_invalid");
  if (!snapshot?.content?.title) errors.push("title_missing");
  if (!snapshot?.content?.itemNumber) errors.push("item_number_missing");
  if (!/^[a-f0-9]{64}$/i.test(String(snapshot?.content?.introBodySha256 || ""))) errors.push("intro_body_sha256_missing_or_invalid");
  if (!Array.isArray(snapshot?.content?.sections)) errors.push("sections_missing");

  const hero = snapshot?.content?.heroImage;
  if (!hero) errors.push("hero_image_missing");
  else {
    if (!validAssetId(hero.sanityAssetId)) errors.push("hero_image_asset_id_invalid");
    if (!/^[a-f0-9]{40}$/i.test(String(hero.sha1 || ""))) errors.push("hero_image_sha1_invalid");
    if (!/^[a-f0-9]{64}$/i.test(String(hero.sourceImageSha256 || ""))) errors.push("hero_source_sha256_invalid");
  }
  return errors;
}

function optionGroups(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    key: exact(row?.key || row?.name || ""),
    label: exact(row?.label || row?.name || ""),
    displayType: exact(row?.displayType || ""),
    options: (Array.isArray(row?.options) ? row.options : []).map((option) => ({
      value: exact(option?.value || ""),
      label: exact(option?.label || option?.value || ""),
    })),
  }));
}

function variants(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    variantId: exact(row?.variantId || ""),
    title: exact(row?.title || ""),
    sku: exact(row?.sku || ""),
    catNo: exact(row?.catNo || ""),
    optionSummary: exact(row?.optionSummary || ""),
    optionValues: stable(row?.optionValues || {}),
    attributes: stable(row?.attributes || {}),
    sourceVariationId: exact(row?.sourceVariationId || ""),
  }));
}

function sectionData(section) {
  const items = [
    ...(Array.isArray(section?.items) ? section.items : []),
    ...(Array.isArray(section?.links) ? section.links : []),
    ...(Array.isArray(section?.documents) ? section.documents : []),
    ...(Array.isArray(section?.videos) ? section.videos : []),
  ].map((item) => ({
    title: exact(item?.title || item?.label || item?.text || ""),
    description: text(item?.description || item?.html || item?.value || ""),
    url: normalizeUrl(item?.url || item?.href || ""),
    imageUrl: String(item?.imageUrl || "").trim(),
  }));

  return {
    title: exact(section?.title || ""),
    type: exact(section?.type || section?.kind || section?._type || ""),
    text: text([section?.html, section?.contentHtml, section?.bodyHtml, section?.description].filter(Boolean).join(" ")),
    items,
    rows: Array.isArray(section?.rows) ? stable(section.rows) : [],
    imageUrl: String(section?.imageUrl || "").trim(),
  };
}

function compare(product, snapshot) {
  if (!product) return { status: "BLOCKED", flags: ["sanity_product_missing"], details: {} };

  const flags = [];
  const details = {};
  const expected = snapshot.content;
  const mismatch = (name, actual, wanted) => {
    flags.push(`${name}_mismatch`);
    details[name] = { actual, expected: wanted };
  };

  if (exact(product.title) !== exact(expected.title)) mismatch("title", exact(product.title), exact(expected.title));
  if (exact(product.summary) !== exact(expected.subtitle || "")) mismatch("subtitle", exact(product.summary), exact(expected.subtitle || ""));
  if (exact(product.sku) !== exact(expected.itemNumber)) mismatch("item_number", exact(product.sku), exact(expected.itemNumber));
  if (normalizeUrl(product.sourceUrl) !== normalizeUrl(snapshot.sourceUrl)) mismatch("source_url", normalizeUrl(product.sourceUrl), normalizeUrl(snapshot.sourceUrl));

  const introHash = sha256(text(product.sourceIntroHtml || ""));
  if (introHash !== exact(expected.introBodySha256)) mismatch("intro_body", introHash, exact(expected.introBodySha256));

  const actualGroups = optionGroups(product.optionGroups);
  const expectedGroups = Array.isArray(expected.optionGroups) ? expected.optionGroups : [];
  if (!same(actualGroups, expectedGroups)) mismatch("option_groups", actualGroups, expectedGroups);

  const actualVariants = variants(product.variants);
  const expectedVariants = Array.isArray(expected.variants) ? expected.variants : [];
  if (!same(actualVariants, expectedVariants)) mismatch("variants", actualVariants, expectedVariants);

  const actualSections = (Array.isArray(product.kentSections) ? product.kentSections : []).map((section, index) => ({
    order: index + 1,
    title: exact(section?.title || ""),
    type: exact(section?.type || section?.kind || section?._type || ""),
    contentSha256: sha256(JSON.stringify(stable(sectionData(section)))),
  }));
  const expectedSections = expected.sections.map((section, index) => ({
    order: Number(section?.order || index + 1),
    title: exact(section?.title || ""),
    type: exact(section?.type || ""),
    contentSha256: exact(section?.contentSha256 || ""),
  }));
  if (!same(actualSections, expectedSections)) mismatch("sections", actualSections, expectedSections);

  const firstImage = Array.isArray(product.images) ? product.images[0] : null;
  const actualHero = {
    sanityAssetId: exact(firstImage?.asset?._id || ""),
    sha1: exact(firstImage?.asset?.sha1hash || ""),
    alt: exact(firstImage?.alt || ""),
  };
  const expectedHero = {
    sanityAssetId: exact(expected?.heroImage?.sanityAssetId || ""),
    sha1: exact(expected?.heroImage?.sha1 || ""),
    alt: exact(expected?.heroImage?.alt || ""),
  };
  if (!same(actualHero, expectedHero)) mismatch("hero_image", actualHero, expectedHero);
  if (!validAssetId(actualHero.sanityAssetId) || !/^[a-f0-9]{40}$/i.test(actualHero.sha1)) flags.push("hero_image_unmanaged_or_incomplete");

  if ((Array.isArray(product.images) ? product.images.length : 0) > 1) {
    flags.push("gallery_images_present");
    details.extraImageCount = product.images.length - 1;
  }

  const variantImages = (Array.isArray(product.variants) ? product.variants : []).filter((row) => row?.imageUrl || row?.imageAsset?._id);
  if (variantImages.length) {
    flags.push("variant_images_present");
    details.variantImages = variantImages.map((row) => row.variantId || row.sku || row.catNo || "unknown");
  }

  const imageUrls = [
    ...(Array.isArray(product.imageUrls) ? product.imageUrls : []),
    ...(Array.isArray(product.galleryImageUrls) ? product.galleryImageUrls : []),
    ...(Array.isArray(product.variants) ? product.variants.map((row) => row?.imageUrl) : []),
    ...(Array.isArray(product.kentSections) ? product.kentSections.flatMap((section) => [
      section?.imageUrl,
      ...(Array.isArray(section?.items) ? section.items.map((item) => item?.imageUrl) : []),
    ]) : []),
  ].map((value) => String(value || "").trim()).filter(Boolean);

  const kentUrls = imageUrls.filter(isKentUrl);
  if (kentUrls.length) {
    flags.push("kent_hosted_image_url_present");
    details.kentHostedImageUrls = kentUrls;
  }

  const uniqueFlags = [...new Set(flags)];
  return { status: uniqueFlags.length ? "NEEDS_FIX" : "VERIFIED", flags: uniqueFlags, details };
}

function writeReport(report) {
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
    "VERIFIED requires the exact title, subtitle, Item #, official source URL, intro-body hash, options, Variants, section order and hashes, and one approved Sanity hero image. Product galleries are intentionally excluded.",
    "",
  ];

  for (const status of ["BLOCKED", "NEEDS_FIX", "VERIFIED"]) {
    lines.push(`## ${status}`, "");
    const rows = report.products.filter((row) => row.status === status);
    if (!rows.length) lines.push("- None", "");
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

const loaded = snapshots().filter((snapshot) => !ONLY_SLUG || String(snapshot?.slug || "").trim().toLowerCase() === ONLY_SLUG);
const duplicateSlugs = loaded.map((row) => String(row?.slug || "").trim().toLowerCase()).filter((slug, index, all) => slug && all.indexOf(slug) !== index);
const rows = [];
const valid = [];

for (const snapshot of loaded) {
  const errors = validate(snapshot);
  if (errors.length) {
    rows.push({ slug: snapshot?.slug || "", file: snapshot.__file, sourceUrl: snapshot?.sourceUrl || "", checkedAt: snapshot?.checkedAt || "", status: "BLOCKED", flags: errors, details: {} });
  } else valid.push(snapshot);
}

for (const slug of [...new Set(duplicateSlugs)]) {
  for (const snapshot of valid.filter((row) => String(row.slug).toLowerCase() === slug)) {
    rows.push({ slug, file: snapshot.__file, sourceUrl: snapshot.sourceUrl, checkedAt: snapshot.checkedAt, status: "BLOCKED", flags: ["duplicate_snapshot_slug"], details: {} });
  }
}

const accepted = valid.filter((row) => !duplicateSlugs.includes(String(row.slug).toLowerCase()));
const slugs = accepted.map((row) => String(row.slug).trim());
const products = slugs.length ? await sanity.fetch(QUERY, { slugs }) : [];
const bySlug = new Map((products || []).map((product) => [String(product.slug || "").toLowerCase(), product]));

for (const snapshot of accepted) {
  const slug = String(snapshot.slug).trim().toLowerCase();
  const result = compare(bySlug.get(slug), snapshot);
  rows.push({ slug, file: snapshot.__file, sourceUrl: snapshot.sourceUrl, checkedAt: snapshot.checkedAt, sourcePageSha256: snapshot.sourcePageSha256, status: result.status, flags: result.flags, details: result.details });
}

if (!loaded.length) {
  rows.push({ slug: "", file: path.relative(ROOT, SNAPSHOT_DIR), sourceUrl: "", checkedAt: "", status: "BLOCKED", flags: ["no_approved_official_snapshots"], details: {} });
}

const report = {
  generatedAt: new Date().toISOString(),
  snapshotDirectory: path.relative(ROOT, SNAPSHOT_DIR),
  sanity: { projectId, dataset, writes: 0 },
  kentWebRequests: 0,
  counts: {
    snapshots: loaded.length,
    verified: rows.filter((row) => row.status === "VERIFIED").length,
    needsFix: rows.filter((row) => row.status === "NEEDS_FIX").length,
    blocked: rows.filter((row) => row.status === "BLOCKED").length,
  },
  products: rows.sort((a, b) => String(a.slug || a.file).localeCompare(String(b.slug || b.file))),
};

writeReport(report);
console.log("=== Kent exact content verification ===");
console.log(`Snapshots: ${report.counts.snapshots}`);
console.log(`VERIFIED: ${report.counts.verified}`);
console.log(`NEEDS_FIX: ${report.counts.needsFix}`);
console.log(`BLOCKED: ${report.counts.blocked}`);
console.log("Kent web requests: 0");
console.log("Sanity writes: 0");
console.log(`Report: ${path.relative(ROOT, path.join(OUTPUT_DIR, "latest.md"))}`);
console.log(`Data:   ${path.relative(ROOT, path.join(OUTPUT_DIR, "latest.json"))}`);

if (strict && (report.counts.needsFix > 0 || report.counts.blocked > 0)) process.exit(1);
