// app/products/[brand]/[[...path]]/page.tsx
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import NeedAssistance from "@/components/site/NeedAssistance";
import { sanityClient } from "@/lib/sanity/sanity.client";
import { urlFor } from "@/lib/sanity/image";
import { PortableText } from "@portabletext/react";

import sanitizeHtml from "sanitize-html";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * ✅ WordPress 원본 렌더링 전략
 * 1) legacyHtml에 Divi 쇼트코드 흔적이 있으면 -> 텍스트 + 이미지(src)만 뽑아서 간단 HTML로 변환 -> sanitize -> 렌더
 * 2) legacyHtml이 "진짜 HTML"이면 -> sanitize 후 HTML 렌더 (style 제거로 과확대/레이아웃 깨짐 방지)
 * 3) 그 외 -> 텍스트로 처리
 *
 * ✅ 추가: sanitize 단계에서 텍스트 노드에 남아있는 [et_pb_...] 같은 쇼트코드도 textFilter로 제거
 *
 * ✅ UI 개선:
 * - children(하위 카테고리) 있으면 본문 상단에 "타일 그리드"로 노출
 * - children이 없으면 legacyHtml에서 링크(타일 후보) 추출해서 타일 그리드로 노출 (WP처럼)
 */

const WP_BASE = "https://itsbio.co.kr";

function rewriteWpRelativeUrls(html: string) {
  return html
    .replaceAll('src="/', `src="${WP_BASE}/`)
    .replaceAll("src='/", `src='${WP_BASE}/`)
    .replaceAll('href="/', `href="${WP_BASE}/`)
    .replaceAll("href='/", `href='${WP_BASE}/`);
}

function decodeBasicEntities(s: string) {
  return s
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'");
}

function isLikelyHtml(s: string) {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

function isLikelyDiviShortcode(s: string) {
  return /\[et_pb_/i.test(s) || /\[\/et_pb_/i.test(s) || /\[et_pb_section/i.test(s);
}

function sanitizeWpHtml(html: string) {
  const fixed = rewriteWpRelativeUrls(decodeBasicEntities(html));

  return sanitizeHtml(fixed, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "section",
      "article",
      "header",
      "footer",
      "figure",
      "figcaption",
      "span",
      "div",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "hr",
      "br",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "blockquote",
      "a",
      "p",
    ]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
      "*": ["class", "id"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",

    // ✅ HTML 안의 "텍스트 노드"에 남아있는 Divi shortcode도 제거
    textFilter: (text) => {
      return text
        .replace(/\[\/?et_pb[^\]]*\]/gi, " ")
        .replace(/\[\/?et_pb_section[^\]]*\]/gi, " ")
        .replace(/\s{2,}/g, " ");
    },

    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href || "";
        const isExternal = /^https?:\/\//i.test(href);
        return {
          tagName,
          attribs: {
            ...attribs,
            target: isExternal ? "_blank" : attribs.target,
            rel: isExternal ? "noreferrer noopener" : attribs.rel,
          },
        };
      },
      img: (tagName, attribs) => {
        return {
          tagName,
          attribs: {
            ...attribs,
            loading: attribs.loading ?? "lazy",
            decoding: attribs.decoding ?? "async",
          },
        };
      },
    },
  });
}

/**
 * ✅ Divi 쇼트코드 -> 간단 HTML 변환 (완벽 복원 X)
 * - 텍스트는 최대한 남기고
 * - src="..." / image_url="..." 같은 이미지 URL은 뽑아서 <img>로 출력
 */
