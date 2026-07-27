# Kent 작업 시작 체크리스트

## 현재 우선순위

정식 출시 준비보다 먼저 **Kent 전체 상품을 빠짐없이 Sanity에 올리고, 중복과 빈약한 상품을 정리한다.**

작업 순서:

1. Kent 원본 상품 전체 목록 확보
2. 기존 Sanity 상품과 대조
3. 누락 상품 skeleton upsert
4. 실제 중복 정리
5. 상품 구조 분류
6. 옵션·모델표·상세 정보 보강
7. 전체 상품이 올라간 뒤 디자인·보안·SEO 개선

## 작업 원칙

1. 공통 Header와 Hero는 유지한다.
2. 같은 원본 상품은 항상 product 문서 하나만 사용한다.
3. 옵션 SKU를 별도 product 문서로 생성하지 않고 variants에 넣는다.
4. 상품명만 같다는 이유로 자동 삭제하지 않는다.
5. `brand + sourceUrl`과 `brand + slug`가 같으면 실제 중복으로 우선 검토한다.
6. 수집 결과가 빈 값이면 기존 값을 덮어쓰지 않는다.
7. 실제 Sanity 쓰기 전에는 dry-run 또는 감사 보고서를 확인한다.
8. 상세 정보가 부족해도 최소 상품 문서는 먼저 확보한다.
9. 빈 Overview·Specs·Documents 탭은 렌더하지 않는다.

## 첫 실행

```bash
npm run dev
```

다른 터미널에서 먼저 상품 전체 목록을 대조한다.

```bash
npm run kent:product:census
```

보고서:

```text
.cache/kent-product-census/latest.md
.cache/kent-product-census/latest.json
```

보고서에서 create/patch/duplicate 후보를 검토한 뒤에만 실제 skeleton 상품을 반영한다.

```bash
npm run kent:product:census:write
```

반영 후 품질과 중복을 다시 확인한다.

```bash
npm run kent:audit
npm run kent:product:audit
```

추가 보고서:

```text
.cache/content-audit/latest.md
.cache/content-audit/latest.json
.cache/product-quality/latest.md
.cache/product-quality/latest.json
```

전체 Kent·ABM 상품 품질을 함께 확인하려면:

```bash
npm run product:audit
```

## 상품 상태 분류

### Ready

- title, brand, slug, sourceUrl 정상
- category 또는 listing 연결
- SKU, variant 또는 모델표 중 하나 존재
- 대표 이미지
- 설명 또는 overview
- 치명적 중복 없음

### Thin

상품은 표시 가능하지만 summary, image, specs, documents 중 일부가 부족하다.

### Needs fix

- 중복 listingPaths
- 중복 variant ID 또는 옵션 조합
- options는 있는데 variants 없음
- productType 불일치
- 잘못된 default variant

### Skeleton

최소 식별값만 있는 상태다. 전체 상품 확보 단계에서는 유지하고, 상세 화면에서는 존재하는 정보만 보여준다.

## 표시 구조 분류

브랜드 디자인과 상품 구조를 분리한다.

- `simple`: 단일 SKU/모델
- `variant-selector`: 옵션 선택형
- `model-table`: 여러 Cat.No/SKU가 표로 존재
- `system-config`: 본체·구성품·액세서리·호환성 중심
- `document-info`: 문서와 설명 중심
- `unresolved`: 수동 확인 필요

ABM/Kent라는 이유만으로 상세 컴포넌트를 완전히 나누지 않는다. 브랜드 테마 위에 상품 구조별 모듈을 조합한다.

## 중복 판정 기준

### 즉시 정리 대상

- 동일 브랜드 + 동일 normalized sourceUrl
- 동일 브랜드 + 동일 slug
- 동일 product 내부 listingPaths 반복
- 동일 variant ID 반복
- 동일 옵션 조합 반복
- 동일 category block에서 같은 상품 링크 반복

### 자동 삭제 금지

- 제목만 동일
- 대표 SKU만 동일
- 옵션형 상품의 variant SKU
- sitemap에는 없지만 legacy일 수 있는 문서

## Upsert 기준

우선순위:

1. brand + sourceUrl
2. brand + source product ID
3. brand + slug
4. simple 상품일 때 brand + SKU

기존 문서가 있으면 patch하고, 완전히 새로운 상품만 create한다. 새 Kent 상품은 slug 기반 deterministic `_id`와 `createIfNotExists`를 사용한다.

## 1차 이관 필수값

- brand
- sourceUrl
- title
- slug
- categoryPath 또는 listingPaths
- isActive

가능하면 함께 저장:

- SKU
- 대표 이미지
- 짧은 summary

Specs·FAQ·Documents가 비어 있어도 1차 상품 문서는 생성한다.

## 2차 보강 순서

1. 옵션형 상품의 optionGroups/variants
2. 모델표 상품의 여러 SKU를 product 하나로 병합
3. 대표 이미지와 gallery
4. summary/overview
5. specifications
6. datasheet/documents
7. compatibility/related products
8. FAQs/references/reviews

## 현재 확인된 주의사항

- Kent listing은 현재 Sanity 상품이 없을 때 `legacy-*` 임시 카드를 렌더한다. census로 실제 skeleton product를 만든 뒤 이 fallback을 제거해야 중복을 근본적으로 막을 수 있다.
- 현재 product schema의 `productType`은 simple/variant만 구분한다. 실제 화면 구조는 model-table, system-config, document-info까지 별도로 판단해야 한다.
- `Login to see prices` 등 원본 쇼핑몰 문구는 제품 이관 중 보이면 제거하되, 전체 디자인 전면 수정은 상품 업로드 후 진행한다.
- category migration 캐시는 `.cache/kent-category-v22`를 사용한다. 원본 변경이 확실할 때만 refresh한다.
- 전체 제품 우선 전략은 `docs/product-import-first-plan.md`를 따른다.
- 정식 출시 전 최종 기준은 `docs/production-readiness.md`를 따른다.
