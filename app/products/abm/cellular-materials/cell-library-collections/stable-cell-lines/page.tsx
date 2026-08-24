import AbmStagedCatalog from "@/components/products/AbmStagedCatalog";
import { abmRecordBelongsToProductPath } from "@/lib/abm/catalog-taxonomy";
import { getAbmStagedRecords } from "@/lib/abm/rebuild-staging";
import { CellLibraryShell } from "../_cellLibraryShared";

export default async function StableCellLinesPage({ searchParams }: { searchParams?: Promise<{ q?: string; page?: string }> | { q?: string; page?: string } }) {
  const sp = await Promise.resolve(searchParams as any);
  const query = String(sp?.q || "").trim();
  const page = Math.max(1, Number.parseInt(String(sp?.page || "1"), 10) || 1);
  const all = await getAbmStagedRecords("product");
  const records = all.filter((record) => abmRecordBelongsToProductPath(record, ["cellular-materials", "cell-library-collections", "stable-cell-lines"], "Stable Cell Lines"));

  return <CellLibraryShell title="Stable Cell Lines" active="stable-cell-lines">
    <section className="border-b border-neutral-200 pb-8">
      <h1 className="text-[29px] font-semibold tracking-[-0.025em] text-[#414b55]">Stable Cell Lines</h1>
      <p className="mt-4 max-w-4xl text-[13px] leading-6 text-neutral-700">Generating a high-quality stable cell line—particularly for suspension culture—can require substantial technical optimization, selection, and validation time.</p>
      <p className="mt-3 max-w-4xl text-[13px] leading-6 text-neutral-700">abm maintains a broad ready-to-use stable cell-line collection so researchers can reduce development time and move more quickly into their experiments.</p>
      <p className="mt-3 max-w-4xl text-[13px] leading-6 text-neutral-700">The collection contains more than 1,000 stable cell lines, including 200+ suspension lines, with new models added regularly. Custom stable-line generation is available when a required model is not in the catalogue.</p>
      <div className="mt-7 text-[13px] font-semibold text-neutral-800">Search our extensive collection using Gene name or Tissue type:</div>
      <form className="mt-3 flex max-w-2xl gap-2" method="get"><input name="q" defaultValue={query} placeholder="Gene Name, Symbol or Accession Number" className="h-11 min-w-0 flex-1 border border-neutral-300 bg-white px-4 text-sm" /><button className="h-11 bg-[#f15a29] px-6 text-sm font-semibold text-white">Search</button></form>
    </section>
    <AbmStagedCatalog kind="product" records={records} query={query} page={page} basePath="/products/abm/cellular-materials/cell-library-collections/stable-cell-lines" />
  </CellLibraryShell>;
}
