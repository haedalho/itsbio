"use client";

import React, { useEffect, useMemo, useState } from "react";

type Props = {
  html: string;
  className?: string;
  /** legacy 등에서 상대경로(href="/", src="/")를 절대경로로 바꾸기 위한 base */
  baseUrl?: string;
};

const TABLE_WRAP_CLASS = "overflow-x-auto rounded-2xl border border-orange-200 bg-white shadow-sm";
const TABLE_CLASS = "w-full text-sm text-neutral-800 border-separate border-spacing-0";
const TH_CLASS = "bg-orange-500 text-white font-semibold text-left px-4 py-3 align-middle";
const TD_CLASS = "px-4 py-3 border-t border-neutral-100 align-top";
const STRIPED_ROW_CLASS = "bg-neutral-50";

function lower(x: unknown) {
  return String(x ?? "").toLowerCase();
}
function removeNode(n: Element | null) {
  if (n?.parentNode) n.parentNode.removeChild(n);
}
function collapseWs(s: string) {
  return (s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeMailto(html: string) {
  return html
    .replace(/mailto:technical@abmgood\.com/gi, "mailto:info@itsbio.co.kr")
    .replace(/mailto:quotes@abmgood\.com/gi, "mailto:info@itsbio.co.kr")
    .replace(/technical@abmgood\.com/gi, "info@itsbio.co.kr")
    .replace(/quotes@abmgood\.com/gi, "info@itsbio.co.kr");
}

/** ✅ HTML 안의 /p/ 링크를 /item/으로 강제 */
function rewriteProductPLinksToItem(html: string) {
  if (!html) return "";
  let out = html.replace(
    /\/products\/([^/]+)\/p\/([^"'\s<]+)/gi,
    (_m, brand, rest) => `/products/${String(brand).toLowerCase()}/item/${rest}`
  );
  out = out.replace(/href=["']\/p\/([^"']+)["']/gi, `href="/products/abm/item/$1"`);
  return out;
}

/** ✅ 확정 로고/국기 같은 UI 이미지 제거 (제품이미지 보호) */
function isDefinitelyBrandOrFlag(img: HTMLImageElement) {
  const src = lower(img.getAttribute("src"));
  const alt = lower(img.getAttribute("alt"));
  const cls = lower(img.getAttribute("class"));
  const id = lower(img.getAttribute("id"));
  const combined = `${src} ${alt} ${cls} ${id}`;

  const hard = ["logo", "flag", "korea", "korean", "language", "lang", "icon-flag", "country"];
  if (hard.some((k) => combined.includes(k))) return true;

  const hasAbm = combined.includes("abm");
  const hasUi =
    combined.includes("logo") ||
    combined.includes("flag") ||
    combined.includes("korea") ||
    combined.includes(" lang") ||
    combined.includes("language") ||
    combined.includes("/kr") ||
    combined.includes("kr.");
  if (hasAbm && hasUi) return true;

  return false;
}

/**
 * ✅ 너가 붙여준 “Products 카드 그리드(우리 Tailwind 마크업)”를 강하게 삭제
 */
function removeInjectedProductsGrid(doc: Document) {
  const headers = Array.from(doc.querySelectorAll("div, h3, h4, strong")).filter((el) => {
    const t = collapseWs(el.textContent || "");
    return t === "Products";
  });

  for (const h of headers) {
    let cur: Element | null = h as Element;
    for (let i = 0; i < 6 && cur; i++) {
      const links = cur.querySelectorAll('a[href^="/products/"][href*="/item/"]');
      const grid = cur.querySelector('div[class*="grid"]');
      const hasThumb = cur.querySelector('div[class*="relative"][class*="h-12"][class*="w-12"]');
      if (grid && links.length >= 2 && hasThumb) {
        removeNode(cur);
        break;
      }
      cur = cur.parentElement;
    }
  }

  const grids = Array.from(doc.querySelectorAll('div[class*="grid"]'));
  for (const g of grids) {
    const links = g.querySelectorAll('a[href^="/products/"][href*="/item/"]');
    const hasThumb = g.querySelector('div[class*="relative"][class*="h-12"][class*="w-12"]');
    if (links.length >= 6 && hasThumb) {
      const parent = g.parentElement;
      const parentCls = parent?.getAttribute("class") || "";
      if (parent && parentCls.includes("mt-6")) removeNode(parent);
      else removeNode(g);
    }
  }
}

/**
 * ✅ 가독성 개선:
 * - 텍스트만 있는 div/span/section을 <p>로 바꿔서 문단 간격 생기게
 * - p/div/span에 inline style로 margin:0 들어간 것 제거
 */
function improveReadability(doc: Document) {
  doc.querySelectorAll("p[style],div[style],span[style]").forEach((el) => {
    const s = (el.getAttribute("style") || "").toLowerCase();
    if (s.includes("margin:0") || s.includes("margin: 0") || s.includes("padding:0") || s.includes("padding: 0")) {
      el.removeAttribute("style");
    }
  });

  const blockTags = new Set([
    "div",
    "p",
    "ul",
    "ol",
    "table",
    "img",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "section",
    "article",
    "blockquote",
  ]);

  const isGridish = (el: Element) => {
    const c = lower(el.getAttribute("class"));
    return c.includes("row") || c.includes("col-");
  };

  const candidates = Array.from(doc.querySelectorAll("div, section, span"));
  for (const el of candidates) {
    if (!el.parentElement) continue;
    if (isGridish(el)) continue;

    const hasImg = !!el.querySelector("img");
    if (hasImg) continue;

    const childEls = Array.from(el.children);
    if (childEls.some((c) => blockTags.has(c.tagName.toLowerCase()))) continue;

    const txt = collapseWs(el.textContent || "");
    if (txt.length < 1) continue;

    const p = doc.createElement("p");
    while (el.firstChild) p.appendChild(el.firstChild);
    el.parentElement.replaceChild(p, el);
  }
}

/**
 * ✅ HtmlContent 범위 안에서만 Bootstrap grid 최소 재현(ABM 레이아웃 유지)
 */
function buildMiniBootstrapCss() {
  let css = `
.itsbio-html .row{display:flex;flex-wrap:wrap;margin-left:-12px;margin-right:-12px}
.itsbio-html .row > [class*="col-"]{padding-left:12px;padding-right:12px;box-sizing:border-box}
.itsbio-html .clearfix::after{content:"";display:block;clear:both}
.itsbio-html .text-center{text-align:center}
.itsbio-html .text-right{text-align:right}
.itsbio-html .text-left{text-align:left}

/* ✅ 이미지: width는 존중, 넘치지만 않게 */
.itsbio-html img{max-width:100%;height:auto}
.itsbio-html .img-responsive{display:block;max-width:100%;height:auto}

/* ✅ 가독성 */
.itsbio-html p{margin:0 0 .9em}
.itsbio-html li{margin:.25em 0}
.itsbio-html h2,.itsbio-html h3{margin-top:1.4em;margin-bottom:.6em}
`;

  const mk = (prefix: string) => {
    for (let n = 1; n <= 12; n++) {
      const pct = (n / 12) * 100;
      css += `
.itsbio-html .${prefix}-${n}{flex:0 0 ${pct}%;max-width:${pct}%}
.itsbio-html .${prefix}-offset-${n}{margin-left:${pct}%}
`;
    }
  };

  mk("col-xs");
  mk("col-sm");
  mk("col-md");
  mk("col-lg");

  css += `
@media (max-width:768px){
  .itsbio-html .col-sm-1,.itsbio-html .col-sm-2,.itsbio-html .col-sm-3,.itsbio-html .col-sm-4,.itsbio-html .col-sm-5,.itsbio-html .col-sm-6,
  .itsbio-html .col-sm-7,.itsbio-html .col-sm-8,.itsbio-html .col-sm-9,.itsbio-html .col-sm-10,.itsbio-html .col-sm-11,.itsbio-html .col-sm-12,
  .itsbio-html .col-md-1,.itsbio-html .col-md-2,.itsbio-html .col-md-3,.itsbio-html .col-md-4,.itsbio-html .col-md-5,.itsbio-html .col-md-6,
  .itsbio-html .col-md-7,.itsbio-html .col-md-8,.itsbio-html .col-md-9,.itsbio-html .col-md-10,.itsbio-html .col-md-11,.itsbio-html .col-md-12,
  .itsbio-html .col-lg-1,.itsbio-html .col-lg-2,.itsbio-html .col-lg-3,.itsbio-html .col-lg-4,.itsbio-html .col-lg-5,.itsbio-html .col-lg-6,
  .itsbio-html .col-lg-7,.itsbio-html .col-lg-8,.itsbio-html .col-lg-9,.itsbio-html .col-lg-10,.itsbio-html .col-lg-11,.itsbio-html .col-lg-12{
    flex:0 0 100%;max-width:100%;margin-left:0
  }
}
`;
  return css;
}

const MINI_BOOTSTRAP_CSS = buildMiniBootstrapCss();

/** ✅ baseUrl이 비어있을 때, html 안에서 최대한 추정(ABM 같은 케이스) */
function inferBaseUrlFromHtml(rawHtml: string) {
  const s = rawHtml || "";

  // 1) html에 절대 URL이 있으면 그걸 사용
  const abs = s.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
  if (abs) return abs;

  // 2) protocol-relative
  const pr = s.match(/\/\/[^\s"'<>]+/i)?.[0];
  if (pr) return `https:${pr}`;

  // 3) 키워드 기반(ABM)
  if (/abmgood\.com/i.test(s) || /assets\/images\/catalogPage/i.test(s)) return "https://www.abmgood.com";

  return "";
}

function resolveUrl(u: string, baseUrl: string) {
  const v = (u || "").trim();
  if (!v) return v;

  // special schemes
  if (/^(https?:|data:|blob:|mailto:|tel:|#)/i.test(v)) return v;

  // protocol-relative
  if (v.startsWith("//")) return `https:${v}`;

  try {
    return new URL(v, baseUrl).toString();
  } catch {
    return v;
  }
}

function resolveSrcset(srcset: string, baseUrl: string) {
  const s = (srcset || "").trim();
  if (!s) return s;

  return s
    .split(",")
    .map((part) => {
      const p = part.trim();
      if (!p) return "";
      const [url, ...rest] = p.split(/\s+/);
      const fixed = resolveUrl(url, baseUrl);
      return [fixed, ...rest].join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

function isInternalItsbioHref(href: string) {
  const h = (href || "").trim();
  if (!h) return true;
  if (h.startsWith("#") || /^mailto:|^tel:/i.test(h)) return true;

  // ✅ 우리 사이트 내부 라우트는 절대경로화 금지
  if (/^\/(products|notice|promotions|studio-admin|contact)(\/|$)/i.test(h)) return true;

  return false;
}

/**
 * ✅ 이미지/미디어 URL 절대경로화 + lazyload src 복구
 * - img/src, img/srcset, source/srcset, video/audio/src/poster 등 처리
 * - a[href]는 "우리 내부 링크"는 건드리지 않고, 그 외 루트상대(/xxx)는 baseUrl로 절대경로화
 * - style="background-image:url(...)" 도 보정
 */
function fixMediaAndLinks(doc: Document, baseUrl: string) {
  if (!baseUrl) return;

  // IMG: lazy 속성 → src로 승격
  doc.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    const srcRaw = (img.getAttribute("src") || "").trim();
    const isPlaceholder =
      !srcRaw ||
      srcRaw === "#" ||
      srcRaw === "about:blank" ||
      /^data:image\/(gif|svg\+xml)/i.test(srcRaw);

    if (isPlaceholder) {
      const lazyAttrs = ["data-src", "data-original", "data-lazy-src", "data-echo", "data-url"];
      for (const a of lazyAttrs) {
        const v = (img.getAttribute(a) || "").trim();
        if (v) {
          img.setAttribute("src", v);
          break;
        }
      }
    }

    // data-srcset → srcset 승격
    if (!img.getAttribute("srcset")) {
      const dss = (img.getAttribute("data-srcset") || "").trim();
      if (dss) img.setAttribute("srcset", dss);
    }

    // src 절대경로
    const src = (img.getAttribute("src") || "").trim();
    if (src) img.setAttribute("src", resolveUrl(src, baseUrl));

    // srcset 절대경로
    const ss = (img.getAttribute("srcset") || "").trim();
    if (ss) img.setAttribute("srcset", resolveSrcset(ss, baseUrl));

    // (가끔 핫링크/리퍼러 이슈 완화용)
    img.setAttribute("referrerpolicy", "no-referrer");
  });

  // <source srcset=...> (picture)
  doc.querySelectorAll<HTMLSourceElement>("source").forEach((s) => {
    const ss = (s.getAttribute("srcset") || "").trim();
    if (ss) s.setAttribute("srcset", resolveSrcset(ss, baseUrl));
  });

  // video/audio/poster/track 등
  doc.querySelectorAll<HTMLElement>("video, audio, track, source").forEach((el) => {
    const src = (el.getAttribute("src") || "").trim();
    if (src) el.setAttribute("src", resolveUrl(src, baseUrl));

    const poster = (el.getAttribute("poster") || "").trim();
    if (poster) el.setAttribute("poster", resolveUrl(poster, baseUrl));
  });

  // background-image:url(...)
  doc.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const style = el.getAttribute("style") || "";
    if (!style.toLowerCase().includes("url(")) return;

    const fixed = style.replace(/url\((['"]?)([^'")]+)\1\)/gi, (_m, _q, u) => {
      return `url("${resolveUrl(String(u), baseUrl)}")`;
    });
    el.setAttribute("style", fixed);
  });

  // a[href]는 내부링크 제외, 루트상대(/xxx)는 baseUrl로 절대경로화
  doc.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    const href = (a.getAttribute("href") || "").trim();
    if (!href) return;
    if (isInternalItsbioHref(href)) return;

    // 루트상대 or 상대경로면 baseUrl로 붙여줌
    if (!/^(https?:|mailto:|tel:|#)/i.test(href)) {
      a.setAttribute("href", resolveUrl(href, baseUrl));
    }
  });
}

function sanitizeAndStyle(rawHtml: string, baseUrl?: string) {
  if (!rawHtml) return "";

  // ✅ 0) 문자열 레벨 전처리
  let html = normalizeMailto(rawHtml);
  html = rewriteProductPLinksToItem(html);

  // baseUrl 없으면 추정
  const effectiveBase = (baseUrl || "").trim() || inferBaseUrlFromHtml(html);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // ✅ 0.5) (가장 중요) 이미지/미디어 URL 보정 + lazyload src 복구
  if (effectiveBase) {
    fixMediaAndLinks(doc, effectiveBase);
  }

  // ✅ 1) 우리가 주입한 Products 카드 그리드 제거
  removeInjectedProductsGrid(doc);

  // 2) script/style/iframe/form 제거
  doc
    .querySelectorAll("script, style, iframe, form, input, textarea, button, select")
    .forEach((el) => removeNode(el));

  // 3) nav/header/footer/aside 제거 + ABM footer 제거
  doc.querySelectorAll("nav, header, footer, aside").forEach((el) => removeNode(el));
  doc.querySelectorAll("#footer, .footer, .footer-top, .footer-bottom").forEach((el) => removeNode(el));

  // ✅ 규칙: Request Free Sample 버튼/링크 제거
  doc.querySelectorAll('a[href*="/free-sample"], a[href*="abmgood.com/free-sample"]').forEach((a) => removeNode(a));
  doc.querySelectorAll('img[src*="Request-Free-Sample-Button"], img[alt*="Request Free Sample"]').forEach((img) =>
    removeNode(img)
  );

  // 4) mailto 링크 통일 + ABM 메뉴 링크 제거
  doc.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (/mailto:/i.test(href)) {
      a.setAttribute("href", "mailto:info@itsbio.co.kr");
      a.textContent = "info@itsbio.co.kr";
      return;
    }

    // DOM 레벨에서도 p링크 보정
    const h = href.trim();
    const m = h.match(/^\/products\/([^/]+)\/p\/(.+)$/i);
    if (m) {
      const brand = String(m[1]).toLowerCase();
      const rest = m[2];
      a.setAttribute("href", `/products/${brand}/item/${rest}`);
    }

    const txt = lower(a.textContent);
    const hh = lower(href);
    const bad =
      txt.includes("my account") ||
      txt.includes("cart") ||
      txt.includes("shopping cart") ||
      txt.includes("sign in") ||
      txt.includes("login") ||
      txt.includes("about") ||
      txt.includes("distributors") ||
      txt.includes("contact us") ||
      txt.includes("blog") ||
      txt === "kr" ||
      txt === "en" ||
      hh.includes("my-account") ||
      hh.includes("shopping-cart") ||
      hh.includes("checkout") ||
      hh.includes("/account");

    if (bad) removeNode(a);
  });

  // 5) 확정 로고/국기 이미지 제거
  doc.querySelectorAll("img").forEach((img) => {
    if (isDefinitelyBrandOrFlag(img as HTMLImageElement)) removeNode(img);
  });

  // 6) 테이블 Price 컬럼 제거 + 스타일 적용
  doc.querySelectorAll("table").forEach((table) => {
    const headerCells = Array.from(table.querySelectorAll("tr:first-child th, tr:first-child td"));
    const priceIdx = headerCells.findIndex((c) => lower(c.textContent).includes("price"));

    if (priceIdx >= 0) {
      table.querySelectorAll("tr").forEach((tr) => {
        const cells = Array.from(tr.children);
        const target = cells[priceIdx] as Element | undefined;
        if (target) removeNode(target);
      });
    }

    table.querySelectorAll("td, th").forEach((cell) => {
      const t = (cell.textContent || "").trim();
      if (lower(t) === "price") removeNode(cell);
      if (/\$\s?\d/.test(t)) removeNode(cell);
    });

    table.setAttribute("class", TABLE_CLASS);
    table.querySelectorAll("th").forEach((th) => th.setAttribute("class", TH_CLASS));
    table.querySelectorAll("td").forEach((td) => td.setAttribute("class", TD_CLASS));

    const rows = Array.from(table.querySelectorAll("tr"));
    rows.forEach((tr, idx) => {
      if (idx > 0 && idx % 2 === 0) tr.setAttribute("class", STRIPED_ROW_CLASS);
    });

    const wrap = doc.createElement("div");
    wrap.setAttribute("class", TABLE_WRAP_CLASS);

    const parent = table.parentNode;
    if (parent) {
      parent.insertBefore(wrap, table);
      wrap.appendChild(table);
    }
  });

  // ✅ 7) 가독성 개선(문단 래핑)
  improveReadability(doc);

  // 8) 빈 요소 정리
  doc.querySelectorAll("p, div, section, span, li").forEach((el) => {
    const hasImg = el.querySelector("img");
    const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!hasImg && txt.length === 0) removeNode(el);
  });

  return doc.body.innerHTML.trim();
}

export default function HtmlContent({ html, className, baseUrl }: Props) {
  const [renderHtml, setRenderHtml] = useState<string>("");

  const input = useMemo(() => (html || "").trim(), [html]);
  const base = useMemo(() => (baseUrl || "").trim(), [baseUrl]);

  useEffect(() => {
    try {
      setRenderHtml(sanitizeAndStyle(input, base));
    } catch {
      // fallback: 최소한 mailto / p링크만
      const fallback = rewriteProductPLinksToItem(normalizeMailto(input));
      setRenderHtml(fallback);
    }
  }, [input, base]);

  if (!renderHtml) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: MINI_BOOTSTRAP_CSS }} />
      <div
        className={[
          "itsbio-html",
          "prose prose-neutral max-w-none",
          "prose-a:text-orange-600 prose-a:underline prose-a:underline-offset-4",
          "prose-table:my-6",
          className || "",
        ].join(" ")}
        dangerouslySetInnerHTML={{ __html: renderHtml }}
      />
    </>
  );
}