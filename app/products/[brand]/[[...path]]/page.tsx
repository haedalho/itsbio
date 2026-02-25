// app/products/[brand]/[[...path]]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/site/Breadcrumb";
import { sanityClient } from "@/lib/sanity/sanity.client";
import HtmlContent from "@/components/site/HtmlContent";

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
    brandSlug == $brandKey
    || themeKey == $brandKey
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
    brandSlug == $brandKey
    || themeKey == $brandKey
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
  },
  blocks[] {
    _key,
    _type,
    title,
    html,
    items[]
  }
}
`;

const PRODUCTS_BY_CATEGORYPATH_QUERY = `
*[
  _type=="product"
  && isActive==true
  && (
    brandSlug == $brandKey
    || brand->slug.current == $brandKey
    || brand->themeKey == $brandKey
  )
  && array::join(categoryPath, "/") == $pathStr
]
| order(title asc) {
  _id,
  title,
  sku,
  "slug": slug.current,
  "thumb": imageUrls[0],
  sourceUrl,
  enrichedAt
}
`;

const DESCENDANTS_BY_PREFIX_QUERY = `
*[
  _type == "category"
  && (
    brandSlug == $brandKey
    || themeKey == $brandKey
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

  ensureNode(rootPath, {
    _id: `virtual-${rootKey}`,
    title: humanizeSegment(rootPath[rootPath.length - 1] || ""),
  });

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
 * ✅ 핵심 수정:
 * - 섹션 hover(group-hover) 때문에 자식 마커가 "전부" 뜨던 문제 해결
 *   => group/section, group/item 네임드 그룹으로 분리
 * - 기본: active 1개만 도트 표시
 * - hover: 해당 item만 도트/꺾쇠 표시
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

  const activeRootTitle =
    roots.find((r) => (r.path?.[0] || "") === activeRoot)?.title ||
    (activeRoot ? humanizeSegment(activeRoot) : "All Products");

  const isPrefix = (full: string, prefix: string) => full === prefix || full.startsWith(prefix + "/");

  // 레퍼런스 좌표(필요하면 여기만 1~2px 튜닝)
  const LINE_LEFT = "left-[18px]";
  const DOT_LEFT = "left-[18px]";
  const ARROW_LEFT = "left-[28px]";
  const TEXT_OFFSET = "ml-[34px]";

  function Children({ nodes }: { nodes: TreeNode[] }) {
    if (!nodes?.length) return null;

    return (
      <div className="relative">
        <div className={`pointer-events-none absolute ${LINE_LEFT} top-0 h-full border-l border-dashed border-neutral-400`} />

        <div className="space-y-1">
          {nodes.map((n) => {
            const p = n.path.join("/");
            const isActive = activePathStr === p;

            return (
              <Link key={n.key} href={buildHref(brandKey, n.path)} className="group/item relative block">
                {/* dot: 기본 숨김, active/hover(item)만 표시 */}
                <span
                  aria-hidden
                  className={[
                    "pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
                    DOT_LEFT,
                    "h-1.5 w-1.5 rounded-full bg-orange-500 transition",
                    isActive ? "opacity-100 scale-125" : "opacity-0",
                    "group-hover/item:opacity-100 group-hover/item:scale-110",
                  ].join(" ")}
                />
                {/* ring */}
                <span
                  aria-hidden
                  className={[
                    "pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
                    DOT_LEFT,
                    "h-2.5 w-2.5 rounded-full border border-orange-200 transition",
                    isActive ? "opacity-100 border-orange-300" : "opacity-0",
                    "group-hover/item:opacity-100 group-hover/item:border-orange-200",
                  ].join(" ")}
                />
                {/* here indicator: hover(item)에서만 */}
                <span
                  aria-hidden
                  className={[
                    "pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
                    ARROW_LEFT,
                    "text-xs text-orange-500 transition",
                    "opacity-0 group-hover/item:opacity-100",
                    isActive ? "opacity-0" : "",
                  ].join(" ")}
                >
                  ›
                </span>

                {/* text area */}
                <span
                  className={[
                    "relative block rounded-xl px-3 py-2 text-sm leading-6 transition",
                    TEXT_OFFSET,
                    isActive
                      ? "bg-orange-100 text-orange-700 font-semibold"
                      : "text-neutral-700 group-hover/item:bg-neutral-50",
                  ].join(" ")}
                >
                  <span className="block min-w-0 truncate">{stripBrandSuffix(n.title)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  function NodeRow({ node }: { node: TreeNode }) {
    const p = node.path.join("/");
    const isActive = activePathStr === p;
    const isOnTrail = isPrefix(activePathStr, p) && !isActive;
    const hasChildren = !!node.children?.length;

    const isOpen = hasChildren && (isActive || isOnTrail);

    if (hasChildren) {
      return (
        <div className="group/section">
          <Link
            href={buildHref(brandKey, node.path)}
            className={[
              "flex items-center justify-between rounded-xl px-3 py-2 text-sm transition",
              isOpen ? "text-orange-600 font-semibold" : "text-neutral-800 hover:bg-neutral-50",
            ].join(" ")}
          >
            <div className="min-w-0 flex items-center gap-2">
              <span className={isOpen ? "text-orange-500" : "text-neutral-300"} aria-hidden>
                ⌄
              </span>
              <span className="truncate">{stripBrandSuffix(node.title)}</span>
            </div>

            <span className={isOpen ? "text-orange-500 text-xs" : "text-neutral-300"} aria-hidden>
              {isOpen ? "^" : "›"}
            </span>
          </Link>

          {/* 열림: 항상 / 닫힘: 섹션 hover에서만 */}
          <div className={isOpen ? "mt-1 block" : "mt-1 hidden group-hover/section:block"}>
            <Children nodes={node.children} />
          </div>
        </div>
      );
    }

    return (
      <Link
        href={buildHref(brandKey, node.path)}
        className={[
          "flex items-center justify-between rounded-xl px-3 py-2 text-sm transition",
          isActive ? "bg-orange-100 text-orange-700 font-semibold" : "text-neutral-800 hover:bg-neutral-50",
        ].join(" ")}
      >
        <span className="min-w-0 truncate">{stripBrandSuffix(node.title)}</span>
        <span className="text-neutral-300" aria-hidden>
          ›
        </span>
      </Link>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-5 py-4">
        <div className="text-base font-semibold text-orange-600">
          {stripBrandSuffix(activeRootTitle)}
        </div>
      </div>

      <div className="p-2">
        <div className="space-y-1">
          {roots
            .filter((r) => (r.path?.[0] || "") !== activeRoot)
            .map((r) => (
              <Link
                key={r._id}
                href={buildHref(brandKey, r.path)}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50"
              >
                <span className="min-w-0 truncate">{stripBrandSuffix(r.title)}</span>
                <span className="text-neutral-300" aria-hidden>
                  ›
                </span>
              </Link>
            ))}
        </div>

        <div className="my-2 border-t border-neutral-200" />

        <div className="space-y-1">
          {activeRootTree?.length ? (
            activeRootTree.map((n) => <NodeRow key={n.key} node={n} />)
          ) : (
            <div className="px-3 py-2 text-sm text-neutral-500">하위 카테고리가 없습니다.</div>
          )}
        </div>
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
  searchParams,
}: {
  params: Promise<{ brand: string; path?: string[] }> | { brand: string; path?: string[] };
  searchParams?: Promise<{ open?: string }> | { open?: string };
}) {
  const resolved = await Promise.resolve(params as any);
  const sp = await Promise.resolve(searchParams as any);
  const openSlug = (sp?.open ?? "").toString().trim();
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
  const blocks = Array.isArray(category?.contentBlocks)
    ? category.contentBlocks
    : Array.isArray(category?.blocks)
      ? category.blocks
      : [];

  const productsInCategory: Array<{
    _id: string;
    title: string;
    sku?: string;
    slug: string;
    thumb?: string;
  }> = await sanityClient.fetch(PRODUCTS_BY_CATEGORYPATH_QUERY, { brandKey, pathStr });

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

            {productsInCategory.length ? (
              <div className="mt-6">
                <div className="text-sm font-semibold text-neutral-900">Products</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {productsInCategory.map((p) => {
                    const isOpen = openSlug && p.slug === openSlug;
                    return (
                      <Link
                        key={p._id}
                        href={`/products/${brandKey}/item/${encodeURIComponent(p.slug)}`}
                        className={`group flex items-center gap-3 rounded-2xl border bg-white p-3 hover:shadow-sm ${
                          isOpen ? "border-orange-400 ring-1 ring-orange-200" : "border-slate-200"
                        }`}
                      >
                        <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-slate-50">
                          {p.thumb ? <Image src={p.thumb} alt="" fill className="object-contain" sizes="48px" /> : null}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-neutral-900 group-hover:underline">
                            {stripBrandSuffix(p.title)}
                          </div>
                          {p.sku ? <div className="mt-0.5 text-xs text-neutral-600">Cat.No: {p.sku}</div> : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {blocks.length ? (
              renderContentBlocks(blocks, brandKey)
            ) : (
              <div className={`mt-10 rounded-2xl border ${THEME.accentBorder} ${THEME.accentSoftBg} p-6 text-sm text-neutral-800`}>
                본문 데이터가 아직 없습니다.
                {category?.sourceUrl ? (
                  <>
                    {" "}
                    <a className="font-semibold underline underline-offset-4 text-orange-700" href={legacyHref(brandKey, category.sourceUrl)}>
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