# Kent Shop-only product sync

Kent blocks ordinary scripted Shop requests with HTTP 403. This workflow therefore uses the same browser-backed method used in the earlier Kent preflight work.

- A visible local Google Chrome session opens the live Kent Shop.
- If Kent shows a security check, complete it once in the opened browser and return to the terminal.
- The browser session follows Shop pagination and opens every product detail page.
- Shop pages and product HTML are saved under `.cache/kent-shop/`.
- Audit and sync read only those verified browser snapshots; they do not crawl Kent with ordinary Node `fetch`.
- Sanity-only products are reported but never deleted or deactivated automatically.

## 1. Install the temporary browser helper

```bash
npm run kent:shop:browser:setup
```

This installs `playwright-core` without changing `package-lock.json`.

## 2. Build a fresh verified browser cache

```bash
npm run kent:shop:browser -- --fresh
```

Google Chrome opens. If a Kent 403 or security screen appears, make the page display normally in that Chrome window, return to the terminal, and press Enter.

The browser collector writes:

```text
.cache/kent-shop/browser-inventory.json
.cache/kent-shop/browser-inventory.md
.cache/kent-shop/shop-pages/page-*.html
.cache/kent-shop/product-pages/*.html
```

The inventory is marked `complete: true` only when all Shop pages were followed and every discovered product page was checked without unresolved errors. Using `--limit` intentionally produces an incomplete inventory and cannot be used for normal audit or import.

## 3. Audit Shop against Sanity

```bash
npm run kent:shop:audit
```

The wrapper refuses to continue unless the complete browser inventory and all required HTML snapshots exist. Audit mode does not change Sanity.

Review:

```text
.cache/kent-shop/audit-report.json
```

Important fields:

- `shopProductCount`
- `sanityProductCount`
- `presentCount`
- `missingCount`
- `notInShopCount`
- `duplicateSanitySlugs`
- `duplicateSanitySourceUrls`
- `slugMismatches`
- `missing`
- `notInShop`

## 4. Test only three missing products

```bash
npm run kent:shop:sync -- --limit 3
```

Without `--refreshExisting`, write mode creates only Shop products missing from Sanity. Existing products are not overwritten.

## 5. Import all missing Shop products

```bash
npm run kent:shop:sync
```

## 6. Refresh existing Shop products

Run only after the audit and limited test have been reviewed:

```bash
npm run kent:shop:sync -- --refreshExisting
```

This still does not delete, deactivate, or automatically reactivate products.

## Product mapping

The synchronizer reads the browser-saved product HTML and maps title, slug, SKU, summary, category paths, descriptions, specifications, resources, publications, reviews, PDF documents, WooCommerce option groups, variants, variant SKUs, and variant images.

Product and variant images are uploaded to Sanity so the existing Kent gallery receives Sanity CDN URLs.

New document IDs are deterministic: `prod_kent__{shop-slug}`.

## Required environment

Audit requires:

- `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `NEXT_PUBLIC_SANITY_DATASET`

Write mode additionally requires:

- `SANITY_WRITE_TOKEN`
