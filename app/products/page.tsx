// app/products/page.tsx
import Link from "next/link";
import Image from "next/image";
import Breadcrumb from "@/components/site/Breadcrumb";
import NeedAssistance from "@/components/site/NeedAssistance";
import BrandGridSelector from "@/components/products/BrandGridSelector";

import { sanityClient } from "@/lib/sanity/sanity.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type SP = { q?: string; brand?: string; category?: string; page?: string };

const PAGE_SIZE = 12;

type BrandItem = {
  label: string;
  value: string;
  goLabel: string;
  introTitle: string;
  introDesc: string;
};

// ✅ 12개 브랜드(ALL 포함) — 너가 준 목록 그대로
const BRANDS: BrandItem[] = [
  { label: "All", value: "", goLabel: "Go All →", introTitle: "All Products", introDesc: "Browse products across all brands." },
  { label: "ABM", value: "abm", goLabel: "Go ABM →", introTitle: "ABM", introDesc: "Reagents, enzymes, antibodies, and genetic tools for research." },
  { label: "KentScientifics", value: "kentscientifics", goLabel: "Go Kent →", introTitle: "Kent Scientifics", introDesc: "Anesthesia, monitoring, and surgical systems for lab animal research." },
  { label: "ITSChem", value: "itschem", goLabel: "Go ITSChem →", introTitle: "ITSChem", introDesc: "Chemical reagents and materials for lab workflows." },
  { label: "AIMS", value: "aims", goLabel: "Go AIMS →", introTitle: "AIMS", introDesc: "Lab animal identification systems and accessories." },
  { label: "SeedBuro", value: "seedburo", goLabel: "Go SeedBuro →", introTitle: "SeedBuro", introDesc: "Seed testing and analysis equipment." },
  { label: "BIOplastics", value: "bioplastics", goLabel: "Go BIOplastics →", introTitle: "BIOplastics", introDesc: "Tubes, strips, plates, seals, and PCR consumables." },
  { label: "Cleaver Scientific", value: "cleaverscientific", goLabel: "Go Cleaver →", introTitle: "Cleaver Scientific", introDesc: "Electrophoresis, blotting, gel systems, and power supplies." },
  { label: "CellFree Sciences", value: "cellfreesciences", goLabel: "Go CellFree →", introTitle: "CellFree Sciences", introDesc: "Cell-free protein expression kits and reagents." },
  { label: "PlasLabs", value: "plaslabs", goLabel: "Go PlasLabs →", introTitle: "PlasLabs", introDesc: "Glove boxes, desiccators, enclosures, and lab chambers." },
  { label: "Affinityimmuno", value: "affinityimmuno", goLabel: "Go Affinity →", introTitle: "Affinity Immuno", introDesc: "ELISA kits and immunoassay-related products." },
  { label: "DoGen", value: "dogen", goLabel: "Go DoGen →", introTitle: "DoGen", introDesc: "Cell-based assay and protein biochemistry solutions." },
];

const CATS_QUERY = `
*[_type == "productCategory"] | order(order asc, title asc){
  title,
  "slug": slug.current
}
`;

const PRODUCTS_QUERY = `
{
  "popular": *[
    _type == "product"
    && ($q == "" || title match $q || sku match $q)
    && ($brand == "" || brand == $brand)
    && ($cat == "" || $cat in categories[]->slug.current)
  ]
  | order(viewCount desc, publishedAt desc, _createdAt desc)[0...8]{
    _id,
    title,
    "slug": slug.current,
    sku,
    brand,
    shortDescription,
    viewCount,
    isFeatured,
    publishedAt,
    thumbnail{ asset->{ url, metadata{ dimensions } } },
    "datasheetUrl": attachments[asset->mimeType match "application/pdf"][0].asset->url
  },

  "items": *[
    _type == "product"
    && ($q == "" || title match $q || sku match $q)
    && ($brand == "" || brand == $brand)
    && ($cat == "" || $cat in categories[]->slug.current)
  ]
  | order(viewCount desc, publishedAt desc, _createdAt desc)[$from...$to]{
    _id,
    title,
    "slug": slug.current,
    sku,
    brand,
    shortDescription,
    viewCount,
    isFeatured,
    publishedAt,
    thumbnail{ asset->{ url, metadata{ dimensions } } },
    "datasheetUrl": attachments[asset->mimeType match "application/pdf"][0].asset->url
  },

  "total": count(*[
    _type == "product"
    && ($q == "" || title match $q || sku match $q)
    && ($brand == "" || brand == $brand)
    && ($cat == "" || $cat in categories[]->slug.current)
  ])
}
`;

