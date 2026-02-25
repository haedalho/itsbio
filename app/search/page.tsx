import { redirect } from "next/navigation";
import Link from "next/link";

import { sanityClient } from "@/lib/sanity/sanity.client";
import { sanityWriteClient } from "@/lib/sanity/sanity.write";
import { abmSearchUrl, looksLikeCatNo, parseAbmSearch, parseAbmProductDetail } from "@/lib/abm/abm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const BRAND_KEY = "abm";

const FIND_BY_SKU_OR_TITLE = `
*[
  _type=="product"
  && isActive==true
  && (brand->slug.current == $brandKey || brand->themeKey == $brandKey)
  && (
    (defined($sku) && sku == $sku)
    || (defined($q) && title match $q)
  )
] | order(_updatedAt desc)[0] {
  _id,
  title,
  sku,
  "slug": slug.current,
  sourceUrl,
  categoryPath,
  categoryPathTitles,
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

function categoryHref(categoryPath: string[]) {
  if (!categoryPath?.length) return `/products/${BRAND_KEY}`;
  return `/products/${BRAND_KEY}/${categoryPath.join("/")}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const qRaw = (searchParams?.q || "").trim();
  const q = qRaw.replace(/\s+/g, " ").trim();

  if (!q) redirect(`/products/${BRAND_KEY}`);

  // 1) Sanity 우선 검색 (Cat.No exact / title match)
  const sku = looksLikeCatNo(q) ? q : undefined;
  const doc = await sanityClient.fetch(FIND_BY_SKU_OR_TITLE, {
    brandKey: BRAND_KEY,
    sku: sku ?? null,
    q: q ? `*${q}*` : null,
  });

  if (doc?.slug) {
    const href = categoryHref(doc.categoryPath || []);
    redirect(`${href}?open=${encodeURIComponent(doc.slug)}`);
  }

  // 2) Sanity에 없으면
  // 2-A) Cat.No이면 resolve → 단일이면 최소 생성 + (카테고리 추출) 후 카테고리로 이동
  if (looksLikeCatNo(q)) {
    const searchUrl = abmSearchUrl(q);
    const html = await fetchHtml(searchUrl).catch(() => "");
    if (!html) {
      redirect(searchUrl);
    }
    const resolved = parseAbmSearch(html, q);

    if (resolved.type === "single") {
      const productUrl = resolved.productUrl;

      // 상세에서 breadcrumb로 categoryPath 확보
      let detail;
      try {
        const detailHtml = await fetchHtml(productUrl);
        detail = parseAbmProductDetail(detailHtml, productUrl);
      } catch {
        detail = undefined;
      }

      // write token 없으면 ABM으로 이동
      if (!process.env.SANITY_WRITE_TOKEN) {
        redirect(productUrl);
      }

      const slug = productUrl
        .split("?")[0]
        .split("#")[0]
        .split("/")
        .pop()!
        .replace(/\.html$/i, "")
        .trim();

      const title = detail?.title || resolved.candidates?.[0]?.title || q;
      const categoryPath = detail?.categoryPathSlugs || [];
      const categoryPathTitles = detail?.categoryPathTitles || [];

      // 최소 인덱스 doc upsert (sku=Cat.No 기준)
      // 이미 다른 doc이 있으면 sku로 찾은 뒤 patch
      const existing = await sanityWriteClient.fetch(
        `*[_type=="product" && (brand->slug.current==$brandKey || brand->themeKey==$brandKey) && sku==$sku][0]{_id}`, 
        { brandKey: BRAND_KEY, sku: q }
      );

      if (existing?._id) {
        await sanityWriteClient
          .patch(existing._id)
          .set({
            title,
            sku: q,
            sourceUrl: productUrl,
            categoryPath,
            categoryPathTitles,
            ...(slug ? { slug: { _type: "slug", current: slug } } : {}),
          })
          .commit();
      } else {
        await sanityWriteClient.create({
          _type: "product",
          isActive: true,
          title,
          sku: q,
          sourceUrl: productUrl,
          categoryPath,
          categoryPathTitles,
          slug: { _type: "slug", current: slug },
          // brand reference는 기존 brand 문서를 써야 하므로, slug로 lookup
          brand: await sanityWriteClient
            .fetch(`*[_type=="brand" && (slug.current==$brandKey || themeKey==$brandKey)][0]{_id}`, {
              brandKey: BRAND_KEY,
            })
            .then((b: any) => ({ _type: "reference", _ref: b?._id })),
        });
      }

      const href = categoryHref(categoryPath);
      redirect(`${href}?open=${encodeURIComponent(slug)}`);
    }

    // 단일이 아니면 ABM 검색결과로
    redirect(searchUrl);
  }

  // 2-B) 키워드/제목 입력: 자동 이관 금지 → ABM 검색 결과로
  redirect(abmSearchUrl(q));

  // fallback (never)
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-xl font-semibold">Search</h1>
      <p className="mt-2 text-slate-600">No result for: {q}</p>
      <div className="mt-4">
        <Link className="text-orange-600 underline" href={abmSearchUrl(q)}>
          Open ABM search
        </Link>
      </div>
    </div>
  );
}
