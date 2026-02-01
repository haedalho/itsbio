// app/notice/[slug]/page.tsx
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import NeedAssistance from "@/components/site/NeedAssistance";
import Breadcrumb from "@/components/site/Breadcrumb";

import { sanityClient } from "@/lib/sanity/sanity.client";
import { urlFor } from "@/lib/sanity/image";

import { PortableText } from "@portabletext/react";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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

  body
}
`;

// ✅ 최신 기준(목록이 최신이 위):
// - 이전 = 더 과거(<dt) 중 가장 가까운 글
// - 다음 = 더 미래(>dt) 중 가장 가까운 글
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

/** ✅ 알약 버튼 아이콘 (<< / >> 느낌) */
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

/** ✅ 하단 네비: 이미지처럼 “알약 + 원형 아이콘” (오렌지계열) */
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

  // 공통(크기/비율)
  const wrap =
    "inline-flex items-center gap-3 rounded-full px-5 py-3 text-sm font-extrabold tracking-wide shadow-sm transition";
  const iconCircle =
    "grid h-10 w-10 place-items-center rounded-full bg-white/95 ring-1 ring-white/60";

  if (disabled) {
    return (
      <span
        className={[
          wrap,
          "bg-orange-100 text-orange-300 shadow-none",
          "cursor-not-allowed select-none",
        ].join(" ")}
      >
        {dir === "prev" ? (
          <span className={iconCircle}>
            <DoubleChevron dir="left" className="h-5 w-5 text-orange-200" />
          </span>
        ) : null}

        <span>{label}</span>

        {dir === "next" ? (
          <span className={iconCircle}>
            <DoubleChevron dir="right" className="h-5 w-5 text-orange-200" />
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <Link
      href={href!}
      className={[
        wrap,
        "bg-orange-500 text-white",
        "hover:bg-orange-600 active:bg-orange-700",
      ].join(" ")}
    >
      {dir === "prev" ? (
        <span className={iconCircle}>
          <DoubleChevron dir="left" className="h-5 w-5 text-orange-600" />
        </span>
      ) : null}

      <span>{label}</span>

      {dir === "next" ? (
        <span className={iconCircle}>
          <DoubleChevron dir="right" className="h-5 w-5 text-orange-600" />
        </span>
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

  const doc = await sanityClient.fetch(DETAIL_QUERY, { slug }, { cache: "no-store" });
  if (!doc) return notFound();

  const dateIso = (doc.publishedAt ?? doc._createdAt) as string | undefined;
  const dateText = fmtDate(dateIso);
  const authorText = "itsbio";

  const attachments: any[] = Array.isArray(doc.attachments) ? doc.attachments : [];

  // 대표 썸네일
  const thumbDims = doc.thumbnail?.asset?.metadata?.dimensions;
  const thumbW = Math.max(1, Number(thumbDims?.width ?? 1600));
  const thumbH = Math.max(1, Number(thumbDims?.height ?? 900));
  const thumbUrl =
    doc.thumbnail?.asset
      ? urlFor(doc.thumbnail).ignoreImageParams().fit("max").width(2400).url()
      : null;

  // prev/next
  const [prevDoc, nextDoc] = await Promise.all([
    dateIso ? sanityClient.fetch(PREV_QUERY, { slug, dt: dateIso }, { cache: "no-store" }) : null,
    dateIso ? sanityClient.fetch(NEXT_QUERY, { slug, dt: dateIso }, { cache: "no-store" }) : null,
  ]);

  return (
    <main className="bg-white">
      {/* HERO: Notice 메인과 동일 */}
      <section className="relative">
        <div className="relative h-[220px] w-full overflow-hidden md:h-[280px]">
          <Image src="/about-hero.png" alt="Notice" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-transparent to-transparent" />
          <div className="absolute inset-0">
            <div className="mx-auto flex h-full max-w-6xl items-center px-6">
              <div>
                <div className="text-xs font-semibold tracking-wide text-white/80">ITS BIO</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Notice
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80 md:text-base">
                  Important announcements and updates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Breadcrumb: 메인과 동일 컴포넌트 + Home/Notice까지만 */}
      <div className="mx-auto mt-6 flex max-w-6xl justify-end px-4">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Notice" }]} />
      </div>

      {/* CONTENT */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pt-12">
        <header className="max-w-4xl">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-3xl">
            {doc.title}
          </h1>

          <div className="mt-3 text-sm text-slate-500">
            <span className="font-medium text-slate-700">{authorText}</span>
            {dateText ? <span className="text-slate-400"> · {dateText}</span> : null}
          </div>

          {/* 첨부파일 */}
          {attachments.length > 0 ? (
            <section className="mt-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <PaperclipIcon className="h-4 w-4 text-orange-600" />
                첨부파일
                <span className="text-xs font-semibold text-slate-500">({attachments.length})</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {attachments.map((att, idx) => {
                  const url = att?.asset?.url as string | undefined;
                  const name =
                    (att?.asset?.originalFilename as string | undefined) ??
                    `attachment-${idx + 1}`;
                  const mime = att?.asset?.mimeType as string | undefined;
                  if (!url) return null;

                  return (
                    <a
                      key={att?._key ?? `${doc._id}-att-${idx}`}
                      href={url}
                      download
                      className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
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

          {/* 오렌지 구분선 */}
          <div className="mt-6 h-px w-full bg-gradient-to-r from-orange-500/70 via-orange-200/50 to-transparent" />
        </header>

        {/* 대표 이미지(썸네일) */}
        {thumbUrl ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <Image
              src={thumbUrl}
              alt={doc.title}
              width={thumbW}
              height={thumbH}
              priority
              className="w-full h-auto"
              sizes="(max-width: 768px) 100vw, 1152px"
            />
          </div>
        ) : null}

        {/* 본문 */}
        {Array.isArray(doc.body) && doc.body.length > 0 ? (
          <article className="prose prose-slate mt-10 max-w-none">
            <PortableText value={doc.body} />
          </article>
        ) : null}

        {/* ✅ 하단 네비: 알약 버튼(오렌지 계열) */}
        <section className="mt-14 flex items-center justify-between gap-4">
          <PillNavButton
            href={prevDoc?.slug ? `/notice/${prevDoc.slug}` : undefined}
            label="PREV"
            dir="prev"
          />
          <PillNavButton
            href={nextDoc?.slug ? `/notice/${nextDoc.slug}` : undefined}
            label="NEXT"
            dir="next"
          />
        </section>
      </section>
      
    </main>
  );
}
