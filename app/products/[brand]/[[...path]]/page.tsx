// app/products/[brand]/[[...path]]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/site/Breadcrumb";
import { sanityClient } from "@/lib/sanity/sanity.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const THEME = {
  accentBg: "bg-orange-500",
  accentText: "text-orange-600",
  accentBorder: "border-orange-200",
  accentSoftBg: "bg-orange-50",
};

function buildHref(brandKey: string, path: string[]) {
  return path.length ? `/products/${brandKey}/${path.join("/")}` : `/products/${brandKey}`;
}

function humanizeSegment(seg: string) {
  return (seg || "").replaceAll("-", " ").replaceAll("_", " ").trim();
}

function stripBrandSuffix(title: string) {
  const t = (title || "").trim();
  const idx = t.indexOf("|");
  return (idx >= 0 ? t.slice(0, idx) : t).trim();
}

/**
 * ✅ 외부 링크/ABM 링크를 우리 라우팅(legacy)로 강제
 * - resources 카드 클릭 시: /products/{brand}/legacy?u=...
 * - html 본문 내 <a href="https://..."> 도 동일하게 변환
 */
function legacyHref(brandKey: string, url: string) {
  return `/products/${brandKey}/legacy?u=${encodeURIComponent(url)}`;
}

/** -------------------- GROQ -------------------- */

const BRAND_QUERY = `
*[_type == "brand" && (themeKey == $brandKey || slug.current == $brandKey)][0]{
  _id, title, themeKey, "slug": slug.current
}
`;

const ROOT_CATEGORIES_QUERY = `
*[
  _type == "category"
  && (
    themeKey == $brandKey
    || brand->themeKey == $brandKey
    || brand->slug.current == $brandKey
  )
  && count(path) == 1
]
| order(order asc, title asc) { _id, title, path, order }
`;

const CATEGORY_BY_PATHSTR_QUERY = `
*[
  _type == "category"
  && (
    themeKey == $brandKey
    || brand->themeKey == $brandKey
    || brand->slug.current == $brandKey
  )
  && array::join(path, "/") == $pathStr
][0]{
  _id,
  title,
  path,
  sourceUrl,
  contentBlocks[] {
    _key,
    _type,
    title,
    html,
    items[]
  }
}
`;

const DESCENDANTS_BY_PREFIX_QUERY = `
*[
  _type == "category"
  && (
    themeKey == $brandKey
    || brand->themeKey == $brandKey
    || brand->slug.current == $brandKey
  )
  && count(path) > $depth
  && array::join(path[0..$end], "/") == $prefix
]
| order(order asc, title asc) { _id, title, path, order }
`;

type CatLite = { _id: string; title: string; path: string[]; order?: number };

