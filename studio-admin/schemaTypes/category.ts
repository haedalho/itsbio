import { defineType, defineField } from "sanity";

export default defineType({
  name: "category",
  title: "Category(세부 분류)",
  type: "document",
  fields: [
    defineField({
      name: "brand",
      title: "Brand(공급사)",
      type: "reference",
      to: [{ type: "brand" }],
      validation: (r) => r.required(),
    }),
    defineField({ name: "title", title: "카테고리명", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", title: "슬러그(URL용)", type: "slug", options: { source: "title" }, validation: (r) => r.required() }),
    defineField({ name: "order", title: "정렬", type: "number" }),
  ],
});
