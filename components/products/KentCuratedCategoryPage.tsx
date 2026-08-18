import Image from "next/image";
import Link from "next/link";

import Breadcrumb from "@/components/site/Breadcrumb";
import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";

const BRAND_KEY = "kent";
const PAGE_SHELL = "mx-auto max-w-[1320px] px-6";
const CONTENT_LAYOUT =
  "grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]";

type ProductRow = {
  _id: string;
  _type: "kentPreviewProduct" | "product" | string;
  title: string;
  sku?: string;
  slug: string;
  summary?: string;
  thumb?: string;
  sourceUrl?: string;
  categoryPathTitles?: string[];
};

export type KentCuratedProductSection = {
  title: string;
  description?: string;
  slugs: string[];
};

export type KentCuratedCategoryCard = {
  title: string;
  href: string;
  count: number;
  representativeSlug?: string;
  eyebrow?: string;
};

export type KentCuratedSidebarChild = {
  title: string;
  href: string;
};

export type KentCuratedCategoryPageProps = {
  title: string;
  rootPath: string[];
  intro: string;
  productSections: KentCuratedProductSection[];
  relatedCategories?: KentCuratedCategoryCard[];
  relatedTitle?: string;
  sidebarChildren?: KentCuratedSidebarChild[];
};

const PAGE_QUERY = `
{
  "brand": *[
    _type=="brand"
    && (themeKey==$brandKey || slug.current==$brandKey)
  ][0]{
    _id, title
  },

  "products": *[
    _type in ["kentPreviewProduct", "product"]
    && (!defined(isActive) || isActive==true)
    && (
      brandSlug==$brandKey
      || brand->slug.current==$brandKey
      || brand->themeKey==$brandKey
    )
    && slug.current in $slugs
  ] | order(title asc) {
    _id,
    _type,
    title,
    sku,
    summary,
    categoryPathTitles,
    "slug": slug.current,
    "thumb": coalesce(
      images[0].asset->url,
      images[0].url,
      imageUrls[0],
      galleryImageUrls[0],
      ""
    ),
    sourceUrl
  }
}
`;

const MENU_ITEMS = [
  ["Anesthesia", "anesthesia"],
  ["Animal Handling", "laboratory-animal-handling"],
  ["Body Composition Analysis", "body-composition-analysis"],
  ["Feeding Needles", "feeding-needles"],
  ["Imaging System", "imaging-system"],
  ["Mobile Carts", "mobile-carts"],
  ["Nebulizer", "nebulizers"],
  ["Non-invasive Blood Pressure", "noninvasive-blood-pressure"],
  ["Physiological Monitoring", "physiological-monitoring"],
  ["Rodent Identification", "rodent-identification"],
  ["Surgery", "surgery"],
  ["Tail Vein Training Devices", "tail-vein-training-materials"],
  ["Tissue Collection", "tissue-collection"],
  ["Ventilation", "ventilation"],
  ["Warming", "warming"],
  ["Warranties", "warranty"],
] as const;

function productHref(slug: string) {
  return `/products/${BRAND_KEY}/item/${slug}`;
}

function categoryHref(path: string[]) {
  return `/products/${BRAND_KEY}/${path.join("/")}`;
}

function chooseProductMap(rows: ProductRow[]) {
  const preferPreview =
    process.env.VERCEL_ENV === "preview" &&
    String(process.env.VERCEL_GIT_COMMIT_REF || "").startsWith("agent/kent");

  const grouped = new Map<string, ProductRow[]>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const slug = String(row.slug || "").trim().toLowerCase();
    if (!slug) continue;
    const entries = grouped.get(slug) || [];
    entries.push(row);
    grouped.set(slug, entries);
  }

  const result = new Map<string, ProductRow>();
  for (const [slug, entries] of grouped) {
    const preferredType = preferPreview ? "kentPreviewProduct" : "product";
    const preferred = entries.find((entry) => entry._type === preferredType) || entries[0];
    const fallback = entries.find((entry) => entry._id !== preferred._id);

    result.set(slug, {
      ...fallback,
      ...preferred,
      title: preferred.title || fallback?.title || slug,
      sku: preferred.sku || fallback?.sku || "",
      summary: preferred.summary || fallback?.summary || "",
      thumb: preferred.thumb || fallback?.thumb || "",
      sourceUrl: preferred.sourceUrl || fallback?.sourceUrl || "",
      categoryPathTitles:
        preferred.categoryPathTitles?.length
          ? preferred.categoryPathTitles
          : fallback?.categoryPathTitles || [],
      slug,
    });
  }

  return result;
}

function HeroBanner({ brandTitle }: { brandTitle: string }) {
  return (
    <section className="relative">
      <div className="relative h-[220px] w-full overflow-hidden md:h-[280px]">
        <Image src="/hero.png" alt="Products hero" fill priority className="object-cover" />
        <div className="absolute inset-0 bg-slate-950/35" />
        <div className={`${PAGE_SHELL} relative flex h-full items-center`}>
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-white/80">Products</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl">{brandTitle}</h1>
          </div>
        </div>
      </div>
    </section>
  );
}

