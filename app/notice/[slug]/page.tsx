// app/notice/[slug]/page.tsx
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/site/Breadcrumb";
import PageHero from "@/components/site/PageHero";
import LegacyNoticeHtml from "@/components/site/LegacyNoticeHtml";

import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";
import { urlFor } from "@/lib/sanity/image";

import { PortableText } from "@portabletext/react";

export const revalidate = 300;

const DETAIL_QUERY = `
*[_type == "notice" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  publishedAt,
  _createdAt,

  thumbnail{
    ...,
    asset->{
      _id,
      url,
      originalFilename,
      mimeType,
      metadata{ dimensions }
    }
  },

  attachments[]{
    _key,
    _type,
    ...,
    asset->{
      _id,
      url,
      originalFilename,
      mimeType,
      size
    }
  },

  body,
  legacyHtml
}
`;

const PREV_QUERY = `
*[_type == "notice" && slug.current != $slug && coalesce(publishedAt, _createdAt) < $dt]
| order(coalesce(publishedAt, _createdAt) desc)[0]{
  "slug": slug.current
}
`;

const NEXT_QUERY = `
*[_type == "notice" && slug.current != $slug && coalesce(publishedAt, _createdAt) > $dt]
| order(coalesce(publishedAt, _createdAt) asc)[0]{
  "slug": slug.current
}
`;

function fmtDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

const NOTICE_PORTABLE_COMPONENTS: any = {
  types: {
    image: ({ value }: { value: any }) => {
      if (!value?.asset) return null;
      const src = urlFor(value).width(2000).fit("max").auto("format").url();
      return (
        <figure className="my-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <img src={src} alt={value?.alt || ""} className="h-auto w-full object-contain" loading="lazy" />
        </figure>
      );
    },
  },
};

function PaperclipIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21.44 11.05l-8.49 8.49a5 5 0 01-7.07-7.07l9.19-9.19a3.5 3.5 0 014.95 4.95l-9.19 9.19a2 2 0 01-2.83-2.83l8.49-8.49" />
    </svg>
  );
}

function FileTypePill({ mime, name }: { mime?: string; name?: string }) {
  const lower = (name ?? "").toLowerCase();
  const isPdf = mime === "application/pdf" || lower.endsWith(".pdf");
  const isImage = (mime ?? "").startsWith("image/") || /\.(png|jpg|jpeg|webp|gif)$/i.test(lower);
  const label = isPdf ? "PDF" : isImage ? "IMG" : "FILE";

  return (
    <span className="inline-flex h-6 items-center justify-center rounded-full bg-orange-50 px-2 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-100">
      {label}
    </span>
  );
}

function DoubleChevron({ dir, className = "" }: { dir: "left" | "right"; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === "left" ? (
        <>
          <path d="M14 7l-5 5 5 5" />
          <path d="M19 7l-5 5 5 5" />
        </>
      ) : (
        <>
          <path d="M10 7l5 5-5 5" />
          <path d="M5 7l5 5-5 5" />
        </>
      )}
    </svg>
  );
}

