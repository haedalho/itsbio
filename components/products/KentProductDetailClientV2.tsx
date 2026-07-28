"use client";

import * as React from "react";

import KentProductGalleryClient from "@/components/products/KentProductGalleryClient";
import KentProductSectionRendererV2, {
  type KentSection,
} from "@/components/products/KentProductSectionRendererV2";

type Img = { url?: string; alt?: string };
type Doc = { url?: string; label?: string; title?: string };
type OptionValue = { value?: string; label?: string };
type OptionGroup = {
  key?: string;
  name?: string;
  label?: string;
  displayType?: string;
  options?: OptionValue[];
};
type VariantPair = { key?: string; label?: string; value?: string };
type Variant = {
  variantId?: string;
  title?: string;
  sku?: string;
  catNo?: string;
  optionSummary?: string;
  optionValues?: Record<string, string> | VariantPair[];
  attributes?: Record<string, string> | VariantPair[];
  imageUrl?: string;
  sourceVariationId?: string;
};

function slugifyLoose(input: string) {
  return String(input || "")
    .toLowerCase()
    .replace(/&amp;/gi, "and")
    .replace(/&/g, "and")
    .replace(/[®™]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeKey(input: string) {
  return String(input || "").replace(/^attribute_/i, "").replace(/^pa_/i, "").trim().toLowerCase();
}

function normalizeValue(input: string) {
  const raw = String(input || "").trim();
  return slugifyLoose(raw) || raw.toLowerCase();
}

function safeExternalUrl(url?: string) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `https://www.kentscientific.com${raw}`;
  return raw;
}

function dedupeImages(images: Img[]) {
  const seen = new Set<string>();
  return (images || []).filter((img) => {
    const key = String(img?.url || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }) as { url: string; alt?: string }[];
}

function pairArrayToMap(input: Record<string, string> | VariantPair[] | undefined) {
  if (!input) return {} as Record<string, string>;
  if (Array.isArray(input)) {
    const out: Record<string, string> = {};
    for (const row of input) {
      const key = normalizeKey(String(row?.key || row?.label || ""));
      const value = normalizeValue(String(row?.value || ""));
      if (key && value) out[key] = value;
    }
    return out;
  }
  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = normalizeKey(rawKey);
    const value = normalizeValue(String(rawValue || ""));
    if (key && value) out[key] = value;
  }
  return out;
}

function buildVariantLookup(variant: Variant) {
  return { ...pairArrayToMap(variant?.attributes), ...pairArrayToMap(variant?.optionValues) };
}

function variantMatchesSelections(variant: Variant, selections: Record<string, string>) {
  const lookup = buildVariantLookup(variant);
  for (const [key, value] of Object.entries(selections)) {
    if (!value) continue;
    if (!lookup[key] || lookup[key] !== value) return false;
  }
  return true;
}

function findMatchingVariant(variants: Variant[], selections: Record<string, string>) {
  return variants.find((variant) => variantMatchesSelections(variant, selections)) || null;
}

function buildInitialSelections(optionGroups: OptionGroup[], variants: Variant[], defaultVariantId?: string) {
  const seed = (defaultVariantId ? variants.find((row) => row.variantId === defaultVariantId) : null) || variants[0] || null;
  const seedLookup = seed ? buildVariantLookup(seed) : {};
  const out: Record<string, string> = {};
  for (const group of optionGroups) {
    const key = normalizeKey(group.key || group.name || "option");
    const first = (group.options || []).find((row) => row?.label || row?.value);
    out[key] = seedLookup[key] || normalizeValue(first?.value || first?.label || "");
  }
  return out;
}

function pickOptionLabel(group: OptionGroup, selectedValue: string) {
  const matched = (group.options || []).find((row) => normalizeValue(String(row?.value || row?.label || "")) === selectedValue);
  return matched?.label || matched?.value || selectedValue;
}

function normalizeDocs(documents?: Doc[]) {
  return Array.isArray(documents)
    ? documents.filter((row) => row?.url).map((row) => ({ url: String(row.url), label: String(row.label || row.title || row.url) }))
    : [];
}

function shouldUseSelect(group: OptionGroup) {
  const type = String(group.displayType || "").toLowerCase();
  return type === "select" || type === "dropdown" || (group.options || []).length > 6;
}

export default function KentProductDetailClientV2({
  slug,
  title,
  summary,
  sku,
  badge,
  leadHtml,
  categoryLabel,
  images,
  kentSections,
  descriptionHtml,
  specsHtml,
  datasheetHtml,
  documentsHtml,
  faqsHtml,
  referencesHtml,
  reviewsHtml,
  documents,
  productType,
  defaultVariantId,
  optionGroups,
  variants,
}: {
  slug: string;
  title: string;
  summary?: string;
  sku?: string;
  badge?: string;
  leadHtml?: string;
  categoryLabel?: string;
  images: Img[];
  kentSections?: KentSection[];
  descriptionHtml?: string;
  specsHtml?: string;
  datasheetHtml?: string;
  documentsHtml?: string;
  faqsHtml?: string;
  referencesHtml?: string;
  reviewsHtml?: string;
  documents?: Doc[];
  productType?: string;
  defaultVariantId?: string;
  optionGroups?: OptionGroup[];
  variants?: Variant[];
}) {
  const safeGroups = React.useMemo(
    () => (Array.isArray(optionGroups) ? optionGroups.filter((row) => (row.options || []).length > 0) : []),
    [optionGroups],
  );
  const safeVariants = React.useMemo(
    () => (Array.isArray(variants) ? variants.filter((row) => row?.variantId || row?.sku || row?.catNo || row?.optionSummary) : []),
    [variants],
  );
  const [selections, setSelections] = React.useState<Record<string, string>>(() => buildInitialSelections(safeGroups, safeVariants, defaultVariantId));

  React.useEffect(() => {
    setSelections(buildInitialSelections(safeGroups, safeVariants, defaultVariantId));
  }, [safeGroups, safeVariants, defaultVariantId]);

  const hasVariantControls = (productType === "variant" || safeVariants.length > 0 || safeGroups.length > 0) && safeGroups.length > 0;
  const selectedVariant = React.useMemo(
    () => (hasVariantControls ? findMatchingVariant(safeVariants, selections) : safeVariants[0] || null),
    [hasVariantControls, safeVariants, selections],
  );
  const isOptionAvailable = React.useCallback(
    (groupKey: string, value: string) => {
      if (!safeVariants.length) return true;
      return safeVariants.some((variant) => variantMatchesSelections(variant, { ...selections, [groupKey]: value }));
    },
    [safeVariants, selections],
  );

  const itemNo = selectedVariant?.catNo || selectedVariant?.sku || (!hasVariantControls ? sku : "") || "";
  const selectedSummary = selectedVariant?.optionSummary || "";
  const invalidCombination = hasVariantControls && safeVariants.length > 0 && !selectedVariant;
  const galleryImages = React.useMemo(() => {
    const variantImage = safeExternalUrl(selectedVariant?.imageUrl);
    const head = variantImage ? [{ url: variantImage, alt: selectedVariant?.title || title }] : [];
    return dedupeImages([...(head as Img[]), ...(images || [])]);
  }, [images, selectedVariant?.imageUrl, selectedVariant?.title, title]);
  const safeDocs = React.useMemo(() => normalizeDocs(documents), [documents]);
  const quoteHref = `mailto:info@itsbio.co.kr?subject=${encodeURIComponent(`Kent ${title} 견적 문의`)}`;

  return (
    <div className="pb-12">
      <section className="pb-12 pt-2 md:pb-16 md:pt-5">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] xl:gap-16">
          <KentProductGalleryClient
            key={`${selectedVariant?.variantId || "base"}-${galleryImages[0]?.url || ""}`}
            productSlug={slug}
            images={galleryImages}
            title={title}
          />

          <div className="min-w-0 lg:pt-1">
            {badge ? (
              <div className="inline-flex bg-[#f5a400] px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-white">{badge}</div>
            ) : null}

            <h1 className={`${badge ? "mt-4" : "mt-0"} text-[35px] font-semibold tracking-[-0.035em] text-[#0a4d96] lg:text-[45px]`}>{title}</h1>
            {summary ? <p className="mt-2 text-[20px] font-semibold leading-8 text-slate-600">{summary}</p> : null}

            <a href={quoteHref} className="mt-7 inline-flex min-h-[48px] min-w-[210px] items-center justify-center bg-[#0b5baa] px-7 py-3 text-[16px] font-semibold text-white transition hover:bg-[#08467f]">
              Request Quote
            </a>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
              <div><span className="font-semibold text-slate-900">Item # </span>{invalidCombination ? "Select an available combination" : itemNo || "Contact for details"}</div>
              {categoryLabel ? <div><span className="font-semibold text-slate-900">Category: </span>{categoryLabel}</div> : null}
            </div>

            {leadHtml ? (
              <div
                className="mt-5 text-[16px] leading-7 text-slate-600 [&_a]:font-semibold [&_a]:text-[#0b5baa] [&_p]:mb-4 [&_p:last-child]:mb-0 [&_strong]:text-slate-800"
                dangerouslySetInnerHTML={{ __html: leadHtml }}
              />
            ) : null}
            {selectedSummary ? <div className="mt-4 text-sm leading-6 text-slate-600">{selectedSummary}</div> : null}

            {hasVariantControls ? (
              <div className="mt-7 space-y-5 border-t border-slate-200 pt-6">
                {safeGroups.map((group) => {
                  const key = normalizeKey(group.key || group.name || "option");
                  const selected = selections[key] || "";
                  const options = group.options || [];
                  return (
                    <div key={key}>
                      <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-slate-900">{group.label || group.name || "Option"}</label>
                      {shouldUseSelect(group) ? (
                        <select value={selected} onChange={(event) => setSelections((prev) => ({ ...prev, [key]: event.target.value }))} className="min-h-[46px] w-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#0b5baa]">
                          {options.map((row, index) => {
                            const value = normalizeValue(String(row?.value || row?.label || `option-${index}`));
                            const label = row?.label || row?.value || `Option ${index + 1}`;
                            return <option key={`${key}-${value}-${index}`} value={value} disabled={!isOptionAvailable(key, value)}>{label}</option>;
                          })}
                        </select>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {options.map((row, index) => {
                            const value = normalizeValue(String(row?.value || row?.label || `option-${index}`));
                            const active = value === selected;
                            const available = isOptionAvailable(key, value);
                            const label = row?.label || row?.value || `Option ${index + 1}`;
                            return (
                              <button key={`${key}-${value}-${index}`} type="button" disabled={!available} onClick={() => setSelections((prev) => ({ ...prev, [key]: value }))} className={`inline-flex min-h-[42px] items-center justify-center border px-4 py-2 text-sm transition ${active ? "border-[#0b5baa] bg-[#0b5baa] text-white" : available ? "border-slate-300 bg-white text-slate-800 hover:border-[#0b5baa]" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"}`}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {safeGroups.length ? (
              <div className="mt-5 space-y-1 text-sm text-slate-600">
                {safeGroups.map((group) => {
                  const key = normalizeKey(group.key || group.name || "option");
                  return <div key={`selected-${key}`} className="flex gap-2"><span className="font-semibold uppercase text-slate-900">{group.label || group.name || "Option"}:</span><span>{pickOptionLabel(group, selections[key] || "")}</span></div>;
                })}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <KentProductSectionRendererV2
        title={title}
        sections={kentSections}
        descriptionHtml={descriptionHtml}
        specsHtml={specsHtml}
        datasheetHtml={datasheetHtml}
        documentsHtml={documentsHtml}
        faqsHtml={faqsHtml}
        referencesHtml={referencesHtml}
        reviewsHtml={reviewsHtml}
        documents={safeDocs}
      />
    </div>
  );
}
