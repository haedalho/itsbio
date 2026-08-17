"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const ABM_CATEGORY_PATH = /^\/products\/abm\/(?:general-materials|cellular-materials|genetic-materials)(?:\/|$)/i;
const DIRECT_DOCUMENT_PATH = /\.(?:pdf|docx?|xlsx?|pptx?|csv|zip)(?:$|[?#])/i;

function collapse(value: string | null | undefined) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
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
    // Resolve from visible product metadata instead.
  }
  return "";
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

  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tr"));
  const headerRow =
    Array.from(table.querySelectorAll<HTMLTableRowElement>("thead tr")).at(-1)
    || rows.find((candidate) => candidate.querySelector("th"))
    || rows.find((candidate) => /(?:Cat\.?\s*No\.?|Catalog\s*(?:No\.?|#))/i.test(collapse(candidate.textContent)))
    || null;
  if (!headerRow) return null;

  const headers = Array.from(headerRow.querySelectorAll<HTMLTableCellElement>("th,td"))
    .map((cell) => collapse(cell.textContent));
  const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>("td,th"));
  if (!cells.length) return null;

  const skuIndex = headers.findIndex((header) => /^(?:cat\.?\s*no\.?|catalog\s*(?:no\.?|#))$/i.test(header));
  const titleIndex = headers.findIndex((header) => /^(?:product\s*(?:name)?|cloning\s*vector|name)$/i.test(header));

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
  if (!ABM_CATEGORY_PATH.test(pathname)) return;

  document.querySelectorAll<HTMLAnchorElement>("main .itsbio-html a[href]").forEach((anchor) => {
    if (anchor.dataset.itsbioAbmProductResolved === "true") return;
    if (anchor.dataset.itsbioAbmPreserveLink === "true") return;

    const href = collapse(anchor.getAttribute("href"));
    if (!href || href.startsWith("#") || DIRECT_DOCUMENT_PATH.test(href)) return;
    if (/^\/products\/abm\/(?:item|staged|resolve)(?:\/|\?|$)/i.test(href)) {
      anchor.dataset.itsbioAbmProductResolved = "true";
      return;
    }

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

export default function AbmRichProductLinkClient() {
  const pathname = usePathname();

  useEffect(() => {
    if (!ABM_CATEGORY_PATH.test(pathname)) return;

    let disposed = false;
    let queued = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let hardStopTimer: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver | null = null;

    const run = () => {
      if (disposed || queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (!disposed) rewriteRichProductLinks(pathname);
      });
    };

    const main = document.querySelector("main");
    if (main) {
      observer = new MutationObserver(() => {
        run();
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => observer?.disconnect(), 300);
      });
      observer.observe(main, { childList: true, subtree: true });
    }

    // HtmlContent inserts sanitized rich HTML from a passive effect. Watch only
    // the current <main> for a short settling window, then disconnect. This
    // catches the delayed product table insertion without restoring the old
    // permanent document.body observer that hurt page-to-page performance.
    run();
    requestAnimationFrame(run);
    hardStopTimer = setTimeout(() => observer?.disconnect(), 1800);

    return () => {
      disposed = true;
      observer?.disconnect();
      if (idleTimer) clearTimeout(idleTimer);
      if (hardStopTimer) clearTimeout(hardStopTimer);
    };
  }, [pathname]);

  return null;
}
