import { cache } from "react";

import {
  CLEAVER_INVENTORY,
  CLEAVER_PAGE_SIZE,
  cleaverCategoryTitles,
  findLocalCleaverProduct,
  type CleaverProduct,
} from "@/lib/cleaver/catalog";
import { getVerifiedCleaverSourceFixture } from "@/lib/cleaver/source-fixtures";
import { sanityCdnClient } from "@/lib/sanity/sanity.client";

const CLEAVER_CATALOG_CACHE = { next: { revalidate: 30 } } as const;

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
  highlights,
  specRows[]{label, value},
  docs[]{title, label, group, url},
  cleaverSourceTitle,
  cleaverAtAGlance,
  cleaverSpecificationMatrix{
    headers,
    rows[]{label, values}
  },
  cleaverIncludedItems[]{title, quantity, sourceUrl, imageUrl},
  cleaverVariations[]{title, sku, packSize, priceText, imageUrl, internalHref},
  cleaverAccessories[]{title, sku, packSize, priceText, sourceUrl, imageUrl, internalHref},
  cleaverVideos[]{title, url, embedUrl},
  cleaverSourceSectionsMigratedAt
}`;

const LISTING_PROJECTION = `{
  _id,
  title,
  sku,
  order,
  sourceUrl,
  categoryPath,
  categoryPathTitles,
  "slug": slug.current,
  "image": images[defined(asset->url)][0].asset->url,
  cleaverSourceTitle
}`;

type ProductPage = {
  products: CleaverProduct[];
  total: number;
  page: number;
  pageCount: number;
};

function normalizedSourceUrl(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return value.trim().toLowerCase().replace(/\/+$/, "");
  }
}

function manufacturerProductSlugFromUrl(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const productIndex = parts.findIndex((part) => part.toLowerCase() === "product");
    return productIndex >= 0 && parts[productIndex + 1] ? decodeURIComponent(parts[productIndex + 1]) : "";
  } catch {
    return "";
  }
}

function findFixtureBackedProductBySourceSlug(value: string): CleaverProduct | null {
  const normalized = decodeURIComponent(value).trim().toLowerCase();
  if (!normalized) return null;

  for (const localProduct of CLEAVER_INVENTORY) {
    const fixture = getVerifiedCleaverSourceFixture(localProduct.sku);
    if (!fixture?.sourceUrl) continue;
    const sourceSlug = manufacturerProductSlugFromUrl(fixture.sourceUrl).trim().toLowerCase();
    if (sourceSlug !== normalized) continue;
    return { ...localProduct, ...fixture } as CleaverProduct;
  }

  return null;
}

function manufacturerListingProduct(product: CleaverProduct) {
  const sourceTitle = product.cleaverSourceTitle?.trim();
  const sourceSlug = sourceTitle && product.sourceUrl ? manufacturerProductSlugFromUrl(product.sourceUrl) : "";
  if (!sourceTitle) return product;
  return {
    ...product,
    title: sourceTitle,
    slug: sourceSlug || product.slug,
  };
}

function groupManufacturerProducts(products: CleaverProduct[]) {
  const grouped = new Map<string, CleaverProduct>();

  for (const rawProduct of products) {
    const product = manufacturerListingProduct(rawProduct);
    const sourceKey = product.cleaverSourceTitle?.trim() && product.sourceUrl ? normalizedSourceUrl(product.sourceUrl) : "";
    const key = sourceKey ? `source:${sourceKey}` : `item:${product._id || product.slug || product.sku}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, product);
      continue;
    }

    const existingHasImage = Boolean(existing.image);
    const candidateHasImage = Boolean(product.image);
    const existingOrder = Number.isFinite(existing.order) ? existing.order : Number.MAX_SAFE_INTEGER;
    const candidateOrder = Number.isFinite(product.order) ? product.order : Number.MAX_SAFE_INTEGER;

    if ((!existingHasImage && candidateHasImage) || candidateOrder < existingOrder) {
      grouped.set(key, { ...product, image: product.image || existing.image });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title));
}

