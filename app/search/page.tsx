import Link from "next/link";
import { redirect } from "next/navigation";

import { getAbmStagedRecord, stagedRecordPath } from "@/lib/abm/rebuild-staging";
import { sanityClient } from "@/lib/sanity/sanity.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type ProductMatch = {
  _id: string;
  title?: string;
  sku?: string;
  summary?: string;
  brandKey?: string;
  slug?: string;
  matchingVariant?: { sku?: string; catNo?: string };
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

const FIND_KEYWORD_PRODUCTS = `
*[
  _type=="product"
  && (!defined(isActive) || isActive==true)
  && (
    brandSlug in ["abm", "kent"]
    || brand->slug.current in ["abm", "kent"]
    || brand->themeKey in ["abm", "kent"]
  )
  && (
    title match $query
    || sku match $query
    || count(variants[
      title match $query
      || sku match $query
      || catNo match $query
    ]) > 0
  )
] | order(title asc)[0...20] {
  _id,
  title,
  sku,
  summary,
  "brandKey": coalesce(brandSlug, brand->themeKey, brand->slug.current),
  "slug": slug.current,
  "matchingVariant": variants[
    title match $query
    || sku match $query
    || catNo match $query
  ][0]{ sku, catNo }
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

function productHref(product: ProductMatch) {
  const brandKey = String(product.brandKey || "").toLowerCase();
  if (!product.slug) return "";
  if (brandKey === "kent") return `/products/kent/item/${encodeURIComponent(product.slug)}`;
  if (brandKey === "abm") return `/products/abm/item/${encodeURIComponent(product.slug)}`;
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

  if (!q) {
    return (
      <main className="mx-auto min-h-[55vh] max-w-4xl px-6 py-20 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-600">ITS BIO Search</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Search the product catalog</h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-500">
          Enter an ABM or Kent product name, catalog number, or service name in the search box above.
        </p>
      </main>
    );
  }

  const catalogNumber = normalizeCatalogNumber(q);
  if (isCatalogNumberCandidate(catalogNumber)) {
    const [exactDocs, stagedProduct, stagedService] = await Promise.all([
      sanityClient.fetch<ProductMatch[]>(FIND_EXACT_CATALOG_NUMBER, { catalogNumber }),
      getAbmStagedRecord("product", catalogNumber),
      getAbmStagedRecord("service", catalogNumber),
    ]);

    const exactHref = (Array.isArray(exactDocs) ? exactDocs : [])
      .map(productHref)
      .find(Boolean);
    if (exactHref) redirect(exactHref);
    if (stagedProduct) redirect(stagedRecordPath("product", stagedProduct));
    if (stagedService) redirect(stagedRecordPath("service", stagedService));
  }

  const keywordProducts = await sanityClient.fetch<ProductMatch[]>(FIND_KEYWORD_PRODUCTS, {
    query: `*${q}*`,
  });
  const products = (Array.isArray(keywordProducts) ? keywordProducts : []).filter((product) => productHref(product));

  return (
    <main className="bg-slate-50/70">
      <div className="mx-auto min-h-[58vh] max-w-5xl px-6 py-16 md:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-600">ITS BIO Search</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Search results</h1>
        <p className="mt-3 text-slate-600">
          Results for <span className="font-semibold text-slate-950">“{q}”</span> across ABM and Kent.
        </p>

        {products.length ? (
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {products.map((product) => {
              const href = productHref(product);
              const brandKey = String(product.brandKey || "").toLowerCase();
              const isKent = brandKey === "kent";
              const catalog = product.matchingVariant?.catNo || product.matchingVariant?.sku || product.sku;
              return (
                <Link
                  key={product._id}
                  href={href}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
                >
                  <p className={`text-xs font-bold uppercase tracking-[0.16em] ${isKent ? "text-blue-600" : "text-orange-600"}`}>
                    {isKent ? "KENT" : "ABM"}
                  </p>
                  <h2 className="mt-3 text-lg font-semibold leading-7 text-slate-950 group-hover:text-orange-600">
                    {product.title}
                  </h2>
                  {catalog && (
                    <p className="mt-2 text-sm text-slate-600">
                      {isKent ? "Item #" : "Cat. No."} <span className="font-semibold text-slate-900">{catalog}</span>
                    </p>
                  )}
                  {product.summary && <p className="mt-3 text-sm leading-6 text-slate-500">{product.summary}</p>}
                  <span className="mt-5 inline-flex text-sm font-semibold text-slate-900 group-hover:text-orange-600">
                    View details&nbsp;→
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <section className="mt-10 rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-2xl text-orange-600">?</div>
            <h2 className="mt-5 text-2xl font-semibold text-slate-950">No matching product found</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
              Check the catalog number, spacing, or hyphens, or try searching with the product name.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/products/abm" className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:border-orange-300 hover:text-orange-600">
                Browse ABM
              </Link>
              <Link href="/products/kent" className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:border-blue-300 hover:text-blue-700">
                Browse Kent
              </Link>
              <Link href="/contact" className="rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700">
                Contact us
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
