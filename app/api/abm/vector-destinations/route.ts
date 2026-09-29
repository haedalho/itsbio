import { NextRequest, NextResponse } from "next/server";

import { ABM_REBUILD_VERSION, stagedRecordPath, type AbmStagedRecord } from "@/lib/abm/rebuild-staging";
import { verifiedMissingAbmVectorUrl } from "@/lib/abm/vector-links";
import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";

const QUERY = `
*[
  _type == "abmRebuildChunk"
  && version == $version
  && kind == "product"
  && count(records[lower(sku) in $skus]) > 0
]{
  "matches": records[lower(sku) in $skus]
}
`;

type Chunk = { matches?: AbmStagedRecord[] };

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("skus") || "";
  const skus = [...new Set(
    raw.split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 100),
  )];

  if (!skus.length) return NextResponse.json({ items: {} });

  const chunks = await sanityCdnClient.fetch<Chunk[]>(
    QUERY,
    { version: ABM_REBUILD_VERSION, skus },
    PUBLIC_CATALOG_CACHE,
  );

  const records = (Array.isArray(chunks) ? chunks : [])
    .flatMap((chunk) => Array.isArray(chunk.matches) ? chunk.matches : []);

  const items: Record<string, { href: string; external: boolean; hasDetail: boolean }> = {};

  for (const record of records) {
    const sku = String(record.sku || "").trim();
    if (!sku) continue;

    const external = verifiedMissingAbmVectorUrl(record);
    items[sku.toUpperCase()] = {
      href: external || stagedRecordPath("product", record),
      external: Boolean(external),
      hasDetail: record.hasDetail === true,
    };
  }

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
