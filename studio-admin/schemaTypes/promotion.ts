// studio-admin/schemaTypes/promotion.ts
import { defineType, defineField } from "sanity";
import { nanoid } from "nanoid";

export default defineType({
  name: "promotion",
  title: "Promotion(홍보)",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "제목",
      type: "string",
      validation: (r) => r.required(),
    }),

    // ✅ slug (한글/비ASCII 대비)
    defineField({
      name: "slug",
      title: "슬러그(URL)",
      type: "slug",
      description: "페이지 URL에 사용됩니다. 제목 기반으로 자동 생성되며 필요 시 수정할 수 있습니다.",
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

          if (!ascii) return `promo-${nanoid(8)}`;
          return ascii;
        },
      },
      validation: (r) => r.required(),
    }),

    defineField({
      name: "publishedAt",
      title: "게시일",
      type: "datetime",
      validation: (r) => r.required(),
      initialValue: () => new Date().toISOString(),
    }),

    // ✅ 대표 이미지(1장) - 카드/목록에 쓰기 좋음
    defineField({
      name: "image",
      title: "대표 이미지(선택)",
      type: "image",
      options: { hotspot: true },
      description: "프로모션 목록(카드)에 표시할 대표 이미지입니다. (선택)",
    }),

    // ✅ 본문: 텍스트 + 이미지(여러 장) 가능
    defineField({
      name: "content",
      title: "내용",
      type: "array",
      of: [
        { type: "block" },

        // ✅ 본문 이미지 (무제한)
        defineField({
          name: "inlineImage",
          title: "본문 이미지",
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "대체 텍스트(ALT)",
              type: "string",
              description: "접근성/SEO용 (선택)",
            }),
            defineField({
              name: "caption",
              title: "캡션(선택)",
              type: "string",
            }),
          ],
        }),
      ],
      description: "본문에서 텍스트/이미지를 섞어가며 여러 개 추가할 수 있습니다.",
    }),
    defineField({
        name: "gallery",
        title: "이미지 갤러리(드래그로 여러 장 업로드)",
        type: "array",
        of: [
            {
            type: "image",
            options: { hotspot: true },
            fields: [
                { name: "alt", title: "ALT(선택)", type: "string" },
                { name: "caption", title: "캡션(선택)", type: "string" },
            ],
            },
        ],
        options: {
            layout: "grid", // ✅ 드래그 업로드 + 정렬 최적
        },
        description:
            "탐색기에서 여러 이미지 선택 후 이 영역에 드래그&드롭하면 한 번에 올라갑니다. 업로드 후 드래그로 순서를 바꿀 수 있어요.",
    }),


    // ✅ 첨부파일: PDF/JPG/PNG 등 (선택)
    defineField({
      name: "attachments",
      title: "첨부파일",
      type: "array",
      of: [
        { type: "file", options: { storeOriginalFilename: true } },
        { type: "image", options: { hotspot: true } },
      ],
      description: "PDF/JPG/PNG 등 첨부파일을 추가할 수 있습니다. (선택)",
    }),

    // (있으면 좋음) 노출 제어 - 이전에 리스트에서 isActive 필터 쓰고 있었지
    defineField({
      name: "isActive",
      title: "노출 여부",
      type: "boolean",
      initialValue: true,
      description: "체크 해제하면 사이트에 노출되지 않습니다.",
    }),
  ],
});
