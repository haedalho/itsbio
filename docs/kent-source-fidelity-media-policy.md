# Kent source fidelity and media policy

## Binding rule

Kent product content must be verified against the actual Kent product detail page. The live ITS BIO site must never hotlink or request Kent-hosted product images.

`비슷함`, 요약, 의역, 이웃 제품에서 가져온 내용은 공식 일치로 인정하지 않는다. 실제 페이지에서 확인한 제목·부제목·Item #·옵션·섹션·표시 순서와 승인된 본문 지문이 모두 일치해야 한다.

## Source of truth

For each verified product, preserve the official Kent page's:

- product title, including capitalization and trademark symbols
- subtitle
- Item #
- gallery membership and image order
- option labels, option order and variant SKUs
- section titles and section order
- product descriptions, specifications, resources, videos, FAQs and notices
- visible list, table and review order

Do not infer missing content from neighboring products. Do not rewrite or summarize official product prose inside a record represented as exact official content. A product remains unverified when its official page cannot be checked or when the authorized source content is unavailable.

## Exact verification gate

A product override is rendered only when its verification status is exactly `VERIFIED`.

`STAGING`, `DRAFT`, missing verification data and legacy overrides are not treated as official rendered content.

Every `VERIFIED` product requires a JSON evidence snapshot under:

```text
data/kent-official-source-snapshots/<slug>.json
```

The snapshot must include:

- canonical Kent source URL
- review timestamp
- SHA-256 of the reviewed source page evidence
- exact title, subtitle and Item #
- exact option and Variant order
- exact section title/type order
- SHA-256 of every approved section's full rendered data
- Sanity image Asset ID, SHA-1 and gallery order

Run:

```bash
npm run kent:exact:verify
npm run kent:exact:verify:strict
```

`--strict` fails when any reviewed product is `NEEDS_FIX` or `BLOCKED`. A missing snapshot is `BLOCKED`, not implicitly approved.

## Media storage

Visible Kent product media must be one of:

1. a Sanity image asset served from `https://cdn.sanity.io`, or
2. an intentional local project file under `/public` such as the Kent placeholder.

The following are never valid render sources:

- `kentscientific.com` image URLs
- Kent `wp-content` URLs
- protocol-relative external URLs
- legacy `imageUrls` or `galleryImageUrls`
- variant `imageUrl` values that have not been uploaded to Sanity
- images embedded in copied Kent HTML unless their source is a Sanity asset

Kent image URLs may be retained only as provenance metadata for review. They must never be passed to `<Image>`, `<img>`, CSS backgrounds, Open Graph images or JSON-LD image fields.

## Import sequence

1. Verify the actual Kent product page.
2. Record title, subtitle, Item #, option structure, section order and official gallery order.
3. Record the approved source evidence fingerprint.
4. Prepare the exact approved visible product content without commerce or supplier-support UI.
5. Acquire each approved source image once during the controlled import process.
6. Validate file type, dimensions and exact product/Variant association.
7. Upload the bytes to Sanity Assets.
8. Store only Sanity asset references in active product/gallery/variant fields.
9. Preserve original Kent image URL and fingerprint only in non-rendered provenance fields.
10. Generate the exact-content snapshot and run the strict verifier.
11. Publish only after all exact comparisons pass.

If content evidence, image acquisition or Sanity upload fails, do not infer or fall back to Kent at runtime. Leave the product blocked or display the local placeholder.

## Runtime safeguards

- Kent image recovery API is removed.
- Kent image recovery client is removed.
- Kent product galleries reject all URLs except Sanity CDN and local project paths.
- Kent section media rejects unmanaged URLs.
- Copied HTML strips unmanaged `<img>` elements before rendering.
- Related product cards use a Sanity asset or no image.
- Unverified official overrides are not rendered.

## Data protection

- Existing Sanity assets are not overwritten with empty values.
- Existing manually curated assets are protected until a verified replacement is uploaded.
- Gallery order is changed only from an actual Kent page review.
- Variant images are attached only after their exact option/SKU association is verified.
- No automatic product deletion, merge or deactivation is permitted.
