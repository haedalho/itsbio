# Kent official content review — Batch 001

Reviewed against current public Kent product pages on 2026-07-29.

Status policy:
- VERIFIED: official and effective local content match; no canonical cleanup remains.
- NEEDS_FIX: one or more title/subtitle/Item #/intro/options/sections/gallery/content-policy issues remain.
- UNRESOLVED: current official page could not be inspected reliably.

## Summary

- Products reviewed: 10
- VERIFIED: 0
- NEEDS_FIX: 10
- UNRESOLVED: 0

## Results

### 1. 2-Accessory Connector
- slug: somnosuite-y-adapter
- status: NEEDS_FIX
- correct: displayed title, subtitle, three compatibility options and three Item # values are aligned with the official page.
- incorrect: canonical Sanity content still contains login/price variation markup; gallery data contains a setup image, 100x100 duplicates and unrelated product thumbnails.
- required action: retain the verified full-size connector image and official product text/options; remove obsolete commerce markup and non-gallery assets after preview approval.

### 2. 3 Accessory Connector
- slug: 3-accessory-connector
- status: NEEDS_FIX
- correct: title, Item # 10-1000-185, description, tubing lengths and the two compatibility variants match the official page.
- incorrect: canonical variation table contains price data; Sanity gallery includes 100x100 duplicates and unrelated product thumbnails.
- required action: structure the intro/options and retain only the official gallery assets; remove commerce data.

### 3. AC Adapters and Power Cords
- slug: ac-adapters-and-power-cords
- status: NEEDS_FIX
- correct: title, main Item # and three product options match the official page; compatibility body text is substantially present.
- incorrect: local subtitle is “Activated Charcoal Absorption Filters,” which belongs to another product; canonical data includes login/price markup and unrelated thumbnails.
- required action: remove the false subtitle, preserve the two adapter compatibility groups and three variants, and clean the gallery/commerce fields.

### 4. Accuris™ Mini Balances
- slug: accuris-mini-balances
- status: NEEDS_FIX
- correct: official three-paragraph description, four options and specifications are substantially present.
- incorrect: local subtitle is “Animal Weighing Scale,” which belongs to another product; default Item # points to a calibration-weight option rather than representing the product family; content is unstructured and gallery contains thumbnail duplicates.
- required action: remove the false subtitle, represent option-specific Item # values correctly, create the Specifications section and clean the gallery.

### 5. Acrylic Brain Matrices
- slug: acrylic-brain-matrices
- status: NEEDS_FIX
- correct: title, Item # RBMA-200C, main description and four size options are substantially present.
- incorrect: local subtitle is “Microvette® 100 Blood Collection Tubes,” which belongs to another product; long official sections/resources are not structured; gallery mixes product, body/reference and thumbnail images.
- required action: remove the false subtitle, reproduce official section order and classify official product-gallery media separately from body/reference media.

### 6. Activated Charcoal Absorption Filters
- slug: activated-charcoal-absorption-filters-1
- status: NEEDS_FIX
- correct: title, subtitle and main Item # match the official page.
- incorrect: official page has two filter options, but local data adds “Holder for Activated Charcoal Absorption Filter” as a third variant and reuses Item # 10-2001-8; the official intro about capturing unused/exhaled anesthetic is missing from canonical content; price/login markup and unrelated thumbnails remain.
- required action: remove the holder variant and duplicate SKU, restore the official intro, and link the holder only as a separate related product.

### 7. Aeroneb® Lab Control Module
- slug: aeroneb-lab-control-module
- status: NEEDS_FIX
- correct: title, Item # NEB-7000 and most official descriptive/specification text are present.
- incorrect: local subtitle is “Aeroneb® Lab Nebulizer,” which is another product; official headings such as What you get on day one, Product versions and Product specifications are flattened instead of structured; gallery contains thumbnail/body images.
- required action: remove the false subtitle and recreate official sections/order with managed Sanity media.

### 8. Aeroneb® Lab Control Module Kit
- slug: aeroneb-lab-control-module-kit
- status: NEEDS_FIX
- correct: title, Item # NEB-7000SM, Standard/Small options and included-item lists are present.
- incorrect: local subtitle is “Standalone Flowmeter with Stand”; local content begins with unrelated product names; supplier support and price data remain; official included-item sections are not structured.
- required action: remove cross-product text, split Standard system includes and Small system includes, and clean support/commerce/gallery data.

### 9. Aeroneb® Lab Nebulizer
- slug: aeroneb-lab-nebulizer-unit
- status: NEEDS_FIX
- correct: title, Item # NEB-1000, main description, two VMD options, specifications and publication titles are substantially present.
- incorrect: local subtitle is “Aeroneb® Lab Control Module”; content starts with unrelated product names; supplier support and price data remain; specifications/publications are not structured in official order.
- required action: remove cross-product text and rebuild official Specifications and Scientific publications sections.

### 10. Analog Output Cable
- slug: analog-output-cable
- status: NEEDS_FIX
- correct: Item # CBL-ANAOUT-MINI and the subtitle text are present.
- incorrect: official description explaining the voltage signal and Mini-DIN/BNC/bare-lead features is missing locally; Related Products are missing; canonical gallery contains unrelated thumbnails.
- required action: restore official description/features and related products, then clean gallery data.

## Batch conclusion

None of the first ten products is safe to mark VERIFIED or overwrite into canonical Sanity fields yet. Rendering filters may hide some contamination, but the canonical product data still requires official staging, visual verification and controlled replacement.
