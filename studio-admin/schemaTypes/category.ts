import { defineType, defineField } from "sanity";
import {
  fieldTitle,
  fieldOrder,
  fieldThemeKey,
  fieldSourceUrl,
  fieldLegacyHtml,
  fieldIntroText,
  fieldQuickLinks,
  fieldBullets,
  fieldResources,
  fieldTopPublications,
} from "./common";

export default defineType({
  name: "category",
  title: "Category(분류/트리)",
  type: "document",
  fields: [
    fieldTitle(),

    defineField({
      name: "brand",
      title: "Brand(공급사)",
      type: "reference",
      to: [{ type: "brand" }],
      validation: (r) => r.required(),
    }),

    // ✅ URL segment 배열 (brand 아래 unique)
    defineField({
      name: "path",
      title: "URL Path Segments",
      type: "array",
      of: [{ type: "string" }],
      description: '예: ["general-materials","antibodies","tag-antibodies"]',
      validation: (r) => r.required(),
    }),

    // 트리 구조 (선택)
    defineField({
      name: "parent",
      title: "상위 카테고리",
      type: "reference",
      to: [{ type: "category" }],
      description: "최상위면 비워두세요.",
    }),

    // 테마키 (brand.themeKey와 동일 권장)
    fieldThemeKey(true),

    fieldSourceUrl(),
    fieldLegacyHtml(),

    // ✅ 우리가 화면에 보여줄 “정제된” 본문 데이터
    fieldIntroText(),
    fieldQuickLinks(),
    fieldBullets(),
    fieldResources(),
    fieldTopPublications(),

    // 선택: 내부 편집용
    defineField({ name: "summary", title: "요약", type: "text", rows: 3 }),
    defineField({ name: "heroImage", title: "대표 이미지", type: "image", options: { hotspot: true } }),

    fieldOrder(),
  ],
});
