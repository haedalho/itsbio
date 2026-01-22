import Image from "next/image";
import SnapPage from "@/components/site/SnapPage";
import SnapSection from "@/components/site/SnapSection";
import SectionNav from "@/components/site/SectionNav";

const HEADER_H = 64;

const NAV_ITEMS = [
  { id: "hero", label: "Search" },
  { id: "products", label: "Products" },
  { id: "promotions", label: "Promotions" },
  { id: "resources", label: "Resources" },
  { id: "notice", label: "Notice" },
  { id: "cta", label: "Contact" },
];

// 더미 데이터(원하면 나중에 json/cms로 분리)
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

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white/85 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center gap-6">
          <div className="font-bold text-2xl">itsbio</div>

          <nav className="hidden md:flex gap-6 text-base text-slate-600">
            <a href="/products" className="hover:text-slate-900">Products</a>
            <a href="/promotions" className="hover:text-slate-900">Promotions</a>
            <a href="/resources" className="hover:text-slate-900">Resources</a>
            <a href="/notice" className="hover:text-slate-900">Notice</a>
            <a href="/about" className="hover:text-slate-900">About</a>
            <a href="/contact" className="hover:text-slate-900">Contact</a>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <input
              className="hidden md:block w-80 h-11 rounded-full border px-5 text-sm bg-white"
              placeholder="Search by Product Name, Catalog No..."
            />
            <a
              href="/quote"
              className="rounded-full bg-orange-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-orange-700 transition"
            >
              Request a Quote
            </a>
          </div>
        </div>
      </header>

      {/* Right dot navigation (흰 배경에서도 보이게 캡슐 배경 적용은 SectionNav에서 처리) */}
      <SectionNav items={NAV_ITEMS} headerHeight={HEADER_H} />

      <SnapPage headerHeight={HEADER_H}>
        {/* HERO */}
        <SnapSection id="hero" headerHeight={HEADER_H}>
          <section className="relative w-full" style={{ minHeight: `calc(100dvh - ${HEADER_H}px)` }}>
            <Image
              src="/hero.png"
              alt="Hero"
              fill
              priority
              className="object-cover object-[85%_80%]"
            />

            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/65 via-slate-950/35 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/30 via-transparent to-transparent" />

            <div className="relative h-full">
              <div className="mx-auto max-w-7xl px-6 pt-16 pb-12">
                <div className="max-w-4xl">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white/90 border border-white/15 px-3 py-1 text-xs backdrop-blur">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    Advanced Solutions for Life Science Research
                  </div>

                  <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight text-white leading-tight">
                    High-quality reagents and innovative tools for your{" "}
                    <span className="whitespace-nowrap">lab needs</span>
                  </h1>

                  <p className="mt-4 text-white/80 text-base md:text-lg">
                    Search by product name or catalog number. Get the right item for your workflow.
                  </p>

                  <form action="/products" method="GET" className="mt-8 flex flex-col sm:flex-row gap-3">
                    <input
                      name="q"
                      className="w-full sm:w-[640px] h-12 rounded-full bg-white/90 border border-white/30 px-5 text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                      placeholder="Search: qPCR enzyme, ab-1234..."
                    />
                    <button
                      type="submit"
                      className="h-12 rounded-full bg-orange-600 text-white px-7 font-semibold hover:bg-orange-700 transition"
                    >
                      Search
                    </button>
                  </form>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {["qPCR", "Antibodies", "Extraction", "Cell Culture"].map((t) => (
                      <a
                        key={t}
                        href={`/products?q=${encodeURIComponent(t)}`}
                        className="text-xs rounded-full bg-white/10 text-white/85 border border-white/15 px-3 py-1 hover:bg-white/15 transition backdrop-blur"
                      >
                        {t}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </SnapSection>

        {/* PRODUCTS / FEATURED */}
        <SnapSection id="products" headerHeight={HEADER_H} className="bg-slate-50">
          <section className="mx-auto max-w-7xl px-6 pt-10 pb-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Featured Products</h2>
                <p className="mt-2 text-slate-600">Curated items frequently requested by labs.</p>
              </div>
              <a href="/products" className="text-sm font-semibold text-orange-700 hover:underline">
                View all products →
              </a>
            </div>

            {/* ✅ TODO: 너 원래 Products 섹션 내용이 있으면, 아래 카드 대신 "여기에 그대로 붙여넣기" */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURED_PRODUCTS.map((p) => (
                <div key={p.cat} className="rounded-2xl bg-white border p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">{p.cat}</div>
                    <span className="text-xs rounded-full border bg-orange-50 text-orange-700 px-2 py-0.5">
                      {p.tag}
                    </span>
                  </div>
                  <div className="mt-2 font-semibold text-slate-900">{p.name}</div>
                  <div className="mt-1 text-sm text-slate-600">{p.desc}</div>

                  <div className="mt-4 flex gap-2">
                    <a
                      href="/products"
                      className="flex-1 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-center hover:bg-slate-200 transition"
                    >
                      Details
                    </a>
                    <a
                      href="/quote"
                      className="flex-1 rounded-xl bg-orange-600 text-white px-4 py-2 text-sm font-semibold text-center hover:bg-orange-700 transition"
                    >
                      Quote
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </SnapSection>

        {/* PROMOTIONS */}
        <SnapSection id="promotions" headerHeight={HEADER_H}>
          <section className="mx-auto max-w-7xl px-6 pt-10 pb-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Current Promotions</h2>
                <p className="mt-2 text-slate-600">Limited-time offers and bundles.</p>
              </div>
              <a href="/promotions" className="text-sm font-semibold text-orange-700 hover:underline">
                View all promotions →
              </a>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {PROMOTIONS.map((x) => (
                <div key={x.title} className="rounded-2xl border bg-white p-6 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-50 via-transparent to-white" />
                  <div className="relative">
                    <div className="text-lg font-semibold text-slate-900">{x.title}</div>
                    <div className="mt-2 text-slate-600 text-sm">{x.desc}</div>
                    <a
                      href="/promotions"
                      className="mt-5 inline-flex rounded-xl bg-orange-600 text-white px-4 py-2 text-sm font-semibold hover:bg-orange-700 transition"
                    >
                      {x.cta}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </SnapSection>

        {/* RESOURCES */}
        <SnapSection id="resources" headerHeight={HEADER_H} className="bg-slate-50">
          <section className="mx-auto max-w-7xl px-6 pt-10 pb-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Resources & Downloads</h2>
                <p className="mt-2 text-slate-600">Documents, catalogs, and protocols.</p>
              </div>
              <a href="/resources" className="text-sm font-semibold text-orange-700 hover:underline">
                View all →
              </a>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              {RESOURCES.map((r) => (
                <a
                  key={r.title}
                  href="/resources"
                  className="rounded-xl border bg-white p-4 hover:shadow-sm transition"
                >
                  <div className="text-xs inline-flex rounded-full border bg-orange-50 text-orange-700 px-2 py-0.5">
                    {r.badge}
                  </div>
                  <div className="mt-2 font-semibold text-slate-900">{r.title}</div>
                  <div className="mt-1 text-xs text-slate-600">{r.desc}</div>
                </a>
              ))}
            </div>

            <a
              href="/resources"
              className="mt-5 inline-flex rounded-xl bg-orange-600 text-white px-4 py-2 text-sm font-semibold hover:bg-orange-700 transition"
            >
              Browse resources
            </a>
          </section>
        </SnapSection>

        {/* NOTICE */}
        <SnapSection id="notice" headerHeight={HEADER_H}>
          <section className="mx-auto max-w-7xl px-6 pt-10 pb-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Latest Notices</h2>
                <p className="mt-2 text-slate-600">Updates and announcements.</p>
              </div>
              <a href="/notice" className="text-sm font-semibold text-orange-700 hover:underline">
                View all →
              </a>
            </div>

            <div className="mt-6 rounded-2xl bg-white border divide-y">
              {NOTICES.map((n) => (
                <a key={n.title} href="/notice" className="block px-5 py-4 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">{n.title}</div>
                    <div className="text-xs text-slate-500 shrink-0">{n.date}</div>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">Click to view details →</div>
                </a>
              ))}
            </div>
          </section>
        </SnapSection>

        {/* CTA */}
        <SnapSection id="cta" headerHeight={HEADER_H}>
          <section className="mx-auto max-w-7xl px-6 pt-10 pb-12">
            <div className="rounded-2xl border bg-gradient-to-r from-slate-900 to-slate-800 text-white p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="text-2xl font-bold">Need assistance?</div>
                <div className="mt-2 text-white/80">
                  Contact our experts for personalized support and fast quotations.
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href="/contact"
                  className="rounded-full bg-white/15 px-5 py-2 font-semibold hover:bg-white/20 transition"
                >
                  Contact Us
                </a>
                <a
                  href="/quote"
                  className="rounded-full bg-orange-600 px-5 py-2 font-semibold hover:bg-orange-700 transition"
                >
                  Request a Quote
                </a>
              </div>
            </div>
          </section>
        </SnapSection>
      </SnapPage>
    </main>
  );
}
