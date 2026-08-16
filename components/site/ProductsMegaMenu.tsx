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
  dot: string;
};

type CategoryGroup = {
  title: string;
  items: string[];
};

type Brand = {
  key: string;
  name: string;
  area: string;
  description: string;
  href: string;
  groups: CategoryGroup[];
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
    dot: "bg-orange-500",
  },
  kent: {
    gradient: "from-blue-700 via-blue-600 to-blue-500",
    softBg: "bg-blue-50/55",
    activeBg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    hoverText: "hover:text-blue-700",
    dot: "bg-blue-500",
  },
  itschem: {
    gradient: "from-rose-600 via-rose-500 to-rose-400",
    softBg: "bg-rose-50/55",
    activeBg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-700",
    hoverText: "hover:text-rose-700",
    dot: "bg-rose-500",
  },
  aims: {
    gradient: "from-sky-700 via-sky-600 to-sky-500",
    softBg: "bg-sky-50/55",
    activeBg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-700",
    hoverText: "hover:text-sky-700",
    dot: "bg-sky-500",
  },
  seedburo: {
    gradient: "from-green-700 via-green-600 to-green-500",
    softBg: "bg-green-50/55",
    activeBg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    hoverText: "hover:text-green-700",
    dot: "bg-green-500",
  },
  bioplastics: {
    gradient: "from-yellow-400 via-amber-300 to-amber-200",
    softBg: "bg-yellow-50/65",
    activeBg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-700",
    hoverText: "hover:text-yellow-700",
    dot: "bg-yellow-400",
  },
  cleaver: {
    gradient: "from-purple-700 via-purple-600 to-purple-500",
    softBg: "bg-purple-50/55",
    activeBg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    hoverText: "hover:text-purple-700",
    dot: "bg-purple-500",
  },
  cellfree: {
    gradient: "from-blue-950 via-blue-900 to-blue-700",
    softBg: "bg-blue-50/50",
    activeBg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-900",
    hoverText: "hover:text-blue-900",
    dot: "bg-blue-900",
  },
  plaslabs: {
    gradient: "from-slate-950 via-slate-900 to-slate-700",
    softBg: "bg-slate-50/75",
    activeBg: "bg-slate-100",
    border: "border-slate-300",
    text: "text-slate-900",
    hoverText: "hover:text-slate-950",
    dot: "bg-slate-900",
  },
  affinity: {
    gradient: "from-sky-500 via-cyan-400 to-cyan-300",
    softBg: "bg-cyan-50/55",
    activeBg: "bg-cyan-50",
    border: "border-cyan-200",
    text: "text-sky-700",
    hoverText: "hover:text-sky-700",
    dot: "bg-sky-400",
  },
  dogen: {
    gradient: "from-red-950 via-red-800 to-red-700",
    softBg: "bg-red-50/55",
    activeBg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    hoverText: "hover:text-red-800",
    dot: "bg-red-800",
  },
};

