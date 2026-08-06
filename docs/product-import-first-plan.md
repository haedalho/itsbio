# ITS BIO 제품 우선 이관 전략

## 목표

현재 우선순위는 보안·SEO·전체 디자인 완성이 아니다.

1. Kent와 ABM의 실제 상품을 빠짐없이 Sanity에 올린다.
2. 같은 상품이 여러 문서나 여러 카드로 생기지 않게 한다.
3. 브랜드별 원본 제품 페이지 구조를 보존한다.
4. 빈약한 상품과 구조가 복잡한 상품을 자동으로 구분해 후속 보강 순서를 만든다.

## 가장 중요한 수정

ABM과 Kent를 같은 상세 콘텐츠 틀로 보지 않는다.

### ABM

ABM은 탭형 데이터가 중심이다.

- Specifications
- Datasheet
- Documents
- FAQs
- References
- Reviews

### Kent

Kent는 제품에 따라 길이와 구성이 다른 세로형 페이지다.

- 제품 이미지·제품명·Item #·옵션
- 핵심 장점
- About product
- Base system includes
- Product specifications가 있는 경우
- Resources / product videos가 있는 경우
- Optional add-ons가 있는 경우
- Scientific publications가 있는 경우
- Warranty information이 있는 경우

Kent에서 위 섹션이 모두 존재해야 하는 것은 아니다. 단순 액세서리는 이미지·Item #·옵션·짧은 설명만으로도 정상 상품이다.

Kent 상세 모델은 `docs/kent-product-page-model.md`를 따른다.

## Listing과 Landing의 데이터 원칙

### Listing

Listing 상품 카드는 반드시 Sanity `product` 문서에서만 생성한다.

- `categoryPath` 또는 `listingPaths`로 product 조회
- 같은 product가 여러 카테고리에 속하면 문서는 하나, listingPaths만 여러 개
- legacy HTML에서 임시 카드를 런타임 생성하지 않음
- 옵션 SKU를 별도 카드로 생성하지 않음

### Landing

Landing의 추천 상품 카드도 상품 데이터를 복사해 저장하지 않는다.

- product reference 또는 canonical product href 사용
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

- 대표 SKU 또는 Item #
- 대표 이미지
- 짧은 원본 소개
- variants
- 브랜드별 표시 유형

이 단계에서는 상세 섹션이 비어 있어도 상품 문서를 생성한다.

### 2차: 브랜드별 상세 보강

#### Kent

1. 옵션형 상품의 optionGroups/variants
2. 장비형 제품의 원본 섹션 순서
3. 이미지/gallery
4. 핵심 장점 또는 짧은 소개
5. Base system includes
6. 사양·비교표가 존재할 때만 반영
7. resources/videos가 존재할 때만 반영
8. optional add-ons/publications/warranty가 존재할 때만 반영

#### ABM

1. Summary/Overview
2. Specifications
3. Datasheet/Documents
4. FAQs
5. References/Reviews
6. 이미지와 관련 상품

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

- 기존 sourceUrl 문서가 있으면 patch
- sourceUrl이 없지만 같은 brand+slug가 있으면 검토 후 patch
- 완전히 새 상품만 create
- 가능한 경우 sourceKey 기반 deterministic `_id` 사용
- 수집 결과가 빈 값이면 기존 값을 덮어쓰지 않음
- 수동 수정한 값은 보호

## Kent 상품 상태

### Ready

- 기본 식별값 정상
- 카테고리 연결
- Item # 또는 variant 식별 가능
- 대표 이미지
- Kent 표시 유형 결정
- 해당 유형의 최소 원본 콘텐츠 존재
- 치명적 중복 없음

### Thin

상품은 표시 가능하지만 이미지, Item #, 옵션, 짧은 설명 중 일부가 부족하다.

Kent에 ABM의 Specifications·Documents·FAQ가 없다는 이유로 Thin 처리하지 않는다.

### Needs fix

- 옵션 조합 중복
- 잘못된 productType
- options는 있는데 variants 없음
- default variant가 존재하지 않음
- listingPaths 중복
- 옵션별 SKU를 여러 product 문서로 분리
- 표시 유형 오판정

### Skeleton

최소 상품 문서만 있고 상세 정보가 거의 없다.

Skeleton 상세 페이지에는 존재하는 정보만 보여준다.

- 제품명
- 브랜드
- Item #가 있으면 Item #
- 이미지가 있으면 이미지
- 카테고리
- 문의 CTA

ABM식 빈 탭을 만들지 않는다.

## Kent 표시 구조

### Equipment Longform

SomnoFlo·CODA·PhysioSuite 같은 장비형 제품.

- 제품 hero
- 핵심 장점
- 원본 순서의 세로형 섹션
- 구성품
- 사양/영상/리소스/논문/보증은 존재할 때만 표시

### Variant Product

커프·니들·패드·마스크 등 옵션 선택형 제품.

- gallery
- 옵션 선택
- 선택된 Item #
- 짧은 설명
- 존재하는 추가 정보
- 문의 CTA

### Simple Accessory

수술 도구·프로브·케이블 등 짧은 단일 상품.

- 이미지
- 제품명
- Item #
- 짧은 설명/규격
- 문의 CTA

본문이 짧다고 비정상으로 보지 않는다.

### Configurable System

본체, 기본 구성, optional add-ons가 나뉘는 시스템.

- 기본 시스템
- 포함 구성품
- 선택 구성품
- 호환 제품
- 문의 CTA

Compatibility/Accessories라는 고정 ABM 탭을 만들지 않는다.

## 제품 이관 작업 순서

1. Kent 원본 상품 URL 전체 목록 확보
2. 기존 Sanity 상품과 sourceUrl 기준 대조
3. 누락 상품 skeleton upsert
4. sourceUrl·slug 실제 중복 정리
5. Kent 표시 유형 자동 추천 보고서 확인
6. variant 제품 옵션 정리
7. equipment longform 제품 섹션 수집
8. simple accessory 대량 보강
9. census 완료 후 listing의 legacy 임시 카드 fallback 제거
10. Kent 완료 후 ABM 탭 데이터 정리

## 자동 감사와 census

Kent 상품 전체 목록 dry-run:

```bash
npm run kent:product:census
```

검토 후 skeleton 반영:

```bash
npm run kent:product:census:write
```

Kent 품질:

```bash
npm run kent:product:audit
```

전체:

```bash
npm run product:audit
```

보고서:

```text
.cache/kent-product-census/latest.md
.cache/kent-product-census/latest.json
.cache/product-quality/latest.md
.cache/product-quality/latest.json
```

Kent 감사에서는 ABM 탭 필드의 부재를 오류로 판정하지 않는다.

## 당장 하지 않을 것

전체 상품 수와 구조가 확정되기 전에는 다음을 대규모로 수정하지 않는다.

- 전 브랜드 상세 디자인 전면 개편
- SEO 전면 작업
- 모든 HTML 구조 재작성
- 페이지별 미세한 색상·간격 조정

단, 제품 이관 자체를 막거나 중복을 증가시키는 문제와 Kent/ABM 구조 혼용은 바로 수정한다.
