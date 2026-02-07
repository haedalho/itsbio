import { defineType, defineField } from "sanity";

export default defineType({
  name: "contentBlockCta",
  title: "Content Block: CTA",
  type: "object",
  fields: [
    defineField({ name: "title", title: "Title", type: "string" }),
    defineField({ name: "desc", title: "Description", type: "text", rows: 3 }),
    defineField({ name: "buttonText", title: "Button Text", type: "string" }),
    defineField({ name: "href", title: "Href", type: "url" }),
  ],
});
