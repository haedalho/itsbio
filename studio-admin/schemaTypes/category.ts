import { defineType, defineField } from "sanity";

export default defineType({
  name: "category",
  title: "Category(분류/트리)",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "카테고리명",
      type: "string",
      validation: (r) => r.required(),
    }),

    defineField({
      name: "brand",
      title: "Brand(공급사)",
      type: "reference",
      to: [{ type: "brand" }],
      validation: (r) => r.required(),
    }),

    // ✅ URL의 각 segment를 배열로 저장
    // 예: /products/abm/general-materials/pcr-enzymes/qpcr
    // path = ["general-materials","pcr-enzymes","qpcr"]
    defineField({
      name: "path",
      title: "URL Path Segments",
      type: "array",
      of: [{ type: "string" }],
      description:
        '예: ["general-materials","pcr-enzymes","qpcr"]  (브랜드 아래에서 유일해야 함)',
      validation: (r) => r.required(),
    }),
    defineField({
      name: "sourceUrl",
      title: "Source URL (원본 페이지)",
      type: "url",
      description: "Divi/외부 페이지를 그대로 iframe으로 보여줄 때 사용",
    }),


    // 트리 구성용(선택): 상위 카테고리 reference
    defineField({
      name: "parent",
      title: "상위 카테고리",
      type: "reference",
      to: [{ type: "category" }],
      description: "최상위면 비워두세요.",
    }),

    defineField({
      name: "themeKey",
      title: "Theme Key ",
      type: "string",
      description: 'ex) "abm", "kentscientifics"... (URL/테마 매칭용)',
      validation: (r) => r.required().regex(/^[a-z0-9]+$/, { name: "lowercase alnum" }),
    }),

    defineField({
      name: "sourceWpId",
      title: "Source WP Page ID",
      type: "number",
      description: "워드프레스 page_id (추후 자동 패치용)",
    }),

    defineField({
      name: "legacyHtml",
      title: "Legacy HTML (from WordPress)",
      type: "text",
      rows: 20,
      description: "WP 원본 본문(content:encoded). 레이아웃/이미지 복원용",
    }),

    defineField({
      name: "summary",
      title: "요약",
      type: "text",
      rows: 3,
    }),

    defineField({
      name: "heroImage",
      title: "대표 이미지",
      type: "image",
      options: { hotspot: true },
    }),

    defineField({
      name: "body",
      title: "카테고리 설명",
      type: "array",
      of: [{ type: "block" }, { type: "image", options: { hotspot: true } }],
    }),

    defineField({
      name: "attachments",
      title: "첨부파일",
      type: "array",
      of: [{ type: "file" }],
    }),

    defineField({
      name: "order",
      title: "정렬 순서",
      type: "number",
      initialValue: 0,
    }),
  ],
});
