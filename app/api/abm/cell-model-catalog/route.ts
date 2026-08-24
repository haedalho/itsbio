import { NextResponse } from "next/server";

import {
  getOfficialAbmCellModelCatalog,
  type OfficialAbmCellModelType,
} from "@/lib/abm/cell-model-data";
import { withManagedAbmCellProductImages } from "@/lib/abm/cell-product-images";

const MODEL_TYPES = new Set<OfficialAbmCellModelType>(["Immortalized Cells", "Tumor Cells", "Primary Cells"]);

function includesNormalized(values: string[] | undefined, selected: string) {
  if (!selected) return true;
  const needle = selected.toLowerCase();
  return (values || []).some((value) => value.toLowerCase() === needle);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requestedModel = params.get("modelType") as OfficialAbmCellModelType | null;
  const modelType = requestedModel && MODEL_TYPES.has(requestedModel) ? requestedModel : "Immortalized Cells";
  const query = (params.get("q") || "").normalize("NFKC").trim().toLowerCase();
  const species = (params.get("species") || "").trim();
  const bioSystem = (params.get("bioSystem") || "").trim();
  const cellType = (params.get("cellType") || "").trim();
  const offset = Math.max(0, Number.parseInt(params.get("offset") || "0", 10) || 0);
  const limit = Math.min(48, Math.max(1, Number.parseInt(params.get("limit") || "12", 10) || 12));

  const filtered = getOfficialAbmCellModelCatalog().filter((product) => {
    if (product.modelType !== modelType) return false;
    if (query && !`${product.title} ${product.sku || ""}`.toLowerCase().includes(query)) return false;
    if (!includesNormalized(product.species, species)) return false;
    if (!includesNormalized(product.bioSystems, bioSystem)) return false;
    if (!includesNormalized(product.cellTypes, cellType)) return false;
    return true;
  });
  const items = await withManagedAbmCellProductImages(filtered.slice(offset, offset + limit));

  return NextResponse.json(
    { items, total: filtered.length, offset, hasMore: offset + items.length < filtered.length },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
