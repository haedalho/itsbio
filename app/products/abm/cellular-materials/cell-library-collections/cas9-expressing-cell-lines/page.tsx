import AbmStagedCatalog from "@/components/products/AbmStagedCatalog";
import { abmRecordBelongsToProductPath } from "@/lib/abm/catalog-taxonomy";
import { getAbmStagedRecords } from "@/lib/abm/rebuild-staging";
import { CellLibraryShell, FilterStrip, SearchBox, SectionTitle, SmallCard } from "../_cellLibraryShared";

export default async function Cas9ExpressingCellLinesPage({ searchParams }: { searchParams?: Promise<{ q?: string; page?: string }> | { q?: string; page?: string } }) {
  const sp = await Promise.resolve(searchParams as any);
  const query = String(sp?.q || "").trim();
  const page = Math.max(1, Number.parseInt(String(sp?.page || "1"), 10) || 1);
  const all = await getAbmStagedRecords("product");
  const records = all.filter((record) => abmRecordBelongsToProductPath(record, ["cellular-materials", "cell-library-collections", "cas9-expressing-cell-lines"], "Cas9 Expressing Cell Lines"));

  return <CellLibraryShell title="Cas9 Expressing Cell Lines" active="cas9-expressing-cell-lines">
    <section className="rounded-[22px] border border-[#eadfd9] bg-white p-7 md:p-8"><div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#f15a29]">Definition</div><h1 className="mt-2 text-[32px] font-semibold tracking-[-0.03em] text-[#414b55]">Cas9 Expressing Cell Lines</h1><h2 className="mt-4 text-[22px] font-semibold text-[#414b55]">What is a Cas9-expressing stable cell line?</h2><p className="mt-3 max-w-4xl text-[13px] leading-6 text-neutral-700">These stable backgrounds carry integrated Cas9, so researchers can reuse the same edit-ready cell line and change the sgRNA for each target.</p></section>

    <section className="mt-6 rounded-[22px] border border-[#eadfd9] bg-[#fffaf7] p-7"><SectionTitle eyebrow="Why stable Cas9 matters" title="A consistent, reusable editing background" /><div className="mt-5 overflow-hidden rounded-[16px] border border-[#edd9cf] bg-white p-3"><img src="https://www.abmgood.com/assets/images/tinymce/Z8rhFj7qvp6VGpK1JEzLTsvDm8OANiiFdbXvUugB.png" alt="Benefits of Cas9-expressing stable cell lines" className="mx-auto h-auto max-h-[430px] w-full object-contain" /></div></section>

    <section className="mt-6 rounded-[22px] border border-[#eadfd9] bg-white p-7"><SectionTitle eyebrow="Workflow options" title="Three ways to add sgRNA" text="Choose the guide-delivery route that best matches the target, species, and downstream workflow." /><div className="mt-5 grid gap-4 md:grid-cols-3"><SmallCard index="1" title="Ready-to-use sgRNA library" text="Use a pre-designed guide construct for a well-characterized target." /><SmallCard index="2" title="Custom sgRNA vector or virus" text="Build a target-specific guide for novel genes, species, or delivery formats." /><SmallCard index="3" title="In-vitro-transcribed sgRNA" text="Use a transient plasmid-free guide route when integration is undesirable." /></div></section>

    <section className="mt-8 border-t border-neutral-200 pt-8"><SectionTitle eyebrow="Find your model" title="Search and filter Cas9-expressing cell lines" text="Browse by product name, catalogue number, species, or tissue." /><div className="mt-5 rounded-[18px] border border-neutral-200 bg-[#fafafa] p-4"><FilterStrip /><form className="mt-4 flex gap-2" method="get"><input name="q" placeholder="Name, cat. no., species, or tissue…" className="h-11 min-w-0 flex-1 border border-neutral-300 bg-white px-4 text-sm" /><button className="h-11 bg-[#f15a29] px-6 text-sm font-semibold text-white">Search</button></form></div></section>

    <AbmStagedCatalog kind="product" records={records} query={query} page={page} basePath="/products/abm/cellular-materials/cell-library-collections/cas9-expressing-cell-lines" />
  </CellLibraryShell>;
}
