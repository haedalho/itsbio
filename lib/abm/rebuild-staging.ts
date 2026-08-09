import { sanityClient } from "@/lib/sanity/sanity.client";
import { parseAbmRebuildDetailV2 } from "@/lib/abm/rebuild-parser-v2.mjs";

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

export type AbmStagedDetail = AbmStagedRecord & {
  description?: string;
  overview?: string;
  storage?: string;
  materialCitation?: string;
  specificationsHtml?: string;
  documentsHtml?: string;
  faqsHtml?: string;
  referencesHtml?: string;
  reviewsHtml?: string;
  serviceDetailsHtml?: string;
  images?: string[];
  documents?: Array<{ title?: string; href?: string; section?: string }>;
  sourceUrl?: string;
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

const EXISTING_DETAIL_QUERY = `*[_type == "product" && sku == $sku && (brandSlug == "abm" || brand->slug.current == "abm" || brand->themeKey == "abm")][0]{
  title, sku, sourceUrl, description, overview, storage, materialCitation,
  specificationsHtml, documentsHtml, faqsHtml, referencesHtml, reviewsHtml,
  serviceDetailsHtml, imageUrls, documents
}`;

function mergeNonEmpty<T extends Record<string, unknown>>(base: T, extra: Record<string, unknown>) {
  const out = { ...base } as T & Record<string, unknown>;
  for (const [key, value] of Object.entries(extra)) {
    if (Array.isArray(value) ? value.length : typeof value === "string" ? value.trim() : value != null) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/** Resolve a staged inventory row to full official detail for the preview. */
export async function getAbmStagedDetail(kind: AbmStagedRecord["kind"], key: string): Promise<AbmStagedDetail | undefined> {
  const record = await getAbmStagedRecord(kind, key);
  if (!record) return undefined;

  const existing = record.sku
    ? await sanityClient.fetch<Record<string, unknown> | null>(EXISTING_DETAIL_QUERY, { sku: record.sku })
    : null;
  const sourceUrl = String(record.url || existing?.sourceUrl || "").trim();
  let parsed: Record<string, unknown> = {};

  if (sourceUrl) {
    try {
      const response = await fetch(sourceUrl, {
        cache: "no-store",
        headers: { accept: "text/html", "user-agent": "ITS-BIO-ABM-Preview/1.0" },
        signal: AbortSignal.timeout(12000),
      });
      if (response.ok) {
        parsed = parseAbmRebuildDetailV2(await response.text(), sourceUrl, { ...record, kind });
      }
    } catch {
      // Existing Sanity detail remains a valid offline fallback for this preview page.
    }
  }

  const detail = mergeNonEmpty(
    mergeNonEmpty({ ...record, sourceUrl }, existing || {}),
    parsed,
  ) as AbmStagedDetail;
  detail.kind = kind;
  detail.images = Array.isArray(detail.images) ? detail.images : Array.isArray((existing as any)?.imageUrls) ? (existing as any).imageUrls : [];
  return detail;
}
