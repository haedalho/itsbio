import { notFound, redirect } from "next/navigation";

import { ABM_REBUILD_VERSION, stagedRecordPath, type AbmStagedRecord } from "@/lib/abm/rebuild-staging";
import { sanityClient } from "@/lib/sanity/sanity.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RESOLVE_STAGED_QUERY = `*[
  _type == "abmRebuildChunk"
  && version == $version
  && count(records[lower(url) in $urls]) > 0
][0].records[lower(url) in $urls][0]`;

const RESOLVE_EXISTING_QUERY = `{
  "category": *[
    _type == "category"
    && (themeKey == "abm" || brand->themeKey == "abm" || brand->slug.current == "abm")
    && lower(sourceUrl) in $urls
  ][0]{path},
  "product": *[
    _type == "product"
    && (brandSlug == "abm" || brand->themeKey == "abm" || brand->slug.current == "abm")
    && lower(sourceUrl) in $urls
  ][0]{"slug": slug.current}
}`;

function abmUrlCandidates(rawValue: string) {
  const value = String(rawValue || "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!value) return [];
  try {
    const url = new URL(value);
    if (!['abmgood.com', 'www.abmgood.com'].includes(url.hostname.toLowerCase())) return [];
    url.protocol = "https:";
    url.hostname = "www.abmgood.com";
    url.hash = "";
    url.search = "";
    const pathVariants = new Set([url.pathname]);
    if (/\.html?$/i.test(url.pathname)) pathVariants.add(url.pathname.replace(/\.html?$/i, ""));
    else if (!url.pathname.endsWith("/")) pathVariants.add(`${url.pathname}.html`);
    if (url.pathname !== "/") pathVariants.add(url.pathname.replace(/\/$/, ""));

    const candidates: string[] = [];
    for (const pathname of pathVariants) {
      url.pathname = pathname;
      const canonical = url.toString();
      candidates.push(canonical, canonical.replace("https://www.abmgood.com/", "https://abmgood.com/"));
    }
    return [...new Set(candidates.map((candidate) => candidate.toLowerCase()))];
  } catch {
    return [];
  }
}

export default async function AbmLegacyResolverPage({
  searchParams,
}: {
  params: Promise<Record<string, never>> | Record<string, never>;
  searchParams: Promise<{ u?: string }> | { u?: string };
}) {
  const resolvedSearch = await Promise.resolve(searchParams);
  const urls = abmUrlCandidates(resolvedSearch?.u || "");
  if (!urls.length) notFound();

  const staged = await sanityClient.fetch<AbmStagedRecord | null>(RESOLVE_STAGED_QUERY, {
    version: ABM_REBUILD_VERSION,
    urls,
  });
  if (staged?.kind && (staged.sku || staged.url)) redirect(stagedRecordPath(staged.kind, staged));

  const existing = await sanityClient.fetch<{
    category?: { path?: string[] };
    product?: { slug?: string };
  }>(RESOLVE_EXISTING_QUERY, { urls });
  if (existing?.category?.path?.length) redirect(`/products/abm/${existing.category.path.join("/")}`);
  if (existing?.product?.slug) redirect(`/products/abm/item/${existing.product.slug}`);

  // Never send a valid official ABM content link to a 404. An unmatched source
  // lands in the staged inventory search while its detail is being collected.
  const source = new URL(urls[0]);
  const query = decodeURIComponent(source.pathname.split("/").pop() || "")
    .replace(/\.html?$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  redirect(`/products/abm/products${query ? `?q=${encodeURIComponent(query)}` : ""}`);
}
