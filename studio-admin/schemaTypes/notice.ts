// sanity/schemas/notice.ts
import { defineField, defineType } from "sanity";
import { nanoid } from "nanoid";

export default defineType({
  name: "notice",
  title: "Notice(공지사항)",
  type: "document",

 fields: [
    defineField({
      name: "isPinned",
      title: "공지 상단 고정",
      type: "boolean",
      initialValue: false,
      description: "체크하면 목록 최상단에 ‘공지’로 표시됩니다.",
    }),

    defineField({
      name: "title",
      title: "제목",
      type: "string",
      validation: (Rule) => Rule.required().min(3),
      description: "공지 제목을 입력하세요. (검색/정렬 기준)",
    }),

    defineField({
      name: "slug",
      title: "URL 주소(슬러그)",
      type: "slug",
      options: {
        source: "title",
        maxLength: 96,
        slugify: (input: string) => {
          const trimmed = (input || "").trim();

          const ascii = trimmed
            .toLowerCase()
            .replace(/['"]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "")
            .slice(0, 80);

          if (!ascii) return `notice-${nanoid(8)}`;
          return ascii;
        },
      },
      validation: (Rule) => Rule.required(),
      description:
        "상세 페이지 URL에 사용됩니다. 제목이 한글이어도 자동 생성되며, 비어있으면 notice-xxxx 형태로 생성됩니다.",
    }),

    defineField({
      name: "summary",
      title: "요약",
      type: "text",
      rows: 3,
      description: "목록/검색 결과에서 함께 보여줄 짧은 요약입니다. (선택)",
    }),

    defineField({
      name: "thumbnail",
      title: "썸네일(목록 미리보기용)",
      type: "image",
      options: { hotspot: true },
      description: "공지 목록에서 hover 시 미리보기로 보여줄 이미지입니다. (선택)",
    }),

    defineField({
      name: "body",
      title: "본문",
      type: "array",
      of: [{ type: "block" }],
      description: "공지 상세 페이지 본문 내용입니다.",
    }),

    defineField({
      name: "publishedAt",
      title: "게시일",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
      description: "목록 정렬/표시에 사용됩니다. (기본값: 현재 시간)",
    }),

    defineField({
      name: "attachments",
      title: "첨부파일",
      type: "array",
      of: [
        {
          type: "file",
          options: { storeOriginalFilename: true },
        },
        {
          type: "image",
          options: { hotspot: true },
        },
      ],
      description: "PDF/JPG/PNG 등 첨부파일을 추가할 수 있습니다. (선택)",
    }),

    defineField({
      name: "order",
      title: "우선순위(정렬용 숫자)",
      type: "number",
      description:
        "숫자가 클수록 위로 정렬됩니다. 공지 상단 고정을 쓸 경우에만 보조적으로 사용하세요. (선택)",
    }),
  ],

  preview: {
    select: {
      title: "title",
      subtitle: "publishedAt",
      media: "thumbnail",
    },
  },
});
