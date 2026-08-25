import Image from "next/image";
import Link from "next/link";

import HtmlContent from "@/components/site/HtmlContent";
import type { CleaverProduct } from "@/lib/cleaver/catalog";

function SectionShell({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-t border-slate-300 last:border-b last:border-slate-300">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left marker:content-none md:py-7 [&::-webkit-details-marker]:hidden">
        <span className="text-[18px] font-semibold tracking-[-0.01em] text-slate-900 md:text-[20px]">{title}</span>
        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center text-[28px] font-light leading-none text-[#6d2c86] transition-transform duration-200 group-open:rotate-45">+</span>
      </summary>
      <div className="pb-10 md:pb-12">{children}</div>
    </details>
  );
}

function ProductLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <span className="font-medium text-slate-900">{children}</span>;
  return <Link href={href} className="font-medium text-slate-900 transition hover:text-[#61247b]">{children}</Link>;
}

function SourceImage({ src, alt, size }: { src: string; alt: string; size: number }) {
  const direct = /(^|\.)thistlescientific\.com$/i.test(new URL(src).hostname);
  return <Image src={src} alt={alt} fill unoptimized={direct} sizes={`${size}px`} className="object-contain p-1" />;
}

export default function CleaverProductSections({ product }: { product: CleaverProduct }) {
  const specifications = (product.specRows || []).filter((row) => row.label && row.value);
  const matrix = product.cleaverSpecificationMatrix;
  const documents = (product.docs || []).filter((document) => document.url);
  const included = (product.cleaverIncludedItems || []).filter((item) => item.title);
  const variations = (product.cleaverVariations || []).filter((item) => item.title);
  const accessories = (product.cleaverAccessories || []).filter((item) => item.title);
  const videos = (product.cleaverVideos || []).filter((item) => item.url);
  const hasOverview = Boolean(product.overviewHtml);
  const hasSpecs = Boolean(matrix?.rows?.length && matrix?.headers?.length) || specifications.length > 0 || Boolean(product.specsHtml);
  const hasDocuments = documents.length > 0 || Boolean(product.documentsHtml);
  const documentGroups = documents.reduce<Array<{ title: string; items: typeof documents }>>((groups, document) => {
    const title = document.group || "Documents";
    const group = groups.find((item) => item.title === title);
    if (group) group.items.push(document);
    else groups.push({ title, items: [document] });
    return groups;
  }, []);

  if (!hasOverview && !hasSpecs && !included.length && !hasDocuments && !variations.length && !accessories.length && !videos.length) return null;

  return (
    <section className="mt-14 md:mt-20">
      {hasOverview ? (
        <SectionShell title="Overview" open>
          <HtmlContent html={product.overviewHtml || ""} className="prose prose-slate max-w-[1040px] text-[15px] leading-8 [&_li]:my-1 [&_p]:my-4" />
        </SectionShell>
      ) : null}

      {hasSpecs ? (
        <SectionShell title="Specifications">
          {matrix?.rows?.length && matrix.headers.length ? (
            <div className="overflow-x-auto border border-slate-200">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#f4f1f5]">
                    <th className="border-r border-slate-200 px-5 py-4 font-semibold text-slate-800">SKU</th>
                    {matrix.headers.map((header) => <th key={header} className={`border-r border-slate-200 px-5 py-4 font-semibold last:border-r-0 ${header.toUpperCase() === product.sku.toUpperCase() ? "bg-[#ece1f1] text-[#61247b]" : "text-slate-800"}`}>{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((row, rowIndex) => (
                    <tr key={`${row.label}-${rowIndex}`} className="border-t border-slate-200 even:bg-[#fafafa]">
                      <th scope="row" className="border-r border-slate-200 px-5 py-4 font-semibold text-slate-700">{row.label}</th>
                      {matrix.headers.map((header, index) => <td key={`${header}-${row.label}`} className={`border-r border-slate-200 px-5 py-4 last:border-r-0 ${header.toUpperCase() === product.sku.toUpperCase() ? "bg-[#fbf7fc] font-medium text-slate-900" : "text-slate-700"}`}>{row.values[index] || "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : specifications.length ? (
            <div className="overflow-hidden border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <tbody>{specifications.map((row, index) => <tr key={`${row.label}-${index}`} className="border-b border-slate-200 last:border-b-0 even:bg-[#fafafa]"><th scope="row" className="w-[42%] border-r border-slate-200 px-5 py-4 font-semibold text-slate-700 md:px-7">{row.label}</th><td className="px-5 py-4 text-slate-700 md:px-7">{row.value}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <HtmlContent html={product.specsHtml || ""} className="prose prose-slate max-w-none overflow-x-auto text-sm [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:p-4 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-4" />}
        </SectionShell>
      ) : null}

      {included.length ? (
        <SectionShell title="What's Included">
          <div className="max-w-[1040px] border border-slate-200">
            <div className="grid grid-cols-[minmax(0,1fr)_90px] bg-[#f4f1f5] text-sm font-semibold text-slate-800"><div className="px-5 py-4">Item</div><div className="border-l border-slate-200 px-5 py-4 text-center">Qty</div></div>
            {included.map((item, index) => <div key={`${item.title}-${index}`} className="grid grid-cols-[minmax(0,1fr)_90px] border-t border-slate-200 text-sm even:bg-[#fafafa]"><div className="px-5 py-4 font-medium leading-6 text-slate-800">{item.title}</div><div className="border-l border-slate-200 px-5 py-4 text-center font-semibold text-slate-700">{item.quantity || "—"}</div></div>)}
          </div>
        </SectionShell>
      ) : null}

      {videos.length ? (
        <SectionShell title="Video">
          <div className="grid max-w-[1040px] gap-6 lg:grid-cols-2">
            {videos.map((video, index) => video.embedUrl ? (
              <div key={`${video.url}-${index}`}>
                <div className="overflow-hidden bg-black"><iframe src={video.embedUrl} title={video.title || `${product.title} product video`} className="aspect-video w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
                {video.title ? <p className="mt-3 text-sm font-medium leading-6 text-slate-800">{video.title}</p> : null}
              </div>
            ) : /\.(?:mp4|webm)(?:$|\?)/i.test(video.url) ? (
              <video key={`${video.url}-${index}`} controls preload="metadata" className="aspect-video w-full bg-black"><source src={video.url} /></video>
            ) : null)}
          </div>
        </SectionShell>
      ) : null}

      {hasDocuments ? (
        <SectionShell title="Documents">
          {documents.length ? <div className="max-w-[1040px] space-y-8">{documentGroups.map((group) => <div key={group.title}><h3 className="mb-3 text-[15px] font-semibold text-slate-900">{group.title}</h3><div className="divide-y divide-slate-200 border-y border-slate-200">{group.items.map((document) => <a key={document.url} href={document.url} target="_blank" rel="noopener noreferrer" className="group/doc flex items-center gap-4 py-4 text-sm transition hover:text-[#61247b]"><span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#f3edf6] text-[10px] font-bold tracking-wide text-[#61247b]">PDF</span><span className="min-w-0 flex-1 font-medium leading-6 text-slate-800 group-hover/doc:text-[#61247b]">{document.title || document.label || "Product document"}</span><span aria-hidden className="text-lg text-slate-400 group-hover/doc:text-[#61247b]">↗</span></a>)}</div></div>)}</div> : <HtmlContent html={product.documentsHtml || ""} className="prose prose-slate max-w-none text-sm" />}
        </SectionShell>
      ) : null}

      {variations.length ? (
        <SectionShell title="All Variations">
          <div className="overflow-x-auto border border-slate-200">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead className="bg-[#f4f1f5]"><tr><th className="w-24 px-4 py-4 font-semibold text-slate-800">Image</th><th className="px-5 py-4 font-semibold text-slate-800">Variant</th><th className="w-40 px-5 py-4 font-semibold text-slate-800">Pack/Size</th></tr></thead>
              <tbody>{variations.map((item, index) => <tr key={`${item.sku || item.title}-${index}`} className={`border-t border-slate-200 ${item.sku?.toUpperCase() === product.sku.toUpperCase() ? "bg-[#fbf7fc]" : "even:bg-[#fafafa]"}`}><td className="px-4 py-3">{item.imageUrl ? <div className="relative h-16 w-16 bg-white"><SourceImage src={item.imageUrl} alt={item.title} size={64} /></div> : null}</td><td className="px-5 py-4"><ProductLink href={item.internalHref}>{item.title}</ProductLink>{item.sku?.toUpperCase() === product.sku.toUpperCase() ? <span className="ml-3 text-xs font-semibold text-[#61247b]">Current item</span> : null}</td><td className="px-5 py-4 text-slate-700">{item.packSize || "—"}</td></tr>)}</tbody>
            </table>
          </div>
        </SectionShell>
      ) : null}

      {accessories.length ? (
        <SectionShell title="Accessories">
          <div className="overflow-x-auto border border-slate-200">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead className="bg-[#f4f1f5]"><tr><th className="w-24 px-4 py-4 font-semibold text-slate-800">Image</th><th className="px-5 py-4 font-semibold text-slate-800">Accessory</th><th className="w-40 px-5 py-4 font-semibold text-slate-800">Pack/Size</th></tr></thead>
              <tbody>{accessories.map((item, index) => <tr key={`${item.sourceUrl || item.sku || item.title}-${index}`} className="border-t border-slate-200 even:bg-[#fafafa]"><td className="px-4 py-3">{item.imageUrl ? <div className="relative h-16 w-16 bg-white"><SourceImage src={item.imageUrl} alt={item.title} size={64} /></div> : null}</td><td className="px-5 py-4"><ProductLink href={item.internalHref}>{item.title}</ProductLink></td><td className="px-5 py-4 text-slate-700">{item.packSize || "—"}</td></tr>)}</tbody>
            </table>
          </div>
        </SectionShell>
      ) : null}
    </section>
  );
}
