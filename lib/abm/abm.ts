// lib/abm/abm.ts
// ABM(=abmgood.com) fetch/parse helpers for on-demand import + batch enrichment.
// NOTE: Specifications 탭은 요구사항에 따라 파싱/저장 대상에서 완전히 제외한다.

import { load } from "cheerio";
import sanitizeHtml from "sanitize-html";

const ABM_BASE = "https://www.abmgood.com";

export type AbmCandidate = {
  title?: string;
  url: string;
  sku?: string;
};

export type AbmResolveResult =
  | { type: "single"; productUrl: string; candidates: AbmCandidate[]; abmSearchUrl: string }
  | { type: "multiple"; candidates: AbmCandidate[]; abmSearchUrl: string }
  | { type: "none"; candidates: AbmCandidate[]; abmSearchUrl: string };

export type AbmEnrichResult = {
  sku?: string;
  title?: string;
  sourceUrl: string;
  categoryPathTitles: string[];
  categoryPathSlugs: string[];
  datasheetHtml?: string;
  documentsHtml?: string;
  faqsHtml?: string;
  referencesHtml?: string;
  reviewsHtml?: string;
  docs: Array<{ title: string; url: string }>;
  imageUrls: string[];
};

export function abmSearchUrl(q: string) {
  return `${ABM_BASE}/search?query=${encodeURIComponent(q || "")}`;
}

