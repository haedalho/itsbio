# ITS BIO 정식 출시 준비 기준

이 문서는 현재 ITS BIO 저장소를 실제 고객이 사용하는 운영 사이트로 공개하기 전에 충족해야 할 기준을 정리한다.

## 출시 판정

현재 상태는 `개발 및 데이터 이관 단계`다. 아래 P0 항목이 남아 있는 동안에는 정식 도메인 공개와 검색엔진 색인을 진행하지 않는다.

## P0 — 출시 차단

### 1. 외부 HTML 보안

- ABM/Kent 원본 HTML은 저장 전과 렌더 전 모두 allowlist sanitizer를 통과한다.
- `script`, `iframe`, `form`만 지우는 방식에 의존하지 않는다.
- 모든 `on*` 이벤트 속성, `javascript:` URL, 위험한 `data:` URL, `object`, `embed`, 실행 가능한 SVG를 차단한다.
- 정화 실패 시 원문 HTML을 fallback으로 표시하지 않는다.

### 2. 공개 요청의 Sanity 쓰기 제거

- 상품 페이지 방문과 검색 요청은 Sanity 문서를 생성하거나 수정하지 않는다.
- ABM/Kent 수집과 enrich는 관리자용 스크립트에서만 실행한다.
- 운영 웹앱에는 가능한 한 Sanity 읽기 권한만 둔다.
- write token은 별도 작업 환경에서 최소 권한으로 사용한다.

### 3. 견적 API 보호

- 서버 스키마 검증: 이메일, 길이, 필수 항목, 허용 문자와 최대 payload 크기.
- honeypot 또는 Turnstile 등 봇 방지.
- `/api/quote`에 Vercel WAF rate limit 적용.
- 사용자가 보낸 값을 그대로 내부 오류나 헤더에 노출하지 않는다.
- 운영 도메인의 SPF/DKIM 인증 발신 주소 사용.
- 성공/실패 로그와 문의 식별번호를 남긴다.

### 4. 개인정보 및 법적 페이지

- 개인정보 처리방침 페이지.
- 문의 폼의 개인정보 수집·이용 동의: 목적, 항목, 보유기간, 거부권 안내.
- 이용약관 및 회사·저작권·상표 고지.
- Vercel, Sanity, Resend, Google Maps 사용에 따른 처리위탁·국외 이전 여부 검토.

### 5. 상품 모델과 라우트 통일

- canonical 상세 경로: `/products/{brand}/item/{slug}`.
- `brand`는 Sanity reference를 기준으로 사용하며 `abm`, `kent` key를 통일한다.
- 상품 목록 쿼리는 현재 product schema의 `summary`, `categoryPath`, `images`, `docs`와 맞춘다.
- 브랜드 없는 `/products/{slug}` 링크를 제거한다.
- 중복 path, slug, sourceUrl은 0개여야 한다.

### 6. 프레임워크와 헤더

- Next.js 보안 패치 버전 이상으로 고정하고 lockfile을 갱신한다.
- CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`를 설정한다.
- Google Maps iframe만 필요한 `frame-src`를 제한적으로 허용한다.

## P1 — 정식 공개 최소 요건

### SEO

- `metadataBase`, title template, 설명, canonical, Open Graph와 아이콘.
- `robots.ts`, `sitemap.ts`.
- 상품별 `generateMetadata`와 Product JSON-LD.
- 카테고리·상품 breadcrumb structured data.
- 검색/필터 URL은 canonical 또는 noindex 처리.
- slug 변경 시 301 redirect와 alias 관리.

### 데이터 품질

- `npm run catalog:audit` 결과에서 hard duplicate 0개.
- Kent sitemap과 비교한 누락을 검토하고 의도된 제외 항목을 기록한다.
- 상품별 필수값: title, brand, slug, category, sourceUrl, 대표 이미지, 문의 가능 상태.
- 옵션형 상품은 variant ID와 SKU 조합이 고유해야 한다.
- discontinued/legacy 상품은 삭제 대신 상태와 대체 상품을 관리한다.
- supplier 문서·이미지의 사용 권한과 최신성을 확인한다.

### 콘텐츠

- 샘플 공지, 가상 프로모션, Partner 1 같은 placeholder 제거.
- Kent의 `Login to see prices`, 장바구니·로그인·뉴스레터 문구 제거.
- 실제 공급사 원본에 없는 설명·스펙·가격표는 생성하지 않는다.
- 회사 주소, 영문 회사명, 전화번호 표기를 모든 페이지에서 통일한다.
- 연구용 제품에 필요한 Research Use Only 등 공급사 고지를 유지한다.

### 성능

- 공개 Sanity 읽기는 CDN/ISR을 사용하고 모든 페이지의 `force-dynamic`, `no-store` 사용을 재검토한다.
- Sanity webhook 또는 revalidation tag로 변경 시에만 갱신한다.
- 외부 ABM/Kent 이미지 hotlink를 줄이고 Sanity asset으로 관리한다.
- 이미지 크기·alt·lazy loading을 검수한다.
- Core Web Vitals를 모바일과 데스크톱에서 측정한다.

### 접근성

- 폼에 placeholder뿐 아니라 실제 label을 제공한다.
- 오류·성공 메시지에 `aria-live`를 적용한다.
- 모바일 메뉴 focus trap, focus 복원, 키보드 탐색을 구현한다.
- skip link, heading 순서, 명도 대비, 버튼 target size를 점검한다.

### 운영

- dev/preview/production 환경변수와 Sanity dataset을 분리한다.
- PR preview → 검수 → main → production 순서로만 배포한다.
- production domain, canonical domain, HTTPS와 리디렉션을 고정한다.
- Sanity dataset 백업 또는 정기 export와 복구 절차를 준비한다.
- 404/500 페이지, 오류 로깅, 견적 API 실패 알림을 준비한다.

## 자동 검사 명령

개발 서버:

```bash
npm run dev
```

다른 터미널에서:

```bash
npm run production:audit
npm run catalog:audit
```

배포 차단 검사:

```bash
npm run production:audit:strict
npm run catalog:audit:strict
npm run lint
npm run build
```

## 권장 작업 순서

1. HTML sanitizer와 공개 Sanity write 제거.
2. 견적 API·개인정보 처리방침·동의 흐름 완성.
3. `/products` 쿼리와 canonical route 통일.
4. Next.js 업데이트와 보안 헤더 적용.
5. Kent landing → listing → product 이관 및 감사.
6. ABM 중복과 기존 상세 데이터 정리.
7. SEO, 성능, 접근성, 콘텐츠와 링크 전체 QA.
8. preview 검수 후 정식 도메인 공개.
