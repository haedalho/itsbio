// app/products/kent/item/[...slug]/page.tsx
import { notFound } from "next/navigation";

import KentProductDetailClient from "@/components/products/KentProductDetailClient";
import Breadcrumb from "@/components/site/Breadcrumb";
import { sanityClient } from "@/lib/sanity/sanity.client";

export const revalidate = 300;

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

    overviewHtml,
    specsHtml,
    extraHtml,
    legacyHtml,
    datasheetHtml,
    documentsHtml,
    faqsHtml,
    referencesHtml,
    reviewsHtml,
    kentSections,

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

function stripHtmlTags(input?: string | null) {
  return cleanText(
    String(input || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&"),
  );
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
  const index = raw.indexOf("|");
  return cleanText(index >= 0 ? raw.slice(0, index) : raw);
}

function humanizeSegment(segment: string) {
  return cleanText(segment).replaceAll("-", " ").replaceAll("_", " ");
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
  return out.replace(/\bPrint\b/gi, "");
}

function decorateKentLinks(html: string) {
  if (!html) return html;
  return html.replace(/<a\s+([^>]*href=["'][^"']+["'][^>]*)>/gi, (_match, attrs) => {
    let nextAttrs = String(attrs || "");
    if (!/\btarget=/i.test(nextAttrs)) nextAttrs += ` target="_blank"`;
    if (!/\brel=/i.test(nextAttrs)) nextAttrs += ` rel="noreferrer"`;
    return `<a ${nextAttrs}>`;
  });
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
  out = out.replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, "");
  out = out.replace(/\shref\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, "");

  out = out.replace(/Login to see prices/gi, "");
  out = out.replace(/Get early access to info, updates, and discounts/gi, "");
  out = out.replace(/Need Help With Your Order\?/gi, "");
  out = out.replace(/Choose an option/gi, "");
  out = out.replace(/\bClear\b/gi, "");

  return decorateKentLinks(out).trim();
}

function sanitizeKentSectionValue(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeKentSectionValue(item, key));
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && /html$/i.test(key)) return sanitizeKentHtml(value);
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
      childKey,
      sanitizeKentSectionValue(childValue, childKey),
    ]),
  );
}

function extractSpecsTableFromHtml(html: string) {
  if (!html) return "";

  const nearSpecs = html.match(/Specifications[\s\S]{0,7000}?(<table[\s\S]*?<\/table>)/i);
  if (nearSpecs?.[1]) return nearSpecs[1];

  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  for (const table of tables) {
    const lower = table.toLowerCase();
    if (
      lower.includes("spec") ||
      lower.includes("specification") ||
      lower.includes("parameter") ||
      lower.includes("catalog")
    ) {
      return table;
    }
  }
  return tables[0] || "";
}

function isGalleryNoiseUrl(url: string) {
  const value = String(url || "").toLowerCase();
  if (!value) return true;
  if (value.includes("request") && value.includes("sample")) return true;
  if (value.includes("request") && value.includes("quote")) return true;
  if (value.includes("intertek")) return true;
  if (value.includes("badge")) return true;
  if (value.includes("icon")) return true;
  if (value.includes("logo")) return true;
  if (value.includes("banner")) return true;
  if (value.endsWith("/kr.png")) return true;
  return false;
}

function imageMasterKey(url: string) {
  return String(url || "")
    .split("?")[0]
    .replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+$)/i, "")
    .toLowerCase();
}

function normalizeImages(product: any, title: string) {
  const rawUrls: string[] = Array.isArray(product?.imageUrls)
    ? product.imageUrls.filter((url: any) => typeof url === "string" && url.trim())
    : [];
  const assetUrls: string[] = Array.isArray(product?.images)
    ? product.images
        .map((image: any) => image?.asset?.url)
        .filter((url: any) => typeof url === "string" && url.trim())
    : [];
  const source = rawUrls.length ? rawUrls : assetUrls;
  const seen = new Set<string>();

  return source
    .map((url) => String(url).trim())
    .filter((url) => url && !isGalleryNoiseUrl(url))
    .filter((url) => {
      const key = imageMasterKey(url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((url) => ({ url, alt: title }));
}

export default async function KentProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }> | { slug: string[] };
}) {
  const resolved = await Promise.resolve(params as any);
  const slugParts = Array.isArray(resolved?.slug) ? resolved.slug.filter(Boolean) : [];
  const slug = slugParts.join("/");
  if (!slug) notFound();

  const client = (sanityClient as any).withConfig?.({ useCdn: false }) ?? sanityClient;
  const bundle = await client.fetch(ITEM_PAGE_QUERY, { brandKey: BRAND_KEY, slug });
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
    ...categoryPath.map((segment: string, index: number) => ({
      label: categoryPathTitles[index] ? stripBrandSuffix(categoryPathTitles[index]) : humanizeSegment(segment),
      href: buildHref(categoryPath.slice(0, index + 1)),
    })),
    { label: title, href: `/products/${BRAND_KEY}/item/${product.slug}` },
  ];

  const images = normalizeImages(product, title);
  const rawDescription =
    (typeof product?.overviewHtml === "string" && product.overviewHtml.trim()
      ? product.overviewHtml
      : typeof product?.extraHtml === "string" && product.extraHtml.trim()
        ? product.extraHtml
        : typeof product?.legacyHtml === "string"
          ? product.legacyHtml
          : "") || "";
  const rawSpecs = typeof product?.specsHtml === "string" && product.specsHtml.trim() ? product.specsHtml : "";
  const fallbackSpecs = rawSpecs ? "" : extractSpecsTableFromHtml(rawDescription);
  const descriptionWithoutFallbackSpecs = fallbackSpecs ? rawDescription.replace(fallbackSpecs, "") : rawDescription;

  const descriptionHtml = sanitizeKentHtml(descriptionWithoutFallbackSpecs);
  const specsHtml = sanitizeKentHtml(rawSpecs || fallbackSpecs);
  const datasheetHtml = sanitizeKentHtml(product?.datasheetHtml || "");
  const documentsHtml = sanitizeKentHtml(product?.documentsHtml || "");
  const faqsHtml = sanitizeKentHtml(product?.faqsHtml || "");
  const referencesHtml = sanitizeKentHtml(product?.referencesHtml || "");
  const reviewsHtml = sanitizeKentHtml(product?.reviewsHtml || "");
  const documents = Array.isArray(product?.docs) ? product.docs : [];
  const kentSections = Array.isArray(product?.kentSections)
    ? (sanitizeKentSectionValue(product.kentSections) as any[])
    : [];

  return (
    <main className="pb-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="py-7">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <KentProductDetailClient
          title={title}
          summary={product?.summary || stripHtmlTags(descriptionHtml).slice(0, 220)}
          sku={product?.sku || ""}
          images={images}
          kentSections={kentSections}
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
