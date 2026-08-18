import Link from "next/link";
import Image from "next/image";
import Breadcrumb from "@/components/site/Breadcrumb";
import PageHero from "@/components/site/PageHero";
import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";
import { urlFor } from "@/lib/sanity/image";

export const revalidate = 300;

type SP = { q?: string; page?: string };
const PAGE_SIZE = 10;

const PINNED_QUERY = `
*[_type == "notice" && isPinned == true && (!defined($q) || $q == "" || title match $q)]
| order(coalesce(order, 0) desc, coalesce(publishedAt, _createdAt) desc){
  _id, title, "slug": slug.current, publishedAt, _createdAt, isPinned, order, thumbnail
}`;

const NORMAL_LIST_QUERY = `
*[_type == "notice" && (isPinned != true) && (!defined($q) || $q == "" || title match $q)]
| order(coalesce(publishedAt, _createdAt) desc)
[$start...$end]{ _id, title, "slug": slug.current, publishedAt, _createdAt, thumbnail }`;

const NORMAL_COUNT_QUERY = `count(*[_type == "notice" && (isPinned != true) && (!defined($q) || $q == "" || title match $q)])`;
const GLOBAL_NORMAL_COUNT_QUERY = `count(*[_type == "notice" && (isPinned != true)])`;

function fmtDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function ArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h12" /><path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function RowMeta({ author, date }: { author: string; date: string }) {
  return (
    <>
      <div className="hidden w-[190px] text-right text-xs tabular-nums text-slate-500 sm:block"><span>{author}</span>{date ? <span className="text-slate-400"> · {date}</span> : null}</div>
      <div className="text-xs tabular-nums text-slate-500 sm:hidden"><span>{author}</span>{date ? <span className="text-slate-400"> · {date}</span> : null}</div>
    </>
  );
}

function TitleHoverThumb({ thumb, title }: { thumb: any; title: string }) {
  if (!thumb?.asset) return null;
  const src = urlFor(thumb).width(240).height(240).fit("crop").url();
  return (
    <span className="ml-2 hidden h-10 w-10 translate-x-1 scale-[0.98] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 align-middle opacity-0 shadow-sm transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100 sm:inline-flex">
      <span className="relative h-full w-full"><Image src={src} alt={title} fill className="object-cover" sizes="40px" /></span>
    </span>
  );
}

function PageLink({ href, label, disabled }: { href: string; label: string; disabled: boolean }) {
  if (disabled) return <span className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-400">{label}</span>;
  return <Link href={href} className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{label}</Link>;
}

export default async function NoticePage({ searchParams }: { searchParams?: Promise<SP> }) {
  const sp = (await searchParams) ?? {};
  const qRaw = (sp.q ?? "").trim();
  const q = qRaw ? `*${qRaw}*` : "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  const [pinnedItems, normalItems, normalTotal, globalNormalTotal] = await Promise.all([
    sanityCdnClient.fetch(PINNED_QUERY, { q }, PUBLIC_CATALOG_CACHE),
    sanityCdnClient.fetch(NORMAL_LIST_QUERY, { q, start, end }, PUBLIC_CATALOG_CACHE),
    sanityCdnClient.fetch(NORMAL_COUNT_QUERY, { q }, PUBLIC_CATALOG_CACHE),
    sanityCdnClient.fetch(GLOBAL_NORMAL_COUNT_QUERY, {}, PUBLIC_CATALOG_CACHE),
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
  const AccentBar = () => <span className="pointer-events-none absolute left-0 top-0 h-full w-[2px] -translate-x-2 bg-orange-600 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />;

  return (
    <main className="bg-white">
      <PageHero
        eyebrow="NOTICE"
        title="News, updates, and important notices"
        description="Stay informed with ITS BIO announcements, product updates, operational notices, and company news."
        variant="notice"
        cta={{ label: "View all notices", href: "#notice-list" }}
      />

      <div className="mx-auto mt-6 flex max-w-6xl justify-end px-4"><Breadcrumb /></div>

      <section id="notice-list" className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pt-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">All notices</div>
            <div className="mt-1 text-sm text-slate-600">
              {qRaw ? <>Results for <span className="font-semibold text-slate-900">“{qRaw}”</span> · </> : <>Total </>}
              <span className="font-semibold text-slate-900">{Number(normalTotal) + (pinnedItems as any[]).length}</span>
            </div>
          </div>

          <form className="flex w-full gap-2 sm:w-auto" action="/notice" method="get">
            <input name="q" defaultValue={qRaw} placeholder="Search notices..." className="h-11 w-full rounded-full border border-slate-200 bg-white px-5 text-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-50 sm:w-[360px]" />
            <button className="h-11 shrink-0 rounded-full bg-orange-600 px-6 text-sm font-semibold text-white transition hover:bg-orange-700">Search</button>
          </form>
        </div>

        <div className="mt-8 border-t border-slate-200">
          <ul className="divide-y divide-slate-200">
            {(pinnedItems as any[]).map((it) => {
              const dateText = fmtDate(it.publishedAt ?? it._createdAt);
              return (
                <li key={it._id} className="group">
                  <Link href={`/notice/${it.slug}`} className="relative flex items-center gap-5 py-4 pl-3">
                    <AccentBar />
                    <div className="flex w-20 shrink-0 items-center justify-center"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-orange-200 bg-orange-50 text-[11px] font-semibold text-orange-700">공지</span></div>
                    <div className="min-w-0 flex-1"><span className="inline-flex min-w-0 items-center text-base font-semibold text-slate-900"><span className="line-clamp-1">{it.title}</span><TitleHoverThumb thumb={it.thumbnail} title={it.title} /></span></div>
                    <RowMeta author={authorText} date={dateText} />
                    <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-orange-500" />
                  </Link>
                </li>
              );
            })}

            {(normalItems as any[]).map((it, i) => {
              const noText = String(baseNo - i).padStart(2, "0");
              const dateText = fmtDate(it.publishedAt ?? it._createdAt);
              return (
                <li key={it._id} className="group">
                  <Link href={`/notice/${it.slug}`} className="relative flex items-center gap-5 py-4 pl-3">
                    <AccentBar />
                    <div className="flex w-20 shrink-0 items-center justify-center"><span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-[11px] font-semibold tabular-nums text-slate-600">{noText}</span></div>
                    <div className="min-w-0 flex-1"><span className="inline-flex min-w-0 items-center text-base font-semibold text-slate-900"><span className="line-clamp-1">{it.title}</span><TitleHoverThumb thumb={it.thumbnail} title={it.title} /></span></div>
                    <RowMeta author={authorText} date={dateText} />
                    <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-orange-500" />
                  </Link>
                </li>
              );
            })}

            {(pinnedItems as any[]).length === 0 && (normalItems as any[]).length === 0 ? <li className="py-14 text-center"><div className="text-sm font-semibold text-slate-900">No results</div><div className="mt-2 text-sm text-slate-600">다른 검색어로 다시 시도해보세요.</div></li> : null}
          </ul>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          <PageLink disabled={page <= 1} href={makeHref(page - 1)} label="Prev" />
          {Array.from({ length: Math.min(totalPages, 10) }).map((_, i) => {
            const p = i + 1;
            const active = p === page;
            return <Link key={p} href={makeHref(p)} className={`min-w-10 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-orange-200 bg-orange-50 text-orange-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{p}</Link>;
          })}
          <PageLink disabled={page >= totalPages} href={makeHref(page + 1)} label="Next" />
        </div>
      </section>
    </main>
  );
}
