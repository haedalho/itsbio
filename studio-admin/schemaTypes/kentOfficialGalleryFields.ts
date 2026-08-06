import { defineField } from "sanity";

const kentOfficialGalleryFields = [
  defineField({
    name: "kentOfficialGalleryStatus",
    title: "Kent Official Gallery Status",
    type: "string",
    options: {
      list: [
        { title: "Unverified", value: "UNVERIFIED" },
        { title: "Staging / Preview", value: "STAGING" },
        { title: "Approved", value: "APPROVED" },
      ],
      layout: "radio",
    },
    initialValue: "UNVERIFIED",
    description:
      "STAGING은 미리보기 전용입니다. APPROVED 상태만 공식 갤러리 승격 작업의 대상이 됩니다.",
  }),
  defineField({
    name: "kentOfficialGallery",
    title: "Kent Official Gallery (Staging)",
    type: "array",
    description:
      "Kent 공식 제품 페이지 상단 갤러리의 원본 URL과 순서만 저장합니다. 본문 이미지, 관련 상품, 썸네일 이미지는 넣지 않습니다.",
    of: [
      defineField({
        name: "kentOfficialGalleryItem",
        title: "Official Gallery Item",
        type: "object",
        fields: [
          defineField({
            name: "sourceUrl",
            title: "Official Source URL",
            type: "url",
            validation: (rule) => rule.required(),
          }),
          defineField({ name: "alt", title: "Alt Text", type: "string" }),
          defineField({
            name: "order",
            title: "Official Order",
            type: "number",
            validation: (rule) => rule.integer().min(0),
          }),
          defineField({ name: "sourceWidth", title: "Source Width", type: "number", readOnly: true }),
          defineField({ name: "sourceHeight", title: "Source Height", type: "number", readOnly: true }),
          defineField({
            name: "sourceFingerprint",
            title: "Source Fingerprint",
            type: "string",
            readOnly: true,
          }),
        ],
        preview: {
          select: { title: "alt", subtitle: "sourceUrl" },
          prepare({ title, subtitle }) {
            return { title: title || "Official gallery image", subtitle: subtitle || "" };
          },
        },
      }),
    ],
  }),
  defineField({
    name: "kentOfficialSourceUrl",
    title: "Kent Official Product URL",
    type: "url",
  }),
  defineField({
    name: "kentOfficialGalleryVerifiedAt",
    title: "Kent Official Gallery Verified At",
    type: "datetime",
    readOnly: true,
  }),
  defineField({
    name: "kentOfficialGalleryFingerprint",
    title: "Kent Official Gallery Fingerprint",
    type: "string",
    readOnly: true,
  }),
  defineField({
    name: "kentOfficialGalleryNotes",
    title: "Kent Official Gallery Notes",
    type: "text",
    rows: 4,
  }),
];

export default kentOfficialGalleryFields;
