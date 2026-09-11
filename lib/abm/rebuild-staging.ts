import { PUBLIC_CATALOG_CACHE, sanityCdnClient, sanityClient } from "@/lib/sanity/sanity.client";
import { findOfficialAbmCellModelProduct } from "@/lib/abm/cell-model-data";
import { findOfficialAbmCellDetail } from "@/lib/abm/cell-detail-data";

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
  sourceUnavailable?: boolean;
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

const T9997_ABM_COLLECTION_URL = "https://www.abmgood.com/blood-cell-collection.html";
const T9997_DISTRIBUTOR_URL = "https://www.caltagmedsystems.co.uk/products/product_detail.php?CI_ID=2585623";
const T9997_CELL_BANK_URL = "https://cellbank.nibn.go.jp/~cellbank/en/search_res_det.cgi?ID=2072";
const T9997_ESTABLISHMENT_PAPER_URL = "https://pubmed.ncbi.nlm.nih.gov/2018839/";

function applyVerifiedCollectionDetail(detail: AbmStagedDetail): AbmStagedDetail {
  const isT9997 = detail.kind === "product" && String(detail.sku || "").trim().toLowerCase() === "t9997";
  const isCollectionFallback = detail.verification?.source === "official-collection-table"
    || String(detail.sourceUrl || "").trim() === T9997_ABM_COLLECTION_URL
    || detail.sourceUnavailable === true;
  if (!isT9997 || !isCollectionFallback || (detail.images || []).length > 0) return detail;

  return {
    ...detail,
    title: "Kasumi-1 Cells",
    category: "Blood Cell Collection",
    searchCategory: "Tumor Cells",
    unit: detail.unit || "Not published on the current ABM listing",
    storage: detail.storage || "Vapor phase of liquid nitrogen, or below -130°C.",
    sourceUrl: T9997_ABM_COLLECTION_URL,
    hasDetail: true,
    sourceUnavailable: false,
    description: "Kasumi-1 is a human acute myeloid leukemia cell line established from peripheral blood and characterized by the t(8;21) translocation and AML-ETO fusion gene.",
    introHtml: `<p><strong>Kasumi-1 Cells (T9997)</strong> are listed by ABM in the Blood Cell Collection as a human tumor cell product derived from blood.</p><p>The ABM product-detail URL is no longer published. The product fields below preserve ABM's current catalog record, verified ABM-T9997 storage and shipping data from an ABM distributor, and clearly separated reference characteristics for the same Kasumi-1 cell line from JCRB Cell Bank.</p>`,
    specificationsHtml: `<div class="abm-products-specification"><h3>ABM Product Record</h3><table><tbody><tr><th>Cat. No.</th><td>T9997</td></tr><tr><th>Name</th><td>Kasumi-1 Cells</td></tr><tr><th>Collection</th><td>Blood Cell Collection</td></tr><tr><th>Model Type</th><td>Tumor Cells</td></tr><tr><th>Organism</th><td>Human (H. sapiens)</td></tr><tr><th>Tissue</th><td>Blood</td></tr><tr><th>Regulatory Status</th><td>Research Use Only (RUO)</td></tr><tr><th>Shipping</th><td>Dry Ice</td></tr><tr><th>Storage Condition</th><td>Vapor phase of liquid nitrogen, or below -130°C.</td></tr></tbody></table><h3>Reference Cell-Line Characteristics (JCRB1003)</h3><table><tbody><tr><th>Profile</th><td>Human acute myeloid leukemia cell line with t(8;21) chromosome translocation</td></tr><tr><th>Primary Site</th><td>Peripheral blood</td></tr><tr><th>Morphology</th><td>Myeloblast</td></tr><tr><th>Growth Properties</th><td>Suspension culture</td></tr><tr><th>Genetics</th><td>t(8;21), AML-ETO fusion gene</td></tr><tr><th>Growth Medium</th><td>RPMI 1640 with 10% heat-inactivated fetal bovine serum</td></tr><tr><th>Culture Conditions</th><td>37°C, 5% CO₂; simple dilution twice weekly</td></tr><tr><th>Classification</th><td>Tumor cell line</td></tr></tbody></table></div>`,
    documentsHtml: `<div class="abm-doc-div"><div class="abm-doc-title">ABM Cell Handling Resources</div><ul class="abm-document-list"><li><a href="https://www.abmgood.com/uploads/document/IMPORTANT-CONSIDERATIONS-Cell-Culture-150623.pdf" target="_blank" rel="noopener noreferrer">Important Considerations for Cell Culture</a></li><li><a href="https://www.abmgood.com/uploads/document/Cell_Handling_Instructions_Upon_Arrival_150623.pdf" target="_blank" rel="noopener noreferrer">Cell Handling Instructions Upon Arrival</a></li></ul></div>`,
    referencesHtml: `<div class="abm-doc-div"><ul><li><a href="${T9997_ABM_COLLECTION_URL}" target="_blank" rel="noopener noreferrer">ABM Blood Cell Collection</a> — current manufacturer catalog entry for T9997.</li><li><a href="${T9997_DISTRIBUTOR_URL}" target="_blank" rel="noopener noreferrer">Caltag Medsystems ABM-T9997 record</a> — ABM supplier, shipping, storage, and RUO fields.</li><li><a href="${T9997_CELL_BANK_URL}" target="_blank" rel="noopener noreferrer">JCRB1003 Kasumi-1</a> — reference identity and culture characteristics for the same cell line.</li><li><a href="${T9997_ESTABLISHMENT_PAPER_URL}" target="_blank" rel="noopener noreferrer">Establishment of a human acute myeloid leukemia cell line (Kasumi-1) with 8;21 chromosome translocation</a>.</li></ul></div>`,
    documents: [
      { title: "Important Considerations for Cell Culture", url: "https://www.abmgood.com/uploads/document/IMPORTANT-CONSIDERATIONS-Cell-Culture-150623.pdf", section: "documents" },
      { title: "Cell Handling Instructions Upon Arrival", url: "https://www.abmgood.com/uploads/document/Cell_Handling_Instructions_Upon_Arrival_150623.pdf", section: "documents" },
    ],
    materialCitation: "Applied Biological Materials Inc., Cat. No. T9997.",
    verification: {
      ...(detail.verification || {}),
      source: "official-collection-plus-verified-references",
      sourceDetailAvailable: false,
      hasOfficialImages: false,
    },
  };
}

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

