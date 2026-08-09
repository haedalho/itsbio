import { sanityClient } from "@/lib/sanity/sanity.client";

export const ABM_REBUILD_VERSION = "2026-08-09-search-v5";

export type AbmStagedRecord = {
  kind: "product" | "service";
  sku: string;
  title: string;
  url: string;
  unit?: string;
  searchCategory?: string;
  filterTitle?: string;
  filterPath?: string[];
  listingFilters?: Array<{ id: string; title: string; path: string[] }>;
};

const STAGED_QUERY = `*[_type == "abmRebuildChunk" && version == $version && kind == $kind].records[]`;

export async function getAbmStagedRecords(kind: AbmStagedRecord["kind"]): Promise<AbmStagedRecord[]> {
  const rows = await sanityClient.fetch<AbmStagedRecord[]>(STAGED_QUERY, {
    version: ABM_REBUILD_VERSION,
    kind,
  });
  return Array.isArray(rows) ? rows : [];
}

export async function getAbmStagedRecord(kind: AbmStagedRecord["kind"], key: string) {
  const rows = await getAbmStagedRecords(kind);
  return rows.find((row) => {
    const value = row.sku || row.url;
    return value === key || encodeURIComponent(value) === key;
  });
}

export function stagedRecordKey(row: AbmStagedRecord) {
  return row.sku || row.url;
}

export function stagedRecordPath(kind: AbmStagedRecord["kind"], row: AbmStagedRecord) {
  return `/products/abm/staged/${kind}/${encodeURIComponent(stagedRecordKey(row))}`;
}
