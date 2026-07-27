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

const PRICE_COLUMN_RE = /^(?:price|pricing|unit price|list price|retail price|sale price|dealer price|your price|online price|web price|net price|msrp|cost|amount)$/i;

function cleanText(input?: unknown) {
  return String(input || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
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
      cleanText(section.imageUrl) ||
      sectionItems(section).length ||
      (Array.isArray(section.rows) && section.rows.length),
  );
}

function HtmlBlock({ html }: { html?: string }) {
  if (!cleanText(html)) return null;
  return (
    <div
      className="prose prose-slate max-w-none prose-a:font-semibold prose-a:text-[#0755a6] prose-a:no-underline hover:prose-a:underline prose-headings:text-[#0a4d96] prose-h2:text-[29px] prose-h3:text-[22px] prose-p:text-[16px] prose-p:leading-8 prose-li:text-[16px] prose-li:leading-7 prose-img:h-auto prose-img:max-w-full prose-table:w-full prose-table:border-collapse prose-th:border-b prose-th:border-slate-300 prose-th:bg-white prose-th:px-4 prose-th:py-3 prose-th:text-[#0a4d96] prose-td:border-b prose-td:border-slate-200 prose-td:px-4 prose-td:py-3"
      dangerouslySetInnerHTML={{ __html: String(html || "") }}
    />
  );
}

function MediaImage({ src, alt, className = "" }: { src?: string; alt: string; className?: string }) {
  const [visible, setVisible] = React.useState(Boolean(src));
  React.useEffect(() => setVisible(Boolean(src)), [src]);
  if (!visible || !src) return null;
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
    <div className="grid border-y border-slate-200 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item, index) => {
        const title = String(item.title || item.label || item.text || `Feature ${index + 1}`);
        const description = String(item.description || item.value || "");
        return (
          <article
            key={item._key || `${title}-${index}`}
            className="px-5 py-7 text-center sm:border-l sm:border-slate-200 sm:first:border-l-0 lg:min-h-[150px]"
          >
            <span className="mx-auto mb-5 block h-[3px] w-11 bg-[#0b5baa]" aria-hidden />
            <h3 className="text-[16px] font-semibold leading-6 text-[#0a4d96]">{title}</h3>
            {description ? <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p> : null}
          </article>
        );
      })}
    </div>
  );
}

function splitReviewTitle(input: string) {
  const [person, ...rest] = input.split(/\s+[—–-]\s+/);
  return {
    person: person?.trim() || input,
    organization: rest.join(" — ").trim(),
  };
}

function ReviewRail({ items }: { items: KentSectionItem[] }) {
  return (
    <div className="scrollbar-hidden flex snap-x gap-10 overflow-x-auto pb-4">
      {items.map((item, index) => {
        const rawTitle = String(item.title || item.label || item.text || `Review ${index + 1}`);
        const { person, organization } = splitReviewTitle(rawTitle);
        const description = String(item.description || item.value || "");
        return (
          <article
            key={item._key || `${rawTitle}-${index}`}
            className="min-w-[86%] snap-start border-t-4 border-[#0b5baa] pt-6 sm:min-w-[70%] lg:min-w-[47%]"
          >
            {description ? (
              <blockquote className="text-[16px] leading-8 text-slate-700">“{description}”</blockquote>
            ) : null}
            <div className="mt-6 text-[16px] font-semibold text-[#0a4d96]">{person}</div>
            {organization ? <div className="mt-1 text-sm leading-6 text-slate-500">{organization}</div> : null}
          </article>
        );
      })}
    </div>
  );
}

function productSlugFromHref(href?: string) {
  const raw = String(href || "").trim();
  const match = raw.match(/\/products\/kent\/item\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]).toLowerCase() : "";
}

