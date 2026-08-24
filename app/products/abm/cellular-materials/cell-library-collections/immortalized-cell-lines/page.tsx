import Link from "next/link";

import { getOfficialAbmCellModelCatalog } from "@/lib/abm/cell-model-data";
import { withManagedAbmCellProductImages } from "@/lib/abm/cell-product-images";
import { CellLibraryShell, SectionTitle, SmallCard, Stat } from "../_cellLibraryShared";
import ImmortalizedCatalogClient from "./ImmortalizedCatalogClient";

const applications = [
  ["Drug development & toxicology", "Renewable liver and kidney models support repeatable ADMET, toxicity, and mechanistic screening without recurring donor variation."],
  ["Disease modelling", "Disease-relevant lines provide durable systems for pathway studies, target validation, and longitudinal experiments."],
  ["Beauty & personal care", "Skin, follicle, dermal, and related models support ingredient evaluation, ageing research, and hair biology studies."],
  ["Cultivated meat & food tech", "Muscle-derived models from livestock and avian species can support alternative-protein and cellular-agriculture research."],
  ["Veterinary & pet health", "Canine, feline, and less-common species broaden options for companion-animal biology and veterinary drug discovery."],
  ["Allergy & immunology", "Mast-cell and immune-related models enable pathway studies and anti-allergy screening in controlled backgrounds."],
] as const;

const methods = [
  ["hTERT overexpression", "Telomerase-driven approaches extend proliferative lifespan by maintaining telomeres and can preserve differentiated features in suitable cell types.", "Minimal genomic disruption"],
  ["SV40 Large T antigen", "SV40 Large T can bypass major cell-cycle checkpoints and is effective across many cell types, although extended passage can influence phenotype.", "Broadly applicable"],
  ["Viral oncogenes (HPV E6/E7)", "HPV-derived E6/E7 systems disrupt p53/Rb control and are frequently used for epithelial-cell immortalization.", "Epithelial specialist"],
  ["Myc & Ras oncogenes", "Activated growth-control genes may be used alone or in combinations to maintain proliferation when other approaches are insufficient.", "Combination approach"],
  ["Conditional immortalization", "Inducible or reversible systems allow expansion during culture and can later reduce immortalizing activity for functional studies.", "Reversible & tunable"],
] as const;

const advantages = [
  ["Unlimited, consistent supply", "A banked line can be expanded repeatedly, reducing dependence on new donor material and repeated tissue isolation."],
  ["Reproducibility across experiments", "Stable populations help reduce experiment-to-experiment variability and make protocols easier to reproduce across laboratories."],
  ["Reduced animal use", "Well-characterized in-vitro models can replace some workflows that would otherwise require repeated primary tissue collection."],
  ["Cost and workflow efficiency", "Once established, an immortalized line reduces recurring procurement, screening, isolation, and expansion effort."],
  ["Compatible with genetic engineering", "Long-term proliferation makes these models practical for CRISPR editing, reporters, and stable transgene integration."],
  ["Access to rare cell types", "A difficult-to-source tissue or species can be banked once and shared for future research rather than repeatedly recollected."],
] as const;

const comparisonRows = [
  ["Supply & scalability", "Effectively renewable from a banked stock", "Limited by donor material and isolation yield"],
  ["Reproducibility", "Generally high across controlled passages", "More donor-to-donor and isolation variability"],
  ["Physiological relevance", "Good for many models; phenotype may drift with passage", "Typically closest to native tissue behaviour"],
  ["Lifespan in culture", "Indefinite or greatly extended", "Finite and cell-type dependent"],
  ["Genetic modification", "Well suited to stable editing and reporter workflows", "More difficult because expansion capacity is limited"],
  ["Cost per experiment", "Lower after establishment and banking", "Higher when repeated sourcing and QC are required"],
  ["Best suited for", "Screening, mechanistic studies, engineering, longitudinal assays, scale-up", "Physiological validation and shorter functional studies"],
] as const;

