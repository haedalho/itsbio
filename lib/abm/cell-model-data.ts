import catalogData from "@/data/abm-cell-model-catalog.json";

export type OfficialAbmCellModelType = "Immortalized Cells" | "Tumor Cells" | "Primary Cells";

export type OfficialAbmCellModelProduct = {
  title: string;
  sku?: string;
  url: string;
  sourceUrl?: string;
  unit?: string;
  modelType: OfficialAbmCellModelType;
  species?: string[];
  bioSystems?: string[];
  cellTypes?: string[];
};

type CatalogPayload = {
  products?: OfficialAbmCellModelProduct[];
};

export const OFFICIAL_ABM_CELL_MODEL_PRODUCTS = (catalogData as CatalogPayload).products || [];

export function getOfficialAbmCellModelCatalog() {
  return OFFICIAL_ABM_CELL_MODEL_PRODUCTS;
}

export function findOfficialAbmCellModelProduct(key: string) {
  const normalized = decodeURIComponent(key).trim().toLowerCase();
  return OFFICIAL_ABM_CELL_MODEL_PRODUCTS.find((product) => (
    String(product.sku || "").trim().toLowerCase() === normalized
    || String(product.url || "").trim().toLowerCase() === normalized
  ));
}
