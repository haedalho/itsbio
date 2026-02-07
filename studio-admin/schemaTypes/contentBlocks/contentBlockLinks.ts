import { defineType, defineField } from "sanity";

export default defineType({
  name: "contentBlockLinks",
  title: "Content Block: Links",
  type: "object",
  fields: [
    defineField({ name: "title", title: "Section Title", type: "string" }),
    defineField({
      name: "items",
      title: "Items",
      type: "array",
      of: [
        {
          type: "object",
          name: "contentBlockLinkItem",
          fields: [
            defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
            defineField({ name: "href", title: "Href", type: "url", validation: (r) => r.required() }),
          ],
        },
      ],
    }),
  ],
});
