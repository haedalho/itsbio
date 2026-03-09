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

const KENT_MENU_TITLE = "General Lab Equipment";

type Theme = {
  accentText: string;
  accentBorder: string;
  accentSoftBg: string;
  accentActiveBg: string;
  accentActiveText: string;
  accentDotBg: string;
  accentDotBorder: string;
  btnBg: string;
  btnHover: string;
};

const THEME_KENT: Theme = {
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

function buildHref(brandKey: string, path: string[]) {
  return path.length ? `/products/${brandKey}/${path.join("/")}` : `/products/${brandKey}`;
}

function legacyHref(brandKey: string, url: string) {
  return `/products/${brandKey}/legacy?u=${encodeURIComponent(url)}`;
}

function toLegacyIfExternal(href: string, brandKey: string) {
  if (!href) return "#";
  if (href.startsWith("/")) return href;
  if (href.startsWith("http://") || href.startsWith("https://")) return legacyHref(brandKey, href);
  return href;
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
  const t = (title || "").trim();
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(t);
}

function titleCaseFromSlug(s: string) {
  return (s || "")
    .replaceAll("-", " ")
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim();
}

function normalizeTitle(title: string, fallbackSeg: string) {
  const t = stripBrandSuffix(title || "");
  if (!t) return titleCaseFromSlug(fallbackSeg);
  if (looksLikeSlugTitle(t)) return titleCaseFromSlug(t);
  return t;
}

function getBaseUrlForBrand(brandKey: string) {
  if (brandKey === "kent") return "https://www.kentscientific.com";
  return "";
}

function rewriteRelativeUrls(html: string, baseUrl: string) {
  if (!html) return "";
  if (!baseUrl) return html;

  let out = html.replace(/\s(href|src)=["'](\/(?!\/)[^"']*)["']/gi, (_m, attr, p) => ` ${attr}="${baseUrl}${p}"`);
  out = out.replace(/\s(href|src)=["'](\/\/[^"']+)["']/gi, (_m, attr, p2) => ` ${attr}="https:${p2}"`);
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
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = rewriteRelativeUrls(out, baseUrl);
  out = rewriteAnchorsToLegacy(out, brandKey);
  return out.trim();
}

function roughTextLenFromHtml(html: string) {
  const t = (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length;
}

/* -------------------- GROQ -------------------- */

const PAGE_QUERY = `
{
  "brand": *[
    _type=="brand"
    && (themeKey==$brandKey || slug.current==$brandKey)
  ][0]{ _id, title, themeKey, "slug": slug.current },

  "roots": *[
    _type=="category"
    && (!defined(isActive) || isActive==true)
    && (brand->themeKey==$brandKey || brand->slug.current==$brandKey || themeKey==$brandKey || brandSlug==$brandKey)
    && count(path)==1
  ] | order(order asc, title asc) { _id, title, path, order, sourceUrl },

  "descendants": *[
    _type=="category"
    && (!defined(isActive) || isActive==true)
    && (brand->themeKey==$brandKey || brand->slug.current==$brandKey || themeKey==$brandKey || brandSlug==$brandKey)
    && count(path)>1
  ] | order(order asc, title asc) { _id, title, path, order, sourceUrl },

  "category": select(
    $hasPath => *[
      _type=="category"
      && (!defined(isActive) || isActive==true)
      && (brand->themeKey==$brandKey || brand->slug.current==$brandKey || themeKey==$brandKey || brandSlug==$brandKey)
      && array::join(path,"/")==$pathStr
    ][0]{
      _id, title, path, order, sourceUrl,
      summary,
      legacyHtml,
      contentBlocks[] {
        _key,_type,title,html,
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

/* -------------------- Tree -------------------- */

type CatLite = { _id: string; title: string; path: string[]; order?: number; sourceUrl?: string };

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

function makeNodeKey(path: string[]) {
  return path.join("/");
}

function buildTreeFromAllCategories(roots: CatLite[], descendants: CatLite[]) {
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
        sourceUrl: (meta as any)?.sourceUrl,
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
        sourceUrl: (meta as any)?.sourceUrl || cur.sourceUrl,
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
    for (let i = 0; i < d.path.length; i++) {
      const p = d.path.slice(0, i + 1);
      if (i === d.path.length - 1) ensureNode(p, d);
      else ensureNode(p);
    }
  }

  for (const node of nodes.values()) {
    if (node.path.length === 1) continue;
    const parentKey = makeNodeKey(node.path.slice(0, node.path.length - 1));
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

/* -------------------- UI: Hero + Sidebar -------------------- */

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

function SideNavTree({
  brandKey,
  activePath,
  tree,
  titleByPathStr,
  theme,
}: {
  brandKey: string;
  activePath: string[];
  tree: TreeNode[];
  titleByPathStr: Map<string, string>;
  theme: Theme;
}) {
  const activePathStr = activePath.join("/");

  const isPrefix = (full: string, prefix: string) => full === prefix || full.startsWith(prefix + "/");

  const LINE_LEFT = "left-[18px]";
  const DOT_LEFT = "left-[18px]";
  const ARROW_LEFT = "left-[28px]";
  const TEXT_OFFSET = "ml-[34px]";

  function nodeHref(n: { path: string[] }) {
    return buildHref(brandKey, n.path);
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
                  ›
                </span>

                <span
                  className={[
                    "relative block rounded-xl px-3 py-2 text-sm leading-6 transition",
                    TEXT_OFFSET,
                    isActive ? `${theme.accentActiveBg} ${theme.accentActiveText} font-semibold` : "text-neutral-700 group-hover/item:bg-neutral-50",
                  ].join(" ")}
                >
                  <span className="block min-w-0 truncate">{displayNodeTitle(n)}</span>
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
              isOpen ? `${theme.accentText} font-semibold` : "text-neutral-800 hover:bg-neutral-50",
            ].join(" ")}
          >
            <span className="min-w-0 truncate">{displayNodeTitle(node)}</span>
            <span className="text-neutral-300" aria-hidden>
              {isOpen ? "▾" : "▸"}
            </span>
          </Link>

          {isOpen ? (
            <div className="mt-1 pl-2">
              <Children nodes={node.children} />
            </div>
          ) : null}
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
        <span className="text-neutral-300" aria-hidden>
          ›
        </span>
      </Link>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-5 py-4">
        <div className={`text-base font-semibold ${theme.accentText}`}>{KENT_MENU_TITLE}</div>
      </div>
      <div className="p-2">
        <div className="space-y-1">
          {tree?.length ? tree.map((n) => <NodeRow key={n.key} node={n} />) : <div className="px-3 py-2 text-sm text-neutral-500">하위 카테고리가 없습니다.</div>}
        </div>
      </div>
    </div>
  );
}

/* -------------------- Kent Landing Renderer -------------------- */

type CardItem = {
  _key?: string;
  title: string;
  subtitle?: string;
  href: string;
  imageUrl?: string;
  count?: number;
  badge?: string;
  sku?: string;
};

type CardsKind = "product" | "category" | "resource" | "publication";

function KentH2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[26px] font-semibold tracking-tight text-neutral-900">{children}</h2>;
}

function KentDivider() {
  return <div className="my-10 border-t border-slate-200" />;
}

/**
 * ✅ 핵심: 짧은 HTML 블록도 "바로 뒤에 같은 title의 카드 블록이 있으면" 보여준다.
 * (Kent 원본은 h2 아래 짧은 문장 + 바로 카드 그리드 구조가 많음)
 */
function renderLandingBlocks(blocks: any[], brandKey: string, theme: Theme) {
  const out: React.ReactNode[] = [];
  let first = true;

  const nextIsCardsWithSameTitle = (i: number, title: string) => {
    const next = blocks[i + 1];
    return !!(next && next._type === "contentBlockCards" && String(next.title || "").trim() === title);
  };

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];

    if (b?._type === "contentBlockHtml") {
      const title = String(b?.title || "").trim();
      const html = safeHtmlForRender(String(b?.html || ""), brandKey);
      const len = roughTextLenFromHtml(html);

      // ✅ 내용이 거의 없고, 다음에 카드도 없으면 스킵
      if (len < 10 && !nextIsCardsWithSameTitle(i, title)) continue;

      if (!first) out.push(<KentDivider key={`div-${b._key || title}-${i}`} />);
      first = false;

      out.push(
        <section key={b._key || `${title}-${i}`} className="mt-10">
          {title ? <KentH2>{title}</KentH2> : null}

          {/* ✅ Kent 느낌: 본문은 카드 박스 대신 “본문형”으로 */}
          {len >= 10 ? (
            <div className="mt-3 text-slate-700 leading-7">
              <HtmlContent html={html} />
            </div>
          ) : null}
        </section>
      );
      continue;
    }

    if (b?._type === "contentBlockCards") {
      const kind = b?.kind as CardsKind;
      const title = String(b?.title || "").trim();
      const items = Array.isArray(b?.items) ? (b.items as CardItem[]) : [];
      if (!items.length) continue;

      // 카드 섹션은 바로 위 html 섹션과 이어질 수도 있으니, divider는 "이전 블록이 html이 아니면"만 넣음
      const prev = blocks[i - 1];
      const prevIsSameSectionHtml = prev && prev._type === "contentBlockHtml" && String(prev.title || "").trim() === title;

      if (!first && !prevIsSameSectionHtml) out.push(<KentDivider key={`div-${b._key || kind}-${i}`} />);
      first = false;

      if (kind === "product") {
        out.push(
          <section key={b._key || `prod-${title}-${i}`} className="mt-4">
            {/* ✅ product는 title을 위 html에서 이미 렌더했을 수도 있음 */}
            {!prevIsSameSectionHtml ? <KentH2>{title || "Featured products"}</KentH2> : null}

            <div className={`${prevIsSameSectionHtml ? "mt-4" : "mt-4"} grid gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
              {items.map((it, idx) => (
                <a
                  key={it._key || `${it.title}-${idx}`}
                  href={toLegacyIfExternal(it.href, brandKey)}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white hover:shadow-sm"
                >
                  <div className="relative aspect-square bg-slate-50">
                    {it.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.imageUrl} alt="" className="absolute inset-0 h-full w-full object-contain p-6" loading="lazy" />
                    ) : null}
                    {it.badge ? (
                      <span className="absolute left-3 top-3 rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white">
                        {it.badge}
                      </span>
                    ) : null}
                  </div>

                  <div className="p-5">
                    <div className="text-[13px] text-slate-500">Anesthesia</div>
                    <div className="mt-1 text-base font-semibold text-neutral-900 group-hover:underline">{it.title}</div>
                    {it.subtitle ? <div className="mt-2 text-sm text-slate-600 line-clamp-2">{it.subtitle}</div> : null}
                    {it.sku ? <div className="mt-2 text-xs text-slate-600">Cat.No: {it.sku}</div> : null}

                    <div className="mt-4">
                      <span className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white ${theme.btnBg} ${theme.btnHover}`}>
                        View product
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        );
        continue;
      }

      if (kind === "category") {
        out.push(
          <section key={b._key || `cat-${title}-${i}`} className="mt-4">
            {!prevIsSameSectionHtml ? <KentH2>{title || "Additional equipment"}</KentH2> : null}

            <div className={`${prevIsSameSectionHtml ? "mt-4" : "mt-4"} grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4`}>
              {items.map((it, idx) => (
                <a
                  key={it._key || `${it.title}-${idx}`}
                  href={toLegacyIfExternal(it.href, brandKey)}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white hover:shadow-sm"
                >
                  <div className="relative aspect-square bg-slate-50">
                    {it.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <div className="text-sm font-semibold text-white leading-snug">{it.title}</div>
                      {typeof it.count === "number" ? (
                        <div className="mt-1 text-xs text-white/90">
                          <span className="font-semibold">{it.count}</span> products
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <span className={`text-xs font-semibold ${theme.accentText}`}>Open ›</span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        );
        continue;
      }

      if (kind === "publication") {
        out.push(
          <section key={b._key || `pub-${i}`} className="mt-10">
            <KentH2>{title || "Scientific articles and publications"}</KentH2>
            <div className="mt-5 space-y-5">
              {items.map((it, idx) => (
                <div key={it._key || `${it.title}-${idx}`} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <a href={toLegacyIfExternal(it.href, brandKey)} className="block text-xl font-semibold tracking-tight text-neutral-900 hover:underline">
                    {it.title}
                  </a>
                  <div className="mt-4">
                    <a
                      href={toLegacyIfExternal(it.href, brandKey)}
                      className={`inline-flex items-center justify-center rounded-xl border border-blue-600 px-4 py-2 text-sm font-semibold ${theme.accentText} hover:bg-blue-50`}
                    >
                      Continue Reading
                    </a>
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
          <section key={b._key || `res-${i}`} className="mt-10">
            <KentH2>{title || "Resources"}</KentH2>
            <div className="mt-5 space-y-4">
              {items.map((it, idx) => (
                <a
                  key={it._key || `${it.title}-${idx}`}
                  href={toLegacyIfExternal(it.href, brandKey)}
                  className="group flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-sm"
                >
                  <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-50">
                    {it.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.imageUrl} alt="" className="absolute inset-0 h-full w-full object-contain p-2" loading="lazy" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-neutral-900 group-hover:underline">{it.title}</div>
                    {it.subtitle ? <div className="mt-1 text-sm text-slate-600 line-clamp-3">{it.subtitle}</div> : null}
                  </div>
                </a>
              ))}
            </div>
          </section>
        );
        continue;
      }
    }
  }

  return out.length ? <>{out}</> : null;
}

/* -------------------- Page -------------------- */

export default async function KentProductsPathPage({
  params,
}: {
  params: Promise<{ path?: string[] }> | { path?: string[] };
}) {
  const resolved = await Promise.resolve(params as any);

  // ✅ TS2367 방지
  const brandKey: string = "kent";
  const theme = THEME_KENT;

  const pathArr = (resolved?.path ?? []) as string[];
  const hasPath = pathArr.length > 0;
  const pathStr = pathArr.join("/");

  const data = await sanityClient.fetch(PAGE_QUERY, {
    brandKey,
    hasPath,
    pathArr,
    pathStr,
  });

  const brand = data?.brand;
  if (!brand?._id) notFound();

  const roots: CatLite[] = Array.isArray(data?.roots) ? data.roots : [];
  const descendants: CatLite[] = Array.isArray(data?.descendants) ? data.descendants : [];
  const category = data?.category || null;

  const { rootNodes: tree, nodes: nodeMap } = buildTreeFromAllCategories(roots, descendants);
  const titleByPathStr = new Map<string, string>();
  for (const n of nodeMap.values()) titleByPathStr.set(n.path.join("/"), n.title);

  if (!pathArr.length) {
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
              <SideNavTree brandKey={brandKey} activePath={[]} tree={tree} titleByPathStr={titleByPathStr} theme={theme} />
            </aside>
            <main className="lg:col-span-8">
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Select a category</h2>
              <p className="mt-3 text-neutral-700 leading-7">왼쪽 메뉴에서 카테고리를 선택하세요.</p>
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (!category?._id) notFound();

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: brand.title, href: `/products/${brandKey}` },
    { label: KENT_MENU_TITLE, href: `/products/${brandKey}` },
    ...pathArr.map((seg: string, i: number) => {
      const slice = pathArr.slice(0, i + 1);
      const ps = slice.join("/");
      const label = normalizeTitle(titleByPathStr.get(ps) || "", seg);
      return { label, href: buildHref(brandKey, slice) };
    }),
  ];

  const pageTitle = normalizeTitle(category?.title || "", pathArr[pathArr.length - 1] || "");
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
            <SideNavTree brandKey={brandKey} activePath={pathArr} tree={tree} titleByPathStr={titleByPathStr} theme={theme} />
          </aside>

          <main className="lg:col-span-8">
            <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">{pageTitle}</h2>

            {blocks.length ? (
              <div className="mt-2">{renderLandingBlocks(blocks, brandKey, theme)}</div>
            ) : (
              <div className={`mt-6 rounded-2xl border ${theme.accentBorder} ${theme.accentSoftBg} p-6 text-sm text-neutral-800`}>
                본문 데이터가 아직 없습니다.
                {category?.sourceUrl ? (
                  <>
                    {" "}
                    <a className={`font-semibold underline underline-offset-4 ${theme.accentText}`} href={legacyHref(brandKey, category.sourceUrl)}>
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