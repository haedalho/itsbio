import { defineType, defineField } from "sanity";

export default defineType({
  name: "notice",
  title: "Notice(공지사항)",
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
    defineField({
      name: "content",
      title: "내용",
      type: "array",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "externalUrl",
      title: "외부 링크(선택)",
      type: "url",
      description: "내용 대신 링크로 안내할 때 사용",
    }),
    defineField({ name: "isPinned", title: "상단 고정", type: "boolean", initialValue: false }),
  ],
  orderings: [
    {
      title: "최신순",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
});
