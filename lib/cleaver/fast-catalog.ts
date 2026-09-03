import sourceMap from "@/data/cleaver-source-map.json";
import {
  CLEAVER_CATEGORIES,
  CLEAVER_INVENTORY,
  CLEAVER_PAGE_SIZE,
  type CleaverProduct,
} from "@/lib/cleaver/catalog";
import { getVerifiedCleaverSourceFixture } from "@/lib/cleaver/source-fixtures";
import { sanityCdnClient } from "@/lib/sanity/sanity.client";

type SourceIdentity = {
  sourceTitle?: string;
  sourceUrl?: string;
  sourceSlug?: string;
  images?: string[];
};

type ProductPage = {
  products: CleaverProduct[];
  total: number;
  page: number;
  pageCount: number;
};

type ManagedImageRow = {
  sku?: string;
  images?: string[];
};

const SOURCE_MAP = sourceMap as Record<string, SourceIdentity>;
const IMAGE_CACHE = { next: { revalidate: 86400 } } as const;
const CLEAVER_FILTER = `
  _type == "product"
  && (!defined(isActive) || isActive == true)
  && (
    brandSlug in ["cleaver", "cleaverscientific"]
    || brand->slug.current in ["cleaver", "cleaverscientific"]
    || brand->themeKey in ["cleaver", "cleaverscientific"]
  )
`;

function normalizedSku(value?: string) {
  return String(value || "").normalize("NFKC").trim().toUpperCase();
}

function sourceIdentityForSku(sku?: string) {
  return SOURCE_MAP[normalizedSku(sku)] || null;
}

function uniqueUrls(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function sanityImages(values?: string[]) {
  return uniqueUrls(values || []).filter((value) => {
    try {
      return new URL(value).hostname === "cdn.sanity.io";
    } catch {
      return false;
    }
  });
}

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

function fastProduct(localProduct: CleaverProduct): CleaverProduct {
  const identity = sourceIdentityForSku(localProduct.sku);
  const fixture = getVerifiedCleaverSourceFixture(localProduct.sku || "") as Partial<CleaverProduct> | null;
  const manufacturerImages = uniqueUrls(identity?.images || []);
  const sourceTitle = String(
    identity?.sourceTitle || fixture?.cleaverSourceTitle || fixture?.title || localProduct.cleaverSourceTitle || localProduct.title,
  ).trim();

  return {
    ...localProduct,
    ...(fixture || {}),
    _id: localProduct._id,
    sku: localProduct.sku,
    // Use the manufacturer slug directly so product cards do not incur a
    // second request through the local-SKU route before canonical redirect.
    slug: identity?.sourceSlug || localProduct.slug,
    order: localProduct.order,
    categoryPath: localProduct.categoryPath,
    categoryPathTitles: localProduct.categoryPathTitles,
    title: sourceTitle || localProduct.title,
    cleaverSourceTitle: sourceTitle || localProduct.cleaverSourceTitle,
    sourceUrl: fixture?.sourceUrl || identity?.sourceUrl || localProduct.sourceUrl,
    image: manufacturerImages[0] || fixture?.image || localProduct.image,
    images: manufacturerImages.length ? manufacturerImages : fixture?.images || localProduct.images,
  };
}

function groupedProducts(products: CleaverProduct[]) {
  const grouped = new Map<string, CleaverProduct>();

  for (const product of products) {
    const sourceKey = normalizedSourceUrl(product.sourceUrl);
    const titleKey = String(product.cleaverSourceTitle || product.title).trim().toLowerCase();
    const key = sourceKey ? `source:${sourceKey}` : `title:${titleKey}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, product);
      continue;
    }

    const existingOrder = Number.isFinite(existing.order) ? existing.order : Number.MAX_SAFE_INTEGER;
    const candidateOrder = Number.isFinite(product.order) ? product.order : Number.MAX_SAFE_INTEGER;
    if ((!existing.image && product.image) || candidateOrder < existingOrder) {
      grouped.set(key, { ...product, image: product.image || existing.image, images: product.images?.length ? product.images : existing.images });
    }
  }

  return Array.from(grouped.values()).sort(
    (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.title.localeCompare(b.title),
  );
}

async function managedImagesBySku(skus: string[]) {
  const normalized = Array.from(new Set(skus.map(normalizedSku).filter(Boolean)));
  if (!normalized.length) return new Map<string, string[]>();

  try {
    const rows = await sanityCdnClient.fetch<ManagedImageRow[]>(`
      *[
        ${CLEAVER_FILTER}
        && upper(sku) in $skus
        && defined(images[0].asset->url)
      ]{
        sku,
        "images": images[defined(asset->url)][].asset->url
      }
    `, { skus: normalized }, IMAGE_CACHE);

    const result = new Map<string, string[]>();
    for (const row of Array.isArray(rows) ? rows : []) {
      const sku = normalizedSku(row.sku);
      const images = sanityImages(row.images);
      if (sku && images.length && !result.has(sku)) result.set(sku, images);
    }
    return result;
  } catch (error) {
    console.error("Unable to load Cleaver managed card images:", error instanceof Error ? error.message : error);
    return new Map<string, string[]>();
  }
}

function applyManagedImages(product: CleaverProduct, managed: Map<string, string[]>) {
  const images = managed.get(normalizedSku(product.sku));
  if (!images?.length) return product;
  return { ...product, image: images[0], images };
}

export async function getFastCleaverProductPage(path: string[], query: string, requestedPage = 1): Promise<ProductPage> {
  const needle = query.normalize("NFKC").trim().toLowerCase();
  const matches = CLEAVER_INVENTORY
    .filter((product) => path.every((segment, index) => product.categoryPath[index] === segment))
    .map(fastProduct)
    .filter((product) => {
      if (!needle) return true;
      return [product.title, product.cleaverSourceTitle, product.sku]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });

  const grouped = groupedProducts(matches);
  const pageCount = Math.max(1, Math.ceil(grouped.length / CLEAVER_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (page - 1) * CLEAVER_PAGE_SIZE;
  const products = grouped.slice(start, start + CLEAVER_PAGE_SIZE);
  const managed = await managedImagesBySku(products.map((product) => product.sku));

  return {
    products: products.map((product) => applyManagedImages(product, managed)),
    total: grouped.length,
    page,
    pageCount,
  };
}

export async function getFastCleaverCategoryCovers() {
  const representativeProducts = CLEAVER_CATEGORIES.map((category) =>
    CLEAVER_INVENTORY.find((product) => product.categoryPath[0] === category.slug),
  ).filter((product): product is CleaverProduct => Boolean(product));
  const managed = await managedImagesBySku(representativeProducts.map((product) => product.sku));
  const covers: Record<string, string> = {};

  for (const category of CLEAVER_CATEGORIES) {
    const localProduct = representativeProducts.find((product) => product.categoryPath[0] === category.slug);
    if (!localProduct) continue;
    const product = applyManagedImages(fastProduct(localProduct), managed);
    if (product.image) covers[category.slug] = product.image;
  }

  return covers;
}
