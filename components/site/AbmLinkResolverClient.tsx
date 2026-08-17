"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const ABM_ROOTS = new Set(["general-materials", "cellular-materials", "genetic-materials"]);
const GEL_DOCUMENTATION_PATH = "/products/abm/general-materials/gel-documentation";
const DNA_STAINS_TARGET = `${GEL_DOCUMENTATION_PATH}#safeview-dna-stains`;
const GEL_IMAGER_TARGET = "/products/abm/staged/product/E1001";

type MenuItem = {
  id?: string;
  title: string;
  path: string[];
  href: string;
};

type GelDocumentationTarget = "dna-stains" | "gel-imager";

function collapse(value: string | null | undefined) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function navKey(value: string | null | undefined) {
  return collapse(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function gelDocumentationTargetForLink(anchor: HTMLAnchorElement): GelDocumentationTarget | null {
  let url: URL;
  try {
    url = new URL(anchor.getAttribute("href") || "", window.location.origin);
  } catch {
    return null;
  }

  const pathname = url.pathname.toLowerCase();
  const withinGeneralMaterials = pathname.startsWith("/products/abm/general-materials");
  if (!withinGeneralMaterials) return null;

  const label = navKey(anchor.textContent);
  const leaf = navKey(decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) || ""));
  const withinGelDocumentation = pathname === GEL_DOCUMENTATION_PATH
    || pathname.startsWith(`${GEL_DOCUMENTATION_PATH}/`);

  if (label === "dna stains" || leaf === "dna stains") return "dna-stains";

  if (
    label === "gel imager"
    || label === "safeviewer imager"
    || leaf === "gel imager"
    || leaf === "safeviewer imager"
  ) return "gel-imager";

  if (
    withinGelDocumentation
    && pathname !== GEL_DOCUMENTATION_PATH
    && label === "gel documentation"
    && !anchor.closest("header")
  ) return "dna-stains";

  return null;
}

function setGelDocumentationLinkLabel(anchor: HTMLAnchorElement, label: string) {
  const textNodes = Array.from(anchor.querySelectorAll<HTMLElement>("span"))
    .filter((element) => element.children.length === 0 && collapse(element.textContent));

  const preferred = textNodes.find((element) => {
    const key = navKey(element.textContent);
    return ["gel documentation", "dna stains", "safeviewer imager", "gel imager"].includes(key);
  });

  if (preferred) {
    if (collapse(preferred.textContent) !== label) preferred.textContent = label;
    return;
  }

  if (!anchor.children.length && collapse(anchor.textContent) !== label) {
    anchor.textContent = label;
  }
}

function applyGelDocumentationTarget(anchor: HTMLAnchorElement, target: GelDocumentationTarget) {
  const href = target === "dna-stains" ? DNA_STAINS_TARGET : GEL_IMAGER_TARGET;
  const label = target === "dna-stains" ? "DNA Stains" : "Gel Imager";

  if (anchor.getAttribute("href") !== href) anchor.setAttribute("href", href);
  setGelDocumentationLinkLabel(anchor, label);
  anchor.dataset.itsbioGelDocumentationTarget = target;
}

function rewriteGelDocumentationLinks() {
  document.querySelectorAll<HTMLAnchorElement>('a[href^="/products/abm/general-materials"]').forEach((anchor) => {
    const target = gelDocumentationTargetForLink(anchor);
    if (target) applyGelDocumentationTarget(anchor, target);
  });
}

function ensureGelDocumentationAnchor(pathname: string) {
  if (pathname.toLowerCase() !== GEL_DOCUMENTATION_PATH) return;

  let target = document.getElementById("safeview-dna-stains") as HTMLElement | null;
  if (!target) {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".itsbio-html h1, .itsbio-html h2, .itsbio-html h3, .itsbio-html h4, .itsbio-html h5, .itsbio-html h6, .itsbio-html strong, .itsbio-html b, .itsbio-html p",
      ),
    );

    const match = candidates.find((element) => {
      const key = navKey(element.textContent);
      return key === "safeview dna stains" || (key.includes("safeview") && key.includes("dna stains") && key.length < 80);
    });

    if (match) {
      target = match.closest<HTMLElement>("h1,h2,h3,h4,h5,h6") || match;
      target.id = "safeview-dna-stains";
      target.style.scrollMarginTop = "112px";
    }
  }

  if (!target || window.location.hash !== "#safeview-dna-stains") return;
  if (target.dataset.itsbioAnchorScrolled === "true") return;
  target.dataset.itsbioAnchorScrolled = "true";
  requestAnimationFrame(() => target?.scrollIntoView({ block: "start" }));
}

