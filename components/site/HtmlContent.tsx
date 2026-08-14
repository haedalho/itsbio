"use client";

import React, { useEffect, useMemo, useState } from "react";
import { internalizeAbmHref, isOfficialAbmUrl } from "@/lib/abm/internal-links";

type Props = {
  html: string;
  className?: string;
  /** legacy 등에서 상대경로(href="/", src="/")를 절대경로로 바꾸기 위한 base */
  baseUrl?: string;
  mode?: "default" | "abm-detail" | "abm-service";
};

const TABLE_WRAP_CLASS = "abm-table-scroll";
const TABLE_CLASS = "abm-data-table";
const EXTERNAL_VECTOR_LINK_ATTR = "data-abm-external-vector";
const DIRECT_DOCUMENT_PATH = /\.(?:pdf|docx?|xlsx?|pptx?|csv|zip)(?:$|[?#])/i;

function lower(x: unknown) {
  return String(x ?? "").toLowerCase();
}
function removeNode(n: Element | null) {
  if (n?.parentNode) n.parentNode.removeChild(n);
}
function collapseWs(s: string) {
  return (s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function extractLegacyAbmTarget(href: string) {
  try {
    const url = new URL(href, "https://www.itsbio.co.kr");
    if (url.pathname !== "/products/abm/legacy") return "";
    return (url.searchParams.get("u") || "").trim();
  } catch {
    return "";
  }
}

function officialAbmTarget(href: string, baseUrl: string) {
  const legacyTarget = extractLegacyAbmTarget(href);
  const resolved = legacyTarget || (baseUrl ? resolveUrl(href, baseUrl) : href);
  return isOfficialAbmUrl(resolved) ? resolved : "";
}

function isHeadingAtOrAbove(el: Element, level: number) {
  const match = /^H([1-6])$/.exec(el.tagName);
  return !!match && Number(match[1]) <= level;
}

/**
 * Vector catalog links in service editorial sections are intentionally kept
 * on the official ABM site. These destinations are not part of the staged
 * product/service corpus yet, so internalizing them creates avoidable 404s.
 */
function markExternalVectorSectionLinks(doc: Document, baseUrl: string) {
  const headings = Array.from(doc.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")).filter((heading) =>
    /^Available\b.*(?:vector|adenovector)s?\b.*$/i.test(collapseWs(heading.textContent || ""))
  );
  if (!headings.length) return;

  const allElements = Array.from(doc.body.querySelectorAll<HTMLElement>("*"));
  headings.forEach((heading) => {
    const level = Number(heading.tagName.slice(1));
    const start = allElements.indexOf(heading);
    if (start < 0) return;

    for (let index = start + 1; index < allElements.length; index++) {
      const el = allElements[index];
      if (isHeadingAtOrAbove(el, level)) break;
      if (el.tagName !== "A") continue;

      const anchor = el as HTMLAnchorElement;
      const href = (anchor.getAttribute("href") || "").trim();
      if (href && officialAbmTarget(href, baseUrl)) {
        anchor.setAttribute(EXTERNAL_VECTOR_LINK_ATTR, "true");
      }
    }
  });
}

/** Convert ABM's JS-only, alternating question/answer tables to native HTML. */
function transformServiceFaqs(doc: Document) {
  const faqHeadings = Array.from(doc.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")).filter((heading) =>
    /^FAQs?$/i.test(collapseWs(heading.textContent || ""))
  );
  if (!faqHeadings.length) return;

  const allElements = Array.from(doc.body.querySelectorAll<HTMLElement>("*"));
  const headingIndex = new Map(faqHeadings.map((heading) => [heading, allElements.indexOf(heading)]));

  faqHeadings.forEach((heading) => {
    const start = headingIndex.get(heading) ?? -1;
    if (start < 0) return;
    const level = Number(heading.tagName.slice(1));
    const list = doc.createElement("div");
    list.className = "abm-service-faq-list";
    const sources = new Set<Element>();
    const seenTargets = new Set<string>();

    for (let index = start + 1; index < allElements.length; index++) {
      const el = allElements[index];
      if (isHeadingAtOrAbove(el, level)) break;
      if (!el.matches("b.customfaq, .customfaq")) continue;

      const trigger = el.closest<HTMLAnchorElement>('a[href^="#"]');
      const targetId = (trigger?.getAttribute("href") || "").slice(1);
      if (!targetId || seenTargets.has(targetId)) continue;

      const answer = doc.getElementById(targetId);
      if (!answer || !answer.matches(".panel-collapse,.collapse,.accordion-collapse")) continue;
      const answerBody =
        answer.querySelector<HTMLElement>(".abm-perfect-faqs-text,.panel-body,.card-body,.accordion-body") || answer;
      const question = collapseWs(el.textContent || trigger?.textContent || "");
      const answerHtml = answerBody.innerHTML.trim();
      if (!question || !collapseWs(answerBody.textContent || "")) continue;

      const details = doc.createElement("details");
      details.className = "abm-service-faq-item";
      if (!list.children.length) details.setAttribute("open", "");

      const summary = doc.createElement("summary");
      summary.textContent = question;
      const content = doc.createElement("div");
      content.className = "abm-service-faq-answer";
      content.innerHTML = answerHtml;
      details.append(summary, content);
      list.appendChild(details);
      seenTargets.add(targetId);

      const questionTable = trigger?.closest("table");
      const answerTable = answer.closest("table");
      if (questionTable) sources.add(questionTable);
      else if (trigger) sources.add(trigger);
      if (answerTable) sources.add(answerTable);
      else sources.add(answer);
    }

    if (!list.children.length) return;
    heading.insertAdjacentElement("afterend", list);
    sources.forEach((source) => removeNode(source));
  });
}

function isSmallUiGlyph(img: HTMLImageElement) {
  const src = lower(img.getAttribute("src"));
  const alt = lower(img.getAttribute("alt"));
  const cls = lower(img.getAttribute("class"));
  const width = Number.parseInt(img.getAttribute("width") || "", 10);
  const height = Number.parseInt(img.getAttribute("height") || "", 10);
  const encodedSize = src.match(/-(\d+)x(\d+)\.(?:png|gif|jpe?g|webp)(?:$|\?)/i);
  const encodedWidth = Number(encodedSize?.[1] || 0);
  const encodedHeight = Number(encodedSize?.[2] || 0);
  const tinyDimensions =
    (width > 0 && height > 0 && width <= 48 && height <= 48) ||
    (encodedWidth > 0 && encodedHeight > 0 && encodedWidth <= 48 && encodedHeight <= 48);

  return /(?:^|[\s/_-])(pdf|icon|glyph)(?:[\s/_.-]|$)/i.test(`${src} ${alt} ${cls}`) || (tinyDimensions && !alt);
}

function normalizeMailto(html: string) {
  return html
    .replace(/mailto:technical@abmgood\.com/gi, "mailto:info@itsbio.co.kr")
    .replace(/mailto:quotes@abmgood\.com/gi, "mailto:info@itsbio.co.kr")
    .replace(/technical@abmgood\.com/gi, "info@itsbio.co.kr")
    .replace(/quotes@abmgood\.com/gi, "info@itsbio.co.kr");
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
    if (el.closest("table, .abm-table-scroll")) continue;
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

function isInternalItsbioMediaUrl(value: string) {
  return /^\/products\/abm\/resource-image(?:\?|$)/i.test((value || "").trim());
}

function isInternalItsbioHref(href: string) {
  const h = (href || "").trim();
  if (!h) return true;
  if (h.startsWith("#") || /^mailto:|^tel:/i.test(h)) return true;

  // ✅ 우리 사이트 내부 라우트는 절대경로화 금지
  if (/^\/(products|notice|promotions|studio-admin|contact|quote)(\/|$|\?)/i.test(h)) return true;

  return false;
}

/**
 * ✅ 이미지/미디어 URL 절대경로화 + lazyload src 복구
 * - img/src, img/srcset, source/srcset, video/audio/src/poster 등 처리
 * - a[href]는 "우리 내부 링크"는 건드리지 않고, 그 외 루트상대(/xxx)는 baseUrl로 절대경로화
 * - style="background-image:url(...)" 도 보정
 */
function fixMediaAndLinks(doc: Document, baseUrl: string, internalizeAbm: boolean) {

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
    if (src && baseUrl && !isInternalItsbioMediaUrl(src)) img.setAttribute("src", resolveUrl(src, baseUrl));

    // srcset 절대경로
    const ss = (img.getAttribute("srcset") || "").trim();
    if (ss && baseUrl) img.setAttribute("srcset", resolveSrcset(ss, baseUrl));

    // (가끔 핫링크/리퍼러 이슈 완화용)
    img.setAttribute("referrerpolicy", "no-referrer");
  });

  // <source srcset=...> (picture)
  doc.querySelectorAll<HTMLSourceElement>("source").forEach((s) => {
    const ss = (s.getAttribute("srcset") || "").trim();
    if (ss && baseUrl) s.setAttribute("srcset", resolveSrcset(ss, baseUrl));
  });

  // video/audio/poster/track 등
  doc.querySelectorAll<HTMLElement>("video, audio, track, source").forEach((el) => {
    const src = (el.getAttribute("src") || "").trim();
    if (src && baseUrl) el.setAttribute("src", resolveUrl(src, baseUrl));

    const poster = (el.getAttribute("poster") || "").trim();
    if (poster && baseUrl) el.setAttribute("poster", resolveUrl(poster, baseUrl));
  });

  // background-image:url(...)
  doc.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const style = el.getAttribute("style") || "";
    if (!style.toLowerCase().includes("url(")) return;

    if (!baseUrl) return;
    const fixed = style.replace(/url\((['"]?)([^'")]+)\1\)/gi, (_m, _q, u) => {
      return `url("${resolveUrl(String(u), baseUrl)}")`;
    });
    el.setAttribute("style", fixed);
  });

  // a[href]는 내부링크 제외, 루트상대(/xxx)는 baseUrl로 절대경로화
  doc.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    const href = (a.getAttribute("href") || "").trim();
    if (!href) return;

    if (a.getAttribute(EXTERNAL_VECTOR_LINK_ATTR) === "true") {
      const externalTarget = officialAbmTarget(href, baseUrl);
      if (externalTarget) {
        a.setAttribute("href", externalTarget);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noreferrer noopener");
      }
      a.removeAttribute(EXTERNAL_VECTOR_LINK_ATTR);
      return;
    }

    // Older staged HTML may already contain the internal legacy resolver.
    // Official files should still bypass it and open the real ABM document.
    const legacyTarget = extractLegacyAbmTarget(href);
    if (legacyTarget && isOfficialAbmUrl(legacyTarget) && DIRECT_DOCUMENT_PATH.test(legacyTarget)) {
      a.setAttribute("href", legacyTarget);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noreferrer noopener");
      return;
    }

    if (isInternalItsbioHref(href)) return;

    const resolved = baseUrl ? resolveUrl(href, baseUrl) : href;
    const nextHref = internalizeAbm || isOfficialAbmUrl(resolved)
      ? internalizeAbmHref(href, baseUrl)
      : resolved;
    if (!nextHref) removeNode(a);
    else {
      a.setAttribute("href", nextHref);
      if (/^https?:/i.test(nextHref)) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noreferrer noopener");
      } else {
        a.removeAttribute("target");
        a.removeAttribute("rel");
      }
    }
  });
}

