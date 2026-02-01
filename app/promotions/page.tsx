// app/promotions/page.tsx
import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "@/components/site/Breadcrumb";
import NeedAssistance from "@/components/site/NeedAssistance";

import { sanityClient } from "@/lib/sanity/sanity.client";
import { urlFor } from "@/lib/sanity/image";

type PromotionDoc = {
  _id: string;
  title: string;
  summary?: string;
  publishedAt?: string;
  order?: number;

  ctaLabel?: string;

  // ✅ cover는 image 또는 gallery[0]
  cover?: any;

  dateText?: string;
  startDate?: string;
  endDate?: string;

  slug?: string;
};

type SP = { q?: string; page?: string };

const PAGE_SIZE = 9;

function formatDot(dateIso?: string) {
  if (!dateIso) return "";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function promotionDateLabel(p: PromotionDoc) {
  if (p.dateText && p.dateText.trim().length) return p.dateText;

  if (p.startDate || p.endDate) {
    const a = formatDot(p.startDate);
    const b = formatDot(p.endDate);
    if (a && b) return `${a} ~ ${b}`;
    if (a && !b) return `${a} ~`;
    if (!a && b) return `~ ${b}`;
  }

  const pub = formatDot(p.publishedAt);
  return pub || "Ongoing";
}

function escapeForGROQ(input: string) {
  return input.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function clampInt(value: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return Math.min(max, Math.max(min, i));
}

// ✅ page=1이면 page 파라미터 제거
function buildHref(basePath: string, q: string, page: number) {
  const sp = new URLSearchParams();
  const qq = q.trim();
  if (qq) sp.set("q", qq);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function getPageWindow(current: number, total: number) {
  const windowSize = 7;
  const half = Math.floor(windowSize / 2);

  let start = Math.max(1, current - half);
  let end = Math.min(total, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  const showFirst = start > 1;
  const showLast = end < total;
  const showLeftEllipsis = start > 2;
  const showRightEllipsis = end < total - 1;

  return { pages, showFirst, showLast, showLeftEllipsis, showRightEllipsis };
}

export default async function PromotionsPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};

  const qRaw = (sp.q ?? "").trim();
  const qSafe = qRaw ? escapeForGROQ(qRaw) : "";
  const pageParam = clampInt(sp.page, 1, 1, 999);

  const filter = qSafe ? `&& (title match "*${qSafe}*")` : "";

  // ✅ isActive 없어도 기본 노출(true)로 처리
  const TOTAL_QUERY = `count(*[_type=="promotion" && coalesce(isActive,true)==true ${filter}])`;
  const total = await sanityClient.fetch<number>(TOTAL_QUERY, {}, { cache: "no-store" });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const currentPage = Math.min(pageParam, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  const PROMOTIONS_QUERY = `
    *[_type=="promotion" && coalesce(isActive,true)==true ${filter}]
      | order(defined(order) desc, order desc, publishedAt desc, _createdAt desc)
      [${start}...${end}]{
        _id,
        title,
        summary,
        publishedAt,
        order,
        ctaLabel,
        dateText,
        startDate,
        endDate,
        "slug": slug.current,

        // ✅ 대표 이미지(image) 있으면 그걸, 없으면 gallery[0]
        "cover": coalesce(image, gallery[0])
      }
  `;
  const promotions = await sanityClient.fetch<PromotionDoc[]>(
    PROMOTIONS_QUERY,
    {},
    { cache: "no-store" }
  );

  const showingFrom = total === 0 ? 0 : start + 1;
  const showingTo = Math.min(start + promotions.length, total);

  const { pages, showFirst, showLast, showLeftEllipsis, showRightEllipsis } =
    getPageWindow(currentPage, totalPages);

  return (
    <div>
      {/* Banner */}
      <section className="relative">
        <div className="relative h-[220px] w-full overflow-hidden md:h-[280px]">
          <Image src="/hero-e.png" alt="Promotions" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-transparent to-transparent" />
          <div className="absolute inset-0">
            <div className="mx-auto flex h-full max-w-6xl items-center px-6">
              <div>
                <div className="text-xs font-semibold tracking-wide text-white/80">ITS BIO</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Promotions
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80 md:text-base">
                  Latest offers, events, and announcements from ITS BIO.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Breadcrumb */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="mt-6 flex justify-end">
          <Breadcrumb />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        {/* 상단 결과 + 검색 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mt-3 text-sm text-slate-700">
              {qRaw ? (
                <>
                  <span className="font-semibold">"{qRaw}"</span> ·{" "}
                  <span className="font-semibold">{total}</span>개 중{" "}
                  <span className="font-semibold">
                    {showingFrom}–{showingTo}
                  </span>
                  개
                </>
              ) : (
                <>
                  전체 <span className="font-semibold">{total}</span>개 중{" "}
                  <span className="font-semibold">
                    {showingFrom}–{showingTo}
                  </span>
                  개
                </>
              )}
            </div>
          </div>

          <form action="/promotions" method="GET" className="flex w-full gap-2 sm:w-auto">
            <input
              name="q"
              defaultValue={qRaw}
              placeholder="Search title..."
              className="h-12 w-full min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-5 text-base text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 sm:w-[320px]"
            />
            <button
              type="submit"
              className="h-12 shrink-0 rounded-2xl bg-orange-600 px-6 text-base font-semibold text-white shadow-sm transition hover:bg-orange-700"
            >
              Search
            </button>

            {qRaw ? (
              <Link
                href="/promotions"
                className="h-12 shrink-0 rounded-2xl border border-slate-200 bg-white px-6 text-base font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 inline-flex items-center justify-center"
              >
                Clear
              </Link>
            ) : null}
          </form>
        </div>

        {/* Grid */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {promotions.map((p) => {
            const href = p.slug ? `/promotions/${p.slug}` : "/promotions";

            const dateLabel = promotionDateLabel(p);

            // ✅ cover(image or gallery[0])로 썸네일 생성
            const imgUrl = p.cover
              ? urlFor(p.cover).width(1200).height(750).fit("crop").auto("format").url()
              : "";

            return (
              <Link
                key={p._id}
                href={href}
                className={[
                  "group overflow-hidden rounded-3xl border border-slate-200 bg-white",
                  "shadow-[0_10px_26px_rgba(15,23,42,0.08)]",
                  "transition-all duration-300",
                  "hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(15,23,42,0.14)]",
                  "transform-gpu",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2",
                ].join(" ")}
              >
                <div className="relative aspect-[16/10] bg-slate-100 -mb-px">
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-100" />
                  )}

                  <div
                    className={[
                      "absolute inset-0 transition-opacity duration-300",
                      "bg-gradient-to-t from-slate-950/45 via-slate-950/10 to-transparent",
                      "group-hover:from-slate-950/30 group-hover:via-slate-950/0",
                    ].join(" ")}
                  />

                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-lg font-semibold text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.18)]">
                      {p.title}
                    </div>
                    {p.summary ? (
                      <div className="mt-1 line-clamp-2 text-sm text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.14)]">
                        {p.summary}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="text-xs font-medium text-slate-500">{dateLabel}</div>
                  <div className="text-sm font-semibold text-orange-700">
                    {p.ctaLabel ? p.ctaLabel : "View →"}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 ? (
          <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Pagination">
            <Link
              href={buildHref("/promotions", qRaw, Math.max(1, currentPage - 1))}
              aria-disabled={currentPage === 1}
              className={[
                "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold",
                currentPage === 1
                  ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              이전
            </Link>

            {showFirst ? (
              <Link
                href={buildHref("/promotions", qRaw, 1)}
                className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                1
              </Link>
            ) : null}

            {showLeftEllipsis ? <span className="px-2 text-slate-400">…</span> : null}

            {pages.map((pg) => (
              <Link
                key={pg}
                href={buildHref("/promotions", qRaw, pg)}
                aria-current={pg === currentPage ? "page" : undefined}
                className={[
                  "inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold",
                  pg === currentPage
                    ? "border-orange-200 bg-orange-50 text-orange-800"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                {pg}
              </Link>
            ))}

            {showRightEllipsis ? <span className="px-2 text-slate-400">…</span> : null}

            {showLast ? (
              <Link
                href={buildHref("/promotions", qRaw, totalPages)}
                className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {totalPages}
              </Link>
            ) : null}

            <Link
              href={buildHref("/promotions", qRaw, Math.min(totalPages, currentPage + 1))}
              aria-disabled={currentPage === totalPages}
              className={[
                "inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold",
                currentPage === totalPages
                  ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              다음
            </Link>
          </nav>
        ) : null}

        <div className="mt-12">
          
        </div>
      </main>
    </div>
  );
}
