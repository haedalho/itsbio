"use client";

import * as React from "react";
import HtmlContent from "@/components/site/HtmlContent";

type Doc = { url: string; label: string };
type FaqItem = { q: string; aHtml: string };
type AbmContentContext = { baseUrl?: string; mode?: "abm-detail" | "abm-service" };

function textOnly(html?: string) {
  return (html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function hasUsableHtml(html?: string) {
  const s = (html || "").trim();
  if (!s) return false;

  const low = s.toLowerCase();
  if (low.includes("<table") || low.includes("<tr") || low.includes("<td") || low.includes("<th")) return true;
  if (textOnly(s).length > 0) return true;
  if (s.length >= 80) return true;
  return false;
}

/**
 * ✅ ABM FAQ의 collapse(접힘) 구조를 "답이 보이게" 펼친 상태로 변환 후,
 * Q/A를 뽑아서 우리 아코디언에 넣는다.
 */
function expandCollapse(html?: string) {
  const s = (html || "").trim();
  if (!s) return "";

  try {
    const doc = new DOMParser().parseFromString(s, "text/html");

    // collapse 계열 강제 노출
    doc.querySelectorAll<HTMLElement>(".collapse,.panel-collapse,.accordion-collapse").forEach((el) => {
      el.classList.remove("collapse", "collapsed");
      el.classList.add("show");
      el.removeAttribute("aria-hidden");
      el.setAttribute("aria-expanded", "true");

      // display:none/height:0 같은 inline style 무력화
      el.setAttribute("style", "display:block;height:auto;max-height:none;overflow:visible;visibility:visible;");
    });

    // 답 영역에서 숨김 스타일이 남아있으면 제거
    doc.querySelectorAll<HTMLElement>(".panel-body,.card-body,.accordion-body").forEach((el) => {
      const cur = (el.getAttribute("style") || "").toLowerCase();
      if (cur.includes("display:none") || cur.includes("height:0") || cur.includes("overflow:hidden")) {
        el.setAttribute("style", "display:block;height:auto;overflow:visible;visibility:visible;");
      }
    });

    return doc.body.innerHTML || "";
  } catch {
    return s;
  }
}

function parseFaqItems(html?: string): FaqItem[] {
  const s = expandCollapse(html);
  if (!s.trim()) return [];

  try {
    const doc = new DOMParser().parseFromString(s, "text/html");
    const out: FaqItem[] = [];
    const seen = new Set<string>();

    // 1) panel/card/accordion 구조 우선
    const containers = Array.from(doc.querySelectorAll<HTMLElement>(".panel, .card, .accordion-item"));
    for (const c of containers) {
      const qEl =
        c.querySelector<HTMLElement>(".panel-title a, .card-header a, .accordion-header button, summary, a") || null;
      const aEl =
        c.querySelector<HTMLElement>(".panel-body, .card-body, .accordion-body") ||
        c.querySelector<HTMLElement>(".panel-collapse, .collapse") ||
        null;

      const q = (qEl?.textContent || "").replace(/\s+/g, " ").trim();
      const aHtml = (aEl?.innerHTML || "").trim();

      if (!q) continue;
      if (!aHtml || textOnly(aHtml).length === 0) continue;

      const key = `${q}__${textOnly(aHtml).slice(0, 120)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({ q, aHtml });
    }
    if (out.length) return out;

    // 2) toggle -> target(id) 구조 fallback
    const toggles = Array.from(
      doc.querySelectorAll<HTMLElement>('[data-toggle="collapse"],[data-bs-toggle="collapse"],a[href^="#"]')
    );

    for (const t of toggles) {
      const q = (t.textContent || "").replace(/\s+/g, " ").trim();
      if (!q) continue;

      const href = (t.getAttribute("href") || "").trim();
      const targetId = href.startsWith("#") ? href.slice(1) : "";
      if (!targetId) continue;

      const ans = doc.getElementById(targetId);
      const aHtml = (ans?.innerHTML || "").trim();
      if (!aHtml || textOnly(aHtml).length === 0) continue;

      const key = `${q}__${textOnly(aHtml).slice(0, 120)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({ q, aHtml });
    }

    return out;
  } catch {
    return [];
  }
}

function FaqAccordion({ html, contentContext }: { html: string; contentContext: AbmContentContext }) {
  const items = React.useMemo(() => parseFaqItems(html), [html]);
  const [openIdx, setOpenIdx] = React.useState<number>(0);

  // 파싱 실패하면 "펼친 HTML"을 그대로 보여주되, HtmlContent로 렌더(디자인 유지)
  if (!items.length) {
    return <HtmlContent html={expandCollapse(html)} {...contentContext} />;
  }

  return (
    <div className="space-y-3">
      {items.map((it, idx) => {
        const open = idx === openIdx;

        return (
          <div
            key={`${idx}-${it.q}`}
            className={[
              "rounded-2xl border transition",
              open ? "border-orange-200 bg-orange-50/60" : "border-neutral-200 bg-white hover:bg-neutral-50/70",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={() => setOpenIdx(open ? -1 : idx)}
              className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
            >
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold",
                    open ? "border-orange-200 bg-white text-orange-700" : "border-neutral-200 bg-white text-neutral-500",
                  ].join(" ")}
                >
                  Q
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-semibold text-neutral-900">{it.q}</div>
                  <div className="mt-1 text-xs text-neutral-500">{open ? "Click to collapse" : "Click to expand"}</div>
                </div>
              </div>

              <div
                className={[
                  "mt-1 flex h-8 w-8 items-center justify-center rounded-full border transition",
                  open ? "border-orange-200 bg-white text-orange-700" : "border-neutral-200 bg-white text-neutral-500",
                ].join(" ")}
                aria-hidden
              >
                {open ? "−" : "+"}
              </div>
            </button>

            {open ? (
              <div className="px-5 pb-5">
                <div className="rounded-xl border border-orange-100 bg-white px-4 py-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">
                      A
                    </div>
                    <div className="text-sm font-semibold text-neutral-900">Answer</div>
                  </div>

                  {/* ✅ 여기서 딱 1번만 렌더 → 중복 절대 없음 + 기존 HtmlContent 스타일 유지 */}
                  <HtmlContent html={it.aHtml} {...contentContext} />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function ProductTabsClient({
  overviewHtml,
  specsHtml,
  serviceDetailsHtml,
  datasheetHtml,
  documentsHtml,
  documents,
  faqsHtml,
  referencesHtml,
  reviewsHtml,
  sourceUrl,
  kind = "product",
}: {
  overviewHtml?: string;
  specsHtml?: string;
  serviceDetailsHtml?: string;
  datasheetHtml?: string;
  documentsHtml?: string;
  documents?: Doc[];
  faqsHtml?: string;
  referencesHtml?: string;
  reviewsHtml?: string;
  sourceUrl?: string;
  kind?: "product" | "service";
}) {
  const contentContext = React.useMemo<AbmContentContext>(() => ({
    baseUrl: sourceUrl,
    mode: kind === "service" ? "abm-service" : "abm-detail",
  }), [sourceUrl, kind]);
  const tabs = React.useMemo(() => {
    return [
      { key: "overview", label: "Overview", enabled: hasUsableHtml(overviewHtml) },
      { key: "specs", label: "Specifications", enabled: hasUsableHtml(specsHtml) },
      { key: "service", label: "Service Details", enabled: hasUsableHtml(serviceDetailsHtml) },
      { key: "datasheet", label: "Datasheet", enabled: hasUsableHtml(datasheetHtml) },
      {
        key: "documents",
        label: "Documents",
        enabled: (documents?.length || 0) > 0 || hasUsableHtml(documentsHtml),
      },
      { key: "faqs", label: "FAQs", enabled: hasUsableHtml(faqsHtml) },
      { key: "references", label: "References", enabled: hasUsableHtml(referencesHtml) },
      { key: "reviews", label: "Reviews", enabled: hasUsableHtml(reviewsHtml) },
    ];
  }, [overviewHtml, specsHtml, serviceDetailsHtml, datasheetHtml, documentsHtml, documents, faqsHtml, referencesHtml, reviewsHtml]);

  const firstEnabled = tabs.find((x) => x.enabled)?.key || "specs";
  const [active, setActive] = React.useState<string>(firstEnabled);

  React.useEffect(() => {
    const ok = tabs.some((x) => x.key === active && x.enabled);
    if (!ok) setActive(firstEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstEnabled, tabs.map((t) => `${t.key}:${t.enabled}`).join("|")]);

  return (
    <section className="mt-8">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_-38px_rgba(15,23,42,0.45)]">
        <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-3 md:px-5">
          <div className="scrollbar-hidden flex gap-2 overflow-x-auto" role="tablist" aria-label="Product information">
            {tabs.map((t) => {
              const isActive = active === t.key;
              const disabled = !t.enabled;

              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-disabled={disabled}
                  disabled={disabled}
                  onClick={() => !disabled && setActive(t.key)}
                  className={[
                    "inline-flex h-10 shrink-0 items-center justify-center rounded-full border px-4 text-sm font-semibold transition",
                    disabled
                      ? "cursor-not-allowed border-transparent bg-transparent text-slate-400"
                      : isActive
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-700",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-6 md:px-8 md:py-8">
          {active === "overview" && hasUsableHtml(overviewHtml) ? (
            <HtmlContent html={overviewHtml as string} {...contentContext} />
          ) : active === "service" && hasUsableHtml(serviceDetailsHtml) ? (
            <HtmlContent html={serviceDetailsHtml as string} {...contentContext} />
          ) : active === "documents" ? (
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

              {hasUsableHtml(documentsHtml) ? <HtmlContent html={documentsHtml as string} {...contentContext} /> : null}
              {(documents?.length || 0) === 0 && !hasUsableHtml(documentsHtml) ? (
                <div className="text-sm text-neutral-600">No documents available.</div>
              ) : null}
            </div>
          ) : active === "faqs" && hasUsableHtml(faqsHtml) ? (
            <FaqAccordion html={faqsHtml as string} contentContext={contentContext} />
          ) : active === "specs" && hasUsableHtml(specsHtml) ? (
            <HtmlContent html={specsHtml as string} {...contentContext} />
          ) : active === "datasheet" && hasUsableHtml(datasheetHtml) ? (
            <HtmlContent html={datasheetHtml as string} {...contentContext} />
          ) : active === "references" && hasUsableHtml(referencesHtml) ? (
            <HtmlContent html={referencesHtml as string} {...contentContext} />
          ) : active === "reviews" && hasUsableHtml(reviewsHtml) ? (
            <HtmlContent html={reviewsHtml as string} {...contentContext} />
          ) : (
            <div className="text-sm text-neutral-600">No content available.</div>
          )}
        </div>
      </div>
    </section>
  );
}
