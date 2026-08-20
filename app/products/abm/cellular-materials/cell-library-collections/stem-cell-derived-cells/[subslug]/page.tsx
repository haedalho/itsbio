import Link from "next/link";
import { notFound } from "next/navigation";

import AbmHeroBanner from "@/components/products/AbmHeroBanner";
import Breadcrumb from "@/components/site/Breadcrumb";

const PAGE_SHELL = "mx-auto max-w-[1320px] px-6";

const PAGES = {
  cardiovascular: {
    title: "Cardiovascular",
    heading: "Stem Cell-Derived Cardiovascular Cells",
    lead: "Functional cardiac cell models for cardiotoxicity, disease modelling, electrophysiology, and drug discovery workflows.",
    description: "abm's cardiovascular stem cell-derived portfolio includes physiologically relevant cardiac models designed to support repeatable assays where contractility, electrical activity, and cardiac response are central to the research question.",
    applications: ["Cardiotoxicity Assessment", "Disease Modelling", "Drug Screening", "Electrophysiology", "Mechanistic Studies", "Translational Research"],
    image: "https://www.abmgood.com/assets/images/tinymce/GuxeFxhz0xAShGhEtRW21kVqvswpbeKN11BfbSxa.png",
    cards: [["Functional Phenotype", "Cardiac models selected for biologically meaningful functional assays."], ["Defined Cell Source", "Consistent stem cell-derived systems support repeatable experimental design."], ["Workflow Support", "Matched culture guidance helps researchers move from thaw to downstream assay."]],
  },
  neurological: {
    title: "Neurological",
    heading: "Stem Cell-Derived Neurological Cells",
    lead: "Neuronal and glial models for CNS disease research, neuropharmacology, electrophysiology, and mechanistic studies.",
    description: "abm's neurological stem cell-derived models provide defined human and rodent cell systems for researchers studying nervous-system biology, disease mechanisms, target response, and functional neural assays.",
    applications: ["CNS Disease Research", "Neuropharmacology", "Electrophysiology", "Drug Screening", "Mechanistic Studies", "3D Neural Models"],
    image: "https://www.abmgood.com/assets/images/tinymce/GuxeFxhz0xAShGhEtRW21kVqvswpbeKN11BfbSxa.png",
    cards: [["Neuronal Models", "Lineage-committed cells for neuronal biology and disease-focused workflows."], ["Glial Models", "Supporting cell systems for CNS signalling, inflammation, and neurobiology research."], ["Research Ready", "Defined models reduce setup time for screening and functional assay development."]],
  },
} as const;

