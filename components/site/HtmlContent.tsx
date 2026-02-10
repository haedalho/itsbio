// components/site/HtmlContent.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type Props = {
  html: string;
  className?: string;
};

const TABLE_WRAP_CLASS =
  "overflow-x-auto rounded-2xl border border-orange-200 bg-white shadow-sm";
const TABLE_CLASS =
  "w-full text-sm text-neutral-800 border-separate border-spacing-0";
const TH_CLASS =
  "bg-orange-500 text-white font-semibold text-left px-4 py-3 align-middle";
const TD_CLASS = "px-4 py-3 border-t border-neutral-100 align-top";
const STRIPED_ROW_CLASS = "bg-neutral-50";

function lower(x: unknown) {
  return String(x ?? "").toLowerCase();
}

function removeNode(n: Element | null) {
  if (n?.parentNode) n.parentNode.removeChild(n);
}

function normalizeMailto(html: string) {
  return html
    .replace(/mailto:technical@abmgood\.com/gi, "mailto:info@itsbio.co.kr")
    .replace(/mailto:quotes@abmgood\.com/gi, "mailto:info@itsbio.co.kr")
    .replace(/technical@abmgood\.com/gi, "info@itsbio.co.kr")
    .replace(/quotes@abmgood\.com/gi, "info@itsbio.co.kr");
}

/**
 * ✅ 가장 중요: HTML 안의 /p/ 링크를 /item/으로 강제
 * - /products/abm/p/XXXX
 * - /products/ABM/p/XXXX
 * - 상대경로/절대경로 모두 커버
 */
function rewriteProductPLinksToItem(html: string) {
  if (!html) return "";

  // 1) /products/{brand}/p/...  ->  /products/{brand}/item/...
  let out = html.replace(
    /\/products\/([^/]+)\/p\/([^"'\s<]+)/gi,
    (_m, brand, rest) => `/products/${String(brand).toLowerCase()}/item/${rest}`
  );

  // 2) 혹시 "/p/xxxx" 같은 형태로 들어온 경우(브랜드 추론 불가)면 ABM만 처리
  //    (원하면 전체 브랜드로도 바꿀 수 있는데, 잘못 바꾸는 리스크가 있어서 ABM만)
  out = out.replace(/href=["']\/p\/([^"']+)["']/gi, `href="/products/abm/item/$1"`);

  return out;
}

/**
 * 로고/국기 이미지는 Sanity images 배열에서 이미 제거할 예정이지만,
 * HTML 본문에 남아있는 것만 확정적으로 제거 (제품사진은 건드리지 않음)
 */
function isDefinitelyBrandOrFlag(img: HTMLImageElement) {
  const src = lower(img.getAttribute("src"));
  const alt = lower(img.getAttribute("alt"));
  const cls = lower(img.getAttribute("class"));
  const id = lower(img.getAttribute("id"));
  const combined = `${src} ${alt} ${cls} ${id}`;

  // 확정 제거 패턴만 (제품사진 보호)
  const hard = ["logo", "flag", "korea", "korean", "language", "lang", "icon-flag", "country"];
  if (hard.some((k) => combined.includes(k))) return true;

  // ABM + (logo/flag/kr/lang)
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

function sanitizeAndStyle(rawHtml: string) {
  if (!rawHtml) return "";

  // ✅ 0) 먼저 문자열 레벨에서 p링크 → item으로 치환 + mail 변경
  let html = normalizeMailto(rawHtml);
  html = rewriteProductPLinksToItem(html);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // 1) script/style/iframe/form 제거
  doc
    .querySelectorAll("script, style, iframe, form, input, textarea, button, select")
    .forEach((el) => removeNode(el));

  // 2) nav/header/footer/aside 제거
  doc.querySelectorAll("nav, header, footer, aside").forEach((el) => removeNode(el));

  // 3) mailto 링크 통일 + ABM 메뉴 링크 제거
  doc.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (/mailto:/i.test(href)) {
      a.setAttribute("href", "mailto:info@itsbio.co.kr");
      a.textContent = "info@itsbio.co.kr";
      return;
    }

    // ✅ 혹시 DOM 레벨에서도 p링크가 남아있으면 한번 더 보정
    // (문자열 치환이 안 먹는 케이스 대비)
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

  // 4) 확정 로고/국기 이미지 제거(제품사진 보호)
  doc.querySelectorAll("img").forEach((img) => {
    if (isDefinitelyBrandOrFlag(img as HTMLImageElement)) removeNode(img);
  });

  // 5) 테이블 Price 컬럼 제거
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

    // 보조: $가 들어간 “가격” 셀 제거
    table.querySelectorAll("td, th").forEach((cell) => {
      const t = (cell.textContent || "").trim();
      if (lower(t) === "price") removeNode(cell);
      if (/\$\s?\d/.test(t)) removeNode(cell);
    });
  });

  // 6) 테이블 스타일 오렌지 테마 적용 + wrapper
  doc.querySelectorAll("table").forEach((table) => {
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

  // 7) 빈 요소 정리
  doc.querySelectorAll("p, div, section, span, li").forEach((el) => {
    const hasImg = el.querySelector("img");
    const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!hasImg && txt.length === 0) removeNode(el);
  });

  return doc.body.innerHTML.trim();
}

export default function HtmlContent({ html, className }: Props) {
  const [renderHtml, setRenderHtml] = useState<string>("");

  const input = useMemo(() => (html || "").trim(), [html]);

  useEffect(() => {
    try {
      setRenderHtml(sanitizeAndStyle(input));
    } catch {
      // 실패 시에도 최소 p->item, mailto는 적용
      setRenderHtml(rewriteProductPLinksToItem(normalizeMailto(input)));
    }
  }, [input]);

  if (!renderHtml) return null;

  return (
    <div
      className={[
        "prose prose-neutral max-w-none",
        "prose-a:text-orange-600 prose-a:underline prose-a:underline-offset-4",
        "prose-img:rounded-xl prose-img:border prose-img:border-neutral-200",
        "prose-table:my-6",
        className || "",
      ].join(" ")}
      dangerouslySetInnerHTML={{ __html: renderHtml }}
    />
  );
}
