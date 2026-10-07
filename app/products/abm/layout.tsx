import type { ReactNode } from "react";

import AbmCatalogPolishClient from "@/components/products/AbmCatalogPolishClient";
import AbmGeneticMaterialsPolishClient from "@/components/products/AbmGeneticMaterialsPolishClient";
import AbmCas9VectorsTableFixClient from "@/components/products/AbmCas9VectorsTableFixClient";
import AbmPrintCleanupClient from "@/components/products/AbmPrintCleanupClient";
import AbmRichProductLinkClient from "@/components/site/AbmRichProductLinkClient";

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
  text-align: left !important;
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

.itsbio-html .itsbio-abm-normalized-table.itsbio-abm-table-compact {
  table-layout: fixed !important;
}

.itsbio-html .itsbio-abm-normalized-table.itsbio-abm-table-compact > thead > tr > :first-child,
.itsbio-html .itsbio-abm-normalized-table.itsbio-abm-table-compact > tbody > tr:not(.abm-table-section-row) > :first-child {
  width: 34% !important;
}

.itsbio-html .itsbio-abm-normalized-table.itsbio-abm-table-compact > thead > tr > :last-child,
.itsbio-html .itsbio-abm-normalized-table.itsbio-abm-table-compact > tbody > tr:not(.abm-table-section-row) > :last-child {
  width: 66% !important;
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

/* Bundle matrices retain four package columns, including the two combo packs
   whose source headers were blank. Give each checkmark a readable column. */
.itsbio-html table[data-itsbio-bundle-table] {
  min-width: 920px !important;
  table-layout: fixed !important;
}

.itsbio-html table[data-itsbio-bundle-table] th,
.itsbio-html table[data-itsbio-bundle-table] td {
  vertical-align: middle !important;
  overflow-wrap: normal;
  word-break: normal;
  font-size: 14px;
}

.itsbio-html table[data-itsbio-bundle-table] thead th {
  width: 12% !important;
  color: #fff !important;
}

.itsbio-html table[data-itsbio-bundle-table] thead th:first-child { width: 30% !important; }
.itsbio-html table[data-itsbio-bundle-table] thead th:nth-child(2) { width: 10% !important; }
.itsbio-html table[data-itsbio-bundle-table] tr:not(.itsbio-bundle-catalog-row) > :nth-child(n+3) {
  text-align: center !important;
}
.itsbio-html table[data-itsbio-bundle-table] tr > :nth-child(2) { white-space: nowrap; }
.itsbio-html table[data-itsbio-bundle-table] thead th span:not(.itsbio-bundle-best-value) { color: inherit !important; }
.itsbio-html table[data-itsbio-bundle-table] .itsbio-bundle-best-value {
  display: inline-block;
  margin-top: 5px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #fef08a;
  color: #422006;
  font-size: 10px;
  white-space: nowrap;
}
.itsbio-html table[data-itsbio-bundle-table] .itsbio-bundle-catalog-row > td {
  background: #fff7ed !important;
  color: #111827;
  font-weight: 600;
  text-align: center !important;
}
.itsbio-html table[data-itsbio-bundle-table] .itsbio-bundle-catalog-row > td:first-child {
  width: auto !important;
  text-align: left !important;
}
.itsbio-html table[data-itsbio-bundle-table] .itsbio-bundle-catalog-row a {
  color: #9a3412;
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Cas9 Vectors & Virus keeps ABM's native rowspan grouping after the Price
   column is removed. This is intentionally scoped to that one category. */
.itsbio-html .itsbio-cas9-vector-table {
  width: 100% !important;
  min-width: 760px !important;
  table-layout: fixed !important;
  border-collapse: collapse !important;
}

.itsbio-html .itsbio-cas9-vector-table th,
.itsbio-html .itsbio-cas9-vector-table td {
  padding: 12px 14px !important;
  vertical-align: middle !important;
  white-space: normal !important;
  overflow-wrap: anywhere;
}

.itsbio-html .itsbio-cas9-vector-table thead th,
.itsbio-html .itsbio-cas9-vector-table thead td {
  background: #ef6331 !important;
  color: #fff !important;
  font-weight: 700;
}

.itsbio-html .itsbio-cas9-vector-table .itsbio-cas9-section-row > th,
.itsbio-html .itsbio-cas9-vector-table .itsbio-cas9-section-row > td {
  background: #f3f4f6 !important;
  color: #111827 !important;
  font-weight: 700;
}

.itsbio-html .itsbio-cas9-vector-table td[rowspan] {
  vertical-align: top !important;
  font-weight: 600;
}

.itsbio-html .itsbio-cas9-vector-table a::after {
  content: none !important;
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


/* ABM CRISPR source forms are stripped during HTML sanitization. Reinsert a
   native ITS BIO search control while keeping the migrated source heading and
   explanatory copy in place. */
.itsbio-html .itsbio-crispr-search {
  display: flex;
  width: min(100%, 760px);
  gap: 10px;
  margin: 18px 0 28px;
}

.itsbio-html .itsbio-crispr-search input[type="search"] {
  min-width: 0;
  flex: 1 1 auto;
  height: 46px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  padding: 0 14px;
  color: #111827;
  font-size: 14px;
  outline: none;
}

.itsbio-html .itsbio-crispr-search input[type="search"]:focus {
  border-color: #ef6331;
  box-shadow: 0 0 0 3px rgba(239, 99, 49, 0.12);
}

.itsbio-html .itsbio-crispr-search button {
  height: 46px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 8px;
  background: #ef6331;
  padding: 0 24px;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.itsbio-html .itsbio-crispr-search button:hover {
  background: #d95221;
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

  .itsbio-html .itsbio-cas9-vector-table {
    min-width: 760px !important;
  }

  .itsbio-html .itsbio-crispr-search {
    flex-direction: column;
  }

  .itsbio-html .itsbio-crispr-search button {
    width: 100%;
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
      <AbmCas9VectorsTableFixClient />
      <AbmPrintCleanupClient />
      <AbmRichProductLinkClient />
      {children}
    </>
  );
}
