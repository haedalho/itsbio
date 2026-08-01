# Kent current-state browser audit and staged sync

이 문서는 ITS BIO의 **과거 → 현재 → 미래** 데이터 원칙을 따른다.

Kent Shop은 전체 Kent 카탈로그의 유일한 정답이 아니다. 이 작업에서 각 자료의 역할은 다음처럼 분리한다.

- **과거 기준**: 기존 Sanity Kent 문서. 보존 대상이며 Shop에 없다는 이유로 삭제·비활성화하지 않는다.
- **현재 기준**: 실제 Chrome으로 확인한 Kent Shop 목록과 제품 상세페이지. 현재 노출과 원본 상세 콘텐츠를 검증하는 자료다.
- **공식 목록 후보**: `Kent Scientific 2026(1).xlsx`의 All Items 590개. 전체 재고 대조 기준이지만 자동 공개·덮어쓰기 허용 목록은 아니다.
- **미래 반영**: 감사 보고서 → 3개 시험 upsert → 누락 skeleton → 상세 보강 → 전체 감사 순서로만 진행한다.

Kent blocks ordinary scripted Shop requests with HTTP 403. This workflow therefore uses the same browser-backed method used in the earlier Kent preflight work.

- A visible local Google Chrome session opens the live Kent Shop.
- If Kent shows a security check, complete it once in the opened browser and return to the terminal.
- The browser session follows Shop pagination and opens every product detail page.
- Shop pages and product HTML are saved under `.cache/kent-shop/`.
- Audit and sync read only those verified browser snapshots; they do not crawl Kent with ordinary Node `fetch`.

## 보호 규칙

1. 기존 Sanity 문서는 자동 삭제·비활성화·재활성화하지 않는다.
2. Shop에 없는 문서는 `Sanity-only / legacy review`로 기록하고 유지한다.
3. 제목이나 대표 SKU만 같다는 이유로 합치거나 삭제하지 않는다.
4. 동일 상품 판정 우선순위는 `brand + normalized sourceUrl`, `brand + sourceProductId`, `brand + slug`, 단순 상품의 `brand + SKU`다.
5. 같은 원본 상품은 product 문서 하나만 사용하고 옵션 SKU는 `variants`에 둔다.
6. 새 수집 값이 비어 있으면 기존 값을 덮어쓰지 않는다.
7. 기존 수동 수정값은 기본적으로 보호하며, 현재 Shop 원본이 검증되어도 명시적 갱신 모드 전에는 덮어쓰지 않는다.
8. Kent는 ABM 탭 구조가 아니라 원본 순서의 세로형 `kentSections`를 사용한다.
9. 가격, 로그인, 장바구니, 뉴스레터 문구는 가져오지 않는다.
10. 실제 Sanity 쓰기 전에는 항상 완전한 browser inventory와 감사 보고서를 확인한다.

## 상태 판정

- **Official + Shop + valid detail**: 현재 검증 제품
- **Official only**: skeleton 또는 수동 확인 후보
- **Shop only**: 공식 목록 누락 또는 신규 제품 검토 후보
- **Sanity only**: legacy 보존·검토 대상, 자동 삭제 금지
- **Warranty document**: 일반 제품 수에서 분리
- **Unresolved/blocked**: 쓰기 금지

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

## 3. Audit current Shop against Sanity

```bash
npm run kent:shop:audit
```

이 감사는 **현재 Shop 노출 상태**만 비교한다. 전체 공식 제품 수는 별도의 590개 공식 목록 대조와 함께 판단해야 한다.

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

`notInShop`은 삭제 목록이 아니라 보존·수동 검토 목록이다.

## 4. Test only three missing current-Shop products

```bash
npm run kent:shop:sync -- --limit 3
```

Without `--refreshExisting`, write mode creates only verified current-Shop products missing from Sanity. Existing products are not overwritten.

## 5. Import verified missing current-Shop products

```bash
npm run kent:shop:sync
```

이 단계는 공식 590개 전체 이관을 의미하지 않는다. Shop에서 현재 검증된 누락 상품만 추가한다.

## 6. Existing product enrichment

기존 상품 갱신은 빈 값 보호와 수동 수정 보호가 확인된 후에만 별도 보강 단계에서 진행한다. 대규모 `--refreshExisting` 실행은 기본 절차가 아니다.

## Product mapping

The synchronizer reads the browser-saved product HTML and maps title, slug, SKU, summary, category paths, descriptions, resources, publications, PDF documents, WooCommerce option groups, variants, variant SKUs, and variant images.

Kent long-form content must ultimately be stored and rendered as ordered vertical `kentSections`; absence of ABM-style Specifications, Documents, FAQ, References, or Reviews tabs is not an error.

Product and variant images are uploaded to Sanity so the existing Kent gallery receives Sanity CDN URLs.

New document IDs are deterministic: `prod_kent__{shop-slug}`.

## Required environment

Audit requires:

- `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `NEXT_PUBLIC_SANITY_DATASET`

Write mode additionally requires:

- `SANITY_WRITE_TOKEN`
