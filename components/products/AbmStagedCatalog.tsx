import Link from "next/link";

import type { AbmStagedRecord } from "@/lib/abm/rebuild-staging";
import { stagedRecordKey, stagedRecordPath } from "@/lib/abm/rebuild-staging";

const PAGE_SIZE = 30;

function cleanTitle(value: string) {
  return value.replace(/\s+/g, " ").trim() || "Untitled item";
}

export default function AbmStagedCatalog({
  kind,
  records,
  query,
  page,
  basePath,
  hideSearch = false,
}: {
  kind: AbmStagedRecord["kind"];
  records: AbmStagedRecord[];
  query: string;
  page: number;
  basePath?: string;
  hideSearch?: boolean;
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
    <section className="mt-10" aria-labelledby="abm-catalog-list-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="abm-catalog-list-title" className="text-2xl font-bold text-[#f2632f]">
            {kind === "product" ? "Product List" : "Service List"}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {filtered.length.toLocaleString()} {kind === "product" ? "products" : "services"}
            {normalizedQuery ? ` matching “${query}”` : ""}
          </p>
        </div>
        {!hideSearch ? <form action={base} className="flex w-full max-w-md gap-2 sm:w-auto">
          <label htmlFor={`abm-${kind}-search`} className="sr-only">
            {kind === "product" ? "Search product name or catalog number" : "Search service name"}
          </label>
          <input
            id={`abm-${kind}-search`}
            name="q"
            defaultValue={query}
            placeholder={kind === "product" ? "Search name or Cat. No." : "Search service name"}
            className="h-10 min-w-0 flex-1 border border-neutral-300 bg-neutral-50 px-3 text-sm outline-none transition focus:border-[#f2632f] sm:w-72"
          />
          <button className="h-10 bg-[#f2632f] px-5 text-sm font-semibold text-white transition hover:bg-[#d95221]" type="submit">
            Search
          </button>
        </form> : null}
      </div>

      {visible.length ? (
        <div className="abm-table-scroll mt-3" role="region" aria-label={`Scrollable ABM ${kind} list`} tabIndex={0}>
          <table className="abm-data-table">
            <caption className="sr-only">{kind === "product" ? "ABM product list" : "ABM service list"}</caption>
            <thead>
              <tr>
                <th scope="col">{kind === "product" ? "Product Name" : "Service Name"}</th>
                <th scope="col">Cat. No.</th>
                <th scope="col">{kind === "product" ? "Size" : "Category"}</th>
              </tr>
            </thead>
            <tbody>
            {visible.map((row) => (
              <tr key={`${row.kind}-${stagedRecordKey(row)}`}>
                <td>
                  <Link href={stagedRecordPath(kind, row)} prefetch={false}>{cleanTitle(row.title)}</Link>
                </td>
                <td>
                  {row.sku ? <Link href={stagedRecordPath(kind, row)} prefetch={false}>{row.sku}</Link> : "—"}
                </td>
                <td>{kind === "product" ? row.unit || "—" : row.searchCategory || row.filterTitle || "ABM Service"}</td>
              </tr>
            ))}
            </tbody>
          </table>
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
