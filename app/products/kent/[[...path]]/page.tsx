// app/products/kent/[[...path]]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as React from "react";

import Breadcrumb from "@/components/site/Breadcrumb";
import HtmlContent from "@/components/site/HtmlContent";
import { sanityClient } from "@/lib/sanity/sanity.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const BRAND_KEY = "kent";
const BRAND_BASE = "https://www.kentscientific.com";
const KENT_MENU_TITLE = "General Lab Equipment";

const PAGE_SHELL = "mx-auto max-w-[1320px] px-6";
const CONTENT_LAYOUT =
  "grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]";

type Theme = {
  accentBg: string;
  accentText: string;
  accentBorder: string;
  accentSoftBg: string;
  accentActiveBg: string;
  accentActiveText: string;
  accentDotBg: string;
  accentDotBorder: string;
  accentUnderline: string;
};

const THEME_KENT: Theme = {
  accentBg: "bg-blue-600",
  accentText: "text-blue-700",
  accentBorder: "border-blue-200",
  accentSoftBg: "bg-blue-50",
  accentActiveBg: "bg-blue-50",
  accentActiveText: "text-blue-800",
  accentDotBg: "bg-blue-600",
  accentDotBorder: "border-blue-200",
  accentUnderline: "text-blue-700",
};

type PageType = "landing" | "listing";

type CardItem = {
  _key?: string;
  title?: string;
  subtitle?: string;
  href?: string;
  imageUrl?: string;
  count?: number;
  badge?: string;
  sku?: string;
};

type ContentBlock = {
  _key?: string;
  _type?: string;
  title?: string;
  html?: string;
  kind?: string;
  items?: CardItem[];
};

type ProductLite = {
  _id: string;
  title: string;
  sku?: string;
  slug: string;
  thumb?: string;
  sourceUrl?: string;
};

type CategoryDoc = {
  _id: string;
  title: string;
  path: string[];
  order?: number;
  sourceUrl?: string;
  summary?: string;
  legacyHtml?: string;
  pageType?: string;
  contentBlocks?: ContentBlock[];
};

type StaticMenuNode = {
  title: string;
  path: string[];
  children?: StaticMenuNode[];
};

type CardsKind = "product" | "category" | "resource" | "publication";

const PAGE_QUERY = `
{
  "brand": *[
    _type=="brand"
    && (themeKey==$brandKey || slug.current==$brandKey)
  ][0]{
    _id, title, themeKey, "slug": slug.current
  },

  "category": select(
    $hasPath => *[
      _type=="category"
      && (!defined(isActive) || isActive==true)
      && (
        brand->themeKey==$brandKey
        || brand->slug.current==$brandKey
        || themeKey==$brandKey
        || brandSlug==$brandKey
      )
      && array::join(path, "/")==$pathStr
    ][0]{
      _id,
      title,
      path,
      order,
      sourceUrl,
      summary,
      legacyHtml,
      pageType,
      contentBlocks[] {
        _key,
        _type,
        title,
        html,
        kind,
        items[]{
          _key,
          title,
          subtitle,
          href,
          imageUrl,
          count,
          badge,
          sku
        }
      }
    },
    null
  ),

  "products": select(
    $hasPath => *[
      _type=="product"
      && (!defined(isActive) || isActive==true)
      && (
        brandSlug==$brandKey
        || brand->slug.current==$brandKey
        || brand->themeKey==$brandKey
      )
      && defined(categoryPath)
      && categoryPath == $pathArr
    ] | order(title asc) {
      _id,
      title,
      sku,
      "slug": slug.current,
      "thumb": coalesce(imageUrls[0], images[0].asset->url, ""),
      sourceUrl
    },
    []
  )
}
`;

