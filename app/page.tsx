import Image from "next/image";
import Link from "next/link";

import BrandsShowcase from "@/components/site/home/BrandsShowcase";
import { sanityClient } from "@/lib/sanity/sanity.client";
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

const FALLBACK_PROMOTIONS: PromotionItem[] = [
  {
    key: "cellular-materials",
    title: "Cellular Materials Collection",
    summary: "Explore selected cell lines and research-ready cellular materials.",
    href: "/promotions",
    image: "/home/promo-bundle.jpg",
  },
  {
    key: "pcr-special",
    title: "PCR Product Special Offer",
    href: "/promotions",
    image: "/home/promo-pcr1.jpg",
  },
  {
    key: "crispr-special",
    title: "CRISPR Stable Knockout Cell Line Offer",
    href: "/promotions",
    image: "/home/promo-spring.jpg",
  },
];

const PARTNERS = [
  { name: "Applied Biological Materials", src: "/partners/abm-logo-1.png", href: "/products/abm", external: false },
  { name: "AIMS", src: "/partners/aims-logo.png", href: "https://animalid.com/", external: true },
  { name: "BIOplastics", src: "/partners/bioplastics-logo.png", href: "https://www.bioplastics.com/", external: true },
  { name: "CellFree Sciences", src: "/partners/cellfreesciences-logo.png", href: "https://www.cfsciences.com/eg/", external: true },
  { name: "Cleaver Scientific", src: "/partners/Cleaverscientific-logo.png", href: "https://www.thistlescientific.co.uk/", external: true },
  { name: "ITSChem", src: "/partners/itschem-logo.png", href: "/contact", external: false },
  { name: "Kent Scientific", src: "/partners/KentScientific-logo.png", href: "/products/kent", external: false },
  { name: "PLAS-LABS", src: "/partners/plaslabs-logo.png", href: "https://plas-labs.com/", external: true },
  { name: "Seedburo", src: "/partners/Seedburo-logo.png", href: "https://seedburo.com/", external: true },
] as const;

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
  const items = [...fromSanity, ...FALLBACK_PROMOTIONS]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.key === item.key) === index)
    .slice(0, 3);
  const [featured, ...secondary] = items;

  return (
    <section className="border-y border-slate-200 bg-[#fffdfb] py-16 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-0">
        <div className="lg:pr-12">
          <div className="flex items-end justify-between gap-5">
            <h2 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950 md:text-3xl">Promotion</h2>
            <ArrowLink href="/promotions">View all</ArrowLink>
          </div>
          <div className="mt-4 h-px w-7 bg-orange-500" />

          {featured ? (
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
          ) : null}

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

function PartnersCarousel() {
  const loop = [...PARTNERS, ...PARTNERS];

  return (
    <section id="partners" className="bg-slate-50 py-14 md:py-18">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Our Partners</h2>
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-orange-600" />
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">Trusted brands and suppliers we work with.</p>
        </div>

        <div className="mt-10">
          <div className="relative mx-auto w-full max-w-4xl overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-slate-50 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-slate-50 to-transparent" />
            <div className="flex w-max items-center gap-10 [animation:partners-marquee_22s_linear_infinite] motion-reduce:animate-none">
              {loop.map((partner, index) => (
                <Link
                  key={`${partner.name}-${index}`}
                  href={partner.href}
                  target={partner.external ? "_blank" : undefined}
                  rel={partner.external ? "noreferrer" : undefined}
                  aria-label={partner.name}
                  className="flex w-[220px] shrink-0 items-center justify-center"
                >
                  <span className="relative h-17 w-[300px]">
                    <Image src={partner.src} alt={partner.name} fill className="object-contain" sizes="300px" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function Home() {
  const [promotions, notices] = await Promise.all([
    sanityClient.fetch<PromotionDoc[]>(PROMOTIONS_QUERY, {}, { cache: "no-store" }),
    sanityClient.fetch<NoticeDoc[]>(NOTICES_QUERY, {}, { cache: "no-store" }),
  ]);

  return (
    <main className="bg-white">
      <BrandsShowcase />
      <EditorialUpdates promotions={promotions} notices={notices} />
      <PartnersCarousel />
    </main>
  );
}
