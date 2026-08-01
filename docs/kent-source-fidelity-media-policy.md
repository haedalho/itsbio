# Kent source fidelity and media policy

## Binding rule

Kent product content must be verified against the actual Kent product detail page. The live ITS BIO site must never hotlink or request Kent-hosted product images.

## Source of truth

For each verified product, preserve the official Kent page's:

- product title
- subtitle
- Item #
- gallery membership and image order
- option labels and variant SKUs
- section titles and section order
- product descriptions, specifications, resources, videos and notices

Do not infer missing content from neighboring products. A product remains unverified when its official page cannot be checked.

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
3. Acquire each approved source image once during the controlled import process.
4. Validate file type, dimensions and product association.
5. Upload the bytes to Sanity Assets.
6. Store only Sanity asset references in active product/gallery/variant fields.
7. Preserve original Kent image URL and fingerprint only in non-rendered provenance fields.
8. Publish only after every visible image resolves to Sanity CDN.

If image acquisition or Sanity upload fails, do not fall back to Kent. Display the local placeholder and leave the product in media-review status.

## Runtime safeguards

- Kent image recovery API is removed.
- Kent image recovery client is removed.
- Kent product galleries reject all URLs except Sanity CDN and local project paths.
- Kent section media rejects unmanaged URLs.
- Copied HTML strips unmanaged `<img>` elements before rendering.
- Related product cards use a Sanity asset or no image.

## Data protection

- Existing Sanity assets are not overwritten with empty values.
- Existing manually curated assets are protected until a verified replacement is uploaded.
- Gallery order is changed only from an actual Kent page review.
- Variant images are attached only after their exact option/SKU association is verified.
- No automatic product deletion, merge or deactivation is permitted.