function isNonProductCatalogTool(record: Pick<AbmStagedRecord, "sku" | "url">) {
  if (String(record.sku || "").trim().toLowerCase() === "coa") return true;
  try {
    return new URL(String(record.url || ""), "https://www.abmgood.com").pathname.toLowerCase().endsWith("/coa-library.html");
  } catch {
    return false;
  }
}

function isNonProductCatalogToolKey(key: string) {
  const normalized = String(key || "").trim().toLowerCase();
  return normalized === "coa" || normalized.endsWith("/coa-library.html") || normalized === "coa-library.html";
}

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
  return (Array.isArray(result?.records) ? result.records : []).filter((record) =>
    kind !== "product" || !isNonProductCatalogTool(record)
  ).map((record) => {
    const key = `${kind}:${String(record.sku || record.url).trim().toLowerCase()}`;
    const detail = details.get(key);
    return {
      ...record,
      listingPaths: detail?.listingPaths,
      breadcrumbs: detail?.breadcrumbs,
    };
  });
}

const STAGED_COUNT_QUERY = `select(
  $kind == "product" => count(*[
    _type == "abmRebuildChunk"
    && version == $version
    && kind == $kind
  ].records[lower(sku) != "coa"]),
  count(*[
    _type == "abmRebuildChunk"
    && version == $version
    && kind == $kind
  ].records[])
)`;

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

function officialCellRecord(key: string): AbmStagedRecord | undefined {
  const officialCell = findOfficialAbmCellModelProduct(key);
  if (!officialCell) return undefined;
  return {
    kind: "product",
    sku: officialCell.sku || "",
    title: officialCell.title,
    url: officialCell.url,
    unit: officialCell.unit,
    searchCategory: officialCell.modelType,
    filterTitle: officialCell.modelType,
    filterPath: ["Cellular Materials", "Cell Library Collections", officialCell.modelType],
    listingFilters: [
      {
        id: `cell-model:${officialCell.modelType}`,
        title: officialCell.modelType,
        path: ["Cellular Materials", "Cell Library Collections", officialCell.modelType],
      },
    ],
    hasDetail: Boolean(findOfficialAbmCellDetail(officialCell.sku || key)),
  };
}

