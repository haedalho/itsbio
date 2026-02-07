import { defineType, defineField } from "sanity";

export default defineType({
  name: "contentBlockResources",
  title: "Content Block: Resources",
  type: "object",
  fields: [
    defineField({ name: "title", title: "Section Title", type: "string", initialValue: "Resource" }),
    defineField({
      name: "items",
      title: "Resource Items",
      type: "array",
      of: [
        {
          type: "object",
          name: "contentBlockResourceItem",
          fields: [
            defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
            defineField({ name: "subtitle", title: "Subtitle", type: "string" }),
            defineField({ name: "href", title: "Href", type: "url", validation: (r) => r.required() }),
            defineField({ name: "imageUrl", title: "Image URL(원본)", type: "url" }),
          ],
        },
      ],
    }),
  ],
});
