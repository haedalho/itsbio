"use client";

import * as React from "react";

type Doc = { url?: string; label?: string; title?: string };

export type KentSectionItem = {
  _key?: string;
  title?: string;
  label?: string;
  text?: string;
  description?: string;
  html?: string;
  url?: string;
  href?: string;
  imageUrl?: string;
  value?: string;
  [key: string]: unknown;
};

export type KentSection = {
  _key?: string;
  _type?: string;
  type?: string;
  kind?: string;
  title?: string;
  html?: string;
  contentHtml?: string;
  bodyHtml?: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  items?: KentSectionItem[];
  links?: KentSectionItem[];
  documents?: KentSectionItem[];
  videos?: KentSectionItem[];
  rows?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

type SectionBucket =
  | "related-products"
  | "features"
  | "included"
  | "addons"
  | "specs"
  | "documents"
  | "datasheet"
  | "videos"
  | "references"
  | "faqs"
  | "reviews"
  | "warranty"
  | "notice"
  | "overview";

type SectionWithKey = KentSection & { fallbackKey?: SectionBucket };

type FaqEntry = {
  key: string;
  question: string;
  answerHtml?: string;
  answerText?: string;
};

const PRICE_COLUMN_RE = /^(?:price|pricing|unit price|list price|retail price|sale price|dealer price|your price|online price|web price|net price|msrp|cost|amount)$/i;

function isManagedKentImageUrl(input?: unknown) {
  const value = String(input || "").trim();
  if (!value) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "cdn.sanity.io";
  } catch {
    return false;
  }
}

function stripUnmanagedImages(html?: string) {
  return String(html || "").replace(
    /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi,
    (tag, _quote, src) => (isManagedKentImageUrl(src) ? tag : ""),
  );
}

