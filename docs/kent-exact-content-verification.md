# Kent exact content verification

## Why this exists

The previous verifier could use approximate token similarity and partial image overlap. That can detect obvious defects, but it cannot prove that an ITS BIO product page is identical to the reviewed Kent source.

The approved verifier is now:

```bash
npm run kent:exact:verify
npm run kent:exact:verify:strict
```

It makes no Kent web requests and performs no Sanity writes.

## VERIFIED means all checks passed

A product is `VERIFIED` only when an approved source snapshot exists and all of the following match:

1. exact product title
2. exact subtitle
3. exact Item #
4. exact canonical Kent source URL
5. option group labels and order
6. option value labels and order
7. Variant order, IDs, SKUs and option associations
8. section title, type and order
9. SHA-256 of every section's complete rendered data
10. gallery image order
11. Sanity image Asset IDs and SHA-1 fingerprints
12. no Kent-hosted image URL remains in active product, Variant or section media fields

## Statuses

### VERIFIED

Every exact comparison passes.

### NEEDS_FIX

A valid source snapshot exists, but current Sanity data differs.

### BLOCKED

Verification evidence is missing or invalid, the Sanity product is missing, duplicate snapshots exist, or the official source snapshot is incomplete.

No snapshot never means approved.

## Source review workflow

1. Open and review the actual Kent product page.
2. Record the exact short identification fields and visible ordering.
3. Preserve approved full content in the controlled product record.
4. Calculate the source-page and section fingerprints.
5. Upload approved image bytes to Sanity.
6. Record Sanity Asset IDs and SHA-1 values.
7. Add the source snapshot JSON.
8. Run strict verification for that product.
9. Mark an override `VERIFIED` only after strict verification succeeds.

Unverified overrides are filtered out before rendering.

## Safety

- No approximate similarity can produce `VERIFIED`.
- No live Kent fetch or browser automation is used by the exact verifier.
- No Kent image is requested by the ITS BIO runtime.
- No Sanity write occurs during verification.
- No product is automatically deleted, merged, activated or deactivated.
