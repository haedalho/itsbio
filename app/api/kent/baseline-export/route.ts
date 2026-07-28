import { NextResponse } from "next/server";

import { sanityClient } from "@/lib/sanity/sanity.client";

export const dynamic = "force-dynamic";

const QUERY = `
*[
  _type == "product"
  && (
    brandSlug == "kent"
    || themeKey == "kent"
    || brand->slug.current == "kent"
    || brand->themeKey == "kent"
  )
] | order(lower(title) asc) {
  _id,
  title,
  "slug": slug.current,
  sku,
  sourceUrl,
  summary,
  categoryPath,
  categoryPathTitles,
  listingPaths,
  productType,
  isActive,
  defaultVariantId,
  "galleryAssetCount": count(images[defined(asset)]),
  "galleryImageUrlCount": count(galleryImageUrls),
  "rawImageUrlCount": count(imageUrls),
  "sectionCount": count(kentSections),
  "variantCount": count(variants),
  "optionGroupCount": count(optionGroups)
}
`;

function classify(row: Record<string, unknown>) {
  const text = `${String(row.title || "")} ${String(row.slug || "")} ${String(row.sourceUrl || "")}`.toLowerCase();
  if (/warranty|extended warranty|premium warranty/.test(text)) return "EXCLUDE_WARRANTY";
  if (/service|certification|calibration|repair/.test(text)) return "REVIEW_SERVICE";
  return "PRODUCT";
}

export async function GET() {
  const client = (sanityClient as any).withConfig?.({ useCdn: false }) ?? sanityClient;
  const rows = await client.fetch(QUERY);
  const products = (Array.isArray(rows) ? rows : []).map((row, index) => ({
    index: index + 1,
    ...row,
    recordType: classify(row),
    verificationStatus: "UNVERIFIED",
    officialTitle: "",
    officialSubtitle: "",
    officialSku: "",
    officialSourceUrl: "",
    officialGalleryCount: null,
    officialSectionCount: null,
    verifiedAt: "",
    notes: "",
  }));

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      source: "sanity-kent-products",
      total: products.length,
      counts: {
        product: products.filter((row) => row.recordType === "PRODUCT").length,
        warranty: products.filter((row) => row.recordType === "EXCLUDE_WARRANTY").length,
        serviceReview: products.filter((row) => row.recordType === "REVIEW_SERVICE").length,
      },
      products,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
