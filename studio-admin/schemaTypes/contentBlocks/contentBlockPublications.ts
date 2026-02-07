import { defineType, defineField } from "sanity";

export default defineType({
  name: "contentBlockPublications",
  title: "Content Block: Top Publications",
  type: "object",
  fields: [
    defineField({ name: "title", title: "Section Title", type: "string", initialValue: "Top Publications" }),
    defineField({
      name: "items",
      title: "Publication Items",
      type: "array",
      of: [
        {
          type: "object",
          name: "contentBlockPublicationItem",
          fields: [
            defineField({ name: "order", title: "Order", type: "number" }),
            defineField({ name: "citation", title: "Citation", type: "text", rows: 4, validation: (r) => r.required() }),
            defineField({ name: "doi", title: "DOI URL", type: "url" }),
            defineField({ name: "product", title: "Product", type: "string" }),
          ],
        },
      ],
    }),
  ],
});
