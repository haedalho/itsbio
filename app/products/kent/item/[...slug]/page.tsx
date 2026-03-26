// app/products/kent/item/[...slug]/page.tsx
import Image from "next/image";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/site/Breadcrumb";
import KentProductDetailClient from "@/components/products/KentProductDetailClient";
import { sanityClient } from "@/lib/sanity/sanity.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const BRAND_KEY = "kent";

const ITEM_PAGE_QUERY = `
{
  "brand": *[
    _type == "brand"
    && (themeKey == $brandKey || slug.current == $brandKey)
  ][0]{
    _id,
    title,
    themeKey,
    "slug": slug.current
  },

  "product": *[
    _type == "product"
    && slug.current == $slug
    && (
      brand->slug.current == $brandKey
      || brand->themeKey == $brandKey
      || brandSlug == $brandKey
    )
  ][0]{
    _id,
    title,
    summary,
    "slug": slug.current,
    sku,
    sourceUrl,
    categoryPath,
    categoryPathTitles,

    specsHtml,
    extraHtml,
    legacyHtml,

    datasheetHtml,
    documentsHtml,
    faqsHtml,
    referencesHtml,
    reviewsHtml,

    productType,
    defaultVariantId,
    optionGroups[]{
      key,
      name,
      label,
      displayType,
      options[]{ value, label }
    },
    variants[]{
      variantId,
      title,
      sku,
      catNo,
      optionSummary,
      optionValues,
      attributes,
      imageUrl,
      sourceVariationId
    },

    docs[]{ title, label, url },

    imageUrls,
    imageFiles,
    images[]{ _key, asset->{ url } }
  }
}
`;

function buildHref(path: string[]) {
  return path.length ? `/products/${BRAND_KEY}/${path.join("/")}` : `/products/${BRAND_KEY}`;
}

