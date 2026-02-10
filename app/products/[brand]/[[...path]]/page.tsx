// app/products/[brand]/[[...path]]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/site/Breadcrumb";
import { sanityClient } from "@/lib/sanity/sanity.client";
import HtmlContent from "@/components/site/HtmlContent"; // ✅ 추가

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

// ✅ &amp; 같은 HTML entity를 실제 문자로 디코딩
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
  && array::join(path[0...$depth], "/") == $prefix
]
| order(order asc, title asc) { _id, title, path, order }
`;

type CatLite = { _id: string; title: string; path: string[]; order?: number };

async function fetchDescendants(brandKey: string, rootPath: string[]) {
  if (!rootPath.length) return [] as CatLite[];
  const depth = rootPath.length;
  const prefix = rootPath.join("/");
  const descendants: CatLite[] = await sanityClient.fetch(DESCENDANTS_BY_PREFIX_QUERY, {
    brandKey,
    depth,
    prefix,
  });
  return descendants;
}

/** -------------------- Tree Builder -------------------- */

type TreeNode = {
  key: string;
  _id: string;
  title: string;
  path: string[];
  order?: number;
  isVirtual?: boolean;
  children: TreeNode[];
};

function makeNodeKey(path: string[]) {
  return path.join("/");
}

function buildTreeFromDescendants(rootPath: string[], descendants: CatLite[]) {
  const rootKey = makeNodeKey(rootPath);
  const nodes = new Map<string, TreeNode>();

  function ensureNode(path: string[], meta?: Partial<CatLite>) {
    const key = makeNodeKey(path);
    const seg = path[path.length - 1] || "";

    if (!nodes.has(key)) {
      nodes.set(key, {
        key,
        _id: meta?._id || `virtual-${key}`,
        title: meta?.title || humanizeSegment(seg),
        path,
        order: meta?.order,
        isVirtual: !meta?._id,
        children: [],
      });
    } else if (meta?._id) {
      const cur = nodes.get(key)!;
      nodes.set(key, {
        ...cur,
        _id: meta._id,
        title: meta.title || cur.title,
        order: typeof meta.order === "number" ? meta.order : cur.order,
        isVirtual: false,
      });
    }

    return nodes.get(key)!;
  }

  // root 보장
  ensureNode(rootPath, { _id: `virtual-${rootKey}`, title: humanizeSegment(rootPath[rootPath.length - 1] || "") });

  for (const d of descendants) {
    if (!Array.isArray(d.path) || d.path.length <= rootPath.length) continue;

    const prefixOk = rootPath.every((seg, i) => d.path[i] === seg);
    if (!prefixOk) continue;

    for (let i = rootPath.length; i < d.path.length; i++) {
      const p = d.path.slice(0, i + 1);
      if (i === d.path.length - 1) ensureNode(p, d);
      else ensureNode(p);
    }
  }

  for (const [key, node] of nodes.entries()) {
    if (key === rootKey) continue;
    const parentPath = node.path.slice(0, node.path.length - 1);
    const parentKey = makeNodeKey(parentPath);
    const parent = nodes.get(parentKey);
    if (parent) parent.children.push(node);
  }

  function sortRec(n: TreeNode) {
    n.children.sort((a, b) => {
      const ao = typeof a.order === "number" ? a.order : 999999;
      const bo = typeof b.order === "number" ? b.order : 999999;
      if (ao !== bo) return ao - bo;
      return String(a.title).localeCompare(String(b.title));
    });
    n.children.forEach(sortRec);
  }

  const root = nodes.get(rootKey)!;
  sortRec(root);

  return root.children;
}

/** -------------------- ABM HTML sanitize/rewrite -------------------- */

function getBaseUrlForBrand(brandKey: string) {
  if (brandKey === "abm") return "https://www.abmgood.com";
  return "";
}

function rewriteRelativeUrls(html: string, baseUrl: string) {
  if (!html) return "";
  if (!baseUrl) return html;

  let out = html.replace(/\s(href|src)=["'](\/(?!\/)[^"']*)["']/gi, (_m, attr, p) => ` ${attr}="${baseUrl}${p}"`);

  out = out.replace(/\s(href|src)=["'](\/\/[^"']+)["']/gi, (_m, attr, p2) => ` ${attr}="https:${p2}"`);
  return out;
}

function stripUnwantedAbmNav(html: string) {
  if (!html) return "";
  let out = html;

  out = out.replace(/<ul[^>]*class=["'][^"']*\babm-page-category-nav-list\b[^"']*["'][\s\S]*?<\/ul>/gi, "");

  out = out.replace(
    /<h3[^>]*>[\s\S]*?\bResource\b[\s\S]*?<\/h3>[\s\S]*?<ul[^>]*class=["'][^"']*\bhtmlcontent-home\b[^"']*["'][\s\S]*?<\/ul>[\s\S]*?(?=<h3\b|$)/gi,
    ""
  );

  out = out.replace(
    /<h3[^>]*>[\s\S]*?\bTop\s*Publications\b[\s\S]*?<\/h3>[\s\S]*?<table[\s\S]*?<\/table>[\s\S]*?(?=<h3\b|$)/gi,
    ""
  );

  out = out.replace(/<script[^>]*type=["']application\/ld\+json["'][\s\S]*?<\/script>/gi, "");
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");

  return out;
}

function rewriteAnchorsToLegacy(html: string, brandKey: string) {
  if (!html) return "";
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
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">{brandTitle} Product</h1>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * ✅ 메뉴: “호버 시 펼침”
 * - 기본: 하위 숨김
 * - hover: 펼침
 * - active trail(현재 경로): 항상 펼침
 */
function SideNavTree({
  brandKey,
  roots,
  activePath,
  activeRootTree,
}: {
  brandKey: string;
  roots: CatLite[];
  activePath: string[];
  activeRootTree: TreeNode[];
}) {
  const activePathStr = activePath.join("/");
  const activeRoot = activePath[0] || "";
  const INDENTS = ["ml-2", "ml-4", "ml-6", "ml-8", "ml-10", "ml-12"];

  function NodeList({ nodes, depth }: { nodes: TreeNode[]; depth: number }) {
    if (!nodes?.length) return null;
    const indentClass = INDENTS[Math.min(depth, INDENTS.length - 1)];

    return (
      <div className="space-y-1">
        {nodes.map((n) => {
          const p = n.path.join("/");
          const isActive = activePathStr === p;
          const isOnTrail =
            !isActive && activePath.length > n.path.length && activePath.slice(0, n.path.length).join("/") === p;

          // ✅ active or trail이면 열려있고, 아니면 hover에서만 열림
          const childrenOpen = isActive || isOnTrail;

          return (
            <div key={n.key} className="group">
              <Link
                href={buildHref(brandKey, n.path)}
                className={[
                  `${indentClass} flex items-center justify-between rounded-xl px-3 py-2 text-sm`,
                  isActive
                    ? `${THEME.accentBg} text-white`
                    : isOnTrail
                    ? "bg-neutral-50 text-neutral-900"
                    : "text-neutral-700 hover:bg-neutral-50",
                ].join(" ")}
              >
                <span className="min-w-0 truncate">{stripBrandSuffix(n.title)}</span>
                <span className={isActive ? "text-white/80" : "text-neutral-300"}>›</span>
              </Link>

              {n.children?.length ? (
                <div className={[childrenOpen ? "block" : "hidden group-hover:block", "mt-1"].join(" ")}>
                  <NodeList nodes={n.children} depth={depth + 1} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-5 py-4">
        <div className="text-sm font-semibold text-neutral-900">All Products</div>
      </div>

      <div className="p-2 space-y-2">
        <div className="space-y-1">
          {roots.map((r) => {
            const isActive = activePath[0] === r.path[0];
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

        {activeRoot ? (
          <div className="mt-2 border-t border-neutral-200 pt-2">
            <div className={`px-3 py-2 text-xs font-semibold tracking-wide ${THEME.accentText}`}>
              {humanizeSegment(activeRoot)}
            </div>

            {activeRootTree?.length ? (
              <NodeList nodes={activeRootTree} depth={0} />
            ) : (
              <div className="px-3 py-2 text-sm text-neutral-500">하위 카테고리가 없습니다.</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
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
  return arr
    .map((x: any) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean)
    .filter((t: string) => !/^resources?$|^top\s*publications$/i.test(t));
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

function HtmlBlock({ html, brandKey }: { html: string; brandKey: string }) {
  const cleaned = safeHtmlForRender(html, brandKey);
  if (!cleaned) return null;

  // ✅ HtmlContent(클라이언트)에서: price 제거/테이블 디자인/아이콘 정리/메일 변경/quote 폼 제거
  return (
    <section className="mt-8">
      <HtmlContent html={cleaned} />
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
                <div className="mt-2 text-sm italic text-neutral-600 line-clamp-1">{x.subtitle || "Learning Resources"}</div>
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

function renderContentBlocks(blocks: any[], brandKey: string) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

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

  const activeRoot = path[0] || "";
  let activeRootTree: TreeNode[] = [];

  if (activeRoot) {
    const descendants = await fetchDescendants(brandKey, [activeRoot]);
    activeRootTree = buildTreeFromDescendants([activeRoot], descendants);
  }

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
              <SideNavTree brandKey={brandKey} roots={roots} activePath={[]} activeRootTree={[]} />
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

  // 문서가 없더라도(virtual) 트리 존재하면 허용
  if (!category?._id && (!activeRootTree || activeRootTree.length === 0)) notFound();

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
            <SideNavTree brandKey={brandKey} roots={roots} activePath={path} activeRootTree={activeRootTree} />
          </aside>

          <main className="lg:col-span-8">
            <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">{pageTitle}</h2>

            {blocks.length ? (
              renderContentBlocks(blocks, brandKey)
            ) : (
              <div className={`mt-10 rounded-2xl border ${THEME.accentBorder} ${THEME.accentSoftBg} p-6 text-sm text-neutral-800`}>
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
