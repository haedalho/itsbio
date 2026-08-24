import AbmSpecialCellCatalogClient from "@/components/products/AbmSpecialCellCatalogClient";
import { getSpecialAbmCellCatalog } from "@/lib/abm/special-cell-catalog";
import { abmResourceImagePath } from "@/lib/abm/resource-links";
import { CellLibraryShell, SearchBox, SectionTitle, SmallCard } from "../_cellLibraryShared";

export default async function CrisprKoCellLinesPage({ searchParams }: { searchParams?: Promise<{ q?: string; page?: string }> | { q?: string; page?: string } }) {
  const sp = await Promise.resolve(searchParams as any);
  const query = String(sp?.q || "").trim();
  const records = await getSpecialAbmCellCatalog("crispr");

  return <CellLibraryShell title="CRISPR KO Cell Lines" active="crispr-ko-cell-lines">
    <section className="rounded-[22px] border border-[#eadfd9] bg-white p-7 md:p-8">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#f15a29]">CRISPR fundamentals</div>
      <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.03em] text-[#414b55]">CRISPR Knockout Cell Line Collection</h1>
      <h2 className="mt-4 text-[22px] font-semibold text-[#414b55]">What is CRISPR, and why does it matter for cell biology?</h2>
      <p className="mt-3 max-w-4xl text-[13px] leading-6 text-neutral-700">CRISPR-Cas9 uses a guide RNA to direct Cas9 to a selected DNA target. Knockout workflows rely on the cut and cellular repair process to disrupt gene function.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2"><SmallCard title="sgRNA" text="The guide sequence directs Cas9 to the selected genomic target." /><SmallCard title="PAM site" text="A short adjacent DNA motif required for Cas9 recognition." /><SmallCard title="Double-strand break" text="Cas9 cuts both DNA strands at the programmed target site." /><SmallCard title="NHEJ repair" text="Error-prone repair often introduces indels that disrupt gene function." /></div>
    </section>

    <section className="mt-6 overflow-hidden rounded-[22px] border border-[#eadfd9] bg-[#fffaf7] p-7"><SectionTitle eyebrow="Four-stage workflow" title="CRISPR knockout cell line generation" text="Guide design, delivery, cutting and repair, followed by clone screening and validation." /><div className="mt-5 overflow-hidden rounded-[16px] border border-[#edd9cf] bg-white p-3"><img src={abmResourceImagePath("https://www.abmgood.com/assets/images/tinymce/OVaSD7bzWMRkH5m9MvHyzXAfsrFDOYITucdbmQza.png")} alt="CRISPR knockout editing workflow" className="mx-auto h-auto max-h-[430px] w-full object-contain" /></div></section>

    <section className="mt-6 rounded-[22px] border border-[#eadfd9] bg-white p-7"><SectionTitle eyebrow="Portfolio highlights" title="Everything you need to knock out a gene, without running the edit yourself" /><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><SmallCard title="2,000+ ready-to-use KO lines" text="A large pre-made inventory searchable by target and cell background." /><SmallCard title="Custom knockout generation" text="Project-specific KO development is available when the desired model is not in stock." /><SmallCard title="QC data included" text="Supporting validation helps researchers move into downstream assays sooner." /><SmallCard title="Faster than DIY" text="Avoid repeated guide, delivery, clone-isolation, and screening optimization." /><SmallCard title="Cell line insurance" text="Optional protection is available for selected cell-line handling issues." /></div></section>

    <section className="mt-6 rounded-[22px] border border-[#eadfd9] bg-[#fffaf7] p-7"><SectionTitle eyebrow="Build vs. buy" title="Generating a knockout in-house vs. ordering one from abm" /><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-[17px] border border-neutral-200 bg-white p-5"><div className="text-[12px] font-bold uppercase tracking-[0.1em] text-neutral-500">DIY</div><h3 className="mt-2 text-lg font-semibold">In-house CRISPR editing</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-[12px] leading-5 text-neutral-600"><li>Design and validate guides</li><li>Optimize Cas9 and guide delivery</li><li>Isolate and screen clones</li><li>Confirm the edit before the assay</li></ul></div><div className="rounded-[17px] border border-[#f1d5c9] bg-white p-5"><div className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#f15a29]">abm</div><h3 className="mt-2 text-lg font-semibold">Ready-made or custom KO line</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-[12px] leading-5 text-neutral-600"><li>Select an in-stock or custom combination</li><li>Editing and clone screening handled upstream</li><li>Receive supporting QC information</li><li>Move directly into downstream assays</li></ul></div></div></section>

    <SearchBox title="Search the ready-to-use CRISPR KO collection" placeholder="Gene name, symbol, accession number, or cell background…" />
    <AbmSpecialCellCatalogClient products={records} initialQuery={query} />
  </CellLibraryShell>;
}
