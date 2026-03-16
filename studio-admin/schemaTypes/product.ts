// studio-admin/schemaTypes/product.ts
import { defineType, defineField } from "sanity";
import { fieldTitle, fieldOrder, fieldSourceUrl, fieldLegacyHtml, fieldContentBlocks } from "./common";

const optionValueFields = [
  defineField({ name: "value", title: "Value", type: "string" }),
  defineField({ name: "label", title: "Label", type: "string" }),
];

const optionGroupFields = [
  defineField({ name: "key", title: "Key", type: "string" }),
  defineField({ name: "name", title: "Name", type: "string" }),
  defineField({ name: "label", title: "Label", type: "string" }),
  defineField({
    name: "displayType",
    title: "Display Type",
    type: "string",
    options: {
      list: [
        { title: "Buttons", value: "button" },
        { title: "Select", value: "select" },
      ],
      layout: "radio",
    },
    initialValue: "button",
  }),
  defineField({
    name: "options",
    title: "Options",
    type: "array",
    of: [
      defineField({
        name: "optionValue",
        title: "Option Value",
        type: "object",
        fields: optionValueFields,
        preview: {
          select: { title: "label", subtitle: "value" },
        },
      }),
    ],
  }),
];

const variantFields = [
  defineField({ name: "variantId", title: "Variant ID", type: "string" }),
  defineField({ name: "title", title: "Title", type: "string" }),
  defineField({ name: "sku", title: "SKU / Item #", type: "string" }),
  defineField({ name: "catNo", title: "Cat. No. / Item #", type: "string" }),
  defineField({ name: "optionSummary", title: "Option Summary", type: "string" }),
  defineField({
      name: "optionValues",
      title: "Option Values",
      type: "array",
      of: [
        defineField({
          name: "optionValuePair",
          title: "Option Value Pair",
          type: "object",
          fields: [
            defineField({ name: "key", title: "Key", type: "string" }),
            defineField({ name: "label", title: "Label", type: "string" }),
            defineField({ name: "value", title: "Value", type: "string" }),
          ],
        }),
      ],
    }),
    defineField({
      name: "attributes",
      title: "Raw Attributes",
      type: "array",
      of: [
        defineField({
          name: "attributePair",
          title: "Attribute Pair",
          type: "object",
          fields: [
            defineField({ name: "key", title: "Key", type: "string" }),
            defineField({ name: "value", title: "Value", type: "string" }),
          ],
        }),
      ],
    }),
  defineField({ name: "imageUrl", title: "Variant Image URL", type: "url" }),
  defineField({ name: "sourceVariationId", title: "Source Variation ID", type: "string" }),
];

export default defineType({
  name: "product",
  title: "Product(제품)",
  type: "document",
  fields: [
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

    defineField({
      name: "summary",
      title: "Summary",
      type: "text",
      rows: 4,
    }),

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

    defineField({
      name: "listingPaths",
      title: "Listing Paths",
      type: "array",
      of: [{ type: "string" }],
      description: `상위 listing 페이지 조회용 path. 예: ["anesthesia", "anesthesia/anesthesia-accessories"]`,
    }),

    defineField({
      name: "categoryPathTitles",
      title: "Category Path Titles",
      type: "array",
      of: [{ type: "string" }],
    }),

    fieldOrder(),
    fieldSourceUrl(),
    fieldLegacyHtml(),

    defineField({
      name: "extraHtml",
      title: "Extra / Overview HTML",
      type: "text",
      rows: 16,
    }),
    defineField({
      name: "specsHtml",
      title: "Specifications HTML",
      type: "text",
      rows: 16,
    }),
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

    defineField({
      name: "imageUrls",
      title: "Image URLs",
      type: "array",
      of: [{ type: "url" }],
    }),

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
            defineField({ name: "label", title: "Label", type: "string" }),
            defineField({ name: "url", title: "URL", type: "url" }),
          ],
        }),
      ],
    }),

    defineField({
      name: "productType",
      title: "Product Type",
      type: "string",
      options: {
        list: [
          { title: "Simple", value: "simple" },
          { title: "Variant", value: "variant" },
        ],
        layout: "radio",
      },
      initialValue: "simple",
    }),

    defineField({
      name: "defaultVariantId",
      title: "Default Variant ID",
      type: "string",
      description: "Kent 옵션형 상품에서 기본 선택될 variant ID",
    }),

    defineField({
      name: "optionGroups",
      title: "Option Groups",
      type: "array",
      of: [
        defineField({
          name: "optionGroup",
          title: "Option Group",
          type: "object",
          fields: optionGroupFields,
          preview: {
            select: { title: "label", subtitle: "key" },
          },
        }),
      ],
    }),

    defineField({
      name: "variants",
      title: "Variants",
      type: "array",
      of: [
        defineField({
          name: "variant",
          title: "Variant",
          type: "object",
          fields: variantFields,
          preview: {
            select: { title: "title", subtitle: "sku", media: "imageUrl" },
            prepare({ title, subtitle }) {
              return {
                title: title || "Variant",
                subtitle: subtitle || "",
              };
            },
          },
        }),
      ],
    }),

    defineField({
      name: "enrichedAt",
      title: "Enriched At",
      type: "datetime",
      readOnly: true,
    }),

    fieldContentBlocks(false),
  ],
});
