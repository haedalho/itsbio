import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import CleaverCatalogImage from "@/components/products/CleaverCatalogImage";
import CleaverHeroBanner from "@/components/products/CleaverHeroBanner";
import Breadcrumb from "@/components/site/Breadcrumb";
import sourceMap from "@/data/cleaver-source-map.json";
import {
  CLEAVER_BRAND_NAME,
  CLEAVER_CATEGORIES,
  CLEAVER_INVENTORY,
  cleaverCategory,
  cleaverCategoryTitles,
  cleaverProductHref,
  type CleaverProduct,
} from "@/lib/cleaver/catalog";
import {
  getFastCleaverCategoryCovers as getCleaverCategoryCovers,
  getFastCleaverProductPage as getCleaverProductPage,
} from "@/lib/cleaver/fast-catalog";

export const revalidate = 86400;

type PageProps = {
  params: Promise<{ path?: string[] }>;
  searchParams?: Promise<{ q?: string; page?: string }>;
};

type SourceImageIdentity = { images?: string[] };
const CLEAVER_SOURCE_IMAGES = sourceMap as Record<string, SourceImageIdentity>;

function productImageSources(product: CleaverProduct) {
  const sku = String(product.sku || "").normalize("NFKC").trim().toUpperCase();
  const mapped = CLEAVER_SOURCE_IMAGES[sku]?.images || [];
  // Prefer the verified managed copy so cards never wait on the manufacturer server.
  // Manufacturer URLs remain a fidelity fallback for products without a managed asset.
  return Array.from(new Set([product.image, ...(product.images || []), ...mapped].map((value) => String(value || "").trim()).filter(Boolean)));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { path = [] } = await params;
  const current = path.length ? cleaverCategory(path)?.current : undefined;
  const title = current ? `${current.title} | ${CLEAVER_BRAND_NAME}` : `${CLEAVER_BRAND_NAME} Laboratory Equipment`;
  return {
    title,
    description: `Explore ${current?.title || "electrophoresis equipment, gel documentation and laboratory products"} from Cleaver Scientific at ITS BIO.`,
  };
}

function categoryCount(path: string[]) {
  return CLEAVER_INVENTORY.filter((product) => path.every((segment, index) => product.categoryPath[index] === segment)).length;
}

function categoryHref(path: string[], query = "", page = 1) {
  const suffix = path.length ? `/${path.join("/")}` : "";
  const search = new URLSearchParams();
  if (query) search.set("q", query);
  if (page > 1) search.set("page", String(page));
  const queryString = search.toString();
  return `/products/cleaver${suffix}${queryString ? `?${queryString}` : ""}`;
}

