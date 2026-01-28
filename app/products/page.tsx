import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "@/components/site/Breadcrumb";

const PROMOTIONS = [
  {
    title: "Bundle Discount",
    desc: "Save on kits + consumables. Limited-time bundle pricing.",
    href: "/promotions",
    tag: "Offer",
    image: "/home/promo-bundle.jpg",
    date: "2026-02-01 ~ 2026-03-31",
  },
  {
    title: "Spring Promotion",
    desc: "Special pricing on select reagents and enzymes.",
    href: "/promotions",
    tag: "Event",
    image: "/home/promo-spring.jpg",
    date: "2026-03-01 ~ 2026-03-31",
  },
  {
    title: "Free Shipping",
    desc: "Free shipping on orders over ₩300,000.",
    href: "/promotions",
    tag: "Notice",
    image: "/home/promo-shipping.jpg",
    date: "Always",
  },
  {
    title: "GMP Facility Virtual Tour",
    desc: "Explore manufacturing capabilities and QC workflow.",
    href: "/promotions",
    tag: "Popular",
    image: "/home/promo-gmp.jpg",
    date: "Ongoing",
  },
  {
    title: "Citation Rewards",
    desc: "Apply and get recognized for your published results.",
    href: "/promotions",
    tag: "Popular",
    image: "/home/promo-citation.jpg",
    date: "Ongoing",
  },
];

function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
      {children}
    </span>
  );
}

export default function PromotionsPage() {
  return (
    <div>
      {/* ✅ Banner (About과 동일 사이즈 규격: 220/280) */}
      <section className="relative">
        <div className="relative h-[220px] w-full overflow-hidden md:h-[280px]">
          <Image
            src="/contact-hero.png"
            alt="Promotions"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-transparent to-transparent" />

          <div className="absolute inset-0">
            <div className="mx-auto flex h-full max-w-6xl items-center px-6">
              <div>
                <div className="text-xs font-semibold tracking-wide text-white/80">
                  ITS BIO
                </div>
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

      {/* ✅ Breadcrumb */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="mt-6 flex justify-end">
          <Breadcrumb />
        </div>
      </div>

      {/* ✅ Content */}
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Current Promotions
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Check ongoing discounts, seasonal events, and service updates.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
            >
              Browse products
            </Link>
            <Link
              href="/quote"
              className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700"
            >
              Request a quote
            </Link>
          </div>
        </div>

        {/* ✅ Grid */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PROMOTIONS.map((p) => (
            <Link
              key={p.title}
              href={p.href}
              className={[
                // ✅ 바깥(Link)은 “그림자만”
                "group block rounded-3xl",
                "transition-shadow duration-300",
                "shadow-[0_8px_24px_rgba(15,23,42,0.08)]",
                "hover:shadow-[0_14px_40px_rgba(15,23,42,0.12)]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2",
              ].join(" ")}
            >
              {/* ✅ 안쪽 래퍼: border + overflow + radius를 여기서만 처리 (틈 방지 핵심) */}
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                {/* 이미지 영역 */}
                <div className="relative aspect-[16/10] bg-slate-100">
                  <Image
                    src={p.image}
                    alt={p.title}
                    fill
                    // ✅ iOS/Chrome subpixel seam 방지: 살짝 스케일 + translateZ
                    className="object-cover [transform:translateZ(0)] transition-transform duration-700 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <TagPill>{p.tag}</TagPill>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-lg font-semibold text-white">
                      {p.title}
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm text-white/85">
                      {p.desc}
                    </div>
                  </div>
                </div>

                {/* 하단 바 */}
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="text-xs font-medium text-slate-500">
                    {p.date}
                  </div>
                  <div className="text-sm font-semibold text-orange-700">
                    View →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
          Need help finding the right product or offer?{" "}
          <Link
            href="/contact"
            className="font-semibold text-orange-700 hover:underline"
          >
            Contact us
          </Link>
          .
        </div>
      </main>
    </div>
  );
}