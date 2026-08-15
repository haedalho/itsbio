import { redirect } from "next/navigation";

import { sanityClient } from "@/lib/sanity/sanity.client";
import { getAbmStagedRecord, stagedRecordPath } from "@/lib/abm/rebuild-staging";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const BRAND_KEY = "abm";

type ExactCatalogMatch = {
  _id: string;
  brandKey?: string;
  slug?: string;
};

const FIND_EXACT_CATALOG_NUMBER = `
*[
  _type=="product"
  && (!defined(isActive) || isActive==true)
  && (
    brandSlug in ["abm", "kent"]
    || brand->slug.current in ["abm", "kent"]
    || brand->themeKey in ["abm", "kent"]
  )
  && (
    lower(sku) == lower($catalogNumber)
    || count(variants[
      lower(sku) == lower($catalogNumber)
      || lower(catNo) == lower($catalogNumber)
    ]) > 0
  )
] | order(_updatedAt desc)[0...4] {
  _id,
  "brandKey": coalesce(brandSlug, brand->themeKey, brand->slug.current),
  "slug": slug.current
}
`;

const FIND_ABM_BY_TITLE = `
*[
  _type=="product"
  && isActive==true
  && (brand->slug.current == $brandKey || brand->themeKey == $brandKey)
  && title match $q
] | order(_updatedAt desc)[0] {
  "slug": slug.current,
  categoryPath
}
`;

function normalizeCatalogNumber(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[‐‑‒–—―−]/g, "-")
    .trim();
}

function isCatalogNumberCandidate(value: string) {
  return (
    value.length >= 2
    && value.length <= 64
    && /\d/.test(value)
    && !/\s/.test(value)
    && /^[A-Za-z0-9._/+()-]+$/.test(value)
  );
}

function categoryHref(categoryPath: string[]) {
  if (!categoryPath?.length) return `/products/${BRAND_KEY}`;
  return `/products/${BRAND_KEY}/${categoryPath.join("/")}`;
}

function exactCatalogHref(doc: ExactCatalogMatch) {
  const brandKey = String(doc.brandKey || "").toLowerCase();
  if (!doc.slug) return "";
  if (brandKey === "kent") return `/products/kent/item/${encodeURIComponent(doc.slug)}`;
  if (brandKey === "abm") return `/products/abm/item/${encodeURIComponent(doc.slug)}`;
  return "";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }> | { q?: string };
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const qRaw = (resolvedSearchParams?.q || "").trim();
  const q = qRaw.replace(/\s+/g, " ").trim();

  if (!q) redirect("/products");

  const catalogNumber = normalizeCatalogNumber(q);
  if (isCatalogNumberCandidate(catalogNumber)) {
    const [exactDocs, stagedProduct, stagedService] = await Promise.all([
      sanityClient.fetch<ExactCatalogMatch[]>(FIND_EXACT_CATALOG_NUMBER, { catalogNumber }),
      getAbmStagedRecord("product", catalogNumber),
      getAbmStagedRecord("service", catalogNumber),
    ]);

    const exactHref = (Array.isArray(exactDocs) ? exactDocs : [])
      .map(exactCatalogHref)
      .find(Boolean);
    if (exactHref) redirect(exactHref);
    if (stagedProduct) redirect(stagedRecordPath("product", stagedProduct));
    if (stagedService) redirect(stagedRecordPath("service", stagedService));
  }

  const doc = await sanityClient.fetch(FIND_ABM_BY_TITLE, {
    brandKey: BRAND_KEY,
    q: `*${q}*`,
  });
  if (doc?.slug) {
    const href = categoryHref(doc.categoryPath || []);
    redirect(`${href}?open=${encodeURIComponent(doc.slug)}`);
  }

  redirect("/products");
}
