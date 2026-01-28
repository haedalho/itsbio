import Image from "next/image";
import Link from "next/link";

import ProductsCategoryGrid from "@/components/site/home/ProductsCategoryGrid";


const FEATURED_PRODUCTS = [
  { name: "qPCR Master Mix", cat: "CAT# QP-1024", desc: "High sensitivity, fast cycling.", tag: "Hot" },
  { name: "RNA Extraction Kit", cat: "CAT# RN-3301", desc: "High yield from tough samples.", tag: "New" },
  { name: "Anti-CD3 Antibody", cat: "CAT# AB-7789", desc: "Validated for Flow/IF.", tag: "Best" },
  { name: "Protein Ladder 10–250kDa", cat: "CAT# PL-2200", desc: "Sharp, consistent bands.", tag: "Popular" },
];

const PROMOTIONS = [
  { title: "Bundle Discount", desc: "Save on kits + consumables.", cta: "See Offers" },
  { title: "Spring Promotion", desc: "Limited-time on select reagents.", cta: "Learn More" },
  { title: "Free Shipping", desc: "On orders over ₩300,000.", cta: "Details" },
];

const RESOURCES = [
  { title: "Catalogs", desc: "Latest product catalogs", badge: "PDF" },
  { title: "Datasheets", desc: "Specs & performance data", badge: "PDF" },
  { title: "Protocols", desc: "Recommended workflows", badge: "DOC" },
  { title: "Safety Docs", desc: "SDS & compliance", badge: "PDF" },
];

const NOTICES = [
  { title: "New Product Launch: XYZ Antibody", date: "2026-01-10" },
  { title: "Upcoming Webinar: qPCR Optimization", date: "2026-01-05" },
  { title: "Holiday Shipping Schedule", date: "2025-12-28" },
];

const QUICK_CATEGORIES = [
  { label: "qPCR", href: "/products?category=qpcr" },
  { label: "Antibodies", href: "/products?category=antibodies" },
  { label: "Extraction", href: "/products?category=extraction" },
  { label: "Cell Culture", href: "/products?category=cell-culture" },
];

export default function Home() {
  return (
    <main className="bg-slate-50">
      {/* HERO (image + form overlay) */}
      <section id="top" className="relative">
        <div className="relative h-[620px] w-full overflow-hidden md:h-[720px]">
          <Image
            src="/hero.png"
            alt="ITS BIO"
            fill
            priority
            className="object-cover object-[85%_75%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-transparent" />

          {/* Content on image */}
          <div className="absolute inset-0">
            <div className="mx-auto flex h-full max-w-7xl px-6">
              <div className="my-auto w-full max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  Advanced Solutions for Life Science Research
                </div>

                <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl">
                  High-quality reagents and innovative tools for your{" "}
                  <span className="whitespace-nowrap">lab needs</span>
                </h1>

                <p className="mt-4 text-base leading-7 text-white/80 md:text-lg">
                  Search by product name or catalog number. Get the right item for your workflow.
                </p>

                {/* Search form sits on image */}
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

                <div className="mt-6 flex flex-wrap gap-2">
                  <Link
                    href="#products"
                    className="inline-flex rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    Browse featured
                  </Link>
                  <Link
                    href="/quote"
                    className="inline-flex rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700"
                  >
                    Request a Quote
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCTS (Category Tiles) */}
      <section className="mx-auto max-w-7xl px-6 pt-12 pb-2 md:pt-16">
        <ProductsCategoryGrid />
      </section>

      {/* FEATURED PRODUCTS */}
      <section id="products" className="mx-auto max-w-7xl px-6 pt-10 pb-10 md:pt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Featured Products</h2>
            <p className="mt-2 text-slate-600">Curated items frequently requested by labs.</p>
          </div>
          <Link href="/products" className="text-sm font-semibold text-orange-700 hover:underline">
            View all products →
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURED_PRODUCTS.map((p) => (
            <div key={p.cat} className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">{p.cat}</div>
                <span className="rounded-full border bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                  {p.tag}
                </span>
              </div>
              <div className="mt-2 font-semibold text-slate-900">{p.name}</div>
              <div className="mt-1 text-sm text-slate-600">{p.desc}</div>

              <div className="mt-4 flex gap-2">
                <Link
                  href="/products"
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-2 text-center text-sm font-semibold transition hover:bg-slate-200"
                >
                  Details
                </Link>
                <Link
                  href="/quote"
                  className="flex-1 rounded-xl bg-orange-600 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-orange-700"
                >
                  Quote
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PROMOTIONS */}
      <section id="promotions" className="mx-auto max-w-7xl px-6 py-10 md:py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Current Promotions</h2>
            <p className="mt-2 text-slate-600">Limited-time offers and bundles.</p>
          </div>
          <Link href="/promotions" className="text-sm font-semibold text-orange-700 hover:underline">
            View all promotions →
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PROMOTIONS.map((x) => (
            <div
              key={x.title}
              className="relative overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-50 via-transparent to-white" />
              <div className="relative">
                <div className="text-lg font-semibold text-slate-900">{x.title}</div>
                <div className="mt-2 text-sm text-slate-600">{x.desc}</div>
                <Link
                  href="/promotions"
                  className="mt-5 inline-flex rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
                >
                  {x.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* RESOURCES */}
      <section id="resources" className="mx-auto max-w-7xl px-6 py-10 md:py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Resources & Downloads</h2>
            <p className="mt-2 text-slate-600">Documents, catalogs, and protocols.</p>
          </div>
          <Link href="/resources" className="text-sm font-semibold text-orange-700 hover:underline">
            View all →
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          {RESOURCES.map((r) => (
            <Link
              key={r.title}
              href="/resources"
              className="rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="inline-flex rounded-full border bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                {r.badge}
              </div>
              <div className="mt-2 font-semibold text-slate-900">{r.title}</div>
              <div className="mt-1 text-xs text-slate-600">{r.desc}</div>
            </Link>
          ))}
        </div>

        <Link
          href="/resources"
          className="mt-6 inline-flex rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
        >
          Browse resources
        </Link>
      </section>

      {/* NOTICE */}
      <section id="notice" className="mx-auto max-w-7xl px-6 py-10 md:py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Latest Notices</h2>
            <p className="mt-2 text-slate-600">Updates and announcements.</p>
          </div>
          <Link href="/notice" className="text-sm font-semibold text-orange-700 hover:underline">
            View all →
          </Link>
        </div>

        <div className="mt-7 divide-y rounded-2xl border bg-white shadow-sm">
          {NOTICES.map((n) => (
            <Link
              key={n.title}
              href="/notice"
              className="block px-5 py-4 transition hover:bg-slate-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-slate-900">{n.title}</div>
                <div className="shrink-0 text-xs text-slate-500">{n.date}</div>
              </div>
              <div className="mt-1 text-sm text-slate-600">Click to view details →</div>
            </Link>
          ))}
        </div>
      </section>

      {/* NEED ASSISTANCE (footer form exists below in layout라면 여기 빼도 됨) */}
    </main>
  );
}