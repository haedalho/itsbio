"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const OTHER_BRANDS = [
  { name: "Cleaver Scientific", area: "Laboratory Equipment" },
  { name: "Seedburo", area: "Agricultural Research" },
  { name: "AIMS", area: "Animal Identification" },
  { name: "BIOplastics", area: "PCR & qPCR Consumables" },
  { name: "CellFree Sciences", area: "Protein Expression" },
  { name: "ITSChem", area: "Research Materials" },
  { name: "PLAS-LABS", area: "Controlled Environments" },
] as const;

export default function ProductsMegaMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
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
          className="fixed left-1/2 top-[76px] z-[70] w-[min(1120px,calc(100vw-48px))] -translate-x-1/2 pt-3"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_26px_80px_rgba(15,23,42,0.16)]">
            <div className="grid lg:grid-cols-[0.86fr_1.14fr]">
              <div className="relative overflow-hidden border-b border-slate-200 bg-[#071d43] p-7 text-white lg:border-b-0 lg:border-r lg:p-8">
                <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full border border-white/10" />
                <div className="pointer-events-none absolute -bottom-24 left-16 h-48 w-48 rounded-full border border-orange-400/15" />

                <div className="relative z-10">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-400">ITS BIO PRODUCT PORTFOLIO</div>
                  <h2 className="mt-3 max-w-sm text-[27px] font-semibold leading-[1.12] tracking-[-0.035em]">
                    Find products by brand or search the catalog.
                  </h2>
                  <p className="mt-4 max-w-sm text-sm leading-6 text-white/65">
                    Explore specialized scientific brands without mixing thousands of unrelated products into one list.
                  </p>

                  <Link
                    href="/products"
                    onClick={() => setOpen(false)}
                    className="mt-6 inline-flex h-11 items-center gap-3 rounded-full bg-orange-600 px-5 text-sm font-semibold text-white transition hover:bg-orange-500"
                  >
                    Explore all brands <span aria-hidden>→</span>
                  </Link>

                  <div className="mt-8 border-t border-white/10 pt-6">
                    <div className="text-xs font-semibold text-white/55">Know the product name or catalog number?</div>
                    <form action="/search" method="get" className="mt-3 flex gap-2" onSubmit={() => setOpen(false)}>
                      <input
                        name="q"
                        required
                        aria-label="Search products"
                        placeholder="Product name or Catalog No."
                        className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-orange-400 focus:bg-white/[0.14]"
                      />
                      <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#071d43] transition hover:bg-orange-50 hover:text-orange-700" aria-label="Search catalog">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <circle cx="11" cy="11" r="7" />
                          <path d="m20 20-4-4" />
                        </svg>
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              <div className="p-7 lg:p-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">Catalogs available now</div>
                    <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">Featured catalogs</h3>
                  </div>
                  <Link href="/products" onClick={() => setOpen(false)} className="text-xs font-semibold text-slate-500 transition hover:text-orange-600">
                    Product hub →
                  </Link>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/products/abm"
                    onClick={() => setOpen(false)}
                    className="group/card relative overflow-hidden rounded-2xl border border-slate-200 bg-[#fffaf5] p-5 transition hover:border-orange-300 hover:shadow-md"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">Life Science</div>
                    <div className="mt-2 text-lg font-semibold text-slate-950">ABM</div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">Research reagents, cell biology, genetic materials, and custom services.</p>
                    <div className="mt-4 text-xs font-semibold text-orange-600">Browse ABM catalog <span className="inline-block transition group-hover/card:translate-x-1">→</span></div>
                  </Link>

                  <Link
                    href="/products/kent"
                    onClick={() => setOpen(false)}
                    className="group/card relative overflow-hidden rounded-2xl border border-slate-200 bg-[#f6f9fc] p-5 transition hover:border-[#8da8c8] hover:shadow-md"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#406b9c]">Animal Research</div>
                    <div className="mt-2 text-lg font-semibold text-slate-950">Kent Scientific</div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">Anesthesia, ventilation, monitoring, surgery, warming, and animal care.</p>
                    <div className="mt-4 text-xs font-semibold text-[#406b9c]">Browse Kent catalog <span className="inline-block transition group-hover/card:translate-x-1">→</span></div>
                  </Link>
                </div>

                <div className="mt-7 flex items-center justify-between border-t border-slate-200 pt-5">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">More partner brands</div>
                    <div className="mt-1 text-xs text-slate-500">Explore each specialist brand from the product hub.</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-x-7 gap-y-1 sm:grid-cols-2">
                  {OTHER_BRANDS.map((brand) => (
                    <Link
                      key={brand.name}
                      href="/products#brands"
                      onClick={() => setOpen(false)}
                      className="group/brand flex items-center justify-between gap-3 border-b border-slate-100 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-800 transition group-hover/brand:text-orange-600">{brand.name}</span>
                        <span className="block truncate text-[11px] text-slate-400">{brand.area}</span>
                      </span>
                      <span className="shrink-0 text-slate-300 transition group-hover/brand:translate-x-0.5 group-hover/brand:text-orange-500" aria-hidden>→</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
