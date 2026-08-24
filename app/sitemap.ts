import type { MetadataRoute } from "next";

import { OFFICIAL_ABM_CELL_MODEL_PRODUCTS } from "@/lib/abm/cell-model-data";
import { ABM_REBUILD_VERSION, stagedRecordPath, type AbmStagedRecord } from "@/lib/abm/rebuild-staging";
import { absoluteSiteUrl } from "@/lib/site-url";
import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";

type SlugRow = { slug?: string; updatedAt?: string };

const CORE_ROUTES = [
  "/", "/products", "/products/abm", "/products/kent", "/about", "/contact", "/quote", "/notice", "/promotions", "/privacy", "/terms",
  "/products/cleaver", "/products/seedburo", "/products/aims", "/products/bioplastics", "/products/cellfree", "/products/itschem", "/products/plaslabs", "/products/affinity", "/products/dogen",
];

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [abmProducts, abmServices, kentProducts, notices, promotions] = await Promise.all([
    sanityCdnClient.fetch<AbmStagedRecord[]>(`*[_type == "abmRebuildChunk" && version == $version && kind == "product"].records[]{ kind, sku, title, url }`, { version: ABM_REBUILD_VERSION }, PUBLIC_CATALOG_CACHE),
    sanityCdnClient.fetch<AbmStagedRecord[]>(`*[_type == "abmRebuildChunk" && version == $version && kind == "service"].records[]{ kind, sku, title, url }`, { version: ABM_REBUILD_VERSION }, PUBLIC_CATALOG_CACHE),
    sanityCdnClient.fetch<SlugRow[]>(`*[_type == "product" && (!defined(isActive) || isActive == true) && (brandSlug == "kent" || brand->slug.current == "kent") && defined(slug.current)]{ "slug": slug.current, "updatedAt": _updatedAt }`, {}, PUBLIC_CATALOG_CACHE),
    sanityCdnClient.fetch<SlugRow[]>(`*[_type == "notice" && (!defined(isActive) || isActive == true) && defined(slug.current)]{ "slug": slug.current, "updatedAt": _updatedAt }`, {}, PUBLIC_CATALOG_CACHE),
    sanityCdnClient.fetch<SlugRow[]>(`*[_type == "promotion" && (!defined(isActive) || isActive == true) && defined(slug.current)]{ "slug": slug.current, "updatedAt": _updatedAt }`, {}, PUBLIC_CATALOG_CACHE),
  ]);

  const now = new Date();
  const entries: MetadataRoute.Sitemap = CORE_ROUTES.map((path) => ({
    url: absoluteSiteUrl(path),
    lastModified: now,
    changeFrequency: path === "/" || path === "/products" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path.startsWith("/products") ? 0.8 : 0.6,
  }));

  const abmRecords = [...abmProducts, ...abmServices, ...OFFICIAL_ABM_CELL_MODEL_PRODUCTS.map((row) => ({ kind: "product" as const, sku: row.sku || "", title: row.title, url: row.url }))];
  const seenAbm = new Set<string>();
  for (const record of abmRecords) {
    const path = stagedRecordPath(record.kind, record);
    if (seenAbm.has(path)) continue;
    seenAbm.add(path);
    entries.push({ url: absoluteSiteUrl(path), changeFrequency: "monthly", priority: 0.7 });
  }

  for (const row of kentProducts) if (row.slug) entries.push({ url: absoluteSiteUrl(`/products/kent/item/${encodeURIComponent(row.slug)}`), lastModified: row.updatedAt, changeFrequency: "monthly", priority: 0.7 });
  for (const row of notices) if (row.slug) entries.push({ url: absoluteSiteUrl(`/notice/${encodeURIComponent(row.slug)}`), lastModified: row.updatedAt, changeFrequency: "monthly", priority: 0.5 });
  for (const row of promotions) if (row.slug) entries.push({ url: absoluteSiteUrl(`/promotions/${encodeURIComponent(row.slug)}`), lastModified: row.updatedAt, changeFrequency: "weekly", priority: 0.6 });

  return entries;
}