function CleaverSidebar({ activePath }: { activePath: string[] }) {
  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24">
      <Link href="/products/cleaver" className="block border-b border-slate-200 bg-[#f5f0fb] px-5 py-4 text-base font-semibold text-[#61247b]">
        Cleaver Scientific
      </Link>
      <nav className="max-h-[calc(100vh-170px)] space-y-1 overflow-y-auto p-2" aria-label="Cleaver product categories">
        {CLEAVER_CATEGORIES.map((category) => {
          const active = activePath[0] === category.slug;
          return (
            <div key={category.slug}>
              <Link href={categoryHref([category.slug])} prefetch={false} className={`flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-[13px] transition ${active ? "bg-purple-50 font-semibold text-[#61247b]" : "text-slate-700 hover:bg-slate-50"}`}>
                <span>{category.title}</span>
                <span className="shrink-0 text-xs text-slate-400">{categoryCount([category.slug])}</span>
              </Link>
              {active ? (
                <div className="mb-2 ml-4 space-y-0.5 border-l border-dashed border-purple-200 pl-3">
                  {category.children.map((child) => (
                    <Link key={child.slug} href={categoryHref([category.slug, child.slug])} prefetch={false} className={`block rounded-lg px-3 py-2 text-[12px] leading-5 transition ${activePath[1] === child.slug ? "bg-purple-50 font-semibold text-[#61247b]" : "text-slate-600 hover:bg-slate-50 hover:text-[#61247b]"}`}>
                      {child.title}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function ProductCard({ product }: { product: CleaverProduct }) {
  const imageSources = productImageSources(product);
  return (
    <Link href={cleaverProductHref(product)} prefetch={false} className="group block h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition duration-200 hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-lg">
        <div className="relative aspect-[1.12] border-b border-slate-100 bg-white">
          <CleaverCatalogImage title={product.title} sources={imageSources} />
        </div>
        <div className="flex flex-1 flex-col p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8650a0]">{product.sku}</div>
          <h3 className="mt-2 line-clamp-3 text-[15px] font-semibold leading-6 text-slate-900 transition group-hover:text-[#61247b]">{product.title}</h3>
          <div className="mt-auto pt-4 text-[12px] text-slate-500">{product.categoryPathTitles.at(-1) || "Laboratory equipment"}</div>
        </div>
      </article>
    </Link>
  );
}

function Pagination({ path, query, page, pageCount }: { path: string[]; query: string; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const pages = Array.from(new Set([1, page - 1, page, page + 1, pageCount].filter((item) => item >= 1 && item <= pageCount))).sort((a, b) => a - b);
  return (
    <nav aria-label="Cleaver product pages" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      <Link href={categoryHref(path, query, Math.max(1, page - 1))} prefetch={false} aria-disabled={page === 1} className={`rounded-full border px-4 py-2 text-sm ${page === 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:border-purple-300"}`}>← Previous</Link>
      {pages.map((item, index) => (
        <span key={item} className="flex items-center gap-2">
          {index > 0 && item - pages[index - 1] > 1 ? <span className="px-1 text-slate-400">…</span> : null}
          <Link href={categoryHref(path, query, item)} prefetch={false} aria-current={item === page ? "page" : undefined} className={`flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-semibold ${item === page ? "border-[#61247b] bg-[#61247b] text-white" : "border-slate-300 text-slate-700 hover:border-purple-300"}`}>{item}</Link>
        </span>
      ))}
      <Link href={categoryHref(path, query, Math.min(pageCount, page + 1))} prefetch={false} aria-disabled={page === pageCount} className={`rounded-full border px-4 py-2 text-sm ${page === pageCount ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:border-purple-300"}`}>Next →</Link>
    </nav>
  );
}

export default async function CleaverCatalogPage({ params, searchParams }: PageProps) {
  const [{ path = [] }, search] = await Promise.all([params, searchParams || Promise.resolve({} as { q?: string; page?: string })]);
  const match = path.length ? cleaverCategory(path) : undefined;
  if (path.length && !match) notFound();

  const query = String(search.q || "").trim();
  const requestedPage = Math.max(1, Number.parseInt(String(search.page || "1"), 10) || 1);
  const [listing, covers] = await Promise.all([
    getCleaverProductPage(path, query, requestedPage),
    path.length ? Promise.resolve({} as Record<string, string>) : getCleaverCategoryCovers(),
  ]);
  const heading = match?.current.title || CLEAVER_BRAND_NAME;
  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: CLEAVER_BRAND_NAME, ...(path.length ? { href: "/products/cleaver" } : {}) },
    ...cleaverCategoryTitles(path).map((label, index) => ({ label, ...(index < path.length - 1 ? { href: categoryHref(path.slice(0, index + 1)) } : {}) })),
  ];

  return (
    <main className="bg-white pb-20">
      <CleaverHeroBanner />

      <div className="mx-auto max-w-[1320px] px-6">
        <div className="py-6"><Breadcrumb items={breadcrumbs} /></div>
        <div className="grid gap-8 lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)]">
          <CleaverSidebar activePath={path} />
          <section>
            <div className="border-b border-slate-200 pb-6">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#8650a0]">{path.length ? "Product Category" : "Official Product Catalog"}</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{heading}</h2>
              {match && path.length === 1 ? <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{match.root.description}</p> : null}
              <form action={categoryHref(path)} className="mt-5 flex max-w-xl gap-2">
                <input name="q" defaultValue={query} placeholder="Search product name or catalog number" aria-label="Search Cleaver products" className="h-11 min-w-0 flex-1 rounded-full border border-slate-300 px-4 text-sm outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100" />
                <button className="h-11 rounded-full bg-[#61247b] px-5 text-sm font-semibold text-white hover:bg-[#471659]">Search</button>
              </form>
            </div>

            {!path.length && !query ? (
              <section className="mt-8" aria-label="Browse Cleaver Scientific equipment ranges">
                <div className="mb-5 flex items-end justify-between gap-3"><div><div className="text-[11px] font-semibold uppercase tracking-[0.17em] text-[#8650a0]">Purpose-built for discovery</div><h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Browse the range</h3></div></div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {CLEAVER_CATEGORIES.map((category) => (
                    <Link key={category.slug} href={categoryHref([category.slug])} prefetch={false} className="group overflow-hidden rounded-2xl border border-[#ece8ef] bg-white transition duration-300 hover:-translate-y-0.5 hover:border-[#cbb8d4] hover:shadow-[0_14px_36px_rgba(86,39,105,0.1)]">
                      <div className="relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-b from-white to-[#faf8fc] p-4">
                        {covers[category.slug] ? <Image src={covers[category.slug]} alt={category.title} fill quality={85} sizes="(max-width: 768px) 46vw, 340px" className="object-contain p-3 transition duration-500 group-hover:scale-[1.05]" /> : <Image src="/partners/Cleaverscientific-logo.png" alt="" width={170} height={70} className="h-auto max-h-14 w-auto object-contain opacity-65" />}
                      </div>
                      <div className="border-t border-slate-100 p-4"><div className="text-[14px] font-semibold text-slate-900 group-hover:text-[#61247b]">{category.title}</div><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{category.description}</p><div className="mt-3 text-xs font-medium text-[#8650a0]">{categoryCount([category.slug]).toLocaleString()} products <span aria-hidden>→</span></div></div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {match && path.length === 1 && !query ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {match.root.children.map((child) => <Link key={child.slug} href={categoryHref([match.root.slug, child.slug])} prefetch={false} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-purple-300 hover:text-[#61247b]">{child.title} <span className="ml-1 text-slate-400">{categoryCount([match.root.slug, child.slug])}</span></Link>)}
              </div>
            ) : null}

            <div className="mt-8 flex items-center justify-between gap-3"><h3 className="text-lg font-semibold text-slate-950">{query ? `Results for “${query}”` : "Products"}</h3><span className="text-sm text-slate-500">{listing.total.toLocaleString()} products</span></div>
            {listing.products.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{listing.products.map((product) => <ProductCard key={product._id} product={product} />)}</div> : <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-sm text-slate-600">No products matched your search. Try a different product name or catalog number.</div>}
            <Pagination path={path} query={query} page={listing.page} pageCount={listing.pageCount} />
          </section>
        </div>
      </div>
    </main>
  );
}
