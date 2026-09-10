import { notFound } from "next/navigation";

import Breadcrumb from "@/components/site/Breadcrumb";
import HtmlContent from "@/components/site/HtmlContent";
import AbmHeroBanner from "@/components/products/AbmHeroBanner";
import AbmCatalogSideNav from "@/components/products/AbmCatalogSideNav";
import ProductGalleryClient from "@/components/products/ProductGalleryClient";
import ProductTabsClient from "@/components/products/ProductTabs";
import { ABM_PRODUCT_GROUPS, findAbmServicePathForLabels } from "@/lib/abm/catalog-taxonomy";
import { getAbmStagedDetail, isManagedAbmImageUrl } from "@/lib/abm/rebuild-staging";

export const revalidate = 300;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

function usableIntroHtml(introHtml?: string, description?: string) {
  const intro = String(introHtml || "").trim();
  // Older parser output sometimes captured the complete tab container as intro.
  // Never render that duplicate wrapper; Specifications and resources have their own tabs.
  if (intro && !/product-info-box|\btab-content\b/i.test(intro)) return intro;
  return description ? `<p>${escapeHtml(description)}</p>` : "";
}

function collectionListingOverview(title: string, sku?: string, category?: string) {
  const safeTitle = escapeHtml(title);
  const safeSku = escapeHtml(String(sku || ""));
  const safeCategory = escapeHtml(String(category || "Special Cell Line Collection"));
  return `<p><strong>${safeTitle}</strong> is listed in ABM's ${safeCategory}${safeSku ? ` under Cat. No. ${safeSku}` : ""}. The specifications below reproduce the product information available in the official ABM collection.</p>`;
}

