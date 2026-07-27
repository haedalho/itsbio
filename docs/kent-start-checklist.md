# Kent 작업 시작 체크리스트

## 작업 원칙

1. 공통 Header와 Hero는 삭제하거나 Kent 전용 페이지에서 누락시키지 않는다.
2. 작업 순서는 `landing → listing → product`로 고정한다.
3. category 작업 중에는 기존 product 문서를 재이관하거나 덮어쓰지 않는다.
4. 이미 정상인 `/products/kent/anesthesia`는 회귀 확인만 하고 불필요하게 수정하지 않는다.
5. 원본 Kent 링크는 가능한 경우 ITS BIO 내부 category 또는 item route로 바꾼다.
6. resource/publication처럼 category 또는 product로 판정할 수 없는 링크만 legacy fallback으로 보낸다.
7. 실제 Sanity 쓰기 전에 반드시 dry-run 결과를 검토한다.
8. Kent와 ABM 모두 category path, product slug, source URL, 카드 링크가 중복되면 안 된다.
9. 보안·개인정보·라우트 관련 P0 항목이 남은 상태에서는 정식 배포하지 않는다.

## 첫 실행

세팅은 완료되어 있으므로 개발 서버부터 시작한다.

```bash
npm run dev
```

다른 터미널에서 현재 데이터와 출시 차단 항목을 점검한다.

```bash
npm run production:audit
npm run catalog:audit
```

결과 파일:

```text
.cache/content-audit/latest.md
.cache/content-audit/latest.json
```

Kent 원본과 Sanity만 비교하려면:

```bash
npm run kent:audit
```

ABM 내부 중복만 확인하려면:

```bash
npm run abm:audit
```

실제 배포 전 차단 검사:

```bash
npm run production:audit:strict
npm run catalog:audit:strict
npm run lint
npm run build
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

환경 변수와 토큰은 저장소에 커밋하지 않는다. 운영 웹 요청에서는 write token을 사용하지 않고 migration/admin 작업에만 사용한다.

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

## 중복 판정 기준

### 즉시 정리 대상

- 동일 브랜드의 category `path` 중복
- 동일 브랜드의 product `slug` 중복
- 동일 원본 `sourceUrl`을 공유하는 여러 문서
- 한 category의 content block에서 같은 카드 링크 반복
- 한 product의 `listingPaths` 내부 동일 경로 반복

### 자동 삭제 금지·검토 대상

- 동일 상품명
- 동일 SKU
- Kent sitemap에는 없지만 Sanity에는 존재하는 legacy 문서
- 옵션형 상품이 variant별로 동일한 기본 상품명을 사용하는 경우

제목 또는 SKU가 같다는 이유만으로 자동 삭제하지 않는다. 옵션 구조와 source URL을 먼저 확인한다.

## Kent 원본 비교

`npm run kent:audit`는 Kent WordPress의 product/category sitemap과 Sanity를 비교해 다음을 보고한다.

- 원본에는 있지만 Sanity에 없는 category
- 원본에는 있지만 Sanity에 없는 product
- Sanity에만 존재하는 category/product
- 저장된 path 또는 slug와 source URL의 경로 불일치

`Sanity only` 항목은 sitemap 제외나 legacy 페이지일 수 있으므로 바로 삭제하지 않는다.

## Product 착수 전 조건

다음 조건이 충족되기 전에는 전체 product migration을 시작하지 않는다.

- category tree와 sidebar 경로가 확정됨
- listing별 상품 링크가 안정적으로 수집됨
- 중복 및 0건 listing 목록이 정리됨
- Sanity product 스키마의 `simple`/`variant` 구조가 실제 데이터와 맞음
- 대표 이미지, gallery, docs, specifications의 저장 위치가 확정됨
- `/products/{brand}/item/{slug}` canonical route가 확정됨

## 현재 확인된 주의사항

- `components/products/KentProductDetailClient.tsx`에 원본 쇼핑몰 문구인 `Login to see prices`가 직접 출력되고 있다. Product 본작업 전에 ITS BIO 문의 UI만 남도록 제거해야 한다.
- category migration은 `.cache/kent-category-v22`를 사용한다. `--refresh`는 모든 페이지와 이미지 요청을 다시 수행할 수 있으므로 기본 명령으로 사용하지 않는다.
- 최근 원본 Kent HTML 변경이 커밋에 포함된 적이 있으므로 selector가 깨졌는지 dry-run 결과로 먼저 확인한다.
- 공개 검색·상품 페이지가 Sanity write token을 사용하는 현재 구조는 정식 배포 전에 관리자 작업으로 분리해야 한다.
- 전체 출시 기준은 `docs/production-readiness.md`를 따른다.
