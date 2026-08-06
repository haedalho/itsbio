#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID || "9b5twpc8";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || "production";
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-02-19";
const outputPath = path.join(process.cwd(), "data", "kent-local-review-summary.md");

const query = `
*[
  _type == "product"
  && (
    brandSlug == "kent"
    || themeKey == "kent"
    || brand->slug.current == "kent"
    || brand->themeKey == "kent"
  )
  && !(lower(coalesce(title, "")) match "*warranty*" || lower(coalesce(slug.current, "")) match "*warranty*")
] | order(lower(title) asc) {
  _id,
  title,
  "slug": slug.current,
  summary,
  sku,
  sourceUrl,
  sourceIntroHtml,
  overviewHtml,
  extraHtml,
  legacyHtml,
  specsHtml,
  datasheetHtml,
  documentsHtml,
  faqsHtml,
  referencesHtml,
  reviewsHtml,
  kentSections,
  optionGroups,
  variants,
  "images": images[]{
    "filename": asset->originalFilename,
    "width": asset->metadata.dimensions.width,
    "height": asset->metadata.dimensions.height,
    sourceUrl
  }
}
`;

function textOnly(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function oneLine(value, max = 1400) {
  const text = textOnly(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function combinedContent(row) {
  const html = [
    row?.sourceIntroHtml,
    row?.overviewHtml,
    row?.extraHtml,
    row?.legacyHtml,
    row?.specsHtml,
    row?.datasheetHtml,
    row?.documentsHtml,
    row?.faqsHtml,
    row?.referencesHtml,
    row?.reviewsHtml,
  ].filter(Boolean).join(" ");
  const sections = (Array.isArray(row?.kentSections) ? row.kentSections : [])
    .map((section) => `${section?.title || ""}: ${section?.html || section?.contentHtml || section?.bodyHtml || section?.description || ""}`)
    .join(" ");
  return oneLine(`${html} ${sections}`);
}

async function fetchRows() {
  const url = new URL(`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`);
  url.searchParams.set("query", query);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Sanity query failed: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  if (!Array.isArray(payload?.result)) throw new Error("Sanity query did not return an array.");
  return payload.result;
}

const rows = await fetchRows();
const lines = [
  "# Kent local review summary",
  "",
  `Generated: ${new Date().toISOString()}`,
  `Source: Sanity ${projectId}/${dataset}`,
  `Products: ${rows.length}`,
  "",
];

rows.forEach((row, index) => {
  const sectionTitles = (Array.isArray(row?.kentSections) ? row.kentSections : [])
    .map((section) => String(section?.title || section?.type || section?._type || "").trim())
    .filter(Boolean);
  const optionLabels = (Array.isArray(row?.optionGroups) ? row.optionGroups : [])
    .flatMap((group) => (Array.isArray(group?.options) ? group.options : []).map((option) => String(option?.label || option?.value || "").trim()))
    .filter(Boolean);
  const variants = (Array.isArray(row?.variants) ? row.variants : [])
    .map((variant) => `${variant?.sku || variant?.catNo || variant?.variantId || "?"}: ${variant?.title || variant?.optionSummary || ""}`)
    .filter(Boolean);
  const images = (Array.isArray(row?.images) ? row.images : [])
    .map((image) => `${image?.filename || "unnamed"} (${image?.width || "?"}x${image?.height || "?"}) <- ${image?.sourceUrl || "no-source"}`);

  lines.push(
    `## ${index + 1}. ${String(row?.title || row?.slug || "Untitled").replaceAll("\n", " ")}`,
    `- slug: ${row?.slug || ""}`,
    `- Item #: ${row?.sku || ""}`,
    `- subtitle/summary: ${oneLine(row?.summary, 500)}`,
    `- source: ${row?.sourceUrl || ""}`,
    `- local content: ${combinedContent(row)}`,
    `- section titles: ${sectionTitles.join(" | ") || "none"}`,
    `- options: ${optionLabels.join(" | ") || "none"}`,
    `- variants: ${variants.join(" | ") || "none"}`,
    `- Sanity images: ${images.join(" | ") || "none"}`,
    "",
  );
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, lines.join("\n") + "\n");
console.log(`Kent local review summary written: ${rows.length} products`);
