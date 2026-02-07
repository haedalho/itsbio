import { defineType, defineField } from "sanity";
import { fieldTitle, fieldOrder, fieldThemeKey, fieldSourceUrl, fieldLegacyHtml, fieldContentBlocks } from "./common";

export default defineType({
  name: "brand",
  title: "Brand(공급사)",
  type: "document",
  fields: [
    fieldTitle(),

    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (r) => r.required(),
    }),

    // (기존 brand 필드들이 더 있다면 그대로 유지)

    fieldThemeKey(false),
    fieldOrder(),

    // ✅ 원본 보관(선택)
    fieldSourceUrl(),
    fieldLegacyHtml(),

    // ✅ 통합 본문
    fieldContentBlocks(false),
  ],
});
