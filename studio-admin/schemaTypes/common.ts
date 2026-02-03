// studio-admin/schemaTypes/common.ts
import { defineField } from "sanity";

/**
 * 공통: Title + Slug
 * - title만 입력하면 slug 자동
 */
export const fieldTitle = () =>
  defineField({
    name: "title",
    title: "Title",
    type: "string",
    validation: (r) => r.required(),
  });

export const fieldSlug = (source: string = "title") =>
  defineField({
    name: "slug",
    title: "Slug",
    type: "slug",
    options: { source, maxLength: 96 },
    validation: (r) => r.required(),
  });

export const fieldOrder = () =>
  defineField({
    name: "order",
    title: "Order",
    type: "number",
    initialValue: 0,
  });

export const fieldThemeKey = (required = true) =>
  defineField({
    name: "themeKey",
    title: "Theme Key",
    type: "string",
    description: 'ex) "abm", "kentscientifics"... (URL/테마 매칭용)',
    validation: (r) =>
      (required ? r.required() : r).regex(/^[a-z0-9]+$/, { name: "lowercase alnum" }),
  });

export const fieldSourceUrl = () =>
  defineField({
    name: "sourceUrl",
    title: "Source URL (원본 페이지)",
    type: "url",
    description: "원본 페이지 링크(파트너 사이트).",
  });

export const fieldLegacyHtml = () =>
  defineField({
    name: "legacyHtml",
    title: "Legacy HTML (원본 HTML)",
    type: "text",
    rows: 20,
    description: "원본 페이지 HTML. (엔리치/파싱/복원 용도)",
  });

export const fieldIntroText = () =>
  defineField({
    name: "intro",
    title: "Intro (설명 문단)",
    type: "text",
    rows: 4,
    description: "페이지 제목 아래에 표시할 소개 문단",
  });

export const fieldQuickLinks = () =>
  defineField({
    name: "quickLinks",
    title: "Quick Links (상단 링크 묶음)",
    type: "array",
    of: [
      {
        type: "object",
        name: "quickLink",
        fields: [
          { name: "title", title: "Title", type: "string", validation: (r) => r.required() },
          { name: "href", title: "Href", type: "url", validation: (r) => r.required() },
        ],
      },
    ],
  });

export const fieldBullets = () =>
  defineField({
    name: "bullets",
    title: "Bullet Links (리스트 링크)",
    type: "array",
    of: [
      {
        type: "object",
        name: "bulletLink",
        fields: [
          { name: "title", title: "Title", type: "string", validation: (r) => r.required() },
          { name: "href", title: "Href", type: "url", validation: (r) => r.required() },
        ],
      },
    ],
  });

export const fieldResources = () =>
  defineField({
    name: "resources",
    title: "Resource Cards",
    type: "array",
    of: [
      {
        type: "object",
        name: "resourceCard",
        fields: [
          { name: "title", title: "Title", type: "string", validation: (r) => r.required() },
          { name: "subtitle", title: "Subtitle", type: "string" },
          { name: "href", title: "Href", type: "url", validation: (r) => r.required() },
          { name: "image", title: "Image", type: "image", options: { hotspot: true } },
          {
            name: "meta",
            title: "Meta (debug)",
            type: "object",
            fields: [
              { name: "imageUrlRaw", title: "imageUrlRaw", type: "string" },
              { name: "imageUrlUsed", title: "imageUrlUsed", type: "string" },
              { name: "imageStatus", title: "imageStatus", type: "string" },
              { name: "imageReason", title: "imageReason", type: "string" },
            ],
          },
        ],
      },
    ],
  });

export const fieldTopPublications = () =>
  defineField({
    name: "topPublications",
    title: "Top Publications",
    type: "array",
    of: [
      {
        type: "object",
        name: "topPublication",
        fields: [
          { name: "order", title: "Order", type: "number" },
          { name: "citation", title: "Citation", type: "text", rows: 3 },
          { name: "doi", title: "DOI URL", type: "url" },
          { name: "product", title: "Product", type: "string" },
        ],
      },
    ],
  });
