import { getOfficialAbmCellModelCatalog, getOfficialAbmCellModelFacets } from "@/lib/abm/cell-model-data";
import { withManagedAbmCellProductImages } from "@/lib/abm/cell-product-images";
import { CellLibraryShell } from "../_cellLibraryShared";
import ImmortalizedCatalogClient from "../immortalized-cell-lines/ImmortalizedCatalogClient";

export default async function PrimaryCellsPage() {
  const products = getOfficialAbmCellModelCatalog().filter((product) => product.modelType === "Primary Cells");
  const initialProducts = await withManagedAbmCellProductImages(products.slice(0, 12));

  return <CellLibraryShell title="Primary Cells" active="primary-cells">
    <section className="border-b border-neutral-200 pb-8">
      <h1 className="text-[29px] font-semibold tracking-[-0.025em] text-[#414b55]">Primary Cells</h1>
      <p className="mt-4 max-w-4xl text-[13px] leading-6 text-neutral-700">Primary cells are isolated directly from living tissues and retain many physiological characteristics of their tissue of origin, providing biologically relevant models for life-science research.</p>
      <h2 className="mt-5 text-[16px] font-bold text-[#444]">Applications of Primary Cells:</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[13px] leading-6 text-neutral-700"><li><strong>Drug Discovery and Toxicology:</strong> evaluate efficacy and toxicity in a more natural cellular environment.</li><li><strong>Cancer Research:</strong> investigate tumour growth and progression using tissue-derived models.</li><li><strong>Immunology Studies:</strong> explore immune responses with primary immune cells.</li><li><strong>Tissue Engineering:</strong> build biomimetic tissues for regenerative-medicine research.</li></ul>
      <p className="mt-4 max-w-4xl text-[13px] leading-6 text-neutral-700">abm offers more than 400 primary cell types from human and animal sources.</p>
    </section>
    <ImmortalizedCatalogClient
      products={initialProducts}
      initialTotal={products.length}
      initialFacets={getOfficialAbmCellModelFacets("Primary Cells")}
      initialModelType="Primary Cells"
    />
  </CellLibraryShell>;
}