function cleanText(input?: unknown) {
  return String(input || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeType(section: KentSection) {
  return String(section.type || section.kind || section._type || "rich-text")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");
}

function typeBucket(section: KentSection): SectionBucket {
  const type = normalizeType(section);
  if (/related-product|customers-who-viewed|you-may-also/.test(type)) return "related-products";
  if (/feature|benefit|what-you-get/.test(type)) return "features";
  if (/included|base-system|in-the-box|components/.test(type)) return "included";
  if (/optional|add-on|accessor|compatible/.test(type)) return "addons";
  if (/spec|table|technical/.test(type)) return "specs";
  if (/resource|document|download|manual/.test(type)) return "documents";
  if (/datasheet|brochure/.test(type)) return "datasheet";
  if (/video/.test(type)) return "videos";
  if (/publication|reference|article|paper/.test(type)) return "references";
  if (/faq/.test(type)) return "faqs";
  if (/review|testimonial/.test(type)) return "reviews";
  if (/warranty/.test(type)) return "warranty";
  if (/notice|regulated|warning/.test(type)) return "notice";
  return "overview";
}

function sectionHtml(section: KentSection) {
  for (const value of [section.html, section.contentHtml, section.bodyHtml]) {
    if (typeof value === "string" && cleanText(value)) return value;
  }
  return "";
}

function sectionItems(section: KentSection) {
  const combined = [
    ...(Array.isArray(section.items) ? section.items : []),
    ...(Array.isArray(section.links) ? section.links : []),
    ...(Array.isArray(section.documents) ? section.documents : []),
    ...(Array.isArray(section.videos) ? section.videos : []),
  ];

  const seen = new Set<string>();
  return combined.filter((item) => {
    const key = String(item?._key || item?.url || item?.href || item?.title || item?.label || item?.text || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRenderable(section: KentSection) {
  return Boolean(
    cleanText(sectionHtml(section)) ||
      cleanText(section.description) ||
      isManagedKentImageUrl(section.imageUrl) ||
      sectionItems(section).length ||
      (Array.isArray(section.rows) && section.rows.length),
  );
}

function isSyntheticDocumentsSection(section: KentSection) {
  const key = cleanText(section._key).toLowerCase();
  const title = cleanText(section.title).toLowerCase().replace(/\s*&\s*/g, " & ");
  return key === "kent-source-documents" || title === "documents & resources";
}

function HtmlBlock({ html }: { html?: string }) {
  const managedHtml = stripUnmanagedImages(html);
  if (!cleanText(managedHtml)) return null;
  return (
    <div
      className="kent-rich max-w-none"
      dangerouslySetInnerHTML={{ __html: managedHtml }}
    />
  );
}

function orderedFeatureItemsFromHtml(html: string): KentSectionItem[] {
  const entries: KentSectionItem[] = [];
  const tokens = Array.from(html.matchAll(/<(h[2-4]|p)\b[^>]*>([\s\S]*?)<\/\1>/gi));
  for (const token of tokens) {
    const tag = String(token[1] || "").toLowerCase();
    const value = cleanText(token[2]);
    if (!value) continue;
    if (tag === "p" && entries.length && !entries[entries.length - 1]?.description) {
      entries[entries.length - 1].description = value;
    } else {
      entries.push({ title: value });
    }
  }
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${cleanText(entry.title)}|${cleanText(entry.description)}`;
    if (!cleanText(entry.title) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function reviewItemsFromHtml(html: string): KentSectionItem[] {
  const values = Array.from(html.matchAll(/<div\b[^>]*>\s*([^<>]*\S[^<>]*)\s*<\/div>/gi))
    .map((match) => cleanText(match[1]))
    .filter(Boolean);
  const output: KentSectionItem[] = [];
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (!/^[“\"]/.test(value) || index < 2) return;
    const person = values[index - 2];
    const organization = values[index - 1];
    const key = `${person}|${organization}|${value}`;
    if (!person || !organization || seen.has(key)) return;
    seen.add(key);
    output.push({
      _key: `review-html-${output.length}`,
      title: `${person} — ${organization}`,
      description: value,
    });
  });
  return output;
}

function embeddedResourceTitle(html: string) {
  const headings = Array.from(html.matchAll(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/gi));
  return headings.map((match) => cleanText(match[1])).find((title) => /resources?|webinars?|videos?/i.test(title)) || "";
}

function videoItemsFromHtml(html: string): KentSectionItem[] {
  const matches = Array.from(html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi));
  const seen = new Set<string>();
  return matches.flatMap((match, index) => {
    const title = cleanText(match[1]);
    if (!title || seen.has(title)) return [];
    seen.add(title);
    const tail = html.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 180);
    const duration = cleanText(tail.match(/<span\b[^>]*>([\d:]+)<\/span>/i)?.[1]);
    return [{ _key: `video-html-${index}`, title, value: duration }];
  });
}

function linkedItemsFromHtml(html: string): KentSectionItem[] {
  const seen = new Set<string>();
  const output: KentSectionItem[] = [];

  Array.from(html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)).forEach((match, index) => {
    const block = match[1] || "";
    const anchor = block.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
    if (!anchor) return;
    const href = anchor[1]?.match(/\bhref=["']([^"']+)["']/i)?.[1] || "";
    const anchorText = cleanText(anchor[2]);
    const fullText = cleanText(block);
    const title = fullText
      .replace(/^\d+\.\)\s*/, "")
      .replace(new RegExp(`\\s*:?\\s*${anchorText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "")
      .trim() || anchorText;
    const key = `${href}|${title}`;
    if (!href || !title || seen.has(key)) return;
    seen.add(key);
    output.push({ _key: `link-list-html-${index}`, href, title });
  });

  const matches = Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi));
  matches.forEach((match, index) => {
    const attributes = match[1] || "";
    const href = attributes.match(/\bhref=["']([^"']+)["']/i)?.[1] || "";
    const title = cleanText(match[2]);
    if (!href || !title || /^continue reading$/i.test(title)) return;
    const key = `${href}|${title}`;
    if (seen.has(key) || output.some((item) => String(item.href || item.url) === href)) return;
    seen.add(key);
    output.push({ _key: `link-html-${index}`, href, title });
  });
  return output;
}

function isVideoUrl(value?: unknown) {
  return /youtu(?:\.be|be\.com)|vimeo\.com/i.test(String(value || ""));
}

function videoMatchWords(input?: unknown) {
  return cleanText(input)
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !["video", "with", "from", "this", "that", "mouse", "anesthesia", "protocol"].includes(word))
    .map((word) => word.slice(0, 5));
}

function attachVideoUrls(items: KentSectionItem[], candidates: KentSectionItem[]) {
  const unused = new Set(candidates.map((_, index) => index));
  return items.map((item) => {
    if (isVideoUrl(item.url || item.href)) return item;
    const words = new Set(videoMatchWords(item.title || item.label));
    let bestIndex = -1;
    let bestScore = 0;
    candidates.forEach((candidate, index) => {
      if (!unused.has(index)) return;
      const candidateWords = videoMatchWords(candidate.title || candidate.label || candidate.text);
      const score = candidateWords.reduce((total, word) => total + (words.has(word) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    if (bestIndex < 0 || bestScore < 1) return item;
    unused.delete(bestIndex);
    const match = candidates[bestIndex];
    return { ...item, url: String(match.url || match.href || "") };
  });
}

function listItemsFromHtml(html: string): KentSectionItem[] {
  const seen = new Set<string>();
  return Array.from(html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)).flatMap((match, index) => {
    const title = cleanText(match[1]);
    if (!title || seen.has(title)) return [];
    seen.add(title);
    return [{ _key: `list-html-${index}`, title }];
  });
}

function tablesFromHtml(html: string) {
  return Array.from(html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)).map((match) => match[0]);
}

function MediaImage({ src, alt, className = "" }: { src?: string; alt: string; className?: string }) {
  const managed = isManagedKentImageUrl(src);
  const [visible, setVisible] = React.useState(managed);
  React.useEffect(() => setVisible(isManagedKentImageUrl(src)), [src]);
  if (!visible || !src || !managed) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`h-auto w-full object-contain ${className}`}
      onError={() => setVisible(false)}
    />
  );
}

function FeatureGrid({ items }: { items: KentSectionItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => {
        const title = String(item.title || item.label || item.text || "").trim();
        const description = String(item.description || item.value || "");
        return (
          <article
            key={item._key || `${title || description}-${index}`}
            className="group relative min-h-[154px] overflow-hidden rounded-2xl border border-[#dfe8f2] bg-white px-6 py-6 shadow-[0_10px_35px_rgba(15,50,85,0.06)] transition duration-300 hover:-translate-y-0.5 hover:border-[#8fb9e3] hover:shadow-[0_16px_40px_rgba(15,74,140,0.10)]"
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf3fc] text-[16px] font-semibold text-[#0752ad] transition group-hover:bg-[#0752ad] group-hover:text-white" aria-hidden>→</span>
              <span className="text-[11px] font-bold tracking-[0.14em] text-[#9eafbf]">{String(index + 1).padStart(2, "0")}</span>
            </div>
            {title ? <h3 className="text-[19px] font-semibold leading-[1.32] tracking-[-0.018em] text-[#064a96]">{title}</h3> : null}
            {description ? <p className={`${title ? "mt-2" : ""} text-[14.5px] leading-[1.62] text-[#626d76]`}>{description}</p> : null}
          </article>
        );
      })}
    </div>
  );
}

