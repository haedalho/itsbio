import Link from "next/link";

import CleaverSourceImage from "@/components/products/CleaverSourceImage";
import HtmlContent from "@/components/site/HtmlContent";
import type { CleaverProduct } from "@/lib/cleaver/catalog";

type IncludedCardProps = {
  title: string;
  quantity?: string;
  imageUrl?: string;
  href?: string;
};

type SourceAwareCleaverProduct = CleaverProduct & {
  cleaverSourceSectionOrder?: string[];
  cleaverExtraSections?: Array<{ title: string; html?: string }>;
};

function sectionKey(value: string) {
  const key = value.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");
  if (key === "overview") return "overview";
  if (key === "specifications" || key === "specification") return "specifications";
  if (key === "what's included" || key === "whats included") return "included";
  if (key === "video" || key === "videos") return "video";
  if (key === "documents" || key === "document" || key === "downloads") return "documents";
  if (key === "all variations" || key === "variations") return "variations";
  if (key === "accessories" || key === "accessory") return "accessories";
  return `extra:${key}`;
}
function SectionIcon({ name }: { name: string }) {
  const key = sectionKey(name);
  const common = "h-[22px] w-[22px] shrink-0 text-[#6d2c86]";

  if (key === "specifications") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="1.7" fill="white"/><circle cx="15" cy="12" r="1.7" fill="white"/><circle cx="10" cy="18" r="1.7" fill="white"/></svg>;
  }
  if (key === "included") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M8 4v16M13 4v16M18 4v16"/></svg>;
  }
  if (key === "video") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m10 9 5 3-5 3V9Z"/></svg>;
  }
  if (key === "documents") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden><path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v5h4M9 12h6M9 16h6"/></svg>;
  }
  if (key === "variations") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden><rect x="3" y="4" width="6" height="6" rx="1"/><rect x="15" y="4" width="6" height="6" rx="1"/><rect x="9" y="14" width="6" height="6" rx="1"/><path d="M6 10v2h12v-2M12 12v2"/></svg>;
  }
  if (key === "accessories") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden><path d="M14.2 6.1a4 4 0 0 0-5.3 5.3L3.5 16.8a2.6 2.6 0 1 0 3.7 3.7l5.4-5.4a4 4 0 0 0 5.3-5.3l-2.7 2.7-2.7-2.7 2.7-2.7Z"/></svg>;
  }
  if (/purchasing|platform|framework|procurement/i.test(name)) {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden><rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18M10 12v2h4v-2"/></svg>;
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={common} aria-hidden><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>;
}

function SectionShell({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
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

function IncludedCard({ title, quantity, imageUrl, href }: IncludedCardProps) {
  const body = (
    <>
      <div className="relative h-[150px] w-full overflow-hidden bg-white sm:h-[165px] lg:h-[190px]">
        {imageUrl ? <CleaverSourceImage src={imageUrl} alt={title} size={240} className="object-contain object-center transition-transform duration-200 group-hover/card:scale-[1.03]" /> : <div className="absolute inset-0 flex items-center justify-center bg-[#faf8fc] text-xs text-slate-400">Image unavailable</div>}
      </div>
      <h3 className="mt-4 min-h-[52px] w-full pr-2 text-[15px] font-semibold leading-[1.35] text-[#5b24f2] transition group-hover/card:underline md:text-[16px]">{title}</h3>
      <p className="mt-2 text-[14px] leading-5 text-[#5b24f2]">Qty: {quantity || "—"}</p>
    </>
  );

  if (!href) return <div className="group/card block h-full w-full">{body}</div>;
  return <Link href={href} className="group/card block h-full w-full" aria-label={`View ${title} in ITS BIO`}>{body}</Link>;
}

function youtubeEmbedUrl(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/embed/")[1]?.split("/")[0] || "";
      else if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/shorts/")[1]?.split("/")[0] || "";
      else if (url.pathname.startsWith("/live/")) id = url.pathname.split("/live/")[1]?.split("/")[0] || "";
      else id = url.searchParams.get("v") || "";
    }
    return /^[A-Za-z0-9_-]{6,}$/.test(id) ? `https://www.youtube.com/embed/${id}` : "";
  } catch {
    return "";
  }
}

