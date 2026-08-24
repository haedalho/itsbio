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

export type OfficialAbmCellFacetOption = {
  value: string;
  count: number;
};

export type OfficialAbmCellModelFacets = {
  species: OfficialAbmCellFacetOption[];
  bioSystems: OfficialAbmCellFacetOption[];
  cellTypes: OfficialAbmCellFacetOption[];
};

export type OfficialAbmCellModelFilters = {
  query?: string;
  species?: string;
  bioSystem?: string;
  cellType?: string;
};

type CatalogPayload = {
  products?: OfficialAbmCellModelProduct[];
};

export const OFFICIAL_ABM_CELL_MODEL_PRODUCTS = (catalogData as CatalogPayload).products || [];

const PRIORITY_SPECIES = [
  "Human (H. sapiens)",
  "Mouse (M. musculus)",
  "Rat (R. norvegicus)",
] as const;

function normalizeSearchValue(value: string) {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase();
}

function displayFacetValue(field: keyof OfficialAbmCellModelFacets, value: string) {
  const normalized = String(value || "").trim();
  return field === "species" && /^n\/?a$/i.test(normalized) ? "Special" : normalized;
}

function includesFacetValue(values: string[] | undefined, selected: string, field: keyof OfficialAbmCellModelFacets) {
  if (!selected) return true;
  const needle = normalizeSearchValue(selected);
  return (values || []).some((value) => normalizeSearchValue(displayFacetValue(field, value)) === needle);
}

function matchesCellCatalogFilters(product: OfficialAbmCellModelProduct, filters: OfficialAbmCellModelFilters) {
  const query = normalizeSearchValue(filters.query || "");
  const searchableValues = [
    product.title,
    product.sku,
    ...(product.species || []).map((value) => displayFacetValue("species", value)),
    ...(product.bioSystems || []),
    ...(product.cellTypes || []),
  ].filter(Boolean).join(" ");

  if (query && !normalizeSearchValue(searchableValues).includes(query)) return false;
  if (!includesFacetValue(product.species, filters.species || "", "species")) return false;
  if (!includesFacetValue(product.bioSystems, filters.bioSystem || "", "bioSystems")) return false;
  if (!includesFacetValue(product.cellTypes, filters.cellType || "", "cellTypes")) return false;
  return true;
}

function collectFacetOptions(products: OfficialAbmCellModelProduct[], field: keyof OfficialAbmCellModelFacets) {
  const counts = new Map<string, number>();

  for (const product of products) {
    const uniqueValues = new Set((product[field] || [])
      .map((value) => displayFacetValue(field, value))
      .filter(Boolean));
    for (const value of uniqueValues) counts.set(value, (counts.get(value) || 0) + 1);
  }

  return Array.from(counts, ([value, count]) => ({ value, count })).sort((left, right) => {
    if (field === "species") {
      const leftPriority = PRIORITY_SPECIES.indexOf(left.value as (typeof PRIORITY_SPECIES)[number]);
      const rightPriority = PRIORITY_SPECIES.indexOf(right.value as (typeof PRIORITY_SPECIES)[number]);
      if (leftPriority >= 0 || rightPriority >= 0) {
        return (leftPriority < 0 ? PRIORITY_SPECIES.length : leftPriority)
          - (rightPriority < 0 ? PRIORITY_SPECIES.length : rightPriority);
      }
    }

    return left.value.localeCompare(right.value, "en", { numeric: true, sensitivity: "base" });
  });
}

export function getOfficialAbmCellModelCatalog() {
  return OFFICIAL_ABM_CELL_MODEL_PRODUCTS;
}

export function filterOfficialAbmCellModelCatalog(modelType: OfficialAbmCellModelType, filters: OfficialAbmCellModelFilters = {}) {
  return OFFICIAL_ABM_CELL_MODEL_PRODUCTS.filter((product) => (
    product.modelType === modelType && matchesCellCatalogFilters(product, filters)
  ));
}

/** Derive each facet from official ABM product fields, applying the other active filters. */
export function getOfficialAbmCellModelFacets(modelType: OfficialAbmCellModelType, filters: OfficialAbmCellModelFilters = {}): OfficialAbmCellModelFacets {
  const categoryProducts = OFFICIAL_ABM_CELL_MODEL_PRODUCTS.filter((product) => product.modelType === modelType);

  return {
    species: collectFacetOptions(
      categoryProducts.filter((product) => matchesCellCatalogFilters(product, { ...filters, species: "" })),
      "species",
    ),
    bioSystems: collectFacetOptions(
      categoryProducts.filter((product) => matchesCellCatalogFilters(product, { ...filters, bioSystem: "" })),
      "bioSystems",
    ),
    cellTypes: collectFacetOptions(
      categoryProducts.filter((product) => matchesCellCatalogFilters(product, { ...filters, cellType: "" })),
      "cellTypes",
    ),
  };
}

export function findOfficialAbmCellModelProduct(key: string) {
  const normalized = decodeURIComponent(key).trim().toLowerCase();
  return OFFICIAL_ABM_CELL_MODEL_PRODUCTS.find((product) => (
    String(product.sku || "").trim().toLowerCase() === normalized
    || String(product.url || "").trim().toLowerCase() === normalized
  ));
}
