import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getAbmStagedRecord,
  searchAbmStagedRecords,
  stagedRecordPath,
  type AbmStagedRecord,
} from "@/lib/abm/rebuild-staging";
import { sanityClient } from "@/lib/sanity/sanity.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type CatalogProduct = {
  _id: string;
  title?: string;
  sku?: string;
  summary?: string;
  brandKey?: string;
  slug?: string;
  matchingVariant?: { title?: string; sku?: string; catNo?: string };
};

type SearchResult = {
  id: string;
  brandKey: "abm" | "kent";
  kind: "product" | "service";
  title: string;
  catalogNumber?: string;
  summary?: string;
  href: string;
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
  title,
  sku,
  summary,
  "brandKey": coalesce(brandSlug, brand->themeKey, brand->slug.current),
  "slug": slug.current,
  "matchingVariant": variants[
    lower(sku) == lower($catalogNumber)
    || lower(catNo) == lower($catalogNumber)
  ][0]{ title, sku, catNo }
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
] | order(title asc)[0...24] {
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
  ][0]{ title, sku, catNo }
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

function productHref(product: CatalogProduct) {
  const brandKey = String(product.brandKey || "").toLowerCase();
  if (!product.slug) return "";
  if (brandKey === "kent") return `/products/kent/item/${encodeURIComponent(product.slug)}`;
  if (brandKey === "abm") return `/products/abm/item/${encodeURIComponent(product.slug)}`;
  return "";
}

function productResult(product: CatalogProduct): SearchResult | undefined {
  const brandKey = String(product.brandKey || "").toLowerCase();
  if (brandKey !== "abm" && brandKey !== "kent") return undefined;
  const href = productHref(product);
  if (!href || !product.title) return undefined;
  return {
    id: product._id,
    brandKey,
    kind: "product",
    title: product.title,
    catalogNumber: product.matchingVariant?.catNo || product.matchingVariant?.sku || product.sku,
    summary: product.summary,
    href,
  };
}

function stagedResult(record: AbmStagedRecord): SearchResult {
  return {
    id: `abm-${record.kind}-${record.sku || record.url}`,
    brandKey: "abm",
    kind: record.kind,
    title: record.title,
    catalogNumber: record.sku,
    summary: record.searchCategory || record.filterTitle,
    href: stagedRecordPath(record.kind, record),
  };
}

function dedupeResults(results: SearchResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = [result.brandKey, result.kind, result.catalogNumber || result.title]
      .join(":")
      .toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ResultSection({ brand, results }: { brand: "ABM" | "KENT"; results: SearchResult[] }) {
  if (!results.length) return null;
  const isKent = brand === "KENT";
  return (
    <section className="mt-10" aria-labelledby={`${brand.toLowerCase()}-results`}>
      <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.2em] ${isKent ? "text-blue-600" : "text-orange-600"}`}>
            {brand}
          </p>
          <h2 id={`${brand.toLowerCase()}-results`} className="mt-1 text-2xl font-semibold text-slate-950">
            {brand} results
          </h2>
        </div>
        <span className="text-sm text-slate-500">{results.length} found</span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {results.map((result) => (
          <Link
            key={result.id}
            href={result.href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <span className={`h-2 w-2 rounded-full ${isKent ? "bg-blue-600" : "bg-orange-500"}`} />
              {result.kind}
            </div>
            <h3 className="mt-3 text-lg font-semibold leading-7 text-slate-950 group-hover:text-orange-600">
              {result.title}
            </h3>
            {result.catalogNumber && (
              <p className="mt-2 text-sm text-slate-600">
                {isKent ? "Item #" : "Cat. No."} <span className="font-semibold text-slate-900">{result.catalogNumber}</span>
              </p>
            )}
            {result.summary && <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{result.summary}</p>}
            <span className="mt-5 inline-flex text-sm font-semibold text-slate-900 group-hover:text-orange-600">
              View details&nbsp;→
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
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
      sanityClient.fetch<CatalogProduct[]>(FIND_EXACT_CATALOG_NUMBER, { catalogNumber }),
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

  const [products, stagedProducts, stagedServices] = await Promise.all([
    sanityClient.fetch<CatalogProduct[]>(FIND_KEYWORD_PRODUCTS, { query: `*${q}*` }),
    searchAbmStagedRecords("product", q),
    searchAbmStagedRecords("service", q),
  ]);

  const results = dedupeResults([
    ...(Array.isArray(products) ? products : []).flatMap((product) => {
      const result = productResult(product);
      return result ? [result] : [];
    }),
    ...stagedProducts.map(stagedResult),
    ...stagedServices.map(stagedResult),
  ]);
  const kentResults = results.filter((result) => result.brandKey === "kent");
  const abmResults = results.filter((result) => result.brandKey === "abm");

  return (
    <main className="bg-slate-50/70">
      <div className="mx-auto min-h-[58vh] max-w-5xl px-6 py-16 md:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-600">ITS BIO Search</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Search results</h1>
        <p className="mt-3 text-slate-600">
          Results for <span className="font-semibold text-slate-950">“{q}”</span> across ABM and Kent.
        </p>

        {results.length ? (
          <>
            <ResultSection brand="KENT" results={kentResults} />
            <ResultSection brand="ABM" results={abmResults} />
          </>
        ) : (
          <section className="mt-10 rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-2xl text-orange-600">
              ?
            </div>
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
