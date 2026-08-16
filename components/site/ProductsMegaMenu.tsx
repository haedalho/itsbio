"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type BrandLink = {
  name: string;
  area: string;
  href: string;
};

const BRANDS: BrandLink[] = [
  { name: "ABM", area: "Life Science", href: "/products/abm" },
  { name: "Kent Scientific", area: "Animal Research", href: "/products/kent" },
  { name: "Cleaver Scientific", area: "Laboratory Equipment", href: "/products#brands" },
  { name: "Seedburo", area: "Agricultural Research", href: "/products#brands" },
  { name: "AIMS", area: "Animal Identification", href: "/products#brands" },
  { name: "BIOplastics", area: "PCR & qPCR Consumables", href: "/products#brands" },
  { name: "CellFree Sciences", area: "Protein Expression", href: "/products#brands" },
  { name: "ITSChem", area: "Research Materials", href: "/products#brands" },
  { name: "PLAS-LABS", area: "Controlled Environments", href: "/products#brands" },
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

export default function ProductsMegaMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (!closeTimer.current) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      cancelClose();
    };
  }, []);

  const closeMenu = () => setOpen(false);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        className="group inline-flex h-[76px] items-center gap-1.5 transition hover:text-orange-600 focus:outline-none"
      >
        Products
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180 text-orange-600" : "text-slate-400"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="m5.5 7.5 4.5 4.5 4.5-4.5" />
        </svg>
      </button>

      {open ? (
        <div
          className="fixed left-1/2 top-[76px] z-[70] w-[min(1180px,calc(100vw-48px))] -translate-x-1/2 pt-3"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_26px_80px_rgba(15,23,42,0.16)]">
            <div className="border-b border-slate-200 bg-[#fbfaf8] px-7 py-6 lg:px-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-[560px]">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-600">ITS BIO PRODUCT PORTFOLIO</div>
                  <h2 className="mt-2 text-[25px] font-semibold leading-tight tracking-[-0.035em] text-[#071d43]">
                    Explore our brands and scientific solutions.
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Each brand represents a different part of the research workflow. Choose the specialist that fits your application.
                  </p>
                </div>

                <Link
                  href="/products"
                  onClick={closeMenu}
                  className="inline-flex h-11 shrink-0 items-center gap-3 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:border-orange-300 hover:text-orange-600"
                >
                  View all brands <span aria-hidden>→</span>
                </Link>
              </div>

              <form action="/search" method="get" className="mt-5 flex max-w-[720px] gap-2" onSubmit={closeMenu}>
                <div className="relative min-w-0 flex-1">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <SearchIcon />
                  </span>
                  <input
                    name="q"
                    required
                    aria-label="Search products"
                    placeholder="Search by product name or catalog number"
                    className="h-12 w-full rounded-full border border-slate-300 bg-white pl-12 pr-5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                  />
                </div>
                <button className="h-12 shrink-0 rounded-full bg-orange-600 px-6 text-sm font-semibold text-white transition hover:bg-orange-700">
                  Search
                </button>
              </form>
            </div>

            <div className="px-7 py-6 lg:px-8 lg:py-7">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-950">Browse by brand</div>
                  <div className="mt-0.5 text-xs text-slate-500">All brands are shown with the same priority.</div>
                </div>
                <div className="hidden text-xs font-medium text-slate-400 sm:block">9 partner brands</div>
              </div>

              <div className="grid overflow-hidden rounded-[22px] border border-slate-200 sm:grid-cols-2 lg:grid-cols-3">
                {BRANDS.map((brand, index) => (
                  <Link
                    key={brand.name}
                    href={brand.href}
                    onClick={closeMenu}
                    className={[
                      "group/brand relative min-h-[104px] bg-white px-5 py-5 transition hover:z-10 hover:bg-[#fffaf5]",
                      "border-slate-200",
                      index % 3 !== 2 ? "lg:border-r" : "",
                      index < 6 ? "lg:border-b" : "",
                      index % 2 === 0 ? "sm:border-r lg:border-r" : "sm:border-r-0",
                      index < 8 ? "sm:border-b" : "",
                    ].join(" ")}
                  >
                    <div className="flex h-full items-center justify-between gap-5">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-[0.17em] text-slate-400 transition group-hover/brand:text-orange-500">
                          {brand.area}
                        </div>
                        <div className="mt-1.5 truncate text-[16px] font-semibold tracking-[-0.02em] text-slate-900 transition group-hover/brand:text-orange-700">
                          {brand.name}
                        </div>
                      </div>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition group-hover/brand:translate-x-0.5 group-hover/brand:border-orange-200 group-hover/brand:bg-white group-hover/brand:text-orange-600" aria-hidden>
                        →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>Not sure which brand fits your application?</span>
                <Link href="/contact" onClick={closeMenu} className="font-semibold text-slate-800 transition hover:text-orange-600">
                  Ask our team →
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