async function fetchImmediateChildren(brandKey: string, path: string[]) {
  if (!path.length) return [] as Array<CatLite & { isVirtual?: boolean }>;

  const depth = path.length;
  const end = depth - 1;
  const prefix = path.join("/");

  const descendants: CatLite[] = await sanityClient.fetch(DESCENDANTS_BY_PREFIX_QUERY, {
    brandKey,
    depth,
    end,
    prefix,
  });

  const nextIndex = depth;
  const map = new Map<string, (CatLite & { isVirtual?: boolean })>();

  for (const d of descendants) {
    const seg = d.path?.[nextIndex];
    if (!seg) continue;

    const childPath = [...path, seg];

    if (!map.has(seg)) {
      map.set(seg, {
        _id: `virtual-${seg}`,
        title: humanizeSegment(seg),
        path: childPath,
        order: d.order,
        isVirtual: true,
      });
    }

    if (Array.isArray(d.path) && d.path.length === childPath.length) {
      map.set(seg, {
        _id: d._id,
        title: d.title || humanizeSegment(seg),
        path: d.path,
        order: d.order,
        isVirtual: false,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const ao = typeof a.order === "number" ? a.order : 999999;
    const bo = typeof b.order === "number" ? b.order : 999999;
    if (ao !== bo) return ao - bo;
    return String(a.title).localeCompare(String(b.title));
  });
}

/** -------------------- ABM HTML sanitize/rewrite -------------------- */

function getBaseUrlForBrand(brandKey: string) {
  if (brandKey === "abm") return "https://www.abmgood.com";
  return "";
}

function rewriteRelativeUrls(html: string, baseUrl: string) {
  if (!html) return "";
  if (!baseUrl) return html;

  let out = html.replace(
    /\s(href|src)=["'](\/(?!\/)[^"']*)["']/gi,
    (_m, attr, p) => ` ${attr}="${baseUrl}${p}"`
  );

  out = out.replace(/\s(href|src)=["'](\/\/[^"']+)["']/gi, (_m, attr, p2) => ` ${attr}="https:${p2}"`);
  return out;
}

function stripUnwantedAbmNav(html: string) {
  if (!html) return "";
  let out = html;

  // ✅ 상단 카테고리 네비 리스트 제거
  out = out.replace(
    /<ul[^>]*class=["'][^"']*\babm-page-category-nav-list\b[^"']*["'][\s\S]*?<\/ul>/gi,
    ""
  );

  // ✅ Resource 섹션(ABM 원본 HTML) 제거: h3(Resource) ~ htmlcontent-home 구간 싹 제거
  out = out.replace(
    /<h3[^>]*>[\s\S]*?\bResource\b[\s\S]*?<\/h3>[\s\S]*?<ul[^>]*class=["'][^"']*\bhtmlcontent-home\b[^"']*["'][\s\S]*?<\/ul>[\s\S]*?(?=<h3\b|$)/gi,
    ""
  );

  // ✅ Top Publications 섹션(ABM 원본 HTML) 제거: h3(Top Publications) ~ citations 테이블 구간 싹 제거
  out = out.replace(
    /<h3[^>]*>[\s\S]*?\bTop\s*Publications\b[\s\S]*?<\/h3>[\s\S]*?<table[\s\S]*?<\/table>[\s\S]*?(?=<h3\b|$)/gi,
    ""
  );

  // JSON-LD 제거
  out = out.replace(/<script[^>]*type=["']application\/ld\+json["'][\s\S]*?<\/script>/gi, "");
  // 남은 script 제거
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");

  // “검은 글씨 Resources/Top Publications” 텍스트 찌꺼기 제거 (혹시 남아도 제거)
  out = out.replace(/(^|\n)\s*(Resources|Resource)\s*(\n|$)/gi, "\n");
  out = out.replace(/(^|\n)\s*Top\s*Publications\s*(\n|$)/gi, "\n");
  
  out = out.replace(/<(p|div|span)[^>]*>\s*(Resources|Resource)\s*<\/\1>/gi, "");
  out = out.replace(/<(p|div|span)[^>]*>\s*Top\s*Publications\s*<\/\1>/gi, "");

  // ✅ 혹시 태그 없이 그냥 텍스트 노드로 섞여도 제거
  out = out.replace(/(^|>|\n)\s*(Resources|Resource)\s*(?=<|\n|$)/gi, "$1");
  out = out.replace(/(^|>|\n)\s*Top\s*Publications\s*(?=<|\n|$)/gi, "$1");

  return out;
}

function rewriteAnchorsToLegacy(html: string, brandKey: string) {
  if (!html) return "";
  // https://... 링크를 legacy 라우트로 강제
  return html.replace(/\shref=["'](https?:\/\/[^"']+)["']/gi, (_m, url) => {
    return ` href="${legacyHref(brandKey, url)}"`;
  });
}

function safeHtmlForRender(html: string, brandKey: string) {
  const baseUrl = getBaseUrlForBrand(brandKey);
  let out = html || "";
  out = stripUnwantedAbmNav(out);
  out = rewriteRelativeUrls(out, baseUrl);
  out = rewriteAnchorsToLegacy(out, brandKey);
  return out.trim();
}

/** -------------------- UI -------------------- */

function HeroBanner({ brandTitle }: { brandTitle: string }) {
  return (
    <section className="relative">
      <div className="relative h-[220px] w-full overflow-hidden md:h-[280px]">
        <Image src="/hero.png" alt="Products hero" fill priority className="object-cover" />
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-transparent to-transparent" />

        <div className="absolute inset-0">
          <div className="mx-auto flex h-full max-w-6xl items-center px-6">
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

function SideNavTree({
  brandKey,
  roots,
  activePath,
  activeRootChildren,
}: {
  brandKey: string;
  roots: CatLite[];
  activePath: string[];
  activeRootChildren: CatLite[];
}) {
  const activeRoot = activePath[0] || "";
  const activePathStr = activePath.join("/");

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-5 py-4">
        <div className="text-sm font-semibold text-neutral-900">All Products</div>
      </div>

      <div className="p-2">
        <div className="space-y-1">
          {roots.map((r) => {
            const isActive = r.path[0] === activeRoot;
            return (
              <Link
                key={r._id}
                href={buildHref(brandKey, r.path)}
                className={[
                  "flex items-center justify-between rounded-xl px-3 py-2 text-sm",
                  isActive ? `${THEME.accentBg} text-white` : "text-neutral-700 hover:bg-neutral-50",
                ].join(" ")}
              >
                <span className="min-w-0 truncate">{stripBrandSuffix(r.title)}</span>
                <span className={isActive ? "text-white/80" : "text-neutral-300"}>›</span>
              </Link>
            );
          })}
        </div>

        {activeRoot && activeRootChildren.length ? (
          <div className="mt-2 border-t border-neutral-200 pt-2">
            <div className={`px-3 py-2 text-xs font-semibold tracking-wide ${THEME.accentText}`}>
              {humanizeSegment(activeRoot)}
            </div>

            <div className="space-y-1">
              {activeRootChildren.map((c) => {
                const p = c.path.join("/");
                const isActive = activePathStr === p;

                return (
                  <Link
                    key={c._id}
                    href={buildHref(brandKey, c.path)}
                    className={[
                      "ml-2 flex items-center justify-between rounded-xl px-3 py-2 text-sm",
                      isActive ? `${THEME.accentBg} text-white` : "text-neutral-700 hover:bg-neutral-50",
                    ].join(" ")}
                  >
                    <span className="min-w-0 truncate">{stripBrandSuffix(c.title)}</span>
                    <span className={isActive ? "text-white/80" : "text-neutral-300"}>›</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HtmlBlock({ html, brandKey }: { html: string; brandKey: string }) {
  const cleaned = safeHtmlForRender(html, brandKey);
  if (!cleaned) return null;

  return (
    <section className="mt-8">
      <div
        className="prose prose-neutral max-w-none prose-a:text-orange-600 prose-a:underline prose-img:rounded-xl prose-img:border prose-img:border-neutral-200"
        dangerouslySetInnerHTML={{ __html: cleaned }}
      />
    </section>
  );
}

function ResourceSection({
  items,
  brandKey,
}: {
  items: Array<{ key: string; title: string; subtitle?: string; href: string; imageUrl?: string }>;
  brandKey: string;
}) {
  const safeItems = items.filter((x) => typeof x?.href === "string" && x.href.trim().length > 0);
  if (!safeItems.length) return null;

  return (
    <section className="mt-10">
      <h3 className={`text-xl font-semibold ${THEME.accentText}`}>Resources</h3>

      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {safeItems.map((x) => (
          <Link key={x.key} href={legacyHref(brandKey, x.href)} className="block">
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-300 hover:shadow-md">
              <div className="overflow-hidden rounded-t-2xl bg-neutral-100">
                <div className="relative aspect-[16/9] w-full">
                  {x.imageUrl ? (
                    // ✅ 외부호스트 next/image 설정 이슈 방지: img 유지 (무너짐 방지)
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={x.imageUrl}
                      alt={x.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0" />
                  )}
                </div>
              </div>

              <div className="p-5">
                <div className="text-base font-semibold text-neutral-900 leading-snug line-clamp-2">
                  {stripBrandSuffix(x.title)}
                </div>
                <div className="mt-2 text-sm italic text-neutral-600 line-clamp-1">
                  {x.subtitle || "Learning Resources"}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TopPublicationsSection({
  items,
}: {
  items: Array<{ key: string; order?: number; citation?: string; doi?: string; product?: string }>;
}) {
  const safeItems = items.filter((x) => typeof x?.citation === "string" && x.citation.trim().length > 0);
  if (!safeItems.length) return null;

  const sorted = [...safeItems].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  return (
    <section className="mt-14">
      <h3 className={`text-2xl font-semibold ${THEME.accentText}`}>Top Publications</h3>

      <div className="mt-6 space-y-5">
        {sorted.map((p, idx) => {
          const no = String(p.order ?? idx + 1).padStart(2, "0");
          return (
            <div key={p.key} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex gap-5">
                <div className="w-14 shrink-0">
                  <div className={`text-3xl font-semibold ${THEME.accentText}`}>{no}</div>
                  <div className="mt-2 h-[2px] w-10 bg-orange-500" />
                </div>

                <div className="min-w-0">
                  <div className="text-sm leading-6 text-neutral-900 whitespace-pre-line">{p.citation}</div>

                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    {p.doi ? (
                      <a
                        href={p.doi}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-orange-600 underline underline-offset-4"
                      >
                        DOI
                      </a>
                    ) : null}

                    {p.product ? (
                      <div className="text-neutral-800">
                        <span className="font-semibold">Product:</span> {p.product}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** -------------------- contentBlocks renderer -------------------- */

function normalizeResourceItems(rawItems: any[]) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .filter(Boolean)
    .map((it: any, i: number) => {
      const href = typeof it?.href === "string" ? it.href.trim() : "";
      const title = typeof it?.title === "string" ? it.title.trim() : "";
      const subtitle = typeof it?.subtitle === "string" ? it.subtitle.trim() : "";
      const imageUrl = typeof it?.imageUrl === "string" ? it.imageUrl.trim() : "";

      return {
        key: it?._key || `${title}-${href}-${i}`,
        title: title || "(untitled)",
        subtitle,
        href,
        imageUrl,
      };
    })
    .filter((x) => x.href);
}

function normalizePubItems(rawItems: any[]) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .filter(Boolean)
    .map((it: any, i: number) => {
      const order = typeof it?.order === "number" ? it.order : undefined;
      const citation = typeof it?.citation === "string" ? it.citation.trim() : "";
      const doi = typeof it?.doi === "string" ? it.doi.trim() : "";
      const product = typeof it?.product === "string" ? it.product.trim() : "";

      return {
        key: it?._key || `${order ?? i}-${citation.slice(0, 16)}`,
        order,
        citation,
        doi,
        product,
      };
    })
    .filter((x) => x.citation);
}

function normalizeBullets(rawItems: any[]) {
  const arr = Array.isArray(rawItems) ? rawItems : [];
  const txt = arr
    .map((x: any) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean)
    // ✅ Genetic에서 검은 라벨로 뜨는 찌꺼기 제거
    .filter((t: string) => !/^resources?$|^top\s*publications$/i.test(t));
  return txt;
}

function BulletsSection({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <ul className="list-disc space-y-2 pl-5 text-neutral-800 leading-7">
        {items.map((t, i) => (
          <li key={`${t}-${i}`}>{t}</li>
        ))}
      </ul>
    </section>
  );
}

function renderContentBlocks(blocks: any[], brandKey: string) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  // ✅ 중복 렌더 방지(같은 타입이 여러 번 있으면 1번만)
  let renderedHtml = false;
  let renderedResources = false;
  let renderedPubs = false;
  let renderedBullets = false;

  return (
    <>
      {blocks.map((b: any) => {
        const type = b?._type;

        if (type === "contentBlockHtml") {
          if (renderedHtml) return null;
          renderedHtml = true;
          const html = typeof b?.html === "string" ? b.html : "";
          return <HtmlBlock key={b._key || "html"} html={html} brandKey={brandKey} />;
        }

        if (type === "contentBlockBullets") {
          if (renderedBullets) return null;
          renderedBullets = true;
          const items = normalizeBullets(b?.items ?? []);
          return (
            <div key={b._key || "bullets"}>
              <BulletsSection items={items} />
            </div>
          );
        }

        if (type === "contentBlockResources") {
          if (renderedResources) return null;
          renderedResources = true;
          const items = normalizeResourceItems(b?.items ?? []);
          return (
            <div key={b._key || "resources"}>
              <ResourceSection items={items} brandKey={brandKey} />
            </div>
          );
        }

        if (type === "contentBlockPublications") {
          if (renderedPubs) return null;
          renderedPubs = true;
          const items = normalizePubItems(b?.items ?? []);
          return (
            <div key={b._key || "pubs"}>
              <TopPublicationsSection items={items} />
            </div>
          );
        }

        return null;
      })}
    </>
  );
}

/** -------------------- Page -------------------- */

export default async function ProductsBrandPathPage({
  params,
}: {
  params: Promise<{ brand: string; path?: string[] }> | { brand: string; path?: string[] };
}) {
  const resolved = await Promise.resolve(params as any);
  const brandKey = (resolved?.brand ?? "").toLowerCase();
  const path = (resolved?.path ?? []) as string[];

  if (!brandKey) notFound();

  const brand = await sanityClient.fetch(BRAND_QUERY, { brandKey });
  if (!brand?._id) notFound();

  const roots: CatLite[] = await sanityClient.fetch(ROOT_CATEGORIES_QUERY, { brandKey });

  if (!path.length) {
    const breadcrumbItems = [
      { label: "Home", href: "/" },
      { label: "Products", href: "/products" },
      { label: brand.title, href: `/products/${brandKey}` },
    ];

    return (
      <div>
        <HeroBanner brandTitle={brand.title} />

        <div className="mx-auto max-w-6xl px-6">
          <div className="mt-6 flex justify-end">
            <Breadcrumb items={breadcrumbItems} />
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-12">
            <aside className="lg:col-span-4">
              <SideNavTree brandKey={brandKey} roots={roots} activePath={[]} activeRootChildren={[]} />
            </aside>

            <main className="lg:col-span-8">
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Select a category</h2>
              <p className="mt-3 text-neutral-700 leading-7">Please choose a category from the left menu.</p>
            </main>
          </div>
        </div>
      </div>
    );
  }

  const pathStr = path.join("/");
  const category = await sanityClient.fetch(CATEGORY_BY_PATHSTR_QUERY, { brandKey, pathStr });

  const childrenHere = await fetchImmediateChildren(brandKey, path);
  if (!category?._id && (!childrenHere || childrenHere.length === 0)) notFound();

  const activeRoot = path[0];
  const activeRootChildren = activeRoot ? await fetchImmediateChildren(brandKey, [activeRoot]) : [];

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: brand.title, href: `/products/${brandKey}` },
    ...path.map((seg: string, i: number) => ({
      label: humanizeSegment(seg),
      href: buildHref(brandKey, path.slice(0, i + 1)),
    })),
  ];

  const pageTitle = stripBrandSuffix(category?.title || humanizeSegment(path[path.length - 1] || ""));
  const blocks = Array.isArray(category?.contentBlocks) ? category.contentBlocks : [];

  return (
    <div>
      <HeroBanner brandTitle={brand.title} />

      <div className="mx-auto max-w-6xl px-6">
        <div className="mt-6 flex justify-end">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-12">
          <aside className="lg:col-span-4">
            <SideNavTree
              brandKey={brandKey}
              roots={roots}
              activePath={path}
              activeRootChildren={activeRootChildren}
            />
          </aside>

          <main className="lg:col-span-8">
            <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">{pageTitle}</h2>

            {blocks.length ? (
              renderContentBlocks(blocks, brandKey)
            ) : (
              <div
                className={`mt-10 rounded-2xl border ${THEME.accentBorder} ${THEME.accentSoftBg} p-6 text-sm text-neutral-800`}
              >
                본문 데이터가 아직 없습니다.
                {category?.sourceUrl ? (
                  <>
                    {" "}
                    <a
                      className="font-semibold underline underline-offset-4 text-orange-700"
                      href={legacyHref(brandKey, category.sourceUrl)}
                    >
                      원문 보기
                    </a>
                  </>
                ) : null}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
