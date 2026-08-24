"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { AbmSpecialCellProduct } from "@/lib/abm/special-cell-catalog";

const PAGE_SIZE = 12;

function normalized(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function uniqueOptions(products: AbmSpecialCellProduct[], field: "species" | "bioSystem" | "cellType") {
  return Array.from(new Set(products.map((product) => product[field]).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, "en", { numeric: true, sensitivity: "base" }));
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-[12px] font-normal normal-case tracking-normal text-neutral-700 outline-none focus:border-[#f15a29]"
      >
        <option value="">All {label.toLowerCase()}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

export default function AbmSpecialCellCatalogClient({
  products,
  initialQuery = "",
}: {
  products: AbmSpecialCellProduct[];
  initialQuery?: string;
}) {
  const [draftQuery, setDraftQuery] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [species, setSpecies] = useState("");
  const [bioSystem, setBioSystem] = useState("");
  const [cellType, setCellType] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => products.filter((product) => {
    if (species && product.species !== species) return false;
    if (bioSystem && product.bioSystem !== bioSystem) return false;
    if (cellType && product.cellType !== cellType) return false;
    return !query || normalized([
      product.title,
      product.sku,
      product.species,
      product.bioSystem,
      product.cellType,
    ].join(" ")).includes(normalized(query));
  }), [products, query, species, bioSystem, cellType]);

  const speciesOptions = useMemo(() => uniqueOptions(products.filter((product) => (
    (!bioSystem || product.bioSystem === bioSystem) && (!cellType || product.cellType === cellType)
  )), "species"), [products, bioSystem, cellType]);
  const bioSystemOptions = useMemo(() => uniqueOptions(products.filter((product) => (
    (!species || product.species === species) && (!cellType || product.cellType === cellType)
  )), "bioSystem"), [products, species, cellType]);
  const cellTypeOptions = useMemo(() => uniqueOptions(products.filter((product) => (
    (!species || product.species === species) && (!bioSystem || product.bioSystem === bioSystem)
  )), "cellType"), [products, species, bioSystem]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section id="catalog" className="mt-8" aria-labelledby="abm-special-cell-catalog-title">
      <div className="rounded-[18px] border border-[#ebe1dc] bg-[#fffaf7] p-5 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SelectField label="Species" value={species} options={speciesOptions} onChange={(value) => { setSpecies(value); setPage(1); }} />
          <SelectField label="Bio System" value={bioSystem} options={bioSystemOptions} onChange={(value) => { setBioSystem(value); setPage(1); }} />
          <SelectField label="Cell Type" value={cellType} options={cellTypeOptions} onChange={(value) => { setCellType(value); setPage(1); }} />
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(draftQuery);
            setPage(1);
          }}
        >
          <input
            aria-label="Search cell products"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Product name, Cat. No., species, or tissue…"
            className="h-11 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-4 text-sm outline-none focus:border-[#f15a29]"
          />
          <button type="submit" className="h-11 rounded-md bg-[#f15a29] px-5 text-sm font-semibold text-white hover:bg-[#d95124]">
            Search
          </button>
        </form>
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="abm-special-cell-catalog-title" className="text-[24px] font-bold text-[#f2632f]">Product List</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {filtered.length.toLocaleString()} {filtered.length === 1 ? "product" : "products"}
            {query ? ` matching “${query}”` : ""}
          </p>
        </div>
        {species || bioSystem || cellType || query ? (
          <button
            type="button"
            onClick={() => { setSpecies(""); setBioSystem(""); setCellType(""); setDraftQuery(""); setQuery(""); setPage(1); }}
            className="text-xs font-semibold text-[#e15b2e] hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {visible.length ? (
        <div className="abm-table-scroll mt-3" role="region" aria-label="Scrollable ABM cell product list" tabIndex={0}>
          <table className="abm-data-table">
            <thead>
              <tr>
                <th scope="col">Product Name</th>
                <th scope="col">Cat. No.</th>
                <th scope="col">Species</th>
                <th scope="col">Cell Type</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => (
                <tr key={product.sku}>
                  <td>
                    <Link href={product.href} prefetch={false} className="flex min-w-[220px] items-center gap-3">
                      {product.previewImage ? (
                        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white">
                          <Image src={product.previewImage} alt="" fill sizes="48px" className="object-contain" />
                        </span>
                      ) : null}
                      <span>{product.title}</span>
                    </Link>
                  </td>
                  <td><Link href={product.href} prefetch={false}>{product.sku}</Link></td>
                  <td>{product.species || "—"}</td>
                  <td>{product.cellType || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-b border-neutral-300 px-5 py-12 text-center text-neutral-600">No products found.</div>
      )}

      {totalPages > 1 ? (
        <nav className="mt-6 flex items-center justify-between border-t border-neutral-200 pt-5" aria-label="Pagination">
          <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="text-sm font-semibold text-neutral-700 disabled:invisible">
            ← Previous
          </button>
          <span className="text-sm text-neutral-500">Page {safePage.toLocaleString()} of {totalPages.toLocaleString()}</span>
          <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} className="text-sm font-semibold text-neutral-700 disabled:invisible">
            Next →
          </button>
        </nav>
      ) : null}
    </section>
  );
}