export default function CleaverProductSections({ product }: { product: CleaverProduct }) {
  const sourceProduct = product as SourceAwareCleaverProduct;
  const specifications = (product.specRows || []).filter((row) => row.label && row.value);
  const matrix = product.cleaverSpecificationMatrix;
  const documents = (product.docs || []).filter((document) => document.url);
  const included = (product.cleaverIncludedItems || []).filter((item) => item.title);
  const variations = (product.cleaverVariations || []).filter((item) => item.title);
  const accessories = (product.cleaverAccessories || []).filter((item) => item.title);
  const videos = (product.cleaverVideos || []).filter((item) => item.url);
  const extraSections = (sourceProduct.cleaverExtraSections || []).filter((section) => section.title && section.html);
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

  const normalizedTitle = (value: string) => value.trim().toLowerCase().replace(/[×]/g, "x").replace(/\s+/g, " ");
  const includedCards = included.map((item) => {
    const normalized = normalizedTitle(item.title);
    const accessory = accessories.find((candidate) => normalizedTitle(candidate.title) === normalized);
    const variation = variations.find((candidate) => normalizedTitle(candidate.title) === normalized);
    return {
      title: item.title,
      quantity: item.quantity,
      imageUrl: item.imageUrl || accessory?.imageUrl || variation?.imageUrl,
      href: accessory?.internalHref || variation?.internalHref,
    };
  });

  const fallbackOrder = ["Overview", "Specifications", "What's Included", "Video", "Documents", "All Variations", "Accessories"];
  const rawOrder = (sourceProduct.cleaverSourceSectionOrder || []).filter(Boolean);
  const sectionOrder = rawOrder.length ? rawOrder : [...fallbackOrder, ...extraSections.map((section) => section.title)];
  const seen = new Set<string>();
  const ordered = sectionOrder.filter((title) => {
    const key = sectionKey(title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  function renderSection(title: string, index: number) {
    const key = sectionKey(title);
    const sourceFidelityOrder = rawOrder.length > 0;
    const openOverview = !sourceFidelityOrder && index === 0 && key === "overview";

    if (key === "overview") {
      if (!hasOverview) return null;
      return <SectionShell key={`section-${key}`} title={title || "Overview"} open={openOverview}><HtmlContent html={product.overviewHtml || ""} className="prose prose-slate max-w-[1040px] text-[15px] leading-[1.8] [&_li]:my-1 [&_p]:my-3.5" /></SectionShell>;
    }

    if (key === "specifications") {
      if (!hasSpecs) return null;
      return (
        <SectionShell key={`section-${key}`} title={title || "Specifications"}>
          {matrix?.rows?.length && matrix.headers.length ? (
            <div className="overflow-x-auto border border-[#dedede]">
              <table className="w-full min-w-[760px] border-collapse text-left text-[14px] leading-6">
                <thead><tr className="bg-[#f5f5f5]"><th className="border-r border-[#dedede] px-5 py-3.5 font-semibold text-[#303030]">SKU</th>{matrix.headers.map((header) => <th key={header} className="border-r border-[#dedede] px-5 py-3.5 font-semibold text-[#303030] last:border-r-0">{header}</th>)}</tr></thead>
                <tbody>{matrix.rows.map((row, rowIndex) => <tr key={`${row.label}-${rowIndex}`} className="border-t border-[#dedede]"><th scope="row" className="border-r border-[#dedede] px-5 py-3.5 font-medium text-[#383838]">{row.label}</th>{matrix.headers.map((header, columnIndex) => <td key={`${header}-${row.label}`} className="border-r border-[#dedede] px-5 py-3.5 text-[#4a4a4a] last:border-r-0">{row.values[columnIndex] || "—"}</td>)}</tr>)}</tbody>
              </table>
            </div>
          ) : specifications.length ? (
            <div className="overflow-hidden border border-[#dedede]"><table className="w-full border-collapse text-left text-[14px] leading-6"><tbody>{specifications.map((row, rowIndex) => <tr key={`${row.label}-${rowIndex}`} className="border-b border-[#dedede] last:border-b-0"><th scope="row" className="w-[42%] border-r border-[#dedede] px-5 py-3.5 font-medium text-[#383838] md:px-6">{row.label}</th><td className="px-5 py-3.5 text-[#4a4a4a] md:px-6">{row.value}</td></tr>)}</tbody></table></div>
          ) : <HtmlContent html={product.specsHtml || ""} className="prose prose-slate max-w-none overflow-x-auto text-[14px] [&_table]:w-full [&_td]:border [&_td]:border-[#dedede] [&_td]:p-3.5 [&_th]:border [&_th]:border-[#dedede] [&_th]:bg-[#f5f5f5] [&_th]:p-3.5" />}
        </SectionShell>
      );
    }

    if (key === "included") {
      if (!included.length) return null;
      return <SectionShell key={`section-${key}`} title={title || "What's Included"}><div className="grid w-full max-w-[1040px] grid-cols-2 gap-x-7 gap-y-12 sm:gap-x-8 lg:grid-cols-4 lg:gap-x-9 lg:gap-y-14">{includedCards.map((item, itemIndex) => <IncludedCard key={`${item.title}-${itemIndex}`} {...item} />)}</div></SectionShell>;
    }

    if (key === "video") {
      if (!videos.length) return null;
      return (
        <SectionShell key={`section-${key}`} title={title || "Video"}>
          <div className="grid max-w-[1040px] gap-6 lg:grid-cols-2">
            {videos.map((video, videoIndex) => {
              const embedUrl = video.embedUrl || youtubeEmbedUrl(video.url);
              if (embedUrl) return <div key={`${video.url}-${videoIndex}`}><div className="overflow-hidden bg-black"><iframe src={embedUrl} title={video.title || `${product.title} product video`} className="aspect-video w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>{video.title ? <p className="mt-3 text-[14px] font-medium leading-6 text-[#333]">{video.title}</p> : null}</div>;
              if (/\.(?:mp4|webm)(?:$|\?)/i.test(video.url)) return <video key={`${video.url}-${videoIndex}`} controls preload="metadata" className="aspect-video w-full bg-black"><source src={video.url} /></video>;
              return null;
            })}
          </div>
        </SectionShell>
      );
    }

    if (key === "documents") {
      if (!hasDocuments) return null;
      return (
        <SectionShell key={`section-${key}`} title={title || "Documents"}>
          {documents.length ? <div className="max-w-[1040px] space-y-7">{documentGroups.map((group) => <div key={group.title}><h3 className="mb-2.5 text-[14px] font-semibold text-[#292929]">{group.title}</h3><div className="divide-y divide-[#dedede] border-y border-[#dedede]">{group.items.map((document) => <a key={document.url} href={document.url} target="_blank" rel="noopener noreferrer" className="group/doc flex items-center gap-3.5 py-3.5 text-[14px] transition hover:text-[#61247b]"><span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#f2edf4] text-[9px] font-bold tracking-wide text-[#61247b]">PDF</span><span className="min-w-0 flex-1 font-medium leading-6 text-[#333] group-hover/doc:text-[#61247b]">{document.title || document.label || "Product document"}</span><span aria-hidden className="text-base text-[#777] group-hover/doc:text-[#61247b]">↗</span></a>)}</div></div>)}</div> : <HtmlContent html={product.documentsHtml || ""} className="prose prose-slate max-w-none text-[14px]" />}
        </SectionShell>
      );
    }

    if (key === "variations") {
      if (!variations.length) return null;
      return <SectionShell key={`section-${key}`} title={title || "All Variations"}><div className="overflow-x-auto border border-[#dedede]"><table className="w-full min-w-[680px] border-collapse text-left text-[14px]"><thead className="bg-[#f5f5f5]"><tr><th className="w-24 px-4 py-3.5 font-semibold text-[#303030]">Image</th><th className="px-5 py-3.5 font-semibold text-[#303030]">Variant</th><th className="w-40 px-5 py-3.5 font-semibold text-[#303030]">Pack/Size</th></tr></thead><tbody>{variations.map((item, itemIndex) => <tr key={`${item.sku || item.title}-${itemIndex}`} className="border-t border-[#dedede]"><td className="px-4 py-3">{item.imageUrl ? <div className="relative h-16 w-16 bg-white"><CleaverSourceImage src={item.imageUrl} alt={item.title} size={64} /></div> : null}</td><td className="px-5 py-3.5"><ProductLink href={item.internalHref}>{item.title}</ProductLink></td><td className="px-5 py-3.5 text-[#4a4a4a]">{item.packSize || "—"}</td></tr>)}</tbody></table></div></SectionShell>;
    }

    if (key === "accessories") {
      if (!accessories.length) return null;
      return <SectionShell key={`section-${key}`} title={title || "Accessories"}><div className="overflow-x-auto border border-[#dedede]"><table className="w-full min-w-[680px] border-collapse text-left text-[14px]"><thead className="bg-[#f5f5f5]"><tr><th className="w-24 px-4 py-3.5 font-semibold text-[#303030]">Image</th><th className="px-5 py-3.5 font-semibold text-[#303030]">Accessory</th><th className="w-40 px-5 py-3.5 font-semibold text-[#303030]">Pack/Size</th></tr></thead><tbody>{accessories.map((item, itemIndex) => <tr key={`${item.sourceUrl || item.sku || item.title}-${itemIndex}`} className="border-t border-[#dedede]"><td className="px-4 py-3">{item.imageUrl ? <div className="relative h-16 w-16 bg-white"><CleaverSourceImage src={item.imageUrl} alt={item.title} size={64} /></div> : null}</td><td className="px-5 py-3.5"><ProductLink href={item.internalHref}>{item.title}</ProductLink></td><td className="px-5 py-3.5 text-[#4a4a4a]">{item.packSize || "—"}</td></tr>)}</tbody></table></div></SectionShell>;
    }

    const extra = extraSections.find((section) => sectionKey(section.title) === key);
    if (!extra?.html) return null;
    return <SectionShell key={`section-${key}`} title={title || extra.title}><HtmlContent html={extra.html} className="prose prose-slate max-w-[1040px] text-[15px] leading-[1.8] [&_li]:my-1 [&_p]:my-3.5" /></SectionShell>;
  }

  const rendered = ordered.map(renderSection).filter(Boolean);
  if (!rendered.length) return null;
  return <section className="mt-12 md:mt-16">{rendered}</section>;
}
