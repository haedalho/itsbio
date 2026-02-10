// studio-admin/schemaTypes/product.ts
import { defineType, defineField } from "sanity";
import { fieldTitle, fieldOrder, fieldSourceUrl, fieldLegacyHtml, fieldContentBlocks } from "./common";

export default defineType({
  name: "product",
  title: "Product(제품)",
  type: "document",
  fields: [
    // ✅ 기본
    fieldTitle(),

    defineField({
      name: "isActive",
      title: "Active",
      type: "boolean",
      initialValue: true,
    }),

    defineField({
      name: "brand",
      title: "Brand(공급사)",
      type: "reference",
      to: [{ type: "brand" }],
      validation: (r) => r.required(),
    }),

    // ✅ ABM Cat.No 등
    defineField({
      name: "sku",
      title: "SKU / Cat.No",
      type: "string",
    }),

    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 160 },
      validation: (r) => r.required(),
    }),

    // ✅ 카테고리 매핑
    defineField({
      name: "categoryRef",
      title: "Category",
      type: "reference",
      to: [{ type: "category" }],
    }),

    defineField({
      name: "categoryPath",
      title: "Category Path",
      type: "array",
      of: [{ type: "string" }],
      description: `예: ["general-materials","genetic-materials"]`,
    }),

    fieldOrder(),

    // ✅ 원본 보관(이미 common에 있음)
    fieldSourceUrl(),
    fieldLegacyHtml(),

    // ✅ 2단계(enrich) 결과 저장
    defineField({
      name: "specsHtml",
      title: "Specifications HTML",
      type: "text",
      rows: 16,
      description: "ABM 상세에서 스펙/테이블만 뽑아서 저장 (Price 제거)",
    }),

    defineField({
      name: "extraHtml",
      title: "Extra / Description HTML",
      type: "text",
      rows: 24,
      description: "ABM 상세에서 설명/본문 영역 저장 (메일 치환 포함)",
    }),

    defineField({
      name: "images",
      title: "Images",
      type: "array",
      of: [
        defineField({
          name: "imageItem",
          title: "Image",
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({ name: "caption", title: "Caption", type: "string" }),
            defineField({ name: "sourceUrl", title: "Source URL", type: "url" }),
          ],
        }),
      ],
    }),

    defineField({
      name: "docs",
      title: "Documents",
      type: "array",
      of: [
        defineField({
          name: "docItem",
          title: "Document",
          type: "object",
          fields: [
            defineField({ name: "title", title: "Title", type: "string" }),
            defineField({ name: "url", title: "URL", type: "url" }),
          ],
        }),
      ],
    }),

    defineField({
      name: "enrichedAt",
      title: "Enriched At",
      type: "datetime",
      readOnly: true,
    }),

    // ✅ 통합 본문(너희 기존 구조 유지)
    fieldContentBlocks(false),
  ],
});
