import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/site/Breadcrumb";
import { getAbmStagedDetail } from "@/lib/abm/rebuild-staging";
import HtmlContent from "@/components/site/HtmlContent";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  const htmlSections = [
    ["Specifications", record.specificationsHtml],
    [kind === "service" ? "Service Details" : "Overview", record.serviceDetailsHtml || record.overview || record.description],
    ["Documents", record.documentsHtml],
    ["FAQs", record.faqsHtml],
    ["References", record.referencesHtml],
    ["Reviews", record.reviewsHtml],
  ] as Array<[string, unknown]>;
  const gallery = Array.isArray(record.images) ? record.images.filter(Boolean) : [];

  return (
    <div>
      <section className="bg-slate-950 px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">ABM {kind}</p>
          <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Products", href: "/products" }, { label: "ABM", href: "/products/abm" }, { label: kind === "product" ? "Products" : "Services", href: listingPath }, { label: title, href: `/products/abm/staged/${kind}/${encodeURIComponent(key)}` }]} />
        <main className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            {gallery.length ? (
              <div className="mb-8 grid gap-4 sm:grid-cols-2">
                {gallery.map((src, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={`${src}-${index}`} src={src} alt={`${title} image ${index + 1}`} className="max-h-[420px] w-full rounded-xl border border-neutral-100 object-contain p-4" />
                ))}
              </div>
            ) : null}
            {htmlSections.map(([heading, value]) => {
              if (typeof value !== "string" || !value.trim()) return null;
              return <section key={heading} className="mt-8 first:mt-0"><h2 className="text-xl font-semibold text-neutral-900">{heading}</h2><HtmlContent html={value} /></section>;
            })}
            {!htmlSections.some(([, value]) => typeof value === "string" && value.trim()) ? <p className="mt-4 leading-7 text-neutral-700">Official detail content is unavailable for this item.</p> : null}
            {record.filterPath?.length ? <p className="mt-6 text-sm text-neutral-500">Category: {record.filterPath.join(" / ")}</p> : null}
          </section>
          <aside className="h-fit rounded-2xl border border-orange-200 bg-orange-50 p-6">
            {record.sku ? <p className="text-sm text-neutral-600"><span className="font-semibold text-neutral-900">Cat. No.</span> {record.sku}</p> : null}
            {record.unit ? <p className="mt-3 text-sm text-neutral-600"><span className="font-semibold text-neutral-900">Unit</span> {record.unit}</p> : null}
            <Link href={`/quote?item=${encodeURIComponent(title)}`} className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600">Request a Quote</Link>
            <Link href="/contact" className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-orange-300 px-4 py-3 text-sm font-semibold text-orange-800 hover:bg-white">Contact ITS BIO</Link>
          </aside>
        </main>
      </div>
    </div>
  );
}