function RelatedProducts({ items }: { items: KentSectionItem[] }) {
  const [resolvedImages, setResolvedImages] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const targets = items
      .map((item, index) => {
        const href = String(item.href || item.url || "");
        const slug = productSlugFromHref(href);
        return slug ? { key: `related:${slug}:${index}`, type: "product", value: slug, slug } : null;
      })
      .filter(Boolean) as Array<{ key: string; type: "product"; value: string; slug: string }>;

    if (!targets.length) return;
    let cancelled = false;

    fetch("/api/kent/product-images", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targets: targets.map(({ key, type, value }) => ({ key, type, value })) }),
    })
      .then((response) => (response.ok ? response.json() : { images: {} }))
      .then((payload) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const target of targets) {
          const images = payload?.images?.[target.key];
          if (Array.isArray(images) && images[0]) next[target.slug] = images[0];
        }
        setResolvedImages(next);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [items]);

  return (
    <div className="grid gap-8 md:grid-cols-3">
      {items.map((item, index) => {
        const href = String(item.href || item.url || "").trim();
        const title = String(item.title || item.label || item.text || `Related product ${index + 1}`);
        const description = String(item.description || item.value || "");
        const slug = productSlugFromHref(href);
        const imageUrl = String(item.imageUrl || resolvedImages[slug] || "");
        const content = (
          <>
            <div className="flex aspect-[4/3] items-center justify-center border border-slate-200 bg-white p-5">
              {imageUrl ? (
                <MediaImage src={imageUrl} alt={title} className="max-h-52" />
              ) : (
                <div className="text-sm text-slate-400">Product image</div>
              )}
            </div>
            <div className="pt-4">
              {description ? <div className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{description}</div> : null}
              <h3 className="text-[17px] font-semibold leading-6 text-[#0a4d96]">{title}</h3>
            </div>
          </>
        );

        return href ? (
          <a key={item._key || `${title}-${index}`} href={href} className="group block">
            {content}
          </a>
        ) : (
          <article key={item._key || `${title}-${index}`}>{content}</article>
        );
      })}
    </div>
  );
}

