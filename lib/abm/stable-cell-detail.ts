import { findOfficialAbmStableCellProduct } from "@/lib/abm/stable-cell-data";
import { ABM_REBUILD_VERSION, isManagedAbmImageUrl, type AbmStagedDetail } from "@/lib/abm/rebuild-staging";
import { PUBLIC_CATALOG_CACHE, sanityClient } from "@/lib/sanity/sanity.client";

const STABLE_DETAIL_ID_PREFIX = "abm-rebuild-detail-product-batch-stable-cell-lines-chunk-";
const STABLE_DETAIL_QUERY = `(*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == "product"
  && string::startsWith(_id, $prefix)
  && $key in records[].key
] | order(_id asc))[0].records[key == $key][0]`;

function clean(value: unknown) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export async function getStableAbmCellDetail(key: string): Promise<AbmStagedDetail | undefined> {
  const official = findOfficialAbmStableCellProduct(key);
  if (!official) return undefined;

  const sku = clean(official.sku);
  const detailKey = `product:${sku.toLowerCase()}`;
  const managedOfficialImage = isManagedAbmImageUrl(clean(official.managedPreviewImage))
    ? clean(official.managedPreviewImage)
    : "";
  const staged = await sanityClient.fetch<Record<string, unknown> | null>(STABLE_DETAIL_QUERY, {
    version: ABM_REBUILD_VERSION,
    prefix: STABLE_DETAIL_ID_PREFIX,
    key: detailKey,
  }, PUBLIC_CATALOG_CACHE);

  const base: AbmStagedDetail = {
    kind: "product",
    sku,
    title: clean(official.title),
    url: clean(official.sourceUrl),
    sourceUrl: clean(official.sourceUrl),
    unit: clean(official.unit),
    searchCategory: "Stable Cell Lines",
    filterTitle: "Stable Cell Lines",
    filterPath: ["Cellular Materials", "Cell Library Collections", "Stable Cell Lines"],
    listingFilters: [{
      id: "25",
      title: "Stable Cell Lines",
      path: ["Cellular Materials", "Cell Library Collections", "Stable Cell Lines"],
    }],
    listingPaths: [["Cellular Materials", "Cell Library Collections", "Stable Cell Lines"]],
    breadcrumbs: ["Home", "Cellular Materials", "Cell Library Collections", "Stable Cell Lines", clean(official.title)],
    hasDetail: Boolean(staged),
    images: managedOfficialImage ? [managedOfficialImage] : [],
  };

  if (!staged) return base;

  const stagedImages = Array.isArray(staged.images)
    ? staged.images.map(String).filter((url) => isManagedAbmImageUrl(url))
    : [];
  const images = stagedImages.length
    ? stagedImages
    : (managedOfficialImage ? [managedOfficialImage] : []);

  return {
    ...base,
    ...(staged as Partial<AbmStagedDetail>),
    kind: "product",
    sku,
    title: clean(staged.title || official.title),
    url: clean(official.sourceUrl),
    sourceUrl: clean(staged.sourceUrl || official.sourceUrl),
    unit: clean(staged.unit || official.unit),
    searchCategory: "Stable Cell Lines",
    filterTitle: "Stable Cell Lines",
    filterPath: base.filterPath,
    listingFilters: base.listingFilters,
    listingPaths: Array.isArray(staged.listingPaths) && staged.listingPaths.length
      ? staged.listingPaths as string[][]
      : base.listingPaths,
    hasDetail: true,
    images,
  } as AbmStagedDetail;
}
