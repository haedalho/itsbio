import { redirect } from "next/navigation";

import { sanityClient } from "@/lib/sanity/sanity.client";
import { looksLikeCatNo } from "@/lib/abm/abm";
import { getAbmStagedRecord, stagedRecordPath } from "@/lib/abm/rebuild-staging";

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

  // 2) Production Product에 없으면 완전 적재된 ABM staging inventory에서 찾는다.
  // Preview runtime에서는 ABM 원본 사이트를 호출하거나 Product 문서를 생성하지 않는다.
  if (looksLikeCatNo(q)) {
    const [product, service] = await Promise.all([
      getAbmStagedRecord("product", q),
      getAbmStagedRecord("service", q),
    ]);
    if (product) redirect(stagedRecordPath("product", product));
    if (service) redirect(stagedRecordPath("service", service));
  }

  // 2-B) 제목/키워드는 자체 catalog filter로 이어진다.
  redirect(`/products/${BRAND_KEY}/products?q=${encodeURIComponent(q)}`);
}
