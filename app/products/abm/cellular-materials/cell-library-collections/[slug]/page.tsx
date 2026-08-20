import Link from "next/link";
import { notFound } from "next/navigation";

import AbmHeroBanner from "@/components/products/AbmHeroBanner";
import Breadcrumb from "@/components/site/Breadcrumb";

const PAGE_SHELL = "mx-auto max-w-[1320px] px-6";

const MENU = [
  ["Immortalized Cell Lines", "immortalized-cell-lines"],
  ["CRISPR KO Cell Lines", "crispr-ko-cell-lines"],
  ["Cas9 Expressing Cell Lines", "cas9-expressing-cell-lines"],
  ["Stem Cell-Derived Cells", "stem-cell-derived-cells"],
  ["Hematopoietic Cells", "hematopoietic-cells"],
  ["Stable Cell Lines", "stable-cell-lines"],
  ["Tumor Cell Lines", "tumor-cell-lines"],
  ["Primary Cells", "primary-cells"],
] as const;

const STEM_CHILDREN = [
  ["Cardiovascular", "cardiovascular"],
  ["Neurological", "neurological"],
] as const;

type Detail = {
  title: string;
  eyebrow: string;
  lead: string;
  body: string[];
  image: string;
  stats: Array<[string, string]>;
  highlights: Array<[string, string]>;
  searchLabel: string;
  tags: string[];
  cta: string;
};

