import Link from "next/link";

import BrandsShowcase from "@/components/site/home/BrandsShowcase";
import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";
import { urlFor } from "@/lib/sanity/image";

type PromotionDoc = {
  _id: string;
  title: string;
  summary?: string;
  publishedAt?: string;
  slug?: string;
  cover?: Parameters<typeof urlFor>[0];
};

type NoticeDoc = {
  _id: string;
  title: string;
  slug?: string;
  publishedAt?: string;
  createdAt?: string;
  isPinned?: boolean;
};

type PromotionItem = {
  key: string;
  title: string;
  summary?: string;
  href: string;
  image: string;
};

const PROMOTIONS_QUERY = `
  *[_type == "promotion" && coalesce(isActive, true) == true]
    | order(defined(order) desc, order desc, coalesce(publishedAt, _createdAt) desc)
    [0...3]{
      _id,
      title,
      summary,
      publishedAt,
      "slug": slug.current,
      "cover": coalesce(image, gallery[0])
    }
`;

const NOTICES_QUERY = `
  *[_type == "notice" && coalesce(isActive, true) == true]
    | order(coalesce(isPinned, false) desc, coalesce(publishedAt, _createdAt) desc)
    [0...5]{
      _id,
      title,
      "slug": slug.current,
      publishedAt,
      "createdAt": _createdAt,
      isPinned
    }
`;

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 transition hover:text-orange-700">
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

function EditorialUpdates({ promotions, notices }: { promotions: PromotionDoc[]; notices: NoticeDoc[] }) {
  const fromSanity: PromotionItem[] = promotions.map((promotion) => ({
    key: promotion._id,
    title: promotion.title,
    summary: promotion.summary,
    href: promotion.slug ? `/promotions/${promotion.slug}` : "/promotions",
    image: promotion.cover
      ? urlFor(promotion.cover).width(1400).height(800).fit("crop").auto("format").url()
      : "/home/promo-bundle.jpg",
  }));
  const items = fromSanity.slice(0, 3);
  const [featured, ...secondary] = items;

  return (
    <section className="border-y border-slate-200 bg-[#fffdfb] py-16 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-0">
        <div className="lg:pr-12">
          <div className="flex items-end justify-between gap-5">
            <h2 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 md:text-3xl">Promotion</h2>
            {featured ? (
              <ArrowLink href="/promotions">View all</ArrowLink>
            ) : (
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                Coming soon
              </span>
            )}
          </div>
          <div className="mt-4 h-px w-7 bg-orange-500" />

          {featured ? (
            <>
              <Link href={featured.href} className="group mt-7 block">
                <div className="relative aspect-[2.28/1] overflow-hidden border border-slate-200 bg-white">
                  <img
                    src={featured.image}
                    alt={featured.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.015]"
                  />
                </div>
                <div className="flex items-start justify-between gap-5 border-b border-slate-200 py-5">
                  <div className="min-w-0">
                    <h3 className="line-clamp-1 text-base font-semibold text-slate-950 group-hover:text-orange-700 md:text-lg">
                      {featured.title}
                    </h3>
                    {featured.summary ? (
                      <p className="mt-1 line-clamp-1 text-sm text-slate-500">{featured.summary}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-lg text-orange-600 transition group-hover:translate-x-1" aria-hidden>→</span>
                </div>
              </Link>

              <div>
                {secondary.map((promotion) => (
                  <Link key={promotion.key} href={promotion.href} className="group flex items-center gap-5 border-b border-slate-200 py-4">
                    <span className="relative h-16 w-28 shrink-0 overflow-hidden border border-slate-100 bg-white sm:h-20 sm:w-36">
                      <img src={promotion.image} alt="" className="h-full w-full object-cover" />
                    </span>
                    <span className="min-w-0 flex-1 line-clamp-2 text-sm font-medium leading-6 text-slate-800 group-hover:text-orange-700 md:text-base">
                      {promotion.title}
                    </span>
                    <span className="shrink-0 text-orange-600 transition group-hover:translate-x-1" aria-hidden>→</span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="relative mt-7 min-h-[330px] overflow-hidden border border-slate-200 bg-white px-7 py-8 sm:px-10 sm:py-10">
              <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-orange-100" />
              <div className="pointer-events-none absolute -bottom-24 right-12 h-56 w-56 rounded-full border border-slate-100" />
              <div className="pointer-events-none absolute right-20 top-16 h-2.5 w-2.5 rounded-full bg-orange-100" />
              <div className="relative flex h-full min-h-[260px] flex-col justify-center">
                <span className="w-fit border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                  Promotion · Coming Soon
                </span>
                <h3 className="mt-6 max-w-md text-2xl font-semibold leading-tight tracking-[-0.03em] text-slate-950 sm:text-3xl">
                  새로운 프로모션을 준비하고 있습니다.
                </h3>
                <p className="mt-4 max-w-lg text-sm leading-7 text-slate-600 sm:text-base">
                  연구와 실험에 실질적인 도움이 되는 혜택과 새로운 소식을 선별해 곧 안내드리겠습니다.
                </p>
                <div className="mt-7 flex items-center gap-3 text-sm font-medium text-slate-500">
                  <span className="h-px w-8 bg-orange-400" />
                  더 좋은 혜택으로 찾아뵙겠습니다.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-slate-200 lg:border-l lg:pl-12">
          <div className="flex items-end justify-between gap-5">
            <h2 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 md:text-3xl">Notice</h2>
            <ArrowLink href="/notice">View all</ArrowLink>
          </div>
          <div className="mt-4 h-px w-7 bg-orange-500" />

          <ul className="mt-7 border-t border-slate-200">
            {notices.map((notice, index) => (
              <li key={notice._id} className="border-b border-slate-200">
                <Link
                  href={notice.slug ? `/notice/${notice.slug}` : "/notice"}
                  className="group grid min-h-[78px] grid-cols-[92px_1fr_auto] items-center gap-4 py-4"
                >
                  <span className="text-xs tabular-nums text-slate-500 sm:text-sm">
                    {formatDate(notice.publishedAt ?? notice.createdAt)}
                  </span>
                  <span className="min-w-0 text-sm font-medium leading-6 text-slate-800 group-hover:text-orange-700 md:text-[15px]">
                    {index === 0 ? (
                      <span className="mr-2 inline-flex border border-orange-200 px-1.5 py-0.5 align-middle text-[10px] font-semibold leading-none text-orange-600">
                        NEW
                      </span>
                    ) : null}
                    <span className="align-middle line-clamp-2">{notice.title}</span>
                  </span>
                  <span className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-orange-600" aria-hidden>→</span>
                </Link>
              </li>
            ))}
            {notices.length === 0 ? (
              <li className="border-b border-slate-200 py-12 text-sm text-slate-500">
                등록된 공지가 없습니다.
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default async function Home() {
  const [promotions, notices] = await Promise.all([
    sanityCdnClient.fetch<PromotionDoc[]>(PROMOTIONS_QUERY, {}, PUBLIC_CATALOG_CACHE),
    sanityCdnClient.fetch<NoticeDoc[]>(NOTICES_QUERY, {}, PUBLIC_CATALOG_CACHE),
  ]);

  return (
    <main className="bg-white">
      <BrandsShowcase />
      <EditorialUpdates promotions={promotions} notices={notices} />
    </main>
  );
}
