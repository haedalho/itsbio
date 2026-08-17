"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const GEL_DOCUMENTATION = "/products/abm/general-materials/gel-documentation";
const DNA_STAINS = `${GEL_DOCUMENTATION}#safeview-dna-stains`;
const GEL_IMAGER = "/products/abm/staged/product/E1001";

function collapse(value: string | null | undefined) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function key(value: string | null | undefined) {
  return collapse(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function directCells(row: HTMLTableRowElement) {
  return Array.from(row.children).filter((node): node is HTMLTableCellElement =>
    node instanceof HTMLTableCellElement,
  );
}

function cellHasContent(cell: HTMLTableCellElement | undefined) {
  if (!cell) return false;
  return Boolean(collapse(cell.textContent) || cell.querySelector("img,svg,a,button,input,select"));
}

function normalizeAbmTable(table: HTMLTableElement) {
  if (table.dataset.itsbioTableNormalized === "true") return;

  table.classList.add("abm-data-table", "itsbio-abm-normalized-table");
  table.removeAttribute("style");
  table.removeAttribute("width");
  table.removeAttribute("height");
  table.querySelectorAll("colgroup").forEach((node) => node.remove());

  const rows = Array.from(table.rows);
  rows.forEach((row) => {
    row.removeAttribute("style");
    directCells(row).forEach((cell) => {
      ["style", "width", "height", "bgcolor", "border", "cellpadding", "cellspacing", "align", "valign"]
        .forEach((attr) => cell.removeAttribute(attr));
    });
  });

  const sectionRows = rows.filter((row) =>
    row.classList.contains("abm-table-section-row")
    || /^table-product-mini-category-/i.test(row.id)
    || (directCells(row).length === 1 && Number(directCells(row)[0]?.colSpan || 1) > 1),
  );

  let regularRows = rows.filter((row) => !sectionRows.includes(row) && directCells(row).length > 1);
  let maxCells = Math.max(0, ...regularRows.map((row) => directCells(row).length));

  // Old ABM product tables sometimes retain blank columns after price/cart
  // columns are removed. Remove only columns that are present and empty in
  // every regular row so genuine specification columns are never discarded.
  for (let index = maxCells - 1; index >= 0; index -= 1) {
    if (!regularRows.length) break;
    const presentInEveryRow = regularRows.every((row) => Boolean(directCells(row)[index]));
    const emptyInEveryRow = regularRows.every((row) => !cellHasContent(directCells(row)[index]));
    if (!presentInEveryRow || !emptyInEveryRow) continue;
    regularRows.forEach((row) => directCells(row)[index]?.remove());
  }

  regularRows = rows.filter((row) => !sectionRows.includes(row) && directCells(row).length > 1);
  maxCells = Math.max(1, ...regularRows.map((row) => directCells(row).length));

  sectionRows.forEach((row) => {
    row.classList.add("abm-table-section-row");
    const cells = directCells(row);
    if (cells.length === 1) cells[0].colSpan = maxCells;
  });

  const headerRows = Array.from(table.querySelectorAll<HTMLTableRowElement>("thead tr"));
  headerRows.forEach((row) => {
    const cells = directCells(row);
    if (!cells.length || cells.length >= maxCells) return;
    const last = cells.at(-1);
    if (last) last.colSpan = Math.max(1, maxCells - cells.length + 1);
  });

  table.classList.toggle("itsbio-abm-table-compact", maxCells <= 2);
  table.classList.toggle("itsbio-abm-table-wide", maxCells >= 5);

  const parent = table.parentElement;
  if (parent && !parent.classList.contains("abm-table-scroll")) {
    const wrap = document.createElement("div");
    wrap.className = "abm-table-scroll itsbio-abm-table-wrap";
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", "Scrollable product information table");
    parent.insertBefore(wrap, table);
    wrap.appendChild(table);
  } else if (parent) {
    parent.classList.add("itsbio-abm-table-wrap");
  }

  table.dataset.itsbioTableNormalized = "true";
}

function setAnchorLabel(anchor: HTMLAnchorElement, label: string) {
  const spans = Array.from(anchor.querySelectorAll<HTMLElement>("span"))
    .filter((span) => !span.children.length && collapse(span.textContent));
  const textSpan = spans.find((span) => {
    const value = key(span.textContent);
    return value.includes("gel documentation")
      || value.includes("safeviewer imager")
      || value.includes("gel imager")
      || value.includes("dna stains");
  });

  if (textSpan) textSpan.textContent = label;
  else if (!anchor.children.length) anchor.textContent = label;
}

function normalizeGelDocumentationLinks() {
  document.querySelectorAll<HTMLAnchorElement>('a[href*="/products/abm/"]').forEach((anchor) => {
    let url: URL;
    try {
      url = new URL(anchor.getAttribute("href") || "", window.location.origin);
    } catch {
      return;
    }

    const pathname = decodeURIComponent(url.pathname).toLowerCase();
    const label = key(anchor.textContent);
    if (!pathname.startsWith("/products/abm/general-materials")) return;

    const segments = pathname.split("/").filter(Boolean);
    const repeatedGelDocumentation = segments.length >= 2
      && segments.at(-1) === "gel-documentation"
      && segments.at(-2) === "gel-documentation";

    const dnaStains = label === "dna stains"
      || segments.at(-1) === "dna-stains"
      || repeatedGelDocumentation;

    const gelImager = label === "gel imager"
      || label === "safeviewer imager"
      || segments.at(-1) === "gel-imager"
      || segments.at(-1) === "safeviewer-imager";

    if (dnaStains) {
      anchor.setAttribute("href", DNA_STAINS);
      setAnchorLabel(anchor, "DNA Stains");
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
      return;
    }

    if (gelImager) {
      anchor.setAttribute("href", GEL_IMAGER);
      setAnchorLabel(anchor, "Gel Imager");
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
      return;
    }

    // Equipment contains another legacy Gel Documentation branch. It should
    // always lead to the canonical landing rather than a parallel old page.
    if (label === "gel documentation" && pathname !== GEL_DOCUMENTATION) {
      anchor.setAttribute("href", GEL_DOCUMENTATION);
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
    }
  });
}

function ensureDnaStainsAnchor(pathname: string) {
  if (pathname.toLowerCase() !== GEL_DOCUMENTATION) return null;

  let target = document.getElementById("safeview-dna-stains") as HTMLElement | null;
  if (!target) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(
      ".itsbio-html h1,.itsbio-html h2,.itsbio-html h3,.itsbio-html h4,.itsbio-html h5,.itsbio-html h6,.itsbio-html strong,.itsbio-html b",
    ));
    target = candidates.find((element) => {
      const value = key(element.textContent);
      return value.includes("safeview") && value.includes("dna stains");
    }) || null;

    if (target) {
      target.id = "safeview-dna-stains";
      target.style.scrollMarginTop = "116px";
    }
  }
  return target;
}

export default function AbmCatalogPolishClient() {
  const pathname = usePathname();

  useEffect(() => {
    let scheduled = false;

    const apply = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        normalizeGelDocumentationLinks();
        document.querySelectorAll<HTMLTableElement>(".itsbio-html table").forEach(normalizeAbmTable);

        const target = ensureDnaStainsAnchor(pathname);
        if (target && window.location.hash === "#safeview-dna-stains") {
          requestAnimationFrame(() => target.scrollIntoView({ block: "start", behavior: "auto" }));
        }
      });
    };

    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.origin);
      } catch {
        return;
      }
      if (url.pathname !== GEL_DOCUMENTATION || url.hash !== "#safeview-dna-stains") return;
      if (window.location.pathname !== GEL_DOCUMENTATION) return;

      const target = ensureDnaStainsAnchor(pathname);
      if (!target) return;
      event.preventDefault();
      window.history.pushState(null, "", DNA_STAINS);
      target.scrollIntoView({ block: "start", behavior: "smooth" });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
    };
  }, [pathname]);

  return null;
}
