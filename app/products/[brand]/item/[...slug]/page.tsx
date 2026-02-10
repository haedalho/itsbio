// app/products/[brand]/item/[...slug]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/site/Breadcrumb";
import { sanityClient } from "@/lib/sanity/sanity.client";

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

function stripPrintFromHtml(html: any) {
  let out = typeof html === "string" ? html : "";
  if (!out) return out;

  out = out.replace(/\bPrint\b/gi, "");

  out = out.replace(/<a[^>]*>\s*Print\s*<\/a>/gi, "");
  out = out.replace(/<button[^>]*>\s*Print\s*<\/button>/gi, "");

  out = out.replace(
    /<([a-z0-9]+)([^>]*)(id|class)=["'][^"']*print[^"']*["']([^>]*)>[\s\S]*?<\/\1>/gi,
    ""
  );

  out = out.replace(
    /<([a-z0-9]+)([^>]*)(title|aria-label)=["'][^"']*print[^"']*["']([^>]*)>[\s\S]*?<\/\1>/gi,
    ""
  );

  out = out.replace(/<a([^>]*?)href=["'][^"']*print[^"']*["']([^>]*)>[\s\S]*?<\/a>/gi, "");

  out = out.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, (m) => {
    const mm = m.toLowerCase();
    if (mm.includes("print")) return "";
    return m;
  });

  out = out.replace(/<i[^>]*class=["'][^"']*print[^"']*["'][^>]*>[\s\S]*?<\/i>/gi, "");

  return out;
}

/** -------------------- GROQ -------------------- */

const BRAND_QUERY = `
*[_type == "brand" && (themeKey == $brandKey || slug.current == $brandKey)][0]{
  _id, title, themeKey, "slug": slug.current
}
`;

const PRODUCT_QUERY = `
*[_type=="product" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  catNo,
  sourceUrl,
  categoryPath,

  specsHtml,
  datasheetHtml,
  documentsHtml,
  faqsHtml,
  referencesHtml,
  reviewsHtml,

  docs[]{
    _key,
    label,
    url
  },

  imageFiles,
  imageUrls,
  images[]{
    _key,
    asset->{ url }
  }
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
            !isActive && activePath.length > n.path.length && activePath.slice(0, n.path.length).join("/") === p;

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

/** -------------------- Images normalize (logo/kr 제거) -------------------- */

function normalizeImages(product: any, title: string) {
  const urls: string[] = Array.isArray(product?.imageUrls)
    ? product.imageUrls.filter((u: any) => typeof u === "string")
    : [];
  const files: string[] = Array.isArray(product?.imageFiles)
    ? product.imageFiles.filter((f: any) => typeof f === "string")
    : [];

  const skipIdx = new Set<number>();

  if (files.length >= 2) {
    const f0 = (files[0] || "").toLowerCase();
    const f1 = (files[1] || "").toLowerCase();
    if (f0.includes("abm") && f0.includes("logo")) skipIdx.add(0);
    if (f1 === "kr.png" || f1.includes("kr")) skipIdx.add(1);
  } else {
    if (urls[0] && /-229x65\./i.test(urls[0])) skipIdx.add(0);
    if (urls[1] && /-16x11\./i.test(urls[1])) skipIdx.add(1);
  }

  const out: Array<{ url: string; alt: string }> = [];
  for (let i = 0; i < urls.length; i++) {
    if (skipIdx.has(i)) continue;
    const u = (urls[i] || "").trim();
    if (u) out.push({ url: u, alt: title });
  }

  if (Array.isArray(product?.images)) {
    for (const im of product.images) {
      const u = im?.asset?.url;
      if (typeof u !== "string" || !u.trim()) continue;
      const lu = u.toLowerCase();
      if (lu.includes("abmlogo")) continue;
      if (/-16x11\./.test(lu)) continue;
      if (/-229x65\./.test(lu)) continue;
      out.push({ url: u.trim(), alt: title });
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

  const brand = await sanityClient.fetch(BRAND_QUERY, { brandKey });
  if (!brand?._id) notFound();

  const product = await sanityClient.fetch(PRODUCT_QUERY, { slug });
  if (!product?._id) notFound();

  const title = stripBrandSuffix(product?.title || "");
  const catNo = decodeHtmlEntities((product?.catNo || "").trim());

  const categoryPath: string[] = Array.isArray(product?.categoryPath) ? product.categoryPath : [];
  const categoryHref = buildHref(brandKey, categoryPath);

  const roots: CatLite[] = await sanityClient.fetch(ROOT_CATEGORIES_QUERY, { brandKey });
  const activeRoot = categoryPath[0] || "";
  let activeRootTree: TreeNode[] = [];
  if (activeRoot) {
    const descendants = await fetchDescendants(brandKey, [activeRoot]);
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

  const specsHtml = stripPrintFromHtml(product?.specsHtml);
  const datasheetHtml = stripPrintFromHtml(product?.datasheetHtml);
  const documentsHtml = stripPrintFromHtml(product?.documentsHtml);
  const faqsHtml = stripPrintFromHtml(product?.faqsHtml);
  const referencesHtml = stripPrintFromHtml(product?.referencesHtml);
  const reviewsHtml = stripPrintFromHtml(product?.reviewsHtml);

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

                
              </div>

              {/* ✅ 여기서 “갤러리 + 탭” 테두리를 하나로 합침 */}
              <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                {/* top: catno + gallery */}
                <div className="p-5">
                  {catNo ? (
                    <div className="mb-4 text-sm">
                      <span className="font-semibold text-neutral-900">Cat. No.</span>
                      <span className="ml-3 text-neutral-800">{catNo}</span>
                    </div>
                  ) : null}

                  <ProductGalleryClient images={images} title={title} />
                </div>

                {/* divider */}
                <div className="h-px bg-neutral-200" />

                {/* bottom: tabs */}
                <div className="p-5">
                  <style
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{
                      __html: `
                        .itsbio-product-tabs [id*="print" i],
                        .itsbio-product-tabs [class*="print" i] { display:none !important; }

                        .itsbio-product-tabs a[title*="print" i],
                        .itsbio-product-tabs button[title*="print" i],
                        .itsbio-product-tabs a[aria-label*="print" i],
                        .itsbio-product-tabs button[aria-label*="print" i] { display:none !important; }

                        .itsbio-product-tabs a[href*="print" i],
                        .itsbio-product-tabs button[data-action*="print" i],
                        .itsbio-product-tabs [data-action*="print" i] { display:none !important; }
                      `,
                    }}
                  />

                  <div className="itsbio-product-tabs">
                    <ProductTabsClient
                      specsHtml={specsHtml}
                      datasheetHtml={datasheetHtml}
                      documentsHtml={documentsHtml}
                      faqsHtml={faqsHtml}
                      referencesHtml={referencesHtml}
                      reviewsHtml={reviewsHtml}
                      documents={Array.isArray(product?.docs) ? product.docs : []}
                    />
                  </div>
                </div>
              </div>

              {/* NeedAssistance와 붙는 거 방지 */}
              <div className="h-10" />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
