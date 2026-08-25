import { cache } from "react";

import {
  CLEAVER_CATEGORIES,
  CLEAVER_INVENTORY,
  CLEAVER_PAGE_SIZE,
  cleaverCategoryTitles,
  findLocalCleaverProduct,
  type CleaverProduct,
} from "@/lib/cleaver/catalog";
import { sanityCdnClient } from "@/lib/sanity/sanity.client";

const CLEAVER_CATALOG_CACHE = { next: { revalidate: 300 } } as const;

const CLEAVER_FILTER = `
  _type == "product"
  && (!defined(isActive) || isActive == true)
  && (
    brandSlug in ["cleaver", "cleaverscientific"]
    || brand->slug.current in ["cleaver", "cleaverscientific"]
    || brand->themeKey in ["cleaver", "cleaverscientific"]
  )
`;

const SHOWCASE_PROJECTION = `{
  _id,
  title,
  sku,
  order,
  summary,
  categoryPath,
  categoryPathTitles,
  "slug": slug.current,
  "image": images[defined(asset->url)][0].asset->url
}`;

const PRODUCT_PROJECTION = `{
  _id,
  title,
  sku,
  order,
  summary,
  sourceUrl,
  categoryPath,
  categoryPathTitles,
  "slug": slug.current,
  "image": images[defined(asset->url)][0].asset->url,
  "images": images[defined(asset->url)][].asset->url,
  overviewHtml,
  specsHtml,
  documentsHtml,
  highlights,
  specRows[]{label, value},
  docs[]{title, label, url}
}`;

type ProductPage = {
  products: CleaverProduct[];
  total: number;
  page: number;
  pageCount: number;
};

type ListingImageRow = {
  sku?: string;
  image?: string;
};

function localProductPage(path: string[], query: string, requestedPage: number): ProductPage {
  const needle = query.trim().toLowerCase();
  const matches = CLEAVER_INVENTORY.filter((product) => {
    const inCategory = path.every((segment, index) => product.categoryPath[index] === segment);
    const matchesQuery = !needle || product.title.toLowerCase().includes(needle) || product.sku.toLowerCase().includes(needle);
    return inCategory && matchesQuery;
  });
  const pageCount = Math.max(1, Math.ceil(matches.length / CLEAVER_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (page - 1) * CLEAVER_PAGE_SIZE;
  return { products: matches.slice(start, start + CLEAVER_PAGE_SIZE), total: matches.length, page, pageCount };
}

// Listing/search/category membership is already authoritative in the reviewed
// local Cleaver inventory. Do that work locally and ask Sanity only for the
// small set of card images required by the current page.
export async function getCleaverProductPage(path: string[], query: string, requestedPage = 1): Promise<ProductPage> {
  const local = localProductPage(path, query, requestedPage);
  if (!local.products.length) return local;

  const skus = local.products.map((product) => product.sku);
  try {
    const rows = await sanityCdnClient.fetch<ListingImageRow[]>(`
      *[
        ${CLEAVER_FILTER}
        && sku in $skus
      ]{
        sku,
        "image": images[defined(asset->url)][0].asset->url
      }
    `, { skus }, CLEAVER_CATALOG_CACHE);

    const images = new Map(
      (Array.isArray(rows) ? rows : [])
        .filter((row): row is Required<Pick<ListingImageRow, "sku">> & ListingImageRow => Boolean(row.sku))
        .map((row) => [String(row.sku).toLowerCase(), row.image]),
    );

    return {
      ...local,
      products: local.products.map((product) => ({
        ...product,
        image: images.get(product.sku.toLowerCase()) || product.image,
      })),
    };
  } catch (error) {
    console.error("Unable to load Cleaver card images from Sanity:", error instanceof Error ? error.message : error);
    return local;
  }
}

export const getCleaverProduct = cache(async (slugOrSku: string): Promise<CleaverProduct | null> => {
  const local = findLocalCleaverProduct(slugOrSku);

  try {
    const product = await sanityCdnClient.fetch<CleaverProduct | null>(`
      *[${CLEAVER_FILTER} && (slug.current == $slug || lower(sku) == lower($slug))][0] ${PRODUCT_PROJECTION}
    `, { slug: decodeURIComponent(slugOrSku) }, CLEAVER_CATALOG_CACHE);
    if (product) {
      const categoryPath = Array.isArray(product.categoryPath) && product.categoryPath.length ? product.categoryPath : local?.categoryPath || [];
      return {
        ...local,
        ...product,
        categoryPath,
        categoryPathTitles: product.categoryPathTitles?.length ? product.categoryPathTitles : cleaverCategoryTitles(categoryPath),
      };
    }
  } catch (error) {
    console.error("Unable to load Cleaver product from Sanity:", error instanceof Error ? error.message : error);
  }

  return local || null;
});

const CATEGORY_COVER_CANDIDATES = (() => {
  const candidates = new Map<string, string[]>();
  for (const category of CLEAVER_CATEGORIES) candidates.set(category.slug, []);
  for (const product of CLEAVER_INVENTORY) {
    const category = product.categoryPath[0];
    const bucket = candidates.get(category);
    if (!bucket || bucket.length >= 12) continue;
    bucket.push(product.sku);
  }
  return candidates;
})();

export async function getCleaverCategoryCovers() {
  const candidateSkus = Array.from(new Set(Array.from(CATEGORY_COVER_CANDIDATES.values()).flat()));
  if (!candidateSkus.length) return {};

  try {
    const rows = await sanityCdnClient.fetch<ListingImageRow[]>(`
      *[
        ${CLEAVER_FILTER}
        && sku in $skus
        && defined(images[0].asset->url)
      ]{
        sku,
        "image": images[0].asset->url
      }
    `, { skus: candidateSkus }, CLEAVER_CATALOG_CACHE);

    const bySku = new Map(
      (Array.isArray(rows) ? rows : [])
        .filter((row) => row.sku && row.image)
        .map((row) => [String(row.sku).toLowerCase(), String(row.image)]),
    );
    const covers: Record<string, string> = {};

    for (const category of CLEAVER_CATEGORIES) {
      const candidates = CATEGORY_COVER_CANDIDATES.get(category.slug) || [];
      const image = candidates.map((sku) => bySku.get(sku.toLowerCase())).find(Boolean);
      if (image) covers[category.slug] = image;
    }
    return covers;
  } catch {
    return {};
  }
}

export async function getCleaverShowcase() {
  const featured = ["MSMINI10", "POWERPRO300", "CVS10DSYS", "MSMAXI10"];

  try {
    const rows = await sanityCdnClient.fetch<CleaverProduct[]>(`
      *[${CLEAVER_FILTER} && sku in $featured && defined(images[0].asset->url)] ${SHOWCASE_PROJECTION}
    `, { featured }, CLEAVER_CATALOG_CACHE);
    const bySku = new Map((Array.isArray(rows) ? rows : []).map((product) => [product.sku, product]));
    return featured.map((sku) => bySku.get(sku)).filter((product): product is CleaverProduct => Boolean(product));
  } catch {
    return [];
  }
}
