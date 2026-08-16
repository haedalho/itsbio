import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/site/Breadcrumb";
import HtmlContent from "@/components/site/HtmlContent";
import QuoteTriggerButton from "@/components/site/QuoteTriggerButton";
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

export default async function AbmStagedDetailPage({
  params,
}: {
  params: Promise<{ kind: string; key: string }>;
}) {
  const { kind, key } = await params;
  if (kind !== "product" && kind !== "service") notFound();
  const record = await getAbmStagedDetail(kind, decodeURIComponent(key));
  if (!record) notFound();

  const title = record.title || record.sku || "ABM item";
  const quoteProduct = `${title}${record.sku ? ` — Cat. No. ${record.sku}` : ""}`;
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
  const overviewHtml = usableIntroHtml(record.introHtml, record.description || record.overview);
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

  const infoRowClass = hasGallery
    ? "grid grid-cols-[100px_1fr] gap-3 py-4 text-sm"
    : "grid grid-cols-[120px_1fr] gap-3 border-b border-orange-50 py-4 text-sm last:border-b-0";

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

          <section className="min-w-0">
            <h1 className="max-w-4xl text-3xl font-bold leading-tight tracking-tight text-neutral-950">{title}</h1>

            <div className={[
              "mt-6 grid gap-8 border-t border-neutral-200 pt-7",
              hasGallery ? "md:grid-cols-[minmax(0,1fr)_400px]" : "grid-cols-1",
            ].join(" ")}>
              {hasGallery ? (
                <div className="min-h-[320px]">
                  <ProductGalleryClient images={gallery} title={title} />
                </div>
              ) : null}

              <aside className={`self-start overflow-hidden rounded-xl border-2 border-[#f2632f] bg-white ${hasGallery ? "" : "w-full"}`}>
                <div className="border-b border-orange-100 px-6 py-4">
                  <h2 className="text-lg font-semibold text-[#dc5a2b]">{kind === "product" ? "Product Information" : "Service Information"}</h2>
                </div>

                <div className={hasGallery ? "" : "md:grid md:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]"}>
                  <dl className={hasGallery ? "px-6 py-2" : "px-6 py-3 md:border-r md:border-orange-100 md:px-7"}>
                    {record.sku ? <div className={infoRowClass}><dt className="font-semibold text-slate-900">Cat. No.</dt><dd className="font-medium text-slate-700">{record.sku}</dd></div> : null}
                    {record.unit ? <div className={infoRowClass}><dt className="font-semibold text-slate-900">Unit</dt><dd className="text-slate-700">{record.unit}</dd></div> : null}
                    {(record.category || record.searchCategory || record.filterTitle) ? <div className={infoRowClass}><dt className="font-semibold text-slate-900">Category</dt><dd className="text-slate-700">{record.category || record.searchCategory || record.filterTitle}</dd></div> : null}
                    {record.storage ? <div className={infoRowClass}><dt className="font-semibold text-slate-900">Storage</dt><dd className="text-slate-700">{record.storage}</dd></div> : null}
                    {kind === "service" && serviceFields.map(([label, value]) => (
                      <div key={label} className={infoRowClass}><dt className="font-semibold text-slate-900">{label}</dt><dd className="text-slate-700">{value}</dd></div>
                    ))}
                  </dl>

                  <div className={`${hasGallery ? "border-t border-orange-100 p-5" : "bg-orange-50/35 p-6 md:flex md:flex-col md:justify-center"}`}>
                    <p className="mb-4 text-sm leading-6 text-slate-600">For availability, lead time, and technical questions, contact ITS BIO.</p>
                    <QuoteTriggerButton
                      product={quoteProduct}
                      className="inline-flex w-full items-center justify-center bg-[#f2632f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#d95221]"
                    />
                    <Link href="/contact" className="mt-3 inline-flex w-full items-center justify-center border border-[#f2632f] bg-white px-4 py-3 text-sm font-semibold text-[#dc5a2b] transition hover:bg-orange-50">Contact ITS BIO</Link>
                  </div>
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
            ) : !overviewHtml && !record.specificationsHtml && !record.serviceDetailsHtml ? (
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