const KENT_STATIC_MENU: StaticMenuNode[] = [
  {
    title: "Anesthesia",
    path: ["anesthesia"],
    children: [
      { title: "Anesthesia Accessories", path: ["anesthesia", "anesthesia-accessories"] },
      {
        title: "Anesthesia Accessories for SomnoFlo®",
        path: ["anesthesia", "anesthesia-accessories", "anesthesia-accessories-for-somnoflo"],
      },
      {
        title: "Anesthesia Accessories for SomnoSuite®",
        path: ["anesthesia", "anesthesia-accessories", "anesthesia-accessories-for-somnosuite"],
      },
      {
        title: "Anesthesia Accessories for VetFlo™",
        path: ["anesthesia", "anesthesia-accessories", "anesthesia-accessories-for-vetflo"],
      },
    ],
  },
  {
    title: "Animal Handling",
    path: ["laboratory-animal-handling"],
    children: [
      { title: "Animal Holders", path: ["laboratory-animal-handling", "animal-holders"] },
      { title: "Clippers", path: ["laboratory-animal-handling", "clippers"] },
      { title: "Scales", path: ["laboratory-animal-handling", "scales"] },
    ],
  },
  { title: "Body Composition Analysis", path: ["body-composition-analysis"] },
  { title: "Feeding Needles", path: ["feeding-needles"] },
  { title: "Mobile Carts", path: ["mobile-carts"] },
  { title: "Nebulizer", path: ["nebulizers"] },
  {
    title: "Non-invasive Blood Pressure",
    path: ["noninvasive-blood-pressure"],
    children: [
      {
        title: "Accessories for CODA® Monitor",
        path: ["noninvasive-blood-pressure", "accessories-for-coda-monitor"],
      },
      { title: "CODA® Cuffs", path: ["noninvasive-blood-pressure", "coda-cuffs"] },
      {
        title: "Non-Invasive Blood Pressure Accessories",
        path: ["noninvasive-blood-pressure", "non-invasive-blood-pressure-accessories"],
      },
    ],
  },
  {
    title: "Physiological Monitoring",
    path: ["physiological-monitoring"],
    children: [
      { title: "Temperature", path: ["physiological-monitoring", "temperature"] },
      {
        title: "Physiological Monitoring Accessories",
        path: ["physiological-monitoring", "physiological-monitoring-accessories"],
      },
    ],
  },
  {
    title: "Rodent Identification",
    path: ["rodent-identification"],
    children: [
      { title: "RFID Transponder System", path: ["rodent-identification", "rfid-transponder-system"] },
      { title: "Ear Tags", path: ["rodent-identification", "ear-tags"] },
    ],
  },
  {
    title: "Surgery",
    path: ["surgery"],
    children: [
      { title: "Surgical Instruments", path: ["surgery", "surgical-instruments"] },
      { title: "Surgical Instrument Kits", path: ["surgery", "surgical-instrument-kits"] },
      { title: "Surgical Accessories", path: ["surgery", "surgical-accessories"] },
      { title: "Instrument Cleaning", path: ["surgery", "instrument-cleaning"] },
    ],
  },
  { title: "Tail Vein Training Devices", path: ["tail-vein-training-materials"] },
  {
    title: "Tissue Collection",
    path: ["tissue-collection"],
    children: [
      { title: "Brain Matricies", path: ["tissue-collection", "brain-matricies"] },
      { title: "Blood Collection", path: ["tissue-collection", "blood-collection"] },
    ],
  },
  {
    title: "Ventilation",
    path: ["ventilation"],
    children: [{ title: "Intubation", path: ["ventilation", "intubation"] }],
  },
  {
    title: "Warming",
    path: ["warming"],
    children: [
      { title: "Water Recirculators", path: ["warming", "water-recirculators"] },
      { title: "Warming Pads and Blankets", path: ["warming", "warming-pads-and-blankets"] },
    ],
  },
  { title: "Warranties", path: ["warranty"] },
];

function flattenMenu(nodes: StaticMenuNode[]): StaticMenuNode[] {
  const out: StaticMenuNode[] = [];
  for (const node of nodes) {
    out.push(node);
    if (node.children?.length) out.push(...flattenMenu(node.children));
  }
  return out;
}

const STATIC_LABEL_BY_PATH = new Map(
  flattenMenu(KENT_STATIC_MENU).map((node) => [node.path.join("/"), node.title]),
);

const LANDING_FALLBACK_PATHS = new Set(["anesthesia"]);

function buildCategoryHref(path: string[]) {
  return path.length ? `/products/${BRAND_KEY}/${path.join("/")}` : `/products/${BRAND_KEY}`;
}

