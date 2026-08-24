import { NextResponse } from "next/server";

import {
  filterOfficialAbmCellModelCatalog,
  getOfficialAbmCellModelFacets,
  type OfficialAbmCellModelFilters,
  type OfficialAbmCellModelType,
} from "@/lib/abm/cell-model-data";
import { withManagedAbmCellProductImages } from "@/lib/abm/cell-product-images";

const MODEL_TYPES = new Set<OfficialAbmCellModelType>(["Immortalized Cells", "Tumor Cells", "Primary Cells"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requestedModel = params.get("modelType") as OfficialAbmCellModelType | null;
  const modelType = requestedModel && MODEL_TYPES.has(requestedModel) ? requestedModel : "Immortalized Cells";
  const filters: OfficialAbmCellModelFilters = {
    query: (params.get("q") || "").trim(),
    species: (params.get("species") || "").trim(),
    bioSystem: (params.get("bioSystem") || "").trim(),
    cellType: (params.get("cellType") || "").trim(),
  };
  const offset = Math.max(0, Number.parseInt(params.get("offset") || "0", 10) || 0);
  const limit = Math.min(48, Math.max(1, Number.parseInt(params.get("limit") || "12", 10) || 12));

  const filtered = filterOfficialAbmCellModelCatalog(modelType, filters);
  const facets = getOfficialAbmCellModelFacets(modelType, filters);
  const items = await withManagedAbmCellProductImages(filtered.slice(offset, offset + limit));

  return NextResponse.json(
    { items, total: filtered.length, offset, hasMore: offset + items.length < filtered.length, facets },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
