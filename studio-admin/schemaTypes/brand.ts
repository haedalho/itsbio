import { defineType, defineField } from "sanity";
import { fieldTitle, fieldSlug, fieldOrder, fieldThemeKey } from "./common";

export default defineType({
  name: "brand",
  title: "Brand(공급사)",
  type: "document",
  fields: [
    fieldTitle(),
    fieldSlug("title"),
    fieldOrder(),

    defineField({ name: "introTitle", title: "Intro Title", type: "string" }),
    defineField({ name: "introDesc", title: "Intro Description", type: "text", rows: 3 }),

    // 코드/테마/URL 매칭 키
    fieldThemeKey(true),

    defineField({
      name: "logo",
      title: "Logo",
      type: "image",
      options: { hotspot: true },
    }),
  ],
  orderings: [
    { title: "Order", name: "orderAsc", by: [{ field: "order", direction: "asc" }] },
    { title: "Title", name: "titleAsc", by: [{ field: "title", direction: "asc" }] },
  ],
});
