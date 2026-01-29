import Image from "next/image";
import Link from "next/link";

import ProductsCategoryGrid from "@/components/site/home/ProductsCategoryGrid";

const NOTICES = [
  { title: "New Product Launch: XYZ Antibody", date: "2026-01-10" },
  { title: "Upcoming Webinar: qPCR Optimization", date: "2026-01-05" },
  { title: "Holiday Shipping Schedule", date: "2025-12-28" },
  { title: "Holiday Shipping Schedule", date: "2025-12-28" },
];

const QUICK_CATEGORIES = [
  { label: "qPCR", href: "/products?category=qpcr" },
  { label: "Antibodies", href: "/products?category=antibodies" },
  { label: "Extraction", href: "/products?category=extraction" },
  { label: "Cell Culture", href: "/products?category=cell-culture" },
];

function SectionHeading({
  title,
  desc,
  rightLinkHref,
  rightLinkText,
}: {
  title: string;
  desc?: string;
  rightLinkHref?: string;
  rightLinkText?: string;
}) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">{title}</h2>
      <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-orange-600" />
      {desc ? <p className="mx-auto mt-3 max-w-2xl text-slate-600">{desc}</p> : null}

      {rightLinkHref && rightLinkText ? (
        <div className="mt-5">
          <Link href={rightLinkHref} className="text-sm font-semibold text-orange-700 hover:underline">
            {rightLinkText} →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/** 프로모션: 이미지 크게 + 아래 소개(그라데이션 제거) */
function PromotionsShowcase() {
  const PROMOTIONS = [
    {
      title: "Bundle Promotion",
      caption: "Save more with bundles",
      href: "/promotions/bundle",
      img: "/home/promo-bundle.jpg",
    },
    {
      title: "Spring Promotion",
      caption: "Seasonal specials",
      href: "/promotions/spring",
      img: "/home/promo-spring.jpg",
    },
    {
      title: "Free Shipping",
      caption: "Orders over ₩300,000+",
      href: "/promotions/free-shipping",
      img: "/home/promo-shipping.jpg",
    },
    {
      title: "GMP Online Tour",
      caption: "Virtual facility tour",
      href: "/promotions/gmp-tour",
      img: "/home/promo-gmp.jpg",
    },
  ];

  return (
    <section id="promotions" className="bg-slate-50 py-14 md:py-18">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          title="Promotions"
          desc="Highlights and limited-time benefits."
          rightLinkHref="/promotions"
          rightLinkText="View all promotions"
        />

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PROMOTIONS.map((p) => (
            <Link
              key={p.title}
              href={p.href}
              className="group overflow-hidden rounded-3xl bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src={p.img}
                  alt={p.title}
                  fill
                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                />
              </div>

              <div className="p-5">
                <div className="text-base font-extrabold tracking-tight text-slate-900">{p.title}</div>
                <div className="mt-1 text-sm text-slate-600">{p.caption}</div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800">
                    Promotion
                  </span>
                  <span className="text-sm font-extrabold text-orange-700 transition group-hover:translate-x-0.5">
                    →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function NotebookNotices() {
  return (
    <div className="mt-10">
      <div className="px-0 md:px-0">
        <div className="space-y-3">
          {NOTICES.map((n, idx) => {
            const dateLabel = n.date.replaceAll("-", ".");
            return (
              <Link key={`${n.title}-${n.date}-${idx}`} href="/notice" className="group block px-1 py-2">
                <div className="flex items-start gap-3">
                  {/* bullet */}
                  <div className="mt-2 h-3 w-3 rotate-12 rounded-sm bg-orange-400/90 shadow-[1px_1px_0_rgba(15,23,42,0.18)]" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <div className="min-w-0 truncate text-base font-semibold text-slate-900 group-hover:text-orange-800">
                        {n.title}
                      </div>

                      {idx === 0 ? (
                        <span className="inline-flex rotate-[-2deg] rounded-md bg-orange-200/80 px-2 py-0.5 text-[11px] font-extrabold text-orange-900 shadow-[1px_1px_0_rgba(15,23,42,0.18)]">
                          NEW!
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">{dateLabel}</span> · 클릭해서 자세히 보기
                    </div>

                    {/* underline: base + hover fill */}
                    <div className="mt-3 relative h-[2px] w-full overflow-hidden rounded-full bg-orange-100">
                      <div className="absolute inset-0 origin-left scale-x-0 rounded-full bg-orange-300 transition-transform duration-300 ease-out group-hover:scale-x-100" />
                    </div>
                  </div>

                  {/* arrow */}
                  <div className="shrink-0 text-lg font-extrabold text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-orange-700">
                    →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** ✅ Our Partners: 로고 캐러셀 (노티 뒤에 붙일 섹션) */
function PartnersCarousel() {
  const PARTNERS = [
    { name: "Partner 1", src: "/partners/abm-logo-1.png", href: "https://www.abmgood.com/" },
    { name: "Partner 2", src: "/partners/aims-logo.png", href: "https://animalid.com/" },
    { name: "Partner 3", src: "/partners/bioplastics-logo.png", href: "https://www.kentscientific.com/?srsltid=AfmBOoo8v6ctNcJYeHtOiyLOZHXntbUEi8iDnRUiHCbc-sxHTZSSe-_f" },
    { name: "Partner 4", src: "/partners/cellfreesciences-logo.png", href: "https://www.cfsciences.com/" },
    { name: "Partner 5", src: "/partners/Cleaverscientific-logo.png", href: "https://www.thistlescientific.co.uk/" },
    { name: "Partner 6", src: "/partners/itschem-logo.png", href: "#" },
    { name: "Partner 7", src: "/partners/KentScientific-logo.png", href: "https://www.kentscientific.com/" },
    { name: "Partner 8", src: "/partners/plaslabs-logo.png", href: "https://plas-labs.com/" },
    { name: "Partner 9", src: "/partners/Seedburo-logo.png", href: "https://seedburo.com/" },
  ];

  // 무한 루프용(2번 이어붙이기)
  const loop = [...PARTNERS, ...PARTNERS];

  return (
    <section id="partners" className="bg-slate-50 py-14 md:py-18">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading title="Our Partners" desc="Trusted brands and suppliers we work with." />

        <div className="mt-10">
          {/* ✅ 4개만 보이게: max-w를 4개 폭 기준으로 제한 */}
          <div className="relative mx-auto w-full max-w-4xl overflow-hidden">
            {/* 양끝 페이드(원하면 빼도 됨) */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent" />

            {/* track */}
            <div
              className={[
                "flex w-max items-center gap-10",
                "[animation:partners-marquee_22s_linear_infinite]",
              ].join(" ")}
            >
              {loop.map((p, i) => (
                <Link
                  key={`${p.name}-${i}`}
                  href={p.href}
                  target="blank"
                  aria-label={p.name}
                  className="flex w-[220px] shrink-0 items-center justify-center"
                >
                  <div className="relative h-17 w-[300px]">
                    <Image
                      src={p.src}
                      alt={p.name}
                      fill
                      className="object-contain"
                      sizes="300px"
                      />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="bg-white">
      {/* HERO */}
      <section id="top" className="relative">
        <div className="relative h-[620px] w-full overflow-hidden md:h-[720px]">
         <Image
            src="/hero-e.png"
            alt="ITS BIO"
            fill
            priority
            className="object-cover object-[85%_15%]"
          />

          {/* ✅ 최소 그라데이션: 거의 안 어두워짐 (가독성만 살짝) */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-black/10 to-transparent" />



          <div className="absolute inset-0">
            <div className="mx-auto flex h-full max-w-7xl px-6">
              <div className="my-auto w-full max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  Advanced Solutions for Life Science Research
                </div>

                <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl">
                  High-quality reagents and innovative tools for your <span className="whitespace-nowrap">lab needs</span>
                </h1>

                <p className="mt-4 text-base leading-7 text-white/80 md:text-lg">
                  Search by product name or catalog number. Get the right item for your workflow.
                </p>

                {/* ✅ 검색 폼 유지 */}
                <form
                  action="/products"
                  method="GET"
                  className="mt-7 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md"
                >
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      name="q"
                      className="h-12 w-full flex-1 rounded-xl border border-white/30 bg-white/90 px-5 text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                      placeholder="Search: qPCR enzyme, ab-1234..."
                    />
                    <button
                      type="submit"
                      className="h-12 rounded-xl bg-orange-600 px-7 font-semibold text-white transition hover:bg-orange-700"
                    >
                      Search
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {QUICK_CATEGORIES.map((t) => (
                      <Link
                        key={t.label}
                        href={t.href}
                        className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/85 transition hover:bg-white/15"
                      >
                        {t.label}
                      </Link>
                    ))}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section id="products" className="bg-white py-14 md:py-18">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            title="Products"
            desc="Browse by category — built for fast discovery."
            rightLinkHref="/products"
            rightLinkText="View all Products"
          />
          <div className="mt-8">
            <ProductsCategoryGrid />
          </div>
        </div>
      </section>

      {/* PROMOTIONS */}
      <PromotionsShowcase />

      {/* NOTICE */}
      <section id="notice" className="bg-white py-14 md:py-18">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading title="Latest Notices" desc="Updates and announcements." rightLinkHref="/notice" rightLinkText="View all" />
          <NotebookNotices />
        </div>
      </section>

      {/* OUR PARTNERS */}
      <PartnersCarousel />
    </main>
  );
}