export async function getAbmStagedRecord(kind: AbmStagedRecord["kind"], key: string) {
  const decodedKey = decodeURIComponent(key);
  if (kind === "product") {
    if (isNonProductCatalogToolKey(decodedKey)) return null;
    const cellRecord = officialCellRecord(decodedKey);
    if (cellRecord) return cellRecord;
  }
  const staged = await sanityCdnClient.fetch<AbmStagedRecord | null>(STAGED_RECORD_QUERY, {
    version: ABM_REBUILD_VERSION,
    kind,
    key: decodedKey,
  }, PUBLIC_CATALOG_CACHE);
  if (kind === "product" && staged && isNonProductCatalogTool(staged)) return null;
  return staged;
}

export function stagedRecordKey(row: AbmStagedRecord) {
  return row.sku || row.url;
}

export function stagedRecordPath(kind: AbmStagedRecord["kind"], row: AbmStagedRecord) {
  return `/products/abm/staged/${kind}/${encodeURIComponent(stagedRecordKey(row))}`;
}

const STAGED_DETAIL_QUERY = `(*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == $kind
  && $key in records[].key
] | order(_id asc))[0].records[key == $key][0]`;

// A small number of rebuild records have reviewed content but no copied image array.
// Reuse only already-managed Sanity media from the matching legacy ABM product;
// never use its body, price, or external supplier media as a content fallback.
const EXISTING_ABM_IMAGE_QUERY = `*[
  _type == "product"
  && (
    brand._ref == "brand-abm"
    || brandSlug == "abm"
    || brand->slug.current == "abm"
    || brand->themeKey == "abm"
  )
  && (
    ($sku != "" && lower(sku) == lower($sku))
    || ($sku != "" && count(variants[defined(sku) && lower(sku) == lower($sku)]) > 0)
    || ($title != "" && lower(title) == lower($title))
    || ($sourceUrl != "" && sourceUrl == $sourceUrl)
  )
][0]{ imageUrls, "assetUrls": images[].asset->url }`;

type ExistingAbmImages = { imageUrls?: string[]; assetUrls?: string[] };

async function getExistingManagedProductImages(record: AbmStagedRecord) {
  if (record.kind !== "product") return [];
  const result = await sanityCdnClient.fetch<ExistingAbmImages | null>(EXISTING_ABM_IMAGE_QUERY, {
    sku: String(record.sku || "").trim(),
    title: String(record.title || "").trim(),
    sourceUrl: String(record.url || "").trim(),
  }, PUBLIC_CATALOG_CACHE);
  return normalizedDetailImages(undefined, [
    ...(result?.assetUrls || []),
    ...(result?.imageUrls || []),
  ]);
}

