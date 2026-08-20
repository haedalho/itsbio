import { NextResponse } from "next/server";

import { getAbmStagedRecords } from "@/lib/abm/rebuild-staging";

type ModelType = "Immortalized Cells" | "Tumor Cells" | "Primary Cells";

function recordText(record: Awaited<ReturnType<typeof getAbmStagedRecords>>[number]) {
  return [
    record.title,
    record.sku,
    record.searchCategory,
    record.filterTitle,
    ...(record.filterPath || []),
    ...(record.listingFilters || []).flatMap((filter) => [filter.title, ...(filter.path || [])]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function classify(record: Awaited<ReturnType<typeof getAbmStagedRecords>>[number]): ModelType | undefined {
  const title = String(record.title || "").toLowerCase();
  const text = recordText(record);
  const looksLikeCellProduct = /^t\d{3,}/i.test(String(record.sku || "")) || /\bcell(?:s| line| lines)?\b/i.test(text);
  if (!looksLikeCellProduct) return undefined;

  if (/\bimmortalized\b/i.test(title) || /immortalized cell lines?/i.test(text)) return "Immortalized Cells";
  if (/\b(?:tumou?r|cancer)\b/i.test(title) || /tumou?r cell lines?|cancer cell lines?/i.test(text)) return "Tumor Cells";
  if (/\bprimary\b/i.test(title) || /primary cells?/i.test(text)) return "Primary Cells";
  return undefined;
}

export async function GET() {
  const records = await getAbmStagedRecords("product");
  const items = records
    .map((record) => {
      const modelType = classify(record);
      if (!modelType) return undefined;
      return {
        title: record.title,
        sku: record.sku,
        url: record.url,
        unit: record.unit,
        previewImage: record.previewImage,
        searchCategory: record.searchCategory,
        filterTitle: record.filterTitle,
        filterPath: record.filterPath,
        listingFilters: record.listingFilters,
        modelType,
      };
    })
    .filter(Boolean);

  const unique = Array.from(
    new Map(items.map((item) => [`${item!.modelType}:${item!.sku || item!.url}`, item])).values(),
  );

  return NextResponse.json(
    { items: unique },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
