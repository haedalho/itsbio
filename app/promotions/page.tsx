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
                "group overflow-hidden rounded-3xl border border-slate-200 bg-white",
                // ✅ 검은 뭉침 대신 부드러운 슬레이트 쉐도우
                "shadow-[0_10px_26px_rgba(15,23,42,0.08)]",
                "transition-all duration-300",
                "hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(15,23,42,0.14)]",
                "transform-gpu",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2",
              ].join(" ")}
            >
              <div className="relative aspect-[16/10] bg-slate-100 -mb-px">
                <Image
                  src={p.image}
                  alt={p.title}
                  fill
                  className={[
                    "object-cover transition-transform duration-700",
                    "group-hover:scale-[1.04]",
                  ].join(" ")}
                />

                {/* ✅ 오버레이: 검정 → 슬레이트 톤 / 호버 시 더 옅게 */}
                <div
                  className={[
                    "absolute inset-0 transition-opacity duration-300",
                    "bg-gradient-to-t from-slate-950/45 via-slate-950/10 to-transparent",
                    "group-hover:from-slate-950/30 group-hover:via-slate-950/0",
                  ].join(" ")}
                />

                <div className="absolute left-4 top-4 flex items-center gap-2">
                  <TagPill>{p.tag}</TagPill>
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <div className="text-lg font-semibold text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.18)]">
                    {p.title}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.14)]">
                    {p.desc}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="text-xs font-medium text-slate-500">
                  {p.date}
                </div>
                <div className="text-sm font-semibold text-orange-700">
                  View →
                </div>
              </div>
            </Link>
          ))}
        </div>

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