import { defineType, defineField } from "sanity";

export default defineType({
  name: "promotion",
  title: "Promotion(홍보)",
  type: "document",
  fields: [
    defineField({ name: "title", title: "제목", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "publishedAt",
      title: "게시일",
      type: "datetime",
      validation: (r) => r.required(),
      initialValue: () => new Date().toISOString(),
    }),
    defineField({ name: "image", title: "이미지(선택)", type: "image", options: { hotspot: true } }),
    defineField({ name: "summary", title: "요약(선택)", type: "text", rows: 3 }),
    defineField({
      name: "content",
      title: "내용",
      type: "array",
      of: [{ type: "block" }],
    }),
    defineField({ name: "ctaUrl", title: "버튼 링크(선택)", type: "url" }),
    defineField({ name: "ctaLabel", title: "버튼 문구(선택)", type: "string" }),
    defineField({ name: "isActive", title: "노출", type: "boolean", initialValue: true }),
    defineField({ name: "order", title: "정렬(작을수록 먼저)", type: "number" }),
  ],
  orderings: [
    { title: "최신순", name: "publishedAtDesc", by: [{ field: "publishedAt", direction: "desc" }] },
    { title: "정렬순", name: "orderAsc", by: [{ field: "order", direction: "asc" }] },
  ],
});
