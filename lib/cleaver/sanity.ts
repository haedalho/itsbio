import { cache } from "react";

import {
  CLEAVER_INVENTORY,
  CLEAVER_PAGE_SIZE,
  cleaverCategoryTitles,
  findLocalCleaverProduct,
  type CleaverProduct,
} from "@/lib/cleaver/catalog";
import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";

const CLEAVER_FILTER = `
  _type == "product"
  && (!defined(isActive) || isActive == true)
  && (
    brandSlug in ["cleaver", "cleaverscientific"]
    || brand->slug.current in ["cleaver", "cleaverscientific"]
    || brand->themeKey in ["cleaver", "cleaverscientific"]
  )
`;

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
  docs[]{title, label, url}
}`;

type ProductPage = {
  products: CleaverProduct[];
  total: number;
  page: number;
  pageCount: number;
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

export async function getCleaverProductPage(path: string[], query: string, requestedPage = 1): Promise<ProductPage> {
  const page = Math.max(1, requestedPage);
  const start = (page - 1) * CLEAVER_PAGE_SIZE;
  const category = path.join("/");
  const match = `*${query.replace(/\*/g, "").trim()}*`;

  try {
    const result = await sanityCdnClient.fetch<{ products?: CleaverProduct[]; total?: number }>(`
      {
        "total": count(*[
          ${CLEAVER_FILTER}
          && ($category == "" || $category in listingPaths)
          && ($searchTerm == "" || title match $match || sku match $match)
        ]),
        "products": *[
          ${CLEAVER_FILTER}
          && ($category == "" || $category in listingPaths)
          && ($searchTerm == "" || title match $match || sku match $match)
        ] | order(order asc, title asc)[$start...$end] ${PRODUCT_PROJECTION}
      }
    `, { category, searchTerm: query, match, start, end: start + CLEAVER_PAGE_SIZE }, PUBLIC_CATALOG_CACHE);

    const total = Number(result?.total || 0);
    if (total > 0) {
      return {
        products: Array.isArray(result.products) ? result.products : [],
        total,
        page,
        pageCount: Math.max(1, Math.ceil(total / CLEAVER_PAGE_SIZE)),
      };
    }
  } catch (error) {
    console.error("Unable to load Cleaver catalog from Sanity:", error instanceof Error ? error.message : error);
  }

  return localProductPage(path, query, requestedPage);
}

export const getCleaverProduct = cache(async (slugOrSku: string): Promise<CleaverProduct | null> => {
  const local = findLocalCleaverProduct(slugOrSku);

  try {
    const product = await sanityCdnClient.fetch<CleaverProduct | null>(`
      *[${CLEAVER_FILTER} && (slug.current == $slug || lower(sku) == lower($slug))][0] ${PRODUCT_PROJECTION}
    `, { slug: decodeURIComponent(slugOrSku) }, PUBLIC_CATALOG_CACHE);
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

export async function getCleaverCategoryCovers() {
  try {
    const rows = await sanityCdnClient.fetch<Array<{ category?: string; image?: string }>>(`
      *[${CLEAVER_FILTER} && defined(images[0].asset->url)] | order(order asc)[0...500]{
        "category": categoryPath[0],
        "image": images[0].asset->url
      }
    `, {}, PUBLIC_CATALOG_CACHE);
    const covers: Record<string, string> = {};
    for (const row of Array.isArray(rows) ? rows : []) {
      if (row.category && row.image && !covers[row.category]) covers[row.category] = row.image;
    }
    return covers;
  } catch {
    return {};
  }
}
