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

// ✅ cheerio 타입이 버전에 따라 length/get/each 인식이 깨지는 경우가 있어서
//    cheerio 객체 접근은 any로 안전하게 처리
function len(x: any) {
  return typeof x?.length === "number" ? x.length : 0;
}

function scoreNode($el: any) {
  const text = collapseWs($el.text?.() || "");
  const textLen = text.length;

  const pCount = len($el.find?.("p"));
  const hCount = len($el.find?.("h1,h2,h3"));
  const imgCount = len($el.find?.("img"));
  const linkCount = len($el.find?.("a"));

  let score = textLen;
  score += pCount * 220;
  score += hCount * 80;
  score += imgCount * 60;
  score -= linkCount * 12;

  if (looksLikeGlobalMenuBlock(text)) score -= 8000;
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

  let best: any = null;
  let bestScore = -Infinity;

  for (const sel of selectors) {
    const nodes: any = ($ as any)(sel);
    nodes?.each?.((_: any, el: any) => {
      const $el: any = ($ as any)(el);
      const sc = scoreNode($el);
      if (sc > bestScore) {
        bestScore = sc;
        best = $el;
      }
    });
  }

  const $body: any = ($ as any)("body");
  return best && len(best) ? best : $body;
}

function extractBreadcrumbFromLegacy($frag: cheerio.CheerioAPI, baseUrl: string) {
  const $f: any = $frag as any;

  // 1) 명시적 breadcrumb
  const explicit: any = $f(
    'nav[aria-label*="breadcrumb" i], .breadcrumb, .breadcrumbs, ol.breadcrumb, ul.breadcrumb'
  ).first?.();

  const toCrumbs = (root: any) => {
    const items: Crumb[] = [];
    root.find?.("a")?.each?.((_: any, a: any) => {
      const $a: any = $f(a);
      const label = collapseWs($a.text?.() || "");
      const href = absUrl($a.attr?.("href") || "", baseUrl);
      if (!label) return;
      items.push({ label, href: href || undefined });
    });

    if (items.length <= 1) {
      const txt = collapseWs(root.text?.() || "");
      if (txt.includes("›")) {
        const parts = txt
          .split("›")
          .map((x: string) => collapseWs(x))
          .filter(Boolean);
        if (parts.length >= 2) return parts.map((p: string) => ({ label: p }));
      }
    }

    return items;
  };

  if (explicit && len(explicit)) {
    const items = toCrumbs(explicit);
    if (items.length >= 2) {
      explicit.remove?.();
      return items;
    }
  }

  // 2) heuristic: "Home ..." 링크 그룹
  const smallNav: any = $f("a")
    .filter?.((_: any, a: any) => collapseWs($f(a).text?.() || "").toLowerCase() === "home")
    .first?.()
    .closest?.("div, nav, ul, ol");

  if (smallNav && len(smallNav)) {
    const items = toCrumbs(smallNav);
    if (items.length >= 2 && items.length <= 8) {
      smallNav.remove?.();
      return items;
    }
  }

  return [] as Crumb[];
}

function removeTocLikeBlocks($frag: cheerio.CheerioAPI) {
  const $f: any = $frag as any;

  $f("ul,ol")?.each?.((_: any, el: any) => {
    const $el: any = $f(el);
    const links: any = $el.find?.('a[href^="#"]');
    const allLinks: any = $el.find?.("a");

    const allLen = len(allLinks);
    const linksLen = len(links);

    if (allLen >= 8 && linksLen / Math.max(allLen, 1) > 0.8) {
      $el.remove?.();
    }
  });

  $f("*")?.each?.((_: any, el: any) => {
    const $el: any = $f(el);
    const t = collapseWs($el.text?.() || "").toLowerCase();
    if (t.includes("subscribe") && t.includes("notified")) {
      if (len($el.find?.("input,button,form")) > 0) $el.remove?.();
    }
  });
}

function extractLegacyArticle(fullHtml: string, url: string) {
  const html = stripScripts(fullHtml);
  const $ = cheerio.load(html);
  const $any: any = $ as any;

  $any("script, style, iframe, form, header, footer, nav, aside").remove?.();
  $any(".navbar, .menu, .navigation, .site-header, .site-footer, .sidebar").remove?.();

  const title =
    $any('meta[property="og:title"]').attr?.("content") ||
    $any("h1").first?.().text?.() ||
    $any("title").text?.() ||
    "Legacy";

  const main = pickBestMain($);
  const mainHtml = (main?.html?.() || "").trim();

  const $frag = cheerio.load(`<div id="root">${mainHtml}</div>`);
  const $f: any = $frag as any;
  const $root: any = $f("#root");

  $root.find?.("header, footer, nav, aside, script, style, iframe, form").remove?.();
  $root.find?.(".navbar, .menu, .navigation, .site-header, .site-footer, .sidebar").remove?.();

  $root.find?.("ul")?.each?.((_: any, ul: any) => {
    const $ul: any = $f(ul);
    const liCount = len($ul.find?.("li"));
    if (liCount >= 10 && looksLikeGlobalMenuBlock($ul.text?.() || "")) $ul.remove?.();
  });

  const crumbs = extractBreadcrumbFromLegacy($frag, url);
  removeTocLikeBlocks($frag);

  let bodyHtml = ($root.html?.() || "").trim();
  if (collapseWs($root.text?.() || "").length < 200) {
    const body: any = $any("body");
    const bodyHtml2 = (body?.html?.() || "").trim();
    const $frag2 = cheerio.load(`<div id="root">${bodyHtml2}</div>`);
    const $f2: any = $frag2 as any;
    $f2("#root").find?.("header, footer, nav, aside, script, style, iframe, form").remove?.();
    bodyHtml = ($f2("#root").html?.() || "").trim();
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
            <HtmlContent html={extracted.bodyHtml} baseUrl={uRaw} />
          </div>
        </main>
      </div>
    </div>
  );
}