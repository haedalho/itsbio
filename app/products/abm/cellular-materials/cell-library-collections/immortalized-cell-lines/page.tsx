import Link from "next/link";

import AbmStagedCatalog from "@/components/products/AbmStagedCatalog";
import { abmRecordBelongsToProductPath } from "@/lib/abm/catalog-taxonomy";
import { getAbmStagedRecords } from "@/lib/abm/rebuild-staging";
import { CellLibraryShell, SearchBox, SectionTitle, SmallCard, Stat } from "../_cellLibraryShared";

export default async function ImmortalizedCellLinesPage({ searchParams }: { searchParams?: Promise<{ q?: string; page?: string }> | { q?: string; page?: string } }) {
  const sp = await Promise.resolve(searchParams as any);
  const query = String(sp?.q || "").trim();
  const page = Math.max(1, Number.parseInt(String(sp?.page || "1"), 10) || 1);
  const all = await getAbmStagedRecords("product");
  const records = all.filter((record) => abmRecordBelongsToProductPath(record, ["cellular-materials", "cell-library-collections", "immortalized-cell-lines"], "Immortalized Cell Lines"));

  const applications = [
    ["Drug development & toxicology", "Consistent liver and kidney models support repeatable screening and toxicity studies."],
    ["Disease modelling", "Disease-relevant renewable lines help mechanistic studies and target validation."],
    ["Beauty & personal care", "Skin and follicle models support cosmetic, ageing, and hair research."],
    ["Cultivated meat & food tech", "Muscle-derived lines support alternative-protein and in-vitro meat research."],
    ["Veterinary & pet health", "Canine, feline, and specialty species broaden veterinary research options."],
    ["Allergy & immunology", "Mast-cell models support IgE-pathway and anti-allergy studies."],
  ];

  return <CellLibraryShell title="Immortalized Cell Lines" active="immortalized-cell-lines">
    <section className="rounded-[22px] border border-[#f0ded6] bg-[#fffaf7] p-7 md:p-8">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#f15a29]">Cell library collections</div>
      <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.035em] text-[#414b55]">Immortalized Cell Lines</h1>
      <h2 className="mt-3 max-w-4xl text-[18px] font-semibold leading-7 text-[#505962]">Passage-verified and mycoplasma-tested models for reproducible cell biology workflows.</h2>
      <p className="mt-4 max-w-4xl text-[13px] leading-6 text-neutral-700">abm’s long-running immortalized-cell program spans hundreds of renewable human, mouse, rat, and specialty-species models across dozens of tissue systems.</p>
      <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold text-[#df5526]">{["Industry pioneer", "10+ species", "50+ tissue types", "Mycoplasma tested"].map((x) => <span key={x} className="rounded-full border border-[#f0d7cc] bg-white px-3 py-1.5">{x}</span>)}</div>
      <div className="mt-5 flex flex-wrap gap-2.5"><Link href="#catalog" className="rounded-full bg-[#f15a29] px-5 py-2.5 text-[12px] font-bold text-white">Browse all lines →</Link><Link href="/products/abm/services/cell-and-antibody-services/cell-biology-services/cell-immortalization-service" className="rounded-full border border-[#f15a29] bg-white px-5 py-2.5 text-[12px] font-semibold text-[#f15a29]">Custom immortalization ↗</Link></div>
    </section>

    <div className="mt-4 grid gap-3 sm:grid-cols-3"><Stat value="600+" label="Unique cell lines" /><Stat value="20+" label="Years of expertise" /><Stat value="50+" label="Tissue types" /></div>

    <section className="mt-8 rounded-[22px] border border-[#eadfd9] bg-white p-7"><SectionTitle eyebrow="Research applications" title="Built for diverse discovery workflows" /><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{applications.map(([title, text]) => <SmallCard key={title} title={title} text={text} />)}</div></section>

    <section className="mt-6 rounded-[22px] border border-[#eadfd9] bg-[#fffaf7] p-7"><SectionTitle eyebrow="Why abm immortalized lines" title="Commercially proven, characterized, and ready for scale" /><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><SmallCard title="Original commercial provider" text="A long-standing commercial immortalization program with broad research adoption." /><SmallCard title="Quality-checked lines" text="Passage verification, identity checks, and mycoplasma testing support repeatable work." /><SmallCard title="600+ lines across species" text="A broad collection spanning common and specialty species and tissue types." /><SmallCard title="Can't find your line?" text="Custom immortalization is available for primary cells and uncommon research models." /></div></section>

    <section className="mt-6 rounded-[22px] border border-[#eadfd9] bg-white p-7"><SectionTitle eyebrow="Understanding immortalized cell lines" title="What are immortalized cell lines?" text="Immortalized cells bypass normal replicative senescence, creating renewable populations that can be expanded and banked for repeated experiments." /><div className="mt-5 grid gap-4 md:grid-cols-3"><SmallCard title="hTERT overexpression" text="Telomerase-based approaches extend proliferative lifespan while aiming to preserve key cell traits." /><SmallCard title="Viral oncogene methods" text="SV40 or HPV-based approaches can efficiently bypass selected cell-cycle checkpoints." /><SmallCard title="Application-driven choice" text="The preferred method depends on cell origin, phenotype, assay, and scale." /></div></section>

    <div id="catalog"><SearchBox title="Search and filter immortalized cell lines" placeholder="Name, cat. no., or keyword…" /><AbmStagedCatalog kind="product" records={records} query={query} page={page} basePath="/products/abm/cellular-materials/cell-library-collections/immortalized-cell-lines" /></div>
  </CellLibraryShell>;
}