function cleanText(input?: string | null) {
  return String(input || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(input?: string | null) {
  return String(input || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&nbsp;", " ");
}

function stripBrandSuffix(title?: string | null) {
  const raw = decodeHtmlEntities(title);
  const idx = raw.indexOf("|");
  return cleanText(idx >= 0 ? raw.slice(0, idx) : raw);
}

function humanizeSegment(seg: string) {
  return cleanText(seg)
    .replaceAll("-", " ")
    .replaceAll("_", " ");
}

function stripPrintFromHtml(html: unknown) {
  let out = typeof html === "string" ? html : "";
  if (!out) return out;

  out = out.replace(
    /<a[^>]*(?:onclick=["'][^"']*print[^"']*["']|href=["'][^"']*print[^"']*["'])[^>]*>[\s\S]*?<\/a>/gi,
    "",
  );
  out = out.replace(
    /<button[^>]*(?:onclick=["'][^"']*print[^"']*["']|class=["'][^"']*print[^"']*["'])[^>]*>[\s\S]*?<\/button>/gi,
    "",
  );
  out = out.replace(/<i[^>]*class=["'][^"']*fa-print[^"']*["'][^>]*>[\s\S]*?<\/i>/gi, "");
  out = out.replace(/\bPrint\b/gi, "");

  return out;
}

function sanitizeKentHtml(html: unknown) {
  let out = typeof html === "string" ? html : "";
  if (!out) return out;

  out = stripPrintFromHtml(out);

  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  out = out.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  out = out.replace(/<form[\s\S]*?<\/form>/gi, "");
  out = out.replace(/<input[^>]*>/gi, "");
  out = out.replace(/<button[\s\S]*?<\/button>/gi, "");

  out = out.replace(/Login to see prices/gi, "");
  out = out.replace(/Get early access to info, updates, and discounts/gi, "");
  out = out.replace(/Need Help With Your Order\?/gi, "");

  return out.trim();
}

function extractSpecsTableFromHtml(html: string) {
  if (!html) return "";

  const nearSpecs = html.match(/Specifications[\s\S]{0,7000}?(<table[\s\S]*?<\/table>)/i);
  if (nearSpecs?.[1]) return nearSpecs[1];

  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  for (const table of tables) {
    const low = table.toLowerCase();
    if (
      low.includes("spec") ||
      low.includes("specification") ||
      low.includes("parameter") ||
      low.includes("catalog")
    ) {
      return table;
    }
  }

  return tables[0] || "";
}

function isGalleryNoiseUrl(url: string) {
  const s = String(url || "").toLowerCase();
  if (!s) return true;

  if (s.includes("request") && s.includes("sample")) return true;
  if (s.includes("request") && s.includes("quote")) return true;
  if (s.includes("intertek")) return true;
  if (s.includes("badge")) return true;
  if (s.includes("icon")) return true;
  if (s.includes("logo")) return true;
  if (s.includes("banner")) return true;
  if (s.endsWith("/kr.png")) return true;

  return false;
}

function normalizeImages(product: any, title: string) {
  const rawUrls: string[] = Array.isArray(product?.imageUrls)
    ? product.imageUrls.filter((u: any) => typeof u === "string" && u.trim())
    : [];

  const assetUrls: string[] = Array.isArray(product?.images)
    ? product.images
        .map((im: any) => im?.asset?.url)
        .filter((u: any) => typeof u === "string" && u.trim())
    : [];

  const merged = [...rawUrls, ...assetUrls];
  const seen = new Set<string>();

  return merged
    .map((u) => String(u).trim())
    .filter((u) => u && !isGalleryNoiseUrl(u))
    .filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    })
    .map((u) => ({ url: u, alt: title }));
}

function HeroBanner({ brandTitle }: { brandTitle: string }) {
  return (
    <section className="relative overflow-hidden">
      <div className="relative h-[220px] w-full md:h-[280px]">
        <Image src="/hero.png" alt="Products hero" fill priority className="object-cover" />
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/55 via-slate-900/20 to-transparent" />

        <div className="absolute inset-0">
          <div className="mx-auto flex h-full max-w-6xl items-center px-6">
            <div>
              <div className="text-xs font-semibold tracking-[0.2em] text-white/80">ITS BIO</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                {cleanText(brandTitle)} Product
              </h1>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function KentProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }> | { slug: string[] };
}) {
  const resolved = await Promise.resolve(params as any);
  const slugArr = Array.isArray(resolved?.slug) ? resolved.slug.filter(Boolean) : [];
  const slug = slugArr.join("/");

  if (!slug) notFound();

  const client = (sanityClient as any).withConfig?.({ useCdn: false }) ?? sanityClient;
  const bundle = await client.fetch(ITEM_PAGE_QUERY, {
    brandKey: BRAND_KEY,
    slug,
  });

  const brand = bundle?.brand;
  const product = bundle?.product;

  if (!brand?._id || !product?._id) notFound();

  const title = stripBrandSuffix(product?.title || "");
  const categoryPath: string[] = Array.isArray(product?.categoryPath) ? product.categoryPath : [];
  const categoryPathTitles: string[] = Array.isArray(product?.categoryPathTitles)
    ? product.categoryPathTitles
    : [];

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: cleanText(brand.title), href: `/products/${BRAND_KEY}` },
    ...categoryPath.map((seg: string, i: number) => ({
      label: categoryPathTitles[i] ? stripBrandSuffix(categoryPathTitles[i]) : humanizeSegment(seg),
      href: buildHref(categoryPath.slice(0, i + 1)),
    })),
    { label: title, href: `/products/${BRAND_KEY}/item/${product.slug}` },
  ];

  const images = normalizeImages(product, title);

  const rawSpecs =
    typeof product?.specsHtml === "string" && product.specsHtml.trim() ? product.specsHtml : "";

  const fallbackSpecs = extractSpecsTableFromHtml(
    [typeof product?.extraHtml === "string" ? product.extraHtml : "", typeof product?.legacyHtml === "string" ? product.legacyHtml : ""]
      .filter(Boolean)
      .join("\n"),
  );

  const specsHtml = sanitizeKentHtml(rawSpecs || fallbackSpecs || "");

  const descriptionHtml = sanitizeKentHtml(
    (typeof product?.extraHtml === "string" && product.extraHtml.trim()
      ? product.extraHtml
      : typeof product?.legacyHtml === "string"
        ? product.legacyHtml
        : "") || "",
  );

  const datasheetHtml = sanitizeKentHtml(product?.datasheetHtml || "");
  const documentsHtml = sanitizeKentHtml(product?.documentsHtml || "");
  const faqsHtml = sanitizeKentHtml(product?.faqsHtml || "");
  const referencesHtml = sanitizeKentHtml(product?.referencesHtml || "");
  const reviewsHtml = sanitizeKentHtml(product?.reviewsHtml || "");

  const documents = Array.isArray(product?.docs) ? product.docs : [];

  return (
    <main className="pb-16">
      <HeroBanner brandTitle={brand.title} />

      <div className="mx-auto max-w-6xl px-6">
        <div className="py-6">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <KentProductDetailClient
          title={title}
          summary={product?.summary || ""}
          sku={product?.sku || ""}
          sourceUrl={product?.sourceUrl || ""}
          images={images}
          descriptionHtml={descriptionHtml}
          specsHtml={specsHtml}
          datasheetHtml={datasheetHtml}
          documentsHtml={documentsHtml}
          faqsHtml={faqsHtml}
          referencesHtml={referencesHtml}
          reviewsHtml={reviewsHtml}
          documents={documents}
          productType={product?.productType}
          defaultVariantId={product?.defaultVariantId}
          optionGroups={product?.optionGroups || []}
          variants={product?.variants || []}
        />
      </div>
    </main>
  );
}
