import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import CleaverHeroBanner from "@/components/products/CleaverHeroBanner";
import CleaverProductGallery from "@/components/products/CleaverProductGallery";
import CleaverProductSections from "@/components/products/CleaverProductSections";
import MultiSubMiniIncluded from "@/components/products/MultiSubMiniIncluded";
import Breadcrumb from "@/components/site/Breadcrumb";
import { CLEAVER_BRAND_NAME, cleaverDisplayTitle } from "@/lib/cleaver/catalog";
import { getCleaverProduct } from "@/lib/cleaver/sanity";

export const revalidate = 300;

const MULTISUB_MINI_SLUG = "multisub-mini-mini-horizontal-electrophoresis-system";
const MULTISUB_MINI_SKUS = ["MSMINI10", "MSMINI7", "MSMINIDUO"] as const;
type MultiSubMiniSku = (typeof MULTISUB_MINI_SKUS)[number];

type PageProps = { params: Promise<{ slug: string[] }> };

function isMultiSubMiniSku(value: string | undefined) {
  return Boolean(value && MULTISUB_MINI_SKUS.includes(value.trim().toUpperCase() as MultiSubMiniSku));
}

function multiSubMiniPath() {
  return `/products/cleaver/item/${MULTISUB_MINI_SLUG}`;
}

function manufacturerOriginalUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isManufacturer = host === "www.thistlescientific.com" || host === "thistlescientific.com";

    if (!isManufacturer || !parsed.pathname.includes("/wp-content/uploads/")) return url;

    parsed.pathname = parsed.pathname.replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+$)/i, "");
    parsed.searchParams.delete("w");
    parsed.searchParams.delete("width");
    parsed.searchParams.delete("h");
    parsed.searchParams.delete("height");
    return parsed.toString();
  } catch {
    return url;
  }
}

function imageQualityScore(url: string) {
  let score = 0;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = decodeURIComponent(parsed.pathname);

    if (host === "www.thistlescientific.com" || host === "thistlescientific.com") score += 2_000_000_000;
    if (host === "cdn.sanity.io") score += 500_000_000;

    const dimensionMatches = [...path.matchAll(/(?:-|_)(\d{2,5})x(\d{2,5})(?=[-_.])/g)];
    const dimensions = dimensionMatches.at(-1);
    if (dimensions) {
      const width = Number(dimensions[1]);
      const height = Number(dimensions[2]);
      score += width * height;
      if (width <= 300 || height <= 300) score -= 300_000_000;
    } else if (host.includes("thistlescientific.com")) {
      score += 900_000_000;
    }

    const requestedWidth = Number(parsed.searchParams.get("w") || parsed.searchParams.get("width") || 0);
    const requestedHeight = Number(parsed.searchParams.get("h") || parsed.searchParams.get("height") || 0);
    if (requestedWidth && requestedHeight) score += requestedWidth * requestedHeight;
  } catch {
    // Keep unknown URLs available, but behind verified manufacturer/high-resolution sources.
  }

  return score;
}

