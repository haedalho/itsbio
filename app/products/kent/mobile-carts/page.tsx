import Image from "next/image";
import Link from "next/link";

import Breadcrumb from "@/components/site/Breadcrumb";
import { sanityClient } from "@/lib/sanity/sanity.client";

export const revalidate = 300;

const PRODUCT_DOC_TYPE =
  process.env.VERCEL_ENV === "preview" && String(process.env.VERCEL_GIT_COMMIT_REF || "").startsWith("agent/kent")
    ? "kentPreviewProduct"
    : "product";

const PAGE_SHELL = "mx-auto max-w-[1320px] px-6";

const OFFICIAL_MOBILE_CARTS = [
  {
    slug: "cylinder-bracket",
    title: "Cylinder Bracket",
  },
  {
    slug: "mobile-cart-for-laboratory-equipment-large",
    title: "Mobile Cart for Laboratory Equipment, Large",
  },
  {
    slug: "mobile-cart-for-laboratory-equipment-small",
    title: "Mobile Cart for Laboratory Equipment, Small",
  },
] as const;

const PRODUCT_QUERY = `
*[
  _type == $productType
  && (!defined(isActive) || isActive == true)
  && slug.current in $slugs
] {
  _id,
  title,
  sku,
  summary,
  "slug": slug.current,
  "thumb": coalesce(images[0].asset->url, "")
}
`;

type MobileCartProduct = {
  _id: string;
  title?: string;
  sku?: string;
  summary?: string;
  slug: string;
  thumb?: string;
};

const SIDE_NAV = [
  ["Anesthesia", "/products/kent/anesthesia"],
  ["Animal Handling", "/products/kent/laboratory-animal-handling"],
  ["Body Composition Analysis", "/products/kent/body-composition-analysis"],
  ["Feeding Needles", "/products/kent/feeding-needles"],
  ["Imaging System", "/products/kent/imaging-system"],
  ["Mobile Carts", "/products/kent/mobile-carts"],
  ["Nebulizer", "/products/kent/nebulizers"],
  ["Non-invasive Blood Pressure", "/products/kent/noninvasive-blood-pressure"],
  ["Physiological Monitoring", "/products/kent/physiological-monitoring"],
  ["Rodent Identification", "/products/kent/rodent-identification"],
  ["Surgery", "/products/kent/surgery"],
  ["Tail Vein Training Devices", "/products/kent/tail-vein-training-materials"],
  ["Tissue Collection", "/products/kent/tissue-collection"],
  ["Ventilation", "/products/kent/ventilation"],
  ["Warming", "/products/kent/warming"],
  ["Warranties", "/products/kent/warranty"],
] as const;

function HeroBanner() {
  return (
    <section className="relative">
      <div className="relative h-[220px] w-full overflow-hidden md:h-[280px]">
        <Image src="/hero.png" alt="Products hero" fill priority className="object-cover" />
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-transparent to-transparent" />
        <div className="absolute inset-0">
          <div className={`${PAGE_SHELL} flex h-full items-center`}>
            <div>
              <div className="text-xs font-semibold tracking-wide text-white/80">ITS BIO</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Kent Scientific Product
              </h1>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function KentSideNav() {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-5 py-4">
        <div className="text-base font-semibold text-blue-700">General Lab Equipment</div>
      </div>
      <div className="max-h-[calc(100vh-180px)] overflow-y-auto p-2">
        <div className="space-y-1 pr-1">
          {SIDE_NAV.map(([label, href]) => {
            const active = label === "Mobile Carts";
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className={[
                  "block rounded-xl px-3 py-2 text-sm transition",
                  active ? "bg-blue-50 font-semibold text-blue-800" : "text-neutral-800 hover:bg-neutral-50",
                ].join(" ")}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default async function MobileCartsPage() {
  const rawProducts = (await sanityClient.fetch(PRODUCT_QUERY, {
    productType: PRODUCT_DOC_TYPE,
    slugs: OFFICIAL_MOBILE_CARTS.map((item) => item.slug),
  })) as MobileCartProduct[];

  const bySlug = new Map(rawProducts.map((product) => [product.slug, product]));
  const products = OFFICIAL_MOBILE_CARTS.map((official) => {
    const product = bySlug.get(official.slug);
    return product
      ? { ...product, title: official.title }
      : {
          _id: `missing-${official.slug}`,
          slug: official.slug,
          title: official.title,
          sku: "",
          summary: "",
          thumb: "",
        };
  });

  return (
    <div>
      <HeroBanner />

      <div className={PAGE_SHELL}>
        <div className="mt-6 flex justify-end">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Products", href: "/products" },
              { label: "Kent Scientific", href: "/products/kent" },
              { label: "Mobile Carts", href: "/products/kent/mobile-carts" },
            ]}
          />
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]">
          <aside className="self-start lg:sticky lg:top-24">
            <KentSideNav />
          </aside>

          <main className="min-w-0 pb-14">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">Mobile Carts</h2>

            <section className="mt-6 flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="text-sm text-slate-600">3 products</div>
              <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                <span className="font-medium text-slate-700">View:</span>
                <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                  Grid
                </span>
              </div>
            </section>

            <section className="mt-8">
              <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <Link
                    key={product.slug}
                    href={`/products/kent/item/${product.slug}`}
                    prefetch={false}
                    className="group block"
                  >
                    <article className="border border-slate-200 bg-white transition hover:shadow-md">
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
                        <div className="text-[12px] leading-5 text-slate-500">Mobile Carts</div>
                        <div className="mt-2 text-[22px] font-semibold leading-[1.35] tracking-tight text-slate-900 group-hover:text-blue-700">
                          {product.title}
                        </div>
                        {product.summary ? (
                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{product.summary}</p>
                        ) : (
                          <div className="mt-3 h-12" />
                        )}
                        <div className="mt-5 flex items-center justify-between gap-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {product.sku ? `Cat.No ${product.sku}` : "Kent Scientific"}
                          </div>
                          <span className="text-sm font-semibold text-blue-700">Learn More ›</span>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
