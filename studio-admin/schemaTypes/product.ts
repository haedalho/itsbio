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

    // ✅ 2단계(enrich) 결과 저장 (요구사항: Tabs 5개만)
    defineField({
      name: "datasheetHtml",
      title: "Datasheet HTML",
      type: "text",
      rows: 16,
    }),
    defineField({
      name: "documentsHtml",
      title: "Documents HTML",
      type: "text",
      rows: 16,
    }),
    defineField({
      name: "faqsHtml",
      title: "FAQs HTML",
      type: "text",
      rows: 16,
    }),
    defineField({
      name: "referencesHtml",
      title: "References HTML",
      type: "text",
      rows: 16,
    }),
    defineField({
      name: "reviewsHtml",
      title: "Reviews HTML",
      type: "text",
      rows: 16,
    }),

    // ✅ 외부 이미지 URL(가볍게) - 로고/태극기 등은 파서에서 제외
    defineField({
      name: "imageUrls",
      title: "Image URLs",
      type: "array",
      of: [{ type: "url" }],
    }),

    // ✅ 카테고리 경로(브레드크럼에서 추출)
    defineField({
      name: "categoryPathTitles",
      title: "Category Path Titles",
      type: "array",
      of: [{ type: "string" }],
    }),

    // (기존 Sanity image 업로드 방식은 유지 가능하지만, ABM 온디맨드에서는 imageUrls 권장)
    defineField({
      name: "images",
      title: "Images (Uploaded)",
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