function sanitizeKentItemSlug(input: string) {
  let s = String(input || "").trim();
  if (!s) return "";

  s = s.replace(/^https?:\/\/[^/]+/i, "");
  s = s.replace(/^\/+/, "");
  s = s.replace(/^products\/kent\/item\//i, "");
  s = s.replace(/^kent\/item\//i, "");
  s = s.replace(/^item\//i, "");

  const match = s.match(/(?:^|\/)item\/(.+)$/i);
  if (match?.[1]) s = match[1];

  return s.replace(/^\/+|\/+$/g, "");
}

function buildProductHref(slug: string) {
  const clean = sanitizeKentItemSlug(slug);
  return clean ? `/products/${BRAND_KEY}/item/${clean}` : "#";
}

function legacyHref(url: string) {
  return `/products/${BRAND_KEY}/legacy?u=${encodeURIComponent(url)}`;
}

function toAbs(url: string) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${BRAND_BASE}${url}`;
  return url;
}

function normalizeUrl(url: string) {
  const abs = toAbs(url).trim();
  if (!abs) return "";
  return abs.replace(/#.*$/, "");
}

function isKentCategoryUrl(url: string) {
  return normalizeUrl(url).startsWith(`${BRAND_BASE}/product/`);
}

function isKentProductUrl(url: string) {
  return normalizeUrl(url).startsWith(`${BRAND_BASE}/products/`);
}

function kentCategoryPathFromUrl(url: string) {
  const abs = normalizeUrl(url);
  if (!isKentCategoryUrl(abs)) return [];
  return abs
    .replace(`${BRAND_BASE}/product/`, "")
    .replace(/\/$/, "")
    .split("/")
    .map((seg) => seg.trim())
    .filter(Boolean);
}

function kentProductSlugFromUrl(url: string) {
  const abs = normalizeUrl(url);
  if (!isKentProductUrl(abs)) return "";
  return sanitizeKentItemSlug(abs.replace(`${BRAND_BASE}/products/`, "").replace(/\/$/, "").trim());
}

function humanizeSegment(seg: string) {
  return (seg || "").replaceAll("-", " ").replaceAll("_", " ").trim();
}

function decodeHtmlEntities(input: string) {
  if (!input) return "";
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&nbsp;", " ");
}

function stripBrandSuffix(title: string) {
  const raw = decodeHtmlEntities((title || "").trim());
  const idx = raw.indexOf("|");
  return (idx >= 0 ? raw.slice(0, idx) : raw).trim();
}

function looksLikeSlugTitle(title: string) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test((title || "").trim());
}

function titleCaseFromSlug(seg: string) {
  return humanizeSegment(seg).replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function normalizeTitle(title: string, fallbackSeg = "") {
  const clean = stripBrandSuffix(title || "");
  if (!clean) return titleCaseFromSlug(fallbackSeg);
  if (looksLikeSlugTitle(clean)) return titleCaseFromSlug(clean);
  return clean;
}

function stripKentPromoHtml(html: string) {
  let out = String(html || "");
  const phrases = [
    "login to see prices",
    "get early access to info, updates, and discounts",
  ];

  const tags = ["section", "div", "p", "li", "span", "aside", "article"];

  for (const phrase of phrases) {
    for (const tag of tags) {
      const re = new RegExp(
        `<${tag}[^>]*>[\\s\\S]{0,1500}?${phrase}[\\s\\S]{0,1500}?<\\/${tag}>`,
        "gi",
      );
      out = out.replace(re, "");
    }

    const textRe = new RegExp(phrase, "gi");
    out = out.replace(textRe, "");
  }

  return out;
}

function rewriteRelativeUrls(html: string, baseUrl: string) {
  if (!html) return "";
  if (!baseUrl) return html;

  let out = html.replace(/\s(href|src)=["'](\/(?!\/)[^"']*)["']/gi, (_m, attr, p) => {
    return ` ${attr}="${baseUrl}${p}"`;
  });

  out = out.replace(/\s(href|src)=["'](\/\/[^"']+)["']/gi, (_m, attr, p2) => {
    return ` ${attr}="https:${p2}"`;
  });

  return out;
}

function resolveKentHref(href: string) {
  const raw = String(href || "").trim();
  if (!raw) return "#";

  if (/^\/?products\/kent\/item\//i.test(raw) || /^\/?kent\/item\//i.test(raw) || /^\/?item\//i.test(raw)) {
    return buildProductHref(raw);
  }

  if (/\/item\//i.test(raw) && !/^https?:\/\//i.test(raw)) {
    return buildProductHref(raw);
  }

  if (/^\/?products\/kent\/legacy/i.test(raw)) {
    return raw.startsWith("/") ? raw : `/${raw}`;
  }

  if (/^\/?products\/kent\//i.test(raw) && !/\/item\//i.test(raw)) {
    return raw.startsWith("/") ? raw : `/${raw}`;
  }

  const abs = normalizeUrl(raw);
  if (!abs) return "#";

  if (isKentProductUrl(abs)) {
    const slug = kentProductSlugFromUrl(abs);
    return buildProductHref(slug);
  }

  if (isKentCategoryUrl(abs)) {
    const path = kentCategoryPathFromUrl(abs);
    return path.length ? buildCategoryHref(path) : legacyHref(abs);
  }

  return legacyHref(abs);
}

function rewriteAnchorsToInternalAware(html: string) {
  if (!html) return "";
  return html.replace(/\shref=["']([^"']+)["']/gi, (_m, url) => ` href="${resolveKentHref(url)}"`);
}

function safeHtmlForRender(html: string) {
  let out = html || "";
  out = stripKentPromoHtml(out);
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = rewriteRelativeUrls(out, BRAND_BASE);
  out = rewriteAnchorsToInternalAware(out);
  return out.trim();
}

function roughTextLenFromHtml(html: string) {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

function normalizeInlineText(input: string) {
  return decodeHtmlEntities((input || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).toLowerCase();
}

function normalizePathSegments(path: string[]) {
  return Array.isArray(path)
    ? path.map((seg) => String(seg || "").trim().replace(/^\/+|\/+$/g, "")).filter(Boolean)
    : [];
}

function dedupeLandingItems(items: CardItem[]) {
  const seen = new Set<string>();
  const out: CardItem[] = [];

  for (const item of items) {
    const href = resolveKentHref(String(item?.href || "").trim());
    const title = normalizeInlineText(String(item?.title || ""));
    const imageUrl = String(item?.imageUrl || "").trim();
    const key = [href, title, imageUrl].join("|");
    if (!href || !title || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...item, href });
  }

  return out;
}

function dedupeLandingBlocks(blocks: ContentBlock[]) {
  const seen = new Set<string>();
  const out: ContentBlock[] = [];

  for (const block of blocks) {
    if (block?._type === "contentBlockHtml") {
      const title = normalizeInlineText(String(block?.title || ""));
      const html = normalizeInlineText(String(block?.html || ""));
      const key = `html|${title}|${html}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(block);
      continue;
    }

    if (block?._type === "contentBlockCards") {
      const items = dedupeLandingItems(Array.isArray(block?.items) ? block.items : []);
      if (!items.length) continue;

      const key = `cards|${normalizeInlineText(String(block?.title || ""))}|${String(block?.kind || "")}|${items
        .map((it) => `${String(it?.href || "").trim()}|${normalizeInlineText(String(it?.title || ""))}`)
        .join("||")}`;

      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...block, items });
      continue;
    }

    out.push(block);
  }

  return out;
}

