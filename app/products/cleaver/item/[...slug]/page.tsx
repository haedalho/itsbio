import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/site/Breadcrumb";
import HtmlContent from "@/components/site/HtmlContent";
import { CLEAVER_BRAND_NAME } from "@/lib/cleaver/catalog";
import { getCleaverProduct } from "@/lib/cleaver/sanity";

export const revalidate = 300;

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
      <section className="border-b border-slate-200 bg-[#fbfafc]"><div className="mx-auto max-w-[1260px] px-6 py-6"><Breadcrumb items={crumbs} /></div></section>
      <div className="mx-auto max-w-[1260px] px-6 pt-10 md:pt-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,.95fr)]">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {photos[0] ? <Image src={photos[0]} alt={product.title} fill priority sizes="(max-width: 1024px) 95vw, 580px" className="object-contain p-8" /> : <div className="absolute inset-0 flex items-center justify-center bg-[#faf8fc] p-16"><Image src="/partners/Cleaverscientific-logo.png" alt="Cleaver Scientific" width={330} height={130} className="h-auto max-w-full object-contain opacity-70" /></div>}
            </div>
            {photos.length > 1 ? <div className="mt-4 grid grid-cols-5 gap-3">{photos.slice(1, 6).map((image, index) => <div key={image} className="relative aspect-square rounded-lg border border-slate-200"><Image src={image} alt={`${product.title} ${index + 2}`} fill sizes="100px" className="object-contain p-2" /></div>)}</div> : null}
          </div>

          <section className="py-2">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#8650a0]">Cleaver Scientific</div>
            <h1 className="mt-4 text-[32px] font-semibold leading-tight tracking-tight text-slate-950 md:text-[40px]">{product.title}</h1>
            <div className="mt-6 inline-flex rounded-full bg-[#f5eff9] px-4 py-2 text-sm font-semibold text-[#61247b]">Catalog No. {product.sku}</div>
            {product.summary ? <p className="mt-6 text-[15px] leading-8 text-slate-600">{product.summary}</p> : null}

            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid grid-cols-[105px_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm"><span className="font-semibold text-slate-700">Brand</span><span className="text-slate-600">{CLEAVER_BRAND_NAME}</span><span className="font-semibold text-slate-700">Catalog No.</span><span className="text-slate-600">{product.sku}</span>{product.categoryPathTitles.length ? <><span className="font-semibold text-slate-700">Category</span><span className="text-slate-600">{product.categoryPathTitles.at(-1)}</span></> : null}</div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3"><Link href={quoteHref} className="inline-flex h-12 items-center rounded-full bg-[#61247b] px-7 text-sm font-semibold text-white transition hover:bg-[#471659]">Request a Quote</Link><Link href="/contact" className="inline-flex h-12 items-center rounded-full border border-slate-300 px-6 text-sm font-semibold text-slate-700 transition hover:border-purple-300 hover:text-[#61247b]">Contact ITS BIO</Link></div>
          </section>
        </div>

        <div className="mt-14 space-y-10 border-t border-slate-200 pt-10">
          {product.overviewHtml ? <section><h2 className="text-2xl font-semibold text-slate-950">Overview</h2><HtmlContent html={product.overviewHtml} className="prose prose-slate mt-5 max-w-none text-sm leading-8" /></section> : null}
          {product.specsHtml ? <section><h2 className="text-2xl font-semibold text-slate-950">Specifications</h2><HtmlContent html={product.specsHtml} className="prose prose-slate mt-5 max-w-none overflow-x-auto text-sm [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:p-3 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-3" /></section> : null}
          {product.docs?.length ? <section><h2 className="text-2xl font-semibold text-slate-950">Documents</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{product.docs.filter((document) => document.url).map((document) => <a key={document.url} href={document.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-purple-200 hover:text-[#61247b]"><span>{document.title || document.label || "Product document"}</span><span aria-hidden>↗</span></a>)}</div></section> : product.documentsHtml ? <section><h2 className="text-2xl font-semibold text-slate-950">Documents</h2><HtmlContent html={product.documentsHtml} className="prose prose-slate mt-5 max-w-none text-sm" /></section> : null}
        </div>
      </div>
    </main>
  );
}