const DETAILS: Record<string, Detail> = {
  "immortalized-cell-lines": {
    title: "Immortalized Cell Lines",
    eyebrow: "CELL LIBRARY COLLECTIONS",
    lead: "Passage-verified, mycoplasma-tested models built for reproducible cell biology workflows.",
    body: [
      "abm has developed immortalization technologies and a broad library of renewable cell models spanning human, mouse, rat, and specialty species across many tissue systems.",
      "These lines are designed for consistent expansion and repeatable use in cell biology, drug discovery, disease modelling, biotechnology, translational research, and genetic engineering workflows.",
    ],
    image: "https://www.abmgood.com/assets/images/tinymce/QKWWmTOkaulJpeQOV4nflnSn1xegUKpSCWjxU9CJ.png",
    stats: [["600+", "Unique cell lines"], ["20+", "Years of expertise"], ["50+", "Tissue types"], ["QC", "Mycoplasma tested"]],
    highlights: [["Drug development & toxicology", "Consistent models help reduce donor variability in screening and mechanistic work."], ["Reproducible research", "Renewable cell populations support longitudinal assays and cross-lab consistency."], ["Gene editing ready", "Expandable lines are practical starting points for CRISPR, reporters, and stable transgene work."]],
    searchLabel: "Search immortalized cell lines",
    tags: ["Human", "Mouse", "Rat", "Specialty Species", "50+ Tissue Types"],
    cta: "Browse Immortalized Cells",
  },
  "crispr-ko-cell-lines": {
    title: "CRISPR KO Cell Lines",
    eyebrow: "GENOME EDITING",
    lead: "Ready-to-use knockout models for gene-function studies, screening, and target validation.",
    body: [
      "abm combines cell biology expertise with licensed CRISPR technology to provide pre-engineered knockout cell models across a wide range of genes and cell backgrounds.",
      "Researchers can start with ready-to-use KO lines or request custom knockout development when a specific target and cell type are required.",
    ],
    image: "https://www.abmgood.com/assets/images/tinymce/4z8Ofdu6xjpEUlvSnEZjrgfkdJWq1ouXssWlr5hT.png",
    stats: [["2,000+", "Ready-to-use KO lines"], ["CRISPR", "Licensed technology"], ["Custom", "KO development"], ["Research", "Screening ready"]],
    highlights: [["Gene function", "Use defined knockout backgrounds to study pathway biology and target dependence."], ["Drug screening", "Standardized engineered models support repeatable screening and validation workflows."], ["Custom editing", "When a catalogue model is not available, custom KO generation can be matched to the project."]],
    searchLabel: "Search CRISPR knockout cell lines",
    tags: ["Knockout", "Gene Function", "Target Validation", "Screening"],
    cta: "Browse CRISPR KO Cells",
  },
  "cas9-expressing-cell-lines": {
    title: "Cas9 Expressing Cell Lines",
    eyebrow: "CRISPR WORKFLOW",
    lead: "Stable Cas9-expressing backgrounds that simplify downstream sgRNA delivery and genome editing.",
    body: [
      "These stable cell lines are designed so researchers can introduce an sgRNA from a genome-wide library, custom vector or virus, or an in-vitro-transcribed sgRNA workflow without rebuilding Cas9 expression from scratch.",
      "For knock-in experiments, a repair template is introduced alongside the guide strategy. The collection covers multiple commonly used human and animal research cell backgrounds.",
    ],
    image: "https://www.abmgood.com/assets/images/tinymce/vgqNGJE33i6GLPyjnKQi95784QCKnA7EdSAUOrlY.png",
    stats: [["Cas9", "Pre-expressing"], ["sgRNA", "Flexible delivery"], ["Stable", "Cell backgrounds"], ["CRISPR", "Workflow ready"]],
    highlights: [["Faster setup", "Start from a validated Cas9-expressing background and focus on guide delivery."], ["Flexible guides", "Use library, custom vector, viral, or transcribed sgRNA approaches."], ["Knock-in compatible", "Pair the editing workflow with an appropriate repair template when required."]],
    searchLabel: "Search Cas9 expressing cell lines",
    tags: ["Cas9", "sgRNA", "Knockout", "Knock-in"],
    cta: "Browse Cas9 Cell Lines",
  },
  "stem-cell-derived-cells": {
    title: "Stem Cell-Derived Cells",
    eyebrow: "FUNCTIONAL CELL MODELS",
    lead: "Lineage-committed models designed for disease modelling, screening, and physiologically relevant assays.",
    body: [
      "abm's stem cell-derived portfolio focuses on functional phenotype, defined genetics, and reproducibility for researchers who need biologically relevant cell models at practical experimental scale.",
      "The collection is organized by research system, including neurological and cardiovascular models, with matched culture support and application guidance.",
    ],
    image: "https://www.abmgood.com/assets/images/tinymce/GuxeFxhz0xAShGhEtRW21kVqvswpbeKN11BfbSxa.png",
    stats: [["Defined", "Functional phenotype"], ["Genetics", "Consistent models"], ["Repeatable", "Lot-to-lot use"], ["2 Systems", "Current collections"]],
    highlights: [["Disease modelling", "Use lineage-specific cells to study disease mechanisms in more relevant biological contexts."], ["Drug screening", "Defined cell populations support repeatable screening and toxicology workflows."], ["3D compatible", "Selected models can be integrated into spheroid and organoid-oriented workflows."]],
    searchLabel: "Search stem cell-derived models",
    tags: ["iPSC-Derived", "ESC-Derived", "Neurological", "Cardiovascular"],
    cta: "Explore Stem-Derived Models",
  },
  "hematopoietic-cells": {
    title: "Hematopoietic Cells",
    eyebrow: "BLOOD & IMMUNE RESEARCH",
    lead: "Research-ready hematopoietic models for blood formation, immune development, and regenerative medicine.",
    body: [
      "abm offers hematopoietic cell populations sourced for research into blood and immune biology, including stem/progenitor and lineage-committed models.",
      "These cells can support hematology, immunology, cell therapy, vascular biology, and translational research workflows where defined blood-cell populations are required.",
    ],
    image: "https://www.abmgood.com/assets/images/tinymce/aw7cnpDbjyetAUr2u59EMHi9wO9bA2GRxBQIcO83.png",
    stats: [["Blood", "Research models"], ["Immune", "Cell biology"], ["HSC", "Stem/progenitor"], ["Translational", "Applications"]],
    highlights: [["Hematology", "Study blood-cell development, differentiation, and disease mechanisms."], ["Immunology", "Support immune signalling and functional immune-cell workflows."], ["Regenerative research", "Use defined progenitor populations in development and cell-therapy research."]],
    searchLabel: "Search hematopoietic cells",
    tags: ["CD34+", "HSC", "Blood", "Immune", "Regenerative Medicine"],
    cta: "Browse Hematopoietic Cells",
  },
  "stable-cell-lines": {
    title: "Stable Cell Lines",
    eyebrow: "ENGINEERED CELL MODELS",
    lead: "Ready-to-use stable models that reduce the time and technical burden of generating persistent expression systems.",
    body: [
      "Generating stable cell lines can require extensive optimization, selection, validation, and expansion. abm maintains a large ready-to-use collection so researchers can move into experiments sooner.",
      "The portfolio includes more than one thousand stable lines, including a substantial suspension-cell collection, with custom generation available for project-specific targets.",
    ],
    image: "https://www.abmgood.com/assets/images/tinymce/AyCmMqvv66BntReScmkF1j8YPAJ32Cjy4wRFoDit.png",
    stats: [["1,000+", "Stable cell lines"], ["200+", "Suspension lines"], ["Weekly", "Growing library"], ["Custom", "Generation support"]],
    highlights: [["Save development time", "Start from an established stable model instead of building the system from zero."], ["Suspension options", "Access engineered models suitable for suspension workflows and scale-up."], ["Custom development", "Request a tailored stable line when the catalogue does not contain the required combination."]],
    searchLabel: "Search stable cell lines",
    tags: ["Stable Expression", "Suspension", "Reporter", "Overexpression"],
    cta: "Browse Stable Cell Lines",
  },
  "tumor-cell-lines": {
    title: "Tumor Cell Lines",
    eyebrow: "ONCOLOGY MODELS",
    lead: "Diverse in-vitro tumour models for cancer biology, therapeutic development, and translational research.",
    body: [
      "abm's tumour cell portfolio spans human, mouse, canine, and other mammalian models for cancer research and drug-development workflows.",
      "The collection includes specialty and hard-to-source models, including broad mast-cell resources and tumour lines that complement commonly used reference collections.",
    ],
    image: "https://www.abmgood.com/assets/images/tinymce/QEddm39LxP2M6jaXZa7belIyl14nsubr4djJdgvI.png",
    stats: [["Oncology", "In-vitro models"], ["Multi-species", "Cell collection"], ["Specialty", "Unique lines"], ["Drug R&D", "Applications"]],
    highlights: [["Cancer biology", "Investigate growth, signalling, invasion, and disease mechanisms in defined models."], ["Drug development", "Use tumour backgrounds for screening, response profiling, and target validation."], ["Special collections", "Access less-common tumour and mast-cell models for specialized research questions."]],
    searchLabel: "Search tumor cell lines",
    tags: ["Cancer", "Tumor Models", "Drug Discovery", "Translational Research"],
    cta: "Browse Tumor Cell Lines",
  },
  "primary-cells": {
    title: "Primary Cells",
    eyebrow: "PHYSIOLOGICALLY RELEVANT MODELS",
    lead: "Tissue-derived cells that retain key characteristics of their original biological environment.",
    body: [
      "Primary cells are isolated directly from living tissues and preserve physiological traits that can be lost in transformed or immortalized systems.",
      "abm offers more than 400 primary cell types from human and animal sources for drug discovery, toxicology, cancer research, immunology, tissue engineering, and other life-science applications.",
    ],
    image: "https://www.abmgood.com/assets/images/tinymce/aw7cnpDbjyetAUr2u59EMHi9wO9bA2GRxBQIcO83.png",
    stats: [["400+", "Primary cell types"], ["Human", "Cell sources"], ["Animal", "Cell sources"], ["Native", "Biological relevance"]],
    highlights: [["Drug discovery & toxicology", "Evaluate response in models that more closely reflect native tissue biology."], ["Immunology", "Study immune responses with tissue-appropriate primary immune populations."], ["Tissue engineering", "Use biologically relevant cells in regenerative and biomimetic research workflows."]],
    searchLabel: "Search primary cells",
    tags: ["Primary", "Human", "Animal", "Tissue-Derived"],
    cta: "Browse Primary Cells",
  },
};