function SideNav({
  activeRoot,
  children,
}: {
  activeRoot: string;
  children: KentCuratedSidebarChild[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-5 py-4">
        <div className="text-base font-semibold text-blue-700">General Lab Equipment</div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto p-2">
        <div className="space-y-1">
          {MENU_ITEMS.map(([label, slug]) => {
            const active = slug === activeRoot;
            return (
              <div key={slug}>
                <Link
                  href={`/products/${BRAND_KEY}/${slug}`}
                  prefetch={false}
                  className={[
                    "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition",
                    active
                      ? "bg-blue-50 font-semibold text-blue-800"
                      : "text-neutral-800 hover:bg-neutral-50",
                  ].join(" ")}
                >
                  <span>{label}</span>
                  {active && children.length ? <span aria-hidden>▾</span> : null}
                </Link>

                {active && children.length ? (
                  <div className="ml-5 mt-1 space-y-1 border-l border-dashed border-neutral-300 pl-3">
                    {children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        prefetch={false}
                        className="block rounded-lg px-3 py-2 text-sm leading-5 text-neutral-700 hover:bg-blue-50 hover:text-blue-800"
                      >
                        {child.title}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: ProductRow }) {
  const categories = Array.isArray(product.categoryPathTitles)
    ? product.categoryPathTitles.filter(Boolean)
    : [];

  return (
    <Link href={productHref(product.slug)} prefetch={false} className="group block">
      <article className="h-full border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="relative aspect-square border-b border-slate-100 bg-white">
          {product.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.thumb}
              alt=""
              className="absolute inset-0 h-full w-full object-contain p-5"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 bg-slate-50" />
          )}
        </div>

        <div className="px-5 py-5">
          {categories.length ? (
            <div className="line-clamp-2 text-[12px] leading-5 text-slate-500">
              {categories.join(", ")}
            </div>
          ) : null}

          <div className="mt-2 text-[22px] font-semibold leading-[1.35] tracking-tight text-slate-900 group-hover:text-blue-700">
            {product.title}
          </div>

          {product.summary ? (
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{product.summary}</p>
          ) : (
            <div className="mt-3 h-[72px]" />
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {product.sku ? `Cat.No ${product.sku}` : "Kent Scientific"}
            </div>
            <span className="text-sm font-semibold text-blue-700">
              Learn More <span aria-hidden>›</span>
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function ProductSection({
  section,
  products,
}: {
  section: KentCuratedProductSection;
  products: Map<string, ProductRow>;
}) {
  const rows = section.slugs
    .map((slug) => products.get(slug.toLowerCase()))
    .filter((product): product is ProductRow => Boolean(product));

  if (!rows.length) return null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight text-neutral-900 md:text-[30px]">
            {section.title}
          </h2>
          {section.description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{section.description}</p>
          ) : null}
        </div>
        <div className="text-sm text-slate-600">
          {rows.length} product{rows.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-8 grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </section>
  );
}

function RelatedCategoryGrid({
  title,
  categories,
  products,
}: {
  title: string;
  categories: KentCuratedCategoryCard[];
  products: Map<string, ProductRow>;
}) {
  if (!categories.length) return null;

  return (
    <section className="mt-10">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-[28px] font-semibold tracking-tight text-neutral-900 md:text-[30px]">{title}</h2>
        <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          {categories.length} categories
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => {
          const representative = category.representativeSlug
            ? products.get(category.representativeSlug.toLowerCase())
            : undefined;

          return (
            <Link
              key={category.href}
              href={category.href}
              prefetch={false}
              className="group overflow-hidden rounded-[22px] border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-[4/3] border-b border-slate-100 bg-white">
                {representative?.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={representative.thumb}
                    alt=""
                    className="absolute inset-0 h-full w-full object-contain p-5"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-slate-50" />
                )}
              </div>
              <div className="p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {category.eyebrow || "Kent Category"}
                </div>
                <div className="mt-2 text-[20px] font-semibold leading-snug tracking-tight text-slate-900 group-hover:text-blue-700">
                  {category.title}
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {category.count} product{category.count === 1 ? "" : "s"}
                </div>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                  Browse category <span aria-hidden>›</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default async function KentCuratedCategoryPage({
  title,
  rootPath,
  intro,
  productSections,
  relatedCategories = [],
  relatedTitle = "Additional equipment",
  sidebarChildren = [],
}: KentCuratedCategoryPageProps) {
  const allSlugs = Array.from(
    new Set([
      ...productSections.flatMap((section) => section.slugs),
      ...relatedCategories.flatMap((category) =>
        category.representativeSlug ? [category.representativeSlug] : [],
      ),
    ]),
  );

  const data = await sanityCdnClient.fetch(PAGE_QUERY, {
    brandKey: BRAND_KEY,
    slugs: allSlugs,
  }, PUBLIC_CATALOG_CACHE);

  const brandTitle = data?.brand?.title || "Kent Scientific";
  const products = chooseProductMap(Array.isArray(data?.products) ? data.products : []);

  return (
    <div>
      <HeroBanner brandTitle={brandTitle} />

      <div className={PAGE_SHELL}>
        <div className="mt-6 flex justify-end">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Products", href: "/products" },
              { label: brandTitle, href: `/products/${BRAND_KEY}` },
              { label: title, href: categoryHref(rootPath) },
            ]}
          />
        </div>

        <div className={`mt-10 ${CONTENT_LAYOUT}`}>
          <aside className="self-start lg:sticky lg:top-24">
            <SideNav activeRoot={rootPath[0] || ""} children={sidebarChildren} />
          </aside>

          <main className="min-w-0 pb-14">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{title}</h2>
            <p className="mt-4 max-w-4xl text-[15px] leading-8 text-slate-700">{intro}</p>

            {productSections.map((section) => (
              <ProductSection key={section.title} section={section} products={products} />
            ))}

            <RelatedCategoryGrid
              title={relatedTitle}
              categories={relatedCategories}
              products={products}
            />

            {!products.size ? (
              <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-6 text-sm leading-7 text-slate-800">
                {title} 상품 데이터를 불러오지 못했습니다.
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
