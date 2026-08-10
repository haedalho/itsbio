import Link from "next/link";

import type { AbmStagedRecord } from "@/lib/abm/rebuild-staging";
import { stagedRecordKey, stagedRecordPath } from "@/lib/abm/rebuild-staging";

const PAGE_SIZE = 48;

function cleanTitle(value: string) {
  return value.replace(/\s+/g, " ").trim() || "Untitled item";
}

export default function AbmStagedCatalog({
  kind,
  records,
  query,
  page,
}: {
  kind: AbmStagedRecord["kind"];
  records: AbmStagedRecord[];
  query: string;
  page: number;
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
  const base = `/products/abm/${kind === "product" ? "products" : "services"}`;
  const pageHref = (nextPage: number) =>
    `${base}?page=${nextPage}${normalizedQuery ? `&q=${encodeURIComponent(query)}` : ""}`;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">
            {filtered.length.toLocaleString()} {kind === "product" ? "products" : "services"}
            {normalizedQuery ? ` matching “${query}”` : ""}
          </p>
        </div>
        <form action={base} className="flex w-full max-w-md gap-2 sm:w-auto">
          <input
            name="q"
            defaultValue={query}
            placeholder={kind === "product" ? "Search name or Cat. No." : "Search service name"}
            className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-4 text-sm outline-none focus:border-orange-500 sm:w-72"
          />
          <button className="h-11 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600" type="submit">
            Search
          </button>
        </form>
      </div>

      {visible.length ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((row) => {
            const content = (
              <>
                <div className="relative -mx-5 -mt-5 mb-5 h-40 overflow-hidden rounded-t-2xl bg-neutral-50">
                  {row.previewImage ? (
                    // Official ABM images are kept as read-only source URLs in Preview staging.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.previewImage} alt="" className="h-full w-full object-contain p-4" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-5 text-center text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Detail image pending
                    </div>
                  )}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-orange-700">
                    {kind === "product" ? "Product" : "Service"}
                  </span>
                  {row.sku ? <span className="text-xs text-neutral-500">{row.sku}</span> : null}
                </div>
                <h3 className="mt-4 line-clamp-3 text-base font-semibold leading-6 text-neutral-900 group-hover:text-orange-700">
                  {cleanTitle(row.title)}
                </h3>
                {row.previewSummary ? (
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-neutral-600">{row.previewSummary}</p>
                ) : (row.filterTitle || row.searchCategory) ? (
                  <p className="mt-3 line-clamp-2 text-sm text-neutral-500">{row.filterTitle || row.searchCategory}</p>
                ) : null}
                <span className={`mt-5 inline-flex text-sm font-semibold ${row.hasDetail ? "text-orange-700" : "text-neutral-500"}`}>
                  {row.hasDetail ? "View details →" : "Detail collection in progress"}
                </span>
              </>
            );

            return row.hasDetail ? (
              <Link
                key={`${row.kind}-${stagedRecordKey(row)}`}
                href={stagedRecordPath(kind, row)}
                className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
              >
                {content}
              </Link>
            ) : (
              <article
                key={`${row.kind}-${stagedRecordKey(row)}`}
                className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5"
              >
                {content}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center text-neutral-600">
          No {kind === "product" ? "products" : "services"} found.
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
          {safePage > 1 ? <Link className="rounded-xl border border-neutral-200 px-4 py-2 text-sm" href={pageHref(safePage - 1)}>Previous</Link> : null}
          <span className="text-sm text-neutral-600">Page {safePage} of {totalPages}</span>
          {safePage < totalPages ? <Link className="rounded-xl border border-neutral-200 px-4 py-2 text-sm" href={pageHref(safePage + 1)}>Next</Link> : null}
        </nav>
      ) : null}
    </section>
  );
}
