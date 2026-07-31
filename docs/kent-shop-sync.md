# Kent Shop-only product sync

This workflow treats the live Kent Scientific Shop as the only product discovery source:

- Source: `https://www.kentscientific.com/shop/` and its WooCommerce pagination
- Included: product cards linked to `/products/{slug}/`
- Excluded: product URLs that appear only in the site map, menus, articles, category landing pages, or spreadsheets
- Existing Sanity products not found in the Shop are reported only; they are never deleted or deactivated automatically

## 1. Audit first

```bash
npm run kent:shop:audit -- --refreshCache
```

The command writes:

```text
.cache/kent-shop/audit-report.json
```

Review these fields before any write:

- `shopProductCount`
- `sanityProductCount`
- `presentCount`
- `missingCount`
- `notInShopCount`
- `badShopCards`
- `duplicateSanitySlugs`
- `missing`
- `notInShop`

Audit mode never changes Sanity documents.

## 2. Test a small import

```bash
npm run kent:shop:sync -- --limit 3 --refreshCache
```

Without `--refreshExisting`, write mode creates only Shop products whose slug is missing from the Kent brand in Sanity.

## 3. Import all missing Shop products

```bash
npm run kent:shop:sync -- --refreshCache
```

## 4. Refresh existing Shop products

Use this only after reviewing the audit and a limited test:

```bash
npm run kent:shop:sync -- --refreshExisting --refreshCache
```

This refreshes products currently visible in the Shop. It still does not delete or deactivate Sanity-only products.

## Product mapping

The synchronizer reads the product detail page and maps:

- title, slug, SKU, summary
- Kent category path and listing paths
- product images and PDF resources
- description, specifications, resources, publications, and reviews HTML
- WooCommerce option groups and embedded variation data
- variant SKU, attributes, option summary, image URL, and source variation ID

New product IDs are deterministic: `prod_kent__{shop-slug}`.

## Required environment

Audit:

- `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `NEXT_PUBLIC_SANITY_DATASET`

Write mode additionally requires:

- `SANITY_WRITE_TOKEN`
