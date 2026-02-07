// studio-admin/schemaTypes/category.ts
import { defineType, defineField } from "sanity";
import { fieldTitle, fieldOrder, fieldThemeKey, fieldSourceUrl, fieldLegacyHtml, fieldContentBlocks } from "./common";

export default defineType({
  name: "category",
  title: "Category(분류/트리)",
  type: "document",
  fields: [
    fieldTitle(),

    defineField({
      name: "brand",
      title: "Brand(공급사)",
      type: "reference",
      to: [{ type: "brand" }],
      validation: (r) => r.required(),
    }),

    defineField({
      name: "path",
      title: "URL Path Segments",
      type: "array",
      of: [{ type: "string" }],
      description: '예: ["general-materials","antibodies","tag-antibodies"]',
      validation: (r) => r.required(),
    }),

    defineField({
      name: "parent",
      title: "상위 카테고리",
      type: "reference",
      to: [{ type: "category" }],
      description: "최상위면 비워두세요.",
    }),

    fieldThemeKey(true),
    fieldSourceUrl(),
    fieldLegacyHtml(),

    // ✅ 본문은 무조건 이거 하나로 통합
    fieldContentBlocks(false),

    defineField({ name: "summary", title: "요약", type: "text", rows: 3 }),
    defineField({ name: "heroImage", title: "대표 이미지", type: "image", options: { hotspot: true } }),

    fieldOrder(),
  ],

  preview: {
    select: { title: "title", path: "path", brandTitle: "brand.title" },
    prepare({ title, path, brandTitle }) {
      const subtitle = Array.isArray(path) && path.length ? path.join(" / ") : "";
      return { title: title || "(untitled)", subtitle: subtitle || brandTitle || "" };
    },
  },
});
