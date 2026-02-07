import { defineType, defineField } from "sanity";

export default defineType({
  name: "contentBlockRichText",
  title: "Content Block: Rich Text",
  type: "object",
  fields: [
    defineField({ name: "title", title: "Section Title", type: "string" }),
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      of: [{ type: "block" }],
    }),
  ],
});
