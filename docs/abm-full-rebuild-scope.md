# ABM Full Rebuild Scope

This document is the binding scope for the ABM rebuild on `agent/abm-full-rebuild`.

## Goal

Rebuild ITS BIO's ABM section from the current official ABM site, including:

1. all normal Product records,
2. all Service records,
3. current Product and Service taxonomy,
4. official product/service detail content and assets,
5. cross-check against the historical ITS BIO ABM product spreadsheet when the workbook is available.

The old Sanity catalog is an input for comparison, not the source of truth.

## Product inclusion rule

Include normal purchasable/searchable products from:

- General Materials
- Cellular Materials outside large generated cell libraries
- Genetic Materials outside large generated gene/vector libraries

Current official search-index inclusion targets:

- General Materials
- 3D and Organoid
- Microbial Contamination
- Cell Immortalization Reagents
- Media & Supplements
- Growth Factors and Cytokines
- Culture Consumables
- Cell Assay Products
- Cas9 Vectors & Virus
- Cas Proteins & CRISPR Screening
- Expression Systems
- Specialized Vectors
- Kits for Viral Vectors

## Product exclusion rule

Do not migrate individual SKUs from large library/generated-catalog branches:

- Cell Library Collections
- Expression-Ready Libraries
- CRISPR KO Vectors & Virus
- CRISPR Activation Vectors

These categories may remain visible as taxonomy/redirect/reference pages where useful, but their hundreds of thousands of generated SKUs are not ITS BIO product documents.

A title merely containing `Collection` is not automatically deleted. Ambiguous small collection/category pages are reviewed rather than silently dropped.

## Service inclusion rule

Services are not subject to the Product library exclusion. Include all official Service results under:

- Cell & Antibody Services
- DNA & Cloning Services
- Recombinant Virus Packaging

This includes individual service offerings with Cat. No. as well as parent service-category content pages.

## Source of truth order

1. Current official ABM search index (`/search`) for product/service inventory and counts.
2. Current official ABM product/service page for title, Cat. No., description, specifications, documents, FAQs, references and media.
3. Current official ABM navigation for taxonomy and category/service landing pages.
4. Historical ITS BIO ABM spreadsheet as a required inclusion/cross-check list once supplied.
5. Existing Sanity ABM documents only as migration candidates and comparison data.

## Safety

Until preview QA is complete:

- no production ABM product is deleted,
- no existing production product is overwritten by census/audit jobs,
- audit jobs are read-only,
- new content is staged before production promotion,
- source URLs and Cat. No. are verified before promotion.

## Acceptance criteria

Before production promotion:

- included official Product missing from preview: 0
- included official Service missing from preview: 0
- excluded large-library SKU accidentally imported: 0
- duplicate Cat. No. product records: 0 (unless the official source genuinely uses the same Cat. No. for distinct variants and this is explicitly modeled)
- broken internal Product/Service links: 0
- historical spreadsheet Product Codes missing: 0, after the workbook is re-supplied for the final cross-check