function extractImageUrlsFromShortcodes(s: string) {
  const out: string[] = [];

  for (const m of s.matchAll(/\bsrc=(["'])(.*?)\1/gi)) out.push(m[2]);
  for (const m of s.matchAll(/\bimage_url=(["'])(.*?)\1/gi)) out.push(m[2]);
  for (const m of s.matchAll(/\bbackground_image=(["'])(.*?)\1/gi)) out.push(m[2]);

  return Array.from(new Set(out)).map((u) => {
    if (u.startsWith("/")) return `${WP_BASE}${u}`;
    if (u.startsWith("//")) return `https:${u}`;
    return u;
  });
}

function stripAllShortcodesToText(s: string) {
  const noShortcodes = s.replace(/\[[^\]]+\]/g, " ");
  return decodeBasicEntities(noShortcodes).replace(/\s{2,}/g, " ").trim();
}

function diviShortcodeToSimpleHtml(s: string) {
  const fixed = rewriteWpRelativeUrls(decodeBasicEntities(s));
  const images = extractImageUrlsFromShortcodes(fixed);
  const text = stripAllShortcodesToText(fixed);

  const parts: string[] = [];

  if (text) {
    const paras = text
      .split(/\n{2,}|\r\n{2,}/g)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const p of paras) {
      parts.push(`<p>${sanitizeHtml(p, { allowedTags: [], allowedAttributes: {} })}</p>`);
    }
  }

  if (images.length) {
    for (const url of images) {
      const safeUrl = sanitizeHtml(url, { allowedTags: [], allowedAttributes: {} });
      parts.push(`<p><img src="${safeUrl}" alt="" loading="lazy" decoding="async" /></p>`);
    }
  }

  if (!parts.length) {
    const fallback = sanitizeHtml(stripAllShortcodesToText(fixed).slice(0, 800), {
      allowedTags: [],
      allowedAttributes: {},
    });
    parts.push(`<p>${fallback || "(내용 없음)"}</p>`);
  }

  return parts.join("\n");
}

/** -----------------------------
 * ✅ 타일(카드)용 링크 추출 + WP page_id 매핑
 * ------------------------------*/
type TileLink = { title: string; href: string; wpId?: string };

function stripTags(s: string) {
  return s.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim();
}

function getWpPageId(url: string) {
  // https://itsbio.co.kr/?page_id=16514
  const m = url.match(/[?&]page_id=(\d+)/i);
  return m?.[1];
}

function isBadTileTitle(t: string) {
  const x = t.trim();
  if (!x) return true;
  if (x.length < 2) return true;
  if (x.length > 60) return true;
  // 메뉴/노이즈 같은 것 제외
  const bad = ["home", "notice", "contact", "about", "promotions", "products & service", "resources & support"];
  if (bad.includes(x.toLowerCase())) return true;
  return false;
}

function extractTileLinksFromLegacy(raw: string): TileLink[] {
  const s = rewriteWpRelativeUrls(decodeBasicEntities(raw));
  const out: TileLink[] = [];

  // 1) HTML <a> ... </a> 추출
  for (const m of s.matchAll(/<a[^>]+href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = (m[2] ?? "").trim();
    const title = stripTags(m[3] ?? "");
    if (!href || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    if (isBadTileTitle(title)) continue;
    out.push({ title, href, wpId: getWpPageId(href) });
  }

  // 2) Divi shortcode 내부 title/url 패턴 (예: [et_pb_blurb title="..." url="..."])
  for (const m of s.matchAll(/\[et_pb_[^\]]*?\btitle=(["'])(.*?)\1[^\]]*?\burl=(["'])(.*?)\3[^\]]*\]/gi)) {
    const title = (m[2] ?? "").trim();
    const href = (m[4] ?? "").trim();
    if (!href || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    if (isBadTileTitle(title)) continue;
    out.push({ title, href, wpId: getWpPageId(href) });
  }
  for (const m of s.matchAll(/\[et_pb_[^\]]*?\burl=(["'])(.*?)\1[^\]]*?\btitle=(["'])(.*?)\3[^\]]*\]/gi)) {
    const href = (m[2] ?? "").trim();
    const title = (m[4] ?? "").trim();
    if (!href || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    if (isBadTileTitle(title)) continue;
    out.push({ title, href, wpId: getWpPageId(href) });
  }

  // 중복 제거 (title+href)
  const seen = new Set<string>();
  const uniq: TileLink[] = [];
  for (const x of out) {
    const key = `${x.title}@@${x.href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(x);
  }

  // 너무 많이 나오면 상위 몇 개만 (타일 느낌)
  return uniq.slice(0, 24);
}

// ✅ brandKey는 themeKey 우선, 없으면 slug로도 매칭(안전장치)
const BRAND_QUERY = `
*[_type == "brand" && (themeKey == $brandKey || slug.current == $brandKey)][0]{
  _id,
  title,
  themeKey,
  "slug": slug.current
}
`;

// ✅ path 완전일치 OR (현재 데이터가 1세그먼트일 때) 마지막 세그먼트로 fallback
const CATEGORY_QUERY = `
*[
  _type == "category"
  && (brand->themeKey == $brandKey || brand->slug.current == $brandKey)
  && (
    path == $path
    || (count(path) == 1 && path[0] == $last)
  )
][0]{
  _id,
  title,
  path,
  summary,
  heroImage,
  body,
  legacyHtml,
  sourceWpId,
  order,
  parent,
  attachments[]{
    _key,
    asset->{
      url,
      originalFilename,
      mimeType,
      size
    }
  }
}
`;

const ROOT_CATEGORIES_QUERY = `
*[
  _type == "category"
  && (brand->themeKey == $brandKey || brand->slug.current == $brandKey)
  && !defined(parent)
]
| order(order asc, title asc) {
  _id,
  title,
  path,
  order
}
`;

const CHILD_CATEGORIES_QUERY = `
*[
  _type == "category"
  && (brand->themeKey == $brandKey || brand->slug.current == $brandKey)
  && parent._ref == $parentId
]
| order(order asc, title asc) {
  _id,
  title,
  path,
  order
}
`;

const PRODUCTS_BY_CATEGORY_QUERY = `
*[_type == "product" && isActive == true && category._ref == $categoryId]
| order(title asc) {
  _id, title, "slug": slug.current, catalogNo, summary, image
}
`;

const PRODUCTS_BY_BRAND_NO_CATEGORY_QUERY = `
*[
  _type == "product"
  && isActive == true
  && (brand->themeKey == $brandKey || brand->slug.current == $brandKey)
  && !defined(category)
]
| order(title asc) {
  _id, title, "slug": slug.current, catalogNo, summary, image
}
`;

// ✅ WP page_id(=sourceWpId)로 내부 카테고리 매핑하기 위해 브랜드 카테고리 목록 확보
const ALL_CATEGORIES_BY_BRAND_QUERY = `
*[
  _type == "category"
  && (brand->themeKey == $brandKey || brand->slug.current == $brandKey)
]{
  _id,
  title,
  path,
  sourceWpId
}
`;

function buildHref(brandKey: string, path: string[]) {
  return path.length ? `/products/${brandKey}/${path.join("/")}` : `/products/${brandKey}`;
}

function formatSize(bytes?: number) {
  if (typeof bytes !== "number" || Number.isNaN(bytes)) return "";
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

const PROSE_CLASS = [
  "prose max-w-none",
  "prose-headings:scroll-mt-24",
  "prose-headings:font-semibold prose-headings:text-slate-900",
  "prose-p:text-slate-700 prose-p:leading-7",
  "prose-strong:text-slate-900",
  "prose-a:text-slate-900 prose-a:underline-offset-4 hover:prose-a:underline",
  "prose-li:text-slate-700",
  "prose-hr:border-slate-200",
  "prose-table:w-full prose-table:overflow-hidden",
  "prose-th:bg-slate-50 prose-th:text-slate-900 prose-th:font-semibold",
  "prose-td:text-slate-700",
  "[&_img]:max-w-full [&_img]:h-auto [&_img]:object-contain [&_img]:rounded-xl",
  "[&_img]:border [&_img]:bg-white",
  "[&_img]:max-h-[520px]",
  "prose-blockquote:border-l-slate-300 prose-blockquote:text-slate-700",
].join(" ");

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-2xl border border-slate-200 bg-white shadow-sm",
        "hover:shadow-md hover:border-slate-300 transition",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function TileGrid({
  items,
  brandKey,
}: {
  items: Array<{ title: string; href: string; isExternal?: boolean }>;
  brandKey: string;
}) {
  if (!items?.length) return null;

  return (
    <section className="mt-6">
      <SectionTitle title="Browse" subtitle="Quick sections" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((x, idx) => {
          const content = (
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="line-clamp-2 text-center text-sm font-semibold text-slate-900">
                    {x.title}
                  </div>
                </div>
                <div className="rounded-full border bg-slate-50 px-2 py-1 text-xs text-slate-600">
                  View
                </div>
              </div>
            </Card>
          );

          if (x.isExternal) {
            return (
              <a
                key={`${x.href}-${idx}`}
                href={x.href}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                {content}
              </a>
            );
          }

          return (
            <Link key={`${x.href}-${idx}`} href={x.href} className="block">
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default async function ProductsBrandPathPage({
  params,
}: {
  params: Promise<{ brand: string; path?: string[] }> | { brand: string; path?: string[] };
}) {
  const resolved = await Promise.resolve(params as any);
  const brandKey = (resolved?.brand ?? "").toLowerCase();
  const path = (resolved?.path ?? []) as string[];

  if (!brandKey) notFound();

  // 1) brand 확인
  const brand = await sanityClient.fetch(BRAND_QUERY, { brandKey });
  if (!brand?._id) notFound();

  // 2) /products/{brand}
  if (path.length === 0) {
    const rootCats = await sanityClient.fetch(ROOT_CATEGORIES_QUERY, { brandKey });
    const uncategorized = await sanityClient.fetch(PRODUCTS_BY_BRAND_NO_CATEGORY_QUERY, { brandKey });

    return (
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-3xl border bg-gradient-to-b from-slate-50 to-white p-7 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full border bg-white px-3 py-1">Products</span>
            <span className="rounded-full border bg-white px-3 py-1">{brand.title}</span>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {brand.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Browse categories and products for this brand.
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Request a Quote
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center justify-center rounded-full border bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                All Brands
              </Link>
            </div>
          </div>
        </div>

        <section className="mt-10">
          <SectionTitle
            title="Categories"
            subtitle={rootCats?.length ? `Top-level categories (${rootCats.length})` : "No categories yet"}
          />

          {rootCats?.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {rootCats.map((c: any) => (
                <Link key={c._id} href={buildHref(brandKey, c.path)} className="block">
                  <Card className="p-5">
                    <div className="text-center text-sm font-semibold text-slate-900">{c.title}</div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="mt-4 p-6">
              <div className="text-sm text-slate-600">
                아직 이 브랜드의 최상위 카테고리가 없습니다. (category 문서를 만들어주세요)
              </div>
            </Card>
          )}
        </section>

        {uncategorized?.length ? (
          <section className="mt-10">
            <SectionTitle title="Products" subtitle={`Uncategorized products (${uncategorized.length})`} />
            <div className="mt-4 grid gap-4">
              {uncategorized.map((p: any) => {
                const href = p.slug ? `/products/${p.slug}` : "#";
                const imgUrl = p.image ? urlFor(p.image as any).width(420).height(420).fit("max").url() : "";

                return (
                  <Link key={p._id} href={href} className="block">
                    <Card className="p-5">
                      <div className="flex gap-4">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white">
                          {imgUrl ? (
                            <Image src={imgUrl} alt={p.title} fill className="object-contain p-2" sizes="64px" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-400">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-base font-semibold text-slate-900">{p.title}</div>
                            {p.catalogNo ? (
                              <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                                {p.catalogNo}
                              </span>
                            ) : null}
                          </div>
                          {p.summary ? (
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{p.summary}</p>
                          ) : (
                            <p className="mt-2 text-sm text-slate-500">View product details</p>
                          )}
                        </div>
                        <div className="hidden shrink-0 items-center text-slate-400 sm:flex">→</div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="mt-14">
          <NeedAssistance />
        </div>
      </main>
    );
  }

  // 3) /products/{brand}/... (카테고리)
  const last = path[path.length - 1] ?? "";
  const category = await sanityClient.fetch(CATEGORY_QUERY, { brandKey, path, last });
  if (!category?._id) notFound();

  const children = await sanityClient.fetch(CHILD_CATEGORIES_QUERY, { brandKey, parentId: category._id });
  const products = await sanityClient.fetch(PRODUCTS_BY_CATEGORY_QUERY, { categoryId: category._id });

  const legacyRaw = typeof category.legacyHtml === "string" ? category.legacyHtml.trim() : "";

  // ✅ legacy html -> safe html
  let safeHtml = "";
  if (legacyRaw) {
    if (isLikelyDiviShortcode(legacyRaw)) {
      const simple = diviShortcodeToSimpleHtml(legacyRaw);
      safeHtml = sanitizeWpHtml(simple);
    } else if (isLikelyHtml(legacyRaw)) {
      safeHtml = sanitizeWpHtml(legacyRaw);
    } else {
      const asText = sanitizeHtml(decodeBasicEntities(legacyRaw), { allowedTags: [], allowedAttributes: {} });
      safeHtml = `<p>${asText}</p>`;
    }
  }

  // ✅ 타일 데이터 만들기:
  // 1) children 있으면 -> children을 타일로
  // 2) children 없으면 -> legacy에서 링크 추출 후 sourceWpId 매핑해서 내부 링크로 변환
  let tileItems: Array<{ title: string; href: string; isExternal?: boolean }> = [];

  if (children?.length) {
    tileItems = children.map((c: any) => ({
      title: c.title,
      href: buildHref(brandKey, c.path),
    }));
  } else if (legacyRaw) {
    const allCats = await sanityClient.fetch(ALL_CATEGORIES_BY_BRAND_QUERY, { brandKey });
    const wpIdToPath = new Map<string, string[]>();
    for (const c of allCats ?? []) {
      if (c?.sourceWpId && Array.isArray(c?.path)) wpIdToPath.set(String(c.sourceWpId), c.path);
    }

    const links = extractTileLinksFromLegacy(legacyRaw);

    tileItems = links.map((x) => {
      // WP page_id -> 내부 카테고리 path로 매핑 가능하면 내부 링크로
      if (x.wpId && wpIdToPath.has(x.wpId)) {
        return {
          title: x.title,
          href: buildHref(brandKey, wpIdToPath.get(x.wpId)!),
        };
      }
      // 매핑 못 하면 외부 WP 링크로
      const href = x.href.startsWith("/") ? `${WP_BASE}${x.href}` : x.href;
      return {
        title: x.title,
        href,
        isExternal: true,
      };
    });
  }

  const heroUrl = category.heroImage
    ? urlFor(category.heroImage as any).width(1600).height(520).fit("crop").url()
    : "";

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      {/* Header / Breadcrumb */}
      <div className="rounded-3xl border bg-gradient-to-b from-slate-50 to-white p-7 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Link href={`/products/${brandKey}`} className="rounded-full border bg-white px-3 py-1 hover:bg-slate-50">
            {brand.title}
          </Link>
          <span className="text-slate-300">/</span>
          <span className="rounded-full border bg-white px-3 py-1">{path.join(" / ")}</span>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{category.title}</h1>
            {category.summary ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{category.summary}</p>
            ) : (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Explore sub sections, details, and products under this category.
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Request a Quote
              </Link>
              <Link
                href={`/products/${brandKey}`}
                className="inline-flex items-center justify-center rounded-full border bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Back to {brand.title}
              </Link>
            </div>
          </div>

          <div className="lg:col-span-4">
            {heroUrl ? (
              <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border bg-white">
                <Image
                  src={heroUrl}
                  alt={category.title}
                  fill
                  className="object-cover"
                  sizes="(min-width:1024px) 33vw, 100vw"
                />
              </div>
            ) : (
              <div className="flex aspect-[16/9] items-center justify-center rounded-2xl border bg-white text-xs text-slate-400">
                No hero image
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        {/* Main */}
        <section className="lg:col-span-8">
          {/* ✅ WP처럼 "타일 그리드"를 본문 상단에 */}
          <TileGrid items={tileItems} brandKey={brandKey} />

          <Card className="mt-8 p-6">
            <SectionTitle title="Overview" subtitle="Category description and details" />
            <div className="mt-5">
              {safeHtml ? (
                <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: safeHtml }} />
              ) : category.body?.length ? (
                <div className={PROSE_CLASS}>
                  <PortableText value={category.body} />
                </div>
              ) : (
                <div className="rounded-2xl border bg-slate-50 p-6 text-sm text-slate-600">(설명 내용이 없습니다)</div>
              )}
            </div>
          </Card>

          {/* Products */}
          <section className="mt-8">
            <SectionTitle
              title="Products"
              subtitle={products?.length ? `Products in this category (${products.length})` : "No products linked yet"}
            />
            {!products?.length ? (
              <Card className="mt-4 p-6">
                <div className="text-sm text-slate-600">
                  아직 이 카테고리에 연결된 제품이 없습니다. (product 문서에서 Category를 지정해 주세요)
                </div>
              </Card>
            ) : (
              <div className="mt-4 grid gap-4">
                {products.map((p: any) => {
                  const href = p.slug ? `/products/${p.slug}` : "#";
                  const imgUrl = p.image ? urlFor(p.image as any).width(520).height(520).fit("max").url() : "";

                  return (
                    <Link key={p._id} href={href} className="block">
                      <Card className="p-5">
                        <div className="flex gap-4">
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white">
                            {imgUrl ? (
                              <Image src={imgUrl} alt={p.title} fill className="object-contain p-2" sizes="64px" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-400">
                                No image
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-base font-semibold text-slate-900">{p.title}</div>
                              {p.catalogNo ? (
                                <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                                  {p.catalogNo}
                                </span>
                              ) : null}
                            </div>
                            {p.summary ? (
                              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{p.summary}</p>
                            ) : (
                              <p className="mt-2 text-sm text-slate-500">View product details</p>
                            )}
                          </div>
                          <div className="hidden shrink-0 items-center text-slate-400 sm:flex">→</div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </section>

        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-8">
          <Card className="p-6">
            <SectionTitle title="Sub Categories" subtitle={children?.length ? `${children.length} items` : "No sub categories"} />
            {children?.length ? (
              <div className="mt-4 space-y-2">
                {children.map((c: any) => (
                  <Link
                    key={c._id}
                    href={buildHref(brandKey, c.path)}
                    className="group flex items-center justify-between rounded-xl border bg-white px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{c.title}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{c.path.join(" / ")}</div>
                    </div>
                    <div className="text-slate-300 group-hover:text-slate-500">→</div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-600">하위 카테고리가 없습니다.</div>
            )}
          </Card>

          <Card className="p-6">
            <SectionTitle title="Attachments" subtitle={category.attachments?.length ? `${category.attachments.length} files` : "No files"} />
            {category.attachments?.length ? (
              <ul className="mt-4 space-y-2 text-sm">
                {category.attachments.map((a: any) => (
                  <li key={a._key} className="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3">
                    <a className="min-w-0 truncate font-medium text-slate-900 hover:underline" href={a.asset.url} target="_blank" rel="noreferrer">
                      {a.asset.originalFilename}
                    </a>
                    <span className="shrink-0 text-xs text-slate-500">{formatSize(a.asset.size)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 text-sm text-slate-600">첨부파일이 없습니다.</div>
            )}
          </Card>
        </aside>
      </div>

      <div className="mt-14">
        <NeedAssistance />
      </div>
    </main>
  );
}
