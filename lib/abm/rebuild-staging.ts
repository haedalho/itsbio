import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";

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
  hasDetail?: boolean;
  previewImage?: string;
  previewSummary?: string;
  listingPaths?: string[][];
  breadcrumbs?: string[];
};

export type AbmStagedLanding = {
  kind: "service";
  path: string[];
  title: string;
  sourceUrl: string;
  html: string;
  images?: string[];
  children?: Array<{ title: string; path: string[]; sourceUrl?: string; image?: string }>;
  collectedAt?: string;
};

export type AbmStagedDetail = AbmStagedRecord & {
  category?: string;
  listingPaths?: string[][];
  introHtml?: string;
  description?: string;
  overview?: string;
  storage?: string;
  materialCitation?: string;
  specificationsHtml?: string;
  datasheetHtml?: string;
  documentsHtml?: string;
  faqsHtml?: string;
  referencesHtml?: string;
  reviewsHtml?: string;
  serviceDetailsHtml?: string;
  serviceOffer?: {
    sku?: string;
    title?: string;
    unit?: string;
    fields?: Array<{ _key?: string; label?: string; value?: string }> | Record<string, string>;
  };
  breadcrumbs?: string[];
  images?: string[];
  documents?: Array<{ title?: string; url?: string; href?: string; section?: string }>;
  sourceUrl?: string;
  collectedAt?: string;
  verification?: Record<string, unknown>;
};

export function isManagedAbmImageUrl(value?: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.hostname !== "cdn.sanity.io" || !url.pathname.startsWith("/images/9b5twpc8/")) return false;

    // Sanity image asset paths end in `-WIDTHxHEIGHT.ext`. Tiny assets collected
    // from source pages are document icons, controls, or placeholders—not
    // meaningful product/service imagery—and must never be enlarged in a gallery.
    const dimensions = url.pathname.match(/-(\d+)x(\d+)\.[a-z0-9]+$/i);
    if (!dimensions) return false;
    const width = Number.parseInt(dimensions[1], 10);
    const height = Number.parseInt(dimensions[2], 10);
    return width >= 96 && height >= 96;
  } catch {
    return false;
  }
}

function normalizedDetailImages(previewImage?: string, images?: string[]) {
  return Array.from(new Set([
    String(previewImage || "").trim(),
    ...(Array.isArray(images) ? images : []),
  ].filter((value): value is string => isManagedAbmImageUrl(value))));
}

const STAGED_QUERY = `{
  "records": *[_type == "abmRebuildChunk" && version == $version && kind == $kind].records[]{
    kind,
    sku,
    title,
    url,
    unit,
    searchCategory,
    filterTitle,
    filterPath,
    listingFilters,
    hasDetail,
    previewImage,
    previewSummary
  },
  "details": select(
    $kind == "service" => *[_type == "abmRebuildDetailChunk" && version == $version && kind == $kind].records[]{
      key,
      listingPaths,
      breadcrumbs
    },
    []
  )
}`;

export async function getAbmStagedRecords(kind: AbmStagedRecord["kind"]): Promise<AbmStagedRecord[]> {
  const result = await sanityCdnClient.fetch<{
    records?: AbmStagedRecord[];
    details?: Array<{
      key?: string;
      listingPaths?: string[][];
      breadcrumbs?: string[];
    }>;
  }>(STAGED_QUERY, {
    version: ABM_REBUILD_VERSION,
    kind,
  }, PUBLIC_CATALOG_CACHE);
  const details = new Map((result?.details || []).map((detail) => [String(detail.key || "").toLowerCase(), detail]));
  return (Array.isArray(result?.records) ? result.records : []).map((record) => {
    const key = `${kind}:${String(record.sku || record.url).trim().toLowerCase()}`;
    const detail = details.get(key);
    return {
      ...record,
      listingPaths: detail?.listingPaths,
      breadcrumbs: detail?.breadcrumbs,
    };
  });
}

const STAGED_COUNT_QUERY = `count(*[
  _type == "abmRebuildChunk"
  && version == $version
  && kind == $kind
].records[])`;

/** Lightweight inventory count for landing pages; avoids transferring the full catalog. */
export async function getAbmStagedRecordCount(kind: AbmStagedRecord["kind"]): Promise<number> {
  const count = await sanityCdnClient.fetch<number>(STAGED_COUNT_QUERY, {
    version: ABM_REBUILD_VERSION,
    kind,
  }, PUBLIC_CATALOG_CACHE);
  return Number.isFinite(count) ? count : 0;
}

