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
  const raw = String(input || "")
    .replace(/^attribute[-_]/i, "")
    .replace(/^pa[-_]/i, "")
    .trim();
  return slugifyLoose(raw) || raw.toLowerCase();
}

function normalizeValue(input: string) {
  const raw = String(input || "").trim();
  return slugifyLoose(raw) || raw.toLowerCase();
}

function safeVariantImageUrl(url?: string) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/")) return raw.startsWith("//") ? "" : raw;
  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.toLowerCase();
    const allowedHost =
      hostname === "cdn.sanity.io" ||
      hostname === "www.kentscientific.com" ||
      hostname === "kentscientific.com";
    return parsed.protocol === "https:" && allowedHost ? raw : "";
  } catch {
    return "";
  }
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

function selectionEntries(selections: Record<string, string>) {
  return Object.entries(selections).filter(([key, value]) => Boolean(key && value));
}

function variantMatchesSelections(variant: Variant, selections: Record<string, string>) {
  const entries = selectionEntries(selections);
  if (!entries.length) return true;

  const lookup = buildVariantLookup(variant);
  if (entries.every(([key, value]) => lookup[key] === value)) return true;

  const lookupValues = new Set(Object.values(lookup).filter(Boolean));
  return entries.every(([, value]) => lookupValues.has(value));
}

function findMatchingVariant(variants: Variant[], selections: Record<string, string>) {
  const entries = selectionEntries(selections);
  if (!variants.length) return null;
  if (!entries.length) return variants[0] || null;

  const exact = variants.find((variant) => {
    const lookup = buildVariantLookup(variant);
    return entries.every(([key, value]) => lookup[key] === value);
  });
  if (exact) return exact;

  const byValues = variants.find((variant) => variantMatchesSelections(variant, selections));
  if (byValues) return byValues;

  return (
    variants.find((variant) => {
      const searchable = normalizeValue(
        [variant?.optionSummary, variant?.title, variant?.sku, variant?.catNo]
          .filter(Boolean)
          .join(" "),
      );
      return entries.every(([, value]) => searchable.includes(value));
    }) || null
  );
}

function buildInitialSelections(optionGroups: OptionGroup[], variants: Variant[], defaultVariantId?: string) {
  const seed = (defaultVariantId ? variants.find((row) => row.variantId === defaultVariantId) : null) || variants[0] || null;
  const seedLookup = seed ? buildVariantLookup(seed) : {};
  const seedValues = new Set(Object.values(seedLookup).filter(Boolean));
  const out: Record<string, string> = {};

  for (const group of optionGroups) {
    const key = normalizeKey(group.key || group.name || group.label || "option");
    const options = group.options || [];
    const matchingSeedOption = options.find((row) => {
      const value = normalizeValue(String(row?.value || row?.label || ""));
      return value && seedValues.has(value);
    });
    const first = matchingSeedOption || options.find((row) => row?.label || row?.value);
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
  verifiedGallery,
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
  verifiedGallery?: boolean;
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
    const variantImage = safeVariantImageUrl(selectedVariant?.imageUrl);
    const head = variantImage ? [{ url: variantImage, alt: selectedVariant?.title || title }] : [];
    return dedupeImages([...(head as Img[]), ...(images || [])]);
  }, [images, selectedVariant?.imageUrl, selectedVariant?.title, title]);
  const safeDocs = React.useMemo(() => normalizeDocs(documents), [documents]);
  const quoteHref = "/contact";

  return (
    <div className="pb-8">
      <section className="pb-12 pt-1 md:pb-16 md:pt-3">
        <div className="grid items-start gap-9 lg:grid-cols-2 lg:gap-14 xl:gap-[68px]">
          <KentProductGalleryClient
            key={`${selectedVariant?.variantId || "base"}-${galleryImages[0]?.url || ""}`}
            productSlug={slug}
            images={galleryImages}
            title={title}
            verifiedGallery={verifiedGallery}
          />

          <div className="min-w-0 rounded-3xl border border-[#e2e9f0] bg-white px-6 py-7 shadow-[0_18px_55px_rgba(17,53,87,0.07)] sm:px-8 sm:py-9 lg:mt-1">
            {badge ? (
              <div className="inline-flex rounded-full bg-[#fff0c9] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a5b00]">{badge}</div>
            ) : null}

            <h1 className={`${badge ? "mt-4" : "mt-0"} text-[36px] font-semibold leading-[1.1] tracking-[-0.04em] text-[#084b94] md:text-[42px]`}>{title}</h1>
            {summary ? <p className="mt-4 text-[18px] font-semibold leading-7 text-[#3d4852]">{summary}</p> : null}

            <a href={quoteHref} className="mt-7 inline-flex min-h-[52px] min-w-[210px] items-center justify-center gap-2 rounded-xl bg-[#0b5baa] px-7 py-3 text-[15px] font-bold text-white shadow-[0_10px_24px_rgba(11,91,170,0.22)] transition hover:-translate-y-0.5 hover:bg-[#08467f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b5baa] focus-visible:ring-offset-2">
              Request Quote <span aria-hidden>→</span>
            </a>

            <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-[#e0e7ed] pb-5 text-[13px] text-[#55616b]">
              <div className="rounded-full bg-[#f1f6fa] px-3.5 py-2"><span className="font-semibold text-[#263542]">Item # </span>{invalidCombination ? "Select an available combination" : itemNo || "Contact for details"}</div>
              {categoryLabel ? <div className="rounded-full bg-[#f1f6fa] px-3.5 py-2"><span className="font-semibold text-[#263542]">Category: </span>{categoryLabel}</div> : null}
            </div>

            {leadHtml ? (
              <div
                className="kent-product-intro mt-6 text-[15.5px] leading-[1.78] text-[#55616b] [&_a]:font-semibold [&_a]:text-[#0b5baa] [&_a]:underline [&_a]:underline-offset-2 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_strong]:text-[#30363b]"
                dangerouslySetInnerHTML={{ __html: leadHtml }}
              />
            ) : null}
            {selectedSummary ? <div className="mt-4 text-sm leading-6 text-slate-600">{selectedSummary}</div> : null}

            {hasVariantControls ? (
              <div className="mt-7 space-y-5 border-t border-slate-200 pt-6">
                {safeGroups.map((group) => {
                  const key = normalizeKey(group.key || group.name || group.label || "option");
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
                  const key = normalizeKey(group.key || group.name || group.label || "option");
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
