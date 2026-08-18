"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TARGET_PATH = "/products/abm/genetic-materials/crispr/cas9-vectors-and-virus";
const PRICE_TEXT = /^(?:(?:US|CA)?\$\s?\d[\d,.]*(?:\s*(?:USD|CAD))?|price|pricing|inquiry)$/i;
const SECTION_LABELS = /^(?:Cas9 Nuclease|Cas9 Nickase|dCas9 \(double mutant\)|Other Cas Nucleases|Lentiviral|AAV|Adenovirus|Non-viral)$/i;
const ADDITIONAL_ID = "itsbio-cas9-additional-info";
const STYLE_ID = "itsbio-cas9-page-style";
const MODAL_ID = "itsbio-cas9-workflow-modal";
const WORKFLOW_IMAGE = "https://www.abmgood.com/assets/images/category/cas9_vectors_viruses/CRISPR_Virus_vector_simple_workflow-updated.png";
const METHODS_SOURCE_URL = "https://info.abmgood.com/crispr-cas9-methods-tools";
const DCAS9_SOURCE_URL = "https://info.abmgood.com/crispr-cas9-gene-regulation-dCas9";
const METHODS_URL = `/products/abm/resource?u=${encodeURIComponent(METHODS_SOURCE_URL)}`;
const DCAS9_URL = `/products/abm/resource?u=${encodeURIComponent(DCAS9_SOURCE_URL)}`;

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
    if (!text && index === cells.length - 1 && cells.length > 1) {
      const cls = `${cell.className} ${cell.getAttribute("data-title") || ""}`;
      if (/price|amount|cost|inquiry/i.test(cls)) cell.remove();
    }
  }
}

