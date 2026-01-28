"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type MenuItem = { label: string; href: string; children?: MenuItem[] };

const MENU: MenuItem[] = [
  {
    label: "abm",
    href: "http://itsbio.co.kr/?page_id=196",
    children: [
      {
        label: "COVID-19",
        href: "http://itsbio.co.kr/?page_id=2282",
        children: [
          { label: "Coronavirus/SARS-CoV-2 Basics", href: "http://itsbio.co.kr/?page_id=8028" },
          { label: "Coronavirus/SARS-CoV-2 Vectors", href: "http://itsbio.co.kr/?page_id=8039" },
          { label: "Coronavirus/SARS-CoV-2 Receptors", href: "http://itsbio.co.kr/?page_id=8079" },
          { label: "Coronavirus/SARS-CoV-2 Cell Lines", href: "http://itsbio.co.kr/?page_id=8150" },
          { label: "Coronavirus/SARS-CoV-2 Diagnostics", href: "http://itsbio.co.kr/?page_id=8163" },
          { label: "Coronavirus/SARS-CoV-2 Accessory Materials", href: "http://itsbio.co.kr/?page_id=8202" },
        ],
      },
      {
        label: "Cell Biology",
        href: "http://itsbio.co.kr/?page_id=249",
        children: [
          {
            label: "Cell Types",
            href: "http://itsbio.co.kr/?page_id=257",
            children: [
              { label: "Primary Cells", href: "http://itsbio.co.kr/?page_id=261" },
              { label: "Immortallized cells", href: "http://itsbio.co.kr/?page_id=1723" },
              { label: "Tumor Cells", href: "http://itsbio.co.kr/?page_id=1755" },
              { label: "Drug Discovery Cell Lines", href: "http://itsbio.co.kr/?page_id=1768" },
              { label: "Reporter Cell Lines", href: "http://itsbio.co.kr/?page_id=1798" },
            ],
          },
          { label: "Cell Biology Reagents", href: "http://itsbio.co.kr/?page_id=407" },
          { label: "Cell Immortalization Kits", href: "http://itsbio.co.kr/?page_id=412" },
          { label: "Growth Factors and Cytokines", href: "http://itsbio.co.kr/?page_id=9194" },
          { label: "Cell Based Assay Products", href: "http://itsbio.co.kr/?page_id=9240" },
          { label: "Stem Cells and iPSCs", href: "http://itsbio.co.kr/?page_id=9211" },
        ],
      },
      {
        label: "Gene Expression Vectors and Virus",
        href: "http://itsbio.co.kr/?page_id=387",
        children: [
          { label: "Expression Systems and Packaging Kits", href: "http://itsbio.co.kr/?page_id=6267" },
          { label: "GENE EXPRESSION CONTROLS", href: "http://itsbio.co.kr/?page_id=6572" },
          { label: "Custom Lentivirus", href: "http://itsbio.co.kr/?page_id=6670" },
          { label: "Custom AAV Service", href: "http://itsbio.co.kr/?page_id=6699" },
          { label: "Custom Adenovirus", href: "http://itsbio.co.kr/?page_id=6719" },
        ],
      },
      {
        label: "RNAi Technology",
        href: "http://itsbio.co.kr/?page_id=2303",
        children: [
          { label: "miRNA Detection and Quantification", href: "http://itsbio.co.kr/?page_id=6664" },
          { label: "siRNA Expression Controls", href: "http://itsbio.co.kr/?page_id=6631" },
          { label: "Custom siRNA Lentivirus Service", href: "http://itsbio.co.kr/?page_id=6645" },
        ],
      },
      { label: "CRISPR", href: "http://itsbio.co.kr/?page_id=366" },
      {
        label: "Genetic Materials",
        href: "http://itsbio.co.kr/?page_id=16514",
        children: [
          { label: "qPCR Virus Titer Kits", href: "http://itsbio.co.kr/?page_id=16922" },
          { label: "Kits Related to Recombinant Virus", href: "http://itsbio.co.kr/?page_id=16954" },
          { label: "Expression Systems", href: "http://itsbio.co.kr/?page_id=16962" },
          { label: "Lentivirus", href: "http://itsbio.co.kr/?page_id=16655" },
          { label: "AAV", href: "http://itsbio.co.kr/?page_id=16537" },
          { label: "CRISPR", href: "http://itsbio.co.kr/?page_id=16688" },
          { label: "miRNA and 3’UTR", href: "http://itsbio.co.kr/?page_id=16775" },
          { label: "Control Vectors & Viruses", href: "http://itsbio.co.kr/?page_id=16796" },
          { label: "Adenovirus", href: "http://itsbio.co.kr/?page_id=16808" },
          { label: "ORF Vector", href: "http://itsbio.co.kr/?page_id=16815" },
        ],
      },
      {
        label: "Cellular Materials",
        href: "http://itsbio.co.kr/?page_id=16969",
        children: [
          { label: "Growth Factors and Cytokines", href: "http://itsbio.co.kr/?page_id=17056" },
          { label: "Cell Immortalization Kits", href: "http://itsbio.co.kr/?page_id=17045" },
          { label: "Media, Reagents, Kits & Plastics", href: "http://itsbio.co.kr/?page_id=17036" },
          { label: "Primary Cells", href: "http://itsbio.co.kr/?page_id=17030" },
          { label: "Tumor Cell Lines", href: "http://itsbio.co.kr/?page_id=17023" },
          { label: "Immortalized Cell Lines", href: "http://itsbio.co.kr/?page_id=17002" },
          { label: "Stable Cell Lines", href: "http://itsbio.co.kr/?page_id=17011" },
        ],
      },
      {
        label: "General Materials & Others",
        href: "http://itsbio.co.kr/?page_id=373",
        children: [
          { label: "PCR, qPCR and RT", href: "http://itsbio.co.kr/?page_id=14770" },
          { label: "Molecular Biology Enzymes and Kits", href: "http://itsbio.co.kr/?page_id=14837" },
          { label: "SafeView™ DNA Stains", href: "http://itsbio.co.kr/?page_id=5908" },
          { label: "RNA Tracking (RNA Mango)", href: "http://itsbio.co.kr/?page_id=6125" },
          { label: "Gels, Blots & ELISAs", href: "http://itsbio.co.kr/?page_id=14879" },
          { label: "DNA & RNA Purification Kits", href: "http://itsbio.co.kr/?page_id=14912" },
          { label: "Expression Systems", href: "http://itsbio.co.kr/?page_id=14940" },
          { label: "Cloning Vectors & Packaging Mixes", href: "http://itsbio.co.kr/?page_id=14989" },
          { label: "Reagents and Chemicals", href: "http://itsbio.co.kr/?page_id=15031" },
          { label: "Lab Equipment and Consumables", href: "http://itsbio.co.kr/?page_id=15046" },
        ],
      },
      { label: "Protein Expression and analysis", href: "http://itsbio.co.kr/?page_id=382" },
      {
        label: "Antibodies",
        href: "http://itsbio.co.kr/?page_id=17100",
        children: [
          { label: "Primary Antibodies", href: "http://itsbio.co.kr/?page_id=17198" },
          { label: "Tag Antibodies", href: "http://itsbio.co.kr/?page_id=17126" },
          { label: "Loading Control Antibodies", href: "http://itsbio.co.kr/?page_id=17139" },
          { label: "Secondary Antibodies", href: "http://itsbio.co.kr/?page_id=17149" },
          { label: "IHC Antibodies", href: "http://itsbio.co.kr/?page_id=17156" },
          { label: "IHC Supplies", href: "http://itsbio.co.kr/?page_id=17208" },
          { label: "Antibody Purification", href: "http://itsbio.co.kr/?page_id=17214" },
          { label: "Monoclonal Antibodies", href: "http://itsbio.co.kr/?page_id=17168" },
          { label: "Polyclonal Antibodies", href: "http://itsbio.co.kr/?page_id=17178" },
          { label: "Antibody Isotyping Kits", href: "http://itsbio.co.kr/?page_id=17220" },
        ],
      },
      { label: "Histology", href: "http://itsbio.co.kr/?page_id=397" },
      { label: "Lab Equipment and Consumables", href: "http://itsbio.co.kr/?page_id=402" },
      { label: "Research CRO Custom Services", href: "http://itsbio.co.kr/?page_id=2306" },
    ],
  },
  {
    label: "KentScientifics",
    href: "http://itsbio.co.kr/?page_id=347",
    children: [
      { label: "Anesthesia", href: "http://itsbio.co.kr/?page_id=2875" },
      { label: "Ventilation", href: "http://itsbio.co.kr/?page_id=2972" },
      { label: "Physiological Monitoring", href: "http://itsbio.co.kr/?page_id=3000" },
      { label: "Noninvasive Blood Pressure", href: "http://itsbio.co.kr/?page_id=3004" },
      { label: "Surgery", href: "http://itsbio.co.kr/?page_id=3041" },
      { label: "Warming", href: "http://itsbio.co.kr/?page_id=3072" },
      { label: "Rodent Identification", href: "http://itsbio.co.kr/?page_id=3120" },
      { label: "Animal Handling", href: "http://itsbio.co.kr/?page_id=3150" },
      { label: "Syringe Pump", href: "http://itsbio.co.kr/?page_id=3173" },
      { label: "Feeding Needles", href: "http://itsbio.co.kr/?page_id=3183" },
    ],
  },
  { label: "ITSChem", href: "http://itsbio.co.kr/?page_id=656" },
  {
    label: "AIMS",
    href: "http://itsbio.co.kr/?page_id=392",
    children: [
      { label: "Lab Animal Identification System", href: "http://itsbio.co.kr/?page_id=3895" },
      { label: "AIMS Accessories", href: "http://itsbio.co.kr/?page_id=3975" },
    ],
  },
  {
    label: "SeedBuro",
    href: "http://itsbio.co.kr/?page_id=350",
    children: [
      { label: "Divider", href: "http://itsbio.co.kr/?page_id=4454" },
      { label: "Density Measurement", href: "http://itsbio.co.kr/?page_id=4548" },
      { label: "Sieve Shakers, Test Sieves, and Screens", href: "http://itsbio.co.kr/?page_id=4125" },
      { label: "Seed Counting and Analysis", href: "http://itsbio.co.kr/?page_id=4606" },
      { label: "Farm and Ranch", href: "http://itsbio.co.kr/?page_id=7901" },
      { label: "Grinders and Mills", href: "http://itsbio.co.kr/?page_id=8175" },
      { label: "Moisture Testers", href: "http://itsbio.co.kr/?page_id=8308" },
      { label: "Spiral Separators", href: "http://itsbio.co.kr/?page_id=10856" },
      { label: "Sample Bags, Containers, Envelopes and Pans", href: "http://itsbio.co.kr/?page_id=8680" },
      { label: "Sieve Shakers, Test Sieves and Screens", href: "http://itsbio.co.kr/?page_id=9275" },
      { label: "Germination Equipment", href: "http://itsbio.co.kr/?page_id=10159" },
      { label: "Grain and Seed Cleaners", href: "http://itsbio.co.kr/?page_id=11513" },
    ],
  },
  {
    label: "BIOplastics",
    href: "http://itsbio.co.kr/?page_id=355",
    children: [
      { label: "Single Tubes", href: "http://itsbio.co.kr/?page_id=4802" },
      { label: "Tube strips", href: "http://itsbio.co.kr/?page_id=17724" },
      { label: "Tube strips with caps", href: "http://itsbio.co.kr/?page_id=17738" },
      { label: "Plates", href: "http://itsbio.co.kr/?page_id=17749" },
      { label: "Cap strips, mats & Seals", href: "http://itsbio.co.kr/?page_id=17761" },
    ],
  },
  {
    label: "Cleaver Scientific",
    href: "http://itsbio.co.kr/?page_id=3308",
    children: [
      { label: "Horizontal Gel Systems", href: "http://itsbio.co.kr/?page_id=18705" },
      { label: "Vertical, Blotting, DGGE", href: "http://itsbio.co.kr/?page_id=5049" },
      { label: "Power Supplies", href: "http://itsbio.co.kr/?page_id=5237" },
      { label: "Clinical and Pharmaceutical", href: "http://itsbio.co.kr/?page_id=5175" },
      { label: "Gel Documentation", href: "http://itsbio.co.kr/?page_id=4931" },
    ],
  },
  {
    label: "CellFree Sciences",
    href: "http://itsbio.co.kr/?page_id=3298",
    children: [
      { label: "pEU Vector", href: "http://itsbio.co.kr/?page_id=5280" },
      { label: "Protein Expression Kits", href: "http://itsbio.co.kr/?page_id=5329" },
      { label: "Reagents", href: "http://itsbio.co.kr/?page_id=5299" },
    ],
  },
  {
    label: "PlasLabs",
    href: "http://itsbio.co.kr/?page_id=360",
    children: [
      { label: "Glove Boxes", href: "http://itsbio.co.kr/?page_id=18766" },
      { label: "Glove Box Accessories", href: "http://itsbio.co.kr/?page_id=5587" },
      { label: "Custom Glove Boxes", href: "http://itsbio.co.kr/?page_id=18020" },
      { label: "Animal Care & Research", href: "http://itsbio.co.kr/?page_id=5626" },
      { label: "PCR Chambers", href: "http://itsbio.co.kr/?page_id=5628" },
      { label: "Desiccators", href: "http://itsbio.co.kr/?page_id=18080" },
      { label: "Ventilated Balance Enclosures", href: "http://itsbio.co.kr/?page_id=18093" },
      { label: "Lab CO2 / Vacuum Chambers", href: "http://itsbio.co.kr/?p=18103" },
      { label: "Tissue Culture Hoods", href: "http://itsbio.co.kr/?page_id=18112" },
      { label: "Stream Tables", href: "http://itsbio.co.kr/?page_id=18118" },
    ],
  },
  {
    label: "Affinityimmuno",
    href: "http://itsbio.co.kr/?page_id=7450",
    children: [
      { label: "ELISA", href: "http://itsbio.co.kr/?page_id=7465" },
      { label: "ANTIBODIES", href: "http://itsbio.co.kr/?page_id=7601" },
      { label: "COVID-19", href: "http://itsbio.co.kr/?page_id=7792" },
      { label: "IgEasY", href: "http://itsbio.co.kr/?page_id=7881" },
    ],
  },
  {
    label: "DoGen",
    href: "http://itsbio.co.kr/?page_id=13492",
    children: [
      { label: "Cell Based Assay", href: "http://itsbio.co.kr/?page_id=14006" },
      { label: "Protein Biochemistry", href: "http://itsbio.co.kr/?page_id=13795" },
    ],
  },
];

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as globalThis.Node)) onOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}

