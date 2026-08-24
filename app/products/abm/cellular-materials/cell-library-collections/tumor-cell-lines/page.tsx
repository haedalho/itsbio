import { getOfficialAbmCellModelCatalog, getOfficialAbmCellModelFacets } from "@/lib/abm/cell-model-data";
import { withManagedAbmCellProductImages } from "@/lib/abm/cell-product-images";
import { CellLibraryShell } from "../_cellLibraryShared";
import ImmortalizedCatalogClient from "../immortalized-cell-lines/ImmortalizedCatalogClient";

export default async function TumorCellLinesPage() {
  const products = getOfficialAbmCellModelCatalog().filter((product) => product.modelType === "Tumor Cells");
  const initialProducts = await withManagedAbmCellProductImages(products.slice(0, 12));

  return <CellLibraryShell title="Tumor Cell Lines" active="tumor-cell-lines">
    <section className="border-b border-neutral-200 pb-8">
      <h1 className="text-[29px] font-semibold tracking-[-0.025em] text-[#414b55]">Tumor Cell Lines – In Vitro Models for Cutting-Edge Research</h1>
      <p className="mt-4 max-w-4xl text-[13px] leading-6 text-neutral-700">abm offers a broad collection of tumour cell lines for cancer research and therapeutic drug development, including human, mouse, canine, and other mammalian models as well as specialty collections such as mast cells.</p>
      <p className="mt-3 max-w-4xl text-[13px] leading-6 text-neutral-700">Use the filters below to narrow the collection by category, species, biological system, and cell type.</p>
    </section>
    <ImmortalizedCatalogClient
      products={initialProducts}
      initialTotal={products.length}
      initialFacets={getOfficialAbmCellModelFacets("Tumor Cells")}
      initialModelType="Tumor Cells"
    />
  </CellLibraryShell>;
}
