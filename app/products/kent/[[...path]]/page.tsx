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

const THEME = {
  accentText: "text-blue-700",
  accentBorder: "border-blue-200",
  accentSoftBg: "bg-blue-50",
  accentActiveBg: "bg-blue-50",
  accentActiveText: "text-blue-800",
  accentDotBg: "bg-blue-600",
  accentDotBorder: "border-blue-200",
  btnBg: "bg-blue-600",
  btnHover: "hover:bg-blue-700",
};

type Theme = typeof THEME;

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

type CategoryDoc = {
  _id: string;
  title: string;
  path: string[];
  order?: number;
  sourceUrl?: string;
  summary?: string;
  legacyHtml?: string;
  contentBlocks?: ContentBlock[];
};

type TreeNode = {
  key: string;
  _id: string;
  title: string;
  path: string[];
  order?: number;
  sourceUrl?: string;
  isVirtual?: boolean;
  children: TreeNode[];
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

  "roots": *[
    _type=="category"
    && (!defined(isActive) || isActive==true)
    && (brand->themeKey==$brandKey || brand->slug.current==$brandKey || themeKey==$brandKey || brandSlug==$brandKey)
    && count(path)==1
  ] | order(order asc, title asc) {
    _id, title, path, order, sourceUrl
  },

  "descendants": *[
    _type=="category"
    && (!defined(isActive) || isActive==true)
    && (brand->themeKey==$brandKey || brand->slug.current==$brandKey || themeKey==$brandKey || brandSlug==$brandKey)
    && count(path)>1
  ] | order(order asc, title asc) {
    _id, title, path, order, sourceUrl
  },

  "category": select(
    $hasPath => *[
      _type=="category"
      && (!defined(isActive) || isActive==true)
      && (brand->themeKey==$brandKey || brand->slug.current==$brandKey || themeKey==$brandKey || brandSlug==$brandKey)
      && array::join(path, "/")==$pathStr
    ][0]{
      _id,
      title,
      path,
      order,
      sourceUrl,
      summary,
      legacyHtml,
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
  )
}
`;

function buildCategoryHref(path: string[]) {
  return path.length ? `/products/${BRAND_KEY}/${path.join("/")}` : `/products/${BRAND_KEY}`;
}

function buildProductHref(slug: string) {
  return `/products/${BRAND_KEY}/item/${slug}`;
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
  return abs.replace(`${BRAND_BASE}/products/`, "").replace(/\/$/, "").trim();
}

function slugifyLoose(input: string) {
  return (input || "")
    .toLowerCase()
    .replace(/&amp;/gi, "and")
    .replace(/&/g, "and")
    .replace(/[®™]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function humanizeSegment(seg: string) {
  return (seg || "").replaceAll("-", " ").replaceAll("_", " ").trim();
}

function titleCaseFromSlug(seg: string) {
  return humanizeSegment(seg).replace(/\b[a-z]/g, (c) => c.toUpperCase());
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

function normalizeTitle(title: string, fallbackSeg = "") {
  const clean = stripBrandSuffix(title || "");
  if (!clean) return titleCaseFromSlug(fallbackSeg);
  if (looksLikeSlugTitle(clean)) return titleCaseFromSlug(clean);
  return clean;
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
  if (!href) return "#";

  if (
    href.startsWith(`/products/${BRAND_KEY}`) ||
    href.startsWith(`/products/${BRAND_KEY}/item/`) ||
    href.startsWith(`/products/${BRAND_KEY}/legacy`)
  ) {
    return href;
  }

  const abs = normalizeUrl(href);
  if (!abs) return "#";

  if (isKentProductUrl(abs)) {
    const slug = kentProductSlugFromUrl(abs);
    return slug ? buildProductHref(slug) : legacyHref(abs);
  }

  if (isKentCategoryUrl(abs)) {
    const path = kentCategoryPathFromUrl(abs);
    return path.length ? buildCategoryHref(path) : legacyHref(abs);
  }

  return legacyHref(abs);
}

function rewriteAnchorsToInternalAware(html: string) {
  if (!html) return "";
  return html.replace(/\shref=["']([^"']+)["']/gi, (_m, url) => {
    return ` href="${resolveKentHref(url)}"`;
  });
}

function safeHtmlForRender(html: string) {
  let out = html || "";
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
    ? path
        .map((seg) => String(seg || "").trim().replace(/^\/+|\/+$/g, ""))
        .filter(Boolean)
    : [];
}

function categoryScore(cat: CategoryDoc) {
  const path = normalizePathSegments(cat.path);
  const last = path[path.length - 1] || "";
  const title = normalizeTitle(cat.title || "", last);
  const titleSlug = slugifyLoose(title);
  const sourceUrl = normalizeUrl(cat.sourceUrl || "");
  const exactSourceMatch =
    !!sourceUrl &&
    isKentCategoryUrl(sourceUrl) &&
    kentCategoryPathFromUrl(sourceUrl).join("/") === path.join("/");

  let score = 0;
  if (exactSourceMatch) score += 100;
  if (titleSlug === last) score += 60;
  if (titleSlug && last && titleSlug.includes(last)) score += 20;
  if (!looksLikeSlugTitle(title)) score += 8;
  if (typeof cat.order === "number") score += 3;
  if (title.length >= 3 && title.length <= 80) score += 2;
  return score;
}

function dedupeCategories(items: CategoryDoc[]) {
  const byPath = new Map<string, CategoryDoc>();

  for (const raw of items) {
    const path = normalizePathSegments(raw.path);
    if (!path.length) continue;

    const key = path.join("/");
    const next: CategoryDoc = {
      ...raw,
      path,
      title: normalizeTitle(raw.title || "", path[path.length - 1] || ""),
    };

    const prev = byPath.get(key);
    if (!prev) {
      byPath.set(key, next);
      continue;
    }

    const prevScore = categoryScore(prev);
    const nextScore = categoryScore(next);

    if (nextScore > prevScore) {
      byPath.set(key, {
        ...prev,
        ...next,
        contentBlocks: next.contentBlocks?.length ? next.contentBlocks : prev.contentBlocks,
        legacyHtml: next.legacyHtml || prev.legacyHtml,
        summary: next.summary || prev.summary,
      });
    } else {
      byPath.set(key, {
        ...prev,
        contentBlocks: prev.contentBlocks?.length ? prev.contentBlocks : next.contentBlocks,
        legacyHtml: prev.legacyHtml || next.legacyHtml,
        summary: prev.summary || next.summary,
      });
    }
  }

  return [...byPath.values()];
}

function dedupeLandingItems(items: CardItem[]) {
  const seen = new Set<string>();
  const out: CardItem[] = [];

  for (const item of items) {
    const href = String(item?.href || "").trim();
    const title = normalizeInlineText(String(item?.title || ""));
    const imageUrl = String(item?.imageUrl || "").trim();
    const key = [href, title, imageUrl].join("|");
    if (!href || !title || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
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

function makeNodeKey(path: string[]) {
  return path.join("/");
}

function buildTreeFromAllCategories(roots: CategoryDoc[], descendants: CategoryDoc[]) {
  const nodes = new Map<string, TreeNode>();

  function ensureNode(path: string[], meta?: Partial<CategoryDoc>) {
    const key = makeNodeKey(path);
    const seg = path[path.length - 1] || "";

    if (!nodes.has(key)) {
      nodes.set(key, {
        key,
        _id: meta?._id || `virtual-${key}`,
        title: normalizeTitle(meta?.title || "", seg),
        path,
        order: meta?.order,
        sourceUrl: meta?.sourceUrl,
        isVirtual: !meta?._id,
        children: [],
      });
    } else if (meta?._id) {
      const cur = nodes.get(key)!;
      nodes.set(key, {
        ...cur,
        _id: meta._id,
        title: normalizeTitle(meta.title || cur.title, seg),
        order: typeof meta.order === "number" ? meta.order : cur.order,
        sourceUrl: meta.sourceUrl || cur.sourceUrl,
        isVirtual: false,
      });
    }

    return nodes.get(key)!;
  }

  for (const r of roots) {
    if (!Array.isArray(r.path) || r.path.length !== 1) continue;
    ensureNode(r.path, r);
  }

  for (const d of descendants) {
    if (!Array.isArray(d.path) || d.path.length < 2) continue;
    for (let i = 0; i < d.path.length; i += 1) {
      const slice = d.path.slice(0, i + 1);
      if (i === d.path.length - 1) ensureNode(slice, d);
      else ensureNode(slice);
    }
  }

  for (const node of nodes.values()) {
    if (node.path.length === 1) continue;
    const parentKey = makeNodeKey(node.path.slice(0, node.path.length - 1));
    const parent = nodes.get(parentKey);
    if (parent && !parent.children.some((child) => child.key === node.key)) {
      parent.children.push(node);
    }
  }

  function sortRec(node: TreeNode) {
    node.children.sort((a, b) => {
      const ao = typeof a.order === "number" ? a.order : 999999;
      const bo = typeof b.order === "number" ? b.order : 999999;
      if (ao !== bo) return ao - bo;
      return String(a.title).localeCompare(String(b.title));
    });
    node.children.forEach(sortRec);
  }

  const nestedLeaves = new Set(
    [...nodes.values()]
      .filter((n) => n.path.length > 1)
      .map((n) => n.path[n.path.length - 1])
  );

  const rootNodes = [...nodes.values()]
    .filter((n) => n.path.length === 1)
    .filter((n) => !nestedLeaves.has(n.path[0]));

  rootNodes.sort((a, b) => {
    const ao = typeof a.order === "number" ? a.order : 999999;
    const bo = typeof b.order === "number" ? b.order : 999999;
    if (ao !== bo) return ao - bo;
    return String(a.title).localeCompare(String(b.title));
  });

  rootNodes.forEach(sortRec);

  return { rootNodes, nodes };
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

function SideNavTree({
  activePath,
  tree,
  titleByPathStr,
  theme,
}: {
  activePath: string[];
  tree: TreeNode[];
  titleByPathStr: Map<string, string>;
  theme: Theme;
}) {
  const activePathStr = activePath.join("/");

  const isPrefix = (full: string, prefix: string) => full === prefix || full.startsWith(`${prefix}/`);

  const LINE_LEFT = "left-[18px]";
  const DOT_LEFT = "left-[18px]";
  const ARROW_LEFT = "left-[28px]";
  const TEXT_OFFSET = "ml-[34px]";

  function nodeHref(n: { path: string[] }) {
    return buildCategoryHref(n.path);
  }

  function displayNodeTitle(n: TreeNode) {
    const pathStr = n.path.join("/");
    const t = titleByPathStr.get(pathStr) || n.title;
    return normalizeTitle(t, n.path[n.path.length - 1] || "");
  }

  function Children({ nodes }: { nodes: TreeNode[] }) {
    if (!nodes?.length) return null;

    return (
      <div className="relative">
        <div className={`pointer-events-none absolute ${LINE_LEFT} top-0 h-full border-l border-dashed border-neutral-400`} />
        <div className="space-y-1">
          {nodes.map((n) => {
            const p = n.path.join("/");
            const isActive = activePathStr === p;
            const hasChildren = !!n.children?.length;

            return (
              <Link key={n.key} href={nodeHref(n)} prefetch={false} className="group/item relative block">
                <span
                  aria-hidden
                  className={[
                    "pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
                    DOT_LEFT,
                    "h-1.5 w-1.5 rounded-full transition",
                    theme.accentDotBg,
                    isActive ? "opacity-100 scale-125" : "opacity-0",
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
                    isActive ? "opacity-100" : "opacity-0",
                    "group-hover/item:opacity-100",
                  ].join(" ")}
                />
                <span
                  aria-hidden
                  className={[
                    "pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
                    ARROW_LEFT,
                    "text-xs transition opacity-0 group-hover/item:opacity-100",
                    theme.accentText,
                    isActive ? "opacity-0" : "",
                  ].join(" ")}
                >
                  {hasChildren ? "▸" : "›"}
                </span>

                <span
                  className={[
                    "relative flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm leading-6 transition",
                    TEXT_OFFSET,
                    isActive
                      ? `${theme.accentActiveBg} ${theme.accentActiveText} font-semibold`
                      : "text-neutral-700 group-hover/item:bg-neutral-50",
                  ].join(" ")}
                >
                  <span className="block min-w-0 truncate">{displayNodeTitle(n)}</span>
                  <span className={hasChildren ? "shrink-0 text-xs text-neutral-300" : "shrink-0 text-neutral-300"}>
                    {hasChildren ? "▸" : "›"}
                  </span>
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
            href={nodeHref(node)}
            prefetch={false}
            className={[
              "flex items-center justify-between rounded-xl px-3 py-2 text-sm transition",
              isOpen ? `${theme.accentText} font-semibold ${theme.accentSoftBg}` : "text-neutral-800 hover:bg-neutral-50",
            ].join(" ")}
          >
            <div className="min-w-0 flex items-center gap-2">
              <span className={isOpen ? `${theme.accentText} text-xs` : "text-xs text-neutral-300"} aria-hidden>
                {isOpen ? "▾" : "▸"}
              </span>
              <span className="truncate">{displayNodeTitle(node)}</span>
            </div>

            <span className={isOpen ? `${theme.accentText} text-xs` : "text-xs text-neutral-300"} aria-hidden>
              {isOpen ? "▾" : "▸"}
            </span>
          </Link>

          <div className={[isOpen ? "block" : "hidden group-hover/section:block", "mt-1 pl-2"].join(" ")}>
            <Children nodes={node.children} />
          </div>
        </div>
      );
    }

    return (
      <Link
        href={nodeHref(node)}
        prefetch={false}
        className={[
          "flex items-center justify-between rounded-xl px-3 py-2 text-sm transition",
          isActive ? `${theme.accentActiveBg} ${theme.accentActiveText} font-semibold` : "text-neutral-800 hover:bg-neutral-50",
        ].join(" ")}
      >
        <span className="min-w-0 truncate">{displayNodeTitle(node)}</span>
        <span className="shrink-0 text-neutral-300" aria-hidden>
          ›
        </span>
      </Link>
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
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-white via-white/80 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-white via-white/90 to-transparent" />

          <div className="scrollbar-hidden max-h-[calc(100vh-180px)] overflow-y-auto overscroll-contain p-2">
            <div className="space-y-1 pr-1">
              {tree?.length ? (
                tree.map((n) => <NodeRow key={n.key} node={n} />)
              ) : (
                <div className="px-3 py-2 text-sm text-neutral-500">하위 카테고리가 없습니다.</div>
              )}
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

function renderLandingBlocks(blocks: ContentBlock[], theme: Theme) {
  const dedupedBlocks = dedupeLandingBlocks(Array.isArray(blocks) ? blocks : []);
  const out: React.ReactNode[] = [];
  let first = true;

  const nextIsCardsWithSameTitle = (i: number, title: string) => {
    const next = dedupedBlocks[i + 1];
    return !!(next && next._type === "contentBlockCards" && String(next.title || "").trim() === title);
  };

  for (let i = 0; i < dedupedBlocks.length; i += 1) {
    const block = dedupedBlocks[i];

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
        </section>
      );
      continue;
    }

    if (block?._type !== "contentBlockCards") continue;

    const kind = String(block.kind || "") as CardsKind;
    const title = String(block.title || "").trim();
    const items = Array.isArray(block.items) ? block.items.filter(Boolean) : [];
    if (!items.length) continue;

    const prev = dedupedBlocks[i - 1];
    const prevIsSameSectionHtml =
      !!(prev && prev._type === "contentBlockHtml" && String(prev.title || "").trim() === title);

    if (!first && !prevIsSameSectionHtml) out.push(<KentDivider key={`div-${block._key || kind}-${i}`} />);
    first = false;

    if (kind === "product") {
      out.push(
        <section key={block._key || `prod-${title}-${i}`} className="mt-4">
          {!prevIsSameSectionHtml ? <KentH2>{title || "Products"}</KentH2> : null}

          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item, idx) => (
              <Link
                key={item._key || `${item.title}-${idx}`}
                href={resolveKentHref(String(item.href || ""))}
                prefetch={false}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] bg-white">
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
                    <span className="absolute left-4 top-4 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </div>

                <div className="border-t border-slate-100 px-5 py-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {item.sku ? `Cat.No ${item.sku}` : "Product"}
                  </div>

                  <div className="mt-2 text-lg font-semibold leading-snug text-slate-900 group-hover:underline">
                    {item.title}
                  </div>

                  {item.subtitle ? (
                    <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{item.subtitle}</div>
                  ) : null}

                  <div className="mt-5 flex items-center justify-between">
                    <span className={`text-sm font-semibold ${theme.accentText}`}>View product</span>
                    <span className="text-slate-400 transition group-hover:translate-x-0.5">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      );
      continue;
    }

    if (kind === "category") {
      out.push(
        <section key={block._key || `cat-${title}-${i}`} className="mt-4">
          {!prevIsSameSectionHtml ? <KentH2>{title || "Additional equipment"}</KentH2> : null}

          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item, idx) => (
              <Link
                key={item._key || `${item.title}-${idx}`}
                href={resolveKentHref(String(item.href || ""))}
                prefetch={false}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-sm"
              >
                <div className="relative aspect-[1/1] bg-slate-50">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={toAbs(String(item.imageUrl || ""))}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="text-sm font-semibold leading-snug text-white">{item.title}</div>
                    {typeof item.count === "number" ? (
                      <div className="mt-1 text-xs text-white/90">
                        <span className="font-semibold">{item.count}</span> products
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <span className={`text-xs font-semibold ${theme.accentText}`}>Open ›</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      );
      continue;
    }

    if (kind === "publication") {
      out.push(
        <section key={block._key || `pub-${i}`} className="mt-10">
          <KentH2>{title || "Scientific articles and publications"}</KentH2>

          <div className="mt-5 space-y-5">
            {items.map((item, idx) => (
              <div key={item._key || `${item.title}-${idx}`} className="rounded-2xl border border-slate-200 bg-white p-5">
                <Link
                  href={resolveKentHref(String(item.href || ""))}
                  prefetch={false}
                  className="block text-xl font-semibold tracking-tight text-neutral-900 hover:underline"
                >
                  {item.title}
                </Link>
                <div className="mt-4">
                  <Link
                    href={resolveKentHref(String(item.href || ""))}
                    prefetch={false}
                    className={`inline-flex items-center justify-center rounded-xl border border-blue-600 px-4 py-2 text-sm font-semibold ${theme.accentText} hover:bg-blue-50`}
                  >
                    Continue Reading
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      );
      continue;
    }

    if (kind === "resource") {
      out.push(
        <section key={block._key || `res-${i}`} className="mt-10">
          <KentH2>{title || "Resources"}</KentH2>

          <div className="mt-5 space-y-4">
            {items.map((item, idx) => (
              <Link
                key={item._key || `${item.title}-${idx}`}
                href={resolveKentHref(String(item.href || ""))}
                prefetch={false}
                className="group flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-sm"
              >
                <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-50">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={toAbs(String(item.imageUrl || ""))}
                      alt=""
                      className="absolute inset-0 h-full w-full object-contain p-2"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="text-base font-semibold text-neutral-900 group-hover:underline">{item.title}</div>
                  {item.subtitle ? (
                    <div className="mt-1 line-clamp-3 text-sm text-slate-600">{item.subtitle}</div>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
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
  });

  const brand = data?.brand;
  if (!brand?._id) notFound();

  const rawRoots: CategoryDoc[] = Array.isArray(data?.roots) ? data.roots : [];
  const rawDescendants: CategoryDoc[] = Array.isArray(data?.descendants) ? data.descendants : [];
  const rawCategory: CategoryDoc | null = data?.category || null;

  const dedupedAll = dedupeCategories([
    ...rawRoots,
    ...rawDescendants,
    ...(rawCategory ? [rawCategory] : []),
  ]);

  const dedupedRoots = dedupeCategories(rawRoots);
  const dedupedDescendants = dedupeCategories([
    ...rawDescendants,
    ...(rawCategory && rawCategory.path.length > 1 ? [rawCategory] : []),
  ]);

  const { rootNodes: tree, nodes } = buildTreeFromAllCategories(dedupedRoots, dedupedDescendants);

  const titleByPathStr = new Map<string, string>();
  for (const node of nodes.values()) {
    titleByPathStr.set(node.path.join("/"), node.title);
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: brand.title, href: `/products/${BRAND_KEY}` },
  ];

  if (!pathArr.length) {
    return (
      <div>
        <HeroBanner brandTitle={brand.title} />

        <div className={PAGE_SHELL}>
          <div className="mt-6 flex justify-end">
            <Breadcrumb items={breadcrumbItems} />
          </div>

          <div className={`mt-10 ${CONTENT_LAYOUT}`}>
            <aside className="self-start lg:sticky lg:top-24">
              <SideNavTree activePath={[]} tree={tree} titleByPathStr={titleByPathStr} theme={THEME} />
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

  const category = dedupedAll.find((item) => item.path.join("/") === pathStr) || rawCategory;
  if (!category?._id) notFound();

  const pageTitle = normalizeTitle(category.title || "", pathArr[pathArr.length - 1] || "");
  const blocks = dedupeLandingBlocks(Array.isArray(category.contentBlocks) ? category.contentBlocks : []);
  const renderedBlocks = renderLandingBlocks(blocks, THEME);
  const fallbackHtml = typeof category.legacyHtml === "string" ? category.legacyHtml : "";
  const hasFallbackHtml = roughTextLenFromHtml(safeHtmlForRender(fallbackHtml)) >= 20;

  const breadcrumbPathItems = pathArr.map((seg, index) => {
    const slice = pathArr.slice(0, index + 1);
    const key = slice.join("/");
    return {
      label: titleByPathStr.get(key) || normalizeTitle("", seg),
      href: buildCategoryHref(slice),
    };
  });

  return (
    <div>
      <HeroBanner brandTitle={brand.title} />

      <div className={PAGE_SHELL}>
        <div className="mt-6 flex justify-end">
          <Breadcrumb items={[...breadcrumbItems, ...breadcrumbPathItems]} />
        </div>

        <div className={`mt-10 ${CONTENT_LAYOUT}`}>
          <aside className="self-start lg:sticky lg:top-24">
            <SideNavTree activePath={pathArr} tree={tree} titleByPathStr={titleByPathStr} theme={THEME} />
          </aside>

          <main className="min-w-0 pb-14">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{pageTitle}</h2>

            {renderedBlocks ? (
              <div className="mt-4">{renderedBlocks}</div>
            ) : hasFallbackHtml ? (
              <KentHtmlFallback html={fallbackHtml} />
            ) : category.summary ? (
              <div
                className={`mt-6 rounded-2xl border ${THEME.accentBorder} ${THEME.accentSoftBg} p-6 text-sm leading-7 text-slate-800`}
              >
                {category.summary}
                {category.sourceUrl ? (
                  <>
                    {" "}
                    <Link
                      className={`font-semibold underline underline-offset-4 ${THEME.accentText}`}
                      href={legacyHref(category.sourceUrl)}
                      prefetch={false}
                    >
                      원문 보기
                    </Link>
                  </>
                ) : null}
              </div>
            ) : (
              <div
                className={`mt-6 rounded-2xl border ${THEME.accentBorder} ${THEME.accentSoftBg} p-6 text-sm text-slate-800`}
              >
                본문 데이터가 아직 없습니다.
                {category.sourceUrl ? (
                  <>
                    {" "}
                    <Link
                      className={`font-semibold underline underline-offset-4 ${THEME.accentText}`}
                      href={legacyHref(category.sourceUrl)}
                      prefetch={false}
                    >
                      원문 보기
                    </Link>
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