# Kent 작업 시작 체크리스트

## 작업 원칙

1. 공통 Header와 Hero는 삭제하거나 Kent 전용 페이지에서 누락시키지 않는다.
2. 작업 순서는 `landing → listing → product`로 고정한다.
3. category 작업 중에는 기존 product 문서를 재이관하거나 덮어쓰지 않는다.
4. 이미 정상인 `/products/kent/anesthesia`는 회귀 확인만 하고 불필요하게 수정하지 않는다.
5. 원본 Kent 링크는 가능한 경우 ITS BIO 내부 category 또는 item route로 바꾼다.
6. resource/publication처럼 category 또는 product로 판정할 수 없는 링크만 legacy fallback으로 보낸다.
7. 실제 Sanity 쓰기 전에 반드시 dry-run 결과를 검토한다.

## 첫 실행

```bash
npm install
npm run kent:preflight
npm run lint
npm run build
npm run kent:category:dry
```

원본 Kent 페이지가 최근 변경됐다고 의심될 때만 캐시를 새로 받는다.

```bash
npm run kent:category:refresh:dry
```

## Sanity 환경 변수

읽기 및 앱 실행:

- `NEXT_PUBLIC_SANITY_PROJECT_ID` 또는 대응하는 project ID 변수
- `NEXT_PUBLIC_SANITY_DATASET` 또는 대응하는 dataset 변수

migration 쓰기:

- `SANITY_API_TOKEN`, `SANITY_WRITE_TOKEN`, `SANITY_TOKEN` 중 하나

환경 변수와 토큰은 저장소에 커밋하지 않는다.

## Category 검수 순서

각 경로에서 아래 항목을 확인한다.

- Hero 존재
- Breadcrumb 정상
- Sidebar 계층 및 중복 여부
- `pageType`이 landing/listing 중 올바른 값인지
- landing의 category/product/text block 순서
- listing 상품 수가 0건이 아닌지
- 카드 이미지가 로고·배너·프로모션 이미지가 아닌지
- 카드 링크가 `/products/kent/...` 내부 경로인지
- 모바일에서 sidebar와 카드가 깨지지 않는지

우선 검수 경로:

- `/products/kent/anesthesia`
- `/products/kent/laboratory-animal-handling`
- `/products/kent/noninvasive-blood-pressure`
- `/products/kent/physiological-monitoring`
- `/products/kent/surgery`
- `/products/kent/warming`

## Product 착수 전 조건

다음 조건이 충족되기 전에는 전체 product migration을 시작하지 않는다.

- category tree와 sidebar 경로가 확정됨
- listing별 상품 링크가 안정적으로 수집됨
- 중복 및 0건 listing 목록이 정리됨
- Sanity product 스키마의 `simple`/`variant` 구조가 실제 데이터와 맞음
- 대표 이미지, gallery, docs, specifications의 저장 위치가 확정됨

## 현재 확인된 주의사항

- `components/products/KentProductDetailClient.tsx`에 원본 쇼핑몰 문구인 `Login to see prices`가 직접 출력되고 있다. Product 본작업 전에 ITS BIO 문의 UI만 남도록 제거해야 한다.
- category migration은 `.cache/kent-category-v22`를 사용한다. `--refresh`는 모든 페이지와 이미지 요청을 다시 수행할 수 있으므로 기본 명령으로 사용하지 않는다.
- 최근 원본 Kent HTML 변경이 커밋에 포함된 적이 있으므로 selector가 깨졌는지 dry-run 결과로 먼저 확인한다.
