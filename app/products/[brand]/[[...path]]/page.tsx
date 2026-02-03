import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumb from "@/components/site/Breadcrumb";
import NeedAssistance from "@/components/site/NeedAssistance";

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

// ✅ 핵심: image asset url을 GROQ에서 직접 가져온다 (urlFor 필요 없음)
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
  summary,
  sourceUrl,

  resources[]{
    _key,
    title,
    subtitle,
    href,
    image{
      asset->{
        _id,
        url
      }
    }
  },

  topPublications[]{
    _key,
    order,
    citation,
    doi,
    product
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

function ResourceSection({
  items,
}: {
  items: Array<{ key: string; title: string; subtitle?: string; href: string; imageUrl?: string }>;
}) {
  if (!items.length) return null;

  return (
    <section className="mt-10">
      <h3 className={`text-xl font-semibold ${THEME.accentText}`}>Resource</h3>

      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((x) => (
          <Link key={x.key} href={x.href} className="block">
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-300 hover:shadow-md">
              <div className="overflow-hidden rounded-t-2xl bg-neutral-100">
                <div className="aspect-[16/9] w-full">
                  {x.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={x.imageUrl} alt={x.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full" />
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
  items: Array<{ key: string; order: number; citation: string; doi?: string; product?: string }>;
}) {
  if (!items.length) return null;

  const sorted = [...items].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  return (
    <section className="mt-14">
      <h3 className={`text-2xl font-semibold ${THEME.accentText}`}>Top Publications</h3>

      <div className="mt-6 space-y-8">
        {sorted.map((p) => {
          const no = String(p.order ?? "").padStart(2, "0");
          return (
            <div key={p.key} className="flex gap-5">
              <div className="w-14 shrink-0">
                <div className={`text-3xl font-semibold ${THEME.accentText}`}>{no}</div>
                <div className="mt-2 h-[2px] w-10 bg-orange-500" />
              </div>

              <div className="min-w-0">
                <div className="text-sm leading-6 text-neutral-900 whitespace-pre-line">
                  {p.citation}
                </div>

                {p.doi ? (
                  <div className="mt-2 text-sm">
                    <a
                      href={p.doi}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-orange-600 underline underline-offset-4"
                    >
                      DOI
                    </a>
                  </div>
                ) : null}

                {p.product ? (
                  <div className="mt-2 text-sm text-neutral-800">
                    <span className="font-semibold">Product:</span> {p.product}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
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
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
                Select a category
              </h2>
              <p className="mt-3 text-neutral-700 leading-7">
                Please choose a category from the left menu.
              </p>

              <div className="mt-14">
                <NeedAssistance />
              </div>
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
  const summary = category?.summary || "";

  const resources = Array.isArray(category?.resources)
    ? category.resources.map((r: any) => ({
        key: r._key || `${r.title}-${r.href}`,
        title: r.title,
        subtitle: r.subtitle,
        href: r.href,
        imageUrl: r?.image?.asset?.url || "",
      }))
    : [];

  const pubs = Array.isArray(category?.topPublications)
    ? category.topPublications.map((p: any) => ({
        key: p._key || `${p.order}-${String(p.citation || "").slice(0, 20)}`,
        order: p.order,
        citation: p.citation,
        doi: p.doi,
        product: p.product,
      }))
    : [];

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
            {summary ? <p className="mt-4 text-neutral-700 leading-7">{summary}</p> : null}

            {/* ✅ 디버그(개발중 확인용): 나중에 지워도 됨 */}
            <div className="mt-6 text-xs text-neutral-400">
              resources: {resources.length} / topPublications: {pubs.length}
            </div>

            <ResourceSection items={resources} />
            <TopPublicationsSection items={pubs} />

            {resources.length === 0 && pubs.length === 0 ? (
              <div
                className={`mt-10 rounded-2xl border ${THEME.accentBorder} ${THEME.accentSoftBg} p-6 text-sm text-neutral-800`}
              >
                Resource / Top Publications 데이터가 아직 없습니다.
                {category?.sourceUrl ? (
                  <>
                    {" "}
                    <a
                      className="font-semibold underline underline-offset-4 text-orange-700"
                      href={category.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      원문 보기
                    </a>
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="mt-14">
              <NeedAssistance />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
