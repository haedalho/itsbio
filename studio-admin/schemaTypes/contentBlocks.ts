import { defineField, defineType } from "sanity";

/**
 * Reusable content block list.
 * We keep blocks flexible so you can extract HTML content (text/images/tables/buttons)
 * from each brand site and re-build the page in your own UI.
 */
export default defineType({
  name: "contentBlocks",
  title: "Content Blocks",
  type: "array",
  of: [
    // 1) Rich text section (PortableText)
    defineField({
      name: "richText",
      title: "Rich Text",
      type: "object",
      fields: [
        defineField({ name: "title", title: "Section Title", type: "string" }),
        defineField({
          name: "body",
          title: "Body",
          type: "array",
          of: [{ type: "block" }, { type: "image" }, { type: "simpleTable" }],
        }),
        defineField({ name: "ctas", title: "CTAs", type: "array", of: [{ type: "cta" }] }),
      ],
      preview: {
        select: { title: "title" },
        prepare({ title }) {
          return { title: title || "Rich Text" };
        },
      },
    }),

    // 2) Image section
    defineField({
      name: "imageSection",
      title: "Image",
      type: "object",
      fields: [
        defineField({ name: "title", title: "Section Title", type: "string" }),
        defineField({
          name: "image",
          title: "Image",
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({ name: "alt", title: "Alt", type: "string" }),
            defineField({ name: "caption", title: "Caption", type: "string" }),
          ],
        }),
        defineField({ name: "ctas", title: "CTAs", type: "array", of: [{ type: "cta" }] }),
      ],
      preview: {
        select: { title: "title", media: "image" },
        prepare({ title, media }) {
          return { title: title || "Image", media };
        },
      },
    }),

    // 3) Table section
    defineField({
      name: "tableSection",
      title: "Table",
      type: "object",
      fields: [
        defineField({ name: "title", title: "Section Title", type: "string" }),
        defineField({ name: "table", title: "Table", type: "simpleTable" }),
        defineField({ name: "ctas", title: "CTAs", type: "array", of: [{ type: "cta" }] }),
      ],
      preview: {
        select: { title: "title" },
        prepare({ title }) {
          return { title: title || "Table" };
        },
      },
    }),

    // 4) Downloads section
    defineField({
      name: "downloads",
      title: "Downloads",
      type: "object",
      fields: [
        defineField({ name: "title", title: "Section Title", type: "string", initialValue: "Downloads" }),
        defineField({
          name: "files",
          title: "Files",
          type: "array",
          of: [
            defineField({
              name: "fileItem",
              title: "File",
              type: "file",
              fields: [defineField({ name: "label", title: "Label", type: "string" })],
            }),
          ],
        }),
      ],
      preview: {
        select: { title: "title" },
        prepare({ title }) {
          return { title: title || "Downloads" };
        },
      },
    }),
  ],
});
