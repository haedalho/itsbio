"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type MenuLink = { label: string; href: string };
type MenuSection = { label: string; links: MenuLink[] };
type BrandMenu = {
  key: string;
  name: string;
  area: string;
  description: string;
  href: string;
  searchKey?: string;
  categories?: string[];
  sections?: MenuSection[];
  dotClass: string;
  accentClass: string;
};

const BRANDS: BrandMenu[] = [
  {
    key: "abm",
    name: "ABM",
    area: "Life Science",
    description: "Research reagents, cellular materials, genetic materials, and custom research services.",
    href: "/products/abm",
    dotClass: "bg-orange-500",
    accentClass: "text-orange-700",
    sections: [
      {
        label: "Product families",
        links: [
          { label: "General Materials", href: "/products/abm/general-materials" },
          { label: "Cellular Materials", href: "/products/abm/cellular-materials" },
          { label: "Genetic Materials", href: "/products/abm/genetic-materials" },
          { label: "Services", href: "/products/abm/services" },
        ],
      },
    ],
  },
  {
    key: "kent",
    name: "Kent Scientific",
    area: "Animal Research",
    description: "Laboratory animal anesthesia, ventilation, monitoring, surgery, warming, identification, and handling systems.",
    href: "/products/kent",
    dotClass: "bg-blue-600",
    accentClass: "text-blue-700",
    sections: [
      {
        label: "Product categories",
        links: [
          { label: "Anesthesia", href: "/products/kent/anesthesia" },
          { label: "Ventilation", href: "/products/kent/ventilation" },
          { label: "Physiological Monitoring", href: "/products/kent/physiological-monitoring" },
          { label: "Noninvasive Blood Pressure", href: "/products/kent/noninvasive-blood-pressure" },
          { label: "Surgery", href: "/products/kent/surgery" },
          { label: "Warming", href: "/products/kent/warming" },
          { label: "Rodent Identification", href: "/products/kent/rodent-identification" },
          { label: "Animal Handling", href: "/products/kent/animal-handling" },
          { label: "Syringe Pump", href: "/products/kent/syringe-pump" },
          { label: "Feeding Needles", href: "/products/kent/feeding-needles" },
        ],
      },
    ],
  },
  {
    key: "cleaver",
    name: "Cleaver Scientific",
    area: "Laboratory Equipment",
    description: "Electrophoresis, gel documentation, laboratory equipment, reagents, education products, accessories, and spares.",
    href: "/products/cleaver",
    dotClass: "bg-purple-600",
    accentClass: "text-purple-700",
    sections: [
      {
        label: "Main Products",
        links: [
          { label: "All Main Products", href: "/products/cleaver/main-products" },
          { label: "Electrophoresis Systems", href: "/products/cleaver/main-products/electrophoresis-systems" },
          { label: "Gel Documentation & Imaging", href: "/products/cleaver/main-products/gel-documentation-imaging" },
          { label: "General Laboratory Equipment", href: "/products/cleaver/main-products/general-laboratory-equipment" },
          { label: "Electrophoresis Reagents", href: "/products/cleaver/main-products/electrophoresis-reagents" },
          { label: "Teaching & Education", href: "/products/cleaver/main-products/teaching-education" },
        ],
      },
      {
        label: "Accessories",
        links: [
          { label: "All Accessories", href: "/products/cleaver/accessories" },
          { label: "Electrophoresis Accessories", href: "/products/cleaver/accessories/electrophoresis-accessories" },
          { label: "Gel Documentation Accessories", href: "/products/cleaver/accessories/gel-documentation-accessories" },
          { label: "General Laboratory Accessories", href: "/products/cleaver/accessories/general-laboratory-accessories" },
          { label: "Replacement Parts & Spares", href: "/products/cleaver/accessories/replacement-parts-spares" },
        ],
      },
    ],
  },
  {
    key: "itschem",
    name: "ITSChem",
    area: "Research Materials",
    description: "Specialty research materials and responsive laboratory sourcing support.",
    href: "/products#brands",
    searchKey: "itschem",
    categories: ["Research Materials", "Laboratory Supply", "Specialty Materials", "Sourcing Support"],
    dotClass: "bg-rose-500",
    accentClass: "text-rose-700",
  },
  {
    key: "aims",
    name: "AIMS",
    area: "Animal Identification",
    description: "Identification systems and accessories for laboratory animal research.",
    href: "/products#brands",
    searchKey: "aims",
    categories: ["Lab Animal Identification System", "AIMS Accessories"],
    dotClass: "bg-sky-600",
    accentClass: "text-sky-700",
  },
  {
    key: "seedburo",
    name: "Seedburo",
    area: "Agricultural Research",
    description: "Seed, grain, moisture, germination, cleaning, and agricultural quality testing instruments.",
    href: "/products#brands",
    searchKey: "seedburo",
    categories: ["Divider", "Density Measurement", "Sieve Shakers", "Seed Counting & Analysis", "Grinders & Mills", "Moisture Testers", "Germination Equipment", "Grain & Seed Cleaners"],
    dotClass: "bg-green-600",
    accentClass: "text-green-700",
  },
  {
    key: "bioplastics",
    name: "BIOplastics",
    area: "PCR & qPCR Consumables",
    description: "Precision laboratory plastic consumables for PCR, qPCR, and molecular workflows.",
    href: "/products#brands",
    searchKey: "bioplastics",
    categories: ["Single Tubes", "Tube Strips", "Tube Strips with Caps", "Plates", "Cap Strips, Mats & Seals"],
    dotClass: "bg-amber-400",
    accentClass: "text-amber-700",
  },
  {
    key: "cellfree",
    name: "CellFree Sciences",
    area: "Protein Expression",
    description: "Wheat-germ cell-free protein expression systems, vectors, reagents, kits, and services.",
    href: "/products#brands",
    searchKey: "cellfreesciences",
    categories: ["pEU Vector", "Protein Expression Kits", "Reagents"],
    dotClass: "bg-blue-900",
    accentClass: "text-blue-900",
  },
  {
    key: "plaslabs",
    name: "PLAS-LABS",
    area: "Controlled Environments",
    description: "Controlled-atmosphere enclosures and handling systems for laboratory and animal research.",
    href: "/products#brands",
    searchKey: "plaslabs",
    categories: ["Glove Boxes", "Glove Box Accessories", "Animal Care & Research", "PCR Chambers", "Desiccators", "Tissue Culture Hoods"],
    dotClass: "bg-slate-900",
    accentClass: "text-slate-900",
  },
  {
    key: "affinity",
    name: "Affinity Immuno",
    area: "Immunoassays",
    description: "Immunoassay products and antibody solutions for life science and diagnostic research.",
    href: "/products#brands",
    searchKey: "affinityimmuno",
    categories: ["ELISA", "Antibodies", "COVID-19", "IgEasY"],
    dotClass: "bg-cyan-500",
    accentClass: "text-sky-700",
  },
  {
    key: "dogen",
    name: "DoGen",
    area: "Cell & Protein Research",
    description: "Research solutions for cell-based assays and protein biochemistry applications.",
    href: "/products#brands",
    searchKey: "dogen",
    categories: ["Cell Based Assay", "Protein Biochemistry"],
    dotClass: "bg-red-800",
    accentClass: "text-red-800",
  },
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 10h11" />
      <path d="m11 6 4 4-4 4" />
    </svg>
  );
}