function mergeLandingBlocks(blocks: ContentBlock[]) {
  const deduped = dedupeLandingBlocks(blocks);
  const out: ContentBlock[] = [];

  for (const block of deduped) {
    if (!out.length) {
      out.push(block);
      continue;
    }

    const prev = out[out.length - 1];
    const sameTitle =
      normalizeInlineText(String(prev?.title || "")) === normalizeInlineText(String(block?.title || ""));

    if (
      prev?._type === "contentBlockCards" &&
      block?._type === "contentBlockCards" &&
      sameTitle &&
      String(prev.kind || "") === String(block.kind || "")
    ) {
      out[out.length - 1] = {
        ...prev,
        items: dedupeLandingItems([...(prev.items || []), ...(block.items || [])]),
      };
      continue;
    }

    if (prev?._type === "contentBlockHtml" && block?._type === "contentBlockHtml" && sameTitle) {
      const prevHtml = String(prev.html || "").trim();
      const nextHtml = String(block.html || "").trim();
      const prevNorm = normalizeInlineText(prevHtml);
      const nextNorm = normalizeInlineText(nextHtml);

      if (!nextNorm) continue;
      if (!prevNorm) {
        out[out.length - 1] = block;
        continue;
      }
      if (prevNorm === nextNorm || prevNorm.includes(nextNorm)) continue;
      if (nextNorm.includes(prevNorm)) {
        out[out.length - 1] = block;
        continue;
      }
    }

    out.push(block);
  }

  return out;
}

function isKentProductHrefLike(href: string) {
  const v = String(href || "").trim();
  return v.startsWith(`/products/${BRAND_KEY}/item/`) || isKentProductUrl(v);
}

function isKentCategoryHrefLike(href: string) {
  const v = String(href || "").trim();
  return v.startsWith(`/products/${BRAND_KEY}/`) && !v.includes("/item/") && !v.includes("/legacy")
    ? true
    : isKentCategoryUrl(v);
}

function isResourceishText(input: string) {
  const t = normalizeInlineText(input || "");
  return (
    t.includes("resource") ||
    t.includes("white paper") ||
    t.includes("whitepaper") ||
    t.includes("user guide") ||
    t.includes("brochure") ||
    t.includes("application note") ||
    t.includes("publication") ||
    t.includes("manual") ||
    t.includes("pdf") ||
    t.includes("webinar") ||
    t.includes("guide")
  );
}

function looksPromoNoise(input: string) {
  const t = normalizeInlineText(input || "");
  return (
    t.includes("login to see prices") ||
    t.includes("get your accessories") ||
    t.includes("get early access") ||
    t.includes("updates and discounts") ||
    t.includes("don't miss") ||
    t.includes("dont miss") ||
    t.includes("early access") ||
    t.includes("newsletter")
  );
}

function normalizeBlocksForKentView(blocks: ContentBlock[]) {
  const merged = mergeLandingBlocks(Array.isArray(blocks) ? blocks : []);
  const out: ContentBlock[] = [];

  for (const block of merged) {
    if (block?._type !== "contentBlockCards") {
      out.push(block);
      continue;
    }

    const kind = String(block.kind || "") as CardsKind;
    let items = dedupeLandingItems(Array.isArray(block.items) ? block.items : []).filter((item) => {
      const joined = `${String(item?.title || "")} ${String(item?.subtitle || "")}`;
      return !looksPromoNoise(joined);
    });

    if (!items.length) continue;

    if (kind === "resource") {
      items = items.filter((item) => {
        const joined = `${String(item?.title || "")} ${String(item?.subtitle || "")}`;
        if (isResourceishText(joined)) return true;
        return !isKentProductHrefLike(String(item?.href || ""));
      });
      if (!items.length) continue;
    }

    if (kind === "publication") {
      items = items.filter((item) => {
        const joined = `${String(item?.title || "")} ${String(item?.subtitle || "")}`;
        if (looksPromoNoise(joined)) return false;
        return !isKentCategoryHrefLike(String(item?.href || ""));
      });
      if (!items.length) continue;
    }

    out.push({ ...block, items });
  }

  return out;
}

