import { NextRequest, NextResponse } from "next/server";

import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";

const ROOTS = new Set(["general-materials", "cellular-materials", "genetic-materials"]);

const CATEGORY_QUERY = `
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
  && path[0] == $root
]{
  _id,
  title,
  path
}
`;

type CategoryRow = {
  _id: string;
  title?: string;
  path?: string[];
};

function normalized(value: string) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\brna\s*tracking\b/g, "rna tracking")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTitle(candidate: string, requested: string) {
  const a = normalized(candidate);
  const b = normalized(requested);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.startsWith(`${b} `) || b.startsWith(`${a} `)) return 92;
  if (a.includes(b) || b.includes(a)) return 84;

  const aw = new Set(a.split(" ").filter(Boolean));
  const bw = new Set(b.split(" ").filter(Boolean));
  const overlap = [...bw].filter((word) => aw.has(word)).length;
  if (!overlap) return 0;
  const precision = overlap / Math.max(aw.size, bw.size);
  return Math.round(precision * 75);
}

export async function GET(request: NextRequest) {
  const root = (request.nextUrl.searchParams.get("root") || "").trim().toLowerCase();
  const title = (request.nextUrl.searchParams.get("title") || "").trim();

  if (!ROOTS.has(root)) {
    return NextResponse.redirect(new URL("/products/abm", request.url), 307);
  }

  if (!title) {
    return NextResponse.redirect(new URL(`/products/abm/${root}`, request.url), 307);
  }

  const rows = await sanityCdnClient.fetch<CategoryRow[]>(
    CATEGORY_QUERY,
    { root },
    PUBLIC_CATALOG_CACHE,
  );

  const ranked = (Array.isArray(rows) ? rows : [])
    .filter((row) => Array.isArray(row.path) && row.path[0] === root && row.path.length > 1)
    .map((row) => ({ row, score: scoreTitle(row.title || "", title) }))
    .sort((a, b) => b.score - a.score || (a.row.path?.length || 99) - (b.row.path?.length || 99));

  const best = ranked[0];
  if (!best || best.score < 55 || !best.row.path?.length) {
    return NextResponse.redirect(new URL(`/products/abm/${root}`, request.url), 307);
  }

  return NextResponse.redirect(
    new URL(`/products/abm/${best.row.path.map(encodeURIComponent).join("/")}`, request.url),
    307,
  );
}