export default function ProductsMegaMenuFast() {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState("abm");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeBrand = useMemo(() => BRANDS.find((brand) => brand.key === activeKey) || BRANDS[0], [activeKey]);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };
  const closeMenu = () => setOpen(false);

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

  const genericLinks = (activeBrand.categories || []).map((label) => ({
    label,
    href: `/search?q=${encodeURIComponent(label)}&brand=${encodeURIComponent(activeBrand.searchKey || activeBrand.key)}`,
  }));

  return (
    <div ref={rootRef} className="relative" onMouseEnter={() => { cancelClose(); setOpen(true); }} onMouseLeave={scheduleClose}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        className="group inline-flex h-[76px] items-center gap-1.5 transition hover:text-orange-600 focus:outline-none"
      >
        Products
        <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-180 text-orange-600" : "text-slate-400"}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="m5.5 7.5 4.5 4.5 4.5-4.5" />
        </svg>
      </button>

      {open ? (
        <div className="fixed left-1/2 top-[76px] z-[70] w-[min(1180px,calc(100vw-30px))] -translate-x-1/2 pt-3" onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.16)]">
            <div className="grid max-h-[calc(100vh-105px)] grid-cols-[230px_minmax(0,1fr)] overflow-hidden">
              <aside className="overflow-y-auto border-r border-slate-200 bg-slate-50/80 p-4">
                <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Brands & Solutions</div>
                <div className="space-y-0.5">
                  {BRANDS.map((brand) => {
                    const active = brand.key === activeBrand.key;
                    return (
                      <button
                        key={brand.key}
                        type="button"
                        onMouseEnter={() => setActiveKey(brand.key)}
                        onFocus={() => setActiveKey(brand.key)}
                        onClick={() => setActiveKey(brand.key)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${active ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-white/80"}`}
                      >
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${brand.dotClass}`} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-slate-800">{brand.name}</span>
                          <span className="mt-0.5 block truncate text-[9px] uppercase tracking-[0.11em] text-slate-400">{brand.area}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <section className="min-w-0 overflow-y-auto p-7">
                <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-5">
                  <div className="min-w-0">
                    <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${activeBrand.accentClass}`}>{activeBrand.area}</div>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#071d43]">{activeBrand.name}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{activeBrand.description}</p>
                  </div>
                  <Link href={activeBrand.href} prefetch={false} onClick={closeMenu} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">
                    Explore brand <ArrowIcon />
                  </Link>
                </div>

                {activeBrand.sections?.length ? (
                  <div className={`mt-6 grid gap-8 ${activeBrand.sections.length > 1 ? "xl:grid-cols-2" : ""}`}>
                    {activeBrand.sections.map((section) => (
                      <div key={section.label}>
                        <div className={`mb-2 text-[11px] font-bold uppercase tracking-[0.16em] ${activeBrand.accentClass}`}>{section.label}</div>
                        <div className="grid gap-x-7 sm:grid-cols-2">
                          {section.links.map((item) => (
                            <Link key={item.href} href={item.href} prefetch={false} onClick={closeMenu} className="group flex min-h-10 items-center justify-between gap-3 border-b border-slate-100 py-2 text-[13px] font-medium text-slate-700 transition hover:border-slate-200 hover:text-slate-950">
                              <span>{item.label}</span>
                              <span className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"><ArrowIcon /></span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6">
                    <div className={`mb-2 text-[11px] font-bold uppercase tracking-[0.16em] ${activeBrand.accentClass}`}>Product categories</div>
                    <div className="grid gap-x-7 sm:grid-cols-2 xl:grid-cols-3">
                      {genericLinks.map((item) => (
                        <Link key={item.label} href={item.href} prefetch={false} onClick={closeMenu} className="group flex min-h-10 items-center justify-between gap-3 border-b border-slate-100 py-2 text-[13px] font-medium text-slate-700 transition hover:border-slate-200 hover:text-slate-950">
                          <span>{item.label}</span>
                          <span className="opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"><ArrowIcon /></span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-7 flex justify-end border-t border-slate-100 pt-4">
                  <Link href="/products" prefetch={false} onClick={closeMenu} className="text-xs font-semibold text-slate-500 transition hover:text-orange-600">View all brands →</Link>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
