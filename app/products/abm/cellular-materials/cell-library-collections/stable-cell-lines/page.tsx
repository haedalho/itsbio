import AbmSpecialCellCatalogClient from "@/components/products/AbmSpecialCellCatalogClient";
import { getSpecialAbmCellCatalog } from "@/lib/abm/special-cell-catalog";
import { CellLibraryShell } from "../_cellLibraryShared";

export const revalidate = false;

export default async function StableCellLinesPage() {
  const records = await getSpecialAbmCellCatalog("stable");

  return <CellLibraryShell title="Stable Cell Lines" active="stable-cell-lines">
    <section className="border-b border-neutral-200 pb-8">
      <h1 className="text-[29px] font-semibold tracking-[-0.025em] text-[#414b55]">Stable Cell Lines</h1>
      <p className="mt-4 max-w-4xl text-[13px] leading-6 text-neutral-700">Generating a high-quality stable cell line—particularly for suspension culture—can require substantial technical optimization, selection, and validation time.</p>
      <p className="mt-3 max-w-4xl text-[13px] leading-6 text-neutral-700">abm maintains a broad ready-to-use stable cell-line collection so researchers can reduce development time and move more quickly into their experiments.</p>
      <p className="mt-3 max-w-4xl text-[13px] leading-6 text-neutral-700">The collection contains more than 1,000 stable cell lines, including 200+ suspension lines, with new models added regularly. Custom stable-line generation is available when a required model is not in the catalogue.</p>
      <div className="mt-7 text-[13px] font-semibold text-neutral-800">Search the complete Stable Cell Lines collection by gene, accession number, tissue, species, product name, or Cat. No. using the filters below.</div>
    </section>
    <AbmSpecialCellCatalogClient products={records} />
  </CellLibraryShell>;
}
