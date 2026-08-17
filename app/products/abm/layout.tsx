import type { ReactNode } from "react";

import AbmCatalogPolishClient from "@/components/products/AbmCatalogPolishClient";

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
}
`;

export default function AbmProductsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ABM_CATALOG_POLISH_CSS }} />
      <AbmCatalogPolishClient />
      {children}
    </>
  );
}