const faqs = [
  ["What is the difference between immortalized cell lines and primary cells?", "Immortalized lines are renewable and can proliferate for extended periods, making them useful for repeatable screening, genetic engineering, and long studies. Primary cells usually preserve more native physiology but have a finite lifespan and greater donor variability."],
  ["What species and tissue types are available?", "The abm collection spans hundreds of lines across human, mouse, rat, bovine, feline, avian, bat, dolphin, primate, and other specialty species, covering many tissue and organ systems."],
  ["Can immortalized cell lines be used for CRISPR editing or stable transgene integration?", "Yes. Their expansion capacity makes immortalized lines practical starting points for CRISPR knockout, reporters, and stable-expression projects."],
  ["What if the cell line I need is not in the catalogue?", "Custom immortalization is available for project-specific primary cells and uncommon tissue or species requirements. The technical team can also help assess a suitable approach."],
  ["What methods are used for cell immortalization?", "Common strategies include hTERT expression, SV40 Large T, HPV E6/E7, oncogene-based systems, and conditional methods. The best choice depends on cell type and the biology that must be preserved."],
  ["Do immortalized lines maintain characteristics of the original tissue?", "Many lines retain important morphology, markers, and functional traits, although phenotype can change during long-term culture. Method selection, passage control, and validation are important."],
  ["How should immortalized cell lines be stored and handled?", "Long-term stocks are normally maintained in liquid nitrogen and handled with standard aseptic cell-culture practices. Following the recommended thawing, culture, and passaging instructions helps protect viability and reproducibility."],
] as const;

