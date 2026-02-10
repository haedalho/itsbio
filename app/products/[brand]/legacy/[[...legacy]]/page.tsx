// app/products/[brand]/legacy/page.tsx
import { notFound, redirect } from "next/navigation";
import { sanityClient } from "@/lib/sanity/sanity.client";
import HtmlContent from "@/components/site/HtmlContent";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * ✅ /products/[brand]/legacy?u=<abm full url>
 *
 * 1) u 파라미터(원문 URL)에서 pathname 추출 → legacyPath
 * 2) Sanity에서 category/product sourceUrl 매칭
 *    - category면 /products/[brand]/... 로 redirect
 *    - product면  /products/[brand]/item/<slug> 로 redirect
 * 3) 매칭 실패하면: 원문 HTML fetch해서 legacy 화면으로 표시
 *
 * ⚠️ 너가 올린 resolver는 /legacy/[[...legacy]] 라우트에서만 동작함.
 *    실제 링크가 legacy?u=... 로 들어오므로, 여기서 redirect를 해줘야 item으로 감.
 */

const RESOLVE_QUERY = `
{
  "category": *[
    _type=="category"
    && defined(sourceUrl)
    && (
      sourceUrl == $full1
      || sourceUrl == $full2
      || sourceUrl match $full1Wild
      || sourceUrl match $full2Wild
    )
  ][0]{ _id, path, title },

  "product": *[
    _type=="product"
    && defined(sourceUrl)
    && (
      sourceUrl == $full1
      || sourceUrl == $full2
      || sourceUrl match $full1Wild
      || sourceUrl match $full2Wild
    )
  ][0]{ _id, "slug": slug.current, title }
}
`;

const ABM_BASE1 = "https://www.abmgood.com/";
const ABM_BASE2 = "https://abmgood.com/";

function normalizeIncomingUrl(u: string) {
  const s = String(u || "").trim();
  if (!s) return "";
  return s.replace(/[\u0000-\u001F\u007F]/g, "");
}

function extractLegacyPathFromFullUrl(fullUrl: string) {
  try {
    const url = new URL(fullUrl);
    let p = (url.pathname || "").trim();
    p = p.replace(/^\/+/, "");
    return p;
  } catch {
    let p = String(fullUrl || "").trim();
    p = p.replace(/^https?:\/\/(www\.)?abmgood\.com\/?/i, "");
    p = p.replace(/[\?#].*$/g, "");
    p = p.replace(/^\/+|\/+$/g, "");
    return p;
  }
}

async function fetchHtml(fullUrl: string) {
  const res = await fetch(fullUrl, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; itsbio-migrator/1.0; +https://itsbio.co.kr)",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });
  if (!res.ok) return "";
  return (await res.text()) || "";
}

function stripScripts(html: string) {
  if (!html) return "";
  return html.replace(/<script[\s\S]*?<\/script>/gi, "");
}

export default async function ProductsBrandLegacyProxyPage({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string }> | { brand: string };
  searchParams: Promise<{ u?: string }> | { u?: string };
}) {
  const resolvedParams = await Promise.resolve(params as any);
  const resolvedSearch = await Promise.resolve(searchParams as any);

  const brandKey = String(resolvedParams?.brand ?? "").toLowerCase();
  const uRaw = normalizeIncomingUrl(resolvedSearch?.u ?? "");

  if (!brandKey) notFound();
  if (!uRaw) notFound();

  // ✅ 1) Sanity 매칭 → 있으면 item/category로 redirect
  const legacyPath = extractLegacyPathFromFullUrl(uRaw);
  if (legacyPath) {
    const full1 = ABM_BASE1 + legacyPath;
    const full2 = ABM_BASE2 + legacyPath;

    const full1Wild = `*${legacyPath}`;
    const full2Wild = `*${legacyPath}`;

    const r = await sanityClient.fetch(RESOLVE_QUERY, {
      full1,
      full2,
      full1Wild,
      full2Wild,
    });

    if (r?.category?.path?.length) {
      redirect(`/products/${brandKey}/${r.category.path.join("/")}`);
    }

    if (r?.product?.slug) {
      redirect(`/products/${brandKey}/item/${r.product.slug}`);
    }
  }

  // ✅ 2) 매칭 실패 → legacy 화면 렌더(원문 HTML)
  const html = await fetchHtml(uRaw);
  if (!html) notFound();

  const cleaned = stripScripts(html);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-4 text-sm text-neutral-600">
          Legacy view (source):{" "}
          <span className="break-all font-semibold text-neutral-800">{uRaw}</span>
        </div>
        <HtmlContent html={cleaned} />
      </div>
    </div>
  );
}
