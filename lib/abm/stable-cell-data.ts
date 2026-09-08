import stableCatalogJson from "@/data/abm-stable-cell-catalog.json";

export type OfficialAbmStableCellProduct = {
  sku: string;
  title: string;
  sourceUrl: string;
  previewImage?: string;
  stableMembership?: boolean;
  primaryCategory?: string;
  unit?: string;
  species?: string;
  tissue?: string;
  tissueSystem?: string;
  cellType?: string;
  productType?: string;
  geneName?: string;
  geneFullName?: string;
  accessionNumber?: string;
  growthProperties?: string;
  donorHistory?: string;
};

type StableCatalog = {
  source?: string;
  searchSource?: string;
  expectedCount?: number;
  collectedCount?: number;
  products?: OfficialAbmStableCellProduct[];
};

const catalog = stableCatalogJson as StableCatalog;
const products = Array.isArray(catalog.products) ? catalog.products : [];
const bySku = new Map(products.map((product) => [String(product.sku || "").trim().toLowerCase(), product]));

export function getOfficialAbmStableCellCatalog() {
  return products;
}

export function getOfficialAbmStableCellCount() {
  return Number(catalog.expectedCount || products.length || 0);
}

export function findOfficialAbmStableCellProduct(key: string) {
  const normalized = decodeURIComponent(String(key || "")).trim().toLowerCase();
  if (!normalized) return undefined;
  return bySku.get(normalized)
    || products.find((product) => String(product.sourceUrl || "").trim().toLowerCase() === normalized);
}

export function getOfficialAbmStableCellSource() {
  return String(catalog.searchSource || catalog.source || "https://www.abmgood.com/Stable-Cell-Lines.html");
}