function isManagedAbmImage(src: string) {
  try {
    const url = new URL(src, window.location.origin);
    return url.hostname === "cdn.sanity.io" && url.pathname.startsWith("/images/9b5twpc8/");
  } catch {
    return false;
  }
}

function sanitizeAndStyle(rawHtml: string, baseUrl?: string, mode: Props["mode"] = "default") {
  if (!rawHtml) return "";

  // ✅ 0) 문자열 레벨 전처리
  let html = normalizeMailto(rawHtml);
  const isAbmMode = mode === "abm-detail" || mode === "abm-service";

  // baseUrl 없으면 추정
  const effectiveBase =
    (baseUrl || "").trim() || (isAbmMode ? "https://www.abmgood.com" : inferBaseUrlFromHtml(html));

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  if (mode === "abm-service") {
    markExternalVectorSectionLinks(doc, effectiveBase);
    transformServiceFaqs(doc);
  }

  // ✅ 0.5) (가장 중요) 이미지/미디어 URL 보정 + lazyload src 복구
  fixMediaAndLinks(doc, effectiveBase, isAbmMode);

  // ✅ 1) 우리가 주입한 Products 카드 그리드 제거
  removeInjectedProductsGrid(doc);

  // 2) script/style/iframe/form 제거
  doc
    .querySelectorAll("script, style, iframe, form, input, textarea, button, select")
    .forEach((el) => removeNode(el));

  // 3) nav/header/footer 제거 + ABM footer 제거. Service editorial content의
  // aside는 source page의 실제 정보 패널이므로 보존한다.
  doc.querySelectorAll(mode === "abm-service" ? "nav, header, footer" : "nav, header, footer, aside").forEach((el) => removeNode(el));
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

  if (isAbmMode) {
    doc.querySelectorAll("li, p, span, div").forEach((el) => {
      const text = collapseWs(el.textContent || "");
      if (/^(?:wholesale\s+prices?|add\s+to\s+cart|buy\s+now)$/i.test(text)) removeNode(el);
    });
  }

  // 5) 확정 로고/국기 이미지 제거
  doc.querySelectorAll("img").forEach((img) => {
    if (isDefinitelyBrandOrFlag(img as HTMLImageElement)) removeNode(img);
  });

  // ABM Service staging은 외부 이미지를 절대 렌더링하지 않는다. 수집 workflow가
  // 모든 공식 이미지를 Sanity asset으로 바꾸며, 이 검사는 잘못된 staging의 방어선이다.
  if (mode === "abm-service") {
    doc.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
      if (isSmallUiGlyph(img) || !isManagedAbmImage((img.getAttribute("src") || "").trim())) removeNode(img);
      else {
        img.removeAttribute("srcset");
        img.removeAttribute("data-srcset");
        img.removeAttribute("data-src");
      }
    });
  }

  // 6) 판매 컬럼 제거 + ABM 정보 표를 동일한 구조와 디자인으로 정규화
  doc.querySelectorAll("table").forEach((table) => {
    const rows = Array.from(table.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tr"));
    const candidateRows = rows.slice(0, 4);
    const commerceIndices = new Set<number>();
    const commerceHeader = /(?:^|\b)(?:price|cost|amount|currency|qty|quantity|cart|order|msrp|retail|wholesale|usd|cad)(?:\b|$)/i;
    candidateRows.forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        if (commerceHeader.test(collapseWs(cell.textContent || ""))) commerceIndices.add(index);
      });
    });

    if (commerceIndices.size) {
      table.querySelectorAll("tr").forEach((tr) => {
        const cells = Array.from(tr.children);
        [...commerceIndices].sort((a, b) => b - a).forEach((index) => {
          const target = cells[index] as Element | undefined;
          if (target) removeNode(target);
        });
      });
    }

    table.querySelectorAll("td, th").forEach((cell) => {
      const text = collapseWs(cell.textContent || "");
      if (/^(?:US|CA)?\$\s?\d[\d,.]*(?:\s*(?:USD|CAD))?$/i.test(text)) cell.textContent = "";
      ["style", "width", "height", "bgcolor", "border", "cellpadding", "cellspacing", "align", "valign"].forEach((attribute) => cell.removeAttribute(attribute));
    });

    if (isAbmMode) {
      table.setAttribute("class", TABLE_CLASS);
      ["style", "width", "height", "bgcolor", "border", "cellpadding", "cellspacing", "align"].forEach((attribute) => table.removeAttribute(attribute));
      table.querySelectorAll("th").forEach((th) => th.setAttribute("scope", "col"));
      const sectionRows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tr[id^="table-product-mini-category-"]'));
      sectionRows.forEach((row) => {
        row.classList.add("abm-table-section-row");
        row.removeAttribute("style");
        row.querySelectorAll("td, th").forEach((cell) => cell.removeAttribute("style"));
      });

      if (sectionRows.length && !doc.querySelector(".abm-table-anchor-nav")) {
        const nav = doc.createElement("nav");
        nav.setAttribute("class", "abm-table-anchor-nav");
        nav.setAttribute("aria-label", "Product groups");
        sectionRows.forEach((row, index) => {
          const label = collapseWs(row.cells[0]?.textContent || "");
          if (!row.id || !label) return;
          if (index) {
            const separator = doc.createElement("span");
            separator.setAttribute("aria-hidden", "true");
            separator.textContent = "|";
            nav.appendChild(separator);
          }
          const anchor = doc.createElement("a");
          anchor.setAttribute("href", `#${row.id}`);
          anchor.textContent = /Fluorescent\s+Marker/i.test(label)
            ? "GFP, RFP, CFP, YFP"
            : label.replace(/\s*\(FLAG\)\s*/i, "").trim();
          nav.appendChild(anchor);
        });
        if (nav.children.length) doc.body.insertBefore(nav, doc.body.firstChild);
      }

      const existingWrap = table.parentElement?.classList.contains("models-table-wrap") ? table.parentElement : null;
      if (existingWrap) {
        existingWrap.classList.add(TABLE_WRAP_CLASS);
        existingWrap.setAttribute("role", "region");
        existingWrap.setAttribute("aria-label", "Scrollable product information table");
        existingWrap.setAttribute("tabindex", "0");
      } else if (!table.parentElement?.classList.contains(TABLE_WRAP_CLASS)) {
        const wrap = doc.createElement("div");
        wrap.setAttribute("class", TABLE_WRAP_CLASS);
        wrap.setAttribute("role", "region");
        wrap.setAttribute("aria-label", "Scrollable product information table");
        wrap.setAttribute("tabindex", "0");
        const parent = table.parentNode;
        if (parent) {
          parent.insertBefore(wrap, table);
          wrap.appendChild(table);
        }
      }
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

export default function HtmlContent({ html, className, baseUrl, mode = "default" }: Props) {
  const [renderHtml, setRenderHtml] = useState<string>("");

  const input = useMemo(() => (html || "").trim(), [html]);
  const base = useMemo(() => (baseUrl || "").trim(), [baseUrl]);

  useEffect(() => {
    try {
      setRenderHtml(sanitizeAndStyle(input, base, mode));
    } catch {
      // fallback: 최소한 mailto / p링크만
      const fallback = normalizeMailto(input);
      setRenderHtml(fallback);
    }
  }, [input, base, mode]);

  if (!renderHtml) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: MINI_BOOTSTRAP_CSS }} />
      <div
        className={[
          "itsbio-html",
          mode === "default" ? "prose prose-neutral max-w-none" : "abm-rich max-w-none",
          mode === "default" ? "prose-a:text-orange-600 prose-a:underline prose-a:underline-offset-4" : "",
          mode === "default" ? "prose-table:my-6" : "",
          className || "",
        ].join(" ")}
        dangerouslySetInnerHTML={{ __html: renderHtml }}
      />
    </>
  );
}
