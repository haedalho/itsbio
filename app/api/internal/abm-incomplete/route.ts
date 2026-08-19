import { NextRequest, NextResponse } from "next/server";

import { sanityClient } from "@/lib/sanity/sanity.client";
import { ABM_REBUILD_VERSION } from "@/lib/abm/rebuild-staging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIT_QUERY = `{
  "records": *[
    _type == "abmRebuildChunk"
    && version == $version
    && kind == $kind
  ].records[]{
    kind,
    sku,
    title,
    url,
    unit,
    searchCategory,
    filterTitle,
    filterPath,
    listingFilters,
    hasDetail
  },
  "detailKeys": *[
    _type == "abmRebuildDetailChunk"
    && version == $version
    && kind == $kind
  ].records[].key
}`;

export async function GET(request: NextRequest) {
  const kindParam = request.nextUrl.searchParams.get("kind") || "product";
  const kind = kindParam === "service" ? "service" : "product";
  const offset = Math.max(0, Number.parseInt(request.nextUrl.searchParams.get("offset") || "0", 10) || 0);
  const limit = Math.min(1000, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("limit") || "500", 10) || 500));

  const result = await sanityClient.fetch<{ records?: any[]; detailKeys?: string[] }>(AUDIT_QUERY, {
    version: ABM_REBUILD_VERSION,
    kind,
  });

  const detailKeys = new Set((result.detailKeys || []).map((value) => String(value || "").trim().toLowerCase()));
  const incomplete = (result.records || [])
    .filter((record) => {
      const key = `${kind}:${String(record?.sku || record?.url || "").trim().toLowerCase()}`;
      return !detailKeys.has(key);
    })
    .map((record) => ({
      kind,
      sku: String(record?.sku || ""),
      title: String(record?.title || ""),
      sourceUrl: String(record?.url || ""),
      unit: String(record?.unit || ""),
      searchCategory: String(record?.searchCategory || ""),
      filterTitle: String(record?.filterTitle || ""),
      filterPath: Array.isArray(record?.filterPath) ? record.filterPath : [],
      listingFilters: Array.isArray(record?.listingFilters) ? record.listingFilters : [],
      recordHasDetail: record?.hasDetail ?? null,
      path: `/products/abm/staged/${kind}/${encodeURIComponent(String(record?.sku || record?.url || ""))}`,
    }))
    .sort((a, b) => (a.filterPath.join(" / ") || a.searchCategory).localeCompare(b.filterPath.join(" / ") || b.searchCategory) || a.title.localeCompare(b.title) || a.sku.localeCompare(b.sku));

  return NextResponse.json({
    version: ABM_REBUILD_VERSION,
    kind,
    totalInventory: (result.records || []).length,
    detailRecordCount: detailKeys.size,
    incompleteCount: incomplete.length,
    offset,
    limit,
    rows: incomplete.slice(offset, offset + limit),
  });
}