function textClean(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

export function looksLikeCatNo(input: string) {
  const q = (input || "").trim();
  if (!q) return false;
  if (q.length > 24) return false;
  if (q.includes(" ")) return false;
  // ABM Cat.No 예: T3189, T4640, G1234 등
  return /^[A-Za-z]{0,3}\d{3,7}[A-Za-z0-9-]{0,10}$/.test(q);
}

export function slugifyCategory(s: string) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function absoluteUrl(href: string) {
  if (!href) return "";
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${ABM_BASE}${href}`;
  return `${ABM_BASE}/${href}`;
}

export function sanitizePanel(html: string) {
  const raw = (html || "").trim();
  if (!raw) return "";
  return sanitizeHtml(raw, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "figure",
      "figcaption",
    ]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title"],
      "*": ["class", "id", "style"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  }).trim();
}

function isJunkImage(url: string) {
  const u = (url || "").toLowerCase();
  if (!u) return true;
  return (
    u.includes("logo") ||
    u.includes("flag") ||
    u.includes("favicon") ||
    u.includes("sprite") ||
    u.includes("icon") ||
    u.includes("payment") ||
    u.includes("social") ||
    u.includes("header") ||
    u.includes("footer") ||
    u.includes("banner") ||
    u.includes("nav") ||
    u.includes("menu")
  );
}

export function parseAbmSearch(html: string, q: string): AbmResolveResult {
  const searchUrl = abmSearchUrl(q);
  const $ = load(html || "");

  const candidates: AbmCandidate[] = [];

  // 검색 결과에서 .html 링크 최대한 수집
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const url = absoluteUrl(href);
    if (!url) return;
    if (!url.startsWith(ABM_BASE)) return;
    if (!url.endsWith(".html")) return;

    const title = textClean($(el).text());
    if (!title) return;

    candidates.push({ title, url });
  });

  // dedupe
  const seen = new Set<string>();
  const uniq: AbmCandidate[] = [];
  for (const c of candidates) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    uniq.push(c);
  }

  if (uniq.length === 1) {
    return { type: "single", productUrl: uniq[0].url, candidates: uniq, abmSearchUrl: searchUrl };
  }
  if (uniq.length > 1) {
    return { type: "multiple", candidates: uniq.slice(0, 20), abmSearchUrl: searchUrl };
  }
  return { type: "none", candidates: [], abmSearchUrl: searchUrl };
}

function parseSku($: ReturnType<typeof load>) {
  // 여러 템플릿 대응: "Cat. No." 텍스트 근처에서 추출
  const text = $("body").text();
  const m = text.match(/Cat\.?\s*No\.?\s*[:\s]\s*([A-Za-z0-9-]{3,20})/i);
  return m?.[1]?.trim();
}

export function parseAbmBreadcrumbFromHtml(html: string) {
  const $ = load(html || "");
  return parseAbmBreadcrumb($);
}

function parseAbmBreadcrumb($: ReturnType<typeof load>) {
  const titles: string[] = [];

  const $wrap = $(".breadcrumbs").first().length ? $(".breadcrumbs").first() : $(".breadcrumb").first();
  if ($wrap.length) {
    $wrap.find("a, span, li").each((_, el) => {
      const t = textClean($(el).text());
      if (!t) return;
      if (/^home$/i.test(t)) return;
      titles.push(t);
    });
  }

  // 중복 제거
  const uniq: string[] = [];
  for (const t of titles) {
    if (!uniq.includes(t)) uniq.push(t);
  }

  // 마지막이 제품명으로 섞일 수 있으니 너무 길면 뒤에서 2~3개만
  const trimmed = uniq.length > 4 ? uniq.slice(-3) : uniq;

  const slugs = trimmed.map(slugifyCategory).filter(Boolean);
  return { titles: trimmed, slugs };
}

function parseDocs($: ReturnType<typeof load>) {
  const docs: Array<{ title: string; url: string }> = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!href) return;
    if (!href.toLowerCase().includes(".pdf")) return;
    const url = absoluteUrl(href);
    const title = textClean($(el).text()) || "PDF";
    docs.push({ title, url });
  });
  // dedupe by url
  const seen = new Set<string>();
  return docs.filter((d) => {
    if (seen.has(d.url)) return false;
    seen.add(d.url);
    return true;
  });
}

function parseImages($: ReturnType<typeof load>) {
  const imgs: string[] = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    if (!src) return;
    const url = absoluteUrl(src);
    if (!url) return;
    if (isJunkImage(url)) return;
    imgs.push(url);
  });
  return [...new Set(imgs)];
}

function parseTabs5($: ReturnType<typeof load>) {
  const wanted = ["Datasheet", "Documents", "FAQs", "References", "Reviews"] as const;
  const out: Record<string, string> = {
    datasheetHtml: "",
    documentsHtml: "",
    faqsHtml: "",
    referencesHtml: "",
    reviewsHtml: "",
  };

  const tabMap = new Map<string, string>();

  // a[href="#..."] or [aria-controls]
  $("a[href^='#'], [aria-controls]").each((_, el) => {
    const label = textClean($(el).text());
    if (!label) return;
    const hit = wanted.find((w) => w.toLowerCase() === label.toLowerCase());
    if (!hit) return;

    const href = $(el).attr("href") || "";
    const ac = $(el).attr("aria-controls") || "";
    const id = href.startsWith("#") ? href.slice(1) : ac;
    if (id) tabMap.set(hit.toLowerCase(), id);
  });

  for (const w of wanted) {
    let raw = "";
    const id = tabMap.get(w.toLowerCase());
    if (id) {
      const $panel = $("#" + cssEscape(id));
      if ($panel.length) raw = $panel.html() || "";
    }

    // fallback: heading 기반
    if (!raw) {
      const $h = $("h1,h2,h3,h4").filter((_, el) => textClean($(el).text()).toLowerCase() === w.toLowerCase()).first();
      if ($h.length) {
        const parts: string[] = [];
        let $cur = $h.next();
        let guard = 0;
        while ($cur.length && guard < 60) {
          const tag = String($cur.get(0)?.tagName || "").toLowerCase();
          if (["h1", "h2", "h3", "h4"].includes(tag)) break;
          parts.push($.html($cur));
          $cur = $cur.next();
          guard++;
        }
        raw = parts.join("\n");
      }
    }

    const cleaned = sanitizePanel(raw);

    if (w === "Datasheet") out.datasheetHtml = cleaned;
    if (w === "Documents") out.documentsHtml = cleaned;
    if (w === "FAQs") out.faqsHtml = cleaned;
    if (w === "References") out.referencesHtml = cleaned;
    if (w === "Reviews") out.reviewsHtml = cleaned;
  }

  return out as {
    datasheetHtml: string;
    documentsHtml: string;
    faqsHtml: string;
    referencesHtml: string;
    reviewsHtml: string;
  };
}

function cssEscape(id: string) {
  // Node 환경에서 CSS.escape가 없을 수 있어 간단 대응
  return id.replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, "\\$1");
}

export function parseAbmProductDetail(html: string, sourceUrl: string): AbmEnrichResult {
  const $ = load(html || "");

  const { titles: categoryPathTitles, slugs: categoryPathSlugs } = parseAbmBreadcrumb($);
  const sku = parseSku($);
  const title = textClean($("h1").first().text()) || undefined;

  const tabs = parseTabs5($);
  const docs = parseDocs($);
  const imageUrls = parseImages($);

  return {
    sku,
    title,
    sourceUrl,
    categoryPathTitles,
    categoryPathSlugs,
    datasheetHtml: tabs.datasheetHtml || undefined,
    documentsHtml: tabs.documentsHtml || undefined,
    faqsHtml: tabs.faqsHtml || undefined,
    referencesHtml: tabs.referencesHtml || undefined,
    reviewsHtml: tabs.reviewsHtml || undefined,
    docs,
    imageUrls,
  };
}
