import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";
const version = "2026-08-09-search-v5";
const outDir = path.resolve(".cache/abm-incomplete-details");

async function sanityQuery(query, params = {}) {
  const url = new URL(`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`);
  url.searchParams.set("query", query);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(`$${key}`, JSON.stringify(value));
  }
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Sanity query failed ${response.status}: ${await response.text()}`);
  const body = await response.json();
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result;
}

const QUERY = `{
  "records": *[
    _type == "abmRebuildChunk"
    && version == $version
    && kind == $kind
  ].records[]{
    kind,
    sku,
    title,
    url,
    unit,
    searchCategory,
    filterTitle,
    filterPath,
    listingFilters,
    hasDetail
  },
  "detailKeys": *[
    _type == "abmRebuildDetailChunk"
    && version == $version
    && kind == $kind
  ].records[].key
}`;

function recordKey(kind, record) {
  return `${kind}:${String(record?.sku || record?.url || "").trim().toLowerCase()}`;
}

function primaryCategory(record) {
  if (Array.isArray(record?.filterPath) && record.filterPath.length) return record.filterPath.join(" > ");
  if (record?.filterTitle) return String(record.filterTitle);
  if (record?.searchCategory) return String(record.searchCategory);
  const firstListing = Array.isArray(record?.listingFilters) ? record.listingFilters.find((row) => Array.isArray(row?.path) && row.path.length) : null;
  if (firstListing?.path?.length) return firstListing.path.join(" > ");
  return "Uncategorized";
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(" > ") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

async function auditKind(kind) {
  const result = await sanityQuery(QUERY, { version, kind });
  const records = Array.isArray(result?.records) ? result.records : [];
  const detailKeys = new Set((Array.isArray(result?.detailKeys) ? result.detailKeys : []).map((value) => String(value || "").trim().toLowerCase()));

  const unique = new Map();
  for (const record of records) {
    const key = recordKey(kind, record);
    if (!key.endsWith(":")) unique.set(key, record);
  }

  const incomplete = [...unique.entries()]
    .filter(([key]) => !detailKeys.has(key))
    .map(([key, record]) => ({
      key,
      kind,
      sku: String(record?.sku || ""),
      title: String(record?.title || ""),
      sourceUrl: String(record?.url || ""),
      unit: String(record?.unit || ""),
      category: primaryCategory(record),
      searchCategory: String(record?.searchCategory || ""),
      filterTitle: String(record?.filterTitle || ""),
      filterPath: Array.isArray(record?.filterPath) ? record.filterPath : [],
      listingFilters: Array.isArray(record?.listingFilters) ? record.listingFilters : [],
      recordHasDetail: record?.hasDetail ?? null,
      sitePath: `/products/abm/staged/${kind}/${encodeURIComponent(String(record?.sku || record?.url || ""))}`,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title) || a.sku.localeCompare(b.sku));

  const categoryCounts = {};
  for (const row of incomplete) categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1;

  const staleFlagMismatch = [...unique.entries()]
    .filter(([key, record]) => Boolean(record?.hasDetail) !== detailKeys.has(key))
    .map(([key, record]) => ({ key, sku: record?.sku || "", title: record?.title || "", recordHasDetail: record?.hasDetail ?? null, actualDetail: detailKeys.has(key) }));

  return {
    kind,
    stagedRows: records.length,
    uniqueInventory: unique.size,
    detailKeyCount: detailKeys.size,
    incompleteCount: incomplete.length,
    completeCount: unique.size - incomplete.length,
    staleFlagMismatchCount: staleFlagMismatch.length,
    categoryCounts: Object.fromEntries(Object.entries(categoryCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
    incomplete,
    staleFlagMismatch,
  };
}

await mkdir(outDir, { recursive: true });
const product = await auditKind("product");
const service = await auditKind("service");
const combined = {
  generatedAt: new Date().toISOString(),
  source: { projectId, dataset, apiVersion, version },
  messageCondition: "The fallback message renders when getAbmStagedDetail cannot find a matching abmRebuildDetailChunk record, causing hasDetail=false.",
  totals: {
    inventory: product.uniqueInventory + service.uniqueInventory,
    complete: product.completeCount + service.completeCount,
    incomplete: product.incompleteCount + service.incompleteCount,
  },
  product,
  service,
};

await writeFile(path.join(outDir, "abm-incomplete-details.json"), JSON.stringify(combined, null, 2));

const rows = [...product.incomplete, ...service.incomplete];
const csvHeader = ["kind","sku","title","category","unit","sourceUrl","sitePath","recordHasDetail"];
const csv = [
  csvHeader.join(","),
  ...rows.map((row) => [row.kind,row.sku,row.title,row.category,row.unit,row.sourceUrl,row.sitePath,row.recordHasDetail].map(csvCell).join(",")),
].join("\n");
await writeFile(path.join(outDir, "abm-incomplete-details.csv"), csv);

const topCategories = (audit) => Object.entries(audit.categoryCounts).slice(0, 30).map(([name, count]) => `- ${name}: ${count}`).join("\n") || "- none";
const md = `# ABM incomplete staged details audit\n\nGenerated: ${combined.generatedAt}\nVersion: ${version}\n\n## Totals\n- Unique staged inventory: ${combined.totals.inventory}\n- Complete detail records: ${combined.totals.complete}\n- Incomplete / fallback-message items: ${combined.totals.incomplete}\n\n## Products\n- Inventory: ${product.uniqueInventory}\n- Complete: ${product.completeCount}\n- Incomplete: ${product.incompleteCount}\n- Stored hasDetail flag mismatches: ${product.staleFlagMismatchCount}\n\n### Product incomplete by category\n${topCategories(product)}\n\n## Services\n- Inventory: ${service.uniqueInventory}\n- Complete: ${service.completeCount}\n- Incomplete: ${service.incompleteCount}\n- Stored hasDetail flag mismatches: ${service.staleFlagMismatchCount}\n\n### Service incomplete by category\n${topCategories(service)}\n`;
await writeFile(path.join(outDir, "summary.md"), md);
console.log(md);