const STAGED_LANDING_QUERY = `*[
  _type == "abmRebuildLandingChunk"
  && version == $version
  && kind == "service"
  && $path in records[].pathKey
][0].records[pathKey == $path][0]{
  kind,
  path,
  title,
  sourceUrl,
  html,
  images,
  children,
  collectedAt
}`;

export async function getAbmStagedServiceLanding(path: string[]): Promise<AbmStagedLanding | undefined> {
  if (!path.length) return undefined;
  const result = await sanityCdnClient.fetch<AbmStagedLanding | null>(STAGED_LANDING_QUERY, {
    version: ABM_REBUILD_VERSION,
    path: path.join("/"),
  }, PUBLIC_CATALOG_CACHE);
  return result || undefined;
}

const STAGED_RECORD_QUERY = `*[
  _type == "abmRebuildChunk"
  && version == $version
  && kind == $kind
  && count(records[lower(sku) == lower($key) || lower(url) == lower($key)]) > 0
][0].records[lower(sku) == lower($key) || lower(url) == lower($key)][0]`;

export async function getAbmStagedRecord(kind: AbmStagedRecord["kind"], key: string) {
  const decodedKey = decodeURIComponent(key);
  return sanityCdnClient.fetch<AbmStagedRecord | null>(STAGED_RECORD_QUERY, {
    version: ABM_REBUILD_VERSION,
    kind,
    key: decodedKey,
  }, PUBLIC_CATALOG_CACHE);
}

export function stagedRecordKey(row: AbmStagedRecord) {
  return row.sku || row.url;
}

export function stagedRecordPath(kind: AbmStagedRecord["kind"], row: AbmStagedRecord) {
  return `/products/abm/staged/${kind}/${encodeURIComponent(stagedRecordKey(row))}`;
}

const STAGED_DETAIL_QUERY = `*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == $kind
  && $key in records[].key
][0].records[key == $key][0]`;

// A small number of rebuild records have reviewed content but no copied image array.
// Reuse only already-managed Sanity media from the matching legacy ABM product;
// never use its body, price, or external supplier media as a content fallback.
const EXISTING_ABM_IMAGE_QUERY = `*[
  _type == "product"
  && (
    brandSlug == "abm"
    || brand->slug.current == "abm"
    || brand->themeKey == "abm"
  )
  && (
    ($sku != "" && lower(sku) == lower($sku))
    || ($title != "" && lower(title) == lower($title))
  )
][0]{ imageUrls }`;

type ExistingAbmImages = { imageUrls?: string[] };

async function getExistingManagedProductImages(record: AbmStagedRecord) {
  if (record.kind !== "product") return [];
  const result = await sanityCdnClient.fetch<ExistingAbmImages | null>(EXISTING_ABM_IMAGE_QUERY, {
    sku: String(record.sku || "").trim(),
    title: String(record.title || "").trim(),
  }, PUBLIC_CATALOG_CACHE);
  return normalizedDetailImages(undefined, result?.imageUrls);
}

function mergeNonEmpty<T extends Record<string, unknown>>(base: T, extra: Record<string, unknown>) {
  const out = { ...base } as T & Record<string, unknown>;
  for (const [key, value] of Object.entries(extra)) {
    if (Array.isArray(value) ? value.length : typeof value === "string" ? value.trim() : value != null) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/** Resolve reviewed staging content. Existing Product may contribute managed Sanity images only. */
export async function getAbmStagedDetail(kind: AbmStagedRecord["kind"], key: string): Promise<AbmStagedDetail | undefined> {
  const record = await getAbmStagedRecord(kind, key);
  if (!record) return undefined;

  const detailKey = `${kind}:${String(record.sku || record.url).trim().toLowerCase()}`;
  const staged = await sanityCdnClient.fetch<Record<string, unknown> | null>(STAGED_DETAIL_QUERY, {
    version: ABM_REBUILD_VERSION,
    kind,
    key: detailKey,
  }, PUBLIC_CATALOG_CACHE);

  if (!staged) {
    let images = normalizedDetailImages(record.previewImage);
    if (!images.length) images = await getExistingManagedProductImages(record);
    return {
      ...record,
      sourceUrl: String(record.url || "").trim(),
      hasDetail: false,
      images,
    } as AbmStagedDetail;
  }

  const sourceUrl = String(staged.sourceUrl || record.url || "").trim();
  const detail = mergeNonEmpty({ ...record, sourceUrl }, staged) as AbmStagedDetail;
  detail.kind = kind;
  detail.hasDetail = true;
  detail.images = normalizedDetailImages(detail.previewImage, detail.images);
  if (!detail.images.length) detail.images = await getExistingManagedProductImages(record);
  return detail;
}
