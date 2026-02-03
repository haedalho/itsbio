// components/site/content/ContentBlocks.tsx
import Image from "next/image";
import { PortableText } from "@portabletext/react";
import { urlFor } from "@/lib/sanity/image";

type CTA = {
  _type: "cta";
  label: string;
  href: string;
  variant?: "primary" | "secondary";
  openInNewTab?: boolean;
};

type RichTextBlock = {
  _key?: string;
  _type: "richText";
  title?: string;
  body?: any[]; // PortableText
  ctas?: CTA[];
};

type SimpleTableRow = {
  _type: "row";
  cells: string[];
  isHeader?: boolean;
};

type SimpleTable = {
  _type: "simpleTable";
  caption?: string;
  rows: SimpleTableRow[];
};

type TableSectionBlock = {
  _key?: string;
  _type: "tableSection";
  title?: string;
  table?: SimpleTable;
  ctas?: CTA[];
};

type ImageSectionBlock = {
  _key?: string;
  _type: "imageSection";
  title?: string;
  image?: any; // Sanity image
  ctas?: CTA[];
};

type DownloadsBlock = {
  _key?: string;
  _type: "downloads";
  title?: string;
  files?: Array<{
    _key?: string;
    _type: "file";
    label?: string;
    asset?: { _ref?: string; _type?: "reference" };
  }>;
};

export type ContentBlock = RichTextBlock | TableSectionBlock | ImageSectionBlock | DownloadsBlock;

function SectionCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">{children}</div>;
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={[
        "prose max-w-none",
        "prose-headings:font-semibold prose-headings:text-slate-900",
        "prose-p:text-slate-700 prose-p:leading-7",
        "prose-li:text-slate-700",
        "prose-a:text-slate-900 prose-a:underline-offset-4 hover:prose-a:underline",
        "prose-strong:text-slate-900",
        "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:border",
        "prose-table:w-full prose-table:overflow-hidden",
        "prose-th:bg-slate-50 prose-th:text-slate-900",
        "prose-td:text-slate-700",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function CTAButtons({ ctas }: { ctas?: CTA[] }) {
  if (!ctas?.length) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {ctas.map((c, i) => {
        const primary = c.variant === "primary";
        const cls = primary
          ? "rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          : "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50";

        return (
          <a
            key={`${c.href}-${i}`}
            href={c.href}
            target={c.openInNewTab ? "_blank" : undefined}
            rel={c.openInNewTab ? "noreferrer noopener" : undefined}
            className={cls}
          >
            {c.label}
          </a>
        );
      })}
    </div>
  );
}

function SimpleTableView({ table }: { table?: SimpleTable }) {
  if (!table?.rows?.length) return null;

  return (
    <div className="overflow-auto rounded-xl border border-slate-200">
      <table className="min-w-full border-collapse text-sm">
        <tbody>
          {table.rows.map((r, idx) => {
            const Cell = r.isHeader ? "th" : "td";
            return (
              <tr key={idx} className="border-b last:border-b-0">
                {r.cells.map((cell, j) => (
                  <Cell
                    key={j}
                    className={[
                      "px-3 py-2 align-top",
                      r.isHeader ? "bg-slate-50 font-semibold text-slate-900" : "text-slate-700",
                      "border-r last:border-r-0",
                    ].join(" ")}
                  >
                    {cell}
                  </Cell>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ContentBlocks({ blocks }: { blocks?: ContentBlock[] }) {
  if (!blocks?.length) return null;

  return (
    <div className="space-y-8">
      {blocks.map((b, idx) => {
        const key = (b as any)._key ?? `${b._type}-${idx}`;

        if (b._type === "richText") {
          return (
            <SectionCard key={key}>
              {b.title ? <div className="text-lg font-semibold text-slate-900">{b.title}</div> : null}
              <div className={b.title ? "mt-4" : ""}>
                <Prose>
                  <PortableText value={b.body || []} />
                </Prose>
              </div>
              <CTAButtons ctas={b.ctas} />
            </SectionCard>
          );
        }

        if (b._type === "tableSection") {
          return (
            <SectionCard key={key}>
              {b.title ? <div className="text-lg font-semibold text-slate-900">{b.title}</div> : null}
              <div className={b.title ? "mt-4" : ""}>
                <SimpleTableView table={b.table} />
              </div>
              <CTAButtons ctas={b.ctas} />
            </SectionCard>
          );
        }

        if (b._type === "imageSection") {
          const imgUrl = b.image ? urlFor(b.image as any).width(1600).height(900).fit("max").url() : "";
          return (
            <SectionCard key={key}>
              {b.title ? <div className="text-lg font-semibold text-slate-900">{b.title}</div> : null}
              <div className={b.title ? "mt-4" : ""}>
                {imgUrl ? (
                  <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border bg-white">
                    <Image src={imgUrl} alt={b.title || "image"} fill className="object-contain p-2" />
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">(이미지 없음)</div>
                )}
              </div>
              <CTAButtons ctas={b.ctas} />
            </SectionCard>
          );
        }

        if (b._type === "downloads") {
          return (
            <SectionCard key={key}>
              <div className="text-lg font-semibold text-slate-900">{b.title || "Downloads"}</div>
              <div className="mt-4 space-y-2">
                {b.files?.length ? (
                  b.files.map((f, i) => (
                    <div
                      key={f._key ?? i}
                      className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-sm"
                    >
                      <div className="min-w-0 truncate text-slate-900">{f.label || "File"}</div>
                      <div className="text-xs text-slate-500">asset</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">(다운로드 없음)</div>
                )}
              </div>
            </SectionCard>
          );
        }

        return null;
      })}
    </div>
  );
}