function preferredPhotos(image: string | undefined, images: string[] | undefined, verifiedSourceAssetsOnly = false) {
  const sourceImages = [...(images || []), image].filter((value): value is string => Boolean(value));
  const expanded = verifiedSourceAssetsOnly
    ? sourceImages
    : sourceImages.flatMap((url) => {
        const original = manufacturerOriginalUrl(url);
        return original === url ? [url] : [original, url];
      });
  const unique = Array.from(new Set(expanded));

  return unique
    .map((url, index) => ({ url, index, score: imageQualityScore(url) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.url);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const requestedSlug = slug.at(-1) || "";
  const lookup = requestedSlug === MULTISUB_MINI_SLUG ? "MSMINI10" : requestedSlug;
  const product = await getCleaverProduct(lookup);
  if (!product) return { title: "Product not found" };
  const displayTitle = cleaverDisplayTitle(product);
  const isParentProduct = Boolean(product.cleaverSourceTitle) && isMultiSubMiniSku(product.sku);
  return {
    title: isParentProduct ? `${displayTitle} | ${CLEAVER_BRAND_NAME}` : `${displayTitle} | ${product.sku} | ${CLEAVER_BRAND_NAME}`,
    description: product.summary || `${displayTitle} from Cleaver Scientific. Request product information and a quote from ITS BIO.`,
  };
}

export default async function CleaverProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const requestedSlug = slug.at(-1) || "";
  const lookup = requestedSlug === MULTISUB_MINI_SLUG ? "MSMINI10" : requestedSlug;
  const product = await getCleaverProduct(lookup);
  if (!product) notFound();

  const sourceFidelity = Boolean(product.cleaverSourceTitle);
  const multiSubMiniReference = sourceFidelity && isMultiSubMiniSku(product.sku);

  if (multiSubMiniReference && requestedSlug !== MULTISUB_MINI_SLUG) {
    redirect(multiSubMiniPath());
  }

  const displayTitle = cleaverDisplayTitle(product);
  const photos = preferredPhotos(product.image, product.images, multiSubMiniReference);
  const highlights = (product.highlights || []).filter(Boolean).slice(0, 6);
  const atAGlance = (product.cleaverAtAGlance || []).filter(Boolean);
  const quoteHref = `/quote?product=${encodeURIComponent(displayTitle)}&catNo=${encodeURIComponent(product.sku)}`;

  const beforeIncludedProduct = multiSubMiniReference ? {
    ...product,
    cleaverIncludedItems: [],
    docs: [],
    documentsHtml: undefined,
    cleaverVariations: [],
    cleaverAccessories: [],
    cleaverVideos: [],
  } : product;

  const afterIncludedProduct = multiSubMiniReference ? {
    ...product,
    overviewHtml: undefined,
    specsHtml: undefined,
    specRows: [],
    cleaverSpecificationMatrix: undefined,
    cleaverIncludedItems: [],
  } : product;

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: CLEAVER_BRAND_NAME, href: "/products/cleaver" },
    ...product.categoryPathTitles.map((label, index) => ({ label, href: `/products/cleaver/${product.categoryPath.slice(0, index + 1).join("/")}` })),
    { label: displayTitle },
  ];

  return (
    <main className="bg-white pb-20">
      <CleaverHeroBanner title={displayTitle} eyebrow="Cleaver Scientific product" />
      <section className="border-b border-slate-200 bg-[#fbfafc]"><div className="mx-auto max-w-[1260px] px-6 py-5 md:py-6"><Breadcrumb items={crumbs} /></div></section>

      <div className="mx-auto max-w-[1260px] px-6 pt-10 md:pt-14">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,.98fr)] lg:gap-16">
          <CleaverProductGallery images={photos} title={displayTitle} />

          {sourceFidelity ? (
            <section className="py-1 lg:py-2">
              <h1 data-product-name={displayTitle} className="text-[32px] font-semibold leading-[1.12] tracking-[-0.025em] text-slate-950 md:text-[42px]">{displayTitle}</h1>

              {atAGlance.length ? (
                <div className="mt-7">
                  <h2 className="text-[15px] font-semibold text-slate-900">At a Glance</h2>
                  <ul className="mt-3.5 space-y-2 border-l-2 border-[#6d2c86] pl-5">
                    {atAGlance.map((item) => <li key={item} className="text-[14px] leading-6 text-slate-700 md:text-[15px]">{item}</li>)}
                  </ul>
                </div>
              ) : null}

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-slate-200 pt-5">
                <span data-cat-no={product.sku} className="text-[14px] text-slate-600">CAT.NO: <strong className="font-semibold text-slate-900">{product.sku}</strong></span>
                <Link href={quoteHref} className="inline-flex h-11 items-center justify-center bg-[#61247b] px-6 text-[14px] font-semibold text-white transition hover:bg-[#471659]">Request a Quote</Link>
              </div>
            </section>
          ) : (
            <section className="py-2 lg:py-5">
              <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.24em] text-[#8650a0]"><span className="h-px w-8 bg-[#8650a0]" />Cleaver Scientific</div>
              <h1 data-product-name={displayTitle} className="mt-5 text-[32px] font-semibold leading-[1.12] tracking-tight text-slate-950 md:text-[44px]">{displayTitle}</h1>
              <div data-cat-no={product.sku} className="mt-6 inline-flex rounded-full bg-[#f4edf8] px-4 py-2 text-sm font-semibold text-[#61247b]">Catalog No. {product.sku}</div>
              {product.summary ? <p className="mt-7 text-[15px] leading-8 text-slate-600">{product.summary}</p> : null}
              {highlights.length ? <ul className="mt-7 grid gap-3 border-t border-slate-100 pt-6">{highlights.map((highlight) => <li key={highlight} className="flex items-start gap-3 text-sm leading-6 text-slate-700"><span aria-hidden className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f3ebf8] text-xs font-bold text-[#743693]">✓</span><span>{highlight}</span></li>)}</ul> : null}
              <div className="mt-8 rounded-2xl border border-slate-200 bg-[#fbfafc] p-5"><div className="grid grid-cols-[105px_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm"><span className="font-semibold text-slate-700">Brand</span><span className="text-slate-600">{CLEAVER_BRAND_NAME}</span><span className="font-semibold text-slate-700">Catalog No.</span><span className="text-slate-600">{product.sku}</span>{product.categoryPathTitles.length ? <><span className="font-semibold text-slate-700">Category</span><span className="text-slate-600">{product.categoryPathTitles.at(-1)}</span></> : null}</div></div>
              <div className="mt-7 flex flex-wrap gap-3"><Link href={quoteHref} className="inline-flex h-12 items-center rounded-full bg-[#61247b] px-7 text-sm font-semibold text-white transition hover:bg-[#471659]">Request a Quote</Link><Link href="/contact" className="inline-flex h-12 items-center rounded-full border border-slate-300 px-6 text-sm font-semibold text-slate-700 transition hover:border-purple-300 hover:text-[#61247b]">Technical Support</Link></div>
            </section>
          )}
        </div>

        {multiSubMiniReference ? (
          <>
            <CleaverProductSections product={beforeIncludedProduct} />
            <MultiSubMiniIncluded />
            <div className="-mt-12 md:-mt-16">
              <CleaverProductSections product={afterIncludedProduct} />
            </div>
          </>
        ) : <CleaverProductSections product={product} />}

        {sourceFidelity ? null : <section className="mt-14 flex flex-col gap-5 rounded-2xl bg-[#f5f1f8] px-7 py-8 md:mt-20 md:flex-row md:items-center md:justify-between md:px-9"><div><h2 className="text-lg font-semibold text-slate-900">Need help selecting the right system?</h2><p className="mt-1 text-sm leading-6 text-slate-600">Our team can help with product specifications, compatibility, and quotations.</p></div><Link href="/contact" className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-[#61247b] px-6 text-sm font-semibold text-white transition hover:bg-[#471659]">Contact our specialists</Link></section>}
      </div>
    </main>
  );
}
