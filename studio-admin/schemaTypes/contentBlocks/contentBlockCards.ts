import { defineType, defineField } from "sanity";

export default defineType({
  name: "contentBlockCards",
  title: "Content Block: Cards (Kent Landing)",
  type: "object",
  fields: [
    defineField({ name: "title", title: "Section Title", type: "string" }),

    // product/category/resource/publication 등 카드 종류 구분
    defineField({
      name: "kind",
      title: "Kind",
      type: "string",
      options: {
        list: [
          { title: "Product", value: "product" },
          { title: "Category", value: "category" },
          { title: "Resource", value: "resource" },
          { title: "Publication", value: "publication" },
        ],
        layout: "radio",
      },
      initialValue: "product",
    }),

    defineField({
      name: "items",
      title: "Cards",
      type: "array",
      of: [
        {
          type: "object",
          name: "cardItem",
          fields: [
            defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
            defineField({ name: "subtitle", title: "Subtitle", type: "string" }),
            defineField({ name: "href", title: "Href", type: "url", validation: (r) => r.required() }),

            // ✅ 외부 이미지 그대로 써도 되게 url로
            defineField({ name: "imageUrl", title: "Image URL", type: "url" }),

            // ✅ Kent 카테고리 카드의 "31 products" 같은 표시
            defineField({ name: "count", title: "Count", type: "number" }),

            // NEW/FEATURED 같은 배지
            defineField({ name: "badge", title: "Badge", type: "string" }),

            // 제품 카드 보조 정보(선택)
            defineField({ name: "sku", title: "SKU/Cat.No", type: "string" }),
          ],
        },
      ],
    }),
  ],
});