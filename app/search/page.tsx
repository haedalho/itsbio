import Link from "next/link";
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

  return (
    <main className="bg-slate-50/70">
      <div className="mx-auto flex min-h-[58vh] max-w-5xl items-center justify-center px-6 py-16 md:py-20">
        <section className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center shadow-[0_20px_60px_rgba(15,23,42,0.07)] md:px-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-2xl font-semibold text-orange-600">
            ?
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-orange-600">ITS BIO Search</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">No matching product found</h1>
          <p className="mt-4 text-slate-600">
            No ABM or Kent product matched <span className="font-semibold text-slate-950">“{q}”</span>.
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
            Check the catalog number, spacing, or hyphens, or try searching with the product name.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/products/abm"
              className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-orange-300 hover:text-orange-600"
            >
              Browse ABM
            </Link>
            <Link
              href="/products/kent"
              className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-blue-300 hover:text-blue-700"
            >
              Browse Kent
            </Link>
            <Link
              href="/contact"
              className="rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700"
            >
              Contact us
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