function splitReviewTitle(input: string) {
  const [person, ...rest] = input.split(/\s+[—–-]\s+/);
  return { person: person?.trim() || input, organization: rest.join(" — ").trim() };
}

function useCarouselPageSize() {
  const [pageSize, setPageSize] = React.useState(1);
  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setPageSize(media.matches ? 2 : 1);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return pageSize;
}

function ReviewCarousel({ items }: { items: KentSectionItem[] }) {
  const pageSize = useCarouselPageSize();
  const maxIndex = Math.max(0, items.length - pageSize);
  const [activeIndex, setActiveIndex] = React.useState(0);
  React.useEffect(() => setActiveIndex((current) => Math.min(current, maxIndex)), [maxIndex]);
  const visibleItems = items.slice(activeIndex, activeIndex + pageSize);

  const move = (direction: -1 | 1) => {
    setActiveIndex((current) => {
      if (direction < 0) return current <= 0 ? maxIndex : current - 1;
      return current >= maxIndex ? 0 : current + 1;
    });
  };

  return (
    <div>
      <div className="relative">
        {items.length > pageSize ? (
          <>
            <button type="button" onClick={() => move(-1)} aria-label="Previous testimonial" className="absolute -left-3 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#d7dde3] bg-white text-[25px] text-[#0b4f9c] shadow-sm transition hover:border-[#0b4f9c] hover:bg-[#0b4f9c] hover:text-white">‹</button>
            <button type="button" onClick={() => move(1)} aria-label="Next testimonial" className="absolute -right-3 top-1/2 z-10 flex h-11 w-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#d7dde3] bg-white text-[25px] text-[#0b4f9c] shadow-sm transition hover:border-[#0b4f9c] hover:bg-[#0b4f9c] hover:text-white">›</button>
          </>
        ) : null}
        <div className="grid gap-5 md:grid-cols-2">
      {visibleItems.map((item, offset) => {
        const index = activeIndex + offset;
        const rawTitle = String(item.title || item.label || item.text || `Review ${index + 1}`);
        const { person, organization } = splitReviewTitle(rawTitle);
        const description = String(item.description || item.value || "");
        return (
          <article
            key={item._key || `${rawTitle}-${index}`}
            className="relative min-h-[292px] overflow-hidden rounded-2xl border border-[#e1e8ef] bg-white px-9 py-9 shadow-[0_12px_38px_rgba(18,55,92,0.07)] md:px-11 md:py-10"
          >
            <span className="absolute right-7 top-5 text-[64px] font-serif leading-none text-[#e4eff9]" aria-hidden>“</span>
            <div className="relative text-[17px] font-semibold leading-6 text-[#0752ad]">{person}</div>
            {organization ? <div className="relative mt-1 text-[17px] leading-6 text-[#303942]">{organization}</div> : null}
            {description ? <blockquote className="relative mt-6 text-[15px] leading-[1.7] text-[#66717a]">{description}</blockquote> : null}
          </article>
        );
      })}
        </div>
      </div>
      {items.length > pageSize ? (
        <div className="mt-4 flex justify-center gap-2" aria-label="Testimonial pages">
          {Array.from({ length: maxIndex + 1 }, (_, index) => (
            <button key={`review-dot-${index}`} type="button" onClick={() => setActiveIndex(index)} aria-label={`Show testimonial page ${index + 1}`} aria-current={index === activeIndex ? "true" : undefined} className={`h-2.5 w-2.5 rounded-full transition ${index === activeIndex ? "bg-[#0b4f9c]" : "bg-[#c9cdd1] hover:bg-[#7f8a94]"}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function productSlugFromHref(input?: unknown) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  try {
    const pathname = new URL(raw, "https://www.kentscientific.com").pathname;
    return pathname.match(/\/products\/([^/]+)/i)?.[1] || "";
  } catch {
    return "";
  }
}

function RelatedProductGrid({ items }: { items: KentSectionItem[]; productTitle: string }) {
  const internalItems = items.flatMap((item) => {
    const slug = String(item.slug || productSlugFromHref(item.href || item.url)).trim();
    return slug ? [{ item, slug }] : [];
  });
  return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {internalItems.slice(0, 4).map(({ item, slug }, index) => {
          const title = String(item.title || item.label || item.text || `Related product ${index + 1}`);
          const href = `/products/kent/item/${slug}`;
          return (
            <a key={item._key || `${title}-${index}`} href={href} className="group block min-w-0 overflow-hidden rounded-2xl border border-[#e0e7ee] bg-white shadow-[0_10px_32px_rgba(18,55,92,0.06)] transition duration-300 hover:-translate-y-1 hover:border-[#91b9df] hover:shadow-[0_18px_42px_rgba(18,71,130,0.11)]">
              <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-b from-[#f8fbfe] to-white p-6">
                {isManagedKentImageUrl(item.imageUrl) ? <MediaImage src={String(item.imageUrl || "")} alt={title} className="max-h-full transition duration-300 group-hover:scale-[1.035]" /> : <span className="text-sm font-medium text-[#8b99a6]">Product image</span>}
              </div>
              <div className="border-t border-[#edf1f4] px-5 py-5">
                <h3 className="line-clamp-2 text-[16px] font-semibold leading-6 text-[#0752ad] group-hover:underline">{title}</h3>
                {item.description ? <p className="mt-2 line-clamp-2 text-[14px] leading-5 text-[#69747d]">{String(item.description)}</p> : null}
                <span className="mt-4 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[#6c7f90] transition group-hover:text-[#0752ad]">View product <span aria-hidden>→</span></span>
              </div>
            </a>
          );
        })}
      </div>
  );
}

function ItemList({ items }: { items: KentSectionItem[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {items.map((item, index) => {
        const title = String(item.title || item.label || item.text || item.value || `Item ${index + 1}`);
        const description = String(item.description || "");
        return (
          <li key={item._key || `${title}-${index}`} className="flex gap-4 rounded-xl border border-[#e1e8ef] bg-white px-5 py-5 shadow-[0_8px_28px_rgba(18,55,92,0.04)]">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8f2fb] text-sm font-bold text-[#0b5baa]" aria-hidden>✓</span>
            <div>
              <div className="font-semibold leading-6 text-[#0a4d96]">{title}</div>
              {description ? <div className="mt-1 text-sm leading-6 text-slate-600">{description}</div> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ResourceList({ items }: { items: KentSectionItem[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dde6ee] bg-white shadow-[0_10px_34px_rgba(18,55,92,0.05)]">
      {items.map((item, index) => {
        const href = String(item.url || item.href || "").trim();
        const label = String(item.label || item.title || item.text || href || `Resource ${index + 1}`);
        const isVideo = /youtu(?:\.be|be\.com)|video/i.test(href) || /video|webinar/i.test(label);
        const row = (
          <>
            <div className="flex min-w-0 items-start gap-4">
              <span className="mt-0.5 text-sm font-bold text-[#0b5baa]">{index + 1}.)</span>
              <span className="leading-6 text-slate-700">{label}</span>
            </div>
            <span className="shrink-0 border border-[#0b5baa] px-4 py-2 text-xs font-semibold text-[#0b5baa]">{isVideo ? "See Video" : "Open"}</span>
          </>
        );
        return href ? (
          <a key={item._key || `${href}-${index}`} href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-5 border-b border-slate-200 px-5 py-5 transition last:border-b-0 hover:bg-[#f5f9fd]">{row}</a>
        ) : (
          <div key={item._key || `${label}-${index}`} className="flex items-center justify-between gap-5 border-b border-slate-200 px-5 py-5 last:border-b-0">{row}</div>
        );
      })}
    </div>
  );
}

function videoEmbedUrl(url?: string) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : "";
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.pathname.startsWith("/embed/")
        ? parsed.pathname.split("/")[2]
        : parsed.pathname.startsWith("/shorts/")
          ? parsed.pathname.split("/")[2]
          : parsed.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : "";
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).find((part) => /^\d+$/.test(part));
      return id ? `https://player.vimeo.com/video/${id}` : "";
    }
  } catch {
    return "";
  }
  return "";
}

function VideoPlaylist({ items }: { items: KentSectionItem[] }) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  React.useEffect(() => setActiveIndex(0), [items]);
  const active = items[activeIndex] || items[0];
  const activeUrl = String(active?.url || active?.href || "").trim();
  const embedUrl = videoEmbedUrl(activeUrl);
  const activeTitle = String(active?.title || active?.label || `Video ${activeIndex + 1}`);

  return (
    <div className="grid overflow-hidden rounded-2xl border border-[#d8e2eb] bg-white shadow-[0_18px_48px_rgba(15,48,80,0.12)] lg:grid-cols-[minmax(0,1.55fr)_minmax(290px,0.65fr)]">
      <div className="bg-[#071e35]">
        <div className="relative aspect-video w-full">
          {embedUrl ? (
            <iframe
              key={embedUrl}
              src={embedUrl}
              title={activeTitle}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-white">
              <div>
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-xl text-[#0b5baa]">▶</span>
                <p className="mt-5 text-[17px] font-semibold">{activeTitle}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-col bg-[#f5f6f7]">
        <div className="border-b border-[#d8dee4] px-5 py-4">
          <div className="text-[12px] font-bold uppercase tracking-[0.13em] text-[#0b5baa]">Playlist</div>
          <div className="mt-1 text-sm text-[#666d73]">{items.length} {items.length === 1 ? "Video" : "Videos"}</div>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {items.map((item, index) => {
            const label = String(item.label || item.title || `Video ${index + 1}`);
            const duration = String(item.description || item.value || "").trim();
            const selected = index === activeIndex;
            return (
              <button
                key={item._key || `${label}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`flex w-full items-center gap-4 border-b border-[#dde2e6] px-5 py-4 text-left transition ${selected ? "bg-white" : "hover:bg-white/75"}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs ${selected ? "bg-[#0b5baa] text-white" : "border border-[#b9c3cc] bg-white text-[#0b5baa]"}`}>▶</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[14px] font-semibold leading-5 ${selected ? "text-[#0b4f9c]" : "text-[#3f474e]"}`}>{label}</span>
                  {duration ? <span className="mt-1 block text-xs text-[#7a8187]">{duration}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
        {activeUrl ? <a href={activeUrl} target="_blank" rel="noreferrer" className="mt-auto border-t border-[#d8dee4] px-5 py-3 text-xs font-semibold text-[#0b5baa] hover:underline">Open video in a new window ↗</a> : null}
      </div>
    </div>
  );
}

function SpecificationGrid({ html }: { html: string }) {
  const tables = tablesFromHtml(stripUnmanagedImages(html));
  if (!tables.length) return <HtmlBlock html={html} />;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {tables.map((table, index) => (
        <div key={`spec-table-${index}`} className="kent-rich overflow-x-auto rounded-2xl border border-[#dce5ed] bg-white px-1 shadow-[0_10px_32px_rgba(18,55,92,0.05)]" dangerouslySetInnerHTML={{ __html: table }} />
      ))}
    </div>
  );
}

function faqEntriesFromHtml(html: string): FaqEntry[] {
  if (!cleanText(html)) return [];
  const pattern = /<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/gi;
  const matches = Array.from(html.matchAll(pattern));
  return matches.flatMap((match, index) => {
    const question = cleanText(match[1]);
    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index || html.length : html.length;
    const answerHtml = html.slice(start, end).trim();
    if (!question || !cleanText(answerHtml)) return [];
    return [{ key: `faq-html-${index}`, question, answerHtml }];
  });
}

function faqEntries(items: KentSectionItem[], html: string): FaqEntry[] {
  const fromItems = items.flatMap((item, index) => {
    const question = cleanText(item.title || item.label || item.text);
    const rawHtml = typeof item.html === "string" ? item.html.trim() : "";
    const answerText = cleanText(item.description || item.value);
    if (!question || (!rawHtml && !answerText)) return [];
    return [{ key: String(item._key || `faq-item-${index}`), question, answerHtml: rawHtml || undefined, answerText: rawHtml ? undefined : answerText }];
  });
  return fromItems.length ? fromItems : faqEntriesFromHtml(html);
}

function FaqAccordion({ title, items, html }: { title: string; items: KentSectionItem[]; html: string }) {
  const entries = React.useMemo(() => faqEntries(items, html), [items, html]);
  const [open, setOpen] = React.useState<Set<string>>(() => new Set());

  if (!entries.length) return <HtmlBlock html={html} />;

  const toggle = (key: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.28fr)] lg:gap-16">
      <div className="lg:pt-1">
        <h2 className="text-[34px] font-normal tracking-[-0.025em] text-[#0b49a4] md:text-[40px]">{title}</h2>
      </div>
      <div className="border-t border-[#d7d7d3]">
        {entries.map((entry) => {
          const expanded = open.has(entry.key);
          const panelId = `${entry.key}-panel`;
          return (
            <div key={entry.key} className="border-b border-[#d7d7d3]">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(entry.key)}
                className="flex w-full items-start justify-between gap-6 py-5 text-left text-[15px] font-semibold leading-6 text-[#262626] transition hover:text-[#0b49a4] md:text-[16px]"
              >
                <span>{entry.question}</span>
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className={`mt-1 h-4 w-4 shrink-0 text-[#6f7478] transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                >
                  <path d="m3.5 6 4.5 4 4.5-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
                </svg>
              </button>
              <div id={panelId} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden">
                  <div className="max-w-[760px] pb-6 pr-8 text-[15px] leading-7 text-[#62676b] [&_a]:font-semibold [&_a]:text-[#0b49a4] [&_li]:mb-1 [&_p]:mb-3 [&_p:last-child]:mb-0">
                    {entry.answerHtml ? <div dangerouslySetInnerHTML={{ __html: stripUnmanagedImages(entry.answerHtml) }} /> : <p>{entry.answerText}</p>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DataTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row || {})).filter((key) => !key.startsWith("_") && !PRICE_COLUMN_RE.test(key.trim()))));
  if (!columns.length) return null;
  return (
    <div className="overflow-x-auto border-t-2 border-[#0b5baa]">
      <table className="w-full border-collapse text-left text-sm">
        <thead><tr>{columns.map((column) => <th key={column} className="border-b border-slate-300 px-4 py-4 font-semibold text-[#0a4d96]">{column}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row._key || index)} className="border-b border-slate-200 even:bg-slate-50/70">
              {columns.map((column) => <td key={column} className="px-4 py-4 align-top leading-6 text-slate-700">{String(row[column] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductSection({ section, index, videoCandidates, productTitle }: { section: SectionWithKey; index: number; videoCandidates: KentSectionItem[]; productTitle: string }) {
  const bucket = typeBucket(section);
  const title = String(section.title || (bucket === "overview" ? "Product overview" : bucket.replaceAll("-", " ")));
  const html = sectionHtml(section);
  const items = sectionItems(section);
  const rows = Array.isArray(section.rows) ? section.rows : [];
  const parsedFeatures = bucket === "features" ? orderedFeatureItemsFromHtml(html) : [];
  const parsedReviews = bucket === "reviews" ? reviewItemsFromHtml(html) : [];
  const reviewLinks = bucket === "reviews" ? linkedItemsFromHtml(html) : [];
  const reviewResourceTitle = bucket === "reviews" ? embeddedResourceTitle(html) : "";
  const parsedVideos = bucket === "videos" ? videoItemsFromHtml(html) : [];
  const parsedLinks = ["documents", "datasheet", "references"].includes(bucket) ? linkedItemsFromHtml(html) : [];
  const parsedListItems = bucket === "included" || bucket === "addons" ? listItemsFromHtml(html) : [];
  const media = section.imageUrl ? <MediaImage src={String(section.imageUrl)} alt={String(section.imageAlt || title)} className="max-h-[500px]" /> : null;

  if (bucket === "faqs") {
    return (
      <section id={`kent-section-${index}`} className={`${index > 0 ? "mt-3" : ""} -mx-6 scroll-mt-24 overflow-hidden rounded-3xl bg-[#f4f7fa] md:-mx-10 lg:-mx-12`}>
        <div className="h-2 bg-gradient-to-r from-[#084b94] via-[#0b66b8] to-[#4a9ada]" aria-hidden />
        <div className="px-6 py-12 md:px-10 md:py-16 lg:px-12">
          <FaqAccordion title={title} items={items} html={html} />
        </div>
      </section>
    );
  }

  const body = (() => {
    if (bucket === "related-products") return items.length ? <RelatedProductGrid items={items} productTitle={productTitle} /> : null;
    if (bucket === "features") return (items.length || parsedFeatures.length) ? <FeatureGrid items={items.length ? items : parsedFeatures} /> : <HtmlBlock html={html} />;
    if (bucket === "reviews") {
      const reviews = items.length ? items : parsedReviews;
      if (!reviews.length) return <HtmlBlock html={html} />;
      return (
        <>
          <div className={`grid gap-10 ${reviewLinks.length ? "lg:grid-cols-[minmax(0,1.9fr)_minmax(300px,0.9fr)] lg:gap-16" : ""}`}>
            <ReviewCarousel items={reviews} />
            {reviewLinks.length ? (
              <aside>
                <h3 className="mb-5 text-[28px] font-normal tracking-[-0.02em] text-[#0b4f9c]">{reviewResourceTitle || `${productTitle} resources`}</h3>
                <ResourceList items={reviewLinks} />
              </aside>
            ) : null}
          </div>
        </>
      );
    }
    if (bucket === "included" || bucket === "addons") {
      const listItems = items.length ? items : parsedListItems;
      return listItems.length ? <ItemList items={listItems} /> : <HtmlBlock html={html} />;
    }
    if (bucket === "videos") {
      const videos = items.length ? items : parsedVideos;
      const playableVideos = attachVideoUrls(videos, videoCandidates);
      return playableVideos.length ? <VideoPlaylist items={playableVideos} /> : <HtmlBlock html={html} />;
    }
    if (["documents", "datasheet", "references"].includes(bucket)) {
      const resources = items.length ? items : parsedLinks;
      return resources.length ? <ResourceList items={resources} /> : <HtmlBlock html={html} />;
    }
    if (rows.length) {
      return <><DataTable rows={rows} />{html ? <div className="mt-8"><HtmlBlock html={html} /></div> : null}</>;
    }
    if (bucket === "specs") return <SpecificationGrid html={html} />;

    const content = (
      <>
        <HtmlBlock html={html} />
        {!html && section.description ? <p className="text-[16px] leading-8 text-slate-700">{String(section.description)}</p> : null}
        {items.length ? <div className={html ? "mt-8" : ""}><ItemList items={items} /></div> : null}
      </>
    );
    if (!media) return content;
    return <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]"><div>{content}</div><div>{media}</div></div>;
  })();

  const notice = bucket === "notice";
  return (
    <section
      id={`kent-section-${index}`}
      className={["scroll-mt-24 py-12 md:py-[68px]", index > 0 ? "border-t border-[#e1e7ec]" : "", bucket === "features" ? "-mx-6 bg-[#f5f9fd] px-6 md:-mx-10 md:px-10 lg:-mx-12 lg:px-12" : "", bucket === "videos" ? "-mx-6 bg-[#f3f7fb] px-6 md:-mx-10 md:px-10 lg:-mx-12 lg:px-12" : "", notice ? "-mx-6 bg-[#fff8e8] px-6 md:-mx-10 md:px-10" : ""].join(" ")}
    >
      <div className="mb-9 flex items-start gap-4">
        <span className={`mt-1 h-10 w-1.5 shrink-0 rounded-full ${notice ? "bg-amber-600" : "bg-gradient-to-b from-[#0b66b8] to-[#084b94]"}`} aria-hidden />
        <div>
          <div className={`mb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] ${notice ? "text-amber-700" : "text-[#6c8cab]"}`}>{bucket.replaceAll("-", " ")}</div>
          <h2 className={`text-[29px] font-semibold leading-tight tracking-[-0.03em] md:text-[36px] ${notice ? "text-amber-900" : "text-[#084b94]"}`}>{title}</h2>
        </div>
      </div>
      {body}
    </section>
  );
}

function fallbackSections({
  title,
  descriptionHtml,
  specsHtml,
  datasheetHtml,
  faqsHtml,
  referencesHtml,
  reviewsHtml,
}: {
  title: string;
  descriptionHtml?: string;
  specsHtml?: string;
  datasheetHtml?: string;
  faqsHtml?: string;
  referencesHtml?: string;
  reviewsHtml?: string;
}): SectionWithKey[] {
  return [
    { fallbackKey: "overview", type: "rich-text", title: `About ${title}`, html: descriptionHtml },
    { fallbackKey: "specs", type: "spec-table", title: "Specifications", html: specsHtml },
    { fallbackKey: "datasheet", type: "datasheet", title: "Datasheet", html: datasheetHtml },
    { fallbackKey: "faqs", type: "faqs", title: "FAQs", html: faqsHtml },
    { fallbackKey: "references", type: "publications", title: "References & Publications", html: referencesHtml },
    { fallbackKey: "reviews", type: "reviews", title: "Reviews", html: reviewsHtml },
  ].filter(isRenderable) as SectionWithKey[];
}

export default function KentProductSectionRendererV2({
  title,
  sections,
  descriptionHtml,
  specsHtml,
  datasheetHtml,
  documentsHtml: _documentsHtml,
  faqsHtml,
  referencesHtml,
  reviewsHtml,
  documents: _documents,
}: {
  title: string;
  sections?: KentSection[];
  descriptionHtml?: string;
  specsHtml?: string;
  datasheetHtml?: string;
  documentsHtml?: string;
  faqsHtml?: string;
  referencesHtml?: string;
  reviewsHtml?: string;
  documents?: Doc[];
}) {
  const explicit = (Array.isArray(sections) ? sections : [])
    .filter((section) => !isSyntheticDocumentsSection(section))
    .filter(isRenderable) as SectionWithKey[];
  const represented = new Set<SectionBucket>(explicit.map(typeBucket));
  const legacy = fallbackSections({ title, descriptionHtml, specsHtml, datasheetHtml, faqsHtml, referencesHtml, reviewsHtml });
  const combined = [...explicit, ...legacy.filter((section) => !represented.has(section.fallbackKey || typeBucket(section)))];
  // Kent places recommendations directly below the top product description,
  // before the longer "What you get" and supporting detail sections.
  const merged = [
    ...combined.filter((section) => typeBucket(section) === "related-products"),
    ...combined.filter((section) => typeBucket(section) !== "related-products"),
  ];
  if (!merged.length) return null;
  const videoCandidates = merged
    .flatMap((section) => [...sectionItems(section), ...linkedItemsFromHtml(sectionHtml(section))])
    .filter((item) => isVideoUrl(item.url || item.href));
  return (
    <div className="mt-2">
      {merged.map((section, index) => <ProductSection key={section._key || `${normalizeType(section)}-${index}`} section={section} index={index} videoCandidates={videoCandidates} productTitle={title} />)}
    </div>
  );
}