function PillNavButton({
  href,
  label,
  dir,
}: {
  href?: string;
  label: "PREV" | "NEXT";
  dir: "prev" | "next";
}) {
  const disabled = !href;
  const wrap = "inline-flex items-center gap-3 rounded-full px-5 py-3 text-sm font-extrabold tracking-wide shadow-sm transition";
  const iconCircle = "grid h-10 w-10 place-items-center rounded-full bg-white/95 ring-1 ring-white/60";

  if (disabled) {
    return (
      <span className={[wrap, "cursor-not-allowed select-none bg-orange-100 text-orange-300 shadow-none"].join(" ")}>
        {dir === "prev" ? (
          <span className={iconCircle}><DoubleChevron dir="left" className="h-5 w-5 text-orange-200" /></span>
        ) : null}
        <span>{label}</span>
        {dir === "next" ? (
          <span className={iconCircle}><DoubleChevron dir="right" className="h-5 w-5 text-orange-200" /></span>
        ) : null}
      </span>
    );
  }

  return (
    <Link href={href!} className={[wrap, "bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700"].join(" ")}>
      {dir === "prev" ? (
        <span className={iconCircle}><DoubleChevron dir="left" className="h-5 w-5 text-orange-600" /></span>
      ) : null}
      <span>{label}</span>
      {dir === "next" ? (
        <span className={iconCircle}><DoubleChevron dir="right" className="h-5 w-5 text-orange-600" /></span>
      ) : null}
    </Link>
  );
}

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const p = await params;
  const slug = p?.slug;
  if (!slug) return notFound();

  const doc = await sanityCdnClient.fetch(DETAIL_QUERY, { slug }, PUBLIC_CATALOG_CACHE);
  if (!doc) return notFound();

  const dateIso = (doc.publishedAt ?? doc._createdAt) as string | undefined;
  const dateText = fmtDate(dateIso);
  const authorText = "itsbio";
  const attachments: any[] = Array.isArray(doc.attachments) ? doc.attachments : [];
  const legacyHtml = typeof doc.legacyHtml === "string" ? doc.legacyHtml.trim() : "";
  const hasLegacyHtml = String(doc._id || "").startsWith("legacy-notice-") && legacyHtml.length > 0;

  const thumbDims = doc.thumbnail?.asset?.metadata?.dimensions;
  const thumbW = Math.max(1, Number(thumbDims?.width ?? 1600));
  const thumbH = Math.max(1, Number(thumbDims?.height ?? 900));
  const thumbUrl = doc.thumbnail?.asset
    ? urlFor(doc.thumbnail).ignoreImageParams().fit("max").width(2400).url()
    : null;

  const [prevDoc, nextDoc] = await Promise.all([
    dateIso ? sanityCdnClient.fetch(PREV_QUERY, { slug, dt: dateIso }, PUBLIC_CATALOG_CACHE) : null,
    dateIso ? sanityCdnClient.fetch(NEXT_QUERY, { slug, dt: dateIso }, PUBLIC_CATALOG_CACHE) : null,
  ]);

  return (
    <main className="bg-white">
      <PageHero
        eyebrow="NOTICE"
        title="News & announcements"
        description="Important company announcements, product updates, service information, and notices from ITS BIO."
        variant="notice"
        cta={{ label: "Back to notice", href: "/notice" }}
      />

      <div className="mx-auto mt-6 flex max-w-6xl justify-end px-4">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Notice", href: "/notice" }, { label: doc.title }]} />
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pt-12">
        <header className="max-w-4xl">
          <div className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-orange-700">Announcement</div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 md:text-4xl md:leading-tight">{doc.title}</h1>

          <div className="mt-4 text-sm text-slate-500">
            <span className="font-medium text-slate-700">{authorText}</span>
            {dateText ? <span className="text-slate-400"> · {dateText}</span> : null}
          </div>

          {attachments.length > 0 ? (
            <section className="mt-7 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <PaperclipIcon className="h-4 w-4 text-orange-600" />
                첨부파일
                <span className="text-xs font-semibold text-slate-500">({attachments.length})</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {attachments.map((att, idx) => {
                  const url = att?.asset?.url as string | undefined;
                  const name = (att?.asset?.originalFilename as string | undefined) ?? `attachment-${idx + 1}`;
                  const mime = att?.asset?.mimeType as string | undefined;
                  if (!url) return null;

                  return (
                    <a
                      key={att?._key ?? `${doc._id}-att-${idx}`}
                      href={url}
                      download
                      className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-orange-200 hover:bg-orange-50/40"
                      title="클릭하면 다운로드됩니다."
                    >
                      <FileTypePill mime={mime} name={name} />
                      <span className="max-w-[360px] truncate">{name}</span>
                    </a>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="mt-7 h-px w-full bg-gradient-to-r from-orange-500/80 via-orange-200/60 to-transparent" />
        </header>

        {thumbUrl && !hasLegacyHtml ? (
          <div className="mt-8 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,.06)]">
            <Image
              src={thumbUrl}
              alt={doc.title}
              width={thumbW}
              height={thumbH}
              priority
              className="h-auto w-full"
              sizes="(max-width: 768px) 100vw, 1152px"
            />
          </div>
        ) : null}

        {hasLegacyHtml ? (
          <LegacyNoticeHtml html={legacyHtml} />
        ) : Array.isArray(doc.body) && doc.body.length > 0 ? (
          <article className="prose prose-slate mt-10 max-w-none prose-headings:text-[#071d43] prose-a:text-orange-700">
            <PortableText value={doc.body} components={NOTICE_PORTABLE_COMPONENTS} />
          </article>
        ) : null}

        <section className="mt-14 flex items-center justify-between gap-4 border-t border-slate-200 pt-8">
          <PillNavButton href={prevDoc?.slug ? `/notice/${prevDoc.slug}` : undefined} label="PREV" dir="prev" />
          <Link href="/notice" className="hidden rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-700 sm:inline-flex">Notice list</Link>
          <PillNavButton href={nextDoc?.slug ? `/notice/${nextDoc.slug}` : undefined} label="NEXT" dir="next" />
        </section>
      </section>
    </main>
  );
}
