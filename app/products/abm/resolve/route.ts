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
  && kind == "product"
  && count(records[
    ($sku != "" && lower(sku) == lower($sku))
    || ($sourceUrl != "" && url == $sourceUrl)
    || ($title != "" && lower(title) == lower($title))
  ]) > 0
]{
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

type StagedChunk = { matches?: AbmStagedRecord[] };
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

export async function GET(request: NextRequest) {
  const title = clean(request.nextUrl.searchParams.get("title"));
  const sku = clean(request.nextUrl.searchParams.get("sku"));
  const sourceUrl = safeOfficialUrl(clean(request.nextUrl.searchParams.get("u")));
  const fallbackQuery = sku || title;

  if (!fallbackQuery && !sourceUrl) {
    return NextResponse.redirect(new URL("/products/abm", request.url), 307);
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

  const staged = (Array.isArray(chunks) ? chunks : [])
    .flatMap((chunk) => Array.isArray(chunk.matches) ? chunk.matches : [])
    .filter(Boolean);

  const exactSku = sku
    ? staged.find((row) => normalized(row.sku) === normalized(sku))
    : undefined;
  const exactUrl = sourceUrl
    ? staged.find((row) => safeOfficialUrl(row.url) === sourceUrl)
    : undefined;
  const exactTitle = title
    ? staged.find((row) => normalized(row.title) === normalized(title))
    : undefined;
  const stagedMatch = exactSku || exactUrl || exactTitle;

  if (stagedMatch) {
    return NextResponse.redirect(new URL(stagedRecordPath("product", stagedMatch), request.url), 307);
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

  const params = new URLSearchParams();
  params.set("q", fallbackQuery || title || sourceUrl);
  params.set("brand", "abm");
  return NextResponse.redirect(new URL(`/search?${params.toString()}`, request.url), 307);
}
