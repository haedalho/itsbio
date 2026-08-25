import Image from "next/image";
import Link from "next/link";

import HtmlContent from "@/components/site/HtmlContent";
import type { CleaverProduct } from "@/lib/cleaver/catalog";

type SectionName = "Overview" | "Specifications" | "What's Included" | "Video" | "Documents" | "All Variations" | "Accessories";

function SectionIcon({ name }: { name: SectionName }) {
  const common = "h-[22px] w-[22px] shrink-0 text-[#6d2c86]";

  if (name === "Specifications") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="1.7" fill="white"/><circle cx="15" cy="12" r="1.7" fill="white"/><circle cx="10" cy="18" r="1.7" fill="white"/></svg>;
  }
  if (name === "What's Included") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden><path d="m4.5 7 7.5-4 7.5 4v10L12 21l-7.5-4V7Z"/><path d="m4.5 7 7.5 4 7.5-4M12 11v10"/><path d="m8.5 5 7.5 4"/></svg>;
  }
  if (name === "Video") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m10 9 5 3-5 3V9Z"/></svg>;
  }
  if (name === "Documents") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden><path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v5h4M9 12h6M9 16h6"/></svg>;
  }
  if (name === "All Variations") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden><rect x="3" y="4" width="6" height="6" rx="1"/><rect x="15" y="4" width="6" height="6" rx="1"/><rect x="9" y="14" width="6" height="6" rx="1"/><path d="M6 10v2h12v-2M12 12v2"/></svg>;
  }
  if (name === "Accessories") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden><path d="M14.2 6.1a4 4 0 0 0-5.3 5.3L3.5 16.8a2.6 2.6 0 1 0 3.7 3.7l5.4-5.4a4 4 0 0 0 5.3-5.3l-2.7 2.7-2.7-2.7 2.7-2.7Z"/></svg>;
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>;
}

function SectionShell({ title, children, open = false }: { title: SectionName; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-t border-[#d9d9d9] last:border-b last:border-[#d9d9d9]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-[18px] text-left marker:content-none md:py-5 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <SectionIcon name={title} />
          <span className="text-[17px] font-semibold leading-6 tracking-[-0.01em] text-[#252525] md:text-[18px]">{title}</span>
        </span>
        <span aria-hidden className="relative h-6 w-6 shrink-0 text-[#6d2c86]">
          <span className="absolute inset-0 flex items-center justify-center text-[24px] font-light leading-none group-open:hidden">+</span>
          <span className="absolute inset-0 hidden items-center justify-center text-[24px] font-light leading-none group-open:flex">−</span>
        </span>
      </summary>
      <div className="pb-9 pt-1 md:pb-10">{children}</div>
    </details>
  );
}

function ProductLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <span className="font-medium text-[#292929]">{children}</span>;
  return <Link href={href} className="font-medium text-[#292929] transition hover:text-[#61247b]">{children}</Link>;
}

