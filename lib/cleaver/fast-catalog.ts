import sourceMap from "@/data/cleaver-source-map.json";
import {
  CLEAVER_CATEGORIES,
  CLEAVER_INVENTORY,
  CLEAVER_PAGE_SIZE,
  type CleaverProduct,
} from "@/lib/cleaver/catalog";
import { verifiedCleaverFamilyImages } from "@/lib/cleaver/source-fallbacks";
import { getVerifiedCleaverSourceFixture } from "@/lib/cleaver/source-fixtures";

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

const SOURCE_MAP = sourceMap as Record<string, SourceIdentity>;

function normalizedSku(value?: string) {
  return String(value || "").normalize("NFKC").trim().toUpperCase();
}

function sourceIdentityForSku(sku?: string) {
  return SOURCE_MAP[normalizedSku(sku)] || null;
}

function uniqueUrls(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
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
  const exactManufacturerImages = uniqueUrls(identity?.images || []);
  const sourceTitle = String(
    identity?.sourceTitle || fixture?.cleaverSourceTitle || fixture?.title || localProduct.cleaverSourceTitle || localProduct.title,
  ).trim();
  const familyImages = exactManufacturerImages.length
    ? []
    : verifiedCleaverFamilyImages(localProduct.sku, sourceTitle);
  const manufacturerImages = exactManufacturerImages.length ? exactManufacturerImages : familyImages;

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
      grouped.set(key, {
        ...product,
        image: product.image || existing.image,
        images: product.images?.length ? product.images : existing.images,
      });
    }
  }

  return Array.from(grouped.values()).sort(
    (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.title.localeCompare(b.title),
  );
}

/**
 * Category/list navigation must stay independent from Sanity and the
 * manufacturer site. All information required to choose and render the first
 * page is already in the checked-in Cleaver inventory/source map. This keeps
 * client navigation responsive even when an external service is cold/slow.
 */
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

  return {
    products: grouped.slice(start, start + CLEAVER_PAGE_SIZE),
    total: grouped.length,
    page,
    pageCount,
  };
}

export async function getFastCleaverCategoryCovers() {
  const covers: Record<string, string> = {};

  for (const category of CLEAVER_CATEGORIES) {
    const localProduct = CLEAVER_INVENTORY.find((product) => product.categoryPath[0] === category.slug);
    if (!localProduct) continue;
    const product = fastProduct(localProduct);
    if (product.image) covers[category.slug] = product.image;
  }

  return covers;
}
