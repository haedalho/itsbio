# ITS BIO 제품 우선 이관 전략

## 목표

현재 우선순위는 보안·SEO·전체 디자인 완성이 아니라 다음 세 가지다.

1. Kent와 ABM의 실제 상품을 빠짐없이 Sanity에 올린다.
2. 같은 상품이 여러 문서나 여러 카드로 생기지 않게 한다.
3. 빈약한 상품과 구조가 복잡한 상품을 자동으로 구분해 후속 보강 순서를 만든다.

## 가장 중요한 구조 변경

상품의 `브랜드 디자인`과 `상품 표시 구조`를 분리한다.

### 브랜드 디자인

- ABM: 주황 테마, ABM 카테고리와 문서 탭
- Kent: 파란 테마, Kent 카테고리와 옵션 UI

### 상품 표시 구조

- `simple`: 단일 SKU 또는 단일 모델
- `variant-selector`: 색상·크기·모델 등 옵션 선택형
- `model-table`: 한 페이지 안에 여러 Cat.No/SKU가 표로 존재
- `system-config`: 본체·구성품·호환 액세서리를 함께 보여줘야 하는 시스템형
- `document-info`: SKU보다 설명·문서·호환 정보가 중심인 제품
- `unresolved`: 자동 분류가 어려워 사람이 확인해야 하는 제품

브랜드별로 모든 상세 컴포넌트를 복사하지 않는다. 공통 상품 골격 위에 브랜드 테마와 표시 구조별 모듈을 조합한다.

## Listing과 Landing의 데이터 원칙

### Listing

Listing 상품 카드는 반드시 Sanity `product` 문서에서만 생성한다.

- `categoryPath` 또는 `listingPaths`로 product 조회
- 같은 product가 여러 카테고리에 속하면 문서는 하나, listingPaths만 여러 개
- legacy HTML에서 임시 카드를 런타임 생성하지 않음
- 옵션 SKU를 별도 카드로 생성하지 않음

### Landing

Landing의 추천 상품 카드도 상품 데이터를 복사해 저장하지 않는다.

- 가능하면 product reference 또는 canonical product href 사용
- 같은 href는 landing 전체에서 한 번만 표시
- category 카드와 product 카드를 명확히 구분

현재 Kent listing의 `legacy-*` 임시 카드는 제품 census로 실제 skeleton product를 만든 뒤 제거한다.

## 2단계 이관 방식

### 1차: 전체 상품 목록 확보

먼저 모든 원본 상품 URL을 기준으로 최소 상품 문서를 만든다.

필수값:

- brand
- sourceUrl
- sourceKey 또는 source product ID
- title
- slug
- categoryPath/listingPaths
- isActive

가능하면 함께 저장:

- 대표 SKU
- 대표 이미지
- 짧은 원본 요약

이 단계에서는 specs, FAQ, documents가 비어 있어도 상품 문서는 생성한다. 대신 상세 화면에서 빈 탭은 렌더하지 않는다.

### 2차: 상세 보강

전체 상품 문서가 확보된 후 아래 항목을 채운다.

- summary/overview
- gallery
- specifications
- documents/datasheet
- options/variants
- compatibility
- related products
- FAQs/references/reviews

이 순서로 하면 일부 상품 상세가 빈약하더라도 전체 상품 수와 누락 여부를 먼저 확정할 수 있다.

## 중복 방지 규칙

### 상품 문서의 고유 기준

우선순위:

1. `brand + normalized sourceUrl`
2. `brand + sourceProductId`
3. `brand + slug`
4. 단일 상품인 경우 `brand + SKU`

상품명만 같다는 이유로 중복 삭제하지 않는다.

### 옵션형 상품

옵션 SKU를 별도 product 문서로 만들지 않는다.

```text
Product
 ├─ Option group: Size
 ├─ Option group: Model
 └─ Variants
     ├─ SKU A
     ├─ SKU B
     └─ SKU C
```

Variant 고유 기준:

1. `sourceVariationId`
2. `variantId`
3. `SKU/Cat.No + option combination`

### 배열 중복 제거

- 이미지: normalized URL
- 문서: normalized URL
- listingPaths: normalized path
- option group: normalized key
- option value: group key + normalized value

## Upsert 원칙

무작위 새 문서를 계속 생성하지 않는다.