function normalizeBrandKey(label: string) {
  return label.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}

type BrandTheme = {
  headerGradientFrom: string; // e.g. "from-orange-600"
  headerGradientTo: string;   // e.g. "to-orange-500"
  headerText: string;

  accentTextHover: string;
  accentBorderHover: string;
  ring: string;

  dotActive: string;
  dotInactive: string;

  bulletBorder: string;

  pillBorder: string;
  pillText: string;
  pillHoverBg: string;

  arrowText: string;
};

const BRAND_THEMES: Record<string, BrandTheme> = {
  abm: {
    headerGradientFrom: "from-orange-600",
    headerGradientTo: "to-orange-500",
    headerText: "text-white",
    accentTextHover: "hover:text-orange-700",
    accentBorderHover: "hover:border-orange-200",
    ring: "ring-orange-200",
    dotActive: "bg-orange-600",
    dotInactive: "bg-slate-300",
    bulletBorder: "border-l-orange-500",
    pillBorder: "border-orange-200",
    pillText: "text-orange-700",
    pillHoverBg: "hover:bg-orange-50",
    arrowText: "text-orange-600",
  },

  kentscientifics: {
    headerGradientFrom: "from-blue-700",
    headerGradientTo: "to-blue-500",
    headerText: "text-white",
    accentTextHover: "hover:text-blue-700",
    accentBorderHover: "hover:border-blue-200",
    ring: "ring-blue-200",
    dotActive: "bg-blue-600",
    dotInactive: "bg-slate-300",
    bulletBorder: "border-l-blue-500",
    pillBorder: "border-blue-200",
    pillText: "text-blue-700",
    pillHoverBg: "hover:bg-blue-50",
    arrowText: "text-blue-600",
  },

  itschem: {
    headerGradientFrom: "from-rose-600",
    headerGradientTo: "to-rose-400",
    headerText: "text-white",
    accentTextHover: "hover:text-rose-700",
    accentBorderHover: "hover:border-rose-200",
    ring: "ring-rose-200",
    dotActive: "bg-rose-500",
    dotInactive: "bg-slate-300",
    bulletBorder: "border-l-rose-500",
    pillBorder: "border-rose-200",
    pillText: "text-rose-700",
    pillHoverBg: "hover:bg-rose-50",
    arrowText: "text-rose-600",
  },

  aims: {
    headerGradientFrom: "from-sky-700",
    headerGradientTo: "to-sky-500",
    headerText: "text-white",
    accentTextHover: "hover:text-sky-700",
    accentBorderHover: "hover:border-sky-200",
    ring: "ring-sky-200",
    dotActive: "bg-sky-600",
    dotInactive: "bg-slate-300",
    bulletBorder: "border-l-sky-500",
    pillBorder: "border-sky-200",
    pillText: "text-sky-700",
    pillHoverBg: "hover:bg-sky-50",
    arrowText: "text-sky-600",
  },

  seedburo: {
    headerGradientFrom: "from-green-700",
    headerGradientTo: "to-green-500",
    headerText: "text-white",
    accentTextHover: "hover:text-green-700",
    accentBorderHover: "hover:border-green-200",
    ring: "ring-green-200",
    dotActive: "bg-green-600",
    dotInactive: "bg-slate-300",
    bulletBorder: "border-l-green-500",
    pillBorder: "border-green-200",
    pillText: "text-green-700",
    pillHoverBg: "hover:bg-green-50",
    arrowText: "text-green-600",
  },

  bioplastics: {
    headerGradientFrom: "from-yellow-400",
    headerGradientTo: "to-amber-300",
    headerText: "text-slate-900",
    accentTextHover: "hover:text-yellow-700",
    accentBorderHover: "hover:border-yellow-200",
    ring: "ring-yellow-200",
    dotActive: "bg-yellow-400",
    dotInactive: "bg-slate-300",
    bulletBorder: "border-l-yellow-500",
    pillBorder: "border-yellow-200",
    pillText: "text-yellow-700",
    pillHoverBg: "hover:bg-yellow-50",
    arrowText: "text-yellow-700",
  },

  cleaverscientific: {
    headerGradientFrom: "from-purple-700",
    headerGradientTo: "to-purple-500",
    headerText: "text-white",
    accentTextHover: "hover:text-purple-700",
    accentBorderHover: "hover:border-purple-200",
    ring: "ring-purple-200",
    dotActive: "bg-purple-600",
    dotInactive: "bg-slate-300",
    bulletBorder: "border-l-purple-500",
    pillBorder: "border-purple-200",
    pillText: "text-purple-700",
    pillHoverBg: "hover:bg-purple-50",
    arrowText: "text-purple-600",
  },

  cellfreesciences: {
    headerGradientFrom: "from-blue-950",
    headerGradientTo: "to-blue-700",
    headerText: "text-white",
    accentTextHover: "hover:text-blue-800",
    accentBorderHover: "hover:border-blue-200",
    ring: "ring-blue-200",
    dotActive: "bg-blue-900",
    dotInactive: "bg-slate-300",
    bulletBorder: "border-l-blue-700",
    pillBorder: "border-blue-200",
    pillText: "text-blue-800",
    pillHoverBg: "hover:bg-blue-50",
    arrowText: "text-blue-800",
  },

  plaslabs: {
    headerGradientFrom: "from-slate-950",
    headerGradientTo: "to-slate-700",
    headerText: "text-white",
    accentTextHover: "hover:text-slate-900",
    accentBorderHover: "hover:border-slate-300",
    ring: "ring-slate-200",
    dotActive: "bg-slate-900",
    dotInactive: "bg-slate-300",
    bulletBorder: "border-l-slate-900",
    pillBorder: "border-slate-200",
    pillText: "text-slate-900",
    pillHoverBg: "hover:bg-slate-50",
    arrowText: "text-slate-900",
  },

  affinityimmuno: {
    headerGradientFrom: "from-sky-500",
    headerGradientTo: "to-cyan-300",
    headerText: "text-slate-900",
    accentTextHover: "hover:text-sky-700",
    accentBorderHover: "hover:border-sky-200",
    ring: "ring-sky-200",
    dotActive: "bg-sky-400",
    dotInactive: "bg-slate-300",
    bulletBorder: "border-l-sky-500",
    pillBorder: "border-sky-200",
    pillText: "text-sky-700",
    pillHoverBg: "hover:bg-sky-50",
    arrowText: "text-sky-700",
  },

  dogen: {
    headerGradientFrom: "from-red-950",
    headerGradientTo: "to-red-700",
    headerText: "text-white",
    accentTextHover: "hover:text-red-800",
    accentBorderHover: "hover:border-red-200",
    ring: "ring-red-200",
    dotActive: "bg-red-900",
    dotInactive: "bg-slate-300",
    bulletBorder: "border-l-red-700",
    pillBorder: "border-red-200",
    pillText: "text-red-800",
    pillHoverBg: "hover:bg-red-50",
    arrowText: "text-red-800",
  },
};

