// app/products/[brand]/item/[...slug]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/site/Breadcrumb";
import { sanityClient } from "@/lib/sanity/sanity.client";
import { sanityWriteClient } from "@/lib/sanity/sanity.write";

import { parseAbmProductDetail } from "@/lib/abm/abm";

import ProductGalleryClient from "@/components/products/ProductGalleryClient";
import ProductTabsClient from "@/components/products/ProductTabs";

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

function stripCompanyNoise(input: string) {
  let t = (input || "").trim();
  t = t.replace(/Applied\s+Biological\s+Materials(?:\s*,?\s*Inc\.)?/gi, "");
  t = t.replace(/\(\s*\)/g, "");
  t = t.replace(/\s{2,}/g, " ");
  return t.trim();
}

function stripBrandSuffix(title: string) {
  const raw = decodeHtmlEntities((title || "").trim());
  const idx = raw.indexOf("|");
  const base = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  return stripCompanyNoise(base);
}

function legacyHref(brandKey: string, url: string) {
  return `/products/${brandKey}/legacy?u=${encodeURIComponent(url)}`;
}

/** ✅ Print 관련만 제거 (wrapper 통삭제 금지) */
function stripPrintFromHtml(html: any) {
  let out = typeof html === "string" ? html : "";
  if (!out) return out;

  out = out.replace(
    /<a[^>]*(?:onclick=["'][^"']*print[^"']*["']|href=["'][^"']*print[^"']*["'])[^>]*>[\s\S]*?<\/a>/gi,
    ""
  );
  out = out.replace(
    /<button[^>]*(?:onclick=["'][^"']*print[^"']*["']|class=["'][^"']*print[^"']*["'])[^>]*>[\s\S]*?<\/button>/gi,
    ""
  );
  out = out.replace(/<i[^>]*class=["'][^"']*fa-print[^"']*["'][^>]*>[\s\S]*?<\/i>/gi, "");
  out = out.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, (m) => (m.toLowerCase().includes("print") ? "" : m));
  out = out.replace(/\bPrint\b/gi, "");

  return out;
}

/** ✅ specsHtml 없을 때 fallback (렌더 보정용) */
function extractSpecsTableFromHtml(html: string) {
  if (!html) return "";

  const nearSpecs = html.match(/Specifications[\s\S]{0,5000}?(<table[\s\S]*?<\/table>)/i);
  if (nearSpecs?.[1]) return nearSpecs[1];

  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  for (const t of tables) {
    const low = t.toLowerCase();
    if (low.includes("spec") || low.includes("specification") || low.includes("parameter")) return t;
  }
  if (tables.length) return tables.reduce((a, b) => (a.length >= b.length ? a : b), "");

  return "";
}

function hasMeaningfulHtmlServer(html?: string) {
  const t = (html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return t.length > 0;
}

/** ✅ ABM 갤러리 노이즈(마케팅/로고/배지/버튼) 제거 */
function isGalleryNoiseUrl(u: string) {
  const s = (u || "").toLowerCase();
  if (!s) return true;

  // ABM에서 자주 섞이는 노이즈 케이스들
  if (s.includes("request") && s.includes("sample")) return true;
  if (s.includes("request") && s.includes("quote")) return true;
  if (s.includes("intertek")) return true;
  if (s.includes("badge")) return true;
  if (s.includes("icon")) return true;

  // flag/logo 계열(원본 갤러리에 들어가는 경우는 거의 없음)
  if (s.endsWith("/kr.png") || s.includes("/flag") || s.includes("flag-")) return true;
  if (s.includes("abm") && s.includes("logo")) return true;

  // ABM 썸네일 특유 사이즈(로고/국기에서 자주 나옴)
  if (/-16x11\./.test(s)) return true;
  if (/-229x65\./.test(s)) return true;

  return false;
}

/** -------------------- GROQ -------------------- */

const BRAND_QUERY = `
*[_type == "brand" && (themeKey == $brandKey || slug.current == $brandKey)][0]{
  _id, title, themeKey, "slug": slug.current
}
`;

const PRODUCT_QUERY = `
*[_type=="product" && slug.current == $slug && (brand->slug.current==$brandKey || brand->themeKey==$brandKey)][0]{
  _id,
  title,
  "slug": slug.current,
  sku,
  sourceUrl,
  categoryPath,
  categoryPathTitles,

  specsHtml,
  extraHtml,
  legacyHtml,

  datasheetHtml,
  documentsHtml,
  faqsHtml,
  referencesHtml,
  reviewsHtml,

  docs[]{ title, label, url },

  imageUrls,
  imageFiles,
  images[]{ _key, asset->{ url } },

  enrichedAt
}
`;

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000);

  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    signal: controller.signal,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    },
  });

  clearTimeout(t);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

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

async function fetchDescendants(client: any, brandKey: string, rootPath: string[]) {
  if (!rootPath.length) return [] as CatLite[];
  const depth = rootPath.length;
  const prefix = rootPath.join("/");
  const descendants: CatLite[] = await client.fetch(DESCENDANTS_BY_PREFIX_QUERY, {
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

/** -------------------- SideNav -------------------- */

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
            !isActive &&
            activePath.length > n.path.length &&
            activePath.slice(0, n.path.length).join("/") === p;

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

/** -------------------- Images normalize (ABM 1:1 우선 + 노이즈 제거) -------------------- */
function normalizeImages(product: any, title: string) {
  const urls: string[] = Array.isArray(product?.imageUrls)
    ? product.imageUrls.filter((u: any) => typeof u === "string" && u.trim())
    : [];

  if (urls.length) {
    const cleaned = urls.filter((u) => !isGalleryNoiseUrl(u));
    const seen = new Set<string>();
    return cleaned
      .map((u) => ({ url: u.trim(), alt: title }))
      .filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)));
  }

  // fallback only (imageUrls 없을 때만)
  const out: Array<{ url: string; alt: string }> = [];
  if (Array.isArray(product?.images)) {
    for (const im of product.images) {
      const u = im?.asset?.url;
      if (typeof u === "string" && u.trim() && !isGalleryNoiseUrl(u)) out.push({ url: u.trim(), alt: title });
    }
  }
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)));
}

