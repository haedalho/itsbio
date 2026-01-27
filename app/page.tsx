import Image from "next/image";

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
    <main className="bg-slate-50">
      {/* HERO (image + form overlay) */}
      <section id="top" className="relative">
        <div className="relative h-[620px] md:h-[720px] w-full overflow-hidden">
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
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white/90 border border-white/15 px-3 py-1 text-xs backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  Advanced Solutions for Life Science Research
                </div>

                <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight text-white leading-tight">
                  High-quality reagents and innovative tools for your{" "}
                  <span className="whitespace-nowrap">lab needs</span>
                </h1>

                <p className="mt-4 text-white/80 text-base md:text-lg leading-7">
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
                      className="w-full flex-1 h-12 rounded-xl bg-white/90 border border-white/30 px-5 text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                      placeholder="Search: qPCR enzyme, ab-1234..."
                    />
                    <button
                      type="submit"
                      className="h-12 rounded-xl bg-orange-600 text-white px-7 font-semibold hover:bg-orange-700 transition"
                    >
                      Search
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {["qPCR", "Antibodies", "Extraction", "Cell Culture"].map((t) => (
                      <a
                        key={t}
                        href={`/products?q=${encodeURIComponent(t)}`}
                        className="text-xs rounded-full bg-white/10 text-white/85 border border-white/15 px-3 py-1 hover:bg-white/15 transition"
                      >
                        {t}
                      </a>
                    ))}
                  </div>
                </form>

                <div className="mt-6 flex flex-wrap gap-2">
                  <a
                    href="#products"
                    className="inline-flex rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition"
                  >
                    Browse featured
                  </a>
                  <a
                    href="/quote"
                    className="inline-flex rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 transition"
                  >
                    Request a Quote
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section id="products" className="mx-auto max-w-7xl px-6 pt-12 md:pt-16 pb-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Featured Products</h2>
            <p className="mt-2 text-slate-600">Curated items frequently requested by labs.</p>
          </div>
          <a href="/products" className="text-sm font-semibold text-orange-700 hover:underline">
            View all products →
          </a>
        </div>

        <div className="mt-7 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURED_PRODUCTS.map((p) => (
            <div key={p.cat} className="rounded-2xl bg-white border p-5 shadow-sm hover:shadow-md transition">
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

      {/* PROMOTIONS */}
      <section id="promotions" className="mx-auto max-w-7xl px-6 py-10 md:py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Current Promotions</h2>
            <p className="mt-2 text-slate-600">Limited-time offers and bundles.</p>
          </div>
          <a href="/promotions" className="text-sm font-semibold text-orange-700 hover:underline">
            View all promotions →
          </a>
        </div>

        <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-4">
          {PROMOTIONS.map((x) => (
            <div key={x.title} className="rounded-2xl border bg-white p-6 overflow-hidden relative shadow-sm hover:shadow-md transition">
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

      {/* RESOURCES */}
      <section id="resources" className="mx-auto max-w-7xl px-6 py-10 md:py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Resources & Downloads</h2>
            <p className="mt-2 text-slate-600">Documents, catalogs, and protocols.</p>
          </div>
          <a href="/resources" className="text-sm font-semibold text-orange-700 hover:underline">
            View all →
          </a>
        </div>

        <div className="mt-7 grid grid-cols-2 md:grid-cols-4 gap-3">
          {RESOURCES.map((r) => (
            <a
              key={r.title}
              href="/resources"
              className="rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition"
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
          className="mt-6 inline-flex rounded-xl bg-orange-600 text-white px-4 py-2 text-sm font-semibold hover:bg-orange-700 transition"
        >
          Browse resources
        </a>
      </section>

      {/* NOTICE */}
      <section id="notice" className="mx-auto max-w-7xl px-6 py-10 md:py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Latest Notices</h2>
            <p className="mt-2 text-slate-600">Updates and announcements.</p>
          </div>
          <a href="/notice" className="text-sm font-semibold text-orange-700 hover:underline">
            View all →
          </a>
        </div>

        <div className="mt-7 rounded-2xl bg-white border divide-y shadow-sm">
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

      {/* CTA (footer form exists below in layout) */}
    
    </main>
  );
}