"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { AbmSpecialCellProduct } from "@/lib/abm/special-cell-catalog";

const PAGE_SIZE = 12;
type FilterField = "species" | "bioSystem" | "cellType" | "tissue" | "primaryCategory" | "growthProperties";
type PaginationItem = number | "start-ellipsis" | "end-ellipsis";

function normalized(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function uniqueOptions(products: AbmSpecialCellProduct[], field: FilterField) {
  return Array.from(new Set(products.map((product) => String(product[field] || "").trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, "en", { numeric: true, sensitivity: "base" }));
}

function paginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, "end-ellipsis", totalPages];
  if (currentPage >= totalPages - 3) {
    return [1, "start-ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "start-ellipsis", currentPage - 1, currentPage, currentPage + 1, "end-ellipsis", totalPages];
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
  const isStableCatalog = useMemo(() => products.some((product) => product.stableMembership), [products]);
  const searchableProducts = useMemo(() => products.map((product) => ({
    product,
    searchText: normalized([
      product.title,
      product.sku,
      product.species,
      product.bioSystem,
      product.cellType,
      product.tissue,
      product.primaryCategory,
      product.productType,
      product.geneName,
      product.geneFullName,
      product.accessionNumber,
      product.growthProperties,
      product.donorHistory,
    ].join(" ")),
  })), [products]);
  const [draftQuery, setDraftQuery] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [species, setSpecies] = useState("");
  const [bioSystem, setBioSystem] = useState("");
  const [cellType, setCellType] = useState("");
  const [tissue, setTissue] = useState("");
  const [growthProperties, setGrowthProperties] = useState("");
  const [primaryCategory, setPrimaryCategory] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => searchableProducts.filter(({ product, searchText }) => {
    if (species && product.species !== species) return false;
    if (isStableCatalog) {
      if (tissue && product.tissue !== tissue) return false;
      if (growthProperties && product.growthProperties !== growthProperties) return false;
      if (primaryCategory && product.primaryCategory !== primaryCategory) return false;
    } else {
      if (bioSystem && product.bioSystem !== bioSystem) return false;
      if (cellType && product.cellType !== cellType) return false;
    }
    return !query || searchText.includes(normalized(query));
  }).map(({ product }) => product), [searchableProducts, query, species, bioSystem, cellType, tissue, growthProperties, primaryCategory, isStableCatalog]);

  const speciesOptions = useMemo(() => uniqueOptions(products.filter((product) => (
    isStableCatalog
      ? (!tissue || product.tissue === tissue) && (!growthProperties || product.growthProperties === growthProperties) && (!primaryCategory || product.primaryCategory === primaryCategory)
      : (!bioSystem || product.bioSystem === bioSystem) && (!cellType || product.cellType === cellType)
  )), "species"), [products, isStableCatalog, tissue, growthProperties, primaryCategory, bioSystem, cellType]);

  const bioSystemOptions = useMemo(() => uniqueOptions(products.filter((product) => (
    (!species || product.species === species) && (!cellType || product.cellType === cellType)
  )), "bioSystem"), [products, species, cellType]);
  const cellTypeOptions = useMemo(() => uniqueOptions(products.filter((product) => (
    (!species || product.species === species) && (!bioSystem || product.bioSystem === bioSystem)
  )), "cellType"), [products, species, bioSystem]);
  const tissueOptions = useMemo(() => uniqueOptions(products.filter((product) => (
    (!species || product.species === species) && (!growthProperties || product.growthProperties === growthProperties) && (!primaryCategory || product.primaryCategory === primaryCategory)
  )), "tissue"), [products, species, growthProperties, primaryCategory]);
  const growthOptions = useMemo(() => uniqueOptions(products.filter((product) => (
    (!species || product.species === species) && (!tissue || product.tissue === tissue) && (!primaryCategory || product.primaryCategory === primaryCategory)
  )), "growthProperties"), [products, species, tissue, primaryCategory]);
  const primaryCategoryOptions = useMemo(() => uniqueOptions(products.filter((product) => (
    (!species || product.species === species) && (!tissue || product.tissue === tissue) && (!growthProperties || product.growthProperties === growthProperties)
  )), "primaryCategory"), [products, species, tissue, growthProperties]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pagination = useMemo(() => paginationItems(safePage, totalPages), [safePage, totalPages]);
  const hasFilters = isStableCatalog
    ? Boolean(species || tissue || growthProperties || primaryCategory || query)
    : Boolean(species || bioSystem || cellType || query);

  const clearFilters = () => {
    setSpecies("");
    setBioSystem("");
    setCellType("");
    setTissue("");
    setGrowthProperties("");
    setPrimaryCategory("");
    setDraftQuery("");
    setQuery("");
    setPage(1);
  };

  const goToPage = (nextPage: number) => {
    setPage(Math.max(1, Math.min(totalPages, nextPage)));
    window.requestAnimationFrame(() => {
      document.getElementById("abm-special-cell-catalog-title")?.scrollIntoView({ block: "start" });
    });
  };

  return (
    <section id="catalog" className="mt-8" aria-labelledby="abm-special-cell-catalog-title">
      <div className="rounded-[18px] border border-[#ebe1dc] bg-[#fffaf7] p-5 md:p-6">
        <div className={`grid gap-3 sm:grid-cols-2 ${isStableCatalog ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
          <SelectField label="Species" value={species} options={speciesOptions} onChange={(value) => { setSpecies(value); setPage(1); }} />
          {isStableCatalog ? (
            <>
              <SelectField label="Tissue" value={tissue} options={tissueOptions} onChange={(value) => { setTissue(value); setPage(1); }} />
              {growthOptions.length ? <SelectField label="Growth Properties" value={growthProperties} options={growthOptions} onChange={(value) => { setGrowthProperties(value); setPage(1); }} /> : null}
              <SelectField label="Primary Category" value={primaryCategory} options={primaryCategoryOptions} onChange={(value) => { setPrimaryCategory(value); setPage(1); }} />
            </>
          ) : (
            <>
              <SelectField label="Bio System" value={bioSystem} options={bioSystemOptions} onChange={(value) => { setBioSystem(value); setPage(1); }} />
              <SelectField label="Cell Type" value={cellType} options={cellTypeOptions} onChange={(value) => { setCellType(value); setPage(1); }} />
            </>
          )}
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
            placeholder={isStableCatalog ? "Gene, accession, tissue, product name, or Cat. No.…" : "Product name, Cat. No., species, or tissue…"}
            className="h-11 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-4 text-sm outline-none focus:border-[#f15a29]"
          />
          <button type="submit" className="h-11 rounded-md bg-[#f15a29] px-5 text-sm font-semibold text-white hover:bg-[#d95124]">
            Search
          </button>
        </form>
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="abm-special-cell-catalog-title" className="scroll-mt-24 text-[24px] font-bold text-[#f2632f]">Product List</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {filtered.length.toLocaleString()} {filtered.length === 1 ? "product" : "products"}
            {query ? ` matching “${query}”` : ""}
          </p>
        </div>
        {hasFilters ? (
          <button type="button" onClick={clearFilters} className="text-xs font-semibold text-[#e15b2e] hover:underline">
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
                <th scope="col">{isStableCatalog ? "Tissue" : "Cell Type"}</th>
                {isStableCatalog ? <th scope="col">Growth Properties</th> : null}
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => (
                <tr key={product.sku}>
                  <td>
                    <Link href={product.href} prefetch={false} className="flex min-w-[220px] items-center gap-3">
                      {product.previewImage ? (
                        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white">
                          <Image
                            src={product.previewImage}
                            alt={`${product.title} thumbnail`}
                            fill
                            sizes="56px"
                            className="object-contain p-1"
                            loading="lazy"
                            unoptimized
                          />
                        </span>
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50 text-center text-[9px] leading-tight text-neutral-400">
                          No image
                        </span>
                      )}
                      <span>
                        <span className="block">{product.title}</span>
                        {isStableCatalog && product.primaryCategory && product.primaryCategory !== "Stable Cell Lines" ? (
                          <span className="mt-1 block text-[11px] text-neutral-500">Cross-listed from {product.primaryCategory}</span>
                        ) : null}
                      </span>
                    </Link>
                  </td>
                  <td><Link href={product.href} prefetch={false}>{product.sku}</Link></td>
                  <td>{product.species || "—"}</td>
                  <td>{isStableCatalog ? (product.tissue || "—") : (product.cellType || "—")}</td>
                  {isStableCatalog ? <td>{product.growthProperties || "—"}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-b border-neutral-300 px-5 py-12 text-center text-neutral-600">No products found.</div>
      )}

      {totalPages > 1 ? (
        <nav className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-neutral-200 pt-5" aria-label="Pagination">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => goToPage(safePage - 1)}
            className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 hover:border-[#f15a29] hover:text-[#e15b2e] disabled:cursor-not-allowed disabled:opacity-35"
          >
            Previous
          </button>
          {pagination.map((item) => typeof item === "number" ? (
            <button
              key={item}
              type="button"
              aria-current={item === safePage ? "page" : undefined}
              onClick={() => goToPage(item)}
              className={`h-9 min-w-9 rounded-md border px-2 text-sm font-semibold transition-colors ${item === safePage
                ? "border-[#f15a29] bg-[#f15a29] text-white"
                : "border-neutral-300 bg-white text-neutral-700 hover:border-[#f15a29] hover:text-[#e15b2e]"
              }`}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="px-1 text-sm text-neutral-400" aria-hidden="true">…</span>
          ))}
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => goToPage(safePage + 1)}
            className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 hover:border-[#f15a29] hover:text-[#e15b2e] disabled:cursor-not-allowed disabled:opacity-35"
          >
            Next
          </button>
        </nav>
      ) : null}
    </section>
  );
}
