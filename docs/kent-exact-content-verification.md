# Kent exact content verification

## Purpose

The verifier proves that a reviewed ITS BIO Kent product matches the actual Kent detail page. Approximate similarity, neighboring-product inference and partial image overlap cannot produce `VERIFIED`.

```bash
npm run kent:exact:verify
npm run kent:exact:verify:strict
```

The verifier makes no Kent web requests and performs no Sanity writes.

## VERIFIED requirements

A product is `VERIFIED` only when an approved source snapshot exists and all of the following match:

1. exact product title
2. exact subtitle
3. exact Item #
4. exact canonical Kent source URL
5. SHA-256 of the complete top product body
6. option group labels and order
7. option value labels and order
8. Variant order, IDs, SKUs and option associations
9. section title, type and order
10. SHA-256 of every section's complete rendered data
11. one approved Sanity hero-image Asset ID and SHA-1
12. no extra gallery images
13. no Variant images
14. no Kent-hosted image URL in active product, Variant or section fields

## Media policy

Kent gallery thumbnails are intentionally excluded. The product page displays only the official main product image after that file has been uploaded to Sanity.

The page must not switch images when a Variant is selected. Missing image data uses the local placeholder and never falls back to a Kent URL.

## Content policy

The top product body and all retained product sections must preserve the official wording, values and order. Do not summarize, paraphrase or combine content from another product.

Exclude commerce and supplier UI that is not product content:

- login and price controls
- quantity and cart controls
- newsletter blocks
- supplier help and order-support blocks
- shopping recommendations such as `Customers who viewed this item also viewed`

Retain genuine product sections that exist on the official page, including specifications, resources, videos, FAQs, publications, reviews, notices and warranty information.

## Statuses

### VERIFIED

Every exact comparison passes.

### NEEDS_FIX

A valid source snapshot exists, but the current Sanity product differs.

### BLOCKED

Verification evidence is missing or invalid, the Sanity product is missing, duplicate snapshots exist, or required official evidence is incomplete.

No snapshot never means approved.

## Source review workflow

1. Open and review the actual Kent product page.
2. Record the exact title, subtitle and Item #.
3. Store the exact top product body in `sourceIntroHtml`.
4. Preserve the official option and section ordering.
5. Calculate the source-page, intro-body and section fingerprints.
6. Verify the official main image and upload that one image to Sanity.
7. Record the Sanity Asset ID, SHA-1 and source-image SHA-256.
8. Add the schema-version 2 source snapshot.
9. Run strict verification for that product.
10. Mark an override `VERIFIED` only after strict verification succeeds.

Unverified overrides are filtered out before rendering.

## Safety

- No approximate similarity can produce `VERIFIED`.
- No live Kent fetch or browser automation is used by the exact verifier.
- No Kent image is requested by the ITS BIO runtime.
- No Sanity write occurs during verification.
- No product is automatically deleted, merged, activated or deactivated.
