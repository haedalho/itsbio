import { NextRequest, NextResponse } from "next/server";

import { sanityCdnClient } from "@/lib/sanity/sanity.client";

type ManagedImageRow = {
  sku?: string;
  images?: string[];
};

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

function normalizeSku(value?: string) {
  return String(value || "").normalize("NFKC").trim().toUpperCase();
}

function sanityImages(values?: string[]) {
  return Array.from(new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))).filter((value) => {
    try {
      return new URL(value).hostname === "cdn.sanity.io";
    } catch {
      return false;
    }
  });
}

export async function GET(request: NextRequest) {
  const requested = String(request.nextUrl.searchParams.get("skus") || "")
    .split(",")
    .map((value) => value.normalize("NFKC").trim())
    .filter(Boolean)
    .slice(0, 48);

  const normalized = Array.from(new Set(requested.map(normalizeSku).filter(Boolean)));
  if (!normalized.length) {
    return NextResponse.json({ images: {} }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  }

  const querySkus = Array.from(new Set(requested.flatMap((sku) => [sku, sku.toUpperCase(), sku.toLowerCase()])));

  try {
    const rows = await sanityCdnClient.fetch<ManagedImageRow[]>(`
      *[
        ${CLEAVER_FILTER}
        && sku in $skus
        && defined(images[0].asset->url)
      ][0...100]{
        sku,
        "images": images[defined(asset->url)][].asset->url
      }
    `, { skus: querySkus }, IMAGE_CACHE);

    const images: Record<string, string[]> = {};
    for (const row of Array.isArray(rows) ? rows : []) {
      const sku = normalizeSku(row.sku);
      const urls = sanityImages(row.images);
      if (sku && urls.length && !images[sku]) images[sku] = urls;
    }

    return NextResponse.json(
      { images },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (error) {
    console.error("Unable to load Cleaver managed card image fallback:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { images: {} },
      { status: 200, headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
    );
  }
}