/** -------------------- Hero -------------------- */
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
                {stripCompanyNoise(brandTitle)} Product
              </h1>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** -------------------- Page -------------------- */

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ brand: string; slug: string[] }> | { brand: string; slug: string[] };
}) {
  const resolved = await Promise.resolve(params as any);
  const brandKey = String(resolved?.brand ?? "").toLowerCase();
  const slugArr = (resolved?.slug ?? []) as string[];
  const slug = slugArr.join("/");

  if (!brandKey || !slug) notFound();

  // ✅ CDN stale 방지: 이 페이지에서는 항상 fresh로 fetch
  const client = (sanityClient as any).withConfig ? (sanityClient as any).withConfig({ useCdn: false }) : sanityClient;

  const brand = await client.fetch(BRAND_QUERY, { brandKey });
  if (!brand?._id) notFound();

  let product = await client.fetch(PRODUCT_QUERY, { slug, brandKey });
  if (!product?._id) notFound();

  // ✅ ABM on-demand enrich가 "빈 탭(원래 없는 탭)" 때문에 매번 재실행되며
  //    imageUrls/specsHtml을 덮어써서 깨지는 문제 방지:
  //    -> "핵심 필드가 진짜 비었을 때만" enrich
  const criticalMissing =
    !Array.isArray(product?.imageUrls) ||
    product.imageUrls.length === 0 ||
    !hasMeaningfulHtmlServer(product?.specsHtml) ||
    !Array.isArray(product?.categoryPath) ||
    product.categoryPath.length === 0;

  const needsEnrich = brandKey === "abm" && !!product?.sourceUrl && (!product?.enrichedAt || criticalMissing);

  if (needsEnrich && process.env.SANITY_WRITE_TOKEN) {
    try {
      const html = await fetchHtml(String(product.sourceUrl));
      const parsed: any = parseAbmProductDetail(html, String(product.sourceUrl));

      // ✅ 빈 값으로 overwrite 금지: meaningful할 때만 set
      const patchSet: Record<string, any> = {
        enrichedAt: new Date().toISOString(),
      };

      if (parsed?.title) patchSet.title = parsed.title;
      if (parsed?.sku) patchSet.sku = parsed.sku;

      if (Array.isArray(parsed?.categoryPathSlugs) && parsed.categoryPathSlugs.length)
        patchSet.categoryPath = parsed.categoryPathSlugs;
      if (Array.isArray(parsed?.categoryPathTitles) && parsed.categoryPathTitles.length)
        patchSet.categoryPathTitles = parsed.categoryPathTitles;

      if (hasMeaningfulHtmlServer(parsed?.specsHtml)) patchSet.specsHtml = parsed.specsHtml;

      if (hasMeaningfulHtmlServer(parsed?.datasheetHtml)) patchSet.datasheetHtml = parsed.datasheetHtml;
      if (hasMeaningfulHtmlServer(parsed?.documentsHtml)) patchSet.documentsHtml = parsed.documentsHtml;
      if (hasMeaningfulHtmlServer(parsed?.faqsHtml)) patchSet.faqsHtml = parsed.faqsHtml;
      if (hasMeaningfulHtmlServer(parsed?.referencesHtml)) patchSet.referencesHtml = parsed.referencesHtml;
      if (hasMeaningfulHtmlServer(parsed?.reviewsHtml)) patchSet.reviewsHtml = parsed.reviewsHtml;

      if (Array.isArray(parsed?.imageUrls) && parsed.imageUrls.length) patchSet.imageUrls = parsed.imageUrls;

      // docs normalize (title/label 혼재)
      if (Array.isArray(parsed?.docs) && parsed.docs.length) {
        patchSet.docs = parsed.docs
          .map((d: any) => {
            const url = typeof d?.url === "string" ? d.url.trim() : "";
            const title = typeof d?.title === "string" ? d.title.trim() : "";
            const label = typeof d?.label === "string" ? d.label.trim() : "";
            if (!url) return null;
            return { _type: "docItem", title: title || label || "Document", label: label || title || "Document", url };
          })
          .filter(Boolean);
      }

      await sanityWriteClient.patch(product._id).set(patchSet).commit();

      // 렌더용 최신 반영
      product = { ...product, ...patchSet };
    } catch (e) {
      console.error("ABM enrich failed:", (e as any)?.message || e);
    }
  }

  const title = stripBrandSuffix(product?.title || "");
  const catNo = decodeHtmlEntities((product?.sku || "").trim());

  const categoryPath: string[] = Array.isArray(product?.categoryPath) ? product.categoryPath : [];
  const categoryHref = buildHref(brandKey, categoryPath);

  const roots: CatLite[] = await client.fetch(ROOT_CATEGORIES_QUERY, { brandKey });
  const activeRoot = categoryPath[0] || "";
  let activeRootTree: TreeNode[] = [];
  if (activeRoot) {
    const descendants = await fetchDescendants(client, brandKey, [activeRoot]);
    activeRootTree = buildTreeFromDescendants([activeRoot], descendants);
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: stripCompanyNoise(brand.title), href: `/products/${brandKey}` },
    ...categoryPath.map((seg: string, i: number) => ({
      label: humanizeSegment(seg),
      href: buildHref(brandKey, categoryPath.slice(0, i + 1)),
    })),
    { label: title, href: `/products/${brandKey}/item/${product.slug}` },
  ];

  const openOriginalUrl =
    typeof product?.sourceUrl === "string" && product.sourceUrl.trim() ? product.sourceUrl.trim() : "";

  const images = normalizeImages(product, title);

  const rawSpecs = typeof product?.specsHtml === "string" && product.specsHtml.trim() ? product.specsHtml : "";
  const rawFallback =
    typeof product?.extraHtml === "string" && product.extraHtml.trim()
      ? product.extraHtml
      : typeof product?.legacyHtml === "string"
      ? product.legacyHtml
      : "";

  const derivedSpecs = rawSpecs ? "" : extractSpecsTableFromHtml(rawFallback);
  const specsHtml = stripPrintFromHtml(rawSpecs || derivedSpecs);

  const datasheetHtml = stripPrintFromHtml(product?.datasheetHtml);
  const documentsHtml = stripPrintFromHtml(product?.documentsHtml);
  const faqsHtml = stripPrintFromHtml(product?.faqsHtml);
  const referencesHtml = stripPrintFromHtml(product?.referencesHtml);
  const reviewsHtml = stripPrintFromHtml(product?.reviewsHtml);

  // ProductTabs는 label 사용: title/label 둘 다 대응
  const documents = Array.isArray(product?.docs)
    ? product.docs
        .map((d: any) => {
          const url = typeof d?.url === "string" ? d.url.trim() : "";
          const title2 = typeof d?.title === "string" ? d.title.trim() : "";
          const label2 = typeof d?.label === "string" ? d.label.trim() : "";
          if (!url) return null;
          return { url, label: title2 || label2 || "Document" };
        })
        .filter(Boolean)
    : [];

  return (
    <div>
      <HeroBanner brandTitle={brand.title} />

      <div className="mx-auto max-w-6xl px-6">
        <div className="mt-6 flex justify-end">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        <main className="mt-10 pb-14">
          <div className="grid gap-8 lg:grid-cols-12">
            <aside className="lg:col-span-4">
              <SideNavTree brandKey={brandKey} roots={roots} activePath={categoryPath} activeRootTree={activeRootTree} />
            </aside>

            <section className="lg:col-span-8">
              <h2 className="text-4xl font-semibold tracking-tight text-neutral-900">{title}</h2>

              {categoryPath.length ? (
                <div className={`mt-3 inline-flex rounded-full ${THEME.accentSoftBg} px-3 py-1 text-xs ${THEME.accentText}`}>
                  Category: {categoryPath.join(" / ")}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={categoryHref}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Back to Category
                </Link>

                {openOriginalUrl ? (
                  <Link
                    href={legacyHref(brandKey, openOriginalUrl)}
                    className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold ${THEME.accentBorder} ${THEME.accentSoftBg} ${THEME.accentText}`}
                  >
                    Open Original
                  </Link>
                ) : null}
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="p-5">
                  {catNo ? (
                    <div className="mb-4 text-sm">
                      <span className="font-semibold text-neutral-900">Cat. No.</span>
                      <span className="ml-3 text-neutral-800">{catNo}</span>
                    </div>
                  ) : null}

                  <ProductGalleryClient images={images} title={title} />
                </div>

                <div className="h-px bg-neutral-200" />

                <div className="p-5">
                  <div className="itsbio-product-tabs">
                    <ProductTabsClient
                      specsHtml={specsHtml}
                      datasheetHtml={datasheetHtml}
                      documentsHtml={documentsHtml}
                      faqsHtml={faqsHtml}
                      referencesHtml={referencesHtml}
                      reviewsHtml={reviewsHtml}
                      documents={documents as any}
                    />
                  </div>
                </div>
              </div>

              <div className="h-10" />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}