function ItemList({ items }: { items: KentSectionItem[] }) {
  return (
    <ul className="grid gap-x-10 gap-y-5 md:grid-cols-2">
      {items.map((item, index) => {
        const title = String(item.title || item.label || item.text || item.value || `Item ${index + 1}`);
        const description = String(item.description || "");
        return (
          <li key={item._key || `${title}-${index}`} className="flex gap-4 border-b border-slate-200 pb-5">
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#0b5baa]" aria-hidden />
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
    <div className="border-t border-slate-200">
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
            <span className="shrink-0 border border-[#0b5baa] px-4 py-2 text-xs font-semibold text-[#0b5baa]">
              {isVideo ? "See Video" : "Open"}
            </span>
          </>
        );

        return href ? (
          <a
            key={item._key || `${href}-${index}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-5 border-b border-slate-200 py-5 transition hover:bg-slate-50"
          >
            {row}
          </a>
        ) : (
          <div key={item._key || `${label}-${index}`} className="flex items-center justify-between gap-5 border-b border-slate-200 py-5">
            {row}
          </div>
        );
      })}
    </div>
  );
}

function youtubeId(url?: string) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.hostname === "youtu.be") return parsed.pathname.replace(/^\//, "").split("/")[0];
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2] || "";
      return parsed.searchParams.get("v") || "";
    }
  } catch {
    return "";
  }
  return "";
}

function VideoCards({ items }: { items: KentSectionItem[] }) {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      {items.map((item, index) => {
        const href = String(item.url || item.href || "").trim();
        const label = String(item.label || item.title || `Video ${index + 1}`);
        const id = youtubeId(href);
        return (
          <a
            key={item._key || `${href}-${index}`}
            href={href || undefined}
            target={href ? "_blank" : undefined}
            rel={href ? "noreferrer" : undefined}
            className="group block"
          >
            <div className="relative aspect-video overflow-hidden bg-slate-100">
              {id ? (
                <img
                  src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
                  alt={label}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
              ) : null}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-xl text-[#0b5baa] shadow">▶</span>
              </span>
            </div>
            <h3 className="mt-4 text-[18px] font-semibold leading-6 text-[#0a4d96]">{label}</h3>
          </a>
        );
      })}
    </div>
  );
}

function DataTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  const columns = Array.from(
    new Set(
      rows
        .flatMap((row) => Object.keys(row || {}))
        .filter((key) => !key.startsWith("_") && !PRICE_COLUMN_RE.test(key.trim())),
    ),
  );
  if (!columns.length) return null;
  return (
    <div className="overflow-x-auto border-t-2 border-[#0b5baa]">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b border-slate-300 px-4 py-4 font-semibold text-[#0a4d96]">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row._key || index)} className="border-b border-slate-200 even:bg-slate-50/70">
              {columns.map((column) => (
                <td key={column} className="px-4 py-4 align-top leading-6 text-slate-700">
                  {String(row[column] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductSection({ section, index }: { section: SectionWithKey; index: number }) {
  const bucket = typeBucket(section);
  const title = String(section.title || (bucket === "overview" ? "Product overview" : bucket.replaceAll("-", " ")));
  const html = sectionHtml(section);
  const items = sectionItems(section);
  const rows = Array.isArray(section.rows) ? section.rows : [];
  const media = section.imageUrl ? (
    <MediaImage src={String(section.imageUrl)} alt={String(section.imageAlt || title)} className="max-h-[500px]" />
  ) : null;

  const body = (() => {
    if (bucket === "related-products") return items.length ? <RelatedProducts items={items} /> : <HtmlBlock html={html} />;
    if (bucket === "features") return items.length ? <FeatureGrid items={items} /> : <HtmlBlock html={html} />;
    if (bucket === "reviews") return items.length ? <ReviewRail items={items} /> : <HtmlBlock html={html} />;
    if (bucket === "included" || bucket === "addons") return items.length ? <ItemList items={items} /> : <HtmlBlock html={html} />;
    if (bucket === "videos") {
      return (
        <>
          {items.length ? <VideoCards items={items} /> : null}
          {html ? <div className={items.length ? "mt-8" : ""}><HtmlBlock html={html} /></div> : null}
        </>
      );
    }
    if (["documents", "datasheet", "references"].includes(bucket)) {
      return (
        <>
          {items.length ? <ResourceList items={items} /> : null}
          {html ? <div className={items.length ? "mt-8" : ""}><HtmlBlock html={html} /></div> : null}
        </>
      );
    }
    if (rows.length) {
      return (
        <>
          <DataTable rows={rows} />
          {html ? <div className="mt-8"><HtmlBlock html={html} /></div> : null}
        </>
      );
    }

    const content = (
      <>
        <HtmlBlock html={html} />
        {!html && section.description ? <p className="text-[16px] leading-8 text-slate-700">{String(section.description)}</p> : null}
        {items.length ? <div className={html ? "mt-8" : ""}><ItemList items={items} /></div> : null}
      </>
    );
    if (!media) return content;
    return (
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <div>{content}</div>
        <div>{media}</div>
      </div>
    );
  })();

  const notice = bucket === "notice";
  const hasTopBorder = index > 0;
  return (
    <section
      id={`kent-section-${index}`}
      className={[
        "scroll-mt-24 py-12 md:py-16",
        hasTopBorder ? "border-t border-slate-200" : "",
        notice ? "bg-amber-50 px-6 md:px-8" : "",
      ].join(" ")}
    >
      <h2 className={`mb-7 text-[28px] font-semibold tracking-[-0.02em] md:text-[33px] ${notice ? "text-amber-900" : "text-[#0a4d96]"}`}>
        {title}
      </h2>
      {body}
    </section>
  );
}

function fallbackSections({
  title,
  descriptionHtml,
  specsHtml,
  datasheetHtml,
  documentsHtml,
  faqsHtml,
  referencesHtml,
  reviewsHtml,
  documents,
}: {
  title: string;
  descriptionHtml?: string;
  specsHtml?: string;
  datasheetHtml?: string;
  documentsHtml?: string;
  faqsHtml?: string;
  referencesHtml?: string;
  reviewsHtml?: string;
  documents?: Doc[];
}): SectionWithKey[] {
  const docs: KentSectionItem[] = (documents || []).flatMap((doc) => {
    const url = String(doc?.url || "").trim();
    return url ? [{ url, label: String(doc?.label || doc?.title || url) }] : [];
  });
  return [
    { fallbackKey: "overview", type: "rich-text", title: `About ${title}`, html: descriptionHtml },
    { fallbackKey: "specs", type: "spec-table", title: "Specifications", html: specsHtml },
    { fallbackKey: "datasheet", type: "datasheet", title: "Datasheet", html: datasheetHtml },
    { fallbackKey: "documents", type: "resources", title: "Documents & Resources", html: documentsHtml, items: docs },
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
  documentsHtml,
  faqsHtml,
  referencesHtml,
  reviewsHtml,
  documents,
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
  const explicit = (Array.isArray(sections) ? sections : []).filter(isRenderable) as SectionWithKey[];
  const represented = new Set<SectionBucket>(explicit.map(typeBucket));
  const legacy = fallbackSections({
    title,
    descriptionHtml,
    specsHtml,
    datasheetHtml,
    documentsHtml,
    faqsHtml,
    referencesHtml,
    reviewsHtml,
    documents,
  });
  const merged = [...explicit, ...legacy.filter((section) => !represented.has(section.fallbackKey || typeBucket(section)))];
  if (!merged.length) return null;
  return (
    <div className="mt-6">
      {merged.map((section, index) => (
        <ProductSection key={section._key || `${normalizeType(section)}-${index}`} section={section} index={index} />
      ))}
    </div>
  );
}
