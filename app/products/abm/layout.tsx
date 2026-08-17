import type { ReactNode } from "react";

import AbmCatalogPolishClient from "@/components/products/AbmCatalogPolishClient";
import AbmGeneticMaterialsPolishClient from "@/components/products/AbmGeneticMaterialsPolishClient";

const ABM_CATALOG_POLISH_CSS = `
.itsbio-html .itsbio-abm-table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto !important;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
}

.itsbio-html .itsbio-abm-normalized-table {
  width: 100% !important;
  min-width: 100%;
  table-layout: auto !important;
  border-collapse: collapse !important;
}

.itsbio-html .itsbio-abm-normalized-table th,
.itsbio-html .itsbio-abm-normalized-table td {
  box-sizing: border-box;
  min-width: 0 !important;
  padding: 12px 14px !important;
  vertical-align: top;
}

.itsbio-html .itsbio-abm-normalized-table thead tr > th,
.itsbio-html .itsbio-abm-normalized-table thead tr > td {
  background: #ef6331 !important;
  color: #fff !important;
  border-bottom: 0 !important;
  font-weight: 700;
}

.itsbio-html .itsbio-abm-normalized-table .abm-table-section-row > th,
.itsbio-html .itsbio-abm-normalized-table .abm-table-section-row > td {
  width: auto !important;
  background: #f3f4f6 !important;
  color: #111827 !important;
  font-weight: 700;
}

.itsbio-html .itsbio-abm-normalized-table.itsbio-abm-table-compact > thead > tr > :first-child,
.itsbio-html .itsbio-abm-normalized-table.itsbio-abm-table-compact > tbody > tr:not(.abm-table-section-row) > :first-child {
  width: 64% !important;
}

.itsbio-html .itsbio-abm-normalized-table.itsbio-abm-table-compact > thead > tr > :last-child,
.itsbio-html .itsbio-abm-normalized-table.itsbio-abm-table-compact > tbody > tr:not(.abm-table-section-row) > :last-child {
  width: 36% !important;
}

.itsbio-html .itsbio-abm-normalized-table.itsbio-abm-table-wide {
  min-width: 760px;
}

.itsbio-html .itsbio-abm-normalized-table tbody tr:not(.abm-table-section-row):nth-child(even) {
  background: #fcfcfd;
}

.itsbio-html .itsbio-abm-normalized-table tbody tr:not(.abm-table-section-row):hover {
  background: #fff7ed;
}

/* Genetic Materials follows the current official ABM menu wording. Long labels
   wrap naturally instead of being clipped into misleading partial titles. */
.itsbio-genetic-sidebar .truncate {
  overflow: visible !important;
  white-space: normal !important;
  text-overflow: clip !important;
}

.itsbio-genetic-sidebar a {
  align-items: flex-start;
}

/* Rebuild ABM's icon-style highlighted product/service list after the supplier
   CSS has been removed. The source list bullets/arrows are intentionally not
   shown; each destination becomes one clean ITS BIO card. */
.itsbio-html .itsbio-abm-highlight-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 24px 20px;
  margin: 28px 0 56px;
  padding: 0;
  list-style: none;
}

.itsbio-html .itsbio-abm-highlight-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #dc5a2b;
  text-align: center;
  text-decoration: none !important;
}

.itsbio-html .itsbio-abm-highlight-card::after {
  content: none !important;
}

.itsbio-html .itsbio-abm-highlight-icon {
  display: grid;
  width: 76px;
  height: 76px;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
}

.itsbio-html .itsbio-abm-highlight-icon img,
.itsbio-html .itsbio-abm-highlight-icon svg {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.itsbio-html .itsbio-abm-highlight-label {
  max-width: 145px;
  color: #dc5a2b;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.45;
}

.itsbio-html .itsbio-abm-highlight-card:hover .itsbio-abm-highlight-label {
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 1100px) {
  .itsbio-html .itsbio-abm-highlight-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .itsbio-html .itsbio-abm-table-wrap {
    border-radius: 10px;
  }

  .itsbio-html .itsbio-abm-normalized-table {
    min-width: 620px;
  }

  .itsbio-html .itsbio-abm-normalized-table th,
  .itsbio-html .itsbio-abm-normalized-table td {
    padding: 11px 12px !important;
  }

  .itsbio-html .itsbio-abm-highlight-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px 16px;
    margin-bottom: 40px;
  }
}
`;

export default function AbmProductsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ABM_CATALOG_POLISH_CSS }} />
      <AbmCatalogPolishClient />
      <AbmGeneticMaterialsPolishClient />
      {children}
    </>
  );
}