function SourceImage({ src, alt, size }: { src: string; alt: string; size: number }) {
  let direct = false;
  try { direct = /(^|\.)thistlescientific\.com$/i.test(new URL(src).hostname); } catch { direct = false; }
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

  const includedHref = (title: string) => {
    const normalized = title.trim().toLowerCase();
    return accessories.find((item) => item.title.trim().toLowerCase() === normalized)?.internalHref
      || variations.find((item) => item.title.trim().toLowerCase() === normalized)?.internalHref;
  };

  if (!hasOverview && !hasSpecs && !included.length && !hasDocuments && !variations.length && !accessories.length && !videos.length) return null;

  return (
    <section className="mt-12 md:mt-16">
      {hasOverview ? (
        <SectionShell title="Overview" open>
          <HtmlContent html={product.overviewHtml || ""} className="prose prose-slate max-w-[1040px] text-[15px] leading-[1.8] [&_li]:my-1 [&_p]:my-3.5" />
        </SectionShell>
      ) : null}

      {hasSpecs ? (
        <SectionShell title="Specifications">
          {matrix?.rows?.length && matrix.headers.length ? (
            <div className="overflow-x-auto border border-[#dedede]">
              <table className="w-full min-w-[760px] border-collapse text-left text-[14px] leading-6">
                <thead><tr className="bg-[#f5f5f5]"><th className="border-r border-[#dedede] px-5 py-3.5 font-semibold text-[#303030]">SKU</th>{matrix.headers.map((header) => <th key={header} className="border-r border-[#dedede] px-5 py-3.5 font-semibold text-[#303030] last:border-r-0">{header}</th>)}</tr></thead>
                <tbody>{matrix.rows.map((row, rowIndex) => <tr key={`${row.label}-${rowIndex}`} className="border-t border-[#dedede]"><th scope="row" className="border-r border-[#dedede] px-5 py-3.5 font-medium text-[#383838]">{row.label}</th>{matrix.headers.map((header, index) => <td key={`${header}-${row.label}`} className="border-r border-[#dedede] px-5 py-3.5 text-[#4a4a4a] last:border-r-0">{row.values[index] || "—"}</td>)}</tr>)}</tbody>
              </table>
            </div>
          ) : specifications.length ? (
            <div className="overflow-hidden border border-[#dedede]"><table className="w-full border-collapse text-left text-[14px] leading-6"><tbody>{specifications.map((row, index) => <tr key={`${row.label}-${index}`} className="border-b border-[#dedede] last:border-b-0"><th scope="row" className="w-[42%] border-r border-[#dedede] px-5 py-3.5 font-medium text-[#383838] md:px-6">{row.label}</th><td className="px-5 py-3.5 text-[#4a4a4a] md:px-6">{row.value}</td></tr>)}</tbody></table></div>
          ) : <HtmlContent html={product.specsHtml || ""} className="prose prose-slate max-w-none overflow-x-auto text-[14px] [&_table]:w-full [&_td]:border [&_td]:border-[#dedede] [&_td]:p-3.5 [&_th]:border [&_th]:border-[#dedede] [&_th]:bg-[#f5f5f5] [&_th]:p-3.5" />}
        </SectionShell>
      ) : null}

      {included.length ? (
        <SectionShell title="What's Included">
          <div className="max-w-[1040px] divide-y divide-[#dedede] border-y border-[#dedede]">
            {included.map((item, index) => (
              <div key={`${item.title}-${index}`} className="flex min-h-[54px] items-center justify-between gap-5 py-3.5 text-[14px] leading-6">
                <ProductLink href={includedHref(item.title)}>{item.title}</ProductLink>
                <span className="shrink-0 text-[#555]">Qty: <strong className="font-semibold text-[#303030]">{item.quantity || "—"}</strong></span>
              </div>
            ))}
          </div>
        </SectionShell>
      ) : null}

      {videos.length ? (
        <SectionShell title="Video">
          <div className="grid max-w-[1040px] gap-6 lg:grid-cols-2">
            {videos.map((video, index) => video.embedUrl ? <div key={`${video.url}-${index}`}><div className="overflow-hidden bg-black"><iframe src={video.embedUrl} title={video.title || `${product.title} product video`} className="aspect-video w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>{video.title ? <p className="mt-3 text-[14px] font-medium leading-6 text-[#333]">{video.title}</p> : null}</div> : /\.(?:mp4|webm)(?:$|\?)/i.test(video.url) ? <video key={`${video.url}-${index}`} controls preload="metadata" className="aspect-video w-full bg-black"><source src={video.url} /></video> : null)}
          </div>
        </SectionShell>
      ) : null}

      {hasDocuments ? (
        <SectionShell title="Documents">
          {documents.length ? <div className="max-w-[1040px] space-y-7">{documentGroups.map((group) => <div key={group.title}><h3 className="mb-2.5 text-[14px] font-semibold text-[#292929]">{group.title}</h3><div className="divide-y divide-[#dedede] border-y border-[#dedede]">{group.items.map((document) => <a key={document.url} href={document.url} target="_blank" rel="noopener noreferrer" className="group/doc flex items-center gap-3.5 py-3.5 text-[14px] transition hover:text-[#61247b]"><span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#f2edf4] text-[9px] font-bold tracking-wide text-[#61247b]">PDF</span><span className="min-w-0 flex-1 font-medium leading-6 text-[#333] group-hover/doc:text-[#61247b]">{document.title || document.label || "Product document"}</span><span aria-hidden className="text-base text-[#777] group-hover/doc:text-[#61247b]">↗</span></a>)}</div></div>)}</div> : <HtmlContent html={product.documentsHtml || ""} className="prose prose-slate max-w-none text-[14px]" />}
        </SectionShell>
      ) : null}

      {variations.length ? (
        <SectionShell title="All Variations">
          <div className="overflow-x-auto border border-[#dedede]"><table className="w-full min-w-[680px] border-collapse text-left text-[14px]"><thead className="bg-[#f5f5f5]"><tr><th className="w-24 px-4 py-3.5 font-semibold text-[#303030]">Image</th><th className="px-5 py-3.5 font-semibold text-[#303030]">Variant</th><th className="w-40 px-5 py-3.5 font-semibold text-[#303030]">Pack/Size</th></tr></thead><tbody>{variations.map((item, index) => <tr key={`${item.sku || item.title}-${index}`} className="border-t border-[#dedede]"><td className="px-4 py-3">{item.imageUrl ? <div className="relative h-16 w-16 bg-white"><SourceImage src={item.imageUrl} alt={item.title} size={64} /></div> : null}</td><td className="px-5 py-3.5"><ProductLink href={item.internalHref}>{item.title}</ProductLink></td><td className="px-5 py-3.5 text-[#4a4a4a]">{item.packSize || "—"}</td></tr>)}</tbody></table></div>
        </SectionShell>
      ) : null}

      {accessories.length ? (
        <SectionShell title="Accessories">
          <div className="overflow-x-auto border border-[#dedede]"><table className="w-full min-w-[680px] border-collapse text-left text-[14px]"><thead className="bg-[#f5f5f5]"><tr><th className="w-24 px-4 py-3.5 font-semibold text-[#303030]">Image</th><th className="px-5 py-3.5 font-semibold text-[#303030]">Accessory</th><th className="w-40 px-5 py-3.5 font-semibold text-[#303030]">Pack/Size</th></tr></thead><tbody>{accessories.map((item, index) => <tr key={`${item.sourceUrl || item.sku || item.title}-${index}`} className="border-t border-[#dedede]"><td className="px-4 py-3">{item.imageUrl ? <div className="relative h-16 w-16 bg-white"><SourceImage src={item.imageUrl} alt={item.title} size={64} /></div> : null}</td><td className="px-5 py-3.5"><ProductLink href={item.internalHref}>{item.title}</ProductLink></td><td className="px-5 py-3.5 text-[#4a4a4a]">{item.packSize || "—"}</td></tr>)}</tbody></table></div>
        </SectionShell>
      ) : null}
    </section>
  );
}
