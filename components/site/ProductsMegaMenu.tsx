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
  ring: string;
  dot: string;
};

type Brand = {
  key: string;
  name: string;
  area: string;
  description: string;
  href: string;
  searchKey: string;
  categories: string[];
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
    ring: "focus:ring-orange-100",
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
    ring: "focus:ring-blue-100",
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
    ring: "focus:ring-rose-100",
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
    ring: "focus:ring-sky-100",
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
    ring: "focus:ring-green-100",
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
    ring: "focus:ring-yellow-100",
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
    ring: "focus:ring-purple-100",
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
    ring: "focus:ring-blue-100",
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
    ring: "focus:ring-slate-200",
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
    ring: "focus:ring-sky-100",
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
    ring: "focus:ring-red-100",
    dot: "bg-red-800",
  },
};

const BRANDS: Brand[] = [
  {
    key: "abm",
    name: "ABM",
    area: "Life Science",
    description: "Research reagents, cell biology products, genetic materials, molecular tools, and custom research services.",
    href: "/products/abm",
    searchKey: "abm",
    categories: [
      "General Materials",
      "PCR Enzymes",
      "Enzymes & Kits",
      "Antibodies",
      "Biorepository",
      "Transfection Reagents",
      "DNA / RNA Purification",
      "Gel Documentation",
      "Cellular Materials",
      "Cell Library Collections",
      "3D & Organoid",
      "Media & Supplements",
      "Genetic Materials",
      "Viral Vectors",
      "CRISPR",
      "Expression Systems",
      "Custom Services",
    ],
    theme: THEMES.abm,
  },
  {
    key: "kent",
    name: "Kent Scientific",
    area: "Animal Research",
    description: "Integrated systems for laboratory animal anesthesia, ventilation, monitoring, surgery, warming, identification, and handling.",
    href: "/products/kent",
    searchKey: "kent",
    categories: [
      "Anesthesia",
      "Ventilation",
      "Physiological Monitoring",
      "Noninvasive Blood Pressure",
      "Surgery",
      "Warming",
      "Rodent Identification",
      "Animal Handling",
      "Syringe Pump",
      "Feeding Needles",
    ],
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
    categories: [
      "Divider",
      "Density Measurement",
      "Sieve Shakers, Test Sieves & Screens",
      "Seed Counting & Analysis",
      "Farm & Ranch",
      "Grinders & Mills",
      "Moisture Testers",
      "Spiral Separators",
      "Sample Bags & Containers",
      "Germination Equipment",
      "Grain & Seed Cleaners",
    ],
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
    categories: [
      "Glove Boxes",
      "Glove Box Accessories",
      "Custom Glove Boxes",
      "Animal Care & Research",
      "PCR Chambers",
      "Desiccators",
      "Ventilated Balance Enclosures",
      "Lab CO2 / Vacuum Chambers",
      "Tissue Culture Hoods",
      "Stream Tables",
    ],
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

const QUICK_LINKS = [
  { label: "Product Hub", href: "/products" },
  { label: "Catalog Search", href: "/search" },
  { label: "Promotions", href: "/promotions" },
  { label: "Notice", href: "/notice" },
  { label: "Request a Quote", href: "/quote" },
  { label: "Contact", href: "/contact" },
];

function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

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

  const activeBrand = useMemo(
    () => BRANDS.find((brand) => brand.key === activeKey) ?? BRANDS[0],
    [activeKey]
  );
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
          className="fixed left-1/2 top-[76px] z-[70] w-[min(1340px,calc(100vw-28px))] -translate-x-1/2 pt-3"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="max-h-[calc(100vh-94px)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.17)]">
            <div className={`relative overflow-hidden bg-gradient-to-r ${theme.gradient} px-7 py-4 text-white transition-colors duration-300`}>
              <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full border border-white/15" />
              <div className="pointer-events-none absolute right-[25%] -bottom-24 h-44 w-44 rounded-full border border-white/10" />
              <div className="relative flex items-center gap-5">
                <div className="min-w-[245px]">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">ITS BIO PRODUCT PORTFOLIO</div>
                  <div className="mt-1 text-[18px] font-semibold tracking-[-0.02em]">{activeBrand.name}</div>
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
                    className={`h-12 w-full rounded-full border border-white/40 bg-white pl-12 pr-32 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-4 ${theme.ring}`}
                  />
                  <button className={`absolute right-1.5 top-1.5 h-9 rounded-full px-5 text-xs font-semibold text-white shadow-sm ${theme.button}`}>
                    Search
                  </button>
                </form>

                <Link
                  href="/products"
                  onClick={closeMenu}
                  className="hidden h-11 shrink-0 items-center gap-2 rounded-full border border-white/40 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white hover:text-slate-900 lg:inline-flex"
                >
                  Product Hub <ArrowIcon />
                </Link>
              </div>
            </div>

            <div className="grid min-h-[548px] lg:grid-cols-[230px_1fr_270px]">
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
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-600">{activeBrand.description}</p>
                  </div>
                  <Link
                    href={activeBrand.href}
                    onClick={closeMenu}
                    className={`hidden h-10 shrink-0 items-center gap-2 rounded-full border bg-white px-4 text-xs font-semibold transition xl:inline-flex ${theme.border} ${theme.text} ${theme.activeBg}`}
                  >
                    Explore brand <ArrowIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Product categories</div>
                    <span className="text-[11px] text-slate-400">Choose a category to search within this brand</span>
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
                </div>

                <form action="/search" method="get" onSubmit={closeMenu} className="relative mt-5 border-t border-slate-200 pt-5">
                  <input type="hidden" name="brand" value={activeBrand.searchKey} />
                  <span className="pointer-events-none absolute left-3.5 top-[37px] -translate-y-1/2 text-slate-400">
                    <SearchIcon className="h-4 w-4" />
                  </span>
                  <input
                    name="q"
                    required
                    aria-label={`Search ${activeBrand.name}`}
                    placeholder={`Search within ${activeBrand.name}`}
                    className={`h-10 w-full rounded-full border border-slate-300 bg-white pl-10 pr-28 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:ring-4 ${theme.ring}`}
                  />
                  <button className={`absolute right-1 top-6 h-8 rounded-full px-4 text-[11px] font-semibold text-white ${theme.button}`}>
                    Search
                  </button>
                </form>
              </section>

              <aside className={`relative overflow-hidden p-6 transition-colors duration-300 ${theme.softBg}`}>
                <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full border border-slate-200/70" />
                <div className={`pointer-events-none absolute right-7 top-28 h-3 w-3 rounded-full ${theme.dot} opacity-20`} />

                <div className="relative z-10">
                  <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${theme.text}`}>Quick access</div>
                  <div className="mt-4 space-y-1">
                    {QUICK_LINKS.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={closeMenu}
                        className={`group/quick flex items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-white ${theme.hoverText} ${theme.hoverBorder}`}
                      >
                        <span>{item.label}</span>
                        <ArrowIcon className="h-3.5 w-3.5 text-slate-300 transition group-hover/quick:translate-x-0.5" />
                      </Link>
                    ))}
                  </div>

                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Need help?</div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">Tell us your application, product name, or catalog number and we can help identify the right option.</p>
                    <Link
                      href="/contact"
                      onClick={closeMenu}
                      className={`mt-4 inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold text-white shadow-sm ${theme.button}`}
                    >
                      Ask our team <ArrowIcon className="h-3.5 w-3.5" />
                    </Link>
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