function getBrandTheme(label: string): BrandTheme {
  const key = normalizeBrandKey(label);
  return BRAND_THEMES[key] ?? BRAND_THEMES.abm;
}

function ArrowBullet({ borderClass }: { borderClass: string }) {
  return (
    <span
      className={[
        "mt-[6px] inline-block h-0 w-0",
        "border-y-[4px] border-y-transparent border-l-[6px]",
        borderClass,
      ].join(" ")}
    />
  );
}

export default function ProductsMegaMenu() {
  const [open, setOpen] = useState(false);
  const [activeBrandIdx, setActiveBrandIdx] = useState(0);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const activeBrand = useMemo(() => MENU[activeBrandIdx] ?? MENU[0], [activeBrandIdx]);
  const categories = activeBrand.children ?? [];
  const isSectioned = categories.some((c) => (c.children?.length ?? 0) > 0);
  const theme = useMemo(() => getBrandTheme(activeBrand.label), [activeBrand.label]);

  // hover 끊김 방지
  const closeTimer = useRef<number | null>(null);
  const safeOpen = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const safeClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 170);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={ref} className="relative" onMouseEnter={safeOpen} onMouseLeave={safeClose}>
      <Link
        href="/products"
        className="inline-flex items-center gap-1 hover:text-slate-900"
        aria-haspopup="true"
        aria-expanded={open}
        onMouseEnter={safeOpen}
        onFocus={safeOpen}
      >
        Products <span className={`text-xs opacity-70 transition ${open ? "rotate-180" : ""}`}>▾</span>
      </Link>

      {open && (
        <div className="absolute left-0 top-full z-50 pt-3">
          <div className="w-[min(1200px,calc(100vw-2rem))] max-h-[calc(100vh-5.25rem)] overflow-hidden rounded-2xl border bg-white shadow-2xl">
            {/* ✅ 상단 바: 그라데이션 */}
            <div
              className={[
              "flex items-center justify-between gap-3 px-5 py-3",
              "bg-gradient-to-r",
              theme.headerGradientFrom,
              "to-white/96", // ← 여기! (숫자 높을수록 더 하얘짐)
              theme.headerText,
              ].join(" ")}
            >
              <div className="min-w-0 text-sm font-semibold">
                <span className="opacity-90">Products</span>
                <span className="opacity-80"> / </span>
                <span className="truncate">{activeBrand.label}</span>
              </div>
              <Link
                href={activeBrand.href}
                target="_blank"
                rel="noreferrer"
                className={[
                "shrink-0 text-sm font-semibold hover:underline",
                "text-slate-900", // ✅ 흰 배경쪽에서도 보이게
                ].join(" ")}
                onClick={() => setOpen(false)}
                >
                View {activeBrand.label} →
              </Link>
            </div>

            <div className="grid grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
              {/* LEFT: Brand list */}
              <div className="min-w-0 border-r bg-slate-50">
                <div className="px-4 py-3 text-xs font-semibold text-slate-500">Search by Product</div>

                <div className="max-h-[calc(100vh-11.5rem)] overflow-y-auto px-2 pb-3">
                  <ul className="space-y-1">
                    {MENU.map((b, i) => {
                      const active = i === activeBrandIdx;
                      const bTheme = getBrandTheme(b.label);

                      return (
                        <li key={b.href} className="min-w-0">
                          <button
                            type="button"
                            className={[
                              "flex w-full min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition",
                              active
                                ? ["bg-white shadow-sm ring-1", bTheme.ring].join(" ")
                                : "hover:bg-white hover:shadow-sm",
                            ].join(" ")}
                            onMouseEnter={() => setActiveBrandIdx(i)}
                            onFocus={() => setActiveBrandIdx(i)}
                            onClick={() => setActiveBrandIdx(i)}
                          >
                            <span
                              className={[
                                "h-2 w-2 shrink-0 rounded-full",
                                active ? bTheme.dotActive : bTheme.dotInactive,
                              ].join(" ")}
                            />
                            <span
                              className={[
                                "min-w-0 truncate",
                                active ? "font-semibold text-slate-900" : "text-slate-700",
                              ].join(" ")}
                              title={b.label}
                            >
                              {b.label}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-3 px-2">
                    <Link
                      href="/products"
                      className={[
                        "inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold",
                        theme.pillBorder,
                        theme.pillText,
                        theme.pillHoverBg,
                      ].join(" ")}
                      onClick={() => setOpen(false)}
                    >
                      All products →
                    </Link>
                  </div>
                </div>
              </div>

              {/* RIGHT */}
              <div className="min-w-0 overflow-x-hidden p-5">
                <div className="max-h-[calc(100vh-11.5rem)] overflow-y-auto pr-2">
                  {isSectioned ? (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                      {categories.map((cat) => (
                        <div key={cat.href} className="min-w-0">
                          <Link
                            href={cat.href}
                            target="_blank"
                            rel="noreferrer"
                            className={[
                              "group flex min-w-0 items-center justify-between gap-3 rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm",
                              theme.accentBorderHover,
                            ].join(" ")}
                            onClick={() => setOpen(false)}
                            title={cat.label}
                          >
                            <span className="min-w-0 truncate">{cat.label}</span>
                            <span className={["shrink-0 transition group-hover:translate-x-0.5", theme.arrowText].join(" ")}>
                              →
                            </span>
                          </Link>

                          <ul className="mt-3 space-y-2">
                            {(cat.children ?? []).map((it) => (
                              <li key={it.href} className="min-w-0">
                                <Link
                                  href={it.href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={["flex min-w-0 items-start gap-2 text-sm text-slate-700", theme.accentTextHover].join(" ")}
                                  onClick={() => setOpen(false)}
                                >
                                  <ArrowBullet borderClass={theme.bulletBorder} />
                                  <span className="min-w-0 break-words whitespace-normal leading-5">{it.label}</span>
                                </Link>

                                {it.children?.length ? (
                                  <ul className="mt-2 space-y-1 pl-4">
                                    {it.children.map((ch) => (
                                      <li key={ch.href} className="min-w-0">
                                        <Link
                                          href={ch.href}
                                          target="_blank"
                                          rel="noreferrer"
                                          className={["flex min-w-0 items-start gap-2 text-sm text-slate-600", theme.accentTextHover].join(" ")}
                                          onClick={() => setOpen(false)}
                                        >
                                          <span className="mt-[7px] inline-block h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                                          <span className="min-w-0 break-words whitespace-normal leading-5">{ch.label}</span>
                                        </Link>
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-2 lg:grid-cols-3">
                      {categories.map((c) => (
                        <Link
                          key={c.href}
                          href={c.href}
                          target="_blank"
                          rel="noreferrer"
                          className={["flex min-w-0 items-start gap-2 text-sm text-slate-700", theme.accentTextHover].join(" ")}
                          onClick={() => setOpen(false)}
                        >
                          <ArrowBullet borderClass={theme.bulletBorder} />
                          <span className="min-w-0 break-words whitespace-normal leading-5">{c.label}</span>
                        </Link>
                      ))}
                      {!categories.length && <div className="text-sm text-slate-500">No items.</div>}
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap gap-3 border-t pt-4">
                    <Link
                      href="/quote"
                      className={["text-sm font-semibold text-slate-700", theme.accentTextHover, "hover:underline"].join(" ")}
                      onClick={() => setOpen(false)}
                    >
                      Request a Quote →
                    </Link>
                    <Link
                      href="/resources"
                      className={["text-sm font-semibold text-slate-700", theme.accentTextHover, "hover:underline"].join(" ")}
                      onClick={() => setOpen(false)}
                    >
                      Resources →
                    </Link>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}