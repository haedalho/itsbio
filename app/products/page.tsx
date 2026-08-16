import Image from "next/image";
import Link from "next/link";

import Breadcrumb from "@/components/site/Breadcrumb";
import PageHero from "@/components/site/PageHero";

const BRANDS = [
  {
    key: "abm",
    name: "Applied Biological Materials (abm) Inc.",
    shortName: "ABM",
    eyebrow: "LIFE SCIENCE",
    description: "Research reagents, cell biology products, molecular tools, and custom services for life science workflows.",
    logo: "/partners/abm-logo-1.png",
    href: "/products/abm",
    tags: ["Research Reagents", "Cell Biology", "Custom Services"],
    internal: true,
  },
  {
    key: "kent",
    name: "Kent Scientific",
    shortName: "Kent Scientific",
    eyebrow: "ANIMAL RESEARCH",
    description: "Integrated systems for anesthesia, ventilation, monitoring, physiology, and laboratory animal research.",
    logo: "/partners/KentScientific-logo.png",
    href: "/products/kent",
    tags: ["Anesthesia", "Ventilation", "Monitoring"],
    internal: true,
  },
  {
    key: "cleaver",
    name: "Cleaver Scientific",
    shortName: "Cleaver Scientific",
    eyebrow: "LABORATORY EQUIPMENT",
    description: "Electrophoresis, gel documentation, blotting, and practical equipment for life science laboratories.",
    logo: "/partners/Cleaverscientific-logo.png",
    href: "https://www.thistlescientific.co.uk/",
    tags: ["Electrophoresis", "Imaging", "Lab Equipment"],
    external: true,
  },
  {
    key: "seedburo",
    name: "Seedburo Equipment Company",
    shortName: "Seedburo",
    eyebrow: "AGRICULTURAL RESEARCH",
    description: "Specialized instruments for seed, grain, moisture, and agricultural quality testing workflows.",
    logo: "/partners/Seedburo-logo.png",
    href: "https://seedburo.com/",
    tags: ["Seed Testing", "Grain Analysis", "Lab Equipment"],
    external: true,
  },
  {
    key: "aims",
    name: "AIMS",
    shortName: "AIMS",
    eyebrow: "ANIMAL IDENTIFICATION",
    description: "Identification and data solutions designed to support reliable animal research and care.",
    logo: "/partners/aims-logo.png",
    href: "https://animalid.com/",
    tags: ["Identification", "Data Systems", "Animal Care"],
    external: true,
  },
  {
    key: "bioplastics",
    name: "BIOplastics",
    shortName: "BIOplastics",
    eyebrow: "MOLECULAR DIAGNOSTICS",
    description: "Laboratory plastic consumables engineered for consistent PCR, qPCR, and molecular workflows.",
    logo: "/partners/bioplastics-logo.png",
    href: "https://www.bioplastics.com/",
    tags: ["PCR Plastics", "qPCR", "Consumables"],
    external: true,
  },
  {
    key: "cellfree",
    name: "CellFree Sciences",
    shortName: "CellFree Sciences",
    eyebrow: "PROTEIN EXPRESSION",
    description: "Wheat-germ cell-free protein expression products, systems, reagents, and research services.",
    logo: "/partners/cellfreesciences-logo.png",
    href: "https://www.cfsciences.com/eg/",
    tags: ["Protein Expression", "Wheat Germ", "Services"],
    external: true,
  },
  {
    key: "itschem",
    name: "ITSChem",
    shortName: "ITSChem",
    eyebrow: "RESEARCH MATERIALS",
    description: "Specialty research materials and responsive laboratory supply support for scientific workflows.",
    logo: "/partners/itschem-logo.png",
    href: "/contact",
    tags: ["Research Materials", "Laboratory", "Support"],
  },
  {
    key: "plaslabs",
    name: "PLAS-LABS",
    shortName: "PLAS-LABS",
    eyebrow: "CONTROLLED ENVIRONMENTS",
    description: "Controlled-atmosphere enclosures and handling systems for sensitive research workflows.",
    logo: "/partners/plaslabs-logo.png",
    href: "https://plas-labs.com/",
    tags: ["Glove Boxes", "Enclosures", "Animal Care"],
    external: true,
  },
] as const;

function BrandCard({ brand, index }: { brand: (typeof BRANDS)[number]; index: number }) {
  return (
    <article className="group relative flex min-h-[340px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_22px_50px_rgba(15,23,42,0.09)] md:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full border border-orange-100 opacity-0 transition duration-300 group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-4">
        <div className="relative h-16 w-[180px]">
          <Image src={brand.logo} alt={`${brand.name} logo`} fill className="object-contain object-left" sizes="180px" />
        </div>
        <span className="text-xs font-semibold tabular-nums text-slate-300">{String(index + 1).padStart(2, "0")}</span>
      </div>

      <div className="mt-7 text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">{brand.eyebrow}</div>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-slate-950">{brand.shortName}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{brand.description}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {brand.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-7">
        <Link
          href={brand.href}
          target={brand.external ? "_blank" : undefined}
          rel={brand.external ? "noreferrer" : undefined}
          className="inline-flex items-center gap-3 text-sm font-semibold text-slate-900 transition group-hover:text-orange-600"
        >
          {brand.internal ? "Browse catalog" : brand.key === "itschem" ? "Contact for products" : "Explore brand"}
          <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </div>
    </article>
  );
}

export default function ProductsPage() {
  return (
    <main className="bg-white">
      <PageHero
        eyebrow="PRODUCTS & BRANDS"
        title="Find the right solution for your work"
        description="Explore our scientific brands by research area, or search directly by product name and catalog number."
        variant="products"
      />

      <div className="mx-auto max-w-6xl px-6">
        <div className="mt-6 flex justify-end">
          <Breadcrumb />
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-8 pt-10 md:pt-14">
        <div className="grid gap-8 rounded-[30px] border border-slate-200 bg-[#fbfaf8] p-6 md:p-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:p-10">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-orange-600">Product search</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#071d43] md:text-3xl">Know what you are looking for?</h2>
            <p className="mt-3 max-w-lg text-sm leading-7 text-slate-600">
              Search across the ITS BIO catalog by product name or catalog number. Similar products are separated by brand so you can choose the right match.
            </p>
          </div>

          <form action="/search" method="get" className="flex flex-col gap-3 sm:flex-row">
            <input
              name="q"
              required
              aria-label="Search by product name or catalog number"
              placeholder="Product name or catalog number"
              className="h-14 min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-6 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />
            <button className="h-14 shrink-0 rounded-full bg-orange-600 px-8 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700">
              Search catalog
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pb-24 md:pt-14">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-7 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-orange-600">Our portfolio</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[#071d43] md:text-4xl">Explore by brand</h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-slate-600 md:text-right">
            Each partner specializes in a different part of the research workflow. Choose a brand to explore its products and solutions.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {BRANDS.map((brand, index) => <BrandCard key={brand.key} brand={brand} index={index} />)}
        </div>

        <div className="mt-12 flex flex-col gap-5 rounded-[28px] bg-[#071d43] px-7 py-8 text-white md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-orange-400">Need help choosing?</div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">Tell us what you are trying to do.</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              If you do not know the brand or catalog number, our team can help identify suitable products and alternatives.
            </p>
          </div>
          <Link href="/contact" className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-orange-600 px-7 text-sm font-semibold text-white transition hover:bg-orange-500">
            Contact our team <span className="ml-3" aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
