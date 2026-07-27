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

const PRICE_COLUMN_RE = /^(?:price|unit price|list price|retail price|sale price|msrp|cost|amount)$/i;

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
    const key = String(
      item?._key || item?.url || item?.href || item?.title || item?.label || item?.text || "",
    ).trim();
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
      className="prose prose-slate max-w-none prose-a:text-[#0b4fb3] prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-[#083b85] prose-headings:text-slate-900 prose-h2:text-[28px] prose-h3:text-[22px] prose-p:leading-8 prose-li:leading-7 prose-img:h-auto prose-img:max-w-full prose-table:w-full prose-table:border-collapse prose-th:border prose-th:border-slate-300 prose-th:bg-slate-50 prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-slate-300 prose-td:px-3 prose-td:py-2"
      dangerouslySetInnerHTML={{ __html: String(html || "") }}
    />
  );
}

function MediaImage({ src, alt, className = "" }: { src?: string; alt: string; className?: string }) {
  const [visible, setVisible] = React.useState(Boolean(src));

  React.useEffect(() => {
    setVisible(Boolean(src));
  }, [src]);

  if (!visible || !src) return null;

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`h-auto w-full object-contain ${className}`}
      onError={() => setVisible(false)}
    />
  );
}

function ItemCards({ items, columns = "three" }: { items: KentSectionItem[]; columns?: "two" | "three" }) {
  return (
    <div className={`grid gap-4 md:grid-cols-2 ${columns === "three" ? "xl:grid-cols-3" : ""}`}>
      {items.map((item, index) => {
        const title = String(item.title || item.label || item.text || `Item ${index + 1}`);
        const description = String(item.description || item.value || "");
        return (
          <article
            key={item._key || `${title}-${index}`}
            className="overflow-hidden rounded-[18px] border border-slate-200 bg-slate-50"
          >
            {item.imageUrl ? (
              <div className="border-b border-slate-200 bg-white p-4">
                <MediaImage src={item.imageUrl} alt={title} className="max-h-48" />
              </div>
            ) : null}
            <div className="p-5">
              <div className="text-base font-semibold leading-6 text-slate-900">{title}</div>
              {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
              {item.html ? (
                <div className="mt-3">
                  <HtmlBlock html={item.html} />
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ItemList({ items }: { items: KentSectionItem[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((item, index) => {
        const title = String(item.title || item.label || item.text || item.value || `Item ${index + 1}`);
        const description = String(item.description || "");
        return (
          <li
            key={item._key || `${title}-${index}`}
            className="flex gap-3 rounded-[16px] border border-slate-200 bg-white px-4 py-4"
          >
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#0b4fb3]" aria-hidden />
            <div>
              <div className="font-medium leading-6 text-slate-900">{title}</div>
              {description ? <div className="mt-1 text-sm leading-6 text-slate-600">{description}</div> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function LinkList({ items }: { items: KentSectionItem[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item, index) => {
        const href = String(item.url || item.href || "").trim();
        const label = String(item.label || item.title || item.text || href || `Resource ${index + 1}`);
        const content = (
          <>
            <span className="min-w-0 pr-4 leading-6">{label}</span>
            <span className="shrink-0 font-semibold text-[#0b4fb3]">Open</span>
          </>
        );

        return href ? (
          <a
            key={item._key || `${href}-${index}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-white"
          >
            {content}
          </a>
        ) : (
          <div
            key={item._key || `${label}-${index}`}
            className="flex items-center justify-between rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"
          >
            {content}
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
    <div className="grid gap-5 md:grid-cols-2">
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
            className="group overflow-hidden rounded-[18px] border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            <div className="relative aspect-video overflow-hidden bg-slate-100">
              {id ? (
                <img
                  src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
                  alt={label}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">Video</div>
              )}
              <span className="absolute left-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#0b4fb3] shadow">
                ▶
              </span>
            </div>
            <div className="p-5">
              <div className="font-semibold leading-6 text-slate-900">{label}</div>
              {item.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{String(item.description)}</p> : null}
            </div>
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
    <div className="overflow-x-auto rounded-[16px] border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th key={column} className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row._key || index)} className="border-b border-slate-100 last:border-0">
              {columns.map((column) => (
                <td key={column} className="px-4 py-3 align-top leading-6 text-slate-700">
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
  const title = String(
    section.title || (bucket === "overview" ? "Product overview" : bucket.replaceAll("-", " ")),
  );
  const html = sectionHtml(section);
  const items = sectionItems(section);
  const rows = Array.isArray(section.rows) ? section.rows : [];
  const media = section.imageUrl ? (
    <MediaImage src={String(section.imageUrl)} alt={String(section.imageAlt || title)} className="max-h-[480px] rounded-[16px]" />
  ) : null;

  const body = (() => {
    if (bucket === "features") return items.length ? <ItemCards items={items} /> : <HtmlBlock html={html} />;
    if (bucket === "reviews") return items.length ? <ItemCards items={items} columns="two" /> : <HtmlBlock html={html} />;
    if (bucket === "included" || bucket === "addons") {
      return items.length ? <ItemList items={items} /> : <HtmlBlock html={html} />;
    }
    if (bucket === "videos") {
      return (
        <>
          {items.length ? <VideoCards items={items} /> : null}
          {html ? <div className={items.length ? "mt-6" : ""}><HtmlBlock html={html} /></div> : null}
        </>
      );
    }
    if (["documents", "datasheet", "references"].includes(bucket)) {
      return (
        <>
          {items.length ? <LinkList items={items} /> : null}
          {html ? <div className={items.length ? "mt-6" : ""}><HtmlBlock html={html} /></div> : null}
        </>
      );
    }
    if (rows.length) {
      return (
        <>
          <DataTable rows={rows} />
          {html ? <div className="mt-6"><HtmlBlock html={html} /></div> : null}
        </>
      );
    }

    const content = (
      <>
        <HtmlBlock html={html} />
        {!html && section.description ? (
          <p className="text-[15px] leading-8 text-slate-700">{String(section.description)}</p>
        ) : null}
        {items.length ? <div className={html ? "mt-6" : ""}><ItemList items={items} /></div> : null}
      </>
    );

    if (!media) return content;
    return (
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)]">
        <div>{content}</div>
        <div className="overflow-hidden rounded-[18px] bg-slate-50 p-3">{media}</div>
      </div>
    );
  })();

  return (
    <section
      id={`kent-section-${index}`}
      className={[
        "scroll-mt-24 rounded-[22px] border bg-white p-6 shadow-sm md:p-8",
        bucket === "notice" ? "border-amber-300 bg-amber-50" : "border-slate-200",
      ].join(" ")}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="h-6 w-1 rounded-full bg-[#0b4fb3]" aria-hidden />
        <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[30px]">
          {title}
        </h2>
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
    if (!url) return [];
    return [{ url, label: String(doc?.label || doc?.title || url) }];
  });

  const fallback: SectionWithKey[] = [
    { fallbackKey: "overview", type: "rich-text", title: `About ${title}`, html: descriptionHtml },
    { fallbackKey: "specs", type: "spec-table", title: "Specifications", html: specsHtml },
    { fallbackKey: "datasheet", type: "datasheet", title: "Datasheet", html: datasheetHtml },
    {
      fallbackKey: "documents",
      type: "resources",
      title: "Documents & Resources",
      html: documentsHtml,
      items: docs,
    },
    { fallbackKey: "faqs", type: "faqs", title: "FAQs", html: faqsHtml },
    {
      fallbackKey: "references",
      type: "publications",
      title: "References & Publications",
      html: referencesHtml,
    },
    { fallbackKey: "reviews", type: "reviews", title: "Reviews", html: reviewsHtml },
  ];

  return fallback.filter(isRenderable);
}

export default function KentProductSectionRenderer({
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
  const merged = [
    ...explicit,
    ...legacy.filter((section) => !represented.has(section.fallbackKey || typeBucket(section))),
  ];

  if (!merged.length) return null;

  return (
    <div className="mt-10 space-y-7">
      {merged.map((section, index) => (
        <ProductSection
          key={section._key || `${normalizeType(section)}-${index}`}
          section={section}
          index={index}
        />
      ))}
    </div>
  );
}
