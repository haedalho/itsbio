# Kent 작업 시작 체크리스트

## 현재 우선순위

정식 출시 준비보다 먼저 **Kent 전체 상품을 빠짐없이 Sanity에 올리고, 중복과 빈약한 상품을 정리한다.**

작업 순서:

1. Kent 원본 상품 전체 목록 확보
2. 기존 Sanity 상품과 대조
3. 누락 상품 skeleton upsert
4. 실제 중복 정리
5. Kent 원본 기준으로 제품 페이지 유형 분류
6. 옵션·장비형 세로 섹션·단순 액세서리 정보 보강
7. 전체 상품이 올라간 뒤 공통 디자인·보안·SEO 개선

## 가장 중요한 구분

Kent는 ABM의 상세 탭 구조를 사용하지 않는다.

ABM 예시:

- Specifications
- Datasheet / Documents
- FAQs
- References / Reviews

Kent 예시:

- 상단 이미지·제품명·Item #·옵션
- What you get / 핵심 장점
- About product
- Base system includes
- Product specifications가 있는 경우
- Product videos / resources가 있는 경우
- Optional add-ons가 있는 경우
- Scientific publications가 있는 경우
- Warranty information이 있는 경우

Kent 섹션은 제품마다 다르며, 없는 섹션은 정상이다. Specs·Documents·FAQ가 없다고 빈약한 상품으로 판정하지 않는다.

상세 기준은 `docs/kent-product-page-model.md`를 따른다.

## 작업 원칙

1. 공통 Header와 Hero는 유지한다.
2. 같은 원본 상품은 항상 product 문서 하나만 사용한다.
3. 옵션 SKU를 별도 product 문서로 생성하지 않고 variants에 넣는다.
4. 상품명만 같다는 이유로 자동 삭제하지 않는다.
5. `brand + sourceUrl`과 `brand + slug`가 같으면 실제 중복으로 우선 검토한다.
6. 수집 결과가 빈 값이면 기존 값을 덮어쓰지 않는다.
7. 실제 Sanity 쓰기 전에는 dry-run 또는 감사 보고서를 확인한다.
8. 상세 정보가 부족해도 최소 상품 문서는 먼저 확보한다.
9. Kent는 고정 탭 대신 원본 순서의 세로형 섹션을 사용한다.
10. 가격·로그인·장바구니·뉴스레터는 가져오지 않는다.

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

## Kent 상품 상태 분류

### Ready

- title, brand, slug, sourceUrl 정상
- category 또는 listing 연결
- 대표 이미지
- Item # 또는 variant 식별 가능
- Kent 표시 유형 결정
- 해당 유형에 필요한 최소 원본 콘텐츠 존재
- 치명적 중복 없음

### Thin

상품은 표시 가능하지만 이미지, Item #, 옵션 또는 짧은 원본 설명 중 일부가 부족하다.

Kent에 ABM의 Specifications·Documents·FAQ가 없다는 이유로 Thin 처리하지 않는다.

### Needs fix

- 중복 listingPaths
- 중복 variant ID 또는 옵션 조합
- options는 있는데 variants 없음
- 옵션 SKU를 여러 product 문서로 분리함
- productType 불일치
- 잘못된 default variant
- Kent 표시 유형 오판정

### Skeleton

최소 식별값만 있는 상태다. 전체 상품 확보 단계에서는 유지하고, 상세 화면에서는 존재하는 정보만 보여준다.

## Kent 표시 구조

- `kent-equipment-longform`: SomnoFlo·CODA처럼 긴 세로형 장비 페이지
- `kent-configurable-system`: 기본 구성·옵션 구성품이 나뉘는 시스템
- `kent-variant-product`: 커프·니들·패드처럼 옵션 선택이 핵심인 제품
- `kent-simple-accessory`: 수술도구·프로브처럼 짧은 단일 상품
- `kent-regulated`: 구매·배송 조건 안내가 필요한 제품
- `kent-unresolved`: 수동 확인 필요

ABM은 기존 탭형 구조를 별도로 유지한다.

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
- 같은 상품이 여러 카테고리에 포함된 경우
- sitemap에는 없지만 legacy일 수 있는 문서

## Upsert 기준

우선순위:

1. brand + sourceUrl
2. brand + source product ID
3. brand + slug
4. 단순 상품일 때 brand + SKU

기존 문서가 있으면 patch하고, 완전히 새로운 상품만 create한다. 새 Kent 상품은 slug 기반 deterministic `_id`와 `createIfNotExists`를 사용한다.

## 1차 이관 필수값

- brand
- sourceUrl
- title
- slug
- categoryPath 또는 listingPaths
- isActive

가능하면 함께 저장:

- Item # 또는 SKU
- 대표 이미지
- 짧은 원본 소개
- variants
- Kent 표시 유형

긴 세로형 콘텐츠 섹션은 2차 수집에서 채운다.

## 2차 보강 순서

1. 옵션형 상품의 optionGroups/variants
2. 장비형 상품의 원본 섹션 순서 파악
3. 대표 이미지와 gallery
4. 핵심 장점 또는 짧은 제품 소개
5. Base system includes / 구성품
6. 사양·비교표가 있는 제품만 반영
7. resources / videos가 있는 제품만 반영
8. optional add-ons / publications / warranty가 있는 제품만 반영

## 현재 확인된 주의사항

- Kent listing은 현재 Sanity 상품이 없을 때 `legacy-*` 임시 카드를 렌더한다. census로 실제 skeleton product를 만든 뒤 이 fallback을 제거해야 중복을 근본적으로 막을 수 있다.
- 현재 `KentProductTabs`는 ABM식 필드 이름을 받도록 되어 있으므로 Kent 전체의 최종 구조로 사용하면 안 된다.
- Kent는 향후 `kentSections` 같은 순서형 섹션 데이터와 `KentProductSectionRenderer` 방식으로 전환한다.
- `Login to see prices` 등 원본 쇼핑몰 문구는 제품 이관 중 제거한다.
- category migration 캐시는 `.cache/kent-category-v22`를 사용한다. 원본 변경이 확실할 때만 refresh한다.
