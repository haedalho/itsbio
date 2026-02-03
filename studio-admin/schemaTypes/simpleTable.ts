import { defineField, defineType } from "sanity";

/**
 * Lightweight table structure for easy migration from brand sites.
 * (Good enough for product pages: spec tables, pricing tables, comparison tables)
 */
export default defineType({
  name: "simpleTable",
  title: "Table",
  type: "object",
  fields: [
    defineField({ name: "caption", title: "Caption", type: "string" }),
    defineField({
      name: "rows",
      title: "Rows",
      type: "array",
      of: [
        defineField({
          name: "row",
          title: "Row",
          type: "object",
          fields: [
            defineField({
              name: "cells",
              title: "Cells",
              type: "array",
              of: [{ type: "string" }],
              validation: (r) => r.min(1),
            }),
            defineField({
              name: "isHeader",
              title: "Header row",
              type: "boolean",
              initialValue: false,
            }),
          ],
          preview: {
            select: { cells: "cells", isHeader: "isHeader" },
            prepare({ cells, isHeader }) {
              return {
                title: (cells || []).join(" | ") || "(empty row)",
                subtitle: isHeader ? "Header" : "",
              };
            },
          },
        }),
      ],
    }),
  ],
});