function SideNav({ active }: { active: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 bg-[#f2f2f2] px-5 py-3.5">
        <div className="text-[20px] font-bold text-[#f15a29]">All Products</div>
      </div>
      <nav className="px-3 py-3 text-[13px] leading-5 text-neutral-900" aria-label="Cell library categories">
        <Link href="/products/abm/general-materials" className="flex items-center justify-between px-2 py-2 font-semibold hover:text-[#f15a29]"><span>General Materials</span><span>⌄</span></Link>
        <Link href="/products/abm/cellular-materials" className="flex items-center justify-between px-2 py-2 font-semibold"><span>Cellular Materials</span><span className="text-[#0d9bd7]">⌃</span></Link>
        <div className="pl-2">
          <Link href="/products/abm/cellular-materials/cell-library-collections" className="flex items-center justify-between px-2 py-1.5 font-medium text-[#f15a29]"><span>Cell Library Collections</span><span>⌃</span></Link>
          <div className="pl-3">
            {MENU.map(([label, slug]) => {
              const selected = active === slug;
              const isStem = slug === "stem-cell-derived-cells";
              return (
                <div key={slug}>
                  <Link href={`/products/abm/cellular-materials/cell-library-collections/${slug}`} className={`flex items-center justify-between px-2 py-1.5 ${selected ? "font-semibold text-[#f15a29]" : "text-neutral-900 hover:text-[#f15a29]"}`}>
                    <span>{label}</span>{isStem ? <span className="text-[#0d9bd7]">{selected ? "⌃" : "⌄"}</span> : null}
                  </Link>
                  {isStem && selected ? (
                    <div className="pl-3 text-[12px]">
                      {STEM_CHILDREN.map(([child, childSlug]) => <Link key={childSlug} href={`/products/abm/cellular-materials/cell-library-collections/stem-cell-derived-cells/${childSlug}`} className="block px-2 py-1.5 text-neutral-700 hover:text-[#f15a29]">{child}</Link>)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {["Special Cell Line Collections", "3D and Organoid", "Microbial Contamination", "Cell Immortalization Reagents", "Media & Supplements", "Growth Factors and Cytokines", "Culture Consumables", "Cell Assay Products", "Cell Culture Equipment"].map((label) => <div key={label} className="px-2 py-1.5 text-neutral-800">{label}</div>)}
        </div>
        <Link href="/products/abm/genetic-materials" className="mt-1 flex items-center justify-between border-t border-neutral-100 px-2 py-2 font-semibold hover:text-[#f15a29]"><span>Genetic Materials</span><span>⌄</span></Link>
      </nav>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="rounded-[15px] border border-[#eadfd9] bg-white px-4 py-4 text-center"><div className="text-[20px] font-semibold text-[#ef5b2a]">{value}</div><div className="mt-1 text-[11px] text-neutral-600">{label}</div></div>;
}

export function generateStaticParams() {
  return Object.keys(DETAILS).map((slug) => ({ slug }));
}

export default async function CellLibraryDetailPage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const { slug } = await Promise.resolve(params as { slug: string });
  const detail = DETAILS[slug];
  if (!detail) return notFound();

  return (
    <div className="bg-white">
      <AbmHeroBanner title="Applied Biological Materials (abm) Products & Services" />
      <div className={PAGE_SHELL}>
        <div className="mt-4"><Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Cellular Materials", href: "/products/abm/cellular-materials" }, { label: "Cell Library Collections", href: "/products/abm/cellular-materials/cell-library-collections" }, { label: detail.title }]} /></div>
        <div className="mt-5 grid gap-8 pb-20 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]">
          <aside className="self-start lg:sticky lg:top-24"><SideNav active={slug} /></aside>
          <main className="min-w-0">
            <section className="overflow-hidden rounded-[22px] border border-[#f0ddd5] bg-[#fffaf7]">
              <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="px-6 py-7 md:px-8 md:py-9">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#ef5b2a]">{detail.eyebrow}</div>
                  <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.03em] text-[#404a54] md:text-[34px]">{detail.title}</h1>
                  <p className="mt-3 max-w-3xl text-[15px] font-medium leading-6 text-[#505861]">{detail.lead}</p>
                  {detail.body.map((paragraph) => <p key={paragraph} className="mt-3 max-w-3xl text-[13px] leading-[1.65] text-[#2e2e2e]">{paragraph}</p>)}
                  <div className="mt-5 flex flex-wrap gap-2">{detail.tags.map((tag) => <span key={tag} className="rounded-full border border-[#f1d9cf] bg-white px-3 py-1 text-[11px] font-medium text-[#d95425]">{tag}</span>)}</div>
                </div>
                <div className="relative min-h-[250px] bg-[#f5eee9] lg:min-h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={detail.image} alt={detail.title} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
                </div>
              </div>
            </section>

            <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{detail.stats.map(([value, label]) => <Stat key={`${value}-${label}`} value={value} label={label} />)}</section>

            {slug === "stem-cell-derived-cells" ? (
              <section className="mt-5 rounded-[22px] border border-[#eadfd9] bg-white p-6 md:p-7">
                <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#ef5b2a]">Explore by Research System</div>
                <h2 className="mt-2 text-[23px] font-semibold text-[#404a54]">Select the organ system most relevant to your research</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Link href="/products/abm/cellular-materials/cell-library-collections/stem-cell-derived-cells/neurological" className="group rounded-[18px] border border-[#eadfd9] bg-[#fffaf7] p-5 transition hover:-translate-y-0.5 hover:shadow-sm"><div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#ef5b2a]">Neurological System</div><h3 className="mt-2 text-lg font-semibold text-[#3e4852]">Neuronal & glial models</h3><p className="mt-2 text-[13px] leading-6 text-neutral-600">Human and rodent models for CNS disease research, neuropharmacology, and electrophysiology.</p><span className="mt-4 inline-flex text-sm font-semibold text-[#e95625]">Explore neurological cells →</span></Link>
                  <Link href="/products/abm/cellular-materials/cell-library-collections/stem-cell-derived-cells/cardiovascular" className="group rounded-[18px] border border-[#eadfd9] bg-[#fffaf7] p-5 transition hover:-translate-y-0.5 hover:shadow-sm"><div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#ef5b2a]">Cardiovascular System</div><h3 className="mt-2 text-lg font-semibold text-[#3e4852]">Cardiomyocyte models</h3><p className="mt-2 text-[13px] leading-6 text-neutral-600">Functional cardiac models for cardiotoxicity assessment, disease modelling, and drug discovery.</p><span className="mt-4 inline-flex text-sm font-semibold text-[#e95625]">Explore cardiovascular cells →</span></Link>
                </div>
              </section>
            ) : null}

            <section className="mt-5 rounded-[22px] border border-[#eadfd9] bg-white p-6 md:p-7">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#ef5b2a]">Research Applications</div>
              <h2 className="mt-2 text-[23px] font-semibold text-[#404a54]">Built for practical discovery workflows</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">{detail.highlights.map(([title, text], index) => <article key={title} className="rounded-[18px] border border-[#eadfd9] bg-[#fffdfb] p-5"><div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#f4d7ca] bg-[#fff3ed] text-[12px] font-bold text-[#ef5b2a]">0{index + 1}</div><h3 className="mt-3 text-[15px] font-semibold text-[#404a54]">{title}</h3><p className="mt-2 text-[13px] leading-6 text-neutral-600">{text}</p></article>)}</div>
            </section>

            <section className="mt-5 rounded-[22px] border border-[#eadfd9] bg-[#fbfaf8] p-6 md:p-7">
              <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
                <div><div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#ef5b2a]">Find your model</div><h2 className="mt-2 text-[22px] font-semibold text-[#404a54]">{detail.searchLabel}</h2><p className="mt-2 text-[13px] leading-6 text-neutral-600">Search the ITS BIO catalogue by product name, gene, tissue, species, or catalog number.</p></div>
                <form action="/search" method="get" className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="brand" value="abm" /><input name="q" required placeholder="Name, gene, tissue, or cat. no." className="h-12 min-w-0 flex-1 rounded-full border border-neutral-300 bg-white px-5 text-sm outline-none focus:border-[#ef6331] focus:ring-4 focus:ring-orange-100" /><button className="h-12 rounded-full bg-[#ef5b2a] px-6 text-sm font-semibold text-white">{detail.cta}</button></form>
              </div>
            </section>

            <section className="mt-5 flex flex-col gap-4 rounded-[22px] bg-[#5a2618] px-6 py-6 text-white md:flex-row md:items-center md:justify-between md:px-8"><div><div className="text-[11px] font-bold uppercase tracking-[0.1em] text-orange-200">Need help selecting a model?</div><h2 className="mt-1 text-xl font-semibold">Talk with the ITS BIO team</h2><p className="mt-1 text-[13px] text-white/70">Send the target, cell type, application, or catalog number and we will help identify the closest ABM option.</p></div><Link href="/contact" className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[#6a2b1a]">Contact us →</Link></section>
          </main>
        </div>
      </div>
    </div>
  );
}
