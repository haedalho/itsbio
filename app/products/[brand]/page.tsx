import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/site/Breadcrumb";

type BrandInfo = {
  name: string;
  eyebrow: string;
  description: string;
  logo?: string;
  accent: string;
  deep: string;
  soft: string;
  categories: string[];
};

const BRANDS: Record<string, BrandInfo> = {
  cleaver: {
    name: "Cleaver Scientific",
    eyebrow: "LABORATORY EQUIPMENT",
    description: "Electrophoresis, gel documentation, blotting, power supplies, and practical equipment for life science laboratories.",
    logo: "/partners/Cleaverscientific-logo.png",
    accent: "#9333ea",
    deep: "#581c87",
    soft: "#faf5ff",
    categories: ["Horizontal Gel Systems", "Vertical, Blotting & DGGE", "Power Supplies", "Clinical & Pharmaceutical", "Gel Documentation"],
  },
  seedburo: {
    name: "Seedburo",
    eyebrow: "AGRICULTURAL RESEARCH",
    description: "Specialized instruments for seed, grain, moisture, germination, cleaning, and agricultural quality testing.",
    logo: "/partners/Seedburo-logo.png",
    accent: "#16a34a",
    deep: "#14532d",
    soft: "#f0fdf4",
    categories: ["Divider", "Density Measurement", "Sieve Shakers, Test Sieves & Screens", "Seed Counting & Analysis", "Farm & Ranch", "Grinders & Mills", "Moisture Testers", "Spiral Separators", "Sample Bags & Containers", "Germination Equipment", "Grain & Seed Cleaners"],
  },
  aims: {
    name: "AIMS",
    eyebrow: "ANIMAL IDENTIFICATION",
    description: "Identification systems and accessories designed to support reliable laboratory animal research and care.",
    logo: "/partners/aims-logo.png",
    accent: "#0284c7",
    deep: "#0c4a6e",
    soft: "#f0f9ff",
    categories: ["Lab Animal Identification System", "AIMS Accessories"],
  },
  bioplastics: {
    name: "BIOplastics",
    eyebrow: "PCR & qPCR CONSUMABLES",
    description: "Precision laboratory plastic consumables for consistent PCR, qPCR, and molecular diagnostic workflows.",
    logo: "/partners/bioplastics-logo.png",
    accent: "#f59e0b",
    deep: "#92400e",
    soft: "#fffbeb",
    categories: ["Single Tubes", "Tube Strips", "Tube Strips with Caps", "Plates", "Cap Strips, Mats & Seals"],
  },
  cellfree: {
    name: "CellFree Sciences",
    eyebrow: "PROTEIN EXPRESSION",
    description: "Wheat-germ cell-free protein expression systems, vectors, reagents, kits, and services for advanced protein research.",
    logo: "/partners/cellfreesciences-logo.png",
    accent: "#1d4ed8",
    deep: "#172554",
    soft: "#eff6ff",
    categories: ["pEU Vector", "Protein Expression Kits", "Reagents"],
  },
  itschem: {
    name: "ITSChem",
    eyebrow: "RESEARCH MATERIALS",
    description: "Specialty research materials and responsive laboratory sourcing support for scientific and industrial workflows.",
    logo: "/partners/itschem-logo.png",
    accent: "#e11d48",
    deep: "#881337",
    soft: "#fff1f2",
    categories: ["Research Materials", "Laboratory Supply", "Specialty Materials", "Sourcing Support"],
  },
  plaslabs: {
    name: "PLAS-LABS",
    eyebrow: "CONTROLLED ENVIRONMENTS",
    description: "Controlled-atmosphere enclosures and handling systems for sensitive laboratory and animal research workflows.",
    logo: "/partners/plaslabs-logo.png",
    accent: "#475569",
    deep: "#0f172a",
    soft: "#f8fafc",
    categories: ["Glove Boxes", "Glove Box Accessories", "Custom Glove Boxes", "Animal Care & Research", "PCR Chambers", "Desiccators", "Ventilated Balance Enclosures", "Lab CO2 / Vacuum Chambers", "Tissue Culture Hoods", "Stream Tables"],
  },
  affinity: {
    name: "Affinity Immuno",
    eyebrow: "IMMUNOASSAYS",
    description: "Immunoassay products and antibody solutions for life science and diagnostic research workflows.",
    accent: "#06b6d4",
    deep: "#164e63",
    soft: "#ecfeff",
    categories: ["ELISA", "Antibodies", "COVID-19", "IgEasY"],
  },
  dogen: {
    name: "DoGen",
    eyebrow: "CELL & PROTEIN RESEARCH",
    description: "Research solutions for cell-based assays and protein biochemistry applications.",
    accent: "#b91c1c",
    deep: "#450a0a",
    soft: "#fef2f2",
    categories: ["Cell Based Assay", "Protein Biochemistry"],
  },
};

