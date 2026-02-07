// app/products/[brand]/legacy/[[...legacy]]/page.tsx
import { redirect, notFound } from "next/navigation";
import { sanityClient } from "@/lib/sanity/sanity.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * legacy 경로 예:
 * /products/abm/legacy/mast-cell-lines.html
 * /products/abm/legacy/Cell-Immortalization.html
 * /products/abm/legacy/pcr-buffet-program
 *
 * 처리:
 * 1) brandKey(=params.brand) 기준으로
 * 2) category.sourceUrl 이 legacy URL과 매칭되면 => /products/{brandKey}/{category.path.join("/")} 로 redirect
 * 3) product.sourceUrl 매칭되면 => (아직 제품 상세 라우트가 확정 전이면 일단 /products/{brandKey}?legacy=... 같은 형태로)
 */

const RESOLVE_QUERY = `
{
  "category": *[
    _type=="category"
    && (
      themeKey==$brandKey
      || brandKey==$brandKey
      || brand->themeKey==$brandKey
      || brand->slug.current==$brandKey
    )
    && defined(sourceUrl)
    && (
      sourceUrl == $full1
      || sourceUrl == $full2
      || sourceUrl match $full1Wild
      || sourceUrl match $full2Wild
    )
  ][0]{ _id, path },

  "product": *[
    _type=="product"
    && (
      themeKey==$brandKey
      || brandKey==$brandKey
      || brand->themeKey==$brandKey
      || brand->slug.current==$brandKey
    )
    && defined(sourceUrl)
    && (
      sourceUrl == $full1
      || sourceUrl == $full2
      || sourceUrl match $full1Wild
      || sourceUrl match $full2Wild
    )
  ][0]{ _id, "slug": slug.current }
}
`;

function normalizeLegacyPath(segments: string[]) {
  const raw = (segments || []).join("/").trim();
  if (!raw) return "";
  // 그대로 유지(확장자도 포함 가능)
  return raw.replace(/^\/+/, "");
}

export default async function ProductsBrandLegacyResolverPage({
  params,
}: {
  params: Promise<{ brand: string; legacy?: string[] }> | { brand: string; legacy?: string[] };
}) {
  const resolved = await Promise.resolve(params as any);
  const brandKey = String(resolved?.brand || "").toLowerCase();
  const legacySegs = (resolved?.legacy || []) as string[];

  if (!brandKey) notFound();

  const legacyPath = normalizeLegacyPath(legacySegs);
  if (!legacyPath) notFound();

  // ABM 베이스 (필요시 brand별로 확장)
  const base1 = "https://www.abmgood.com/";
  const base2 = "https://abmgood.com/";

  const full1 = base1 + legacyPath;
  const full2 = base2 + legacyPath;

  // match 대비: 쿼리에서 * 와일드카드로 끝부분 매칭도 허용
  const full1Wild = `*${legacyPath}`;
  const full2Wild = `*${legacyPath}`;

  const r = await sanityClient.fetch(RESOLVE_QUERY, {
    brandKey,
    full1,
    full2,
    full1Wild,
    full2Wild,
  });

  // 1) category면 => 우리 트리 라우트로
  if (r?.category?.path?.length) {
    redirect(`/products/${brandKey}/${r.category.path.join("/")}`);
  }

  // 2) product면 => (제품 상세 라우트 확정 전)
  // 너희 제품 상세 라우팅이 정해져 있으면 여기만 바꿔주면 됨.
  // 예: /products/{brandKey}/product/{slug}
  if (r?.product?.slug) {
    redirect(`/products/${brandKey}/product/${r.product.slug}`);
  }

  // 못 찾으면 404
  notFound();
}
