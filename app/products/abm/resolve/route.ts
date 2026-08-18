import { NextRequest, NextResponse } from "next/server";

import {
  ABM_REBUILD_VERSION,
  stagedRecordPath,
  type AbmStagedRecord,
} from "@/lib/abm/rebuild-staging";
import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";

const STAGED_QUERY = `
*[
  _type == "abmRebuildChunk"
  && version == $version
  && kind in ["product", "service"]
  && count(records[
    ($sku != "" && lower(sku) == lower($sku))
    || ($sourceUrl != "" && url == $sourceUrl)
    || ($title != "" && lower(title) == lower($title))
  ]) > 0
]{
  "chunkKind": kind,
  "matches": records[
    ($sku != "" && lower(sku) == lower($sku))
    || ($sourceUrl != "" && url == $sourceUrl)
    || ($title != "" && lower(title) == lower($title))
  ][0...8]
}
`;

const LIVE_QUERY = `
*[
  _type == "product"
  && (!defined(isActive) || isActive == true)
  && (
    brandSlug == "abm"
    || brand->slug.current == "abm"
    || brand->themeKey == "abm"
  )
  && (
    ($sku != "" && lower(sku) == lower($sku))
    || ($title != "" && lower(title) == lower($title))
  )
][0...5]{
  _id,
  title,
  sku,
  "slug": slug.current
}
`;

type StagedChunk = {
  chunkKind?: AbmStagedRecord["kind"];
  matches?: Array<Partial<AbmStagedRecord> & Pick<AbmStagedRecord, "sku" | "title" | "url">>;
};
type LiveRow = { _id: string; title?: string; sku?: string; slug?: string };

function clean(value: string | null) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function normalized(value: string) {
  return clean(value).toLowerCase();
}

function safeOfficialUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!["abmgood.com", "www.abmgood.com", "info.abmgood.com"].includes(url.hostname.toLowerCase())) return "";
    url.protocol = "https:";
    url.hostname = "www.abmgood.com";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function safeReturnPath(request: NextRequest) {
  const referer = request.headers.get("referer") || "";
  if (!referer) return "/products/abm";
  try {
    const url = new URL(referer);
    const current = new URL(request.url);
    if (url.origin !== current.origin) return "/products/abm";
    if (!url.pathname.startsWith("/products/abm")) return "/products/abm";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/products/abm";
  }
}

export async function GET(request: NextRequest) {
  const title = clean(request.nextUrl.searchParams.get("title"));
  const sku = clean(request.nextUrl.searchParams.get("sku"));
  const sourceUrl = safeOfficialUrl(clean(request.nextUrl.searchParams.get("u")));

  if (!sku && !title && !sourceUrl) {
    return NextResponse.redirect(new URL(safeReturnPath(request), request.url), 307);
  }

  const [chunks, liveRows] = await Promise.all([
    sanityCdnClient.fetch<StagedChunk[]>(
      STAGED_QUERY,
      { version: ABM_REBUILD_VERSION, title, sku, sourceUrl },
      PUBLIC_CATALOG_CACHE,
    ),
    sanityCdnClient.fetch<LiveRow[]>(
      LIVE_QUERY,
      { title, sku },
      PUBLIC_CATALOG_CACHE,
    ),
  ]);

  const staged: AbmStagedRecord[] = (Array.isArray(chunks) ? chunks : [])
    .flatMap((chunk) => {
      const chunkKind = chunk.chunkKind;
      if (!Array.isArray(chunk.matches) || !chunkKind) return [];
      return chunk.matches
        .filter((row) => row && row.sku != null && row.title != null && row.url != null)
        .map((row) => ({
          ...row,
          kind: row.kind === "product" || row.kind === "service" ? row.kind : chunkKind,
          sku: String(row.sku || ""),
          title: String(row.title || ""),
          url: String(row.url || ""),
        } as AbmStagedRecord));
    });

  // The exact clicked source URL is the strongest signal. This matters on ABM
  // tables where one catalog number can represent a custom service while the
  // visible vector name points at a separate vector-information page.
  const exactUrl = sourceUrl
    ? staged.find((row) => safeOfficialUrl(row.url) === sourceUrl)
    : undefined;
  const exactSku = sku
    ? staged.find((row) => normalized(row.sku) === normalized(sku))
    : undefined;
  const exactTitle = title
    ? staged.find((row) => normalized(row.title) === normalized(title))
    : undefined;
  const stagedMatch = exactUrl || exactSku || exactTitle;

  if (stagedMatch) {
    return NextResponse.redirect(new URL(stagedRecordPath(stagedMatch.kind, stagedMatch), request.url), 307);
  }

  const live = Array.isArray(liveRows) ? liveRows : [];
  const liveMatch = sku
    ? live.find((row) => normalized(row.sku || "") === normalized(sku) && row.slug)
    : live.find((row) => normalized(row.title || "") === normalized(title) && row.slug);

  if (liveMatch?.slug) {
    return NextResponse.redirect(
      new URL(`/products/abm/item/${encodeURIComponent(liveMatch.slug)}`, request.url),
      307,
    );
  }

  // An exact official source URL is still a real ABM destination even when the
  // current staged/live indexes do not contain it. Let the internal legacy
  // resolver make one more URL-based attempt instead of bouncing back to the
  // category page and making the click appear broken.
  if (sourceUrl) {
    return NextResponse.redirect(
      new URL(`/products/abm/legacy?u=${encodeURIComponent(sourceUrl)}`, request.url),
      307,
    );
  }

  // Without an exact source URL we do not invent a destination.
  return NextResponse.redirect(new URL(safeReturnPath(request), request.url), 307);
}