export function generateStaticParams() {
  return Object.keys(BRANDS).map((brand) => ({ brand }));
}

export default async function BrandPreparingPage({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string }>;
  searchParams?: Promise<{ q?: string }> | { q?: string };
}) {
  const { brand: brandKey } = await params;
  const brand = BRANDS[brandKey];
  if (!brand) return notFound();

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const requestedItem = (resolvedSearchParams?.q || "").trim();

  return (
    <main className="bg-white">
      <section className="relative isolate overflow-hidden text-white" style={{ background: `linear-gradient(120deg, ${brand.deep} 0%, ${brand.deep} 52%, ${brand.accent} 140%)` }}>
        <div className="pointer-events-none absolute -right-28 -top-52 h-[580px] w-[580px] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute right-[16%] top-12 h-56 w-56 rounded-full border border-dashed border-white/15" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:28px_28px] [mask-image:linear-gradient(to_right,transparent,black_52%,black_92%,transparent)]" />
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, #f97316, ${brand.accent})` }} />

        <div className="relative mx-auto grid min-h-[340px] max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.04fr_.96fr] lg:py-0">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-white/60">{brand.eyebrow}</div>
            <h1 className="mt-4 text-[42px] font-semibold leading-[1.05] tracking-[-0.045em] md:text-[54px]">{brand.name}</h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-white/70 md:text-base">{brand.description}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={`/search?brand=${encodeURIComponent(brandKey)}`} className="inline-flex h-11 items-center rounded-full bg-white px-6 text-sm font-semibold" style={{ color: brand.deep }}>Search this brand</Link>
              <Link href="/contact" className="inline-flex h-11 items-center rounded-full border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10">Contact our team</Link>
            </div>
          </div>

          <div className="hidden lg:flex lg:justify-end">
            <div className="relative flex h-[250px] w-full max-w-[420px] items-center justify-center rounded-[34px] border border-white/15 bg-white/10 p-10 shadow-2xl backdrop-blur-md">
              {brand.logo ? (
                <div className="relative h-28 w-full max-w-[290px] rounded-2xl bg-white p-5 shadow-xl">
                  <Image src={brand.logo} alt={`${brand.name} logo`} fill className="object-contain p-5" sizes="290px" />
                </div>
              ) : (
                <div className="text-center text-4xl font-black tracking-[-0.04em] text-white">{brand.name}</div>
              )}
              <span className="absolute bottom-6 right-7 rounded-full bg-white/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">ITS BIO partner</span>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6">
        <div className="mt-6 flex justify-end">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Products", href: "/products" }, { label: brand.name }]} />
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pt-14">
        {requestedItem ? (
          <div className="mb-8 rounded-[24px] border p-5 md:p-6" style={{ borderColor: `${brand.accent}40`, background: brand.soft }}>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: brand.accent }}>Requested item</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{requestedItem}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">The full product page is still being integrated. You can search ITS BIO or send this exact item to our team for confirmation.</p>
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: brand.accent }}>Catalog integration</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#071d43]">Brand catalog is being prepared</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">
              We are moving this partner catalog into the same internal ITS BIO structure used for ABM and Kent. Until the catalog is complete, the brand remains fully available for quotation, sourcing, and product identification.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={`/search?brand=${encodeURIComponent(brandKey)}`} className="inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold text-white" style={{ backgroundColor: brand.accent }}>Search products</Link>
              <Link href="/quote" className="inline-flex h-11 items-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-800 transition hover:border-slate-400">Request a Quote</Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-semibold text-slate-950">Product areas</h3>
              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 shadow-sm">Preparing</span>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {brand.categories.map((category) => (
                <Link key={category} href={`/search?q=${encodeURIComponent(category)}&brand=${encodeURIComponent(brandKey)}`} className="group flex min-h-14 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:shadow-sm">
                  <span>{category}</span>
                  <span className="transition-transform group-hover:translate-x-1" style={{ color: brand.accent }} aria-hidden>→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-5 rounded-[28px] px-7 py-8 text-white md:flex-row md:items-center md:justify-between md:px-10" style={{ backgroundColor: brand.deep }}>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Need a product now?</div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">You do not need to wait for the catalog.</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">Send us the product name, catalog number, screenshot, or specification and we can identify the right item.</p>
          </div>
          <Link href="/contact" className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold" style={{ color: brand.deep }}>Contact ITS BIO <span className="ml-3" aria-hidden>→</span></Link>
        </div>
      </section>
    </main>
  );
}
