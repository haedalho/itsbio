"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Brand = {
  key: string;
  name: string;
  area: string;
  description: string;
  href: string;
  searchKey: string;
  categories: string[];
};

const BRANDS: Brand[] = [
  {
    key: "abm",
    name: "ABM",
    area: "Life Science",
    description: "Research reagents, cell biology products, genetic materials, molecular tools, and custom research services.",
    href: "/products/abm",
    searchKey: "abm",
    categories: ["General Materials", "Cellular Materials", "Genetic Materials", "Custom Services"],
  },
  {
    key: "kent",
    name: "Kent Scientific",
    area: "Animal Research",
    description: "Integrated systems for laboratory animal anesthesia, ventilation, monitoring, surgery, warming, and handling.",
    href: "/products/kent",
    searchKey: "kent",
    categories: ["Anesthesia", "Ventilation", "Physiological Monitoring", "Surgery & Warming"],
  },
  {
    key: "cleaver",
    name: "Cleaver Scientific",
    area: "Laboratory Equipment",
    description: "Practical laboratory equipment for electrophoresis, gel documentation, blotting, imaging, and related workflows.",
    href: "/products#brands",
    searchKey: "cleaverscientific",
    categories: ["Electrophoresis", "Gel Systems", "Blotting", "Imaging"],
  },
  {
    key: "seedburo",
    name: "Seedburo",
    area: "Agricultural Research",
    description: "Specialized instruments for seed, grain, moisture, germination, cleaning, and agricultural quality testing.",
    href: "/products#brands",
    searchKey: "seedburo",
    categories: ["Seed Testing", "Moisture Testing", "Grain Analysis", "Sample Preparation"],
  },
  {
    key: "aims",
    name: "AIMS",
    area: "Animal Identification",
    description: "Identification and data solutions designed for reliable laboratory animal research, tracking, and care.",
    href: "/products#brands",
    searchKey: "aims",
    categories: ["Animal Identification", "Identification Systems", "Accessories", "Research Support"],
  },
  {
    key: "bioplastics",
    name: "BIOplastics",
    area: "PCR & qPCR Consumables",
    description: "Precision laboratory plastic consumables engineered for consistent PCR, qPCR, and molecular diagnostic workflows.",
    href: "/products#brands",
    searchKey: "bioplastics",
    categories: ["Single Tubes", "Tube Strips", "PCR Plates", "Caps & Seals"],
  },
  {
    key: "cellfree",
    name: "CellFree Sciences",
    area: "Protein Expression",
    description: "Wheat-germ cell-free protein expression systems, reagents, kits, and services for advanced protein research.",
    href: "/products#brands",
    searchKey: "cellfreesciences",
    categories: ["Protein Expression", "Wheat Germ Systems", "Reagents & Kits", "Research Services"],
  },
  {
    key: "itschem",
    name: "ITSChem",
    area: "Research Materials",
    description: "Specialty research materials and responsive laboratory supply support for scientific and industrial workflows.",
    href: "/products#brands",
    searchKey: "itschem",
    categories: ["Research Materials", "Laboratory Supply", "Specialty Materials", "Sourcing Support"],
  },
  {
    key: "plaslabs",
    name: "PLAS-LABS",
    area: "Controlled Environments",
    description: "Controlled-atmosphere enclosures and handling systems for sensitive laboratory and animal research workflows.",
    href: "/products#brands",
    searchKey: "plaslabs",
    categories: ["Glove Boxes", "Enclosures", "Desiccators", "Animal Care"],
  },
];

function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 10h11" />
      <path d="m11 6 4 4-4 4" />
    </svg>
  );
}

