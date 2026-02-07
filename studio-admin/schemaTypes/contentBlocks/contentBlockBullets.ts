import { defineType, defineField } from "sanity";

export default defineType({
  name: "contentBlockBullets",
  title: "Content Block: Bullets",
  type: "object",
  fields: [
    defineField({ name: "title", title: "Section Title", type: "string", initialValue: "Highlights" }),
    defineField({
      name: "items",
      title: "Items",
      type: "array",
      of: [
        {
          type: "object",
          name: "contentBlockBulletItem",
          fields: [
            defineField({ name: "text", title: "Text", type: "string", validation: (r) => r.required() }),
            defineField({ name: "href", title: "Href(옵션)", type: "url" }),
          ],
        },
      ],
    }),
  ],
});
