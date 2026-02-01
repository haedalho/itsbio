import { defineType, defineField } from "sanity";

export default defineType({
  name: "brand",
  title: "Brand(공급사)",
  type: "document",
  fields: [
    defineField({ name: "title", title: "브랜드명", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "슬러그(URL용)",
      type: "slug",
      options: { source: "title" },
      validation: (r) => r.required(),
    }),
    defineField({ name: "order", title: "정렬(작을수록 먼저)", type: "number" }),
  ],
});
