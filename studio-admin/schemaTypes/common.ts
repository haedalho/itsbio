import { defineField } from "sanity";

export const fieldTitle = () =>
  defineField({
    name: "title",
    title: "Title",
    type: "string",
    validation: (r) => r.required(),
  });

export const fieldOrder = () =>
  defineField({
    name: "order",
    title: "Order",
    type: "number",
    initialValue: 0,
  });

export const fieldThemeKey = (required = true) =>
  defineField({
    name: "themeKey",
    title: "Theme Key",
    type: "string",
    validation: (r) =>
      (required ? r.required() : r).regex(/^[a-z0-9]+$/, { name: "lowercase alnum" }),
  });

export const fieldSourceUrl = () =>
  defineField({
    name: "sourceUrl",
    title: "Source URL (원본 페이지)",
    type: "url",
  });

export const fieldLegacyHtml = () =>
  defineField({
    name: "legacyHtml",
    title: "Legacy HTML (원본 HTML)",
    type: "text",
    rows: 20,
  });

export function fieldContentBlocks(required = false) {
  return defineField({
    name: "contentBlocks",
    title: "Content Blocks (통합 본문)",
    type: "array",
    of: [
      { type: "contentBlockHtml" },
      { type: "contentBlockRichText" },
      { type: "contentBlockLinks" },
      { type: "contentBlockBullets" },
      { type: "contentBlockResources" },
      { type: "contentBlockPublications" },
      { type: "contentBlockCta" },
    ],
    validation: (r) => (required ? r.required().min(1) : r),
  });
}
