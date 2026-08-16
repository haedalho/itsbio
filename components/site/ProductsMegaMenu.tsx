"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type BrandTheme = {
  gradient: string;
  softBg: string;
  activeBg: string;
  border: string;
  text: string;
  hoverText: string;
  hoverBorder: string;
  button: string;
  dot: string;
};

type CategoryGroup = {
  label: string;
  href: string;
  items: string[];
};

type Brand = {
  key: string;
  name: string;
  area: string;
  description: string;
  href: string;
  searchKey: string;
  categories: string[];
  groups?: CategoryGroup[];
  theme: BrandTheme;
};

const THEMES: Record<string, BrandTheme> = {
  abm: {
    gradient: "from-orange-600 via-orange-500 to-orange-400",
    softBg: "bg-orange-50/55",
    activeBg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    hoverText: "hover:text-orange-700",
    hoverBorder: "hover:border-orange-200",
    button: "bg-orange-600 hover:bg-orange-700",
    dot: "bg-orange-500",
  },
  kent: {
    gradient: "from-blue-700 via-blue-600 to-blue-500",
    softBg: "bg-blue-50/55",
    activeBg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    hoverText: "hover:text-blue-700",
    hoverBorder: "hover:border-blue-200",
    button: "bg-blue-600 hover:bg-blue-700",
    dot: "bg-blue-500",
  },
  itschem: {
    gradient: "from-rose-600 via-rose-500 to-rose-400",
    softBg: "bg-rose-50/55",
    activeBg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-700",
    hoverText: "hover:text-rose-700",
    hoverBorder: "hover:border-rose-200",
    button: "bg-rose-600 hover:bg-rose-700",
    dot: "bg-rose-500",
  },
  aims: {
    gradient: "from-sky-700 via-sky-600 to-sky-500",
    softBg: "bg-sky-50/55",
    activeBg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-700",
    hoverText: "hover:text-sky-700",
    hoverBorder: "hover:border-sky-200",
    button: "bg-sky-600 hover:bg-sky-700",
    dot: "bg-sky-500",
  },
  seedburo: {
    gradient: "from-green-700 via-green-600 to-green-500",
    softBg: "bg-green-50/55",
    activeBg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    hoverText: "hover:text-green-700",
    hoverBorder: "hover:border-green-200",
    button: "bg-green-600 hover:bg-green-700",
    dot: "bg-green-500",
  },
  bioplastics: {
    gradient: "from-yellow-400 via-amber-300 to-amber-200",
    softBg: "bg-yellow-50/65",
    activeBg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-700",
    hoverText: "hover:text-yellow-700",
    hoverBorder: "hover:border-yellow-200",
    button: "bg-yellow-400 hover:bg-yellow-500 text-slate-950",
    dot: "bg-yellow-400",
  },
  cleaver: {
    gradient: "from-purple-700 via-purple-600 to-purple-500",
    softBg: "bg-purple-50/55",
    activeBg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    hoverText: "hover:text-purple-700",
    hoverBorder: "hover:border-purple-200",
    button: "bg-purple-600 hover:bg-purple-700",
    dot: "bg-purple-500",
  },
  cellfree: {
    gradient: "from-blue-950 via-blue-900 to-blue-700",
    softBg: "bg-blue-50/50",
    activeBg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-900",
    hoverText: "hover:text-blue-900",
    hoverBorder: "hover:border-blue-200",
    button: "bg-blue-900 hover:bg-blue-950",
    dot: "bg-blue-900",
  },
  plaslabs: {
    gradient: "from-slate-950 via-slate-900 to-slate-700",
    softBg: "bg-slate-50/75",
    activeBg: "bg-slate-100",
    border: "border-slate-300",
    text: "text-slate-900",
    hoverText: "hover:text-slate-950",
    hoverBorder: "hover:border-slate-400",
    button: "bg-slate-900 hover:bg-slate-950",
    dot: "bg-slate-900",
  },
  affinity: {
    gradient: "from-sky-500 via-cyan-400 to-cyan-300",
    softBg: "bg-cyan-50/55",
    activeBg: "bg-cyan-50",
    border: "border-cyan-200",
    text: "text-sky-700",
    hoverText: "hover:text-sky-700",
    hoverBorder: "hover:border-sky-200",
    button: "bg-sky-500 hover:bg-sky-600",
    dot: "bg-sky-400",
  },
  dogen: {
    gradient: "from-red-950 via-red-800 to-red-700",
    softBg: "bg-red-50/55",
    activeBg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    hoverText: "hover:text-red-800",
    hoverBorder: "hover:border-red-200",
    button: "bg-red-800 hover:bg-red-900",
    dot: "bg-red-800",
  },
};

