import Link from "next/link";
import Breadcrumb from "@/components/site/Breadcrumb";
import PageHero from "@/components/site/PageHero";
import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";
import { urlFor } from "@/lib/sanity/image";

type PromotionDoc = {
  _id: string;
  title: string;
  summary?: string;
  publishedAt?: string;
  order?: number;
  ctaLabel?: string;
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
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function promotionDateLabel(p: PromotionDoc) {
  if (p.dateText && p.dateText.trim().length) return p.dateText;
  if (p.startDate || p.endDate) {
    const a = formatDot(p.startDate);
    const b = formatDot(p.endDate);
    if (a && b) return `${a} ~ ${b}`;
    if (a) return `${a} ~`;
    if (b) return `~ ${b}`;
  }
  return formatDot(p.publishedAt) || "Ongoing";
}

function escapeForGROQ(input: string) {
  return input.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function clampInt(value: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function buildHref(basePath: string, q: string, page: number) {
  const sp = new URLSearchParams();
  if (q.trim()) sp.set("q", q.trim());
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
  return {
    pages,
    showFirst: start > 1,
    showLast: end < total,
    showLeftEllipsis: start > 2,
    showRightEllipsis: end < total - 1,
  };
}

export default async function PromotionsPage({ searchParams }: { searchParams?: Promise<SP> }) {
  const sp = (await searchParams) ?? {};
  const qRaw = (sp.q ?? "").trim();
  const qSafe = qRaw ? escapeForGROQ(qRaw) : "";
  const pageParam = clampInt(sp.page, 1, 1, 999);
  const filter = qSafe ? `&& (title match "*${qSafe}*")` : "";

  const TOTAL_QUERY = `count(*[_type=="promotion" && coalesce(isActive,true)==true ${filter}])`;
  const total = await sanityCdnClient.fetch<number>(TOTAL_QUERY, {}, PUBLIC_CATALOG_CACHE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(pageParam, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  const PROMOTIONS_QUERY = `
    *[_type=="promotion" && coalesce(isActive,true)==true ${filter}]
      | order(defined(order) desc, order desc, publishedAt desc, _createdAt desc)
      [${start}...${end}]{
        _id, title, summary, publishedAt, order, ctaLabel, dateText, startDate, endDate,
        "slug": slug.current,
        "cover": coalesce(image, gallery[0])
      }
  `;

  const promotions = await sanityCdnClient.fetch<PromotionDoc[]>(PROMOTIONS_QUERY, {}, PUBLIC_CATALOG_CACHE);
  const showingFrom = total === 0 ? 0 : start + 1;
  const showingTo = Math.min(start + promotions.length, total);
  const { pages, showFirst, showLast, showLeftEllipsis, showRightEllipsis } = getPageWindow(currentPage, totalPages);

  return (
    <div className="bg-white">
      <PageHero
        eyebrow="PROMOTIONS"
        title="Featured offers from our scientific brands"
        description="Explore current promotions, partner highlights, and limited-time opportunities across the ITS BIO portfolio."
        variant="promotions"
        cta={{ label: "View current offers", href: "#promotions-list" }}
      />

      <div className="mx-auto max-w-6xl px-6"><div className="mt-6 flex justify-end"><Breadcrumb /></div></div>

      <main id="promotions-list" className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Current promotions</div>
            <div className="mt-2 text-sm text-slate-600">
              {qRaw ? <><span className="font-semibold text-slate-900">“{qRaw}”</span> · </> : null}
              <span className="font-semibold text-slate-900">{total}</span> results · {showingFrom}–{showingTo}
            </div>
          </div>

          <form action="/promotions" method="GET" className="flex w-full gap-2 sm:w-auto">
            <input name="q" defaultValue={qRaw} placeholder="Search promotions..." className="h-11 w-full min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-50 sm:w-[330px]" />
            <button type="submit" className="h-11 shrink-0 rounded-full bg-orange-600 px-6 text-sm font-semibold text-white transition hover:bg-orange-700">Search</button>
            {qRaw ? <Link href="/promotions" className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Clear</Link> : null}
          </form>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {promotions.map((p) => {
            const href = p.slug ? `/promotions/${p.slug}` : "/promotions";
            const imgUrl = p.cover ? urlFor(p.cover).width(1200).height(750).fit("crop").auto("format").url() : "";
            return (
              <Link key={p._id} href={href} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_18px_44px_rgba(15,23,42,0.14)]">
                <div className="relative aspect-[16/10] bg-slate-100">
                  {imgUrl ? <img src={imgUrl} alt={p.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" loading="lazy" /> : <div className="h-full w-full bg-gradient-to-br from-slate-100 to-orange-50" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-slate-950/10 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-lg font-semibold text-white">{p.title}</div>
                    {p.summary ? <div className="mt-1 line-clamp-2 text-sm text-white/90">{p.summary}</div> : null}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="text-xs font-medium text-slate-500">{promotionDateLabel(p)}</div>
                  <div className="text-sm font-semibold text-orange-700">{p.ctaLabel || "View →"}</div>
                </div>
              </Link>
            );
          })}
        </div>

        {promotions.length === 0 ? <div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">No promotions matched this search.</div> : null}

        {totalPages > 1 ? (
          <nav className="mt-12 flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
            <Link href={buildHref("/promotions", qRaw, Math.max(1, currentPage - 1))} aria-disabled={currentPage === 1} className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold ${currentPage === 1 ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-400" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>Prev</Link>
            {showFirst ? <Link href={buildHref("/promotions", qRaw, 1)} className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">1</Link> : null}
            {showLeftEllipsis ? <span className="px-1 text-slate-400">…</span> : null}
            {pages.map((pg) => <Link key={pg} href={buildHref("/promotions", qRaw, pg)} aria-current={pg === currentPage ? "page" : undefined} className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-semibold ${pg === currentPage ? "border-orange-200 bg-orange-50 text-orange-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{pg}</Link>)}
            {showRightEllipsis ? <span className="px-1 text-slate-400">…</span> : null}
            {showLast ? <Link href={buildHref("/promotions", qRaw, totalPages)} className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">{totalPages}</Link> : null}
            <Link href={buildHref("/promotions", qRaw, Math.min(totalPages, currentPage + 1))} aria-disabled={currentPage === totalPages} className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold ${currentPage === totalPages ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-400" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>Next</Link>
          </nav>
        ) : null}
      </main>
    </div>
  );
}
