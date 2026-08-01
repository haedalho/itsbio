# Kent official source snapshots

이 폴더의 JSON은 실제 Kent 상세페이지를 제품별로 직접 검수한 뒤 만드는 **승인 증거 파일**이다.

제품 본문 전체를 Git에 복사하지 않는다. 짧은 식별 필드만 저장하고, 긴 본문과 섹션 데이터는 정규화된 SHA-256 해시로 검증한다.

스냅샷이 없거나 한 필드라도 일치하지 않으면 해당 제품은 `VERIFIED`가 될 수 없다.

## 파일 이름

```text
<product-slug>.json
```

예:

```text
somnosuite-y-adapter.json
```

## 형식

```json
{
  "schemaVersion": 1,
  "slug": "somnosuite-y-adapter",
  "sourceUrl": "https://www.kentscientific.com/products/somnosuite-y-adapter/",
  "checkedAt": "2026-08-02T00:00:00Z",
  "sourcePageSha256": "64자리 소문자 SHA-256",
  "content": {
    "title": "2-Accessory Connector",
    "subtitle": "For the SomnoFlo® and SomnoSuite® anesthesia systems",
    "itemNumber": "10-4500-09",
    "optionGroups": [
      {
        "key": "configuration",
        "label": "Choose your option",
        "displayType": "select",
        "options": [
          {
            "value": "somnoflo-systems",
            "label": "공식 페이지의 정확한 옵션 문구"
          }
        ]
      }
    ],
    "variants": [
      {
        "variantId": "10-8000-23",
        "title": "공식 페이지의 정확한 Variant 제목",
        "sku": "10-8000-23",
        "catNo": "10-8000-23",
        "optionSummary": "정확한 옵션 요약",
        "optionValues": {
          "configuration": "somnoflo-systems"
        },
        "attributes": {},
        "sourceVariationId": "",
        "imageAssetId": "image-...-1200x1200-png",
        "imageSha1": "40자리 Sanity asset SHA-1",
        "legacyImageUrl": ""
      }
    ],
    "sections": [
      {
        "order": 1,
        "title": "Related Products",
        "type": "related-products",
        "contentSha256": "해당 섹션의 정규화된 전체 표시 데이터 SHA-256"
      }
    ],
    "gallery": [
      {
        "order": 1,
        "sanityAssetId": "image-...-1200x1200-png",
        "sha1": "40자리 Sanity asset SHA-1",
        "alt": "승인된 정확한 대체 텍스트"
      }
    ]
  }
}
```

## 검수 규칙

1. 실제 Kent 상세페이지를 직접 확인한다.
2. 제목, 부제목, Item #의 철자·대소문자·기호·상표기호를 보존한다.
3. 옵션과 Variant는 표시 순서까지 기록한다.
4. 섹션 제목과 순서를 그대로 기록한다.
5. 긴 본문은 승인된 표시 데이터로 Sanity에 입력한 뒤 동일 정규화 규칙으로 SHA-256을 계산한다.
6. 이미지 파일은 Kent에서 런타임 호출하지 않는다.
7. 검수한 이미지 파일을 Sanity에 업로드하고 Asset ID와 SHA-1을 기록한다.
8. 실제 Sanity Asset 순서가 공식 갤러리 순서와 같아야 한다.
9. `imageUrls`, `galleryImageUrls`, Kent 도메인의 Variant·섹션 이미지 URL이 남아 있으면 실패한다.
10. 가격, 로그인, 장바구니, 수량 선택, 뉴스레터, 공급사 고객지원 블록은 제품 콘텐츠에서 제외한다.

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
