import { notFound } from "next/navigation";

import Breadcrumb from "@/components/site/Breadcrumb";
import HtmlContent from "@/components/site/HtmlContent";
import AbmHeroBanner from "@/components/products/AbmHeroBanner";
import AbmCatalogSideNav from "@/components/products/AbmCatalogSideNav";
import ProductGalleryClient from "@/components/products/ProductGalleryClient";
import ProductTabsClient from "@/components/products/ProductTabs";
import { getStableAbmCellDetail } from "@/lib/abm/stable-cell-detail";
import { isManagedAbmImageUrl } from "@/lib/abm/rebuild-staging";

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
  if (intro && !/product-info-box|\btab-content\b/i.test(intro)) return intro;
  return description ? `<p>${escapeHtml(description)}</p>` : "";
}

export default async function StableCellDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const record = await getStableAbmCellDetail(decodeURIComponent(key));
  if (!record) notFound();

  const title = record.title || record.sku || "Stable Cell Line";
  const galleryUrls = Array.from(new Set([
    String(record.previewImage || "").trim(),
    ...(record.images || []),
  ].filter((url): url is string => isManagedAbmImageUrl(url))));
  const gallery = galleryUrls.map((url) => ({ url, alt: title }));
  const hasGallery = gallery.length > 0;
  const overviewHtml = usableIntroHtml(record.introHtml, record.description || record.overview);
  const documents = (record.documents || []).map((item) => ({
    url: item.url || item.href || "",
    label: item.title || "Document",
  })).filter((item) => item.url);
  const infoRowClass = hasGallery
    ? "grid grid-cols-[100px_1fr] gap-3 py-4 text-sm"
    : "grid grid-cols-[120px_1fr] gap-3 border-b border-orange-50 py-4 text-sm last:border-b-0";

  return (
    <div className="bg-white">
      <AbmHeroBanner title={title} eyebrow="ABM Stable Cell Line" />
      <div className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-[1320px] px-6 py-4">
          <Breadcrumb items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            { label: "ABM", href: "/products/abm" },
            { label: "Stable Cell Lines", href: "/products/abm/cellular-materials/cell-library-collections/stable-cell-lines" },
            { label: title, href: `/products/abm/stable/${encodeURIComponent(record.sku || key)}` },
          ]} />
        </div>
      </div>

      <main className="mx-auto max-w-[1320px] px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]">
          <aside className="self-start lg:sticky lg:top-24">
            <AbmCatalogSideNav mode="product" activeProductRoot="cellular-materials" />
          </aside>

          <section className="min-w-0" data-product-name={title} data-cat-no={record.sku || undefined}>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#e15b2e]">Stable Cell Lines</div>
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
                  <h2 className="text-lg font-semibold text-[#dc5a2b]">Product Information</h2>
                </div>
                <dl className={hasGallery ? "px-6 py-2" : "px-6 py-3 md:px-7"}>
                  {record.sku ? <div className={infoRowClass}><dt className="font-semibold text-slate-900">Cat. No.</dt><dd className="font-medium text-slate-700">{record.sku}</dd></div> : null}
                  {record.unit ? <div className={infoRowClass}><dt className="font-semibold text-slate-900">Unit</dt><dd className="text-slate-700">{record.unit}</dd></div> : null}
                  <div className={infoRowClass}><dt className="font-semibold text-slate-900">Category</dt><dd className="text-slate-700">Stable Cell Lines</dd></div>
                  {record.storage ? <div className={infoRowClass}><dt className="font-semibold text-slate-900">Storage</dt><dd className="text-slate-700">{record.storage}</dd></div> : null}
                </dl>
              </aside>
            </div>

            {overviewHtml ? (
              <section className="mt-9 border-t border-neutral-200 pt-7" aria-labelledby="abm-stable-overview">
                <h2 id="abm-stable-overview" className="text-2xl font-bold text-[#dc5a2b]">Overview</h2>
                <div className="mt-4"><HtmlContent html={overviewHtml} baseUrl={record.sourceUrl} mode="abm-detail" /></div>
              </section>
            ) : null}

            <div className="mt-10 itsbio-product-tabs">
              <ProductTabsClient
                specsHtml={record.specificationsHtml}
                datasheetHtml={record.datasheetHtml}
                documentsHtml={record.documentsHtml}
                faqsHtml={record.faqsHtml}
                referencesHtml={record.referencesHtml}
                reviewsHtml={record.reviewsHtml}
                documents={documents}
                sourceUrl={record.sourceUrl}
                kind="product"
              />
            </div>

            {!record.hasDetail ? (
              <div className="mt-8 border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                This Stable Cell Line is in the official ABM catalogue. Its reviewed detail is still being migrated.
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