const BRANDS: Brand[] = [
  {
    key: "abm",
    name: "ABM",
    area: "Life Science",
    description: "Research reagents, cellular materials, genetic tools, and custom services for molecular and cellular biology.",
    href: "/products/abm",
    groups: [
      {
        title: "General Materials",
        items: [
          "PCR Enzymes",
          "Enzymes & Kits",
          "Antibodies",
          "Biorepository",
          "Transfection Reagents",
          "DNA / RNA Purification",
          "Gel Documentation",
          "RNA Tracking (RNA Mango)",
          "Buffers & General Chemicals",
          "Equipment",
          "DNA & Protein Ladders",
        ],
      },
      {
        title: "Cellular Materials",
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
        title: "Genetic Materials",
        items: [
          "Expression-Ready Libraries",
          "CRISPR",
          "Expression Systems",
          "Specialized Vectors",
          "Kits for Viral Vectors",
        ],
      },
      {
        title: "Services",
        items: [
          "Cell & Antibody Services",
          "DNA & Cloning Services",
          "Recombinant Virus Packaging",
        ],
      },
    ],
    theme: THEMES.abm,
  },
  {
    key: "kent",
    name: "Kent Scientific",
    area: "Animal Research",
    description: "Integrated systems for laboratory animal anesthesia, monitoring, surgery, warming, identification, and handling.",
    href: "/products/kent",
    groups: [
      {
        title: "Research Systems",
        items: [
          "Anesthesia",
          "Ventilation",
          "Physiological Monitoring",
          "Noninvasive Blood Pressure",
          "Surgery",
          "Warming",
        ],
      },
      {
        title: "Animal Care & Handling",
        items: ["Rodent Identification", "Animal Handling", "Syringe Pump", "Feeding Needles"],
      },
    ],
    theme: THEMES.kent,
  },
  {
    key: "itschem",
    name: "ITSChem",
    area: "Research Materials",
    description: "Specialty research materials and responsive laboratory sourcing support for scientific and industrial workflows.",
    href: "/products#brands",
    groups: [
      { title: "Research Materials", items: ["Laboratory Supply", "Specialty Materials", "Research Materials", "Sourcing Support"] },
    ],
    theme: THEMES.itschem,
  },
  {
    key: "aims",
    name: "AIMS",
    area: "Animal Identification",
    description: "Identification systems and accessories designed to support reliable laboratory animal research and care.",
    href: "/products#brands",
    groups: [
      { title: "Identification", items: ["Lab Animal Identification System", "AIMS Accessories"] },
    ],
    theme: THEMES.aims,
  },
  {
    key: "seedburo",
    name: "Seedburo",
    area: "Agricultural Research",
    description: "Specialized instruments for seed, grain, moisture, germination, cleaning, and agricultural quality testing.",
    href: "/products#brands",
    groups: [
      {
        title: "Seed & Grain Analysis",
        items: ["Divider", "Density Measurement", "Seed Counting & Analysis", "Moisture Testers", "Germination Equipment"],
      },
      {
        title: "Preparation & Handling",
        items: ["Sieve Shakers, Test Sieves & Screens", "Grinders & Mills", "Spiral Separators", "Grain & Seed Cleaners"],
      },
      {
        title: "Sampling & Field",
        items: ["Sample Bags & Containers", "Farm & Ranch"],
      },
    ],
    theme: THEMES.seedburo,
  },
  {
    key: "bioplastics",
    name: "BIOplastics",
    area: "PCR & qPCR Consumables",
    description: "Precision laboratory plastic consumables for consistent PCR, qPCR, and molecular diagnostic workflows.",
    href: "/products#brands",
    groups: [
      { title: "PCR Consumables", items: ["Single Tubes", "Tube Strips", "Tube Strips with Caps", "Plates", "Cap Strips, Mats & Seals"] },
    ],
    theme: THEMES.bioplastics,
  },
  {
    key: "cleaver",
    name: "Cleaver Scientific",
    area: "Laboratory Equipment",
    description: "Practical equipment for electrophoresis, gel documentation, blotting, power supply, and clinical laboratory workflows.",
    href: "/products#brands",
    groups: [
      { title: "Electrophoresis", items: ["Horizontal Gel Systems", "Vertical, Blotting & DGGE", "Power Supplies"] },
      { title: "Imaging & Clinical", items: ["Gel Documentation", "Clinical & Pharmaceutical"] },
    ],
    theme: THEMES.cleaver,
  },
  {
    key: "cellfree",
    name: "CellFree Sciences",
    area: "Protein Expression",
    description: "Wheat-germ cell-free protein expression systems, vectors, reagents, kits, and services for advanced protein research.",
    href: "/products#brands",
    groups: [
      { title: "Protein Expression", items: ["pEU Vector", "Protein Expression Kits", "Reagents"] },
    ],
    theme: THEMES.cellfree,
  },
  {
    key: "plaslabs",
    name: "PLAS-LABS",
    area: "Controlled Environments",
    description: "Controlled-atmosphere enclosures and handling systems for sensitive laboratory and animal research workflows.",
    href: "/products#brands",
    groups: [
      { title: "Glove Boxes", items: ["Glove Boxes", "Glove Box Accessories", "Custom Glove Boxes"] },
      { title: "Controlled Chambers", items: ["PCR Chambers", "Desiccators", "Lab CO2 / Vacuum Chambers"] },
      { title: "Laboratory Enclosures", items: ["Ventilated Balance Enclosures", "Tissue Culture Hoods", "Stream Tables"] },
      { title: "Animal Research", items: ["Animal Care & Research"] },
    ],
    theme: THEMES.plaslabs,
  },
  {
    key: "affinity",
    name: "Affinity Immuno",
    area: "Immunoassays",
    description: "Immunoassay products and antibody solutions for life science and diagnostic research workflows.",
    href: "/products#brands",
    groups: [
      { title: "Immunoassays", items: ["ELISA", "Antibodies", "COVID-19", "IgEasY"] },
    ],
    theme: THEMES.affinity,
  },
  {
    key: "dogen",
    name: "DoGen",
    area: "Cell & Protein Research",
    description: "Research solutions for cell-based assays and protein biochemistry applications.",
    href: "/products#brands",
    groups: [
      { title: "Research Solutions", items: ["Cell Based Assay", "Protein Biochemistry"] },
    ],
    theme: THEMES.dogen,
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function categoryHref(brand: Brand, group: string, item?: string) {
  if (brand.key === "abm") {
    const base = `/products/abm/${slugify(group)}`;
    return item ? `${base}/${slugify(item)}` : base;
  }

  if (brand.key === "kent") {
    const value = item || group;
    return `/products/kent/${slugify(value)}`;
  }

  return "/products#brands";
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
          className="fixed left-1/2 top-[76px] z-[70] w-[min(1280px,calc(100vw-32px))] -translate-x-1/2 pt-3"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="max-h-[calc(100vh-94px)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.17)]">
            <div className={`relative overflow-hidden bg-gradient-to-r ${theme.gradient} px-7 py-4 text-white transition-colors duration-300`}>
              <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full border border-white/15" />
              <div className="pointer-events-none absolute right-[22%] -bottom-24 h-44 w-44 rounded-full border border-white/10" />
              <div className="relative flex items-center justify-between gap-6">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">ITS BIO PRODUCT PORTFOLIO</div>
                  <div className="mt-1 text-[19px] font-semibold tracking-[-0.02em]">{activeBrand.name}</div>
                </div>
                <Link
                  href={activeBrand.href}
                  onClick={closeMenu}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/40 bg-white/10 px-4 text-xs font-semibold text-white backdrop-blur transition hover:bg-white hover:text-slate-900"
                >
                  Explore {activeBrand.name} <ArrowIcon className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="grid min-h-[555px] lg:grid-cols-[245px_1fr]">
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

              <section className="min-w-0 overflow-y-auto p-6 lg:max-h-[555px] lg:p-7">
                <div className="flex items-start justify-between gap-8 border-b border-slate-200 pb-5">
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${theme.text}`}>{activeBrand.area}</div>
                    <h2 className="mt-1.5 text-[28px] font-semibold tracking-[-0.035em] text-[#071d43]">{activeBrand.name}</h2>
                    <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-600">{activeBrand.description}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  {activeBrand.groups.map((group) => (
                    <div key={group.title} className={`min-w-0 rounded-2xl border bg-white p-4 ${theme.border}`}>
                      <Link
                        href={categoryHref(activeBrand, group.title)}
                        onClick={closeMenu}
                        className={`group/title flex items-center justify-between gap-3 border-b border-slate-200 pb-3 text-[14px] font-semibold text-slate-950 transition ${theme.hoverText}`}
                      >
                        <span>{group.title}</span>
                        <ArrowIcon className={`h-3.5 w-3.5 shrink-0 opacity-45 transition group-hover/title:translate-x-0.5 group-hover/title:opacity-100 ${theme.text}`} />
                      </Link>

                      <ul className="mt-3 space-y-1.5">
                        {group.items.map((item) => (
                          <li key={item}>
                            <Link
                              href={categoryHref(activeBrand, group.title, item)}
                              onClick={closeMenu}
                              className={`group/item flex items-start gap-2 py-0.5 text-[12px] leading-5 text-slate-600 transition ${theme.hoverText}`}
                            >
                              <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${theme.dot} opacity-55 transition group-hover/item:opacity-100`} />
                              <span>{item}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between gap-5 border-t border-slate-200 pt-5">
                  <p className="text-xs text-slate-500">Choose a major category first, then move into the detailed product area.</p>
                  <Link
                    href="/products"
                    onClick={closeMenu}
                    className={`inline-flex items-center gap-2 text-xs font-semibold text-slate-700 transition ${theme.hoverText}`}
                  >
                    View all brands <ArrowIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
