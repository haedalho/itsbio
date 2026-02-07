import { defineType, defineField } from "sanity";

export default defineType({
  name: "contentBlockHtml",
  title: "Content Block: HTML",
  type: "object",
  fields: [
    defineField({ name: "title", title: "Section Title", type: "string" }),
    defineField({
      name: "html",
      title: "HTML",
      type: "text",
      rows: 18,
      validation: (r) => r.required(),
    }),
  ],
});