function mergeNonEmpty<T extends Record<string, unknown>>(base: T, extra: Record<string, unknown>) {
  const out = { ...base } as T & Record<string, unknown>;
  for (const [key, value] of Object.entries(extra)) {
    if (Array.isArray(value) ? value.length : typeof value === "string" ? value.trim() : value != null) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

function isInvalidCollectedDetail(staged: Record<string, unknown>) {
  const sourceUrl = String(staged.sourceUrl || "").trim();
  const title = String(staged.title || "").trim();
  let missingPageUrl = false;
  try {
    missingPageUrl = new URL(sourceUrl, "https://www.abmgood.com").pathname.toLowerCase().includes("/pagenotfound");
  } catch {
    missingPageUrl = false;
  }
  return missingPageUrl || /(?:\b404\b|page\s+you\s+are\s+looking\s+for\s+can(?:not|'t)\s+be\s+found|page\s+not\s+found)/i.test(title);
}

/** Resolve reviewed staging content. Existing Product may contribute managed Sanity images only. */
export async function getAbmStagedDetail(kind: AbmStagedRecord["kind"], key: string): Promise<AbmStagedDetail | undefined> {
  const decodedKey = decodeURIComponent(key);
  if (kind === "product") {
    const cellRecord = officialCellRecord(decodedKey);
    const cellDetail = cellRecord ? findOfficialAbmCellDetail(cellRecord.sku || decodedKey) : undefined;
    if (cellRecord && cellDetail) {
      let images = normalizedDetailImages(cellDetail.previewImage, cellDetail.images);
      if (!images.length) images = await getExistingManagedProductImages(cellRecord);
      return applyVerifiedCollectionDetail({
        ...cellRecord,
        ...cellDetail,
        kind,
        sourceUrl: String(cellDetail.sourceUrl || cellRecord.url || "").trim(),
        hasDetail: true,
        images,
      } as AbmStagedDetail);
    }
  }

  const record = await getAbmStagedRecord(kind, key);
  const detailKey = `${kind}:${String(record?.sku || record?.url || decodedKey).trim().toLowerCase()}`;

  // Read staged detail from the origin API rather than Sanity's CDN. Detail records
  // are occasionally backfilled after review (for example managed product media),
  // and the CDN can briefly serve the pre-backfill record. Next's catalog cache still
  // keeps repeated page reads fast after the fresh origin value has been observed.
  const staged = await sanityClient.fetch<Record<string, unknown> | null>(STAGED_DETAIL_QUERY, {
    version: ABM_REBUILD_VERSION,
    kind,
    key: detailKey,
  }, PUBLIC_CATALOG_CACHE);

  // New products can appear first on an official collection landing page and
  // receive a reviewed detail batch before the next full inventory census.
  // A verified detail record is sufficient to render the canonical internal
  // product page; it must not be forced through a temporary query fallback.
  if (!record && staged && !isInvalidCollectedDetail(staged)) {
    const direct = { ...staged } as AbmStagedDetail;
    direct.kind = kind;
    direct.sku = String(direct.sku || decodedKey).trim();
    direct.title = String(direct.title || direct.sku || "ABM item").trim();
    direct.url = String(direct.url || direct.sourceUrl || "").trim();
    direct.sourceUrl = String(direct.sourceUrl || direct.url || "").trim();
    direct.hasDetail = true;
    direct.images = normalizedDetailImages(direct.previewImage, direct.images);
    return applyVerifiedCollectionDetail(direct);
  }

  if (!record) return undefined;

  if (staged && isInvalidCollectedDetail(staged)) {
    let images = normalizedDetailImages(record.previewImage);
    if (!images.length) images = await getExistingManagedProductImages(record);
    return applyVerifiedCollectionDetail({
      ...record,
      sourceUrl: String(record.url || "").trim(),
      hasDetail: true,
      sourceUnavailable: true,
      images,
    } as AbmStagedDetail);
  }

  if (!staged) {
    const officialCellDetail = kind === "product" ? findOfficialAbmCellDetail(record.sku || decodedKey) : undefined;
    if (officialCellDetail) {
      let images = normalizedDetailImages(officialCellDetail.previewImage, officialCellDetail.images);
      if (!images.length) images = await getExistingManagedProductImages(record);
      return applyVerifiedCollectionDetail({
        ...record,
        ...officialCellDetail,
        kind,
        sourceUrl: String(officialCellDetail.sourceUrl || record.url || "").trim(),
        hasDetail: true,
        images,
      } as AbmStagedDetail);
    }
    let images = normalizedDetailImages(record.previewImage);
    if (!images.length) images = await getExistingManagedProductImages(record);
    return applyVerifiedCollectionDetail({
      ...record,
      sourceUrl: String(record.url || "").trim(),
      hasDetail: false,
      images,
    } as AbmStagedDetail);
  }

  const sourceUrl = String(staged.sourceUrl || record.url || "").trim();
  const detail = mergeNonEmpty({ ...record, sourceUrl }, staged) as AbmStagedDetail;
  detail.kind = kind;
  detail.hasDetail = true;
  detail.images = normalizedDetailImages(detail.previewImage, detail.images);
  if (!detail.images.length) detail.images = await getExistingManagedProductImages(record);
  return applyVerifiedCollectionDetail(detail);
}