function SideNav({ active }: { active: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 bg-[#f2f2f2] px-5 py-3.5"><div className="text-[20px] font-bold text-[#f15a29]">All Products</div></div>
      <nav className="px-3 py-3 text-[13px] leading-5 text-neutral-900">
        <Link href="/products/abm/general-materials" className="flex items-center justify-between px-2 py-2 font-semibold"><span>General Materials</span><span>⌄</span></Link>
        <Link href="/products/abm/cellular-materials" className="flex items-center justify-between px-2 py-2 font-semibold"><span>Cellular Materials</span><span className="text-[#0d9bd7]">⌃</span></Link>
        <div className="pl-2">
          <Link href="/products/abm/cellular-materials/cell-library-collections" className="flex items-center justify-between px-2 py-1.5 font-medium text-[#f15a29]"><span>Cell Library Collections</span><span>⌃</span></Link>
          <div className="pl-3">
            {[["Immortalized Cell Lines", "immortalized-cell-lines"], ["CRISPR KO Cell Lines", "crispr-ko-cell-lines"], ["Cas9 Expressing Cell Lines", "cas9-expressing-cell-lines"]].map(([label, slug]) => <Link key={slug} href={`/products/abm/cellular-materials/cell-library-collections/${slug}`} className="block px-2 py-1.5">{label}</Link>)}
            <Link href="/products/abm/cellular-materials/cell-library-collections/stem-cell-derived-cells" className="flex items-center justify-between px-2 py-1.5 font-semibold text-[#f15a29]"><span>Stem Cell-Derived Cells</span><span className="text-[#0d9bd7]">⌃</span></Link>
            <div className="pl-3 text-[12px]">
              <Link href="/products/abm/cellular-materials/cell-library-collections/stem-cell-derived-cells/cardiovascular" className={`block px-2 py-1.5 ${active === "cardiovascular" ? "font-semibold text-[#f15a29]" : "text-neutral-700"}`}>Cardiovascular</Link>
              <Link href="/products/abm/cellular-materials/cell-library-collections/stem-cell-derived-cells/neurological" className={`block px-2 py-1.5 ${active === "neurological" ? "font-semibold text-[#f15a29]" : "text-neutral-700"}`}>Neurological</Link>
            </div>
            {[["Hematopoietic Cells", "hematopoietic-cells"], ["Stable Cell Lines", "stable-cell-lines"], ["Tumor Cell Lines", "tumor-cell-lines"], ["Primary Cells", "primary-cells"]].map(([label, slug]) => <Link key={slug} href={`/products/abm/cellular-materials/cell-library-collections/${slug}`} className="block px-2 py-1.5">{label}</Link>)}
          </div>
        </div>
        <Link href="/products/abm/genetic-materials" className="mt-2 flex items-center justify-between border-t border-neutral-100 px-2 py-2 font-semibold"><span>Genetic Materials</span><span>⌄</span></Link>
      </nav>
    </div>
  );
}

export function generateStaticParams() {
  return Object.keys(PAGES).map((subslug) => ({ subslug }));
}

export default async function StemCellDerivedSystemPage({ params }: { params: Promise<{ subslug: string }> | { subslug: string } }) {
  const { subslug } = await Promise.resolve(params as { subslug: string });
  const page = PAGES[subslug as keyof typeof PAGES];
  if (!page) return notFound();

  return (
    <div className="bg-white">
      <AbmHeroBanner title="Applied Biological Materials (abm) Products & Services" />
      <div className={PAGE_SHELL}>
        <div className="mt-4"><Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Cellular Materials", href: "/products/abm/cellular-materials" }, { label: "Cell Library Collections", href: "/products/abm/cellular-materials/cell-library-collections" }, { label: "Stem Cell-Derived Cells", href: "/products/abm/cellular-materials/cell-library-collections/stem-cell-derived-cells" }, { label: page.title }]} /></div>
        <div className="mt-5 grid gap-8 pb-20 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]">
          <aside className="self-start lg:sticky lg:top-24"><SideNav active={subslug} /></aside>
          <main className="min-w-0">
            <section className="overflow-hidden rounded-[22px] border border-[#f0ddd5] bg-[#fffaf7]">
              <div className="grid lg:grid-cols-[minmax(0,1fr)_330px]">
                <div className="px-6 py-8 md:px-8 md:py-10"><div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#ef5b2a]">STEM CELL-DERIVED CELLS</div><h1 className="mt-2 text-[31px] font-semibold leading-tight tracking-[-0.03em] text-[#404a54]">{page.heading}</h1><p className="mt-3 text-[15px] font-medium leading-6 text-[#515b64]">{page.lead}</p><p className="mt-4 max-w-3xl text-[13px] leading-6 text-neutral-700">{page.description}</p><div className="mt-5 flex flex-wrap gap-2">{page.applications.map((item) => <span key={item} className="rounded-full border border-[#f1d9cf] bg-white px-3 py-1 text-[11px] font-medium text-[#d95425]">{item}</span>)}</div></div>
                <div className="relative min-h-[260px] bg-[#f3ebe7]">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={page.image} alt={page.heading} className="absolute inset-0 h-full w-full object-cover" /></div>
              </div>
            </section>

            <section className="mt-5 rounded-[22px] border border-[#eadfd9] bg-white p-6 md:p-7"><div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#ef5b2a]">At a glance</div><h2 className="mt-2 text-[23px] font-semibold text-[#404a54]">Research-ready models for discovery workflows</h2><div className="mt-5 grid gap-4 md:grid-cols-3">{page.cards.map(([title, text], i) => <article key={title} className="rounded-[18px] border border-[#eadfd9] bg-[#fffdfb] p-5"><div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#f3d9cd] bg-[#fff3ed] text-xs font-bold text-[#ef5b2a]">0{i + 1}</div><h3 className="mt-3 text-[15px] font-semibold text-[#404a54]">{title}</h3><p className="mt-2 text-[13px] leading-6 text-neutral-600">{text}</p></article>)}</div></section>

            <section className="mt-5 rounded-[22px] border border-[#eadfd9] bg-[#fbfaf8] p-6 md:p-7"><div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-center"><div><div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#ef5b2a]">Explore models</div><h2 className="mt-2 text-[22px] font-semibold text-[#404a54]">Search {page.title.toLowerCase()} cell models</h2><p className="mt-2 text-[13px] leading-6 text-neutral-600">Search the ITS BIO catalogue by product name, cell type, gene, species, tissue, or catalog number.</p></div><form action="/search" method="get" className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="brand" value="abm" /><input name="q" required placeholder="Cell type, gene, or cat. no." className="h-12 min-w-0 flex-1 rounded-full border border-neutral-300 bg-white px-5 text-sm outline-none focus:border-[#ef6331] focus:ring-4 focus:ring-orange-100" /><button className="h-12 rounded-full bg-[#ef5b2a] px-6 text-sm font-semibold text-white">Search models</button></form></div></section>

            <div className="mt-5 flex flex-wrap gap-3"><Link href="/products/abm/cellular-materials/cell-library-collections/stem-cell-derived-cells" className="inline-flex h-11 items-center rounded-full border border-[#ef5b2a] bg-white px-5 text-sm font-semibold text-[#e95625]">← Stem Cell-Derived Cells</Link><Link href="/contact" className="inline-flex h-11 items-center rounded-full bg-[#ef5b2a] px-5 text-sm font-semibold text-white">Ask about a cell model</Link></div>
          </main>
        </div>
      </div>
    </div>
  );
}
