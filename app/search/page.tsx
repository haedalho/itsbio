import Link from "next/link";
import { redirect } from "next/navigation";

import {
  ABM_REBUILD_VERSION,
  getAbmStagedRecord,
  stagedRecordPath,
  type AbmStagedRecord,
} from "@/lib/abm/rebuild-staging";
import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";

export const revalidate = 300;

type ExactCatalogMatch = {
  _id: string;
  brandKey?: string;
  slug?: string;
};

type LiveSearchRow = {
  _id: string;
  title?: string;
  slug?: string;
  sku?: string;
  shortDescription?: unknown;
  brandSlug?: string;
  brandName?: string;
  brand?: unknown;
  brandRefSlug?: string;
  brandTheme?: string;
  brandRefTitle?: string;
};

type StagedSearchChunk = {
  matches?: AbmStagedRecord[];
};

type SearchResult = {
  id: string;
  title: string;
  sku?: string;
  description?: string;
  brandKey: string;
  brandLabel: string;
  href: string;
  kind: "Product" | "Service";
  direct: boolean;
  score: number;
};

type SearchGroup = {
  key: string;
  label: string;
  items: SearchResult[];
};

const FIND_EXACT_CATALOG_NUMBER = `
*[
  _type == "product"
  && (!defined(isActive) || isActive == true)
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
] | order(_updatedAt desc)[0...6] {
  _id,
  "brandKey": coalesce(brandSlug, brand->themeKey, brand->slug.current),
  "slug": slug.current
}
`;

const LIVE_SEARCH_QUERY = `
*[
  _type == "product"
  && (!defined(isActive) || isActive == true)
  && (
    title match $match
    || sku match $match
    || count(variants[sku match $match || catNo match $match]) > 0
  )
] | order(_updatedAt desc)[0...80] {
  _id,
  title,
  "slug": slug.current,
  sku,
  shortDescription,
  brandSlug,
  brandName,
  brand,
  "brandRefSlug": brand->slug.current,
  "brandTheme": brand->themeKey,
  "brandRefTitle": brand->title
}
`;

const ABM_STAGED_SEARCH_QUERY = `
*[
  _type == "abmRebuildChunk"
  && version == $version
  && kind in ["product", "service"]
  && count(records[title match $match || sku match $match]) > 0
]{
  "matches": records[title match $match || sku match $match][0...8]
}
`;

const BRAND_ALIASES: Record<string, { key: string; label: string }> = {
  abm: { key: "abm", label: "ABM" },
  appliedbiologicalmaterials: { key: "abm", label: "ABM" },
  kent: { key: "kent", label: "Kent Scientific" },
  kentscientific: { key: "kent", label: "Kent Scientific" },
  kentscientifics: { key: "kent", label: "Kent Scientific" },
  itschem: { key: "itschem", label: "ITSChem" },
  aims: { key: "aims", label: "AIMS" },
  seedburo: { key: "seedburo", label: "SeedBuro" },
  bioplastics: { key: "bioplastics", label: "BIOplastics" },
  cleaverscientific: { key: "cleaverscientific", label: "Cleaver Scientific" },
  cellfreesciences: { key: "cellfreesciences", label: "CellFree Sciences" },
  plaslabs: { key: "plaslabs", label: "PLAS-LABS" },
  affinityimmuno: { key: "affinityimmuno", label: "Affinity Immuno" },
  dogen: { key: "dogen", label: "DoGen" },
};

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

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeBrandToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function brandIdentity(row: LiveSearchRow) {
  const rawKey = [row.brandSlug, row.brandRefSlug, row.brandTheme, row.brand]
    .map(stringValue)
    .find(Boolean) || "";
  const rawLabel = [row.brandRefTitle, row.brandName, row.brandSlug, row.brand]
    .map(stringValue)
    .find(Boolean) || rawKey;
  const normalized = normalizeBrandToken(rawKey || rawLabel);
  const alias = BRAND_ALIASES[normalized];
  if (alias) return alias;

  return {
    key: normalized || "other",
    label: rawLabel || "Other products",
  };
}

function exactCatalogHref(doc: ExactCatalogMatch) {
  const brandKey = normalizeBrandToken(String(doc.brandKey || ""));
  if (!doc.slug) return "";
  if (brandKey === "kent" || brandKey === "kentscientific" || brandKey === "kentscientifics") {
    return `/products/kent/item/${encodeURIComponent(doc.slug)}`;
  }
  if (brandKey === "abm" || brandKey === "appliedbiologicalmaterials") {
    return `/products/abm/item/${encodeURIComponent(doc.slug)}`;
  }
  return "";
}

