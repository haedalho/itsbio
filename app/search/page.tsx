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

const PAGE_SIZE = 12;

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
] | order(_updatedAt desc)[0...300] {
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
  "matches": records[title match $match || sku match $match][0...60]
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
    value.length >= 3
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

function clampInt(value: unknown, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
}

function makeSearchHref(query: string, brand?: string, page?: number) {
  const params = new URLSearchParams({ q: query });
  if (brand) params.set("brand", brand);
  if (page && page > 1) params.set("page", String(page));
  return `/search?${params.toString()}`;
}

function buildPageNumbers(current: number, total: number) {
  const pages: Array<number | "..."> = [];
  if (total <= 7) {
    for (let page = 1; page <= total; page += 1) pages.push(page);
    return pages;
  }

  pages.push(1);
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push("...");
  for (let page = left; page <= right; page += 1) pages.push(page);
  if (right < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}

function ResultCard({ result }: { result: SearchResult }) {
  return (
    <article className="group border-b border-slate-200 bg-white last:border-b-0 hover:bg-orange-50/30">
      <div className="flex items-start gap-4 px-5 py-5 md:px-6 md:py-6">
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-xs font-bold tracking-wide text-orange-700 sm:flex">
          {result.brandLabel.slice(0, 3).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs font-semibold">
            <span className="text-orange-700">{result.brandLabel}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">{result.kind}</span>
            {result.sku ? (
              <>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-slate-600">Cat. No. {result.sku}</span>
              </>
            ) : null}
          </div>

          <Link href={result.href} className="mt-2 block text-lg font-semibold leading-7 text-slate-950 transition group-hover:text-orange-700">
            {result.title}
          </Link>

          {result.description ? (
            <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-600">{result.description}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Product details available on the product page.</p>
          )}
        </div>

        <Link
          href={result.href}
          aria-label={`${result.direct ? "View" : "Browse"} ${result.title}`}
          className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-500 transition group-hover:border-orange-300 group-hover:bg-orange-600 group-hover:text-white"
        >
          →
        </Link>
      </div>
    </article>
  );
}

function Pagination({ query, brand, current, total }: { query: string; brand: string; current: number; total: number }) {
  if (total <= 1) return null;
  const pages = buildPageNumbers(current, total);

  return (
    <nav className="mt-7 flex flex-wrap items-center justify-center gap-2" aria-label="Search result pages">
      <Link
        href={makeSearchHref(query, brand, Math.max(1, current - 1))}
        aria-disabled={current === 1}
        className={`rounded-lg border px-3.5 py-2 text-sm font-semibold transition ${
          current === 1
            ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-300"
            : "border-slate-300 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-700"
        }`}
      >
        ← Previous
      </Link>

      {pages.map((page, index) =>
        page === "..." ? (
          <span key={`ellipsis-${index}`} className="px-1.5 text-sm text-slate-400">…</span>
        ) : (
          <Link
            key={page}
            href={makeSearchHref(query, brand, page)}
            aria-current={page === current ? "page" : undefined}
            className={`flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-sm font-semibold transition ${
              page === current
                ? "border-orange-600 bg-orange-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-700"
            }`}
          >
            {page}
          </Link>
        ),
      )}

      <Link
        href={makeSearchHref(query, brand, Math.min(total, current + 1))}
        aria-disabled={current === total}
        className={`rounded-lg border px-3.5 py-2 text-sm font-semibold transition ${
          current === total
            ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-300"
            : "border-slate-300 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-700"
        }`}
      >
        Next →
      </Link>
    </nav>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; brand?: string; page?: string }> | { q?: string; brand?: string; page?: string };
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const qRaw = (resolvedSearchParams?.q || "").trim();
  const q = qRaw.replace(/\s+/g, " ").trim();
  const selectedBrand = normalizeBrandToken((resolvedSearchParams?.brand || "").trim());
  const requestedPage = clampInt(resolvedSearchParams?.page);

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
    .flatMap((chunk) => (Array.isArray(chunk?.matches) ? chunk.matches : []));

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

  const sortedResults = [...deduped.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const grouped = new Map<string, SearchGroup>();
  for (const result of sortedResults) {
    const group = grouped.get(result.brandKey) || { key: result.brandKey, label: result.brandLabel, items: [] };
    group.items.push(result);
    grouped.set(result.brandKey, group);
  }

  const groups = [...grouped.values()].sort((a, b) => {
    const scoreDiff = (b.items[0]?.score || 0) - (a.items[0]?.score || 0);
    return scoreDiff || a.label.localeCompare(b.label);
  });
  const activeGroup = selectedBrand ? groups.find((group) => group.key === selectedBrand) : undefined;
  const filteredItems = selectedBrand ? (activeGroup?.items || []) : sortedResults;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredItems.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeStart = filteredItems.length ? pageStart + 1 : 0;
  const rangeEnd = filteredItems.length ? Math.min(pageStart + PAGE_SIZE, filteredItems.length) : 0;

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#f7f8fa] px-4 py-8 sm:px-6 md:py-12">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-l-4 border-orange-500 px-5 py-6 sm:px-7 md:px-9 md:py-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Product search</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  Results for “{q}”
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {sortedResults.length} matching result{sortedResults.length === 1 ? "" : "s"}. Search by product name or catalog number, then narrow the list by brand.
                </p>
              </div>

              <form action="/search" method="get" className="flex w-full max-w-2xl gap-2">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Search by product name or catalog number</span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    name="q"
                    defaultValue={q}
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    placeholder="Product name or catalog number"
                  />
                </label>
                <button className="h-12 shrink-0 rounded-xl bg-orange-600 px-6 text-sm font-semibold text-white transition hover:bg-orange-700">
                  Search
                </button>
              </form>
            </div>
          </div>
        </section>

        {groups.length ? (
          <>
            <nav className="mt-5 flex gap-2 overflow-x-auto pb-2 lg:hidden" aria-label="Search result brands">
              <Link
                href={makeSearchHref(q)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  !selectedBrand
                    ? "border-orange-600 bg-orange-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-700"
                }`}
              >
                All <span className="opacity-75">{sortedResults.length}</span>
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

            <div className="mt-7 grid gap-7 lg:grid-cols-[230px_minmax(0,1fr)]">
              <aside className="hidden lg:block">
                <div className="sticky top-28 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Filter by</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">Brand</h2>
                  </div>
                  <nav className="p-2" aria-label="Search result brands">
                    <Link
                      href={makeSearchHref(q)}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        !selectedBrand ? "bg-orange-50 text-orange-700" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>All brands</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${!selectedBrand ? "bg-white text-orange-700" : "bg-slate-100 text-slate-500"}`}>
                        {sortedResults.length}
                      </span>
                    </Link>
                    {groups.map((group) => (
                      <Link
                        key={group.key}
                        href={makeSearchHref(q, group.key)}
                        className={`mt-1 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                          selectedBrand === group.key ? "bg-orange-50 text-orange-700" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="truncate pr-2">{group.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${selectedBrand === group.key ? "bg-white text-orange-700" : "bg-slate-100 text-slate-500"}`}>
                          {group.items.length}
                        </span>
                      </Link>
                    ))}
                  </nav>
                </div>
              </aside>

              <section className="min-w-0">
                {selectedBrand && !activeGroup ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                    <p className="text-slate-600">That brand has no matching results for this search.</p>
                    <Link href={makeSearchHref(q)} className="mt-4 inline-flex font-semibold text-orange-600 hover:text-orange-700">
                      View all brands
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">
                          {activeGroup ? activeGroup.label : "All brands"}
                        </p>
                        <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                          {activeGroup ? `${activeGroup.label} results` : "Matching products & services"}
                        </h2>
                      </div>
                      <div className="text-right text-sm text-slate-500">
                        <p>{rangeStart}–{rangeEnd} of {filteredItems.length}</p>
                        <p className="mt-0.5 text-xs text-slate-400">Sorted by relevance</p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      {pageItems.map((result) => <ResultCard key={result.id} result={result} />)}
                    </div>

                    <Pagination query={q} brand={activeGroup?.key || ""} current={currentPage} total={totalPages} />
                  </>
                )}
              </section>
            </div>
          </>
        ) : (
          <section className="mx-auto mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm md:px-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-xl font-semibold text-orange-600">?</div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Product search</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">No matching product found</h2>
            <p className="mt-3 text-slate-600">
              We couldn&apos;t find a match for <span className="font-semibold text-slate-950">“{q}”</span>.
            </p>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Try another product name or catalog number. If you still can&apos;t find what you need, contact us and we&apos;ll help.
            </p>
            <div className="mt-7 flex justify-center">
              <Link href="/contact" className="rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700">
                Contact us
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
