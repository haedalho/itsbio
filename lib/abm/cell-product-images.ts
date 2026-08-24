import { isManagedAbmImageUrl } from "@/lib/abm/rebuild-staging";
import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";

const CELL_PRODUCT_IMAGES_QUERY = `*[
  _type == "product"
  && migrationKey == "abm-cell-products-2026-08-20"
  && lower(sku) in $skus
]{
  sku,
  "assetUrls": images[].asset->url,
  imageUrls
}`;

type CellProductImageRecord = {
  sku?: string;
  assetUrls?: string[];
  imageUrls?: string[];
};

type CellProductWithOptionalPreview = {
  sku?: string;
  previewImage?: string;
};

/** Attach existing Sanity-managed product thumbnails with one query per visible page. */
export async function withManagedAbmCellProductImages<T extends CellProductWithOptionalPreview>(products: T[]) {
  const skus = Array.from(new Set(products
    .map((product) => String(product.sku || "").trim().toLowerCase())
    .filter(Boolean)));

  if (!skus.length) return products;

  const records = await sanityCdnClient.fetch<CellProductImageRecord[]>(
    CELL_PRODUCT_IMAGES_QUERY,
    { skus },
    PUBLIC_CATALOG_CACHE,
  );
  const previewsBySku = new Map<string, string>();

  for (const record of records || []) {
    const previewImage = [...(record.assetUrls || []), ...(record.imageUrls || [])]
      .find((url) => isManagedAbmImageUrl(url));
    if (previewImage) previewsBySku.set(String(record.sku || "").trim().toLowerCase(), previewImage);
  }

  return products.map((product) => {
    const managedPreview = isManagedAbmImageUrl(product.previewImage)
      ? product.previewImage
      : previewsBySku.get(String(product.sku || "").trim().toLowerCase());

    return managedPreview ? { ...product, previewImage: managedPreview } : product;
  });
}