export default async function AbmStagedDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; key: string }>;
  searchParams?: Promise<{ name?: string; category?: string; unit?: string }>;
}) {
  const [{ kind, key }, fallback] = await Promise.all([params, searchParams]);
  if (kind !== "product" && kind !== "service") notFound();
  const decodedKey = decodeURIComponent(key);
  const stagedRecord = await getAbmStagedDetail(kind, decodedKey);
  const fallbackName = String(fallback?.name || "").replace(/\s+/g, " ").trim().slice(0, 240);
  const fallbackCategory = String(fallback?.category || "").replace(/\s+/g, " ").trim().slice(0, 120);
  const fallbackUnit = String(fallback?.unit || "").replace(/\s+/g, " ").trim().slice(0, 120);
  const record = stagedRecord || (kind === "product" && fallbackName ? {
    kind: "product" as const,
    sku: decodedKey,
    title: fallbackName,
    url: "",
    unit: fallbackUnit || undefined,
    category: fallbackCategory || undefined,
    searchCategory: fallbackCategory || undefined,
    hasDetail: false,
    sourceUrl: "",
    images: [],
  } : undefined);
  if (!record) notFound();

  const title = record.title || record.sku || "ABM item";
  const galleryUrls = Array.from(new Set([
    String(record.previewImage || "").trim(),
    ...(record.images || []),
  ].filter((url): url is string => isManagedAbmImageUrl(url))));
  const gallery = galleryUrls.map((url) => ({ url, alt: title }));
  const hasGallery = gallery.length > 0;
  const paths = Array.isArray(record.listingPaths) && record.listingPaths.length
    ? record.listingPaths
    : record.listingFilters?.map((item) => item.path).filter((path): path is string[] => Array.isArray(path) && path.length > 0)
      || (record.filterPath?.length ? [record.filterPath] : []);
  const activeProductRoot = kind === "product"
    ? ABM_PRODUCT_GROUPS.find((group) => paths.some((path) => path.includes(group.title)))?.slug || ""
    : "";
  const activeServicePath = kind === "service"
    ? findAbmServicePathForLabels([...paths.flat(), ...(record.breadcrumbs || [])])
    : [];
  const belongsToSpecialCellCollection = paths.some((path) => path.includes("Special Cell Line Collections"));
  const isCollectionTableRecord = record.verification?.source === "official-collection-table"
    || (kind === "product"
      && belongsToSpecialCellCollection
      && !record.introHtml
      && Boolean(record.specificationsHtml)
      && !hasGallery);
  const overviewHtml = usableIntroHtml(record.introHtml, record.description || record.overview)
    || (kind === "product" && isCollectionTableRecord
      ? collectionListingOverview(title, record.sku, record.category || record.searchCategory || record.filterTitle)
      : "");
  const documents = (record.documents || []).map((item) => ({
    url: item.url || item.href || "",
    label: item.title || "Document",
  })).filter((item) => item.url);
  const rawServiceFields = record.serviceOffer?.fields;
  const serviceFields = (Array.isArray(rawServiceFields)
    ? rawServiceFields.map((field) => [field.label || "", field.value || ""] as const)
    : Object.entries(rawServiceFields || {})).filter(([label, value]) => {
    const normalized = label.toLowerCase();
    return value && !/price|cost|amount|currency|cart|quantity|^cat\.?\s*no\.?$|^unit$|^service(?:\s+name)?$/.test(normalized);
  });

  const infoRowClass = "grid grid-cols-[100px_1fr] gap-3 py-4 text-sm";

  return (
    <div className="bg-white">
      <AbmHeroBanner title={title} eyebrow={`ABM ${kind}`} />
      <div className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-[1320px] px-6 py-4">
          <Breadcrumb items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            { label: "ABM", href: "/products/abm" },
            { label: title, href: `/products/abm/staged/${kind}/${encodeURIComponent(key)}` },
          ]} />
        </div>
      </div>

      <main className="mx-auto max-w-[1320px] px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]">
          <aside className="self-start lg:sticky lg:top-24">
            <AbmCatalogSideNav mode={kind} activeProductRoot={activeProductRoot} activeServicePath={activeServicePath} />
          </aside>

          <section
            className="min-w-0"
            data-product-name={title}
            data-cat-no={record.sku || undefined}
          >
            <h1 className="max-w-4xl text-3xl font-bold leading-tight tracking-tight text-neutral-950">{title}</h1>

            <div className="mt-6 grid gap-8 border-t border-neutral-200 pt-7 md:grid-cols-[minmax(0,1fr)_400px]">
              {hasGallery ? (
                <div className="min-h-[320px]">
                  <ProductGalleryClient images={gallery} title={title} />
                </div>
              ) : (
                <div className="relative mx-auto flex aspect-square w-full max-w-[560px] items-center justify-center overflow-hidden bg-neutral-50 px-8 text-center">
                  <div>
                    <svg aria-hidden="true" viewBox="0 0 48 48" className="mx-auto h-12 w-12 text-neutral-300" fill="none">
                      <rect x="5" y="7" width="38" height="34" rx="4" stroke="currentColor" strokeWidth="2" />
                      <path d="m11 34 9-10 7 7 4-5 6 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="33" cy="17" r="3" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    <p className="mt-4 text-sm font-medium text-neutral-500">Product image not provided by manufacturer</p>
                  </div>
                </div>
              )}

              <aside className="self-start overflow-hidden rounded-xl border-2 border-[#f2632f] bg-white">
                <div className="border-b border-orange-100 px-6 py-4">
                  <h2 className="text-lg font-semibold text-[#dc5a2b]">{kind === "product" ? "Product Information" : "Service Information"}</h2>
                </div>

                <div>
                  <dl className="px-6 py-2">
                    {kind === "product" ? (
                      <>
                        <div className={infoRowClass}><dt className="font-semibold text-slate-900">Cat. No.</dt><dd className="font-medium text-slate-700">{record.sku || "—"}</dd></div>
                        <div className={infoRowClass}><dt className="font-semibold text-slate-900">Unit</dt><dd className="text-slate-700">{record.unit || "—"}</dd></div>
                        <div className={infoRowClass}><dt className="font-semibold text-slate-900">Category</dt><dd className="text-slate-700">{record.category || record.searchCategory || record.filterTitle || "—"}</dd></div>
                        <div className={infoRowClass}><dt className="font-semibold text-slate-900">Storage</dt><dd className="text-slate-700">{record.storage || "—"}</dd></div>
                      </>
                    ) : null}
                    {kind === "service" && record.sku ? <div className={infoRowClass}><dt className="font-semibold text-slate-900">Cat. No.</dt><dd className="font-medium text-slate-700">{record.sku}</dd></div> : null}
                    {kind === "service" && record.unit ? <div className={infoRowClass}><dt className="font-semibold text-slate-900">Unit</dt><dd className="text-slate-700">{record.unit}</dd></div> : null}
                    {kind === "service" && (record.category || record.searchCategory || record.filterTitle) ? <div className={infoRowClass}><dt className="font-semibold text-slate-900">Category</dt><dd className="text-slate-700">{record.category || record.searchCategory || record.filterTitle}</dd></div> : null}
                    {kind === "service" && record.storage ? <div className={infoRowClass}><dt className="font-semibold text-slate-900">Storage</dt><dd className="text-slate-700">{record.storage}</dd></div> : null}
                    {kind === "service" && serviceFields.map(([label, value]) => (
                      <div key={label} className={infoRowClass}><dt className="font-semibold text-slate-900">{label}</dt><dd className="text-slate-700">{value}</dd></div>
                    ))}
                  </dl>
                </div>
              </aside>
            </div>

            {kind === "product" && overviewHtml ? (
              <section className="mt-9 border-t border-neutral-200 pt-7" aria-labelledby="abm-product-overview">
                <h2 id="abm-product-overview" className="text-2xl font-bold text-[#dc5a2b]">Overview</h2>
                <div className="mt-4"><HtmlContent html={overviewHtml} baseUrl={record.sourceUrl} mode="abm-detail" /></div>
              </section>
            ) : null}

            <div className="mt-10 itsbio-product-tabs">
              <ProductTabsClient
                overviewHtml={kind === "service" ? overviewHtml : undefined}
                specsHtml={record.specificationsHtml}
                serviceDetailsHtml={record.serviceDetailsHtml}
                datasheetHtml={record.datasheetHtml}
                documentsHtml={record.documentsHtml}
                faqsHtml={record.faqsHtml}
                referencesHtml={record.referencesHtml}
                reviewsHtml={record.reviewsHtml}
                documents={documents}
                sourceUrl={record.sourceUrl}
                kind={kind}
              />
            </div>

            {!record.hasDetail ? (
              <div className="mt-8 border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                This item is in the authoritative ABM inventory. Its reviewed detail is being migrated and will appear here after the complete staging corpus passes validation.
              </div>
            ) : !record.sourceUnavailable && !overviewHtml && !record.specificationsHtml && !record.serviceDetailsHtml ? (
              <div className="mt-8 border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                The reviewed record is available, but the official source does not provide additional detail sections for this item.
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
