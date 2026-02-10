"use client";

import * as React from "react";
import HtmlContent from "@/components/site/HtmlContent";

type Doc = { url: string; label: string };

function hasMeaningfulHtml(html?: string) {
  const t = (html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return t.length > 0;
}

export default function ProductTabsClient({
  specsHtml,
  datasheetHtml,
  documentsHtml,
  documents,
  faqsHtml,
  referencesHtml,
  reviewsHtml,
}: {
  specsHtml?: string;
  datasheetHtml?: string;
  documentsHtml?: string;
  documents?: Doc[];
  faqsHtml?: string;
  referencesHtml?: string;
  reviewsHtml?: string;
}) {
  const tabs = React.useMemo(() => {
    return [
      { key: "specs", label: "Specifications", enabled: hasMeaningfulHtml(specsHtml) },
      { key: "datasheet", label: "Datasheet", enabled: hasMeaningfulHtml(datasheetHtml) },
      {
        key: "documents",
        label: "Documents",
        enabled: (documents?.length || 0) > 0 || hasMeaningfulHtml(documentsHtml),
      },
      { key: "faqs", label: "FAQs", enabled: hasMeaningfulHtml(faqsHtml) },
      { key: "references", label: "References", enabled: hasMeaningfulHtml(referencesHtml) },
      { key: "reviews", label: "Reviews", enabled: hasMeaningfulHtml(reviewsHtml) },
    ];
  }, [specsHtml, datasheetHtml, documentsHtml, documents, faqsHtml, referencesHtml, reviewsHtml]);

  const firstEnabled = tabs.find((x) => x.enabled)?.key || "specs";
  const [active, setActive] = React.useState<string>(firstEnabled);

  React.useEffect(() => {
    // 현재 탭이 disabled가 되면 첫 enabled로 이동
    const ok = tabs.some((x) => x.key === active && x.enabled);
    if (!ok) setActive(firstEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstEnabled, tabs.map((t) => `${t.key}:${t.enabled}`).join("|")]);

  const panelHtml = (() => {
    if (active === "specs") return specsHtml;
    if (active === "datasheet") return datasheetHtml;
    if (active === "documents") return documentsHtml;
    if (active === "faqs") return faqsHtml;
    if (active === "references") return referencesHtml;
    if (active === "reviews") return reviewsHtml;
    return specsHtml;
  })();

  return (
    <section className="mt-8">
      {/* ✅ 탭 + 내용 한 박스로 묶기 */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {/* Tabs bar */}
        <div className="border-b border-neutral-200 bg-white px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => {
              const isActive = active === t.key;
              const disabled = !t.enabled;

              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => !disabled && setActive(t.key)}
                  className={[
                    "inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition",
                    disabled
                      ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                      : isActive
                      ? "bg-orange-600 text-white"
                      : "bg-neutral-100 text-neutral-800 hover:bg-neutral-200",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {active === "documents" ? (
            <div className="space-y-6">
              {(documents?.length || 0) > 0 ? (
                <div>
                  <div className="text-sm font-semibold text-neutral-900">Downloads</div>
                  <ul className="mt-3 space-y-2">
                    {documents!.map((d) => (
                      <li key={d.url}>
                        <a
                          className="text-sm font-semibold text-orange-700 underline underline-offset-4"
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {d.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {hasMeaningfulHtml(documentsHtml) ? (
                <div className="prose max-w-none">
                  <HtmlContent html={documentsHtml!} />
                </div>
              ) : null}

              {(documents?.length || 0) === 0 && !hasMeaningfulHtml(documentsHtml) ? (
                <div className="text-sm text-neutral-600">No documents available.</div>
              ) : null}
            </div>
          ) : hasMeaningfulHtml(panelHtml || "") ? (
            <div className="prose max-w-none">
              <HtmlContent html={panelHtml as string} />
            </div>
          ) : (
            <div className="text-sm text-neutral-600">No content available.</div>
          )}
        </div>
      </div>
    </section>
  );
}