function installColgroup(table: HTMLTableElement, columns: number) {
  const existing = table.querySelector<HTMLTableColElement>(":scope > colgroup[data-itsbio-cas9]");
  if (existing?.getAttribute("data-columns") === String(columns)) return;
  existing?.remove();

  const colgroup = document.createElement("colgroup");
  colgroup.dataset.itsbioCas9 = "true";
  colgroup.setAttribute("data-columns", String(columns));
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

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
#${ADDITIONAL_ID}{margin:64px 0 24px;padding-top:4px}
#${ADDITIONAL_ID} h2{margin:0 0 18px;color:#ef6331;font-size:27px;font-weight:700;line-height:1.25;letter-spacing:-.02em}
#${ADDITIONAL_ID} .cas9-additional-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:26px}
#${ADDITIONAL_ID} .cas9-additional-card{display:block;width:100%;margin:0;padding:0;border:0;background:transparent;color:#111827;text-align:left;text-decoration:none;cursor:pointer}
#${ADDITIONAL_ID} .cas9-additional-card::after{content:none!important}
#${ADDITIONAL_ID} .cas9-additional-image{display:block;width:100%;aspect-ratio:1.93/1;overflow:hidden;background:#f8fafc}
#${ADDITIONAL_ID} .cas9-additional-image img{display:block;width:100%;height:100%;object-fit:contain;transition:transform .18s ease}
#${ADDITIONAL_ID} .cas9-additional-card:hover img{transform:scale(1.015)}
#${ADDITIONAL_ID} .cas9-additional-title{display:block;margin-top:10px;color:#111827;font-size:16px;font-weight:700;line-height:1.4}
#${ADDITIONAL_ID} .cas9-additional-copy{display:block;margin-top:2px;color:#111827;font-size:15px;font-weight:400;line-height:1.45}
#${MODAL_ID}{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:28px;background:rgba(15,23,42,.72)}
#${MODAL_ID} .cas9-modal-panel{position:relative;width:min(1000px,94vw);padding:18px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.28)}
#${MODAL_ID} img{display:block;width:100%;height:auto}
#${MODAL_ID} button{position:absolute;top:8px;right:8px;display:grid;width:36px;height:36px;place-items:center;border:1px solid #d1d5db;border-radius:999px;background:#fff;color:#111827;font-size:22px;line-height:1;cursor:pointer}
@media(max-width:767px){#${ADDITIONAL_ID}{margin-top:42px}#${ADDITIONAL_ID} .cas9-additional-grid{grid-template-columns:1fr;gap:28px}#${ADDITIONAL_ID} h2{font-size:23px}}
`;
  document.head.appendChild(style);
}

function openWorkflowModal() {
  document.getElementById(MODAL_ID)?.remove();
  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "CRISPR workflow");
  modal.innerHTML = `<div class="cas9-modal-panel"><button type="button" aria-label="Close">×</button><img src="${WORKFLOW_IMAGE}" alt="Simplified CRISPR workflow" /></div>`;

  const close = () => modal.remove();
  modal.querySelector("button")?.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  document.body.appendChild(modal);
}

function cardMarkup(image: string, title: string, copy: string) {
  return `<span class="cas9-additional-image"><img src="${image}" alt="${title}" /></span><span class="cas9-additional-title">${title}</span><span class="cas9-additional-copy">${copy}</span>`;
}

function markPreservedResourceLink(anchor: HTMLAnchorElement) {
  anchor.dataset.itsbioAbmPreserveLink = "true";
}

function ensureAdditionalInformation() {
  if (document.getElementById(ADDITIONAL_ID)) return;
  const root = document.querySelector<HTMLElement>(".itsbio-html");
  if (!root) return;

  const tables = Array.from(root.querySelectorAll<HTMLTableElement>("table")).filter((table) =>
    /Cas9 Nuclease|sgRNA Only|All-in-One spCas9/i.test(textOf(table)),
  );
  const lastTable = tables.at(-1);
  if (!lastTable) return;

  const section = document.createElement("section");
  section.id = ADDITIONAL_ID;
  section.setAttribute("aria-labelledby", `${ADDITIONAL_ID}-title`);
  section.innerHTML = `<h2 id="${ADDITIONAL_ID}-title">Additional Information</h2><div class="cas9-additional-grid"></div>`;
  const grid = section.querySelector<HTMLDivElement>(".cas9-additional-grid");
  if (!grid) return;

  const workflow = document.createElement("button");
  workflow.type = "button";
  workflow.className = "cas9-additional-card";
  workflow.innerHTML = cardMarkup(WORKFLOW_IMAGE, "Workflow", "View our simplified CRISPR workflow.");
  workflow.addEventListener("click", openWorkflowModal);

  const methods = document.createElement("a");
  methods.className = "cas9-additional-card";
  methods.href = METHODS_URL;
  methods.innerHTML = cardMarkup("/images/abm/cas9/methods-tools.svg", "CRISPR Methods & Tools", "CRISPR Knowledge Base.");
  markPreservedResourceLink(methods);

  const regulation = document.createElement("a");
  regulation.className = "cas9-additional-card";
  regulation.href = DCAS9_URL;
  regulation.innerHTML = cardMarkup("/images/abm/cas9/dcas9-regulation.svg", "CRISPR dCas9 Gene Regulation", "CRISPR Knowledge Base.");
  markPreservedResourceLink(regulation);

  grid.append(workflow, methods, regulation);
  const insertionPoint = lastTable.closest(".abm-table-scroll, .itsbio-abm-table-wrap, .models-table-wrap") || lastTable;
  insertionPoint.insertAdjacentElement("afterend", section);
}

function fixPage() {
  ensureStyles();
  fixCas9Tables();
  ensureAdditionalInformation();
}

export default function AbmCas9VectorsTableFixClient() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== TARGET_PATH) return;

    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fixPage);
    };

    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") document.getElementById(MODAL_ID)?.remove();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.getElementById(MODAL_ID)?.remove();
      document.getElementById(ADDITIONAL_ID)?.remove();
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [pathname]);

  return null;
}