function extractOfficialAbmUrl(href: string) {
  try {
    const url = new URL(href, window.location.origin);
    if (url.pathname === "/products/abm/legacy") {
      const target = url.searchParams.get("u") || "";
      if (target) return target;
    }
    if (["abmgood.com", "www.abmgood.com", "info.abmgood.com"].includes(url.hostname.toLowerCase())) {
      return url.toString();
    }
  } catch {
    // Resolve from the visible product metadata instead.
  }
  return "";
}

function rewriteMegaMenuLinks(menuItems: MenuItem[]) {
  document.querySelectorAll<HTMLAnchorElement>('header a[href^="/products/abm/"]').forEach((anchor) => {
    const gelTarget = gelDocumentationTargetForLink(anchor);
    if (gelTarget) {
      applyGelDocumentationTarget(anchor, gelTarget);
      return;
    }

    let url: URL;
    try {
      url = new URL(anchor.getAttribute("href") || "", window.location.origin);
    } catch {
      return;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] !== "products" || segments[1] !== "abm") return;

    const root = segments[2] || "";
    if (!ABM_ROOTS.has(root) || segments.length <= 3) return;

    if (!menuItems.length) {
      anchor.setAttribute("href", `/products/abm/${root}`);
      return;
    }

    const requested = navKey(anchor.textContent);
    if (!requested) return;

    const exact = menuItems.find((item) => {
      if (item.path?.[0] !== root || item.path.length <= 1) return false;
      const leaf = item.path[item.path.length - 1] || "";
      return navKey(item.title) === requested || navKey(leaf) === requested;
    });

    if (exact?.href) {
      anchor.setAttribute("href", exact.href);
      anchor.dataset.itsbioAbmCategoryResolved = "true";
      anchor.dataset.itsbioAbmCategorySource = "sanity";
      return;
    }

    anchor.setAttribute("href", `/products/abm/${root}`);
    anchor.dataset.itsbioAbmCategoryResolved = "false";
  });
}

