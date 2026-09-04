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

const cleaverProductItemFields = [
  defineField({ name: "title", title: "Title", type: "string" }),
  defineField({ name: "sku", title: "Catalog No.", type: "string" }),
  defineField({ name: "quantity", title: "Quantity", type: "string" }),
  defineField({ name: "packSize", title: "Pack / Size", type: "string" }),
  defineField({ name: "priceText", title: "Source Price", type: "string" }),
  defineField({ name: "sourceUrl", title: "Manufacturer Source URL", type: "url" }),
  defineField({ name: "imageUrl", title: "Source Image URL", type: "url" }),
  defineField({ name: "internalHref", title: "ITS BIO Internal Path", type: "string" }),
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
      name: "migrationKey",
      title: "Migration Key",
      type: "string",
      readOnly: true,
      hidden: ({ document }) => !document?.migrationKey,
      description: "Deterministic scope marker used to keep reviewed bulk imports isolated from existing products.",
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
      name: "sourceProductId",
      title: "Source Product ID",
      type: "number",
      readOnly: true,
    }),

    defineField({
      name: "sourceModifiedAt",
      title: "Source Modified At",
      type: "datetime",
      readOnly: true,
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
      name: "sourceIntroHtml",
      title: "Kent Source Intro HTML",
      type: "text",
      rows: 16,
      description: "Kent Shop product body copied from the official source. Prices and commerce controls are excluded at render time.",
    }),
    defineField({
      name: "overviewHtml",
      title: "Kent Overview HTML",
      type: "text",
      rows: 16,
    }),
    defineField({
      name: "highlights",
      title: "Product Highlights",
      type: "array",
      of: [{ type: "string" }],
      description: "Verified manufacturer product features shown alongside the main product image.",
    }),
    defineField({
      name: "specRows",
      title: "Structured Technical Specifications",
      type: "array",
      of: [
        defineField({
          name: "productSpecificationRow",
          title: "Specification",
          type: "object",
          fields: [
            defineField({ name: "label", title: "Specification", type: "string" }),
            defineField({ name: "value", title: "Value", type: "string" }),
          ],
        }),
      ],
      description: "SKU-specific specifications extracted from reviewed manufacturer tables.",
    }),
    defineField({
      name: "kentSections",
      title: "Kent Source Sections",
      type: "array",
      of: [
        defineField({
          name: "kentSourceSection",
          title: "Kent Source Section",
          type: "object",
          fields: [
            defineField({ name: "type", title: "Type", type: "string" }),
            defineField({ name: "title", title: "Title", type: "string" }),
            defineField({ name: "html", title: "HTML", type: "text", rows: 16 }),
            defineField({ name: "description", title: "Description", type: "text", rows: 6 }),
            defineField({ name: "imageUrl", title: "Image URL", type: "url" }),
            defineField({
              name: "items",
              title: "Items",
              type: "array",
              of: [
                defineField({
                  name: "kentSourceSectionItem",
                  title: "Section Item",
                  type: "object",
                  fields: [
                    defineField({ name: "title", title: "Title", type: "string" }),
                    defineField({ name: "label", title: "Label", type: "string" }),
                    defineField({ name: "text", title: "Text", type: "text", rows: 4 }),
                    defineField({ name: "description", title: "Description", type: "text", rows: 6 }),
                    defineField({ name: "html", title: "HTML", type: "text", rows: 8 }),
                    defineField({ name: "url", title: "URL", type: "url" }),
                    defineField({ name: "href", title: "Href", type: "url" }),
                  ],
                }),
              ],
            }),
          ],
          preview: {
            select: { title: "title", subtitle: "type" },
          },
        }),
      ],
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
      name: "cleaverIncludedItems",
      title: "Cleaver / Thistle - What's Included",
      type: "array",
      of: [defineField({ name: "cleaverIncludedItem", title: "Included Item", type: "object", fields: cleaverProductItemFields })],
      description: "Reviewed contents of the manufacturer What's Included section.",
    }),
    defineField({
      name: "cleaverVariations",
      title: "Cleaver / Thistle - All Variations",
      type: "array",
      of: [defineField({ name: "cleaverVariation", title: "Variation", type: "object", fields: cleaverProductItemFields })],
      description: "Manufacturer product-family variations, linked to ITS BIO product pages when an exact reviewed product exists.",
    }),
    defineField({
      name: "cleaverAccessories",
      title: "Cleaver / Thistle - Accessories",
      type: "array",
      of: [defineField({ name: "cleaverAccessory", title: "Accessory", type: "object", fields: cleaverProductItemFields })],
      description: "Compatible accessories from the manufacturer product page.",
    }),
    defineField({
      name: "cleaverWorksWith",
      title: "Cleaver / Thistle - Works With",
      type: "array",
      of: [defineField({ name: "cleaverWorksWithItem", title: "Compatible Product", type: "object", fields: cleaverProductItemFields })],
      description: "Products listed specifically in the manufacturer's Works With section; excludes Related products.",
    }),
    defineField({
      name: "cleaverVideos",
      title: "Cleaver / Thistle - Product Videos",
      type: "array",
      of: [
        defineField({
          name: "cleaverVideo",
          title: "Product Video",
          type: "object",
          fields: [
            defineField({ name: "title", title: "Title", type: "string" }),
            defineField({ name: "url", title: "Source URL", type: "url" }),
            defineField({ name: "embedUrl", title: "Embed URL", type: "url" }),
          ],
        }),
      ],
    }),
    defineField({
      name: "cleaverSourceSectionsMigratedAt",
      title: "Cleaver Source Sections Migrated At",
      type: "datetime",
      readOnly: true,
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
