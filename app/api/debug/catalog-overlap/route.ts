import { NextResponse } from "next/server";

import { getAbmStagedRecords } from "@/lib/abm/rebuild-staging";
import { sanityCdnClient, PUBLIC_CATALOG_CACHE } from "@/lib/sanity/sanity.client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type KentRow = {
  title?: string;
  sku?: string;
  variants?: Array<{ sku?: string; catNo?: string }>;
};

const KENT_QUERY = `
*[
  _type == "product"
  && (!defined(isActive) || isActive == true)
  && (
    brandSlug == "kent"
    || brand->slug.current == "kent"
    || brand->themeKey == "kent"
  )
]{
  title,
  sku,
  variants[]{sku, catNo}
}
`;

function normalize(value?: string) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[‐‑‒–—―−]/g, "-")
    .trim()
    .toUpperCase();
}

function usable(value: string) {
  return Boolean(value && value !== "N/A" && value !== "NA" && value !== "-");
}

export async function GET() {
  const [abmProducts, abmServices, kentRows] = await Promise.all([
    getAbmStagedRecords("product"),
    getAbmStagedRecords("service"),
    sanityCdnClient.fetch<KentRow[]>(KENT_QUERY, {}, PUBLIC_CATALOG_CACHE),
  ]);

  const abm = new Map<string, Array<{ kind: string; title: string; sku: string }>>();
  for (const row of [...abmProducts, ...abmServices]) {
    const key = normalize(row.sku);
    if (!usable(key)) continue;
    const list = abm.get(key) || [];
    list.push({ kind: row.kind, title: row.title, sku: row.sku });
    abm.set(key, list);
  }

  const kent = new Map<string, Array<{ title: string; sku: string }>>();
  for (const row of Array.isArray(kentRows) ? kentRows : []) {
    const values = [row.sku, ...(row.variants || []).flatMap((variant) => [variant.sku, variant.catNo])];
    for (const raw of values) {
      const key = normalize(raw);
      if (!usable(key)) continue;
      const list = kent.get(key) || [];
      list.push({ title: row.title || "Untitled", sku: String(raw || "") });
      kent.set(key, list);
    }
  }

  const overlaps = [...abm.keys()]
    .filter((key) => kent.has(key))
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({
      value: key,
      abm: abm.get(key),
      kent: kent.get(key),
    }));

  return NextResponse.json({
    abmUniqueSkuCount: abm.size,
    kentUniqueItemCount: kent.size,
    overlapCount: overlaps.length,
    overlaps,
  });
}