export default function ProductsMegaMenu() {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeBrand = useMemo(
    () => (activeKey ? BRANDS.find((brand) => brand.key === activeKey) ?? null : null),
    [activeKey]
  );

  const cancelClose = () => {
    if (!closeTimer.current) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 240);
  };

  const closeMenu = () => {
    setOpen(false);
    setActiveKey(null);
  };

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
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
          className="fixed left-1/2 top-[76px] z-[70] w-[min(1240px,calc(100vw-40px))] -translate-x-1/2 pt-3"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
            <div className="flex items-center gap-5 border-b border-slate-200 bg-[#fbfaf8] px-7 py-5 lg:px-8">
              <div className="min-w-[210px]">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-600">ITS BIO PRODUCTS</div>
                <div className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#071d43]">Find your next solution</div>
              </div>

              <form action="/search" method="get" className="relative flex min-w-0 flex-1" onSubmit={closeMenu}>
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <SearchIcon />
                </span>
                <input
                  name="q"
                  required
                  aria-label="Search products"
                  placeholder="Search by product name or catalog number"
                  className="h-12 w-full rounded-full border border-slate-300 bg-white pl-12 pr-32 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                />
                <button className="absolute right-1.5 top-1.5 h-9 rounded-full bg-orange-600 px-5 text-xs font-semibold text-white transition hover:bg-orange-700">
                  Search
                </button>
              </form>

              <Link
                href="/products"
                onClick={closeMenu}
                className="hidden h-11 shrink-0 items-center gap-2 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:border-orange-300 hover:text-orange-600 lg:inline-flex"
              >
                Product Hub <ArrowIcon />
              </Link>
            </div>

            <div className="grid min-h-[430px] lg:grid-cols-[1.38fr_.82fr]">
              <div className="border-b border-slate-200 p-7 lg:border-b-0 lg:border-r lg:p-8">
                <div className="flex items-end justify-between gap-5">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">Explore by brand</div>
                    <h2 className="mt-1 text-[25px] font-semibold tracking-[-0.035em] text-[#071d43]">Specialists across the research workflow</h2>
                  </div>
                  <span className="hidden text-xs font-medium text-slate-400 sm:block">Hover to explore</span>
                </div>

                <div className="mt-6 grid overflow-hidden rounded-[24px] border border-slate-200 sm:grid-cols-2 xl:grid-cols-3">
                  {BRANDS.map((brand, index) => {
                    const active = activeKey === brand.key;
                    return (
                      <Link
                        key={brand.key}
                        href={brand.href}
                        onMouseEnter={() => setActiveKey(brand.key)}
                        onFocus={() => setActiveKey(brand.key)}
                        onClick={closeMenu}
                        className={[
                          "group/brand relative flex min-h-[104px] items-center justify-between gap-4 border-slate-200 px-5 py-4 transition duration-200",
                          active ? "z-10 bg-[#fff8f1] shadow-[inset_3px_0_0_#ea580c]" : "bg-white hover:bg-slate-50",
                          index % 3 !== 2 ? "xl:border-r" : "",
                          index < 6 ? "xl:border-b" : "",
                          index % 2 === 0 ? "sm:border-r xl:border-r" : "sm:border-r-0",
                          index < 8 ? "sm:border-b" : "",
                        ].join(" ")}
                      >
                        <div className="min-w-0">
                          <div className={`text-[10px] font-bold uppercase tracking-[0.16em] transition ${active ? "text-orange-600" : "text-slate-400 group-hover/brand:text-orange-500"}`}>
                            {brand.area}
                          </div>
                          <div className={`mt-1.5 truncate text-[15px] font-semibold tracking-[-0.015em] transition ${active ? "text-[#071d43]" : "text-slate-900"}`}>
                            {brand.name}
                          </div>
                        </div>
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs transition ${active ? "border-orange-200 bg-white text-orange-600" : "border-slate-200 text-slate-300 group-hover/brand:border-orange-200 group-hover/brand:text-orange-500"}`}>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </Link>
                    );
                  })}
                </div>

                <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-500">Not sure which brand fits your application?</p>
                  <Link href="/contact" onClick={closeMenu} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 transition hover:text-orange-600">
                    Ask our team <ArrowIcon />
                  </Link>
                </div>
              </div>

              <aside className="relative overflow-hidden bg-[#071d43] p-7 text-white lg:p-8">
                <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full border border-white/10" />
                <div className="pointer-events-none absolute right-12 top-12 h-40 w-40 rounded-full border border-dashed border-orange-400/20" />
                <div className="pointer-events-none absolute -bottom-28 -left-16 h-60 w-60 rounded-full border border-orange-400/10" />

                {activeBrand ? (
                  <div className="relative z-10 flex h-full flex-col" key={activeBrand.key}>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-400">{activeBrand.area}</div>
                      <h3 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.035em]">{activeBrand.name}</h3>
                      <p className="mt-4 text-sm leading-6 text-white/65">{activeBrand.description}</p>
                    </div>

                    <div className="mt-7">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Key product areas</div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {activeBrand.categories.map((category) => (
                          <div key={category} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-xs font-medium text-white/80">
                            {category}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-auto pt-7">
                      <Link
                        href={activeBrand.href}
                        onClick={closeMenu}
                        className="inline-flex h-11 items-center gap-3 rounded-full bg-orange-600 px-5 text-sm font-semibold text-white transition hover:bg-orange-500"
                      >
                        Explore {activeBrand.name} <ArrowIcon />
                      </Link>

                      <form action="/search" method="get" onSubmit={closeMenu} className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4">
                        <input type="hidden" name="brand" value={activeBrand.searchKey} />
                        <div className="relative min-w-0 flex-1">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35">
                            <SearchIcon className="h-4 w-4" />
                          </span>
                          <input
                            name="q"
                            required
                            aria-label={`Search ${activeBrand.name}`}
                            placeholder={`Search ${activeBrand.name}`}
                            className="h-10 w-full rounded-full border border-white/15 bg-white/[0.07] pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/35 focus:border-orange-400"
                          />
                        </div>
                        <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#071d43] transition hover:bg-orange-50 hover:text-orange-700" aria-label={`Search ${activeBrand.name}`}>
                          <SearchIcon className="h-4 w-4" />
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <div className="relative z-10 flex h-full flex-col">
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-400">ITS BIO PORTFOLIO</div>
                    <h3 className="mt-3 max-w-sm text-[29px] font-semibold leading-[1.12] tracking-[-0.04em]">
                      One place to explore specialized scientific brands.
                    </h3>
                    <p className="mt-4 max-w-sm text-sm leading-6 text-white/65">
                      Move across the brand list to preview each partner, its focus, and major product areas without leaving the menu.
                    </p>

                    <div className="mt-8 grid grid-cols-2 gap-2">
                      {["Life Science", "Animal Research", "Lab Equipment", "PCR & qPCR", "Protein Expression", "Research Materials"].map((area) => (
                        <div key={area} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-xs font-medium text-white/65">
                          {area}
                        </div>
                      ))}
                    </div>

                    <div className="mt-auto border-t border-white/10 pt-5">
                      <div className="flex items-center gap-3 text-xs text-white/45">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-orange-400/25 text-orange-400">↗</span>
                        Hover a brand to see its product areas and quick actions.
                      </div>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