function dedupeProducts(products: ProductLite[]) {
  const out: ProductLite[] = [];
  const seen = new Set<string>();

  for (const product of products || []) {
    const key = String(product?.slug || product?._id || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(product);
  }

  return out;
}

function resolvePageType(category: CategoryDoc | null, pathStr: string): PageType {
  const raw = String(category?.pageType || "").trim().toLowerCase();
  if (raw === "landing" || raw === "listing") return raw as PageType;
  return LANDING_FALLBACK_PATHS.has(pathStr) ? "landing" : "listing";
}

function getFirstHtmlBlock(blocks: ContentBlock[]) {
  return (
    (Array.isArray(blocks) ? blocks : []).find(
      (block) =>
        block?._type === "contentBlockHtml" &&
        roughTextLenFromHtml(safeHtmlForRender(String(block.html || ""))) >= 20,
    ) || null
  );
}

function getListingTailBlocks(blocks: ContentBlock[]) {
  return (Array.isArray(blocks) ? blocks : []).filter((block) => {
    if (block?._type !== "contentBlockCards") return false;
    const kind = String(block.kind || "");
    return kind === "resource" || kind === "publication";
  });
}

function isPrefix(prefix: string[], target: string[]) {
  if (prefix.length > target.length) return false;
  return prefix.every((seg, idx) => seg === target[idx]);
}

function ListingIntro({
  html,
  summary,
}: {
  html?: string;
  summary?: string;
}) {
  const safe = safeHtmlForRender(String(html || ""));

  if (roughTextLenFromHtml(safe) >= 20) {
    return (
      <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <ArticleHtml html={safe} />
      </section>
    );
  }

  if (summary?.trim()) {
    return (
      <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-[15px] leading-8 text-slate-700">{summary}</p>
      </section>
    );
  }

  return null;
}

function ListingHeader({
  count,
  theme,
}: {
  count: number;
  theme: Theme;
}) {
  return (
    <section className="mt-8 rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Products</div>
          <div className="mt-1 text-sm text-slate-600">
            {count > 0 ? `${count} product${count > 1 ? "s" : ""}` : "No products found"}
          </div>
        </div>

        <div
          className={[
            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
            theme.accentBorder,
            theme.accentSoftBg,
            theme.accentText,
          ].join(" ")}
        >
          Kent Scientific
        </div>
      </div>
    </section>
  );
}

function KentProductGrid({
  products,
  theme,
}: {
  products: ProductLite[];
  theme: Theme;
}) {
  const items = dedupeProducts(products);
  if (!items.length) return null;

  return (
    <section className="mt-5">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((product) => (
          <Link
            key={product._id}
            href={buildProductHref(product.slug)}
            prefetch={false}
            className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="relative aspect-[4/3] border-b border-slate-100 bg-white">
              {product.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toAbs(product.thumb)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-contain p-6"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 bg-slate-50" />
              )}
            </div>

            <div className="px-5 py-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {product.sku ? `Cat.No ${product.sku}` : "Kent Scientific"}
              </div>

              <div className="mt-2 min-h-[56px] text-[20px] font-semibold leading-snug tracking-tight text-slate-900 group-hover:text-blue-700">
                {stripBrandSuffix(product.title)}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <span className={`inline-flex items-center gap-2 text-sm font-semibold ${theme.accentText}`}>
                  View Product <span aria-hidden>›</span>
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HeroBanner({ brandTitle }: { brandTitle: string }) {
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
                {brandTitle} Product
              </h1>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function KentSideNav({
  activePath,
  theme,
}: {
  activePath: string[];
  theme: Theme;
}) {
  const activeRoot = activePath[0] || "";
  const activeRootNode = KENT_STATIC_MENU.find((node) => node.path[0] === activeRoot) || null;
  const activeRootTree = activeRootNode?.children || [];

  const LINE_LEFT = "left-[18px]";
  const DOT_LEFT = "left-[18px]";
  const ARROW_LEFT = "left-[28px]";
  const TEXT_OFFSET = "ml-[34px]";

  function renderChildren(nodes: StaticMenuNode[], depth = 1): React.ReactNode {
    if (!nodes?.length) return null;

    return (
      <div className={depth === 1 ? "mt-1" : "mt-1"}>
        <div className="relative">
          <div className={`pointer-events-none absolute ${LINE_LEFT} top-0 h-full border-l border-dashed border-neutral-400`} />
          <div className="space-y-1">
            {nodes.map((node) => {
              const p = node.path.join("/");
              const hasChildren = !!node.children?.length;
              const isActive = activePath.join("/") === p;
              const isOnTrail = isPrefix(node.path, activePath) && !isActive;
              const isOpen = hasChildren && (isActive || isOnTrail);

              return (
                <div key={p} className="group/child relative">
                  <Link href={buildCategoryHref(node.path)} prefetch={false} className="group/item relative block">
                    <span
                      aria-hidden
                      className={[
                        "pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
                        DOT_LEFT,
                        "h-1.5 w-1.5 rounded-full transition",
                        theme.accentDotBg,
                        isActive || isOnTrail ? "opacity-100 scale-110" : "opacity-0",
                        "group-hover/item:opacity-100 group-hover/item:scale-110",
                      ].join(" ")}
                    />
                    <span
                      aria-hidden
                      className={[
                        "pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
                        DOT_LEFT,
                        "h-2.5 w-2.5 rounded-full border transition",
                        theme.accentDotBorder,
                        isActive || isOnTrail ? "opacity-100" : "opacity-0",
                        "group-hover/item:opacity-100",
                      ].join(" ")}
                    />
                    <span
                      aria-hidden
                      className={[
                        "pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
                        ARROW_LEFT,
                        "text-xs transition",
                        theme.accentText,
                        isActive || isOnTrail ? "opacity-0" : "opacity-0 group-hover/item:opacity-100",
                      ].join(" ")}
                    >
                      ›
                    </span>

                    <span
                      className={[
                        "relative flex items-start justify-between gap-3 rounded-xl px-3 py-2 text-sm leading-6 transition",
                        TEXT_OFFSET,
                        isActive || isOnTrail
                          ? `${theme.accentActiveBg} ${theme.accentActiveText} font-semibold`
                          : "text-neutral-700 group-hover/item:bg-neutral-50",
                      ].join(" ")}
                    >
                      <span className="min-w-0 break-words">{stripBrandSuffix(node.title)}</span>
                      {hasChildren ? (
                        <span
                          className={[
                            "mt-1 shrink-0 text-xs",
                            isActive || isOnTrail ? theme.accentText : "text-neutral-400",
                          ].join(" ")}
                          aria-hidden
                        >
                          {isOpen ? "▾" : "▸"}
                        </span>
                      ) : null}
                    </span>
                  </Link>

                  {hasChildren ? (
                    <div className={isOpen ? "block" : "hidden group-hover/child:block"}>
                      <div className="ml-3 pl-3">{renderChildren(node.children!, depth + 1)}</div>
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

  return (
    <>
      <style>{`
        .scrollbar-hidden {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hidden::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-5 py-4">
          <div className={`text-base font-semibold ${theme.accentText}`}>{KENT_MENU_TITLE}</div>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-white via-white/85 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-white via-white/90 to-transparent" />

          <div className="scrollbar-hidden max-h-[calc(100vh-180px)] overflow-y-auto overscroll-contain p-2">
            <div className="space-y-1 pr-1">
              {KENT_STATIC_MENU.map((root) => {
                const p = root.path.join("/");
                const isActiveRoot = root.path[0] === activeRoot;
                const hasChildren = !!root.children?.length;

                return (
                  <div key={p} className="group/root">
                    <Link
                      href={buildCategoryHref(root.path)}
                      prefetch={false}
                      className={[
                        "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition",
                        isActiveRoot
                          ? `${theme.accentActiveBg} ${theme.accentActiveText} font-semibold`
                          : "text-neutral-800 hover:bg-neutral-50",
                      ].join(" ")}
                    >
                      <span className="min-w-0 truncate">{stripBrandSuffix(root.title)}</span>
                      {hasChildren ? (
                        <span
                          className={[
                            "shrink-0 text-xs",
                            isActiveRoot ? theme.accentText : "text-neutral-400",
                          ].join(" ")}
                          aria-hidden
                        >
                          {isActiveRoot ? "▾" : "▸"}
                        </span>
                      ) : null}
                    </Link>

                    {isActiveRoot && activeRootTree.length ? (
                      renderChildren(activeRootTree)
                    ) : hasChildren ? (
                      <div className="hidden group-hover/root:block">{renderChildren(root.children!)}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function KentH2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[28px] font-semibold tracking-tight text-neutral-900 md:text-[30px]">{children}</h2>;
}

function KentH3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[22px] font-semibold tracking-tight text-neutral-900 md:text-[24px]">{children}</h3>;
}

function KentDivider() {
  return <div className="my-10 border-t border-slate-200" />;
}

function isTextHeavyTitle(title: string) {
  const t = String(title || "").toLowerCase();
  return (
    t.includes("about") ||
    t.includes("application") ||
    t.includes("applications") ||
    t.includes("features") ||
    t.includes("benefit") ||
    t.includes("benefits") ||
    t.includes("anesthesia")
  );
}

function ArticleHtml({ html }: { html: string }) {
  return (
    <div
      className="
        max-w-none text-[15px] leading-8 text-slate-700
        [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-slate-900
        [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-[28px] [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-slate-900
        [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-[22px] [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-slate-900
        [&_p]:my-4 [&_p]:leading-8
        [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6
        [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6
        [&_li]:my-1 [&_li]:leading-8
        [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse
        [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left
        [&_td]:border [&_td]:border-slate-200 [&_td]:px-4 [&_td]:py-3
        [&_a]:font-medium [&_a]:text-blue-700 [&_a]:underline-offset-4 hover:[&_a]:underline
        [&_img]:my-6 [&_img]:h-auto [&_img]:max-w-full
      "
    >
      <HtmlContent html={html} />
    </div>
  );
}

function KentHtmlFallback({ html }: { html: string }) {
  const safe = safeHtmlForRender(html);
  if (roughTextLenFromHtml(safe) < 20) return null;

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <ArticleHtml html={safe} />
    </section>
  );
}

function ResourceBadge() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
        <path d="M7 3.75A1.75 1.75 0 0 1 8.75 2h5.69c.46 0 .9.18 1.23.51l3.82 3.82c.33.33.51.77.51 1.23v12.69A1.75 1.75 0 0 1 18.25 22h-9.5A1.75 1.75 0 0 1 7 20.25V3.75Zm8 0v3.5c0 .41.34.75.75.75h3.5L15 3.75ZM9.5 11.25a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5h-5Zm0 3.5a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5h-5Z" />
      </svg>
    </div>
  );
}

function renderLandingBlocks(blocks: ContentBlock[], theme: Theme) {
  const viewBlocks = normalizeBlocksForKentView(blocks);
  const out: React.ReactNode[] = [];
  let first = true;

  const nextIsCardsWithSameTitle = (i: number, title: string) => {
    const next = viewBlocks[i + 1];
    return !!(next && next._type === "contentBlockCards" && String(next.title || "").trim() === title);
  };

  for (let i = 0; i < viewBlocks.length; i += 1) {
    const block = viewBlocks[i];

    if (block?._type === "contentBlockHtml") {
      const title = String(block.title || "").trim();
      const html = safeHtmlForRender(String(block.html || ""));
      const len = roughTextLenFromHtml(html);

      if (len < 10 && !nextIsCardsWithSameTitle(i, title)) continue;

      if (!first) out.push(<KentDivider key={`div-${block._key || title}-${i}`} />);
      first = false;

      out.push(
        <section key={block._key || `${title}-${i}`} className="mt-10">
          {title ? (
            <div className="mb-5">{isTextHeavyTitle(title) ? <KentH2>{title}</KentH2> : <KentH3>{title}</KentH3>}</div>
          ) : null}
          {len >= 10 ? <ArticleHtml html={html} /> : null}
        </section>,
      );
      continue;
    }

    if (block?._type !== "contentBlockCards") continue;

    const kind = String(block.kind || "") as CardsKind;
    const title = String(block.title || "").trim();
    const items = Array.isArray(block.items) ? block.items.filter(Boolean) : [];
    if (!items.length) continue;

    const prev = viewBlocks[i - 1];
    const prevIsSameSectionHtml =
      !!(prev && prev._type === "contentBlockHtml" && String(prev.title || "").trim() === title);

    if (!first && !prevIsSameSectionHtml) out.push(<KentDivider key={`div-${block._key || kind}-${i}`} />);
    first = false;

    if (kind === "product") {
      out.push(
        <section key={block._key || `prod-${title}-${i}`} className="mt-4">
          {!prevIsSameSectionHtml ? <KentH2>{title || "Products"}</KentH2> : null}

          <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item, idx) => (
              <Link
                key={item._key || `${item.title}-${idx}`}
                href={resolveKentHref(String(item.href || ""))}
                prefetch={false}
                className="group overflow-hidden rounded-[22px] border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] border-b border-slate-100 bg-white">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={toAbs(String(item.imageUrl || ""))}
                      alt=""
                      className="absolute inset-0 h-full w-full object-contain p-6"
                      loading="lazy"
                    />
                  ) : null}

                  {item.badge ? (
                    <span className="absolute left-4 top-4 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </div>

                <div className="px-5 py-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {item.sku ? `Cat.No ${item.sku}` : "Kent Scientific"}
                  </div>

                  <div className="mt-2 text-[22px] font-semibold leading-snug tracking-tight text-slate-900 group-hover:text-blue-700">
                    {item.title}
                  </div>

                  {item.subtitle ? (
                    <div className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{item.subtitle}</div>
                  ) : (
                    <div className="mt-3 h-12" />
                  )}

                  <div className="mt-5 flex items-center justify-between">
                    <span className={`inline-flex items-center gap-2 text-sm font-semibold ${theme.accentText}`}>
                      Learn More <span aria-hidden>›</span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>,
      );
      continue;
    }

    if (kind === "category") {
      out.push(
        <section key={block._key || `cat-${title}-${i}`} className="mt-4">
          {!prevIsSameSectionHtml ? <KentH2>{title || "Additional equipment"}</KentH2> : null}

          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item, idx) => (
              <Link
                key={item._key || `${item.title}-${idx}`}
                href={resolveKentHref(String(item.href || ""))}
                prefetch={false}
                className="group overflow-hidden rounded-[22px] border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-[1/1] border-b border-slate-100 bg-white">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={toAbs(String(item.imageUrl || ""))}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-slate-50" />
                  )}
                </div>
                <div className="px-4 py-4">
                  <div className="text-base font-semibold leading-snug text-slate-900 group-hover:text-blue-700">
                    {item.title}
                  </div>
                  {typeof item.count === "number" ? (
                    <div className="mt-2 text-sm text-slate-500">{item.count} products</div>
                  ) : null}
                  <div className={`mt-4 text-sm font-semibold ${theme.accentText}`}>Browse category ›</div>
                </div>
              </Link>
            ))}
          </div>
        </section>,
      );
      continue;
    }

    if (kind === "publication") {
      out.push(
        <section key={block._key || `pub-${i}`} className="mt-10">
          <KentH2>{title || "Scientific articles and publications"}</KentH2>

          <div className="mt-6 space-y-4">
            {items.map((item, idx) => (
              <div
                key={item._key || `${item.title}-${idx}`}
                className="rounded-[22px] border border-slate-200 bg-white px-6 py-5 transition hover:shadow-sm"
              >
                <Link
                  href={resolveKentHref(String(item.href || ""))}
                  prefetch={false}
                  className="block text-lg font-semibold tracking-tight text-slate-900 hover:text-blue-700"
                >
                  {item.title}
                </Link>

                {item.subtitle ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.subtitle}</p>
                ) : null}

                <div className="mt-4">
                  <Link
                    href={resolveKentHref(String(item.href || ""))}
                    prefetch={false}
                    className={`inline-flex items-center gap-2 text-sm font-semibold ${theme.accentText}`}
                  >
                    Continue Reading <span aria-hidden>›</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>,
      );
      continue;
    }

    if (kind === "resource") {
      out.push(
        <section key={block._key || `res-${i}`} className="mt-10">
          <KentH2>{title || "Resources"}</KentH2>

          <div className="mt-6 space-y-4">
            {items.map((item, idx) => (
              <Link
                key={item._key || `${item.title}-${idx}`}
                href={resolveKentHref(String(item.href || ""))}
                prefetch={false}
                className="group flex items-start gap-4 rounded-[22px] border border-slate-200 bg-white px-5 py-5 transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                {item.imageUrl ? (
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={toAbs(String(item.imageUrl || ""))}
                      alt=""
                      className="absolute inset-0 h-full w-full object-contain p-2"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <ResourceBadge />
                )}

                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold tracking-tight text-slate-900 group-hover:text-blue-700">
                    {item.title}
                  </div>
                  {item.subtitle ? (
                    <div className="mt-1 text-sm leading-6 text-slate-600">{item.subtitle}</div>
                  ) : null}
                  <div className={`mt-3 text-sm font-semibold ${theme.accentText}`}>Open resource ›</div>
                </div>
              </Link>
            ))}
          </div>
        </section>,
      );
    }
  }

  return out.length ? <>{out}</> : null;
}

export default async function KentProductsPathPage({
  params,
}: {
  params: Promise<{ path?: string[] }> | { path?: string[] };
}) {
  const resolved = await Promise.resolve(params as { path?: string[] });
  const pathArr = normalizePathSegments((resolved?.path ?? []) as string[]);
  const hasPath = pathArr.length > 0;
  const pathStr = pathArr.join("/");

  const data = await sanityClient.fetch(PAGE_QUERY, {
    brandKey: BRAND_KEY,
    hasPath,
    pathStr,
    pathArr,
  });

  const brand = data?.brand;
  if (!brand?._id) notFound();

  if (!hasPath) {
    return (
      <div>
        <HeroBanner brandTitle={brand.title} />

        <div className={PAGE_SHELL}>
          <div className="mt-6 flex justify-end">
            <Breadcrumb
              items={[
                { label: "Home", href: "/" },
                { label: "Products", href: "/products" },
                { label: brand.title, href: `/products/${BRAND_KEY}` },
              ]}
            />
          </div>

          <div className={`mt-10 ${CONTENT_LAYOUT}`}>
            <aside className="self-start lg:sticky lg:top-24">
              <KentSideNav activePath={[]} theme={THEME_KENT} />
            </aside>

            <main className="min-w-0">
              <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Select a category</h2>
                <p className="mt-3 leading-7 text-slate-700">왼쪽 사이드탭에서 Kent 카테고리를 선택해 주세요.</p>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  const category: CategoryDoc | null = data?.category || null;
  if (!category?._id) notFound();

  const productsInCategory: ProductLite[] = Array.isArray(data?.products) ? data.products : [];
  const pageType = resolvePageType(category, pathStr);

  const pageTitle =
    STATIC_LABEL_BY_PATH.get(pathStr) || normalizeTitle(category.title || "", pathArr[pathArr.length - 1] || "");

  const blocks = Array.isArray(category.contentBlocks) ? category.contentBlocks : [];
  const renderedBlocks = renderLandingBlocks(blocks, THEME_KENT);
  const fallbackHtml = typeof category.legacyHtml === "string" ? category.legacyHtml : "";
  const hasFallbackHtml = roughTextLenFromHtml(safeHtmlForRender(fallbackHtml)) >= 20;

  const firstHtmlBlock = getFirstHtmlBlock(blocks);
  const listingTailBlocks = getListingTailBlocks(blocks);
  const renderedListingTail = renderLandingBlocks(listingTailBlocks, THEME_KENT);

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: brand.title, href: `/products/${BRAND_KEY}` },
    ...pathArr.map((seg, index) => {
      const slice = pathArr.slice(0, index + 1);
      const key = slice.join("/");
      return {
        label:
          STATIC_LABEL_BY_PATH.get(key) ||
          (index === pathArr.length - 1 ? normalizeTitle(category.title || "", seg) : normalizeTitle("", seg)),
        href: buildCategoryHref(slice),
      };
    }),
  ];

  let mainContent: React.ReactNode = null;

  if (pageType === "landing") {
    if (renderedBlocks) {
      mainContent = <div className="mt-4">{renderedBlocks}</div>;
    } else if (hasFallbackHtml) {
      mainContent = <KentHtmlFallback html={fallbackHtml} />;
    } else if (category.summary) {
      mainContent = (
        <div
          className={`mt-6 rounded-2xl border ${THEME_KENT.accentBorder} ${THEME_KENT.accentSoftBg} p-6 text-sm leading-7 text-slate-800`}
        >
          {category.summary}
          {category.sourceUrl ? (
            <>
              {" "}
              <Link
                className={`font-semibold underline underline-offset-4 ${THEME_KENT.accentUnderline}`}
                href={legacyHref(category.sourceUrl)}
                prefetch={false}
              >
                원문 보기
              </Link>
            </>
          ) : null}
        </div>
      );
    } else {
      mainContent = (
        <div
          className={`mt-6 rounded-2xl border ${THEME_KENT.accentBorder} ${THEME_KENT.accentSoftBg} p-6 text-sm text-slate-800`}
        >
          본문 데이터가 아직 없습니다.
          {category.sourceUrl ? (
            <>
              {" "}
              <Link
                className={`font-semibold underline underline-offset-4 ${THEME_KENT.accentUnderline}`}
                href={legacyHref(category.sourceUrl)}
                prefetch={false}
              >
                원문 보기
              </Link>
            </>
          ) : null}
        </div>
      );
    }
  } else {
    mainContent = (
      <>
        <ListingIntro html={firstHtmlBlock?.html} summary={category.summary} />
        <ListingHeader count={dedupeProducts(productsInCategory).length} theme={THEME_KENT} />
        <KentProductGrid products={productsInCategory} theme={THEME_KENT} />
        {renderedListingTail ? <div className="mt-8">{renderedListingTail}</div> : null}

        {!productsInCategory.length && !firstHtmlBlock && !renderedListingTail ? (
          hasFallbackHtml ? (
            <KentHtmlFallback html={fallbackHtml} />
          ) : (
            <div
              className={`mt-6 rounded-2xl border ${THEME_KENT.accentBorder} ${THEME_KENT.accentSoftBg} p-6 text-sm text-slate-800`}
            >
              본문 데이터가 아직 없습니다.
              {category.sourceUrl ? (
                <>
                  {" "}
                  <Link
                    className={`font-semibold underline underline-offset-4 ${THEME_KENT.accentUnderline}`}
                    href={legacyHref(category.sourceUrl)}
                    prefetch={false}
                  >
                    원문 보기
                  </Link>
                </>
              ) : null}
            </div>
          )
        ) : null}
      </>
    );
  }

  return (
    <div>
      <HeroBanner brandTitle={brand.title} />

      <div className={PAGE_SHELL}>
        <div className="mt-6 flex justify-end">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <div className={`mt-10 ${CONTENT_LAYOUT}`}>
          <aside className="self-start lg:sticky lg:top-24">
            <KentSideNav activePath={pathArr} theme={THEME_KENT} />
          </aside>

          <main className="min-w-0 pb-14">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{pageTitle}</h2>
            {mainContent}
          </main>
        </div>
      </div>
    </div>
  );
}