function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function makeQS(params: Record<string, string>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "") sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function buildPageNumbers(current: number, total: number) {
  const pages: (number | "...")[] = [];
  const push = (p: number | "...") => {
    if (pages[pages.length - 1] !== p) pages.push(p);
  };

  if (total <= 9) {
    for (let i = 1; i <= total; i++) push(i);
    return pages;
  }

  push(1);

  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  if (left > 2) push("...");

  for (let i = left; i <= right; i++) push(i);

  if (right < total - 1) push("...");

  push(total);
  return pages;
}

// ✅ Popular 섹션 태그 2~3개만
function getPopularBadge(product: any, idx: number, used: { count: number }) {
  if (used.count >= 3) return null;

  if (idx === 0 || idx === 1) {
    used.count += 1;
    return "Popular";
  }

  if (used.count < 3) {
    if (product?.isFeatured) {
      used.count += 1;
      return "Featured";
    }

    const iso = product?.publishedAt;
    if (iso) {
      const t = new Date(iso).getTime();
      const days = (Date.now() - t) / (1000 * 60 * 60 * 24);
      if (days >= 0 && days <= 30) {
        used.count += 1;
        return "New";
      }
    }
  }

  return null;
}

function PageLink({ href, label, disabled }: { href: string; label: string; disabled: boolean }) {
  if (disabled) {
    return (
      <span className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-400">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
    >
      {label}
    </Link>
  );
}

/** ✅ 제품 카드: 3열에 맞게 더 정돈(이미지 위/텍스트 아래) */
function ProductCard({ p, badge }: { p: any; badge?: string | null }) {
  const img = p?.thumbnail?.asset?.url as string | undefined;
  const title = p?.title ?? "";
  const sku = p?.sku ?? "";

  return (
    <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md hover:border-orange-200">
      <div className="relative h-[140px] bg-slate-50">
        {img ? (
          <Image src={img} alt={title} fill className="object-contain p-4" />
        ) : null}

        {badge ? (
          <div className="absolute left-3 top-3">
            <span className="inline-flex items-center rounded-full border border-orange-200 bg-white/90 px-3 py-1 text-xs font-semibold text-orange-700 backdrop-blur">
              {badge}
            </span>
          </div>
        ) : null}
      </div>

      <div className="p-5">
        <Link
          href={`/products/${p.slug}`}
          className="block text-sm font-semibold text-slate-900 group-hover:text-slate-950 group-hover:underline"
          title={title}
        >
          <span className="line-clamp-2 leading-6">{title}</span>
        </Link>

        {sku ? <div className="mt-1 text-xs font-semibold text-slate-500">SKU: {sku}</div> : null}

        {p?.shortDescription ? (
          <p className="mt-3 text-sm leading-6 text-slate-600 line-clamp-2">{p.shortDescription}</p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-500 line-clamp-2">&nbsp;</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {p?.datasheetUrl ? (
            <a
              href={p.datasheetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
            >
              <span aria-hidden="true">↓</span> Datasheet
            </a>
          ) : null}

          <Link
            href={`/quote${makeQS({ product: p.slug })}`}
            className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 transition"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function ProductsPage({ searchParams }: { searchParams?: Promise<SP> }) {
  const sp = (await searchParams) ?? {};

  const qRaw = (sp.q ?? "").trim();
  const brand = (sp.brand ?? "").trim();
  const cat = (sp.category ?? "").trim();

  const page = clampInt(sp.page, 1, 9999, 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;

  const q = qRaw ? `*${qRaw}*` : "";

  const [cats, data] = await Promise.all([
    sanityClient.fetch(CATS_QUERY, {}, { cache: "no-store" }),
    sanityClient.fetch(PRODUCTS_QUERY, { q, brand, cat, from, to }, { cache: "no-store" }),
  ]);

  const popular = (data?.popular ?? []) as any[];
  const items = (data?.items ?? []) as any[];
  const total = Number(data?.total ?? 0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const makeHref = (nextPage: number) => {
    const p = Math.max(1, Math.min(totalPages, nextPage));
    return `/products${makeQS({
      q: qRaw,
      brand,
      category: cat,
      page: String(p),
    })}`;
  };

  return (
    <main className="bg-white">
      {/* HERO (Notice와 동일 사이즈) */}
      <section className="relative">
        <div className="relative h-[220px] w-full overflow-hidden md:h-[280px]">
          <Image src="/about-hero.png" alt="Products" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-transparent to-transparent" />
          <div className="absolute inset-0">
            <div className="mx-auto flex h-full max-w-6xl items-center px-6">
              <div>
                <div className="text-xs font-semibold tracking-wide text-white/80">ITS BIO</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Products
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80 md:text-base">
                  Browse by brand, category, and keywords. Popular items are highlighted first.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Breadcrumb (Notice와 동일 위치/폭) */}
      <div className="mx-auto mt-6 flex max-w-6xl justify-end px-4">
        <Breadcrumb />
      </div>

      {/* CONTENT */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pt-12">
        {/* Search */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">All products</div>
            <div className="mt-1 text-sm text-slate-600">
              {qRaw ? (
                <>
                  Results for <span className="font-semibold text-slate-900">“{qRaw}”</span>
                </>
              ) : (
                <>Explore our catalog</>
              )}
            </div>
          </div>

          <form className="flex w-full gap-2 sm:w-auto" action="/products" method="get">
            {brand ? <input type="hidden" name="brand" value={brand} /> : null}
            {cat ? <input type="hidden" name="category" value={cat} /> : null}
            <input
              name="q"
              defaultValue={qRaw}
              placeholder="Search products..."
              className="h-11 w-full rounded-full border border-slate-200 bg-white px-5 text-sm outline-none focus:border-slate-300 sm:w-[420px]"
            />
            <button className="h-11 shrink-0 rounded-full bg-orange-600 px-6 text-sm font-semibold text-white hover:bg-orange-700 transition">
              Search
            </button>
          </form>
        </div>

        {/* ✅ 브랜드: 붙는 그리드 + 즉시 소개 변경(대기 없음) */}
        <BrandGridSelector brands={BRANDS} currentBrand={brand} qRaw={qRaw} category={cat} />

        {/* Filters row (Category only) */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <form action="/products#results" method="get" className="flex items-center gap-3">
            {qRaw ? <input type="hidden" name="q" value={qRaw} /> : null}
            {brand ? <input type="hidden" name="brand" value={brand} /> : null}

            <select
              name="category"
              defaultValue={cat}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800"
            >
              <option value="">Category</option>
              {(cats as any[]).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </select>

            <button className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition">
              Apply
            </button>
          </form>

          <div className="text-sm text-slate-600">
            Total <span className="font-semibold text-slate-900">{total}</span>
          </div>
        </div>

        {/* Popular Products */}
        {popular.length ? (
          <div className="mt-10" id="popular">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Popular Products</h2>
              <div className="text-sm text-slate-500">Top {Math.min(8, popular.length)} by views</div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {(() => {
                const used = { count: 0 };
                return popular.slice(0, 8).map((p, idx) => (
                  <ProductCard key={p._id} p={p} badge={getPopularBadge(p, idx, used)} />
                ));
              })()}
            </div>
          </div>
        ) : null}

        <div className="mt-12 border-t border-slate-200" />

        {/* Results */}
        <div className="mt-10" id="results">
          <h2 className="text-lg font-semibold text-slate-900">All Results</h2>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <ProductCard key={p._id} p={p} badge={null} />
            ))}
          </div>

          {!items.length ? (
            <div className="py-14 text-center">
              <div className="text-sm font-semibold text-slate-900">No results</div>
              <div className="mt-2 text-sm text-slate-600">다른 검색어/필터로 다시 시도해보세요.</div>
            </div>
          ) : null}

          {/* Pagination */}
          {totalPages > 1 ? (
            <div className="mt-10 flex items-center justify-center gap-2">
              <PageLink disabled={page <= 1} href={makeHref(page - 1)} label="Prev" />

              {buildPageNumbers(page, totalPages).map((p, idx) => {
                if (p === "...") {
                  return (
                    <span
                      key={`dots-${idx}`}
                      className="min-w-10 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-400"
                    >
                      …
                    </span>
                  );
                }

                const active = p === page;
                return (
                  <Link
                    key={p}
                    href={makeHref(p)}
                    className={[
                      "min-w-10 rounded-full border px-4 py-2 text-sm font-semibold transition text-center",
                      active
                        ? "border-orange-200 bg-orange-50 text-orange-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {p}
                  </Link>
                );
              })}

              <PageLink disabled={page >= totalPages} href={makeHref(page + 1)} label="Next" />
            </div>
          ) : null}
        </div>
      </section>

      <NeedAssistance />
    </main>
  );
}
