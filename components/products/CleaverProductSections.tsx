import Image from "next/image";
import Link from "next/link";

import type { CleaverProduct } from "@/lib/cleaver/catalog";
import HtmlContent from "@/components/site/HtmlContent";

function SectionShell({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-slate-200 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-5 px-1 py-6 text-left marker:content-none md:px-4 md:py-7 [&::-webkit-details-marker]:hidden">
        <span className="text-lg font-semibold tracking-tight text-slate-800 md:text-xl">{title}</span>
        <span aria-hidden className="text-2xl font-light text-[#8650a0] transition-transform duration-200 group-open:rotate-45">+</span>
      </summary>
      <div className="px-1 pb-9 md:px-4 md:pb-11">{children}</div>
    </details>
  );
}

function ProductLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <span className="font-semibold text-slate-800">{children}</span>;
  return <Link href={href} className="font-semibold text-slate-800 underline decoration-slate-300 underline-offset-4 transition hover:text-[#61247b] hover:decoration-[#8650a0]">{children}</Link>;
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
    <section className="mt-16 md:mt-24">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8650a0]">Cleaver Scientific</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Product information</h2>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white px-5 shadow-[0_18px_55px_rgba(42,24,54,0.05)] md:px-7">
        {hasOverview ? (
          <SectionShell title="Overview" open>
            <HtmlContent html={product.overviewHtml || ""} className="prose prose-slate max-w-[980px] text-[15px] leading-8 [&_h2]:mt-9 [&_h2]:text-xl [&_h3]:mt-8 [&_h3]:text-lg [&_li]:my-1 [&_p]:my-4" />
          </SectionShell>
        ) : null}

        {hasSpecs ? (
          <SectionShell title="Specifications">
            {matrix?.rows?.length && matrix.headers.length ? (
              <div className="max-w-[1120px] overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="bg-[#f7f3f9]">
                    <tr>
                      <th className="px-5 py-4 font-semibold text-slate-700">SKU</th>
                      {matrix.headers.map((header) => <th key={header} className={`px-5 py-4 font-semibold ${header.toUpperCase() === product.sku.toUpperCase() ? "bg-[#efe4f4] text-[#61247b]" : "text-slate-700"}`}>{header}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.rows.map((row, rowIndex) => (
                      <tr key={`${row.label}-${rowIndex}`} className="border-t border-slate-200 even:bg-[#fcfbfd]">
                        <th scope="row" className="px-5 py-4 font-semibold text-slate-700">{row.label}</th>
                        {matrix.headers.map((header, index) => <td key={`${header}-${row.label}`} className={`px-5 py-4 text-slate-600 ${header.toUpperCase() === product.sku.toUpperCase() ? "bg-[#faf5fc] font-medium text-slate-800" : ""}`}>{row.values[index] || "—"}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : specifications.length ? (
              <div className="max-w-[1020px] overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full border-collapse text-left text-sm">
                  <tbody>{specifications.map((row, index) => <tr key={`${row.label}-${index}`} className="border-b border-slate-200 last:border-b-0 even:bg-[#faf9fb]"><th scope="row" className="w-[42%] px-5 py-4 font-semibold text-slate-700 md:px-7">{row.label}</th><td className="px-5 py-4 text-slate-600 md:px-7">{row.value}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <HtmlContent html={product.specsHtml || ""} className="prose prose-slate max-w-none overflow-x-auto text-sm [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:p-4 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-4" />}
          </SectionShell>
        ) : null}

        {included.length ? (
          <SectionShell title="What's Included">
            <div className="grid max-w-[1020px] gap-3 sm:grid-cols-2">
              {included.map((item, index) => <div key={`${item.title}-${index}`} className="flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-[#fcfbfd] px-5 py-4"><span className="text-sm font-semibold leading-6 text-slate-700">{item.title}</span>{item.quantity ? <span className="shrink-0 rounded-full bg-[#f4edf8] px-3 py-1 text-xs font-bold text-[#61247b]">Qty {item.quantity}</span> : null}</div>)}
            </div>
          </SectionShell>
        ) : null}

        {videos.length ? (
          <SectionShell title="Video">
            <div className="grid max-w-[1020px] gap-5 lg:grid-cols-2">
              {videos.map((video, index) => video.embedUrl ? (
                <div key={`${video.url}-${index}`}>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black">
                    <iframe src={video.embedUrl} title={video.title || `${product.title} product video`} className="aspect-video w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                  {video.title ? <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{video.title}</p> : null}
                </div>
              ) : /\.(?:mp4|webm)(?:$|\?)/i.test(video.url) ? (
                <video key={`${video.url}-${index}`} controls preload="metadata" className="aspect-video w-full rounded-2xl border border-slate-200 bg-black"><source src={video.url} /></video>
              ) : null)}
            </div>
          </SectionShell>
        ) : null}

        {hasDocuments ? (
          <SectionShell title="Documents">
            {documents.length ? <div className="max-w-[1020px] space-y-7">{documentGroups.map((group) => <div key={group.title}><h3 className="mb-3 text-sm font-semibold text-slate-800">{group.title}</h3><div className="grid gap-4 sm:grid-cols-2">{group.items.map((document) => <a key={document.url} href={document.url} target="_blank" rel="noopener noreferrer" className="group/doc flex min-h-24 items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 transition hover:border-[#b99ac8] hover:bg-[#fcfaff]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f4edf8] text-[11px] font-bold tracking-wide text-[#61247b]">PDF</span><span className="min-w-0 flex-1 text-sm font-semibold leading-6 text-slate-700 group-hover/doc:text-[#61247b]">{document.title || document.label || "Product document"}</span><span aria-hidden className="text-lg text-slate-400 transition group-hover/doc:text-[#61247b]">↗</span></a>)}</div></div>)}</div> : <HtmlContent html={product.documentsHtml || ""} className="prose prose-slate max-w-none text-sm" />}
          </SectionShell>
        ) : null}

        {variations.length ? (
          <SectionShell title="All Variations">
            <div className="max-w-[1120px] overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm"><thead className="bg-[#f7f3f9]"><tr><th className="w-20 px-4 py-4 font-semibold text-slate-700">Image</th><th className="px-5 py-4 font-semibold text-slate-700">Variant</th><th className="px-5 py-4 font-semibold text-slate-700">Catalog No.</th><th className="px-5 py-4 font-semibold text-slate-700">Pack / Size</th></tr></thead><tbody>{variations.map((item, index) => <tr key={`${item.sku || item.title}-${index}`} className={`border-t border-slate-200 ${item.sku?.toUpperCase() === product.sku.toUpperCase() ? "bg-[#faf5fc]" : "even:bg-[#fcfbfd]"}`}><td className="px-4 py-3">{item.imageUrl ? <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-white"><Image src={item.imageUrl} alt="" fill sizes="56px" className="object-contain p-1" /></div> : null}</td><td className="px-5 py-4"><ProductLink href={item.internalHref}>{item.title}</ProductLink>{item.sku?.toUpperCase() === product.sku.toUpperCase() ? <span className="ml-2 rounded-full bg-[#61247b] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Current</span> : null}</td><td className="px-5 py-4 font-mono text-xs text-slate-600">{item.sku || "—"}</td><td className="px-5 py-4 text-slate-600">{item.packSize || "—"}</td></tr>)}</tbody></table>
            </div>
          </SectionShell>
        ) : null}

        {accessories.length ? (
          <SectionShell title="Accessories">
            <div className="grid max-w-[1120px] gap-4 lg:grid-cols-2">
              {accessories.map((item, index) => <article key={`${item.sourceUrl || item.sku || item.title}-${index}`} className="flex min-h-28 gap-4 rounded-2xl border border-slate-200 bg-[#fcfbfd] p-4">{item.imageUrl ? <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white"><Image src={item.imageUrl} alt="" fill sizes="80px" className="object-contain p-1.5" /></div> : null}<div className="min-w-0 py-1"><ProductLink href={item.internalHref}>{item.title}</ProductLink><div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">{item.sku ? <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">Catalog No. {item.sku}</span> : null}{item.packSize ? <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">{item.packSize}</span> : null}</div></div></article>)}
            </div>
          </SectionShell>
        ) : null}
      </div>
    </section>
  );
}