function normalizeText(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

function scoreMatch(title: string, sku: string | undefined, query: string) {
  const q = normalizeText(query);
  const t = normalizeText(title);
  const s = normalizeText(sku || "");
  if (s && s === q) return 120;
  if (t === q) return 110;
  if (t.startsWith(q)) return 90;
  if (s.startsWith(q)) return 85;
  if (t.includes(q)) return 75;
  if (s.includes(q)) return 70;
  return 50;
}

function liveResultHref(row: LiveSearchRow, brandKey: string) {
  const slug = stringValue(row.slug);
  if (slug && brandKey === "abm") return { href: `/products/abm/item/${encodeURIComponent(slug)}`, direct: true };
  if (slug && brandKey === "kent") return { href: `/products/kent/item/${encodeURIComponent(slug)}`, direct: true };

  const title = stringValue(row.title);
  return {
    href: `/products?q=${encodeURIComponent(title)}#results`,
    direct: false,
  };
}

function makeSearchHref(query: string, brand?: string) {
  const params = new URLSearchParams({ q: query });
  if (brand) params.set("brand", brand);
  return `/search?${params.toString()}`;
}

function ResultCard({ result }: { result: SearchResult }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-orange-200 hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{result.kind}</span>
        {result.sku ? <span className="text-xs font-semibold text-slate-500">Catalog #: {result.sku}</span> : null}
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-7 text-slate-950">{result.title}</h3>
      {result.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{result.description}</p> : null}
      <div className="mt-5">
        <Link
          href={result.href}
          className="inline-flex items-center rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
        >
          {result.direct ? "View product" : "View matching products"}
        </Link>
      </div>
    </article>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; brand?: string }> | { q?: string; brand?: string };
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const qRaw = (resolvedSearchParams?.q || "").trim();
  const q = qRaw.replace(/\s+/g, " ").trim();
  const selectedBrand = normalizeBrandToken((resolvedSearchParams?.brand || "").trim());

  if (!q) redirect("/products");

  const catalogNumber = normalizeCatalogNumber(q);
  if (isCatalogNumberCandidate(catalogNumber)) {
    const [exactDocs, stagedProduct, stagedService] = await Promise.all([
      sanityCdnClient.fetch<ExactCatalogMatch[]>(FIND_EXACT_CATALOG_NUMBER, { catalogNumber }, PUBLIC_CATALOG_CACHE),
      getAbmStagedRecord("product", catalogNumber),
      getAbmStagedRecord("service", catalogNumber),
    ]);

    const exactTargets: string[] = [];
    const kentTargets = (Array.isArray(exactDocs) ? exactDocs : [])
      .filter((doc) => normalizeBrandToken(String(doc.brandKey || "")).startsWith("kent"))
      .map(exactCatalogHref)
      .filter(Boolean);
    exactTargets.push(...kentTargets);

    if (stagedProduct) exactTargets.push(stagedRecordPath("product", stagedProduct));
    if (stagedService) exactTargets.push(stagedRecordPath("service", stagedService));

    if (!stagedProduct && !stagedService) {
      exactTargets.push(
        ...(Array.isArray(exactDocs) ? exactDocs : [])
          .filter((doc) => normalizeBrandToken(String(doc.brandKey || "")) === "abm")
          .map(exactCatalogHref)
          .filter(Boolean),
      );
    }

    const uniqueTargets = [...new Set(exactTargets)];
    if (uniqueTargets.length === 1) redirect(uniqueTargets[0]);
  }

  const safeMatch = q.replace(/\*/g, "");
  const match = `*${safeMatch}*`;
  const [liveRows, stagedChunks] = await Promise.all([
    sanityCdnClient.fetch<LiveSearchRow[]>(LIVE_SEARCH_QUERY, { match }, PUBLIC_CATALOG_CACHE),
    sanityCdnClient.fetch<StagedSearchChunk[]>(
      ABM_STAGED_SEARCH_QUERY,
      { version: ABM_REBUILD_VERSION, match },
      PUBLIC_CATALOG_CACHE,
    ),
  ]);

  const results: SearchResult[] = [];

  for (const row of Array.isArray(liveRows) ? liveRows : []) {
    const title = stringValue(row.title);
    if (!title) continue;
    const sku = stringValue(row.sku) || undefined;
    const brand = brandIdentity(row);
    const target = liveResultHref(row, brand.key);
    results.push({
      id: row._id,
      title,
      sku,
      description: stringValue(row.shortDescription) || undefined,
      brandKey: brand.key,
      brandLabel: brand.label,
      href: target.href,
      kind: "Product",
      direct: target.direct,
      score: scoreMatch(title, sku, q),
    });
  }

  const stagedRows = (Array.isArray(stagedChunks) ? stagedChunks : [])
    .flatMap((chunk) => (Array.isArray(chunk?.matches) ? chunk.matches : []))
    .slice(0, 48);

  for (const row of stagedRows) {
    const title = stringValue(row.title);
    if (!title) continue;
    const sku = stringValue(row.sku) || undefined;
    results.push({
      id: `abm-staged:${row.kind}:${sku || row.url}`,
      title,
      sku,
      description: stringValue(row.previewSummary) || undefined,
      brandKey: "abm",
      brandLabel: "ABM",
      href: stagedRecordPath(row.kind, row),
      kind: row.kind === "service" ? "Service" : "Product",
      direct: true,
      score: scoreMatch(title, sku, q) + 2,
    });
  }

  const deduped = new Map<string, SearchResult>();
  for (const result of results.sort((a, b) => b.score - a.score)) {
    const key = `${result.brandKey}:${normalizeText(result.sku || result.title)}:${result.kind}`;
    const existing = deduped.get(key);
    if (!existing || result.score > existing.score || (result.direct && !existing.direct)) deduped.set(key, result);
  }

  const grouped = new Map<string, SearchGroup>();
  for (const result of [...deduped.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))) {
    const group = grouped.get(result.brandKey) || { key: result.brandKey, label: result.brandLabel, items: [] };
    group.items.push(result);
    grouped.set(result.brandKey, group);
  }

  const groups = [...grouped.values()].sort((a, b) => {
    const scoreDiff = (b.items[0]?.score || 0) - (a.items[0]?.score || 0);
    return scoreDiff || a.label.localeCompare(b.label);
  });
  const activeGroup = selectedBrand ? groups.find((group) => group.key === selectedBrand) : undefined;

  return (
    <main className="min-h-[calc(100vh-76px)] bg-slate-50/70 px-6 py-12 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-600">ITS BIO Search</p>
          <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Search results</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Results for <span className="font-semibold text-slate-950">“{q}”</span> are separated by brand so similar product names do not send you to the wrong catalog.
              </p>
            </div>
            <form action="/search" method="get" className="flex w-full max-w-xl gap-2">
              <input
                name="q"
                defaultValue={q}
                aria-label="Search by product name or catalog number"
                className="h-11 min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-5 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                placeholder="Product name or catalog number"
              />
              <button className="h-11 shrink-0 rounded-full bg-orange-600 px-6 text-sm font-semibold text-white transition hover:bg-orange-700">
                Search
              </button>
            </form>
          </div>
        </div>

        {groups.length ? (
          <>
            <nav className="mt-6 flex gap-2 overflow-x-auto pb-2" aria-label="Search result brands">
              <Link
                href={makeSearchHref(q)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  !selectedBrand
                    ? "border-orange-600 bg-orange-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-700"
                }`}
              >
                All brands
              </Link>
              {groups.map((group) => (
                <Link
                  key={group.key}
                  href={makeSearchHref(q, group.key)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    selectedBrand === group.key
                      ? "border-orange-600 bg-orange-600 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-700"
                  }`}
                >
                  {group.label} <span className="opacity-70">{group.items.length}</span>
                </Link>
              ))}
            </nav>

            {!selectedBrand ? (
              <section className="mt-5 grid gap-5 md:grid-cols-2">
                {groups.map((group) => {
                  const top = group.items[0];
                  return (
                    <div key={group.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Brand</p>
                          <h2 className="mt-1 text-xl font-semibold text-slate-950">{group.label}</h2>
                        </div>
                        {group.items.length > 1 ? (
                          <Link href={makeSearchHref(q, group.key)} className="text-sm font-semibold text-orange-600 hover:text-orange-700">
                            View {group.items.length} matches →
                          </Link>
                        ) : null}
                      </div>
                      <div className="mt-5">
                        <ResultCard result={top} />
                      </div>
                    </div>
                  );
                })}
              </section>
            ) : activeGroup ? (
              <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Brand results</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-950">{activeGroup.label}</h2>
                  </div>
                  <p className="text-sm text-slate-500">{activeGroup.items.length} matching result{activeGroup.items.length === 1 ? "" : "s"}</p>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {activeGroup.items.slice(0, 12).map((result) => <ResultCard key={result.id} result={result} />)}
                </div>
              </section>
            ) : (
              <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-slate-600">That brand has no matching results for this search.</p>
                <Link href={makeSearchHref(q)} className="mt-4 inline-flex font-semibold text-orange-600 hover:text-orange-700">
                  View all brands
                </Link>
              </section>
            )}
          </>
        ) : (
          <section className="mx-auto mt-8 max-w-2xl rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center shadow-[0_20px_60px_rgba(15,23,42,0.07)] md:px-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-2xl font-semibold text-orange-600">?</div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-orange-600">ITS BIO Search</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">No matching product found</h2>
            <p className="mt-4 text-slate-600">
              We couldn&apos;t find a match for <span className="font-semibold text-slate-950">“{q}”</span>.
            </p>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Try another product name or catalog number. If you still can&apos;t find what you need, contact us and we&apos;ll help.
            </p>
            <div className="mt-8 flex justify-center">
              <Link href="/contact" className="rounded-full bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700">
                Contact us
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
