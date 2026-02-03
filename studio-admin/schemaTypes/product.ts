import { defineType, defineField } from "sanity";
import { fieldTitle, fieldSlug, fieldOrder } from "./common";

export default defineType({
  name: "product",
  title: "Product(제품)",
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
      title: "Category(세부 분류)",
      type: "reference",
      to: [{ type: "category" }],
      description: "제품이 속한 카테고리(없으면 비워도 됨).",
    }),

    defineField({ name: "catalogNo", title: "Catalog No", type: "string" }),
    defineField({ name: "summary", title: "한 줄 설명", type: "text", rows: 3 }),
    defineField({ name: "image", title: "대표 이미지", type: "image", options: { hotspot: true } }),
    defineField({ name: "description", title: "상세 설명", type: "array", of: [{ type: "block" }] }),

    defineField({ name: "isActive", title: "노출", type: "boolean", initialValue: true }),
    fieldOrder(),
  ],
});
