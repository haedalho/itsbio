// app/products/[brand]/legacy/[[...legacy]]/page.tsx
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import * as cheerio from "cheerio";

import Breadcrumb from "@/components/site/Breadcrumb";
import HtmlContent from "@/components/site/HtmlContent";
import { sanityClient } from "@/lib/sanity/sanity.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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

type Crumb = { label: string; href?: string };

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
      "User-Agent": "Mozilla/5.0 (compatible; itsbio-migrator/1.0; +https://itsbio.co.kr)",
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

function collapseWs(s: string) {
  return String(s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function absUrl(href: string, baseUrl: string) {
  const s = String(href || "").trim();
  if (!s) return "";
  try {
    return new URL(s, baseUrl).toString();
  } catch {
    return s;
  }
}

function looksLikeGlobalMenuBlock(text: string) {
  const t = (text || "").toLowerCase();
  const keys = ["products", "services", "promotion", "promotions", "my account", "sign in", "shopping cart"];
  const hit = keys.filter((k) => t.includes(k)).length;
  return hit >= 3;
}

function scoreNode($el: cheerio.Cheerio) {
  const text = collapseWs($el.text() || "");
  const textLen = text.length;
  const pCount = $el.find("p").length;
  const hCount = $el.find("h1,h2,h3").length;
  const imgCount = $el.find("img").length;
  const linkCount = $el.find("a").length;

  let score = textLen;
  score += pCount * 220;
  score += hCount * 80;
  score += imgCount * 60;
  score -= linkCount * 12;

  // 메뉴 같은 건 강하게 패널티
  if (looksLikeGlobalMenuBlock(text)) score -= 8000;

  // 너무 짧으면 패널티
  if (textLen < 200 && pCount < 2) score -= 1500;

  return score;
}

function pickBestMain($: cheerio.CheerioAPI) {
  const selectors = [
    ".gh-content",
    ".post-content",
    ".entry-content",
    ".article-content",
    ".kb-article",
    "article",
    "main article",
    "main",
    "#content",
    ".content",
  ];

  let best: cheerio.Cheerio | null = null;
  let bestScore = -Infinity;

  for (const sel of selectors) {
    const nodes = $(sel);
    nodes.each((_, el) => {
      const $el = $(el);
      const sc = scoreNode($el);
      if (sc > bestScore) {
        bestScore = sc;
        best = $el;
      }
    });
  }

  // fallback: body
  return best && best.length ? best : $("body");
}

function extractBreadcrumbFromLegacy($frag: cheerio.CheerioAPI, baseUrl: string) {
  // 1) 명시적 breadcrumb
  const explicit = $frag(
    'nav[aria-label*="breadcrumb" i], .breadcrumb, .breadcrumbs, ol.breadcrumb, ul.breadcrumb'
  ).first();

  const toCrumbs = (root: cheerio.Cheerio) => {
    const items: Crumb[] = [];
    root.find("a").each((_, a) => {
      const $a = $frag(a);
      const label = collapseWs($a.text() || "");
      const href = absUrl($a.attr("href") || "", baseUrl);
      if (!label) return;
      items.push({ label, href: href || undefined });
    });

    // 링크가 없더라도 텍스트 노드만 있는 breadcrumb도 처리
    if (items.length <= 1) {
      const txt = collapseWs(root.text() || "");
      // "Home › Learning Resources › ..." 형태라면 분해 시도
      if (txt.includes("›")) {
        const parts = txt.split("›").map((x) => collapseWs(x)).filter(Boolean);
        if (parts.length >= 2) return parts.map((p, i) => ({ label: p, href: i === parts.length - 1 ? undefined : undefined }));
      }
    }

    return items;
  };

  if (explicit.length) {
    const items = toCrumbs(explicit);
    if (items.length >= 2) {
      // breadcrumb DOM은 본문에서 제거
      explicit.remove();
      return items;
    }
  }

  // 2) heuristic: "Home / Learning Resources / ..." 같이 보이는 짧은 링크 그룹
  const smallNav = $frag("a")
    .filter((_, a) => collapseWs($frag(a).text() || "").toLowerCase() === "home")
    .first()
    .closest("div, nav, ul, ol");

  if (smallNav && smallNav.length) {
    const items = toCrumbs(smallNav);
    if (items.length >= 2 && items.length <= 8) {
      smallNav.remove();
      return items;
    }
  }

  return [] as Crumb[];
}

function removeTocLikeBlocks($frag: cheerio.CheerioAPI) {
  // anchor(#) 링크가 많은 ul/ol은 TOC로 간주하고 제거
  $frag("ul,ol").each((_, el) => {
    const $el = $frag(el);
    const links = $el.find('a[href^="#"]');
    const allLinks = $el.find("a");
    if (allLinks.length >= 8 && links.length / Math.max(allLinks.length, 1) > 0.8) {
      $el.remove();
    }
  });

  // “Subscribe …” 같은 구독 블록 제거
  $frag("*").each((_, el) => {
    const $el = $frag(el);
    const t = collapseWs($el.text() || "").toLowerCase();
    if (t.includes("subscribe") && t.includes("notified")) {
      // 너무 넓게 지우지 않게, 폼/입력 포함한 블록만
      if ($el.find("input,button,form").length) $el.remove();
    }
  });
}

function extractLegacyArticle(fullHtml: string, url: string) {
  const html = stripScripts(fullHtml);
  const $ = cheerio.load(html);

  // 기본 제거(전역 헤더/푸터/사이드바)
  $("script, style, iframe, form, header, footer, nav, aside").remove();
  $(".navbar, .menu, .navigation, .site-header, .site-footer, .sidebar").remove();

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text() ||
    $("title").text() ||
    "Legacy";

  const main = pickBestMain($);
  const mainHtml = (main.html() || "").trim();

  const $frag = cheerio.load(`<div id="root">${mainHtml}</div>`);
  const $root = $frag("#root");

  // 본문 안에도 섞여 있는 전역 메뉴/푸터 제거
  $root.find("header, footer, nav, aside, script, style, iframe, form").remove();
  $root.find(".navbar, .menu, .navigation, .site-header, .site-footer, .sidebar").remove();

  // 메뉴처럼 보이는 큰 ul 제거
  $root.find("ul").each((_, ul) => {
    const $ul = $frag(ul);
    const liCount = $ul.find("li").length;
    if (liCount >= 10 && looksLikeGlobalMenuBlock($ul.text() || "")) $ul.remove();
  });

  // ✅ breadcrumb 추출 + 본문에서 제거
  const crumbs = extractBreadcrumbFromLegacy($frag, url);

  // ✅ TOC/구독 블록 제거
  removeTocLikeBlocks($frag);

  // 너무 빈 본문이면 fallback으로 body
  let bodyHtml = ($root.html() || "").trim();
  if (collapseWs($root.text() || "").length < 200) {
    const body = $("body");
    const bodyHtml2 = (body.html() || "").trim();
    const $frag2 = cheerio.load(`<div id="root">${bodyHtml2}</div>`);
    $frag2("#root").find("header, footer, nav, aside, script, style, iframe, form").remove();
    bodyHtml = ($frag2("#root").html() || "").trim();
  }

  return {
    title: collapseWs(title),
    crumbs,
    bodyHtml,
  };
}

function HeroBanner({ title }: { title: string }) {
  return (
    <section className="relative">
      <div className="relative h-[220px] w-full overflow-hidden md:h-[260px]">
        <Image src="/hero.png" alt="Hero" fill priority className="object-cover" />
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-transparent to-transparent" />
        <div className="absolute inset-0">
          <div className="mx-auto flex h-full max-w-6xl items-center px-6">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold tracking-wide text-white/80">ABM Legacy</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">{title}</h1>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
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

  // ✅ 1) abmgood.com 상품/카테고리면 Sanity로 redirect (info.abmgood.com은 그냥 legacy 렌더)
  const legacyPath = extractLegacyPathFromFullUrl(uRaw);
  if (legacyPath && /abmgood\.com/i.test(uRaw)) {
    const full1 = ABM_BASE1 + legacyPath;
    const full2 = ABM_BASE2 + legacyPath;

    const full1Wild = `*${legacyPath}`;
    const full2Wild = `*${legacyPath}`;

    const r = await sanityClient.fetch(RESOLVE_QUERY, { full1, full2, full1Wild, full2Wild });

    if (r?.category?.path?.length) redirect(`/products/${brandKey}/${r.category.path.join("/")}`);
    if (r?.product?.slug) redirect(`/products/${brandKey}/item/${r.product.slug}`);
  }

  const fullHtml = await fetchHtml(uRaw);
  if (!fullHtml) notFound();

  const extracted = extractLegacyArticle(fullHtml, uRaw);

  // ✅ breadcrumb: 원문 crumbs가 있으면 그걸 우선 사용
  const crumbItems: Crumb[] =
    extracted.crumbs && extracted.crumbs.length >= 2
      ? extracted.crumbs
      : [
          { label: "Home", href: "/" },
          { label: "Products", href: "/products" },
          { label: "ABM", href: "/products/abm" },
          { label: "Legacy" },
        ];

  return (
    <div>
      <HeroBanner title={extracted.title || "Legacy"} />

      <div className="mx-auto max-w-6xl px-6">
        <div className="mt-6 flex items-center justify-between gap-3">
          <Breadcrumb items={crumbItems} />
          <a
            href={uRaw}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-700"
          >
            Open Original
          </a>
        </div>

        <main className="mt-8 pb-14">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            {/* ✅ 본문만 넣고, 상대경로는 baseUrl로 복구 */}
            <HtmlContent html={extracted.bodyHtml} baseUrl={uRaw} />
          </div>
        </main>
      </div>
    </div>
  );
}