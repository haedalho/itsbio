# Kent official catalog audit

이 작업은 이전에 합의한 ITS BIO의 **과거 → 현재 → 미래** 규칙을 따른다.

Kent 서버는 자동 요청과 브라우저 자동화 모두 보안 확인·403을 반복해서 발생시켰다. 따라서 다음 방식은 사용하지 않는다.

- Chrome/Playwright 자동화
- CAPTCHA 또는 보안 확인 통과를 전제로 한 수집
- 로그인 세션·쿠키 유지
- 원격 디버깅
- IP·브라우저 지문 변경
- Shop 페이지 대량 자동 순회
- 403 이후 재시도 반복

## 이번 감사의 자료

### 과거 기준

기존 Sanity Kent 문서다.

- 전체 194개 문서
- 일반 제품 176개
- Warranty 18개
- 기존 문서는 자동 삭제·비활성화·재활성화하지 않는다.
- 기존 수동 수정값을 보호한다.

### 공식 2026 기준

`data/kent-official-product-ids-2026.json`에 Kent 2026 공식 목록의 고유 Product ID 590개를 저장한다.

이 590개는 독립 상세페이지 590개를 의미하지 않는다. 다음 항목이 섞여 있다.

- 대표 제품 SKU
- 옵션 SKU
- 액세서리
- 교체 부품
- 소모품
- 전압·크기·색상·포장 단위 Variant
- Ear Tag 번호·색상 조합

### 현재 공개 상태

Kent 서버에 자동 접근하지 않는다. 현재 Shop 노출 여부는 이미 확보된 공식 URL, 검색 색인, 수동 확인 기록, Kent 제공 자료가 있을 때만 별도 증거로 추가한다.

공식 목록에 있다는 이유만으로 자동 공개하지 않고, Shop에 확인되지 않는다는 이유만으로 기존 제품을 삭제하지 않는다.

## 실행

```bash
npm run kent:catalog:audit
```

필요한 환경변수:

```text
NEXT_PUBLIC_SANITY_PROJECT_ID
NEXT_PUBLIC_SANITY_DATASET
```

이 명령은 Kent 웹사이트에 요청하지 않으며 Sanity도 수정하지 않는다.

출력:

```text
.cache/kent-official-catalog-audit/latest.md
.cache/kent-official-catalog-audit/latest.json
```

## 감사 결과 분류

### Primary match

공식 Product ID가 Sanity product의 대표 `sku`, `catNo`, `itemNumber`, `productCode`에 일치한다.

독립 제품 페이지의 대표 품번일 가능성이 높지만 자동 확정하지는 않는다.

### Variant-only match

공식 Product ID가 기존 product 내부의 `variants`에서만 일치한다.

이 항목은 별도 product 문서를 만들지 않고 기존 대표 제품의 옵션으로 유지한다.

### Mixed match

같은 공식 Product ID가 product와 variant 양쪽에 동시에 있다.

구조 중복 가능성이 있으므로 수동 검토한다.

### Conflict

같은 공식 Product ID가 서로 다른 product 문서 두 개 이상에 연결된다.

자동 병합·삭제하지 않고 중복 후보로만 보고한다.

### Unmatched official ID

공식 590개에는 있지만 현재 Sanity의 대표 SKU나 Variant SKU에서 찾지 못한 항목이다.

자동 등록하지 않는다. 다음 중 무엇인지 분류한 뒤 처리한다.

- 신규 독립 제품
- 기존 제품의 누락 Variant
- 액세서리·부품·소모품
- Legacy 또는 특별 주문 품번

### Sanity-only product

기존 Sanity에는 있지만 공식 590개 Product ID와 연결되지 않은 제품이다.

삭제 목록이 아니다. 기존 source URL, 제목, 카테고리, Warranty 여부를 별도로 검토한다.

## 반영 순서

1. `kent:catalog:audit` 실행
2. Primary / Variant / Conflict / Unmatched 숫자 확인
3. Variant-only 항목이 독립 product로 생성되어 있는지 점검
4. Conflict만 우선 수동 정리
5. Unmatched 항목을 제품·Variant·부품으로 분류
6. 수정 계획 JSON 생성
7. 세 제품만 시험 반영
8. 상세페이지와 옵션 작동 확인
9. 승인된 항목만 배치 반영
10. 전체 Kent 품질 감사 재실행

## 고정 보호 규칙

1. 제목만 같다는 이유로 병합·삭제하지 않는다.
2. 대표 SKU만 같다는 이유로 자동 삭제하지 않는다.
3. 동일 원본 상품은 product 문서 하나만 사용한다.
4. 옵션 SKU는 `variants`에 저장한다.
5. 수집값이 빈 경우 기존 값을 덮어쓰지 않는다.
6. 기존 수동 수정값을 기본적으로 보호한다.
7. Warranty는 일반 제품 수와 분리한다.
8. 가격·로그인·장바구니·뉴스레터는 제품 콘텐츠로 가져오지 않는다.
9. Kent는 ABM식 고정 탭이 아니라 원본 순서의 세로형 섹션을 사용한다.
10. 실제 쓰기는 별도 검토된 deterministic plan 없이는 실행하지 않는다.
