import { NextResponse } from "next/server";

import { sanityClient } from "@/lib/sanity/sanity.client";

export const dynamic = "force-dynamic";

const BRAND_KEY = "kent";
const CACHE_MS = 5 * 60 * 1000;

type Target = {
  key?: string;
  type?: "product" | "category";
  value?: string;
};

type ProductImageRow = {
  slug?: string;
  categoryPath?: string[];
  listingPaths?: string[];
  assetUrls?: string[];
  imageUrls?: string[];
  variants?: Array<{ imageUrl?: string }>;
};

let productCache: { fetchedAt: number; rows: ProductImageRow[] } | null = null;

const PRODUCT_IMAGE_QUERY = `
*[
  _type == "product"
  && (!defined(isActive) || isActive == true)
  && (
    brandSlug == $brandKey
    || brand->slug.current == $brandKey
    || brand->themeKey == $brandKey
  )
][0...500]{
  "slug": slug.current,
  categoryPath,
  listingPaths,
  imageUrls,
  "assetUrls": images[].asset->url,
  variants[]{ imageUrl }
}
`;

function cleanPath(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/")
    .toLowerCase();
}

function normalizeImageUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `https://www.kentscientific.com${raw}`;
  return raw;
}

function imageCandidates(row: ProductImageRow) {
  const ordered = [
    ...(Array.isArray(row.assetUrls) ? row.assetUrls : []),
    ...(Array.isArray(row.imageUrls) ? row.imageUrls : []),
    ...(Array.isArray(row.variants) ? row.variants.map((variant) => variant?.imageUrl) : []),
  ]
    .map(normalizeImageUrl)
    .filter(Boolean);

  return [...new Set(ordered)];
}

async function getProducts() {
  const now = Date.now();
  if (productCache && now - productCache.fetchedAt < CACHE_MS) return productCache.rows;

  const client = (sanityClient as any).withConfig?.({ useCdn: true }) ?? sanityClient;
  const rows = (await client.fetch(PRODUCT_IMAGE_QUERY, { brandKey: BRAND_KEY })) as ProductImageRow[];
  productCache = { fetchedAt: now, rows: Array.isArray(rows) ? rows : [] };
  return productCache.rows;
}

export async function POST(request: Request) {
  let body: { targets?: Target[] } = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ images: {} }, { status: 400 });
  }

  const targets = (Array.isArray(body.targets) ? body.targets : [])
    .slice(0, 80)
    .map((target) => ({
      key: String(target?.key || "").trim(),
      type: target?.type === "category" ? "category" as const : "product" as const,
      value: cleanPath(target?.value),
    }))
    .filter((target) => target.key && target.value);

  if (!targets.length) return NextResponse.json({ images: {} });

  const products = await getProducts();
  const images: Record<string, string[]> = {};

  for (const target of targets) {
    let matched: ProductImageRow | undefined;

    if (target.type === "product") {
      matched = products.find((product) => cleanPath(product.slug) === target.value);
    } else {
      matched = products.find((product) => {
        const categoryPath = cleanPath(Array.isArray(product.categoryPath) ? product.categoryPath.join("/") : "");
        const listingPaths = (Array.isArray(product.listingPaths) ? product.listingPaths : []).map(cleanPath);
        return categoryPath === target.value || listingPaths.includes(target.value);
      });
    }

    images[target.key] = matched ? imageCandidates(matched) : [];
  }

  return NextResponse.json({ images });
}
