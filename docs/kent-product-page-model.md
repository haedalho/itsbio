# Kent 제품 상세페이지 모델

## 핵심 원칙

Kent를 ABM 상세 탭 구조에 맞추지 않는다.

ABM은 `Specifications / Datasheet / Documents / FAQs / References / Reviews`처럼 명확한 탭 데이터가 중심이지만, Kent는 원본 제품 페이지가 긴 세로형 콘텐츠와 옵션형 소상품 페이지로 나뉜다.

따라서 Kent 제품 완성도를 ABM 필드의 존재 여부로 평가하지 않는다.

## Kent 원본의 공통 상단

대부분의 Kent 제품은 상단에 다음 요소가 있다.

- 제품 이미지 또는 gallery
- 제품명
- 한 줄 부제 또는 짧은 소개
- Item # 또는 선택된 variant의 Item #
- 옵션 선택 UI가 있는 경우 옵션
- ITS BIO 견적 문의

가격·로그인·장바구니는 가져오지 않는다.

## Kent 제품 표시 유형

### 1. Equipment Longform

대표 제품:

- SomnoFlo
- CODA Monitor
- PhysioSuite
- SurgiSuite
- RoVent
- RightTemp

표시 방식:

1. 상단 제품 hero
2. 핵심 장점 카드 또는 feature strip
3. 제품 소개 섹션
4. 포함 구성품
5. 사양 또는 비교표가 있으면 표시
6. 제품 영상·리소스가 있으면 표시
7. 활용법·기술 설명
8. 관련 논문 또는 publications가 있으면 표시
9. 보증 정보가 있으면 표시
10. ITS BIO 문의 CTA

모든 섹션은 선택 사항이며 원본 순서를 최대한 유지한다.

### 2. Variant Product

대표 제품:

- Feeding needles
- Cuffs
- Animal holders
- Warming pads
- Masks and circuits

표시 방식:

1. 제품 이미지
2. 제품명
3. 선택된 Item #
4. 옵션 버튼 또는 select
5. 선택 옵션 설명
6. 짧은 제품 설명
7. 존재하는 추가 정보만 세로형으로 표시
8. ITS BIO 문의 CTA

각 옵션 SKU를 별도 product 문서로 만들지 않는다. product 하나와 variants 배열을 사용한다.

### 3. Simple Accessory

대표 제품:

- Surgical instruments
- 단일 cuff/accessory
- 단일 probe 또는 cable

표시 방식:

1. 제품 이미지
2. 제품명
3. Item #
4. 짧은 설명
5. 사용 가능한 사양 또는 규격
6. ITS BIO 문의 CTA

본문이 짧아도 정상 상품으로 본다. ABM 탭이 없다는 이유로 Thin 처리하지 않는다.

### 4. Configurable System

대표 제품:

- 여러 모듈을 조합하는 시스템
- 본체와 옵션 모듈이 결합되는 장비
- 기본 구성과 optional add-ons가 분리된 제품

표시 방식:

1. 본체 hero
2. 구성 선택 또는 모델 선택
3. Base system includes
4. Optional add-ons
5. 호환 모듈/액세서리
6. 기술 설명 또는 비교표
7. 문의 CTA

Kent에서 Compatibility/Accessories라는 고정 ABM 탭을 만들지 않는다. 원본에 `Base system includes`, `Optional add-ons`, 관련 액세서리 링크가 있을 때 해당 섹션을 만든다.

### 5. Regulated / Notice Product

예: 판매·배송 조건이나 라이선스 확인이 필요한 제품.

제품 설명보다 먼저 필요한 안내 문구를 표시하고, 직접 구매 대신 ITS BIO 문의로 연결한다.

## Kent 섹션 데이터 모델

고정된 ABM 필드에 강제로 나누기보다 순서가 있는 섹션 배열을 사용한다.

예시:

```ts
kentSections: [
  { type: "features", title: "What you get", items: [...] },
  { type: "richText", title: "About SomnoFlo", html: "..." },
  { type: "included", title: "Base system includes", items: [...] },
  { type: "specTable", title: "Product specifications", html: "..." },
  { type: "resources", title: "SomnoFlo resources", items: [...] },
  { type: "videos", title: "Product videos", items: [...] },
  { type: "publications", title: "Scientific publications", items: [...] },
  { type: "warranty", title: "Warranty information", html: "..." }
]
```

섹션이 없는 제품은 배열이 짧아도 정상이다.

## 1차 제품 이관 필수값

Kent skeleton 생성 시 필수:

- brand
- sourceUrl
- title
- slug
- categoryPath 또는 listingPaths
- productType
- isActive

가능하면 함께 저장:

- Item # 또는 SKU
- 대표 이미지
- 짧은 원본 소개
- variants
- Kent 표시 유형

긴 본문 섹션은 2차 수집에서 채운다.

## Kent 품질 판정

### Ready

- title, brand, slug, sourceUrl 정상
- category/listing 연결 정상
- 대표 이미지 존재
- Item # 또는 variant 식별 가능
- 표시 유형이 결정됨
- 해당 유형에 필요한 최소 본문 존재

### Thin

- 상품은 정상적으로 식별되고 표시 가능함
- 이미지, Item #, 짧은 설명 중 일부가 부족함

Specs, Documents, FAQ가 없다는 이유만으로 Thin 처리하지 않는다.

### Needs Fix

- sourceUrl 또는 slug 실제 중복
- variant ID 또는 옵션 조합 중복
- 옵션 상품을 여러 product 문서로 분리
- 같은 listing에 동일 상품 반복
- 표시 유형을 잘못 판정

### Skeleton

- title/sourceUrl/category 정도만 확보된 상태
- 전체 제품 확보 단계에서는 유지
- 상세 보강 대기 목록에 포함

## ABM과 Kent의 차이

| 구분 | ABM | Kent |
|---|---|---|
| 기본 본문 | 탭 중심 | 세로형 섹션 중심 |
| 사양 | Specifications 탭 | 있는 제품만 표/섹션 |
| 문서 | Datasheet/Documents 탭 | Resources 또는 다운로드 섹션 |
| FAQ/References | 독립 탭 | 일부 제품의 publications/resources |
| 옵션 | 비교적 제한적 | 많은 액세서리에서 핵심 |
| 장비형 | 탭 안 콘텐츠 | feature, includes, specs, videos, warranty 등 긴 랜딩 |
| 소상품 | 탭이 비면 빈약 | 이미지·Item #·옵션·짧은 설명만으로 정상 가능 |

## 구현 방향

- `KentProductTabs`를 Kent 전체의 기본 틀로 사용하지 않는다.
- Kent는 `KentProductSectionRenderer`가 `kentSections`를 원본 순서대로 렌더한다.
- variant selector는 상단 product hero 영역에서 처리한다.
- 존재하지 않는 섹션은 렌더하지 않는다.
- 원본의 가격, 로그인, 장바구니, newsletter, related shopping carousel은 제외한다.
- 관련 액세서리는 실제 product reference가 확보된 경우에만 내부 링크로 표시한다.