function localProductPage(path: string[], query: string, requestedPage: number): ProductPage {
  const needle = query.trim().toLowerCase();
  const matches = CLEAVER_INVENTORY
    .map((product) => {
      const fixture = getVerifiedCleaverSourceFixture(product.sku);
      return fixture ? ({ ...product, ...fixture } as CleaverProduct) : product;
    })
    .filter((product) => {
      const inCategory = path.every((segment, index) => product.categoryPath[index] === segment);
      const displayTitle = product.cleaverSourceTitle || product.title;
      const matchesQuery = !needle || displayTitle.toLowerCase().includes(needle) || product.title.toLowerCase().includes(needle) || product.sku.toLowerCase().includes(needle);
      return inCategory && matchesQuery;
    });
  const grouped = groupManufacturerProducts(matches);
  const pageCount = Math.max(1, Math.ceil(grouped.length / CLEAVER_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (page - 1) * CLEAVER_PAGE_SIZE;
  return { products: grouped.slice(start, start + CLEAVER_PAGE_SIZE), total: grouped.length, page, pageCount };
}

export async function getCleaverProductPage(path: string[], query: string, requestedPage = 1): Promise<ProductPage> {
  const category = path.join("/");
  const match = `*${query.replace(/\*/g, "").trim()}*`;

  try {
    const rows = await sanityCdnClient.fetch<CleaverProduct[]>(`
      *[
        ${CLEAVER_FILTER}
        && ($category == "" || $category in listingPaths)
        && ($searchTerm == "" || title match $match || sku match $match || cleaverSourceTitle match $match)
      ] | order(order asc, title asc)[0...5000] ${LISTING_PROJECTION}
    `, { category, searchTerm: query, match }, CLEAVER_CATALOG_CACHE);

    const grouped = groupManufacturerProducts(Array.isArray(rows) ? rows : []);
    if (grouped.length) {
      const pageCount = Math.max(1, Math.ceil(grouped.length / CLEAVER_PAGE_SIZE));
      const page = Math.min(Math.max(1, requestedPage), pageCount);
      const start = (page - 1) * CLEAVER_PAGE_SIZE;
      return {
        products: grouped.slice(start, start + CLEAVER_PAGE_SIZE),
        total: grouped.length,
        page,
        pageCount,
      };
    }
  } catch (error) {
    console.error("Unable to load Cleaver catalog from Sanity:", error instanceof Error ? error.message : error);
  }

  return localProductPage(path, query, requestedPage);
}

function manufacturerSourceUrls(slugOrSku: string) {
  const value = decodeURIComponent(slugOrSku).trim().replace(/^\/+|\/+$/g, "");
  if (!value || value.includes("/")) return [];
  return [
    `https://www.thistlescientific.com/product/${value}/`,
    `https://www.thistlescientific.com/product/${value}`,
    `https://thistlescientific.com/product/${value}/`,
    `https://thistlescientific.com/product/${value}`,
    `http://www.thistlescientific.com/product/${value}/`,
    `http://www.thistlescientific.com/product/${value}`,
  ];
}

export const getCleaverProduct = cache(async (slugOrSku: string): Promise<CleaverProduct | null> => {
  const decoded = decodeURIComponent(slugOrSku);
  const local = findLocalCleaverProduct(decoded);
  const fixtureBacked = local ? null : findFixtureBackedProductBySourceSlug(decoded);
  if (fixtureBacked) return fixtureBacked;
  const sourceUrls = manufacturerSourceUrls(decoded);

  try {
    const product = await sanityCdnClient.fetch<CleaverProduct | null>(`
      *[
        ${CLEAVER_FILTER}
        && (
          slug.current == $slug
          || lower(sku) == lower($slug)
          || sourceUrl in $sourceUrls
        )
      ] | order(sku asc, order asc)[0] ${PRODUCT_PROJECTION}
    `, { slug: decoded, sourceUrls }, CLEAVER_CATALOG_CACHE);
    if (product) {
      const productLocal = local || findLocalCleaverProduct(product.sku || "");
      const categoryPath = Array.isArray(product.categoryPath) && product.categoryPath.length ? product.categoryPath : productLocal?.categoryPath || [];
      const fixture = getVerifiedCleaverSourceFixture(product.sku || productLocal?.sku || "");
      return {
        ...productLocal,
        ...product,
        ...fixture,
        categoryPath,
        categoryPathTitles: product.categoryPathTitles?.length ? product.categoryPathTitles : cleaverCategoryTitles(categoryPath),
      };
    }
  } catch (error) {
    console.error("Unable to load Cleaver product from Sanity:", error instanceof Error ? error.message : error);
  }

  if (!local) return null;
  const fixture = getVerifiedCleaverSourceFixture(local.sku);
  return fixture ? { ...local, ...fixture } : local;
});

export async function getCleaverCategoryCovers() {
  try {
    const rows = await sanityCdnClient.fetch<Array<{ category?: string; image?: string }>>(`
      *[${CLEAVER_FILTER} && defined(images[0].asset->url)] | order(order asc)[0...500]{
        "category": categoryPath[0],
        "image": images[0].asset->url
      }
    `, {}, CLEAVER_CATALOG_CACHE);
    const covers: Record<string, string> = {};
    for (const row of Array.isArray(rows) ? rows : []) {
      if (row.category && row.image && !covers[row.category]) covers[row.category] = row.image;
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
      *[${CLEAVER_FILTER} && sku in $featured && defined(images[0].asset->url)] ${PRODUCT_PROJECTION}
    `, { featured }, CLEAVER_CATALOG_CACHE);
    const bySku = new Map((Array.isArray(rows) ? rows : []).map((product) => [product.sku, product]));
    return featured.map((sku) => bySku.get(sku)).filter((product): product is CleaverProduct => Boolean(product));
  } catch {
    return [];
  }
}