- 기존 sourceUrl 문서가 있으면 patch
- sourceUrl이 없지만 같은 brand+slug가 있으면 검토 후 patch
- 완전히 새 상품만 create
- 가능한 경우 sourceKey 기반 deterministic `_id` 사용
- 수집 결과가 빈 값이면 기존 값을 덮어쓰지 않는다
- 수동으로 수정한 값은 별도 필드 또는 보호 목록으로 유지한다

## 빈약한 상품 처리

상품을 삭제하거나 업로드에서 제외하지 않고 상태로 나눈다.

### Ready

- 기본 식별값 정상
- 카테고리 연결
- SKU/variant/model table 중 하나 존재
- 대표 이미지
- 설명 또는 overview
- 치명적 중복 없음

### Thin

상품은 표시 가능하지만 다음 일부가 부족하다.

- summary
- image
- specs
- documents

### Needs fix

- 옵션 조합 중복
- 잘못된 productType
- options는 있는데 variants 없음
- default variant가 존재하지 않음
- listingPaths 중복

### Skeleton

최소 상품 문서만 있고 상세 정보가 거의 없다.

Skeleton도 전체 제품 확보 단계에서는 유지한다. 상세 페이지에는 다음만 안전하게 표시한다.

- 제품명
- 브랜드
- SKU가 있으면 SKU
- 이미지가 있으면 이미지
- 카테고리
- 문의 CTA

빈 Overview, Specs, Documents 탭은 숨긴다.

## 추천 표시 구조

### Simple

- Gallery
- Title
- SKU
- Summary
- Quote CTA
- Optional tabs

### Variant selector

- Gallery
- Option buttons/select
- 선택된 SKU와 variant image
- Summary
- Quote CTA
- Optional tabs

### Model table

- 대표 이미지와 공통 설명
- 모델/SKU 비교 표
- 모델별 주요 규격
- 모델 선택 후 문의

모델 한 줄마다 별도 product 문서를 만들지 않는다.

### System/configuration

- 시스템 개요
- 기본 구성품
- 선택 액세서리
- 호환 장비
- 구성별 문의 CTA

### Document/info

- 핵심 설명
- 호환성/사용 목적
- Documents 중심
- SKU가 없으면 억지 placeholder를 만들지 않는다

## 제품 이관 작업 순서

1. Kent 원본 상품 URL 전체 목록 확보
2. 기존 Sanity 상품과 sourceUrl 기준 대조
3. 누락 상품 skeleton upsert
4. sourceUrl·slug 실제 중복 정리
5. 상품 표시 구조 자동 추천 보고서 확인
6. variant-selector 제품부터 옵션 정리
7. model-table 제품의 SKU 행을 product 문서 하나로 병합
8. simple 제품 대량 보강
9. system/document 제품 수동 검수
10. census 완료 후 listing의 legacy 임시 카드 fallback 제거
11. Kent 완료 후 같은 방식으로 ABM 정리

## 자동 감사와 census

Kent 상품 전체 목록 dry-run:

```bash
npm run kent:product:census
```

검토 후 skeleton 반영:

```bash
npm run kent:product:census:write
```

상품 품질:

```bash
npm run product:audit
```

Kent만:

```bash
npm run kent:product:audit
```

ABM만:

```bash
npm run abm:product:audit
```

보고서:

```text
.cache/kent-product-census/latest.md
.cache/kent-product-census/latest.json
.cache/product-quality/latest.md
.cache/product-quality/latest.json
```

보고서는 다음을 보여준다.

- 새 skeleton 생성 대상과 기존 문서 patch 대상
- Ready/Thin/Needs fix/Skeleton 개수
- 표시 구조 추천
- 빈약한 필드 빈도
- sourceUrl/slug/SKU/제목 중복 후보
- variant ID/SKU/옵션 조합 중복
- 우선 보강해야 할 상품 목록

## 당장 하지 않을 것

전체 상품 수와 구조가 확정되기 전에는 다음을 대규모로 수정하지 않는다.

- 전 브랜드 상세 디자인 전면 개편
- SEO 전면 작업
- 모든 HTML 구조 재작성
- 페이지별 미세한 색상·간격 조정
- 상품마다 완전히 다른 전용 컴포넌트 생성

단, 제품 이관 자체를 막거나 중복을 증가시키는 문제는 제품 작업과 함께 바로 수정한다.
