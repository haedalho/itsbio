import { defineField, defineType } from "sanity";

export default defineType({
  name: "brand",
  title: "Brand(공급사)",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({ name: "order", title: "Order", type: "number", initialValue: 0 }),
    defineField({ name: "introTitle", title: "Intro Title", type: "string" }),
    defineField({ name: "introDesc", title: "Intro Description", type: "text" }),

    // ✅ 메가메뉴/브랜드 그리드에서 쓰는 컬러 키 (abm, aims, seedburo...)
    defineField({
      name: "themeKey",
      title: "Theme Key ",
      type: "string",
      description: 'ex) "abm", "kentscientifics", "itschem"... (코드 테마 매칭용)',
    }),
  ],
  orderings: [
    { title: "Order", name: "orderAsc", by: [{ field: "order", direction: "asc" }] },
    { title: "Title", name: "titleAsc", by: [{ field: "title", direction: "asc" }] },
  ],
});
