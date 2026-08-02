# Kent official source snapshots

이 폴더의 JSON은 실제 Kent 상세페이지를 제품별로 직접 검수한 뒤 만드는 **승인 증거 파일**이다.

제품 본문 전체를 Git에 복사하지 않는다. 짧은 식별 필드는 정확한 문자열로 저장하고, 상단 본문과 각 섹션의 전체 표시 데이터는 SHA-256으로 검증한다.

스냅샷이 없거나 한 필드라도 일치하지 않으면 해당 제품은 `VERIFIED`가 될 수 없다.

## 파일 이름

```text
<product-slug>.json
```

## 형식

```json
{
  "schemaVersion": 2,
  "slug": "somnoflo-o2care",
  "sourceUrl": "https://www.kentscientific.com/products/somnoflo-o2care/",
  "checkedAt": "2026-08-03T00:00:00+09:00",
  "sourcePageSha256": "64자리 소문자 SHA-256",
  "content": {
    "title": "SomnoFlo® O2Care",
    "subtitle": "Blend air and O₂",
    "itemNumber": "SF-06",
    "introBodySha256": "상단 제품 본문 전체 정규화 텍스트의 SHA-256",
    "optionGroups": [],
    "variants": [],
    "sections": [
      {
        "order": 1,
        "title": "공식 페이지의 정확한 섹션 제목",
        "type": "공식 구조에 대응하는 섹션 유형",
        "contentSha256": "해당 섹션 전체 표시 데이터의 SHA-256"
      }
    ],
    "heroImage": {
      "sanityAssetId": "image-...-1200x1200-png",
      "sha1": "40자리 Sanity Asset SHA-1",
      "sourceImageSha256": "검수한 공식 대표 이미지 원본 파일의 SHA-256",
      "alt": "SomnoFlo® O2Care"
    }
  }
}
```

## 정확한 콘텐츠 규칙

1. 실제 Kent 상세페이지를 직접 확인한다.
2. 제목, 부제목, Item #의 철자·대소문자·기호·상표기호를 보존한다.
3. 상단 제품 본문은 문장을 요약하거나 재작성하지 않는다.
4. 문단 순서, 강조 문구, 수치, 제품번호를 원본 그대로 유지한다.
5. 옵션과 Variant는 표시 순서까지 기록한다.
6. 제품별 섹션 제목, 순서, 본문, 표, FAQ, 후기, 자료를 원본에 있는 범위에서만 반영한다.
7. 다른 제품의 문장이나 섹션을 추측해서 보충하지 않는다.
8. 가격, 로그인, 장바구니, 수량 선택, 뉴스레터, 공급사 고객지원 블록은 제외한다.
9. `Customers who viewed this item also viewed` 같은 쇼핑 추천 영역도 제품 본문에서 제외한다.

## 이미지 규칙

1. Kent 갤러리와 썸네일 목록은 사용하지 않는다.
2. 실제 Kent 상세페이지의 공식 대표 이미지 한 장만 사용한다.
3. 대표 이미지 파일은 검수 후 Sanity Assets에 업로드한다.
4. ITS BIO 화면에서는 Sanity Asset만 렌더링한다.
5. 제품 `images` 배열에 두 장 이상 있으면 `gallery_images_present`로 실패한다.
6. Variant 이미지가 있으면 `variant_images_present`로 실패한다.
7. Kent 이미지 URL이 활성 필드에 남아 있으면 실패한다.
8. 이미지 확보 또는 업로드에 실패하면 Kent URL로 대체하지 않고 placeholder를 사용한다.

## SomnoFlo O2Care 상단 기준 예시

- Title: `SomnoFlo® O2Care`
- Subtitle: `Blend air and O₂`
- Item #: `SF-06`
- 상단 본문: 실제 페이지의 네 문단을 순서와 표현 그대로 저장
- 제외: `Login to see prices`, 관련 상품 추천 영역, 갤러리 썸네일
- 이미지: 공식 대표 이미지 한 장만 Sanity에 저장

## 실행

```bash
npm run kent:exact:verify
npm run kent:exact:verify:strict
```

결과:

```text
.cache/kent-exact-content-verification/latest.md
.cache/kent-exact-content-verification/latest.json
```

`--strict`는 `NEEDS_FIX` 또는 `BLOCKED`가 하나라도 있으면 종료 코드 1을 반환한다.
