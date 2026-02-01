import { defineType, defineField } from "sanity";

export default defineType({
  name: "product",
  title: "Product(제품)",
  type: "document",
  fields: [
    defineField({ name: "title", title: "제품명", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "슬러그(URL)",
      type: "slug",
      options: { source: "title" },
      validation: (r) => r.required(),
    }),

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
        description: "없으면 비워도 됩니다(브랜드만으로 분류).",
        }),


    defineField({ name: "catalogNo", title: "Catalog No", type: "string" }),
    defineField({ name: "summary", title: "한 줄 설명", type: "text", rows: 3 }),
    defineField({ name: "image", title: "대표 이미지", type: "image", options: { hotspot: true } }),
    defineField({ name: "description", title: "상세 설명", type: "array", of: [{ type: "block" }] }),
    defineField({ name: "isActive", title: "노출", type: "boolean", initialValue: true }),
  ],
});
