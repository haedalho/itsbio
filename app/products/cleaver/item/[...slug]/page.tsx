import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CleaverHeroBanner from "@/components/products/CleaverHeroBanner";
import CleaverProductGallery from "@/components/products/CleaverProductGallery";
import Breadcrumb from "@/components/site/Breadcrumb";
import HtmlContent from "@/components/site/HtmlContent";
import { CLEAVER_BRAND_NAME } from "@/lib/cleaver/catalog";
import { getCleaverProduct } from "@/lib/cleaver/sanity";

export const revalidate = 30;

type PageProps = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCleaverProduct(slug.at(-1) || "");
  if (!product) return { title: "Product not found" };
  return {
    title: `${product.title} | ${product.sku} | ${CLEAVER_BRAND_NAME}`,
    description: product.summary || `${product.title} (${product.sku}) from Cleaver Scientific. Request product information and a quote from ITS BIO.`,
  };
}

export default async function CleaverProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getCleaverProduct(slug.at(-1) || "");
  if (!product) notFound();

  const photos = Array.from(new Set([product.image, ...(product.images || [])].filter((image): image is string => Boolean(image))));
  const highlights = (product.highlights || []).filter(Boolean).slice(0, 6);
  const specifications = (product.specRows || []).filter((row) => row.label && row.value);
  const documents = (product.docs || []).filter((document) => document.url);
  const sections = [
    product.overviewHtml ? { id: "overview", label: "Overview" } : null,
    specifications.length || product.specsHtml ? { id: "specifications", label: "Specifications" } : null,
    documents.length || product.documentsHtml ? { id: "documents", label: "Documents" } : null,
  ].filter((section): section is { id: string; label: string } => Boolean(section));
  const quoteHref = `/quote?product=${encodeURIComponent(`${product.title} (${product.sku})`)}`;
  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: CLEAVER_BRAND_NAME, href: "/products/cleaver" },
    ...product.categoryPathTitles.map((label, index) => ({ label, href: `/products/cleaver/${product.categoryPath.slice(0, index + 1).join("/")}` })),
    { label: product.title },
  ];

  return (
    <main className="bg-white pb-20">
      <CleaverHeroBanner title={product.title} eyebrow="Cleaver Scientific product" />
      <section className="border-b border-slate-200 bg-[#fbfafc]"><div className="mx-auto max-w-[1260px] px-6 py-6"><Breadcrumb items={crumbs} /></div></section>
      <div className="mx-auto max-w-[1260px] px-6 pt-10 md:pt-16">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,.9fr)] lg:gap-16">
          <CleaverProductGallery images={photos} title={product.title} />

          <section className="py-2 lg:py-5">
            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.24em] text-[#8650a0]"><span className="h-px w-8 bg-[#8650a0]" />Cleaver Scientific</div>
            <h1 className="mt-5 text-[32px] font-semibold leading-[1.12] tracking-tight text-slate-950 md:text-[44px]">{product.title}</h1>
            <div className="mt-6 inline-flex rounded-full bg-[#f4edf8] px-4 py-2 text-sm font-semibold text-[#61247b]">Catalog No. {product.sku}</div>
            {product.summary ? <p className="mt-7 text-[15px] leading-8 text-slate-600">{product.summary}</p> : null}
            {highlights.length ? <ul className="mt-7 grid gap-3 border-t border-slate-100 pt-6">{highlights.map((highlight) => <li key={highlight} className="flex items-start gap-3 text-sm leading-6 text-slate-700"><span aria-hidden className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f3ebf8] text-xs font-bold text-[#743693]">✓</span><span>{highlight}</span></li>)}</ul> : null}

            <div className="mt-8 rounded-2xl border border-slate-200 bg-[#fbfafc] p-5">
              <div className="grid grid-cols-[105px_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm"><span className="font-semibold text-slate-700">Brand</span><span className="text-slate-600">{CLEAVER_BRAND_NAME}</span><span className="font-semibold text-slate-700">Catalog No.</span><span className="text-slate-600">{product.sku}</span>{product.categoryPathTitles.length ? <><span className="font-semibold text-slate-700">Category</span><span className="text-slate-600">{product.categoryPathTitles.at(-1)}</span></> : null}</div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3"><Link href={quoteHref} className="inline-flex h-12 items-center rounded-full bg-[#61247b] px-7 text-sm font-semibold text-white transition hover:bg-[#471659]">Request a Quote</Link><Link href="/contact" className="inline-flex h-12 items-center rounded-full border border-slate-300 px-6 text-sm font-semibold text-slate-700 transition hover:border-purple-300 hover:text-[#61247b]">Technical Support</Link></div>
          </section>
        </div>

        <div className="mt-16 border-t border-slate-200 md:mt-24">
          {sections.length ? <nav aria-label="Product information sections" className="flex flex-wrap gap-x-8 gap-y-2 border-b border-slate-200 py-5">{sections.map((section) => <a key={section.id} href={`#${section.id}`} className="text-sm font-semibold text-slate-600 transition hover:text-[#61247b]">{section.label}</a>)}</nav> : null}
          <div className="space-y-16 py-12 md:py-16">
            {product.overviewHtml ? <section id="overview" className="scroll-mt-28"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8650a0]">Product information</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Overview</h2><HtmlContent html={product.overviewHtml} className="prose prose-slate mt-6 max-w-[920px] text-[15px] leading-8 [&_h2]:mt-9 [&_h2]:text-xl [&_h3]:mt-8 [&_h3]:text-lg [&_li]:my-1 [&_p]:my-4" /></section> : null}
            {specifications.length || product.specsHtml ? <section id="specifications" className="scroll-mt-28"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8650a0]">Technical details</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Specifications</h2>{specifications.length ? <div className="mt-6 max-w-[980px] overflow-hidden rounded-2xl border border-slate-200"><table className="w-full border-collapse text-left text-sm"><tbody>{specifications.map((row, index) => <tr key={`${row.label}-${index}`} className="border-b border-slate-200 last:border-b-0 even:bg-[#faf9fb]"><th scope="row" className="w-[42%] px-5 py-4 font-semibold text-slate-700 md:px-7">{row.label}</th><td className="px-5 py-4 text-slate-600 md:px-7">{row.value}</td></tr>)}</tbody></table></div> : <HtmlContent html={product.specsHtml || ""} className="prose prose-slate mt-6 max-w-none overflow-x-auto text-sm [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:p-4 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-4" />}</section> : null}
            {documents.length ? <section id="documents" className="scroll-mt-28"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8650a0]">Downloads & resources</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Documents</h2><div className="mt-6 grid gap-4 sm:grid-cols-2">{documents.map((document) => <a key={document.url} href={document.url} target="_blank" rel="noopener noreferrer" className="group flex min-h-24 items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 transition hover:border-[#b99ac8] hover:bg-[#fcfaff]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f4edf8] text-[11px] font-bold tracking-wide text-[#61247b]">PDF</span><span className="min-w-0 flex-1 text-sm font-semibold leading-6 text-slate-700 group-hover:text-[#61247b]">{document.title || document.label || "Product document"}</span><span aria-hidden className="text-lg text-slate-400 transition group-hover:text-[#61247b]">↗</span></a>)}</div></section> : product.documentsHtml ? <section id="documents" className="scroll-mt-28"><h2 className="text-3xl font-semibold tracking-tight text-slate-950">Documents</h2><HtmlContent html={product.documentsHtml} className="prose prose-slate mt-5 max-w-none text-sm" /></section> : null}
          </div>
        </div>
        <section className="flex flex-col gap-5 rounded-2xl bg-[#f5f1f8] px-7 py-8 md:flex-row md:items-center md:justify-between md:px-9"><div><h2 className="text-lg font-semibold text-slate-900">Need help selecting the right system?</h2><p className="mt-1 text-sm leading-6 text-slate-600">Our team can help with product specifications, compatibility, and quotations.</p></div><Link href="/contact" className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-[#61247b] px-6 text-sm font-semibold text-white transition hover:bg-[#471659]">Contact our specialists</Link></section>
      </div>
    </main>
  );
}
