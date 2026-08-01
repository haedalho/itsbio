# Kent exact product review checklist

이 체크리스트를 모두 통과하지 못한 제품은 `VERIFIED`로 표시하지 않는다.

## 실제 Kent 페이지

- [ ] 실제 Kent 상세페이지를 직접 확인했다.
- [ ] canonical source URL을 기록했다.
- [ ] 검수 일시와 source page SHA-256을 기록했다.
- [ ] 제목의 대소문자, 구두점, `®`, `™`를 보존했다.
- [ ] 부제목을 정확히 보존했다.
- [ ] Item #을 정확히 보존했다.

## 옵션과 Variant

- [ ] 옵션 그룹 이름과 표시 순서가 같다.
- [ ] 옵션값 문구와 표시 순서가 같다.
- [ ] 각 옵션 조합과 SKU 연결이 정확하다.
- [ ] Variant SKU를 별도 product 문서로 만들지 않았다.
- [ ] 기본 Variant가 실제 페이지와 같다.

## 본문

- [ ] 섹션 제목과 순서가 같다.
- [ ] 목록, 표, FAQ, 리뷰, 자료, 영상의 순서가 같다.
- [ ] 다른 제품의 본문이 섞이지 않았다.
- [ ] 정확한 공식 콘텐츠로 표시하는 본문을 요약하거나 의역하지 않았다.
- [ ] 각 섹션의 전체 표시 데이터 SHA-256이 승인 스냅샷과 같다.
- [ ] 가격, 로그인, 장바구니, 수량, 뉴스레터, 공급사 지원 영역을 제외했다.

## 이미지

- [ ] 공식 갤러리의 이미지 구성과 순서를 확인했다.
- [ ] 이미지와 Variant의 연결을 확인했다.
- [ ] 모든 이미지 파일을 Sanity Assets에 업로드했다.
- [ ] Snapshot의 Asset ID와 SHA-1이 Sanity와 같다.
- [ ] `kentscientific.com`, `wp-content`, `imageUrls`, `galleryImageUrls`가 런타임에 사용되지 않는다.
- [ ] 이미지가 없거나 업로드 실패 시 Kent URL 대신 로컬 placeholder를 사용한다.

## 실행 차단

- [ ] `data/kent-official-source-snapshots/<slug>.json`이 존재한다.
- [ ] `npm run kent:exact:verify -- --slug=<slug>` 결과가 `VERIFIED`다.
- [ ] `npm run kent:exact:verify:strict -- --slug=<slug>`가 종료 코드 0이다.
- [ ] Override의 verification status가 정확히 `VERIFIED`다.
- [ ] `STAGING`, `DRAFT`, 미검증 Override는 화면에 적용되지 않는다.

## 배치 반영

- [ ] 먼저 서로 다른 유형의 제품 3개만 검수했다.
- [ ] 장비형, Variant형, 단순 액세서리를 각각 확인했다.
- [ ] 기존 수동 수정값을 빈 값으로 덮어쓰지 않았다.
- [ ] 자동 삭제, 비활성화, 재활성화, 제목만으로 병합하지 않았다.
- [ ] 세 제품의 실제 화면 검수 후에만 다음 배치로 진행한다.
