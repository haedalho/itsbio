// app/notice/page.tsx
import Link from "next/link";
import Image from "next/image";
import Breadcrumb from "@/components/site/Breadcrumb";
import NeedAssistance from "@/components/site/NeedAssistance";

import { sanityClient } from "@/lib/sanity/sanity.client";
import { urlFor } from "@/lib/sanity/image";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type SP = { q?: string; page?: string };

const PAGE_SIZE = 10;

const PINNED_QUERY = `
*[_type == "notice"
  && isPinned == true
  && (!defined($q) || $q == "" || title match $q)
]
| order(
    coalesce(order, 0) desc,
    coalesce(publishedAt, _createdAt) desc
  ){
  _id,
  title,
  "slug": slug.current,
  publishedAt,
  _createdAt,
  isPinned,
  order,
  thumbnail
}
`;

const NORMAL_LIST_QUERY = `
*[_type == "notice"
  && (isPinned != true)
  && (!defined($q) || $q == "" || title match $q)
]
| order(coalesce(publishedAt, _createdAt) desc)
[$start...$end]{
  _id,
  title,
  "slug": slug.current,
  publishedAt,
  _createdAt,
  thumbnail
}
`;

const NORMAL_COUNT_QUERY = `
count(*[_type == "notice"
  && (isPinned != true)
  && (!defined($q) || $q == "" || title match $q)
])
`;

const GLOBAL_NORMAL_COUNT_QUERY = `
count(*[_type == "notice" && (isPinned != true)])
`;

function fmtDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function ArrowRight({ className = "" }: { className?: string }) {
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
      <path d="M5 12h12" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function RowMeta({ author, date }: { author: string; date: string }) {
  return (
    <>
      <div className="hidden sm:block w-[190px] text-right text-xs text-slate-500 tabular-nums">
        <span className="text-slate-500">{author}</span>
        {date ? <span className="text-slate-400"> · {date}</span> : null}
      </div>

      <div className="sm:hidden text-xs text-slate-500 tabular-nums">
        <span className="text-slate-500">{author}</span>
        {date ? <span className="text-slate-400"> · {date}</span> : null}
      </div>
    </>
  );
}

/** ✅ 제목 바로 옆에 붙는 hover 썸네일 */
function TitleHoverThumb({ thumb, title }: { thumb: any; title: string }) {
  if (!thumb?.asset) return null;

  const src = urlFor(thumb).width(240).height(240).fit("crop").url();

  return (
    <span
      className={[
        "hidden sm:inline-flex align-middle",
        "ml-2",
        "h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm",
        // default hidden
        "opacity-0 translate-x-1 scale-[0.98]",
        // hover show
        "transition-all duration-200 ease-out",
        "group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100",
      ].join(" ")}
    >
      <span className="relative h-full w-full">
        <Image src={src} alt={title} fill className="object-cover" sizes="28px" />
      </span>
    </span>
  );
}

export default async function NoticePage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};
  const qRaw = (sp.q ?? "").trim();
  const q = qRaw ? `*${qRaw}*` : "";

  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  const [pinnedItems, normalItems, normalTotal, globalNormalTotal] = await Promise.all([
    sanityClient.fetch(PINNED_QUERY, { q }, { cache: "no-store" }),
    sanityClient.fetch(NORMAL_LIST_QUERY, { q, start, end }, { cache: "no-store" }),
    sanityClient.fetch(NORMAL_COUNT_QUERY, { q }, { cache: "no-store" }),
    sanityClient.fetch(GLOBAL_NORMAL_COUNT_QUERY, {}, { cache: "no-store" }),
  ]);

  const totalPages = Math.max(1, Math.ceil(Number(normalTotal) / PAGE_SIZE));
  const baseNo = Number(globalNormalTotal) - (page - 1) * PAGE_SIZE;

  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (qRaw) params.set("q", qRaw);
    params.set("page", String(p));
    return `/notice?${params.toString()}`;
  };

  const authorText = "itsbio";

  const AccentBar = () => (
    <span className="pointer-events-none absolute left-0 top-0 h-full w-[2px] bg-orange-600 -translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
  );

  return (
    <main className="bg-white">
      {/* HERO */}
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

      {/* Breadcrumb */}
      <div className="mx-auto mt-6 flex max-w-6xl justify-end px-4">
        <Breadcrumb />
      </div>

      {/* CONTENT */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pt-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">All notices</div>
            <div className="mt-1 text-sm text-slate-600">
              {qRaw ? (
                <>
                  Results for <span className="font-semibold text-slate-900">“{qRaw}”</span> ·{" "}
                  <span className="font-semibold text-slate-900">
                    {Number(normalTotal) + (pinnedItems as any[]).length}
                  </span>
                </>
              ) : (
                <>
                  Total{" "}
                  <span className="font-semibold text-slate-900">
                    {Number(normalTotal) + (pinnedItems as any[]).length}
                  </span>
                </>
              )}
            </div>
          </div>

          <form className="flex w-full gap-2 sm:w-auto" action="/notice" method="get">
            <input
              name="q"
              defaultValue={qRaw}
              placeholder="Search title..."
              className="h-11 w-full rounded-full border border-slate-200 bg-white px-5 text-sm outline-none focus:border-slate-300 sm:w-[360px]"
            />
            <button className="h-11 shrink-0 rounded-full bg-orange-600 px-6 text-sm font-semibold text-white hover:bg-orange-700 transition">
              Search
            </button>
          </form>
        </div>

        {/* LIST */}
        <div className="mt-8 border-t border-slate-200">
          <ul className="divide-y divide-slate-200">
            {/* 공지 */}
            {(pinnedItems as any[]).map((it) => {
              const dateText = fmtDate(it.publishedAt ?? it._createdAt);
              return (
                <li key={it._id} className="group">
                  <Link href={`/notice/${it.slug}`} className="relative flex items-center gap-5 py-4 pl-3">
                    <AccentBar />

                    <div className="w-20 shrink-0 flex items-center justify-center">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-orange-200 bg-white text-[11px] font-semibold text-orange-700 whitespace-nowrap">
                        공지
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center min-w-0 text-base font-semibold text-slate-900 transition-colors group-hover:text-slate-950">
                        <span className="line-clamp-1">{it.title}</span>
                        <TitleHoverThumb thumb={it.thumbnail} title={it.title} />
                      </span>
                    </div>

                    <RowMeta author={authorText} date={dateText} />
                    <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-orange-500" />
                  </Link>
                </li>
              );
            })}

            {/* 일반 */}
            {(normalItems as any[]).map((it, i) => {
              const no = baseNo - i;
              const noText = String(no).padStart(2, "0");
              const dateText = fmtDate(it.publishedAt ?? it._createdAt);

              return (
                <li key={it._id} className="group">
                  <Link href={`/notice/${it.slug}`} className="relative flex items-center gap-5 py-4 pl-3">
                    <AccentBar />

                    <div className="w-20 shrink-0 flex items-center justify-center">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-orange-200 bg-white text-[11px] font-semibold text-orange-700 tabular-nums whitespace-nowrap">
                        {noText}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center min-w-0 text-base font-semibold text-slate-900 transition-colors group-hover:text-slate-950">
                        <span className="line-clamp-1">{it.title}</span>
                        <TitleHoverThumb thumb={it.thumbnail} title={it.title} />
                      </span>
                    </div>

                    <RowMeta author={authorText} date={dateText} />
                    <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-orange-500" />
                  </Link>
                </li>
              );
            })}

            {(pinnedItems as any[]).length === 0 && (normalItems as any[]).length === 0 ? (
              <li className="py-14 text-center">
                <div className="text-sm font-semibold text-slate-900">No results</div>
                <div className="mt-2 text-sm text-slate-600">다른 검색어로 다시 시도해보세요.</div>
              </li>
            ) : null}
          </ul>
        </div>

        {/* Pagination */}
        <div className="mt-10 flex items-center justify-center gap-2">
          <PageLink disabled={page <= 1} href={makeHref(page - 1)} label="Prev" />
          {Array.from({ length: totalPages }).slice(0, 10).map((_, i) => {
            const p = i + 1;
            const active = p === page;
            return (
              <Link
                key={p}
                href={makeHref(p)}
                className={[
                  "min-w-10 rounded-full border px-4 py-2 text-sm font-semibold transition",
                  active
                    ? "border-orange-200 bg-orange-50 text-orange-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                {p}
              </Link>
            );
          })}
          <PageLink disabled={page >= totalPages} href={makeHref(page + 1)} label="Next" />
        </div>
      </section>

      <NeedAssistance />
    </main>
  );
}

function PageLink({ href, label, disabled }: { href: string; label: string; disabled: boolean }) {
  if (disabled) {
    return (
      <span className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-400">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
    >
      {label}
    </Link>
  );
}