const ABM_GROUPS: CategoryGroup[] = [
  {
    label: "General Materials",
    href: "/products/abm/general-materials",
    items: [
      "PCR Enzymes",
      "Enzymes & Kits",
      "Antibodies",
      "Biorepository",
      "Transfection Reagents",
      "DNA / RNA Purification",
      "Gel Documentation",
      "RNA Tracking",
      "Buffers & General Chemicals",
      "Equipment",
      "DNA & Protein Ladders",
    ],
  },
  {
    label: "Cellular Materials",
    href: "/products/abm/cellular-materials",
    items: [
      "Cell Library Collections",
      "3D & Organoid",
      "Hematopoietic Cells",
      "Microbial Contamination",
      "Cell Immortalization Reagents",
      "Media & Supplements",
      "Growth Factors & Cytokines",
      "Cell Freezing",
      "Culture Consumables",
      "Cell Assay Products",
      "Cell Culture Equipment",
    ],
  },
  {
    label: "Genetic Materials",
    href: "/products/abm/genetic-materials",
    items: [
      "Expression-Ready Libraries",
      "CRISPR",
      "Expression Systems",
      "Specialized Vectors",
      "Kits for Viral Vectors",
    ],
  },
  {
    label: "Services",
    href: "/products/abm/services",
    items: [
      "Cell & Antibody Services",
      "DNA & Cloning Services",
      "Recombinant Virus Packaging",
    ],
  },
];

const BRANDS: Brand[] = [
  {
    key: "abm",
    name: "ABM",
    area: "Life Science",
    description: "Research reagents, cell biology products, genetic materials, molecular tools, and custom research services.",
    href: "/products/abm",
    searchKey: "abm",
    categories: [],
    groups: ABM_GROUPS,
    theme: THEMES.abm,
  },
  {
    key: "kent",
    name: "Kent Scientific",
    area: "Animal Research",
    description: "Integrated systems for laboratory animal anesthesia, ventilation, monitoring, surgery, warming, identification, and handling.",
    href: "/products/kent",
    searchKey: "kent",
    categories: ["Anesthesia", "Ventilation", "Physiological Monitoring", "Noninvasive Blood Pressure", "Surgery", "Warming", "Rodent Identification", "Animal Handling", "Syringe Pump", "Feeding Needles"],
    theme: THEMES.kent,
  },
  {
    key: "itschem",
    name: "ITSChem",
    area: "Research Materials",
    description: "Specialty research materials and responsive laboratory sourcing support for scientific and industrial workflows.",
    href: "/products#brands",
    searchKey: "itschem",
    categories: ["Research Materials", "Laboratory Supply", "Specialty Materials", "Sourcing Support"],
    theme: THEMES.itschem,
  },
  {
    key: "aims",
    name: "AIMS",
    area: "Animal Identification",
    description: "Identification systems and accessories designed to support reliable laboratory animal research and care.",
    href: "/products#brands",
    searchKey: "aims",
    categories: ["Lab Animal Identification System", "AIMS Accessories"],
    theme: THEMES.aims,
  },
  {
    key: "seedburo",
    name: "Seedburo",
    area: "Agricultural Research",
    description: "Specialized instruments for seed, grain, moisture, germination, cleaning, and agricultural quality testing.",
    href: "/products#brands",
    searchKey: "seedburo",
    categories: ["Divider", "Density Measurement", "Sieve Shakers, Test Sieves & Screens", "Seed Counting & Analysis", "Farm & Ranch", "Grinders & Mills", "Moisture Testers", "Spiral Separators", "Sample Bags & Containers", "Germination Equipment", "Grain & Seed Cleaners"],
    theme: THEMES.seedburo,
  },
  {
    key: "bioplastics",
    name: "BIOplastics",
    area: "PCR & qPCR Consumables",
    description: "Precision laboratory plastic consumables for consistent PCR, qPCR, and molecular diagnostic workflows.",
    href: "/products#brands",
    searchKey: "bioplastics",
    categories: ["Single Tubes", "Tube Strips", "Tube Strips with Caps", "Plates", "Cap Strips, Mats & Seals"],
    theme: THEMES.bioplastics,
  },
  {
    key: "cleaver",
    name: "Cleaver Scientific",
    area: "Laboratory Equipment",
    description: "Practical equipment for electrophoresis, gel documentation, blotting, power supply, and clinical laboratory workflows.",
    href: "/products#brands",
    searchKey: "cleaverscientific",
    categories: ["Horizontal Gel Systems", "Vertical, Blotting & DGGE", "Power Supplies", "Clinical & Pharmaceutical", "Gel Documentation"],
    theme: THEMES.cleaver,
  },
  {
    key: "cellfree",
    name: "CellFree Sciences",
    area: "Protein Expression",
    description: "Wheat-germ cell-free protein expression systems, vectors, reagents, kits, and services for advanced protein research.",
    href: "/products#brands",
    searchKey: "cellfreesciences",
    categories: ["pEU Vector", "Protein Expression Kits", "Reagents"],
    theme: THEMES.cellfree,
  },
  {
    key: "plaslabs",
    name: "PLAS-LABS",
    area: "Controlled Environments",
    description: "Controlled-atmosphere enclosures and handling systems for sensitive laboratory and animal research workflows.",
    href: "/products#brands",
    searchKey: "plaslabs",
    categories: ["Glove Boxes", "Glove Box Accessories", "Custom Glove Boxes", "Animal Care & Research", "PCR Chambers", "Desiccators", "Ventilated Balance Enclosures", "Lab CO2 / Vacuum Chambers", "Tissue Culture Hoods", "Stream Tables"],
    theme: THEMES.plaslabs,
  },
  {
    key: "affinity",
    name: "Affinity Immuno",
    area: "Immunoassays",
    description: "Immunoassay products and antibody solutions for life science and diagnostic research workflows.",
    href: "/products#brands",
    searchKey: "affinityimmuno",
    categories: ["ELISA", "Antibodies", "COVID-19", "IgEasY"],
    theme: THEMES.affinity,
  },
  {
    key: "dogen",
    name: "DoGen",
    area: "Cell & Protein Research",
    description: "Research solutions for cell-based assays and protein biochemistry applications.",
    href: "/products#brands",
    searchKey: "dogen",
    categories: ["Cell Based Assay", "Protein Biochemistry"],
    theme: THEMES.dogen,
  },
];

function ArrowIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 10h11" />
      <path d="m11 6 4 4-4 4" />
    </svg>
  );
}

export default function ProductsMegaMenu() {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState("abm");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeBrand = useMemo(() => BRANDS.find((brand) => brand.key === activeKey) ?? BRANDS[0], [activeKey]);
  const theme = activeBrand.theme;

  const cancelClose = () => {
    if (!closeTimer.current) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 240);
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
          className="fixed left-1/2 top-[76px] z-[70] w-[min(1340px,calc(100vw-30px))] -translate-x-1/2 pt-3"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="max-h-[calc(100vh-94px)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.17)]">
            <div className={`relative overflow-hidden bg-gradient-to-r ${theme.gradient} px-7 py-5 text-white transition-colors duration-300`}>
              <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full border border-white/15" />
              <div className="pointer-events-none absolute right-[23%] -bottom-24 h-44 w-44 rounded-full border border-white/10" />
              <div className="relative flex items-center justify-between gap-6">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">ITS BIO PRODUCT PORTFOLIO</div>
                  <div className="mt-1 text-[20px] font-semibold tracking-[-0.025em]">{activeBrand.name}</div>
                </div>
                <Link
                  href="/products"
                  onClick={closeMenu}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/40 bg-white/10 px-5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white hover:text-slate-900"
                >
                  View all brands <ArrowIcon className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="grid min-h-[520px] lg:grid-cols-[225px_1fr_265px]">
              <aside className={`border-b border-slate-200 p-5 transition-colors duration-300 lg:border-b-0 lg:border-r ${theme.softBg}`}>
                <div className="px-2 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Browse by brand</div>
                <div className="space-y-1">
                  {BRANDS.map((brand) => {
                    const active = activeBrand.key === brand.key;
                    return (
                      <button
                        key={brand.key}
                        type="button"
                        onMouseEnter={() => setActiveKey(brand.key)}
                        onFocus={() => setActiveKey(brand.key)}
                        onClick={() => setActiveKey(brand.key)}
                        className={[
                          "group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition",
                          active ? `${brand.theme.activeBg} ${brand.theme.text}` : "text-slate-800 hover:bg-white",
                        ].join(" ")}
                      >
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${brand.theme.dot}`} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold">{brand.name}</span>
                          <span className="mt-0.5 block truncate text-[9px] uppercase tracking-[0.12em] text-slate-400">{brand.area}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <section className="min-w-0 border-b border-slate-200 p-6 lg:border-b-0 lg:border-r lg:p-7">
                <div className="flex items-start justify-between gap-8 border-b border-slate-200 pb-5">
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${theme.text}`}>{activeBrand.area}</div>
                    <h2 className="mt-1.5 text-[27px] font-semibold tracking-[-0.035em] text-[#071d43]">{activeBrand.name}</h2>
                  </div>
                  <Link
                    href={activeBrand.href}
                    onClick={closeMenu}
                    className={`hidden h-10 shrink-0 items-center gap-2 rounded-full border bg-white px-4 text-xs font-semibold transition xl:inline-flex ${theme.border} ${theme.text} ${theme.activeBg}`}
                  >
                    Explore brand <ArrowIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {activeBrand.groups ? (
                  <div className="mt-5">
                    <div className="mb-4 flex items-end justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">ABM product families</div>
                        <div className="mt-1 text-sm text-slate-500">Start with a major family, then choose a product area.</div>
                      </div>
                    </div>

                    <div className="grid gap-x-8 gap-y-8 xl:grid-cols-2">
                      {activeBrand.groups.map((group) => (
                        <section key={group.label} className="min-w-0 border-t-[3px] border-orange-500 pt-3">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-[9px] font-bold uppercase tracking-[0.23em] text-orange-500">Product family</div>
                              <Link
                                href={group.href}
                                onClick={closeMenu}
                                className="group/family mt-1.5 inline-flex items-center gap-3 text-[20px] font-semibold leading-tight tracking-[-0.03em] text-[#071d43] transition hover:text-orange-700"
                              >
                                {group.label}
                                <ArrowIcon className="h-4 w-4 text-orange-500 transition group-hover/family:translate-x-1" />
                              </Link>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-x-5">
                            {group.items.map((item) => (
                              <Link
                                key={item}
                                href={`/search?q=${encodeURIComponent(item)}&brand=abm`}
                                onClick={closeMenu}
                                className="group/item flex min-h-8 items-start gap-2 border-b border-slate-100 py-1.5 text-[11.5px] leading-4 text-slate-600 transition hover:border-orange-100 hover:text-orange-700"
                              >
                                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-orange-400" />
                                <span>{item}</span>
                              </Link>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-5 flex items-center justify-between gap-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Product categories</div>
                      <span className="text-[11px] text-slate-400">Explore products by category</span>
                    </div>
                    <div className="mt-3 grid gap-x-7 sm:grid-cols-2 xl:grid-cols-3">
                      {activeBrand.categories.map((category) => (
                        <Link
                          key={category}
                          href={`/search?q=${encodeURIComponent(category)}&brand=${encodeURIComponent(activeBrand.searchKey)}`}
                          onClick={closeMenu}
                          className={`group/category flex min-h-10 items-center justify-between gap-3 border-b border-slate-200 py-2 text-[13px] font-medium text-slate-700 transition ${theme.hoverText} ${theme.hoverBorder}`}
                        >
                          <span>{category}</span>
                          <ArrowIcon className={`h-3.5 w-3.5 shrink-0 -translate-x-1 opacity-0 transition group-hover/category:translate-x-0 group-hover/category:opacity-100 ${theme.text}`} />
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <aside className={`relative overflow-hidden p-7 transition-colors duration-300 ${theme.softBg}`}>
                <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full border border-slate-200/70" />
                <div className={`pointer-events-none absolute right-7 top-28 h-3 w-3 rounded-full ${theme.dot} opacity-20`} />

                <div className="relative z-10 flex h-full flex-col">
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${theme.text}`}>About the brand</div>
                    <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-[#071d43]">{activeBrand.name}</h3>
                    <p className="mt-3 text-xs leading-6 text-slate-600">{activeBrand.description}</p>
                  </div>

                  {activeBrand.groups ? (
                    <div className="mt-7 border-t border-slate-200 pt-5">
                      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Major families</div>
                      <div className="mt-3 space-y-2">
                        {activeBrand.groups.map((group) => (
                          <Link
                            key={group.label}
                            href={group.href}
                            onClick={closeMenu}
                            className="group/side flex items-center justify-between gap-3 border-b border-orange-100 pb-2.5 text-[12px] font-semibold text-slate-700 transition hover:text-orange-700"
                          >
                            <span>{group.label}</span>
                            <ArrowIcon className="h-3.5 w-3.5 text-orange-400 transition group-hover/side:translate-x-0.5" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-auto border-t border-slate-200 pt-5">
                    <Link
                      href={activeBrand.href}
                      onClick={closeMenu}
                      className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold text-white shadow-sm ${theme.button}`}
                    >
                      Explore {activeBrand.name} <ArrowIcon className="h-3.5 w-3.5" />
                    </Link>
                    <p className="mt-4 text-[11px] leading-5 text-slate-400">Need help choosing a product? Use the Request a Quote button available throughout the site.</p>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
