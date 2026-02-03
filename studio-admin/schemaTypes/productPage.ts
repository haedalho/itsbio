import { defineType, defineField } from "sanity";
import {
  fieldTitle,
  fieldSlug,
  fieldThemeKey,
  fieldSourceUrl,
  fieldLegacyHtml,
  fieldIntroText,
  fieldQuickLinks,
  fieldBullets,
  fieldResources,
  fieldTopPublications,
  fieldOrder,
} from "./common";

/**
 * productPage = “카테고리/랜딩” 성격의 페이지용 (제품 리스트/리소스/논문 등)
 * - 지금 category에 들어있는 구조를 그대로 productPage로도 쓸 수 있게 공통화
 * - 추후 “카테고리=트리”, “productPage=랜딩(본문)”을 분리하고 싶을 때 유용
 */
export default defineType({
  name: "productPage",
  title: "ProductPage(랜딩)",
  type: "document",
  fields: [
    fieldTitle(),
    fieldSlug("title"),

    defineField({
      name: "brand",
      title: "Brand(공급사)",
      type: "reference",
      to: [{ type: "brand" }],
      validation: (r) => r.required(),
    }),

    defineField({
      name: "category",
      title: "Category 연결",
      type: "reference",
      to: [{ type: "category" }],
      description: "이 랜딩이 대응하는 카테고리(선택)",
    }),

    fieldThemeKey(true),
    fieldSourceUrl(),
    fieldLegacyHtml(),

    fieldIntroText(),
    fieldQuickLinks(),
    fieldBullets(),
    fieldResources(),
    fieldTopPublications(),

    defineField({ name: "heroImage", title: "대표 이미지", type: "image", options: { hotspot: true } }),
    fieldOrder(),
  ],
});
