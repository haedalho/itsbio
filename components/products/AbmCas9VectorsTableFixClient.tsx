"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TARGET_PATH = "/products/abm/genetic-materials/crispr/cas9-vectors-and-virus";
const PRICE_TEXT = /^(?:(?:US|CA)?\$\s?\d[\d,.]*(?:\s*(?:USD|CAD))?|price|pricing)$/i;
const SECTION_LABELS = /^(?:Cas9 Nuclease|Cas9 Nickase|dCas9 \(double mutant\)|Other Cas Nucleases|Lentiviral|AAV|Adenovirus|Non-viral)$/i;

function textOf(element: Element | null) {
  return String(element?.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function removeTrailingPriceCells(row: HTMLTableRowElement) {
  const cells = Array.from(row.cells);
  for (let index = cells.length - 1; index >= 0; index -= 1) {
    const cell = cells[index];
    const text = textOf(cell);
    if (PRICE_TEXT.test(text)) {
      cell.remove();
      continue;
    }
    // ABM sometimes leaves a blank price TD after the global price text is hidden.
    if (!text && index === cells.length - 1 && cells.length > 1) {
      const cls = `${cell.className} ${cell.getAttribute("data-title") || ""}`;
      if (/price|amount|cost/i.test(cls)) cell.remove();
    }
  }
}

function installColgroup(table: HTMLTableElement, columns: number) {
  table.querySelector(":scope > colgroup[data-itsbio-cas9]")?.remove();
  const colgroup = document.createElement("colgroup");
  colgroup.dataset.itsbioCas9 = "true";
  const widths = columns === 4 ? [34, 34, 14, 18] : [46, 36, 18];
  widths.forEach((width) => {
    const col = document.createElement("col");
    col.style.width = `${width}%`;
    colgroup.appendChild(col);
  });
  table.insertBefore(colgroup, table.firstChild);
}

function normalizeTable(table: HTMLTableElement) {
  const headerRow = Array.from(table.rows).find((row) => {
    const labels = Array.from(row.cells).map(textOf);
    return labels.includes("Product Name") && labels.some((label) => /Cat\.?\s*No\.?/i.test(label));
  });
  if (!headerRow) return;

  // The supplier table has Price as the trailing column. The shared sanitizer
  // removes it from full rows but cannot safely infer rowspan continuation rows.
  Array.from(table.rows).forEach(removeTrailingPriceCells);

  const headerLabels = Array.from(headerRow.cells).map(textOf).filter(Boolean);
  const columns = headerLabels.some((label) => /^Format$/i.test(label)) ? 4 : 3;
  table.classList.add("itsbio-cas9-vector-table", columns === 4 ? "itsbio-cas9-vector-table-4" : "itsbio-cas9-vector-table-3");
  table.classList.remove("itsbio-abm-table-compact");
  installColgroup(table, columns);

  Array.from(table.rows).forEach((row) => {
    const cells = Array.from(row.cells);
    if (!cells.length) return;

    const label = textOf(cells[0]);
    const isSection = cells.length === 1 || SECTION_LABELS.test(label) || row.id.startsWith("table-product-mini-category-");
    if (isSection && cells.length === 1) {
      cells[0].colSpan = columns;
      row.classList.add("abm-table-section-row", "itsbio-cas9-section-row");
    }

    // Remove malformed colspans left from the original 5/4-column table after
    // Price has been removed. Normal data-cell rowspans are deliberately kept.
    cells.forEach((cell) => {
      const span = Number(cell.getAttribute("colspan") || 1);
      if (span > columns) cell.setAttribute("colspan", String(columns));
    });
  });
}

function fixCas9Tables() {
  const root = document.querySelector(".itsbio-html");
  if (!root) return;
  const tables = Array.from(root.querySelectorAll<HTMLTableElement>("table"));
  tables.forEach((table) => {
    const content = textOf(table);
    if (/Cas9 Nuclease|Cas9 Nickase|dCas9|sgRNA Only|All-in-One spCas9/i.test(content)) normalizeTable(table);
  });
}

export default function AbmCas9VectorsTableFixClient() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== TARGET_PATH) return;

    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fixCas9Tables);
    };

    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
