import { NextResponse } from "next/server";

import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";

const ROOTS = ["general-materials", "cellular-materials", "genetic-materials"] as const;

const QUERY = `
*[
  _type == "category"
  && (!defined(isActive) || isActive == true)
  && (
    brandSlug == "abm"
    || themeKey == "abm"
    || brand->themeKey == "abm"
    || brand->slug.current == "abm"
  )
  && count(path) > 1
  && path[0] in $roots
]
| order(path[0] asc, order asc, title asc) {
  _id,
  title,
  path,
  order
}
`;

type Row = {
  _id: string;
  title?: string;
  path?: string[];
  order?: number;
};

export async function GET() {
  const rows = await sanityCdnClient.fetch<Row[]>(QUERY, { roots: ROOTS }, PUBLIC_CATALOG_CACHE);

  const items = (Array.isArray(rows) ? rows : [])
    .filter((row) => Array.isArray(row.path) && row.path.length > 1 && ROOTS.includes(row.path[0] as (typeof ROOTS)[number]))
    .sort((a, b) => (a.path?.length || 99) - (b.path?.length || 99))
    .map((row) => ({
      id: row._id,
      title: String(row.title || "").trim(),
      path: row.path as string[],
      href: `/products/abm/${(row.path as string[]).map(encodeURIComponent).join("/")}`,
    }));

  return NextResponse.json(
    { items },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}
