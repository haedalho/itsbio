import AbmStagedCatalog from "@/components/products/AbmStagedCatalog";
import { abmRecordBelongsToProductPath } from "@/lib/abm/catalog-taxonomy";
import { getAbmStagedRecords } from "@/lib/abm/rebuild-staging";
import { CellLibraryShell, FilterStrip } from "../_cellLibraryShared";

export default async function PrimaryCellsPage({ searchParams }: { searchParams?: Promise<{ q?: string; page?: string }> | { q?: string; page?: string } }) {
  const sp = await Promise.resolve(searchParams as any);
  const query = String(sp?.q || "").trim();
  const page = Math.max(1, Number.parseInt(String(sp?.page || "1"), 10) || 1);
  const all = await getAbmStagedRecords("product");
  const records = all.filter((record) => abmRecordBelongsToProductPath(record, ["cellular-materials", "cell-library-collections", "primary-cells"], "Primary Cells"));

  return <CellLibraryShell title="Primary Cells" active="primary-cells">
    <section className="border-b border-neutral-200 pb-8">
      <h1 className="text-[29px] font-semibold tracking-[-0.025em] text-[#414b55]">Primary Cells</h1>
      <p className="mt-4 max-w-4xl text-[13px] leading-6 text-neutral-700">Primary cells are isolated directly from living tissues and retain many physiological characteristics of their tissue of origin, providing biologically relevant models for life-science research.</p>
      <h2 className="mt-5 text-[16px] font-bold text-[#444]">Applications of Primary Cells:</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[13px] leading-6 text-neutral-700"><li><strong>Drug Discovery and Toxicology:</strong> evaluate efficacy and toxicity in a more natural cellular environment.</li><li><strong>Cancer Research:</strong> investigate tumour growth and progression using tissue-derived models.</li><li><strong>Immunology Studies:</strong> explore immune responses with primary immune cells.</li><li><strong>Tissue Engineering:</strong> build biomimetic tissues for regenerative-medicine research.</li></ul>
      <p className="mt-4 max-w-4xl text-[13px] leading-6 text-neutral-700">abm offers more than 400 primary cell types from human and animal sources.</p>
    </section>
    <section className="mt-6 rounded-[4px] border border-neutral-200 bg-[#fafafa] p-5"><FilterStrip /><div className="mt-4 flex justify-end"><button className="text-[12px] font-semibold text-neutral-500">Clear All</button></div><div className="mt-5 border-t border-neutral-200 pt-5 text-[12px] font-bold uppercase tracking-[0.1em] text-neutral-600">Search Result</div></section>
    <AbmStagedCatalog kind="product" records={records} query={query} page={page} basePath="/products/abm/cellular-materials/cell-library-collections/primary-cells" />
  </CellLibraryShell>;
}
