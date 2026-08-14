import Link from "next/link";

import type { AbmStagedRecord } from "@/lib/abm/rebuild-staging";
import { stagedRecordKey, stagedRecordPath } from "@/lib/abm/rebuild-staging";

const PAGE_SIZE = 30;

function cleanTitle(value: string) {
  return value.replace(/\s+/g, " ").trim() || "Untitled item";
}

function rowCategory(row: AbmStagedRecord) {
  return row.searchCategory || row.filterPath?.at(-1) || row.filterTitle || "ABM";
}

export default function AbmStagedCatalog({
  kind,
  records,
  query,
  page,
  basePath,
}: {
  kind: AbmStagedRecord["kind"];
  records: AbmStagedRecord[];
  query: string;
  page: number;
  basePath?: string;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? records.filter((row) =>
        [row.title, row.sku, row.searchCategory, row.filterTitle, ...(row.filterPath || [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : records;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const base = basePath || `/products/abm/${kind === "product" ? "products" : "services"}`;
  const pageHref = (nextPage: number) =>
    `${base}?page=${nextPage}${normalizedQuery ? `&q=${encodeURIComponent(query)}` : ""}`;

  return (
    <section className="mt-8" aria-labelledby="abm-catalog-list-title">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-neutral-900 pb-5">
        <div>
          <h2 id="abm-catalog-list-title" className="text-xl font-semibold text-neutral-950">
            {kind === "product" ? "Products" : "Services"}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {filtered.length.toLocaleString()} {kind === "product" ? "products" : "services"}
            {normalizedQuery ? ` matching “${query}”` : ""}
          </p>
        </div>
        <form action={base} className="flex w-full max-w-md gap-2 sm:w-auto">
          <label htmlFor={`abm-${kind}-search`} className="sr-only">
            {kind === "product" ? "Search product name or catalog number" : "Search service name"}
          </label>
          <input
            id={`abm-${kind}-search`}
            name="q"
            defaultValue={query}
            placeholder={kind === "product" ? "Search name or Cat. No." : "Search service name"}
            className="h-10 min-w-0 flex-1 border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-orange-600 sm:w-72"
          />
          <button className="h-10 bg-orange-600 px-5 text-sm font-semibold text-white transition hover:bg-orange-700" type="submit">
            Search
          </button>
        </form>
      </div>

      {visible.length ? (
        <div>
          <div className="hidden grid-cols-[minmax(0,1fr)_120px_160px_20px] gap-5 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 md:grid">
            <span>{kind === "product" ? "Product name" : "Service name"}</span>
            <span>Cat. No.</span>
            <span>Category</span>
            <span aria-hidden />
          </div>
          <div className="divide-y divide-neutral-200 border-b border-neutral-300">
            {visible.map((row) => (
              <Link
                key={`${row.kind}-${stagedRecordKey(row)}`}
                href={stagedRecordPath(kind, row)}
                prefetch={false}
                className="group grid gap-2 px-4 py-4 transition hover:bg-orange-50/70 md:grid-cols-[minmax(0,1fr)_120px_160px_20px] md:items-center md:gap-5"
              >
                <span className="min-w-0 font-semibold leading-6 text-neutral-900 group-hover:text-orange-700 group-hover:underline group-hover:underline-offset-4">
                  {cleanTitle(row.title)}
                </span>
                <span className="text-sm font-medium text-neutral-600">
                  <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 md:hidden">Cat. No.</span>
                  {row.sku || "—"}
                </span>
                <span className="min-w-0 truncate text-sm text-neutral-500">{rowCategory(row)}</span>
                <span className="hidden text-lg text-orange-600 transition group-hover:translate-x-1 md:block" aria-hidden>›</span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-b border-neutral-300 px-5 py-12 text-center text-neutral-600">
          No {kind === "product" ? "products" : "services"} found.
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="mt-7 flex items-center justify-between border-t border-neutral-200 pt-5" aria-label="Pagination">
          {safePage > 1 ? (
            <Link className="text-sm font-semibold text-neutral-700 hover:text-orange-700" href={pageHref(safePage - 1)} prefetch={false}>← Previous</Link>
          ) : <span />}
          <span className="text-sm text-neutral-500">Page {safePage.toLocaleString()} of {totalPages.toLocaleString()}</span>
          {safePage < totalPages ? (
            <Link className="text-sm font-semibold text-neutral-700 hover:text-orange-700" href={pageHref(safePage + 1)} prefetch={false}>Next →</Link>
          ) : <span />}
        </nav>
      ) : null}
    </section>
  );
}
