// studio-admin/schemaTypes/contentBlocks.ts
import { defineType, defineField } from "sanity";

export const contentBlockHtml = defineType({
  name: "contentBlockHtml",
  title: "Block: HTML",
  type: "object",
  fields: [
    defineField({ name: "title", title: "Title", type: "string" }),
    defineField({ name: "html", title: "HTML", type: "text", rows: 12, validation: (r) => r.required() }),
  ],
});

export const contentBlockBullets = defineType({
  name: "contentBlockBullets",
  title: "Block: Bullets",
  type: "object",
  fields: [
    defineField({ name: "title", title: "Title", type: "string" }),
    defineField({
      name: "items",
      title: "Items",
      type: "array",
      of: [
        {
          type: "object",
          name: "bulletLink",
          fields: [
            defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
            defineField({ name: "href", title: "Href", type: "url" }),
          ],
        },
      ],
    }),
  ],
});

export const contentBlockResources = defineType({
  name: "contentBlockResources",
  title: "Block: Resources",
  type: "object",
  fields: [
    defineField({ name: "title", title: "Title", type: "string" }),
    defineField({
      name: "items",
      title: "Cards",
      type: "array",
      of: [
        {
          type: "object",
          name: "resourceCard",
          fields: [
            defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
            defineField({ name: "subtitle", title: "Subtitle", type: "string" }),
            defineField({ name: "href", title: "Href", type: "url", validation: (r) => r.required() }),

            // ✅ 지금은 외부 이미지 URL을 그대로 써도 되게 string으로 받자
            defineField({ name: "imageUrl", title: "Image URL", type: "url" }),

            defineField({
              name: "meta",
              title: "Meta (debug)",
              type: "object",
              fields: [
                defineField({ name: "imageUrlRaw", title: "imageUrlRaw", type: "string" }),
                defineField({ name: "imageUrlUsed", title: "imageUrlUsed", type: "string" }),
                defineField({ name: "imageStatus", title: "imageStatus", type: "string" }),
                defineField({ name: "imageReason", title: "imageReason", type: "string" }),
              ],
            }),
          ],
        },
      ],
    }),
  ],
});

export const contentBlockPublications = defineType({
  name: "contentBlockPublications",
  title: "Block: Top Publications",
  type: "object",
  fields: [
    defineField({ name: "title", title: "Title", type: "string" }),
    defineField({
      name: "items",
      title: "Items",
      type: "array",
      of: [
        {
          type: "object",
          name: "topPublication",
          fields: [
            defineField({ name: "order", title: "Order", type: "number" }),
            defineField({ name: "citation", title: "Citation", type: "text", rows: 3, validation: (r) => r.required() }),
            defineField({ name: "doi", title: "DOI URL", type: "url" }),
            defineField({ name: "product", title: "Product", type: "string" }),
          ],
        },
      ],
    }),
  ],
});