export default async function ImmortalizedCellLinesPage() {
  const catalogProducts = getOfficialAbmCellModelCatalog().filter((product) => product.modelType === "Immortalized Cells");
  const initialProducts = await withManagedAbmCellProductImages(catalogProducts.slice(0, 12));

  return (
    <CellLibraryShell title="Immortalized Cell Lines" active="immortalized-cell-lines">
      <section className="rounded-[22px] border border-[#f0ded6] bg-[#fffaf7] p-7 md:p-8">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#f15a29]">Cell library collections</div>
        <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.035em] text-[#414b55]">Immortalized Cell Lines</h1>
        <h2 className="mt-3 max-w-4xl text-[18px] font-semibold leading-7 text-[#505962]">Passage-verified and mycoplasma-tested. Ready-to-use models for reproducible cell biology workflows.</h2>
        <p className="mt-4 max-w-4xl text-[13px] leading-6 text-neutral-700">abm has worked with cell immortalization for more than two decades and maintains a large renewable-cell library spanning human, mouse, rat, and specialty species across a broad range of tissues and organ systems.</p>
        <p className="mt-2 max-w-4xl text-[13px] leading-6 text-neutral-700">The collection is designed for reproducible cell biology, drug discovery, disease modelling, biotechnology, and translational research, with passage verification and mycoplasma testing built into the quality workflow.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold text-[#df5526]">{["Industry pioneer since 2004", "Science Journal featured 2014", "10+ species", "50+ tissue types", "Mycoplasma tested"].map((x) => <span key={x} className="rounded-full border border-[#f0d7cc] bg-white px-3 py-1.5">{x}</span>)}</div>
        <div className="mt-5 flex flex-wrap gap-2.5"><Link href="#catalog" className="rounded-full bg-[#f15a29] px-5 py-2.5 text-[12px] font-bold text-white">Browse all lines →</Link><Link href="/products/abm/services/cell-and-antibody-services/cell-biology-services/cell-immortalization-service" className="rounded-full border border-[#f15a29] bg-white px-5 py-2.5 text-[12px] font-semibold text-[#f15a29]">Custom immortalization ↗</Link></div>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-3"><Stat value="600+" label="Unique cell lines" /><Stat value="20+" label="Years of expertise" /><Stat value="50+" label="Tissue types" /></div>

      <section className="mt-8 rounded-[22px] border border-[#eadfd9] bg-white p-7"><SectionTitle eyebrow="Research applications" title="Built for diverse discovery workflows" /><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{applications.map(([title, text]) => <SmallCard key={title} title={title} text={text} />)}</div></section>

      <section className="mt-6 rounded-[22px] border border-[#eadfd9] bg-[#fffaf7] p-7"><SectionTitle eyebrow="Why abm immortalized lines" title="Commercially proven, fully characterized, and ready for scale" /><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><SmallCard title="The original commercial provider" text="A long-running commercial immortalization program with broad use across research applications." /><SmallCard title="Quality-checked lines" text="Identity, passage history, mycoplasma status, and morphology are reviewed to support repeatable work." /><SmallCard title="600+ lines across species" text="Human, mouse, rat, bat, dolphin, feline, bovine, and other specialty models cover many tissue systems." /><SmallCard title="Can't find your line?" text="Primary cells can be immortalized to order when the catalogue does not contain the required model." /></div></section>

      <section className="mt-6 rounded-[22px] border border-[#eadfd9] bg-white p-7">
        <SectionTitle eyebrow="Understanding immortalized cell lines" title="What are immortalized cell lines?" />
        <div className="mt-4 space-y-3 text-[13px] leading-6 text-neutral-700"><p>Immortalized cell lines are engineered or selected to bypass normal replicative senescence, creating a renewable cell population that can continue dividing well beyond the lifespan of an untreated primary culture.</p><p>Primary somatic cells eventually stop dividing as telomeres shorten and cell-cycle checkpoints activate. Immortalization changes those limits, allowing a model to be expanded, banked, and reused across experiments.</p><p>That durability makes immortalized lines particularly useful for screening, genetic engineering, long-term mechanistic studies, and workflows that require consistent material at scale.</p></div>

        <div className="mt-8"><SectionTitle title="Common immortalization methods" text="Several established strategies can extend cell lifespan. The appropriate method depends on the tissue, intended application, and how closely the final model must preserve differentiated function." /></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{methods.map(([title, text, badge]) => <article key={title} className="rounded-[17px] border border-[#e8dfdb] bg-[#fffaf7] p-5"><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#f15a29]">{badge}</div><h3 className="mt-2 text-[15px] font-bold text-[#3d464f]">{title}</h3><p className="mt-2 text-[12px] leading-[1.65] text-neutral-600">{text}</p></article>)}</div>
      </section>

      <section className="mt-6 rounded-[22px] border border-[#eadfd9] bg-white p-7"><SectionTitle title="Advantages of immortalized cell lines" text="Immortalized models complement primary cells and animal systems when a project needs consistency, scale, long-term culture, or extensive engineering." /><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{advantages.map(([title, text]) => <SmallCard key={title} title={title} text={text} />)}</div></section>

      <section className="mt-6 rounded-[22px] border border-[#eadfd9] bg-white p-7">
        <SectionTitle title="Immortalized vs. primary cells: when to use each" text="The right model depends on the research question. This comparison summarizes the practical trade-offs between a renewable immortalized line and a finite primary-cell culture." />
        <div className="mt-5 overflow-x-auto rounded-[14px] border border-neutral-200"><table className="min-w-[760px] w-full border-collapse text-left text-[12px]"><thead className="bg-[#fff4ee] text-[#ba451c]"><tr><th className="border-b border-neutral-200 px-4 py-3 font-bold">Consideration</th><th className="border-b border-neutral-200 px-4 py-3 font-bold">Immortalized cell lines</th><th className="border-b border-neutral-200 px-4 py-3 font-bold">Primary cells</th></tr></thead><tbody>{comparisonRows.map(([label, immortalized, primary]) => <tr key={label} className="align-top"><th className="border-b border-neutral-100 px-4 py-3 font-semibold text-neutral-800">{label}</th><td className="border-b border-neutral-100 px-4 py-3 leading-5 text-neutral-600">{immortalized}</td><td className="border-b border-neutral-100 px-4 py-3 leading-5 text-neutral-600">{primary}</td></tr>)}</tbody></table></div>
        <div className="mt-4 text-[12px] text-neutral-600">Need primary cells? <Link href="/products/abm/cellular-materials/cell-library-collections/primary-cells" className="font-semibold text-[#e35422] underline underline-offset-4">Browse the Primary Cells collection</Link>.</div>
      </section>

      <ImmortalizedCatalogClient products={initialProducts} initialTotal={catalogProducts.length} />

      <section className="mt-8 rounded-[22px] border border-[#eadfd9] bg-white p-7">
        <SectionTitle eyebrow="FAQ" title="Frequently asked questions" text="Common questions about immortalized cell lines, available models, gene editing, custom immortalization, and cell handling." />
        <div className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200">{faqs.map(([question, answer]) => <details key={question} className="group py-1"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-2 py-4 text-[14px] font-semibold text-neutral-900"><span>{question}</span><span className="text-xl font-light text-[#f15a29] transition group-open:rotate-45">+</span></summary><p className="px-2 pb-5 pr-8 text-[13px] leading-6 text-neutral-600">{answer}</p></details>)}</div>
      </section>

      <section className="mt-6 rounded-[22px] border border-[#f0d8cd] bg-[#fff7f2] p-7 md:flex md:items-center md:justify-between md:gap-8"><div><div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#f15a29]">Need a model not listed?</div><h2 className="mt-2 text-[22px] font-semibold text-[#414b55]">Looking for a cell line not listed here?</h2><p className="mt-2 max-w-2xl text-[13px] leading-6 text-neutral-600">The technical team can help source or immortalize a project-specific primary cell type when the catalogue does not contain the model you need.</p></div><div className="mt-5 flex flex-wrap gap-2 md:mt-0"><Link href="/contact" className="rounded-full bg-[#f15a29] px-5 py-2.5 text-[12px] font-bold text-white">Contact Technical Support</Link><Link href="/products/abm/services/cell-and-antibody-services/cell-biology-services/cell-immortalization-service" className="rounded-full border border-[#f15a29] bg-white px-5 py-2.5 text-[12px] font-semibold text-[#f15a29]">Request Custom Immortalization</Link></div></section>
    </CellLibraryShell>
  );
}
