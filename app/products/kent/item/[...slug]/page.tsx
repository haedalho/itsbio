import { notFound } from "next/navigation";

import KentProductDetailClient from "@/components/products/KentProductDetailClient";
import Breadcrumb from "@/components/site/Breadcrumb";
import { getKentOfficialProductOverride } from "@/lib/kent/official-product-overrides";
import {
  deriveKentSourceContent,
  sanitizeKentSections,
  sanitizeKentSourceHtml,
} from "@/lib/kent/source-content";
import { sanityClient } from "@/lib/sanity/sanity.client";

export const revalidate = 300;

const BRAND_KEY = "kent";
const PRODUCT_DOC_TYPE =
  process.env.VERCEL_ENV === "preview" && String(process.env.VERCEL_GIT_COMMIT_REF || "").startsWith("agent/kent")
    ? "kentPreviewProduct"
    : "product";

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
    _type == $productType
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
    sourceProductId,
    sourceUrl,
    categoryPath,
    categoryPathTitles,

    sourceIntroHtml,
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
    galleryImageUrls,
    imageUrls,
    imageFiles,
    images[]{ _key, asset->{ url } },
    kentOfficialGalleryStatus,
    kentOfficialGallery[]{
      _key,
      sourceUrl,
      alt,
      order,
      sourceWidth,
      sourceHeight,
      sourceFingerprint
    },
    kentOfficialSourceUrl,
    kentOfficialGalleryVerifiedAt,
    kentOfficialGalleryFingerprint
  },

  "relatedProductPool": *[
    _type == $productType
    && (!defined(isActive) || isActive == true)
    && (
      brand->slug.current == $brandKey
      || brand->themeKey == $brandKey
      || brandSlug == $brandKey
    )
  ]{
    title,
    summary,
    "slug": slug.current,
    "imageUrl": images[0].asset->url
  }
}
`;

type Section = Record<string, any>;

type DerivedCandidate = {
  sourceIndex: number;
  raw: string;
  leadHtml: string;
  remainderHtml: string;
  sections: Section[];
  score: number;
};

function buildHref(path: string[]) {
  return path.length ? `/products/${BRAND_KEY}/${path.join("/")}` : `/products/${BRAND_KEY}`;
}

function cleanText(input?: unknown) {
  return String(input || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function signature(input?: unknown) {
  return cleanText(input)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function kentProductSlugFromUrl(input?: unknown) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  try {
    const pathname = new URL(raw, "https://www.kentscientific.com").pathname;
    return pathname.match(/\/products\/([^/]+)/i)?.[1] || "";
  } catch {
    return "";
  }
}

function hydrateRelatedProductSections(sections: Section[], pool: any[]) {
  const bySlug = new Map(
    (Array.isArray(pool) ? pool : [])
      .filter((product) => product?.slug)
      .map((product) => [String(product.slug).toLowerCase(), product]),
  );

  return sections.map((section) => {
    const type = String(section?.type || section?.kind || section?._type || "").toLowerCase();
    if (!/related-product|customers-who-viewed|you-may-also/.test(type)) return section;
    return {
      ...section,
      items: (Array.isArray(section.items) ? section.items : []).flatMap((item: any) => {
        const slug = kentProductSlugFromUrl(item?.href || item?.url).toLowerCase();
        const product = bySlug.get(slug);
        if (!slug || !product?.imageUrl || !isManagedKentImageUrl(product.imageUrl)) return [];
        return [{
          ...item,
          title: cleanText(item?.title || item?.label) || cleanText(product.title),
          description: cleanText(product.summary),
          slug,
          href: `/products/kent/item/${slug}`,
          imageUrl: String(product.imageUrl),
        }];
      }),
    };
  });
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

function htmlValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "";
}

function isWarrantyLikeTable(html: string) {
  const text = cleanText(html).toLowerCase();
  const planColumns = /\bstandard\b[\s\S]{0,220}\bextended\b[\s\S]{0,220}\bpremium\b/.test(text);
  const warrantyTerms = /(coverage period|loaner equipment|expedited repairs|warranty repairs|onsite installation|parts\s*&\s*labor)/.test(text);
  return planColumns && warrantyTerms;
}

function isContaminatedSpecsHtml(html: string) {
  const text = cleanText(html).toLowerCase();
  const raw = String(html || "").toLowerCase();
  if (!text && !raw) return true;
  if (raw.includes("single_variation_wrap")) return true;
  if (raw.includes("display:none") || raw.includes("!important")) return true;
  if (/\bvariant\b[\s\S]{0,150}\bsku\b[\s\S]{0,150}\boption\b[\s\S]{0,150}\bprice\b/i.test(text)) return true;
  return isWarrantyLikeTable(html);
}

function isGalleryNoiseUrl(url: string) {
  const value = String(url || "").toLowerCase();
  return !value || /(request.*(?:sample|quote)|intertek|badge|icon|logo|banner|testimonial|avatar|profile|publication|book|faq)/i.test(value) || value.endsWith("/kr.png");
}

function imageMasterKey(url: string) {
  return String(url || "")
    .split("?")[0]
    .replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+$)/i, "")
    .toLowerCase();
}

function isManagedKentImageUrl(input?: unknown) {
  const value = String(input || "").trim();
  if (!value) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "cdn.sanity.io";
  } catch {
    return false;
  }
}

function normalizeImages(product: any, title: string) {
  // Active product galleries may only use files uploaded to Sanity. Legacy
  // imageUrls/galleryImageUrls remain source metadata and never render.
  const source = Array.isArray(product?.images)
    ? product.images
        .map((image: any) => image?.asset?.url)
        .filter((url: any) => isManagedKentImageUrl(url))
    : [];
  const seen = new Set<string>();
  return source
    .map((url: unknown) => String(url).trim())
    .filter((url: string) => url && !isGalleryNoiseUrl(url))
    .filter((url: string) => {
      const key = imageMasterKey(url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((url: string) => ({ url, alt: title }));
}

function sectionBody(section: Section) {
  return [
    section.html,
    section.contentHtml,
    section.bodyHtml,
    section.description,
    JSON.stringify(section.items || []),
    JSON.stringify(section.rows || []),
  ].join(" ");
}

function mergeSections(groups: Section[][]) {
  const output: Section[] = [];
  const seenBodies = new Set<string>();
  const seenTitleBodies = new Set<string>();

  for (const group of groups) {
    for (const raw of sanitizeKentSections(group) as Section[]) {
      const titleKey = signature(raw.title || raw.type || raw.kind || raw._type);
      const bodyKey = signature(sectionBody(raw));
      if (!titleKey && !bodyKey) continue;
      const titleBodyKey = `${titleKey}|${bodyKey.slice(0, 600)}`;
      if ((bodyKey && seenBodies.has(bodyKey)) || seenTitleBodies.has(titleBodyKey)) continue;
      if (bodyKey) seenBodies.add(bodyKey);
      seenTitleBodies.add(titleBodyKey);
      output.push(raw);
    }
  }

  return output;
}

function deriveCandidates(product: any): DerivedCandidate[] {
  const sources = [
    htmlValue(product?.sourceIntroHtml),
    htmlValue(product?.overviewHtml),
    htmlValue(product?.extraHtml),
    htmlValue(product?.legacyHtml),
  ];

  return sources.flatMap((raw, sourceIndex) => {
    if (!raw) return [];
    const derived = deriveKentSourceContent(raw);
    const textLength = cleanText(raw).length;
    const score = derived.sections.length * 1200 + cleanText(derived.remainderHtml).length * 0.4 + Math.min(textLength, 5000) + (sourceIndex === 0 ? 700 : 0);
    return [{ sourceIndex, raw, ...derived, sections: derived.sections as Section[], score }];
  });
}

function bestLead(candidates: DerivedCandidate[]) {
  const preferred = candidates.find((candidate) => candidate.sourceIndex === 0 && cleanText(candidate.leadHtml).length >= 40);
  if (preferred) return sanitizeKentSourceHtml(preferred.leadHtml);
  return candidates
    .map((candidate) => sanitizeKentSourceHtml(candidate.leadHtml))
    .filter((html) => cleanText(html).length >= 40)
    .sort((a, b) => cleanText(b).length - cleanText(a).length)[0] || "";
}

function supplementalSections(product: any, title: string) {
  const sections: Section[] = [];
  const add = (type: string, sectionTitle: string, html: unknown, items?: any[]) => {
    const cleaned = sanitizeKentSourceHtml(html);
    if (!cleanText(cleaned) && !(items || []).length) return;
    sections.push({ _key: `kent-${type}-${signature(sectionTitle).replace(/\s+/g, "-")}`, type, title: sectionTitle, html: cleaned, items });
  };

  const specs = htmlValue(product?.specsHtml);
  if (specs && !isContaminatedSpecsHtml(specs)) add("spec-table", "Specifications", specs);
  add("datasheet", "Datasheet", product?.datasheetHtml);
  add("faqs", "FAQs", product?.faqsHtml);
  add("publications", "Scientific publications", product?.referencesHtml);
  add("reviews", "Reviews", product?.reviewsHtml);

  return sections;
}

function universalProductContent(product: any, title: string) {
  const candidates = deriveCandidates(product).sort((a, b) => b.score - a.score);
  const primary = candidates[0];
  const explicit = sanitizeKentSections(product?.kentSections) as Section[];
  const primarySections = primary?.sections || [];
  const secondarySections = candidates.slice(1).flatMap((candidate) => candidate.sections);
  const supplementals = supplementalSections(product, title);

  const aboutHtml = sanitizeKentSourceHtml(primary?.remainderHtml || "");
  const aboutSection = cleanText(aboutHtml).length >= 40
    ? [{ _key: "kent-derived-overview", type: "rich-text", title: `About ${title}`, html: aboutHtml }]
    : [];

  return {
    leadHtml: bestLead(candidates),
    sections: mergeSections([primarySections, explicit, secondarySections, aboutSection, supplementals]),
  };
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

  const client = (sanityClient as any).withConfig?.({ useCdn: true }) ?? sanityClient;
  const bundle = await client.fetch(ITEM_PAGE_QUERY, {
    brandKey: BRAND_KEY,
    productType: PRODUCT_DOC_TYPE,
    slug,
  });
  const brand = bundle?.brand;
  const product = bundle?.product;
  if (!brand?._id || !product?._id) notFound();

  const official = product?.sourceProductId ? null : getKentOfficialProductOverride(slug);
  const title = official?.title || stripBrandSuffix(product?.title || "");
  const categoryPath: string[] = Array.isArray(product?.categoryPath) ? product.categoryPath : [];
  const categoryPathTitles: string[] = Array.isArray(product?.categoryPathTitles) ? product.categoryPathTitles : [];
  const categoryLabel = stripBrandSuffix(categoryPathTitles.at(-1) || humanizeSegment(categoryPath.at(-1) || ""));

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

  const universal = universalProductContent(product, title);
  const leadHtml = official?.leadHtml || universal.leadHtml;
  const kentSections = hydrateRelatedProductSections(
    sanitizeKentSections(official?.sections || universal.sections) as Section[],
    bundle?.relatedProductPool,
  );
  const galleryStatus = String(product?.kentOfficialGalleryStatus || "");
  const stagedOfficialImages = ["STAGING", "APPROVED"].includes(galleryStatus)
    ? (Array.isArray(product?.kentOfficialGallery) ? product.kentOfficialGallery : [])
        .filter((image: any) => isManagedKentImageUrl(image?.sourceUrl))
        .sort((a: any, b: any) => Number(a?.order || 0) - Number(b?.order || 0))
        .map((image: any) => ({ url: String(image.sourceUrl).trim(), alt: cleanText(image.alt) || title }))
    : [];
  const overrideOfficialImages = Array.isArray(official?.fallbackImages)
    ? official.fallbackImages.filter((image) => isManagedKentImageUrl(image?.url))
    : [];
  const activeProductImages = normalizeImages(product, title);
  const approvedActiveImages = galleryStatus === "APPROVED" && !stagedOfficialImages.length
    ? activeProductImages
    : [];
  const officialImages = stagedOfficialImages.length
    ? stagedOfficialImages
    : overrideOfficialImages.length
      ? overrideOfficialImages
      : approvedActiveImages;
  const images = officialImages.length ? officialImages : activeProductImages.slice(0, 1);
  const verifiedGallery = officialImages.length > 0;

  return (
    <main className="pb-16">
      <div className="mx-auto max-w-[1410px] px-6">
        <div className="py-7">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <KentProductDetailClient
          slug={product.slug}
          title={title}
          summary={official ? official.summary : cleanText(product?.summary)}
          sku={official ? official.sku : product?.sku || ""}
          badge={official?.badge}
          leadHtml={leadHtml}
          categoryLabel={categoryLabel}
          images={images}
          verifiedGallery={verifiedGallery}
          kentSections={kentSections as any[]}
          descriptionHtml=""
          specsHtml=""
          datasheetHtml=""
          documentsHtml=""
          faqsHtml=""
          referencesHtml=""
          reviewsHtml=""
          documents={[]}
          productType={official ? official.productType || "simple" : product?.productType}
          defaultVariantId={official ? official.defaultVariantId : product?.defaultVariantId}
          optionGroups={official ? official.optionGroups || [] : product?.optionGroups || []}
          variants={official ? official.variants || [] : product?.variants || []}
        />
      </div>
    </main>
  );
}
