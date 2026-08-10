import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/site/Breadcrumb";
import ProductGalleryClient from "@/components/products/ProductGalleryClient";
import ProductTabsClient from "@/components/products/ProductTabs";
import { getAbmStagedDetail } from "@/lib/abm/rebuild-staging";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PRODUCT_ROOTS = ["General Materials", "Cellular Materials", "Genetic Materials"];
const SERVICE_ROOTS = ["Cell & Antibody Services", "DNA & Cloning Services", "Recombinant Virus Packaging"];

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

function CategoryNavigation({ kind, paths }: { kind: "product" | "service"; paths: string[][] }) {
  const roots = kind === "product" ? PRODUCT_ROOTS : SERVICE_ROOTS;
  const active = paths[0]?.[0] || "";
  return (
    <nav className="overflow-hidden border border-neutral-200 bg-white" aria-label={`ABM ${kind} categories`}>
      <div className="border-b border-neutral-200 bg-neutral-900 px-5 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white">
        {kind === "product" ? "All Products" : "All Services"}
      </div>
      <div className="divide-y divide-neutral-100">
        {roots.map((root) => (
          <Link
            key={root}
            href={kind === "product" ? "/products/abm/products" : "/products/abm/services"}
            className={`flex items-center justify-between px-5 py-3 text-sm font-medium ${active === root ? "bg-orange-50 text-orange-700" : "text-neutral-700 hover:bg-neutral-50"}`}
          >
            <span>{root}</span><span aria-hidden>›</span>
          </Link>
        ))}
      </div>
      {paths.length ? (
        <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Listed in</div>
          <ul className="mt-3 space-y-2 text-sm leading-5 text-neutral-700">
            {paths.map((path) => <li key={path.join("/")}>{path.join(" / ")}</li>)}
          </ul>
        </div>
      ) : null}
    </nav>
  );
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
  const gallery = (record.images || []).map((url) => ({ url, alt: title }));
  const paths = Array.isArray(record.listingPaths) && record.listingPaths.length
    ? record.listingPaths
    : record.listingFilters?.map((item) => item.path).filter((path): path is string[] => Array.isArray(path) && path.length > 0)
      || (record.filterPath?.length ? [record.filterPath] : []);
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
            <CategoryNavigation kind={kind} paths={paths} />
          </aside>

          <section className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-600">ABM {kind}</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-neutral-900 md:text-4xl">{title}</h1>

            <div className="mt-7 grid gap-8 border-t border-neutral-200 pt-8 md:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-h-[320px]">
                {gallery.length ? <ProductGalleryClient images={gallery} title={title} /> : null}
              </div>

              <aside className="self-start border border-neutral-200 bg-white shadow-sm">
                <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-4">
                  <h2 className="text-base font-semibold text-neutral-900">{kind === "product" ? "Product Information" : "Service Information"}</h2>
                </div>
                <dl className="divide-y divide-neutral-100 px-6">
                  {record.sku ? <div className="grid grid-cols-[100px_1fr] gap-3 py-4 text-sm"><dt className="font-semibold text-neutral-900">Cat. No.</dt><dd className="text-neutral-700">{record.sku}</dd></div> : null}
                  {record.unit ? <div className="grid grid-cols-[100px_1fr] gap-3 py-4 text-sm"><dt className="font-semibold text-neutral-900">Unit</dt><dd className="text-neutral-700">{record.unit}</dd></div> : null}
                  {(record.category || record.searchCategory || record.filterTitle) ? <div className="grid grid-cols-[100px_1fr] gap-3 py-4 text-sm"><dt className="font-semibold text-neutral-900">Category</dt><dd className="text-neutral-700">{record.category || record.searchCategory || record.filterTitle}</dd></div> : null}
                  {record.storage ? <div className="grid grid-cols-[100px_1fr] gap-3 py-4 text-sm"><dt className="font-semibold text-neutral-900">Storage</dt><dd className="text-neutral-700">{record.storage}</dd></div> : null}
                  {kind === "service" && serviceFields.map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[100px_1fr] gap-3 py-4 text-sm"><dt className="font-semibold text-neutral-900">{label}</dt><dd className="text-neutral-700">{value}</dd></div>
                  ))}
                </dl>
                <div className="border-t border-neutral-200 bg-orange-50 p-5">
                  <Link href={`/quote?item=${encodeURIComponent(`${title} ${record.sku || ""}`.trim())}`} className="inline-flex w-full items-center justify-center bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700">Request a Quote</Link>
                  <Link href="/contact" className="mt-3 inline-flex w-full items-center justify-center border border-orange-300 bg-white px-4 py-3 text-sm font-semibold text-orange-800 hover:bg-orange-100">Contact ITS BIO</Link>
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
              />
            </div>

            {!overviewHtml && !record.specificationsHtml && !record.serviceDetailsHtml ? (
              <div className="mt-8 border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                This item is in the authoritative inventory, but its reviewed detail has not been staged yet.
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
