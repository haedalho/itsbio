import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import * as React from "react";
import * as cheerio from "cheerio";

import Breadcrumb from "@/components/site/Breadcrumb";
import HtmlContent from "@/components/site/HtmlContent";
import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";
import kentCurrentTaxonomy from "@/data/kent-current-taxonomy.json";

export const revalidate = 300;

const BRAND_KEY = "kent";
const BRAND_BASE = "https://www.kentscientific.com";
const KENT_MENU_TITLE = "General Lab Equipment";
const PRODUCT_DOC_TYPE =
  process.env.VERCEL_ENV === "preview" && String(process.env.VERCEL_GIT_COMMIT_REF || "").startsWith("agent/kent")
    ? "kentPreviewProduct"
    : "product";

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
  [key: string]: unknown;
};

type ProductLite = {
  _id: string;
  title: string;
  sku?: string;
  slug: string;
  thumb?: string;
  thumbSource?: string;
  sourceUrl?: string;
  summary?: string;
  categoryPath?: string[];
  listingPaths?: string[];
  categoryPathTitles?: string[];
  href?: string;
};

type CategoryLite = {
  _id: string;
  title: string;
  path: string[];
  order?: number;
  summary?: string;
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

type KentCurrentTaxonomyCategory = {
  id: number;
  parentId: number;
  title: string;
  slug: string;
  count: number;
  sourceUrl: string;
  categoryPath: string[];
  categoryPathTitles: string[];
  directProductSlugs: string[];
  productSlugs: string[];
};

type KentCurrentTaxonomy = {
  generatedAt: string;
  publishedProductCount: number;
  categoryCount: number;
  countMismatchCount: number;
  categories: KentCurrentTaxonomyCategory[];
  products: Array<{ slug: string }>;
};

const CURRENT_KENT_TAXONOMY = kentCurrentTaxonomy as KentCurrentTaxonomy;

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
    ] | order(_updatedAt desc)[0]{
      _id,
      title,
      path,
      order,
      sourceUrl,
      summary,
      legacyHtml,
      pageType,
      contentBlocks[] {
        ...,
        items[] {
          ...
        }
      }
    },
    null
  ),

  "allProducts": *[
    _type==$productType
    && (!defined(isActive) || isActive==true)
    && (
      brandSlug==$brandKey
      || brand->slug.current==$brandKey
      || brand->themeKey==$brandKey
    )
    && (!$hasProductScope || slug.current in $productSlugs)
  ] | order(title asc)[0...400] {
    _id,
    title,
    sku,
    summary,
    categoryPath,
    listingPaths,
    categoryPathTitles,
    "slug": slug.current,
    "thumb": coalesce(images[defined(asset->url)][0].asset->url, ""),
    "thumbSource": coalesce(images[defined(asset->url)][0].sourceUrl, ""),
    sourceUrl
  },

  "allCategories": *[
    _type=="category"
    && (!defined(isActive) || isActive==true)
    && (
      brand->themeKey==$brandKey
      || brand->slug.current==$brandKey
      || themeKey==$brandKey
      || brandSlug==$brandKey
    )
    && defined(path)
  ] | order(order asc, title asc) {
    _id,
    title,
    path,
    order,
    summary
  }
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
        path: ["anesthesia", "anesthesia-accessories-for-somnoflo"],
      },
      {
        title: "Anesthesia Accessories for SomnoSuite®",
        path: ["anesthesia", "anesthesia-accessories-for-somnosuite"],
      },
      {
        title: "Anesthesia Accessories for VetFlo™",
        path: ["anesthesia", "anesthesia-accessories-for-vetflo"],
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
  { title: "Imaging System", path: ["imaging-system"] },
  { title: "Mobile Carts", path: ["mobile-carts"] },
  { title: "Nebulizer", path: ["nebulizers"] },
  {
    title: "Non-invasive Blood Pressure",
    path: ["noninvasive-blood-pressure"],
    children: [
      {
        title: "Non-Invasive Blood Pressure Accessories",
        path: ["noninvasive-blood-pressure", "noninvasive-blood-pressure-accessories"],
      },
      {
        title: "Accessories for CODA® Monitor",
        path: ["noninvasive-blood-pressure", "noninvasive-blood-pressure-accessories", "accessories-for-coda-monitor"],
      },
      {
        title: "CODA® Cuffs",
        path: [
          "noninvasive-blood-pressure",
          "noninvasive-blood-pressure-accessories",
          "accessories-for-coda-monitor",
          "coda-cuffs",
        ],
      },
    ],
  },
  {
    title: "Physiological Monitoring",
    path: ["physiological-monitoring"],
    children: [
      {
        title: "Physiological Monitoring Accessories",
        path: ["physiological-monitoring", "physiological-monitoring-accessories"],
      },
      {
        title: "Pulse Oximetry",
        path: ["physiological-monitoring", "physiological-monitoring-accessories", "pulse-oximetry"],
      },
      {
        title: "Temperature",
        path: ["physiological-monitoring", "physiological-monitoring-accessories", "temperature"],
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
      { title: "Surgical Instrument Kits", path: ["surgery", "surgical-instruments", "surgical-instrument-kits"] },
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
      { title: "Warming Pads and Blankets", path: ["warming", "warming-pads-blankets"] },
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
    "get your accessories",
    "don't miss",
    "dont miss",
  ];

  const tags = ["section", "div", "p", "li", "span", "aside", "article"];

  for (const phrase of phrases) {
    for (const tag of tags) {
      const re = new RegExp(
        `<${tag}[^>]*>[\\s\\S]{0,2000}?${phrase}[\\s\\S]{0,2000}?<\\/${tag}>`,
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

  if (/^\/?products\/kent\/?(?:[?#].*)?$/i.test(raw)) {
    return `/products/${BRAND_KEY}`;
  }

  if (/^\/?products\/kent\/item\/kent\/?(?:[?#].*)?$/i.test(raw)) {
    return `/products/${BRAND_KEY}`;
  }

  if (/^\/?products\/kent\/item\//i.test(raw) || /^\/?kent\/item\//i.test(raw) || /^\/?item\//i.test(raw)) {
    return buildProductHref(raw);
  }

  if (/\/item\//i.test(raw) && !/^https?:\/\//i.test(raw)) {
    return buildProductHref(raw);
  }

  if (/^\/?products\/kent\/legacy/i.test(raw)) {
    return `/products/${BRAND_KEY}`;
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
    return path.length ? buildCategoryHref(path) : `/products/${BRAND_KEY}`;
  }

  return `/products/${BRAND_KEY}`;
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

function currentTaxonomyPathKey(path?: string[]) {
  return normalizePathSegments(path || []).join("/");
}

const CURRENT_KENT_CATEGORIES = Array.isArray(CURRENT_KENT_TAXONOMY.categories)
  ? CURRENT_KENT_TAXONOMY.categories
  : [];
const CURRENT_KENT_CATEGORY_BY_PATH = new Map(
  CURRENT_KENT_CATEGORIES.map((category) => [currentTaxonomyPathKey(category.categoryPath), category]),
);
const CURRENT_KENT_CATEGORY_BY_SOURCE = new Map(
  CURRENT_KENT_CATEGORIES
    .map((category) => [normalizeUrl(category.sourceUrl).toLowerCase(), category] as const)
    .filter(([source]) => Boolean(source)),
);
const CURRENT_KENT_PATH_ALIASES = new Map<string, string>([
  ["animal-holders", "animal-handling/animal-holders"],
  ["laboratory-animal-handling/animal-holders", "animal-handling/animal-holders"],
]);
const CURRENT_KENT_CATEGORIES_BY_LEAF = new Map<string, KentCurrentTaxonomyCategory[]>();
const CURRENT_KENT_CATEGORIES_BY_TITLE = new Map<string, KentCurrentTaxonomyCategory[]>();

for (const category of CURRENT_KENT_CATEGORIES) {
  const path = normalizePathSegments(category.categoryPath || []);
  const leaf = path[path.length - 1] || "";
  if (leaf) {
    const rows = CURRENT_KENT_CATEGORIES_BY_LEAF.get(leaf) || [];
    rows.push(category);
    CURRENT_KENT_CATEGORIES_BY_LEAF.set(leaf, rows);
  }

  const title = normalizeInlineText(category.title || "");
  if (title) {
    const rows = CURRENT_KENT_CATEGORIES_BY_TITLE.get(title) || [];
    rows.push(category);
    CURRENT_KENT_CATEGORIES_BY_TITLE.set(title, rows);
  }
}

function resolveCurrentKentCategory(
  path?: string[],
  sourceUrl?: string,
  title?: string,
): KentCurrentTaxonomyCategory | null {
  const normalizedPath = normalizePathSegments(path || []);
  const normalizedKey = normalizedPath.join("/");
  const aliasKey = CURRENT_KENT_PATH_ALIASES.get(normalizedKey);
  const alias = aliasKey ? CURRENT_KENT_CATEGORY_BY_PATH.get(aliasKey) : null;
  if (alias) return alias;

  const exact = CURRENT_KENT_CATEGORY_BY_PATH.get(normalizedKey);
  if (exact) return exact;

  const source = normalizeUrl(String(sourceUrl || "")).toLowerCase();
  const sourceMatch = source ? CURRENT_KENT_CATEGORY_BY_SOURCE.get(source) : null;
  if (sourceMatch) return sourceMatch;

  const leaf = normalizedPath[normalizedPath.length - 1] || "";
  const leafMatches = leaf ? CURRENT_KENT_CATEGORIES_BY_LEAF.get(leaf) || [] : [];
  if (leafMatches.length === 1) return leafMatches[0];

  const normalizedTitle = normalizeInlineText(String(title || ""));
  const titleMatches = normalizedTitle ? CURRENT_KENT_CATEGORIES_BY_TITLE.get(normalizedTitle) || [] : [];
  if (titleMatches.length === 1) return titleMatches[0];

  return null;
}

function productsForCurrentKentCategory(
  category: KentCurrentTaxonomyCategory,
  allProducts: ProductLite[],
) {
  const bySlug = new Map(
    (Array.isArray(allProducts) ? allProducts : [])
      .map((product) => [String(product.slug || "").trim().toLowerCase(), product] as const)
      .filter(([slug]) => Boolean(slug)),
  );

  return category.productSlugs
    .map((slug) => bySlug.get(String(slug || "").trim().toLowerCase()))
    .filter((product): product is ProductLite => Boolean(product));
}

function isPrefix(prefix: string[], target: string[]) {
  if (prefix.length > target.length) return false;
  return prefix.every((seg, idx) => seg === target[idx]);
}

function getImageUrlLike(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return toAbs(value);
  if (typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const direct = [record.imageUrl, record.image, record.url, record.src, record.thumbnail, record.thumb]
    .find((v) => typeof v === "string" && String(v).trim());
  if (typeof direct === "string") return toAbs(direct);
  if (record.asset && typeof record.asset === "object") {
    const asset = record.asset as Record<string, unknown>;
    const nested = asset.url;
    if (typeof nested === "string") return toAbs(nested);
  }
  return "";
}

function guessCardsKind(items: CardItem[]): CardsKind {
  const hrefs = items.map((item) => String(item?.href || "").trim()).filter(Boolean);
  if (!hrefs.length) return "category";

  const productCount = hrefs.filter((href) => isKentProductHrefLike(href)).length;
  const categoryCount = hrefs.filter((href) => isKentCategoryHrefLike(href)).length;
  const resourceCount = hrefs.filter((href) => /pdf|whitepaper|brochure|guide|manual/i.test(href)).length;

  if (resourceCount >= Math.max(1, Math.floor(hrefs.length / 2))) return "resource";
  if (productCount >= categoryCount) return "product";
  return "category";
}

function coerceCardItem(input: unknown): CardItem | null {
  if (!input || typeof input !== "object") return null;
  const src = input as Record<string, unknown>;

  const title =
    (typeof src.title === "string" && src.title.trim()) ||
    (typeof src.name === "string" && src.name.trim()) ||
    (typeof src.label === "string" && src.label.trim()) ||
    "";

  const subtitle =
    (typeof src.subtitle === "string" && src.subtitle.trim()) ||
    (typeof src.description === "string" && src.description.trim()) ||
    (typeof src.excerpt === "string" && src.excerpt.trim()) ||
    "";

  const href =
    (typeof src.href === "string" && src.href.trim()) ||
    (typeof src.link === "string" && src.link.trim()) ||
    (typeof src.url === "string" && src.url.trim()) ||
    "";

  const imageUrl = getImageUrlLike(src);
  const sku = typeof src.sku === "string" ? src.sku : typeof src.catNo === "string" ? src.catNo : "";
  const badge = typeof src.badge === "string" ? src.badge : "";
  const rawCount = src.count;
  const count = typeof rawCount === "number" ? rawCount : typeof rawCount === "string" && rawCount.trim() ? Number(rawCount) : undefined;

  if (!title && !href) return null;

  return {
    _key: typeof src._key === "string" ? src._key : undefined,
    title,
    subtitle,
    href,
    imageUrl,
    sku,
    badge,
    count: typeof count === "number" && Number.isFinite(count) ? count : undefined,
  };
}

function coerceContentBlocks(blocks: ContentBlock[]) {
  const out: ContentBlock[] = [];

  for (const raw of Array.isArray(blocks) ? blocks : []) {
    if (!raw || typeof raw !== "object") continue;
    const src = raw as Record<string, unknown>;
    const candidateItems = [src.items, src.cards, src.links, src.children].find((v) => Array.isArray(v));
    const normalizedItems = Array.isArray(candidateItems)
      ? candidateItems.map(coerceCardItem).filter(Boolean) as CardItem[]
      : [];

    const htmlCandidates = [src.html, src.body, src.content, src.description].filter((v) => typeof v === "string") as string[];
    const html = htmlCandidates.find((v) => v.trim()) || "";

    let type = typeof src._type === "string" ? src._type : "";
    if (!type) {
      if (normalizedItems.length) type = "contentBlockCards";
      else if (html.trim()) type = "contentBlockHtml";
    }

    let kind = typeof src.kind === "string" ? src.kind : "";
    if (!kind && normalizedItems.length) {
      kind = guessCardsKind(normalizedItems);
    }

    out.push({
      _key: typeof src._key === "string" ? src._key : undefined,
      _type: type,
      title:
        (typeof src.title === "string" && src.title) ||
        (typeof src.heading === "string" && src.heading) ||
        (typeof src.label === "string" && src.label) ||
        "",
      html,
      kind,
      items: normalizedItems,
    });
  }

  return out;
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
    out.push({ ...item, href, imageUrl: imageUrl ? toAbs(imageUrl) : "" });
  }

  return out;
}

function dedupeLandingBlocks(blocks: ContentBlock[]) {
  const seen = new Set<string>();
  const out: ContentBlock[] = [];

  for (const block of coerceContentBlocks(blocks)) {
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

function looksCrossCategoryNoise(input: string) {
  const t = normalizeInlineText(input || "");
  return t.includes("rovent") || t.includes("ventilator") || t.includes("ventilation") || t.includes("anesthesia starter kit");
}

function normalizeBlocksForKentView(blocks: ContentBlock[]) {
  const merged = mergeLandingBlocks(blocks);
  const out: ContentBlock[] = [];

  for (const block of merged) {
    if (block?._type !== "contentBlockCards") {
      if (block?._type === "contentBlockHtml") {
        const html = String(block?.html || "");
        const title = String(block?.title || "");
        if (looksPromoNoise(`${title} ${html}`) || looksCrossCategoryNoise(`${title} ${html}`)) continue;
      }
      out.push(block);
      continue;
    }

    const kind = String(block.kind || "") as CardsKind;
    let items = dedupeLandingItems(Array.isArray(block.items) ? block.items : []).filter((item) => {
      const joined = `${String(item?.title || "")} ${String(item?.subtitle || "")}`;
      return !looksPromoNoise(joined) && !looksCrossCategoryNoise(joined);
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

function getDirectChildren(allCategories: CategoryLite[], currentPath: string[]) {
  const seen = new Set<string>();
  return (Array.isArray(allCategories) ? allCategories : [])
    .filter((cat) => {
      const path = normalizePathSegments(cat.path || []);
      if (path.length !== currentPath.length + 1 || !isPrefix(currentPath, path)) return false;
      const currentCategory = resolveCurrentKentCategory(path, undefined, cat.title);
      if (!currentCategory || currentCategory.count <= 0) return false;
      const key = path.join("/");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const ao = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
      const bo = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
}

function categoryPathFromInternalHref(href: string) {
  const value = String(href || "").trim().split("#")[0].split("?")[0];
  const prefix = `/products/${BRAND_KEY}/`;
  if (!value.startsWith(prefix) || value.includes("/item/") || value.includes("/legacy")) return [];
  return normalizePathSegments(value.slice(prefix.length).split("/"));
}

function findCanonicalCategoryPath(requestedPath: string[], allCategories: CategoryLite[]) {
  const requested = normalizePathSegments(requestedPath || []);
  if (!requested.length) return null;

  const leaf = requested[requested.length - 1] || "";
  if (
    requested[0] === "anesthesia" &&
    /^anesthesia-accessories-for-(?:somnoflo|somnosuite|vetflo)$/.test(leaf)
  ) {
    return ["anesthesia", leaf];
  }

  const candidates = (Array.isArray(allCategories) ? allCategories : [])
    .map((category) => normalizePathSegments(category.path || []))
    .filter((candidate) => candidate.length > 0);
  const requestedKey = requested.join("/");
  const exact = candidates.find((candidate) => candidate.join("/") === requestedKey);
  if (exact) return exact;

  const leafMatches = candidates.filter((candidate) => candidate[candidate.length - 1] === leaf);
  if (leafMatches.length === 1) return leafMatches[0];
  if (!leafMatches.length) return null;

  const ranked = leafMatches
    .map((candidate) => {
      let prefixScore = 0;
      const limit = Math.min(candidate.length, requested.length);
      for (let index = 0; index < limit; index += 1) {
        if (candidate[index] !== requested[index]) break;
        prefixScore += 1;
      }
      let suffixScore = 0;
      for (let offset = 1; offset <= limit; offset += 1) {
        if (candidate[candidate.length - offset] !== requested[requested.length - offset]) break;
        suffixScore += 1;
      }
      return { candidate, score: prefixScore * 10 + suffixScore };
    })
    .sort((a, b) => b.score - a.score || a.candidate.length - b.candidate.length);

  if (!ranked[0] || ranked[0].score <= 0) return null;
  if (ranked[1] && ranked[1].score === ranked[0].score) return null;
  return ranked[0].candidate;
}

function productCategoryPaths(product: ProductLite) {
  const paths: string[][] = [];
  const primary = normalizePathSegments(product.categoryPath || []);
  if (primary.length) paths.push(primary);
  for (const entry of Array.isArray(product.listingPaths) ? product.listingPaths : []) {
    const parsed = normalizePathSegments(String(entry || "").split("/"));
    if (parsed.length) paths.push(parsed);
  }
  return paths;
}

function findRepresentativeProductForCategory(categoryPath: string[], allProducts: ProductLite[]) {
  const target = normalizePathSegments(categoryPath || []);
  if (!target.length) return undefined;
  const products = (Array.isArray(allProducts) ? allProducts : []).filter((product) => String(product.thumb || "").trim());
  const currentCategory = resolveCurrentKentCategory(target);

  if (currentCategory) {
    const representative = productsForCurrentKentCategory(currentCategory, products)[0];
    if (representative) return representative;
  }

  const exact = products.find((product) =>
    productCategoryPaths(product).some((candidate) => candidate.join("/") === target.join("/")),
  );
  if (exact) return exact;

  return products.find((product) =>
    productCategoryPaths(product).some((candidate) => isPrefix(target, candidate)),
  );
}

function isManagedCategoryImageUrl(input?: unknown) {
  const value = String(input || "").trim();
  if (!value) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.toLowerCase() === "cdn.sanity.io";
  } catch {
    return false;
  }
}

function resolvePageType(category: CategoryDoc | null, pathStr: string, directChildrenCount: number, productCount: number): PageType {
  const raw = String(category?.pageType || "").trim().toLowerCase();
  if (raw === "landing" || raw === "listing") return raw as PageType;
  if (LANDING_FALLBACK_PATHS.has(pathStr)) return "landing";
  if (directChildrenCount > 0 && productCount === 0) return "landing";
  return "listing";
}


function normalizeMatchPath(path?: string[]) {
  return normalizePathSegments(path || []).join("/");
}

function getLeafSlugFromPath(path?: string[]) {
  const normalized = normalizePathSegments(path || []);
  return normalized[normalized.length - 1] || "";
}

type ParsedLegacyCard = {
  title: string;
  href: string;
  imageUrl?: string;
  sku?: string;
  summary?: string;
};

function parseLegacyProductCards(html?: string | null): ParsedLegacyCard[] {
  const source = String(html || "").trim();
  if (!source) return [];

  const $ = cheerio.load(source);
  const out: ParsedLegacyCard[] = [];
  const seen = new Set<string>();

  const selectors = [
    ".products .product",
    ".woocommerce ul.products li.product",
    "ul.products li.product",
    ".archive-products .product",
    ".content-products .product",
  ].join(",");

  $(selectors).each((_, el) => {
    const node = $(el);
    const anchor = node.find("a").first();
    const href = toAbs(String(anchor.attr("href") || "").trim());
    const title = normalizeTitle(
      String(
        node.find(".woocommerce-loop-product__title").first().text() ||
          node.find("h2").first().text() ||
          node.find("h3").first().text() ||
          anchor.text() ||
          ""
      ).trim(),
    );
    const imageUrl = toAbs(
      String(
        node.find("img").first().attr("data-lazy-src") ||
          node.find("img").first().attr("data-src") ||
          node.find("img").first().attr("src") ||
          ""
      ).trim(),
    );
    const sku = String(
      node.find(".sku").first().text() ||
        node.find(".product-sku").first().text() ||
        node.find("[class*='sku']").first().text() ||
        ""
    ).trim();
    const summary = String(
      node.find(".excerpt").first().text() ||
        node.find(".description").first().text() ||
        node.find("p").first().text() ||
        ""
    ).trim();

    if (!href && !title) return;

    const key = `${href}__${title}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    out.push({ title, href, imageUrl, sku, summary });
  });

  return out;
}

function matchProductsForListing(pathArr: string[], category: CategoryDoc | null, allProducts: ProductLite[]) {
  const exactCandidates = new Set<string>();
  const leafCandidates = new Set<string>();

  const addCandidate = (parts?: string[]) => {
    const normalized = normalizePathSegments(parts || []);
    if (!normalized.length) return;
    exactCandidates.add(normalized.join("/"));
    const leaf = normalized[normalized.length - 1];
    if (leaf) leafCandidates.add(leaf);
  };

  addCandidate(pathArr);
  addCandidate(category?.path || []);
  addCandidate(kentCategoryPathFromUrl(String(category?.sourceUrl || "")));

  const matched = allProducts.filter((product) => {
    const categoryPath = normalizePathSegments(product.categoryPath || []);
    const categoryJoined = categoryPath.join("/");
    const categoryLeaf = categoryPath[categoryPath.length - 1] || "";

    const listingPathParts = Array.isArray(product.listingPaths)
      ? product.listingPaths
          .map((entry) => normalizePathSegments(String(entry || "").split("/")))
          .filter((parts) => parts.length)
      : [];
    const listingJoined = listingPathParts.map((parts) => parts.join("/"));
    const listingLeafs = listingPathParts.map((parts) => parts[parts.length - 1] || "").filter(Boolean);

    if (categoryJoined && exactCandidates.has(categoryJoined)) return true;
    if (listingJoined.some((joined) => exactCandidates.has(joined))) return true;
    if (categoryLeaf && leafCandidates.has(categoryLeaf)) return true;
    if (listingLeafs.some((leaf) => leafCandidates.has(leaf))) return true;

    return false;
  });

  return dedupeProducts(matched);
}

function hydrateProductsFromLegacyCards(
  baseProducts: ProductLite[],
  legacyCards: ParsedLegacyCard[],
  productPool: ProductLite[] = baseProducts,
) {
  const bySlug = new Map<string, ProductLite>();
  const bySourceUrl = new Map<string, ProductLite>();

  for (const product of productPool) {
    const slug = String(product.slug || "").trim().toLowerCase();
    if (slug) bySlug.set(slug, product);

    const source = normalizeUrl(String(product.sourceUrl || ""));
    if (source) bySourceUrl.set(source.toLowerCase(), product);
  }

  const out: ProductLite[] = [...baseProducts];
  const seen = new Set(out.map((product) => String(product.slug || product._id || "").trim().toLowerCase()));

  for (const card of legacyCards) {
    const href = toAbs(String(card.href || "").trim());
    const sourceKey = normalizeUrl(href).toLowerCase();
    const slug = kentProductSlugFromUrl(href);
    const matched = bySourceUrl.get(sourceKey) || (slug ? bySlug.get(slug.toLowerCase()) : undefined);

    if (matched) {
      const idx = out.findIndex((item) => item._id === matched._id);
      const merged: ProductLite = {
        ...matched,
        thumb: matched.thumb || "",
        sku: matched.sku || card.sku || "",
        summary: matched.summary || card.summary || "",
      };
      if (idx >= 0) out[idx] = merged;
      continue;
    }

    if (!slug) continue;
    const key = slug.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      _id: `legacy-${key}`,
      title: normalizeTitle(card.title || "", slug),
      slug,
      thumb: "",
      sku: card.sku || "",
      summary: card.summary || "",
      sourceUrl: href,
      href: buildProductHref(slug),
      categoryPathTitles: [],
    });
  }

  return dedupeProducts(out);
}

function resolveListingProducts(pathArr: string[], category: CategoryDoc | null, allProducts: ProductLite[]) {
  const currentCategory = resolveCurrentKentCategory(pathArr, category?.sourceUrl, category?.title);
  if (currentCategory) {
    return dedupeProducts(productsForCurrentKentCategory(currentCategory, allProducts));
  }

  // Strict fallback for a not-yet-mapped category. Never merge by leaf slug and
  // never add products from stale legacy HTML because both inflate category counts.
  const exactKeys = new Set<string>();
  for (const candidate of [
    pathArr,
    category?.path || [],
    kentCategoryPathFromUrl(String(category?.sourceUrl || "")),
  ]) {
    const key = currentTaxonomyPathKey(candidate);
    if (key) exactKeys.add(key);
  }

  return dedupeProducts(
    allProducts.filter((product) =>
      productCategoryPaths(product).some((candidate) => exactKeys.has(candidate.join("/"))),
    ),
  );
}

function hydrateProductCardBlocks(blocks: ContentBlock[], allProducts: ProductLite[], allCategories: CategoryLite[]) {
  const bySlug = new Map<string, ProductLite>();
  const bySourceUrl = new Map<string, ProductLite>();
  const byImageSource = new Map<string, ProductLite>();

  const imageIdentity = (value: unknown) => {
    try {
      const pathname = decodeURIComponent(new URL(toAbs(String(value || ""))).pathname).toLowerCase();
      return pathname.replace(/-\d+x\d+(?=\.[a-z0-9]+$)/, "");
    } catch {
      return "";
    }
  };

  for (const product of allProducts) {
    const slug = String(product.slug || "").trim().toLowerCase();
    if (slug) bySlug.set(slug, product);

    const sourceUrl = normalizeUrl(String(product.sourceUrl || "")).toLowerCase();
    if (sourceUrl) bySourceUrl.set(sourceUrl, product);

    const sourceImage = imageIdentity(product.thumbSource);
    if (sourceImage) byImageSource.set(sourceImage, product);
  }

  return blocks.map((block) => {
    if (block?._type !== "contentBlockCards") return block;
    const kind = String(block.kind || "");
    if (kind !== "product" && kind !== "category") return block;

    return {
      ...block,
      items: (Array.isArray(block.items) ? block.items : []).map((item) => {
        const rawHref = String(item?.href || "").trim();
        const href = toAbs(rawHref);
        const slug = kentProductSlugFromUrl(href).toLowerCase();
        const sourceUrl = normalizeUrl(href).toLowerCase();
        const resolvedHref = resolveKentHref(rawHref);
        const requestedCategoryPath = categoryPathFromInternalHref(resolvedHref);
        const canonicalCategoryPath =
          findCanonicalCategoryPath(requestedCategoryPath, allCategories) || requestedCategoryPath;
        const canonicalCategoryHref = canonicalCategoryPath.length
          ? buildCategoryHref(canonicalCategoryPath)
          : resolvedHref;
        const currentCategory = kind === "category"
          ? resolveCurrentKentCategory(canonicalCategoryPath, href, String(item?.title || ""))
          : null;
        const categoryLabel = `${href} ${String(item?.title || "")}`.toLowerCase();
        const namedRepresentative = categoryLabel.includes("somnosuite")
          ? bySlug.get("somnosuite")
          : categoryLabel.includes("somnoflo")
            ? bySlug.get("somnoflo")
            : categoryLabel.includes("vetflo")
              ? bySlug.get("vaporizer-with-vetflo-single-channel-anesthesia-stand")
              : undefined;
        const pathRepresentative = canonicalCategoryPath.length
          ? findRepresentativeProductForCategory(canonicalCategoryPath, allProducts)
          : undefined;
        const product =
          kind === "category"
            ? byImageSource.get(imageIdentity(item?.imageUrl)) || namedRepresentative || pathRepresentative
            : bySourceUrl.get(sourceUrl) || bySlug.get(slug);
        const existingManagedImage = isManagedCategoryImageUrl(item?.imageUrl)
          ? String(item?.imageUrl || "").trim()
          : "";

        return {
          ...item,
          href: kind === "category" ? canonicalCategoryHref : resolvedHref,
          imageUrl: product?.thumb || existingManagedImage || "",
          count: kind === "category" && currentCategory ? currentCategory.count : item.count,
        };
      }),
    } as ContentBlock;
  });
}

function getFirstHtmlBlock(blocks: ContentBlock[]) {
  return (
    normalizeBlocksForKentView(blocks).find(
      (block) =>
        block?._type === "contentBlockHtml" &&
        roughTextLenFromHtml(safeHtmlForRender(String(block.html || ""))) >= 20,
    ) || null
  );
}

function getListingTailBlocks(blocks: ContentBlock[]) {
  return normalizeBlocksForKentView(blocks).filter((block) => {
    if (block?._type !== "contentBlockCards") return false;
    const kind = String(block.kind || "");
    return kind === "resource" || kind === "publication";
  });
}

function KentChildCategoryGrid({
  items,
  products,
  title = "Subcategories",
  theme,
}: {
  items: CategoryLite[];
  products: ProductLite[];
  title?: string;
  theme: Theme;
}) {
  if (!items.length) return null;

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <KentH2>{title}</KentH2>
        <div
          className={[
            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
            theme.accentBorder,
            theme.accentSoftBg,
            theme.accentText,
          ].join(" ")}
        >
          {items.length} categor{items.length > 1 ? "ies" : "y"}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const path = normalizePathSegments(item.path || []);
          const href = buildCategoryHref(path);
          const titleText = STATIC_LABEL_BY_PATH.get(path.join("/")) || normalizeTitle(item.title || "", path[path.length - 1] || "");
          const summary = String(item.summary || "").trim();
          const currentCategory = resolveCurrentKentCategory(path, undefined, item.title);
          const representative = findRepresentativeProductForCategory(path, products);

          return (
            <Link
              key={item._id}
              href={href}
              prefetch={false}
              className="group overflow-hidden rounded-[22px] border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-[4/3] border-b border-slate-100 bg-white">
                {representative?.thumb ? (
                  <img
                    src={toAbs(representative.thumb)}
                    alt=""
                    className="absolute inset-0 h-full w-full object-contain p-5"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-slate-50" />
                )}
              </div>
              <div className="p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Kent Category</div>
                <div className="mt-2 text-[22px] font-semibold leading-snug tracking-tight text-slate-900 group-hover:text-blue-700">
                  {titleText}
                </div>
                {currentCategory ? <div className="mt-2 text-sm text-slate-500">{currentCategory.count} products</div> : null}
                {summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{summary}</p> : <div className="mt-3 h-[48px]" />}
                <div className={`mt-5 inline-flex items-center gap-2 text-sm font-semibold ${theme.accentText}`}>
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
      <section className="mt-5 border-b border-slate-200 pb-6">
        <div
          className="
            max-w-none text-[15px] leading-8 text-slate-700
            [&_p]:m-0 [&_p]:leading-8
            [&_a]:font-medium [&_a]:text-blue-700 [&_a]:underline-offset-4 hover:[&_a]:underline
          "
        >
          <HtmlContent html={safe} />
        </div>
      </section>
    );
  }

  if (summary?.trim()) {
    return (
      <section className="mt-5 border-b border-slate-200 pb-6">
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
    <section className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
      <div className="text-sm text-slate-600">
        {count > 0 ? `${count} product${count > 1 ? "s" : ""}` : "No products found"}
      </div>

      <div className="inline-flex items-center gap-2 text-sm text-slate-500">
        <span className="font-medium text-slate-700">View:</span>
        <span
          className={[
            "rounded-md border px-2 py-1 text-xs font-semibold",
            theme.accentBorder,
            theme.accentSoftBg,
            theme.accentText,
          ].join(" ")}
        >
          Grid
        </span>
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
    <section className="mt-8">
      <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((product) => {
          const title = stripBrandSuffix(product.title);
          const categories = Array.isArray(product.categoryPathTitles)
            ? product.categoryPathTitles.filter(Boolean)
            : [];
          const summary = String(product.summary || "").trim();

          return (
            <Link
              key={product._id}
              href={product.href || buildProductHref(product.slug)}
              prefetch={false}
              className="group block"
            >
              <article className="border border-slate-200 bg-white transition hover:shadow-md">
                <div className="relative aspect-square border-b border-slate-100 bg-white">
                  {product.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={toAbs(product.thumb)}
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
                    {title}
                  </div>

                  {summary ? (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{summary}</p>
                  ) : (
                    <div className="mt-3 h-12" />
                  )}

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {product.sku ? `Cat.No ${product.sku}` : "Kent Scientific"}
                    </div>

                    <span className={`text-sm font-semibold ${theme.accentText}`}>
                      Learn More <span aria-hidden>›</span>
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          );
        })}
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

function renderLooseBlocks(blocks: ContentBlock[], theme: Theme) {
  const normalized = coerceContentBlocks(blocks).filter(Boolean);
  if (!normalized.length) return null;

  const sections: React.ReactNode[] = [];

  for (let i = 0; i < normalized.length; i += 1) {
    const block = normalized[i];
    const title = String(block?.title || "").trim();

    if (block?._type === "contentBlockHtml") {
      const html = safeHtmlForRender(String(block?.html || ""));
      if (roughTextLenFromHtml(html) < 20) continue;
      sections.push(
        <section key={block._key || `loose-html-${i}`} className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          {title ? <div className="mb-5"><KentH2>{title}</KentH2></div> : null}
          <ArticleHtml html={html} />
        </section>,
      );
      continue;
    }

    if (block?._type !== "contentBlockCards") continue;
    const kind = String(block?.kind || guessCardsKind(block.items || [])) as CardsKind;
    const items = dedupeLandingItems(Array.isArray(block?.items) ? block.items : []);
    if (!items.length) continue;

    if (kind === "category") {
      sections.push(
        <section key={block._key || `loose-cat-${i}`} className="mt-8">
          {title ? <div className="mb-5"><KentH2>{title}</KentH2></div> : null}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item, idx) => {
              const href = resolveKentHref(String(item?.href || ""));
              const path = href.startsWith(`/products/${BRAND_KEY}/`) ? href.replace(`/products/${BRAND_KEY}/`, "").split("/").filter(Boolean) : [];
              const titleText = STATIC_LABEL_BY_PATH.get(path.join("/")) || normalizeTitle(String(item?.title || ""), path[path.length - 1] || "");
              return (
                <Link key={item._key || `${titleText}-${idx}`} href={href} prefetch={false} className="group overflow-hidden rounded-[22px] border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative aspect-[1/1] border-b border-slate-100 bg-white">
                    {item.imageUrl ? <img src={toAbs(String(item.imageUrl || ""))} alt="" className="absolute inset-0 h-full w-full object-contain p-5" loading="lazy" /> : <div className="absolute inset-0 bg-slate-50" />}
                  </div>
                  <div className="px-4 py-4">
                    <div className="text-base font-semibold leading-snug text-slate-900 group-hover:text-blue-700">{titleText}</div>
                    {typeof item.count === "number" ? <div className="mt-2 text-sm text-slate-500">{item.count} products</div> : null}
                    <div className={`mt-4 text-sm font-semibold ${theme.accentText}`}>Browse category ›</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>,
      );
      continue;
    }

    if (kind === "product") {
      sections.push(
        <section key={block._key || `loose-prod-${i}`} className="mt-8">
          {title ? <div className="mb-5"><KentH2>{title}</KentH2></div> : null}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item, idx) => (
              <Link key={item._key || `${item.title}-${idx}`} href={resolveKentHref(String(item?.href || ""))} prefetch={false} className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="relative aspect-[4/3] border-b border-slate-100 bg-white">
                  {item.imageUrl ? <img src={toAbs(String(item.imageUrl || ""))} alt="" className="absolute inset-0 h-full w-full object-contain p-6" loading="lazy" /> : <div className="absolute inset-0 bg-slate-50" />}
                </div>
                <div className="px-5 py-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{item.sku ? `Cat.No ${item.sku}` : "Kent Scientific"}</div>
                  <div className="mt-2 text-[20px] font-semibold leading-snug tracking-tight text-slate-900 group-hover:text-blue-700">{String(item.title || "")}</div>
                  {item.subtitle ? <div className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{item.subtitle}</div> : <div className="mt-3 h-12" />}
                  <div className={`mt-5 text-sm font-semibold ${theme.accentText}`}>Learn More ›</div>
                </div>
              </Link>
            ))}
          </div>
        </section>,
      );
      continue;
    }

    if (kind === "publication" || kind === "resource") {
      sections.push(
        <section key={block._key || `loose-link-${i}`} className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          {title ? <div className="mb-5"><KentH2>{title}</KentH2></div> : null}
          <div className="space-y-4">
            {items.map((item, idx) => (
              <Link key={item._key || `${item.title}-${idx}`} href={resolveKentHref(String(item?.href || ""))} prefetch={false} className="block rounded-[20px] border border-slate-200 px-5 py-4 transition hover:bg-slate-50">
                <div className="text-lg font-semibold tracking-tight text-slate-900 hover:text-blue-700">{String(item.title || "")}</div>
                {item.subtitle ? <div className="mt-1 text-sm leading-6 text-slate-600">{item.subtitle}</div> : null}
              </Link>
            ))}
          </div>
        </section>,
      );
    }
  }

  return sections.length ? <>{sections}</> : null;
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
          {!prevIsSameSectionHtml ? <KentH2>{title || "Browse categories"}</KentH2> : null}

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
                    {normalizeTitle(String(item.title || ""))}
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
            {items.map((item, idx) => {
              const href = resolveKentHref(String(item.href || ""));
              const hasDestination = href !== "#" && href !== `/products/${BRAND_KEY}`;

              return (
                <div
                  key={item._key || `${item.title}-${idx}`}
                  className="rounded-[22px] border border-slate-200 bg-white px-6 py-5 transition hover:shadow-sm"
                >
                  {hasDestination ? (
                    <Link
                      href={href}
                      prefetch={false}
                      className="block text-lg font-semibold tracking-tight text-slate-900 hover:text-blue-700"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <div className="text-lg font-semibold tracking-tight text-slate-900">{item.title}</div>
                  )}

                  {item.subtitle ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.subtitle}</p>
                  ) : null}

                  {hasDestination ? (
                    <div className="mt-4">
                      <Link
                        href={href}
                        prefetch={false}
                        className={`inline-flex items-center gap-2 text-sm font-semibold ${theme.accentText}`}
                      >
                        Continue Reading <span aria-hidden>›</span>
                      </Link>
                    </div>
                  ) : null}
                </div>
              );
            })}
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
  const taxonomyCategoryForRequest = hasPath ? resolveCurrentKentCategory(pathArr) : null;
  const productSlugs = hasPath
    ? taxonomyCategoryForRequest?.productSlugs || []
    : CURRENT_KENT_TAXONOMY.products.map((product) => product.slug);
  const hasProductScope = productSlugs.length > 0;

  const data = await sanityCdnClient.fetch(PAGE_QUERY, {
    brandKey: BRAND_KEY,
    productType: PRODUCT_DOC_TYPE,
    hasPath,
    pathStr,
    pathArr,
    hasProductScope,
    productSlugs,
  }, PUBLIC_CATALOG_CACHE);

  const brand = data?.brand;
  if (!brand?._id) notFound();

  if (!hasPath) {
    const products: ProductLite[] = Array.isArray(data?.allProducts) ? data.allProducts : [];
    const rootCategories: CategoryLite[] = KENT_STATIC_MENU.flatMap((node, index) => {
      const category = resolveCurrentKentCategory(node.path, undefined, node.title);
      if (!category || category.count <= 0) return [];

      return [{
        _id: `kent-root-category-${category.id}`,
        title: node.title,
        path: node.path,
        order: index,
        summary: "",
      }];
    });
    const featuredSlugs = ["somnosuite", "somnoflo", "coda-monitor", "physiosuite", "rovent", "righttemp"];
    const productBySlug = new Map(products.map((product) => [product.slug, product]));
    const featuredProducts = featuredSlugs
      .map((slug) => productBySlug.get(slug))
      .filter((product): product is ProductLite => Boolean(product));

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
              <section className="rounded-[28px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 px-7 py-8 md:px-9 md:py-10">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Small animal research solutions
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                  Explore Kent Scientific products
                </h2>
                <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600">
                  Browse research equipment, monitoring systems, anesthesia solutions, surgical instruments, and
                  laboratory accessories by product category.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-800">
                    {CURRENT_KENT_TAXONOMY.publishedProductCount} products
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    {rootCategories.length} product categories
                  </span>
                </div>
              </section>

              <KentChildCategoryGrid
                items={rootCategories}
                products={products}
                title="Browse product categories"
                theme={THEME_KENT}
              />

              {featuredProducts.length ? (
                <section className="mt-12 border-t border-slate-200 pt-8">
                  <KentH2>Featured research systems</KentH2>
                  <KentProductGrid products={featuredProducts} theme={THEME_KENT} />
                </section>
              ) : null}
            </main>
          </div>
        </div>
      </div>
    );
  }

  const allCategories: CategoryLite[] = Array.isArray(data?.allCategories) ? data.allCategories : [];
  const taxonomyCategoryForPath = resolveCurrentKentCategory(pathArr);
  let category: CategoryDoc | null = data?.category || null;

  if (!category?._id && taxonomyCategoryForPath?.count) {
    category = {
      _id: `kent-current-taxonomy-${taxonomyCategoryForPath.id}`,
      title: taxonomyCategoryForPath.title,
      path: pathArr,
      sourceUrl: taxonomyCategoryForPath.sourceUrl,
      summary: "",
      legacyHtml: "",
      pageType: "listing",
      contentBlocks: [],
    };
  }

  if (!category?._id) {
    const canonicalPath = findCanonicalCategoryPath(pathArr, allCategories);
    if (canonicalPath && canonicalPath.join("/") !== pathStr) {
      redirect(buildCategoryHref(canonicalPath));
    }
    notFound();
  }

  const allProducts: ProductLite[] = Array.isArray(data?.allProducts) ? data.allProducts : [];
  const currentCategory = resolveCurrentKentCategory(pathArr, category.sourceUrl, category.title);
  if (currentCategory?.count === 0) notFound();
  const productsInCategory = resolveListingProducts(pathArr, category, allProducts);
  const officialProductCount = currentCategory?.count ?? dedupeProducts(productsInCategory).length;
  const directChildren = getDirectChildren(allCategories, pathArr);
  const pageType: PageType = currentCategory
    ? (directChildren.length > 0 ? "landing" : "listing")
    : resolvePageType(category, pathStr, directChildren.length, officialProductCount);

  const pageTitle =
    STATIC_LABEL_BY_PATH.get(pathStr) || normalizeTitle(category.title || "", pathArr[pathArr.length - 1] || "");

  const blocks = hydrateProductCardBlocks(
    coerceContentBlocks(Array.isArray(category.contentBlocks) ? category.contentBlocks : []),
    allProducts,
    allCategories,
  );
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
    } else if (directChildren.length) {
      mainContent = <KentChildCategoryGrid items={directChildren} products={allProducts} title="Explore categories" theme={THEME_KENT} />;
    } else if (category.summary) {
      mainContent = (
        <div
          className={`mt-6 rounded-2xl border ${THEME_KENT.accentBorder} ${THEME_KENT.accentSoftBg} p-6 text-sm leading-7 text-slate-800`}
        >
          {category.summary}
        </div>
      );
    } else {
      mainContent = (
        <div
          className={`mt-6 rounded-2xl border ${THEME_KENT.accentBorder} ${THEME_KENT.accentSoftBg} p-6 text-sm text-slate-800`}
        >
          본문 데이터가 아직 없습니다.
        </div>
      );
    }
  } else {
    mainContent = (
      <>
        <ListingIntro html={firstHtmlBlock?.html} summary={category.summary} />
        <ListingHeader count={officialProductCount} theme={THEME_KENT} />
        {!productsInCategory.length && directChildren.length ? (
          <KentChildCategoryGrid items={directChildren} products={allProducts} title="Subcategories" theme={THEME_KENT} />
        ) : null}
        <KentProductGrid products={productsInCategory} theme={THEME_KENT} />
        {renderedListingTail ? <div className="mt-8">{renderedListingTail}</div> : null}

        {!productsInCategory.length && !directChildren.length && !firstHtmlBlock && !renderedListingTail ? (
          hasFallbackHtml ? (
            <KentHtmlFallback html={fallbackHtml} />
          ) : (
            <div
              className={`mt-6 rounded-2xl border ${THEME_KENT.accentBorder} ${THEME_KENT.accentSoftBg} p-6 text-sm text-slate-800`}
            >
              본문 데이터가 아직 없습니다.
            </div>
          )
        ) : null}
      </>
    );
  }

  const showHero = true;

  return (
    <div>
      {showHero ? <HeroBanner brandTitle={brand.title} /> : null}

      <div className={PAGE_SHELL}>
        <div className={`${showHero ? "mt-6" : "mt-2"} flex justify-end`}>
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <div className={`${showHero ? "mt-10" : "mt-6"} ${CONTENT_LAYOUT}`}>
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