function catNoFromText(value: string) {
  const text = collapse(value);
  const match = text.match(/(?:Cat\.?\s*No\.?|Catalog\s*(?:No\.?|#))\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9._/+()\-]{1,63})/i);
  return collapse(match?.[1]);
}

function looksGenericProductLinkText(value: string) {
  const text = collapse(value).toLowerCase();
  return !text || [
    "view",
    "view product",
    "details",
    "product details",
    "learn more",
    "more",
    "read more",
  ].includes(text);
}

function tableProductContext(anchor: HTMLAnchorElement) {
  const row = anchor.closest<HTMLTableRowElement>("tr");
  const table = row?.closest<HTMLTableElement>("table");
  if (!row || !table) return null;

  const headerRow =
    Array.from(table.querySelectorAll<HTMLTableRowElement>("thead tr")).at(-1)
    || Array.from(table.querySelectorAll<HTMLTableRowElement>("tr")).find((candidate) => candidate.querySelector("th"))
    || null;
  if (!headerRow) return null;

  const headers = Array.from(headerRow.querySelectorAll<HTMLTableCellElement>("th,td")).map((cell) => collapse(cell.textContent));
  const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>("td,th"));
  if (!cells.length) return null;

  const skuIndex = headers.findIndex((header) => /^(?:cat\.?\s*no\.?|catalog\s*(?:no\.?|#))$/i.test(header));
  const titleIndex = headers.findIndex((header) => /^(?:product\s*(?:name)?|name)$/i.test(header));

  const sku = skuIndex >= 0 && cells[skuIndex] ? collapse(cells[skuIndex].textContent) : "";
  const title = titleIndex >= 0 && cells[titleIndex]
    ? collapse(cells[titleIndex].textContent)
    : collapse(cells[0]?.textContent);

  if (!sku && !title) return null;
  return { node: row as HTMLElement, sku, title };
}

function findProductContext(anchor: HTMLAnchorElement) {
  const tableContext = tableProductContext(anchor);
  if (tableContext) return tableContext;

  let node: HTMLElement | null = anchor;
  for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
    if (node.classList.contains("itsbio-html")) break;
    const text = collapse(node.textContent);
    const sku = catNoFromText(text);
    if (sku) return { node, sku, title: "" };
  }
  return null;
}

function bestProductTitle(container: HTMLElement, clicked: HTMLAnchorElement, preferredTitle = "") {
  if (preferredTitle && preferredTitle.length >= 3 && preferredTitle.length <= 180) return preferredTitle;

  const clickedText = collapse(clicked.textContent);
  if (!looksGenericProductLinkText(clickedText) && clickedText.length >= 3 && clickedText.length <= 180) {
    return clickedText;
  }

  const candidates = Array.from(container.querySelectorAll<HTMLElement>("a, h2, h3, h4, h5, strong, b"))
    .map((element) => collapse(element.textContent))
    .filter((text) =>
      text.length >= 3
      && text.length <= 180
      && !looksGenericProductLinkText(text)
      && !/^Cat\.?\s*No\.?/i.test(text)
      && !/^Price\b/i.test(text)
      && !/^Unit\b/i.test(text),
    )
    .sort((a, b) => b.length - a.length);

  return candidates[0] || "";
}

function rewriteRichProductLinks(pathname: string) {
  if (!pathname.startsWith("/products/abm/")) return;

  document.querySelectorAll<HTMLAnchorElement>(".itsbio-html a[href]").forEach((anchor) => {
    if (anchor.dataset.itsbioAbmProductResolved === "true") return;
    if (anchor.dataset.itsbioAbmPreserveLink === "true") return;

    const href = collapse(anchor.getAttribute("href"));
    if (!href || href.startsWith("#") || /\.(?:pdf|docx?|xlsx?|pptx?|csv|zip)(?:$|[?#])/i.test(href)) return;
    if (/^\/(?:products\/abm\/(?:item|staged|resolve)\/)/i.test(href)) return;

    const context = findProductContext(anchor);
    if (!context) return;

    const title = bestProductTitle(context.node, anchor, context.title);
    const sku = collapse(context.sku);
    if (!title && !sku) return;

    const sourceUrl = extractOfficialAbmUrl(href);
    const params = new URLSearchParams();
    if (title) params.set("title", title);
    if (sku) params.set("sku", sku);
    if (sourceUrl) params.set("u", sourceUrl);

    anchor.setAttribute("href", `/products/abm/resolve?${params.toString()}`);
    anchor.removeAttribute("target");
    anchor.removeAttribute("rel");
    anchor.dataset.itsbioAbmProductResolved = "true";
  });
}

function hideEmptyCategoryNotice(pathname: string) {
  if (!/^\/products\/abm\/(?:general-materials|cellular-materials|genetic-materials)(?:\/|$)/i.test(pathname)) return;

  document.querySelectorAll<HTMLElement>("main").forEach((main) => {
    const hasProductList = Array.from(main.querySelectorAll<HTMLElement>("h2,h3,section"))
      .some((element) => /^Product List$/i.test(collapse(element.textContent)) || element.getAttribute("aria-label") === "ABM product list");
    if (!hasProductList) return;

    Array.from(main.querySelectorAll<HTMLDivElement>("div")).forEach((element) => {
      const text = collapse(element.textContent);
      if (!text.startsWith("본문 데이터가 아직 없습니다.")) return;
      if (text.length > 120) return;
      element.remove();
    });
  });
}

export default function AbmLinkResolverClient() {
  const pathname = usePathname();

  useEffect(() => {
    let disposed = false;
    let queued = false;
    let menuItems: MenuItem[] = [];

    const rewriteAll = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (disposed) return;
        rewriteMegaMenuLinks(menuItems);
        rewriteGelDocumentationLinks();
        rewriteRichProductLinks(pathname);
        hideEmptyCategoryNotice(pathname);
        ensureGelDocumentationAnchor(pathname);
      });
    };

    void fetch("/api/abm/menu", { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload) => {
        if (disposed) return;
        menuItems = Array.isArray(payload?.items) ? payload.items : [];
        rewriteAll();
      })
      .catch(() => {
        // The family landing links remain safe when the menu source is unavailable.
      });

    rewriteAll();
    const observer = new MutationObserver(rewriteAll);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
