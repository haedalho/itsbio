import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/site/Breadcrumb";
import AbmHeroBanner from "@/components/products/AbmHeroBanner";
import AbmCatalogSideNav from "@/components/products/AbmCatalogSideNav";
import ProductGalleryClient from "@/components/products/ProductGalleryClient";
import ProductTabsClient from "@/components/products/ProductTabs";
import { ABM_PRODUCT_GROUPS, findAbmServicePathForLabels } from "@/lib/abm/catalog-taxonomy";
import { getAbmStagedDetail, isManagedAbmImageUrl } from "@/lib/abm/rebuild-staging";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  const listingPath = kind === "product" ? "/products/abm/products" : "/products/abm/services";
  const title = record.title || record.sku || "ABM item";
  const gallery = (record.images || []).filter(isManagedAbmImageUrl).map((url) => ({ url, alt: title }));
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

  return (
    <div className="bg-white">
      <AbmHeroBanner title={title} eyebrow={`ABM ${kind}`} />
      <div className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <Breadcrumb items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            { label: "ABM", href: "/products/abm" },
            { label: kind === "product" ? "Products" : "Services", href: listingPath },
            { label: title, href: `/products/abm/staged/${kind}/${encodeURIComponent(key)}` },
          ]} />
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="self-start lg:sticky lg:top-24">
            <AbmCatalogSideNav activeProductRoot={activeProductRoot} activeServicePath={activeServicePath} />
          </aside>

          <section className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-orange-700">ABM {kind}</span>
              {record.sku ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">Cat. No. {record.sku}</span> : null}
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight tracking-tight text-slate-950 md:text-[42px]">{title}</h1>

            <div className={[
              "mt-8 grid gap-8 border-t border-slate-200 pt-8",
              gallery.length ? "md:grid-cols-[minmax(0,1fr)_360px]" : "xl:grid-cols-[minmax(0,1fr)_390px]",
            ].join(" ")}>
              <div className={gallery.length ? "min-h-[320px]" : "min-h-0"}>
                {gallery.length ? (
                  <ProductGalleryClient images={gallery} title={title} />
                ) : (
                  <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 px-8 text-center">
                    <div className="max-w-md">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl shadow-sm" aria-hidden>⌁</div>
                      <h2 className="mt-4 text-base font-semibold text-slate-900">Official image not available</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">ABM does not provide a valid official image for this record. Product information and reviewed documents remain available below.</p>
                    </div>
                  </div>
                )}
              </div>

              <aside className="self-start overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)]">
                <div className="border-b border-slate-200 bg-slate-950 px-6 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-orange-300">ITS BIO · ABM</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">{kind === "product" ? "Product Information" : "Service Information"}</h2>
                </div>
                <dl className="divide-y divide-slate-100 px-6">
                  {record.sku ? <div className="grid grid-cols-[100px_1fr] gap-3 py-4 text-sm"><dt className="font-semibold text-slate-900">Cat. No.</dt><dd className="font-medium text-slate-700">{record.sku}</dd></div> : null}
                  {record.unit ? <div className="grid grid-cols-[100px_1fr] gap-3 py-4 text-sm"><dt className="font-semibold text-slate-900">Unit</dt><dd className="text-slate-700">{record.unit}</dd></div> : null}
                  {(record.category || record.searchCategory || record.filterTitle) ? <div className="grid grid-cols-[100px_1fr] gap-3 py-4 text-sm"><dt className="font-semibold text-slate-900">Category</dt><dd className="text-slate-700">{record.category || record.searchCategory || record.filterTitle}</dd></div> : null}
                  {record.storage ? <div className="grid grid-cols-[100px_1fr] gap-3 py-4 text-sm"><dt className="font-semibold text-slate-900">Storage</dt><dd className="text-slate-700">{record.storage}</dd></div> : null}
                  {kind === "service" && serviceFields.map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[100px_1fr] gap-3 py-4 text-sm"><dt className="font-semibold text-slate-900">{label}</dt><dd className="text-slate-700">{value}</dd></div>
                  ))}
                </dl>
                <div className="border-t border-orange-100 bg-orange-50/70 p-5">
                  <p className="mb-4 text-sm leading-6 text-slate-600">For availability, lead time, and technical questions, contact ITS BIO.</p>
                  <Link href={`/quote?item=${encodeURIComponent(`${title} ${record.sku || ""}`.trim())}`} className="inline-flex w-full items-center justify-center rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700">Request a Quote</Link>
                  <Link href="/contact" className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-orange-300 bg-white px-4 py-3 text-sm font-semibold text-orange-800 transition hover:bg-orange-100">Contact ITS BIO</Link>
                </div>
              </aside>
            </div>

            <div className="mt-10 itsbio-product-tabs">
              <ProductTabsClient
                overviewHtml={overviewHtml}
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
