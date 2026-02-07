import { defineType, defineField } from "sanity";
import { fieldTitle, fieldOrder, fieldSourceUrl, fieldLegacyHtml, fieldContentBlocks } from "./common";

export default defineType({
  name: "product",
  title: "Product(제품)",
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

    defineField({
      name: "sku",
      title: "SKU / Cat.No",
      type: "string",
    }),

    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
    }),

    // (기존 product 필드들이 더 있다면 그대로 유지)

    fieldOrder(),

    // ✅ 원본 보관(선택)
    fieldSourceUrl(),
    fieldLegacyHtml(),

    // ✅ 통합 본문
    fieldContentBlocks(false),
  ],
});
