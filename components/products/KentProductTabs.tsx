"use client";

type Doc = { url: string; label: string };

function cleanText(input?: string) {
  return String(input || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasHtml(html?: string) {
  return cleanText(String(html || "")).length > 0;
}

function HtmlBlock({ html }: { html?: string }) {
  if (!hasHtml(html)) return null;

  return (
    <div
      className="prose prose-slate max-w-none prose-a:text-[#0b4fb3] prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-[#083b85] prose-headings:text-[#0b4fb3] prose-p:leading-7 prose-li:leading-7 prose-table:w-full prose-table:border-collapse prose-th:border prose-th:border-slate-300 prose-th:bg-slate-50 prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-slate-300 prose-td:px-3 prose-td:py-2"
      dangerouslySetInnerHTML={{ __html: String(html || "") }}
    />
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t-4 border-[#0b4fb3] bg-white px-0 py-8">
      <h2 className="text-[28px] font-semibold tracking-[-0.02em] text-[#0b4fb3]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function KentProductTabs({
  title,
  descriptionHtml,
  specsHtml,
  datasheetHtml,
  documentsHtml,
  faqsHtml,
  referencesHtml,
  reviewsHtml,
  documents,
}: {
  title: string;
  descriptionHtml?: string;
  specsHtml?: string;
  datasheetHtml?: string;
  documentsHtml?: string;
  faqsHtml?: string;
  referencesHtml?: string;
  reviewsHtml?: string;
  documents?: Doc[];
}) {
  const hasDocumentsList = Array.isArray(documents) && documents.length > 0;
  const sections = [
    hasHtml(descriptionHtml) ? { id: "overview", label: "Overview" } : null,
    hasHtml(specsHtml) ? { id: "specifications", label: "Specifications" } : null,
    hasHtml(datasheetHtml) ? { id: "datasheet", label: "Datasheet" } : null,
    hasHtml(documentsHtml) || hasDocumentsList ? { id: "documents", label: "Documents" } : null,
    hasHtml(faqsHtml) ? { id: "faqs", label: "FAQs" } : null,
    hasHtml(referencesHtml) ? { id: "references", label: "References" } : null,
    hasHtml(reviewsHtml) ? { id: "reviews", label: "Reviews" } : null,
  ].filter(Boolean) as Array<{ id: string; label: string }>;

  if (!sections.length) return null;

  return (
    <div className="mt-12 space-y-10">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="inline-flex items-center border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            {section.label}
          </a>
        ))}
      </div>

      {hasHtml(descriptionHtml) ? (
        <Section id="overview" title={`About ${title}`}>
          <HtmlBlock html={descriptionHtml} />
        </Section>
      ) : null}

      {hasHtml(specsHtml) ? (
        <Section id="specifications" title="Specifications">
          <HtmlBlock html={specsHtml} />
        </Section>
      ) : null}

      {hasHtml(datasheetHtml) ? (
        <Section id="datasheet" title="Datasheet">
          <HtmlBlock html={datasheetHtml} />
        </Section>
      ) : null}

      {hasHtml(documentsHtml) || hasDocumentsList ? (
        <Section id="documents" title="Documents & Resources">
          {hasDocumentsList ? (
            <div className="mb-6 grid gap-3">
              {(documents || []).map((doc, idx) => (
                <a
                  key={`${doc.url}-${idx}`}
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-between border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-white"
                >
                  <span className="truncate pr-4">{doc.label}</span>
                  <span className="shrink-0 font-semibold text-[#0b4fb3]">Open</span>
                </a>
              ))}
            </div>
          ) : null}

          <HtmlBlock html={documentsHtml} />
        </Section>
      ) : null}

      {hasHtml(faqsHtml) ? (
        <Section id="faqs" title="FAQs">
          <HtmlBlock html={faqsHtml} />
        </Section>
      ) : null}

      {hasHtml(referencesHtml) ? (
        <Section id="references" title="References">
          <HtmlBlock html={referencesHtml} />
        </Section>
      ) : null}

      {hasHtml(reviewsHtml) ? (
        <Section id="reviews" title="Reviews">
          <HtmlBlock html={reviewsHtml} />
        </Section>
      ) : null}
    </div>
  );
}
