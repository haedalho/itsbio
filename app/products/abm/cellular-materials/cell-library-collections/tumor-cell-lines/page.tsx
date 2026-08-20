import AbmStagedCatalog from "@/components/products/AbmStagedCatalog";
import { abmRecordBelongsToProductPath } from "@/lib/abm/catalog-taxonomy";
import { getAbmStagedRecords } from "@/lib/abm/rebuild-staging";
import { CellLibraryShell, FilterStrip } from "../_cellLibraryShared";

export default async function TumorCellLinesPage({ searchParams }: { searchParams?: Promise<{ q?: string; page?: string }> | { q?: string; page?: string } }) {
  const sp = await Promise.resolve(searchParams as any);
  const query = String(sp?.q || "").trim();
  const page = Math.max(1, Number.parseInt(String(sp?.page || "1"), 10) || 1);
  const all = await getAbmStagedRecords("product");
  const records = all.filter((record) => abmRecordBelongsToProductPath(record, ["cellular-materials", "cell-library-collections", "tumor-cell-lines"], "Tumor Cell Lines"));

  return <CellLibraryShell title="Tumor Cell Lines" active="tumor-cell-lines">
    <section className="border-b border-neutral-200 pb-8">
      <h1 className="text-[29px] font-semibold tracking-[-0.025em] text-[#414b55]">Tumor Cell Lines – In Vitro Models for Cutting-Edge Research</h1>
      <p className="mt-4 max-w-4xl text-[13px] leading-6 text-neutral-700">abm offers a broad collection of tumour cell lines for cancer research and therapeutic drug development, including human, mouse, canine, and other mammalian models as well as specialty collections such as mast cells.</p>
      <p className="mt-3 max-w-4xl text-[13px] leading-6 text-neutral-700">Use the filters below to narrow the collection by category, species, biological system, and cell type.</p>
    </section>
    <section className="mt-6 rounded-[4px] border border-neutral-200 bg-[#fafafa] p-5"><FilterStrip /><div className="mt-4 flex justify-end"><button className="text-[12px] font-semibold text-neutral-500">Clear All</button></div><div className="mt-5 border-t border-neutral-200 pt-5 text-[12px] font-bold uppercase tracking-[0.1em] text-neutral-600">Search Result</div></section>
    <AbmStagedCatalog kind="product" records={records} query={query} page={page} basePath="/products/abm/cellular-materials/cell-library-collections/tumor-cell-lines" />
  </CellLibraryShell>;
}
