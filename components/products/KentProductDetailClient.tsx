"use client";

import * as React from "react";

import ProductGalleryClient from "@/components/products/ProductGalleryClient";
import ProductTabsClient from "@/components/products/ProductTabs";

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
  return String(input || "")
    .replace(/^attribute_/i, "")
    .replace(/^pa_/i, "")
    .trim()
    .toLowerCase();
}

function normalizeValue(input: string) {
  const raw = String(input || "").trim();
  return slugifyLoose(raw) || raw.toLowerCase();
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
      const k = normalizeKey(String(row?.key || row?.label || ""));
      const v = normalizeValue(String(row?.value || ""));
      if (k && v) out[k] = v;
    }
    return out;
  }
  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const k = normalizeKey(rawKey);
    const v = normalizeValue(String(rawValue || ""));
    if (k && v) out[k] = v;
  }
  return out;
}

function buildVariantLookup(variant: Variant) {
  return {
    ...pairArrayToMap(variant?.attributes),
    ...pairArrayToMap(variant?.optionValues),
  };
}

function findMatchingVariant(variants: Variant[], selections: Record<string, string>) {
  if (!variants.length) return null;

  return (
    variants.find((variant) => {
      const lookup = buildVariantLookup(variant);
      for (const [key, value] of Object.entries(selections)) {
        if (!value) continue;
        if (lookup[key] && lookup[key] !== value) return false;
      }
      return true;
    }) || null
  );
}

function buildInitialSelections(optionGroups: OptionGroup[], variants: Variant[], defaultVariantId?: string) {
  const seed =
    (defaultVariantId ? variants.find((row) => row.variantId === defaultVariantId) : null) || variants[0] || null;
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
  const matched = (group.options || []).find(
    (row) => normalizeValue(String(row?.value || row?.label || "")) === selectedValue
  );
  return matched?.label || matched?.value || selectedValue;
}

export default function KentProductDetailClient({
  title,
  summary,
  sku,
  images,
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
  title: string;
  summary?: string;
  sku?: string;
  images: Img[];
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
    [optionGroups]
  );

  const safeVariants = React.useMemo(
    () =>
      Array.isArray(variants)
        ? variants.filter((row) => row?.variantId || row?.sku || row?.catNo || row?.optionSummary)
        : [],
    [variants]
  );

  const [selections, setSelections] = React.useState<Record<string, string>>(() =>
    buildInitialSelections(safeGroups, safeVariants, defaultVariantId)
  );

  React.useEffect(() => {
    setSelections(buildInitialSelections(safeGroups, safeVariants, defaultVariantId));
  }, [safeGroups, safeVariants, defaultVariantId]);

  const selectedVariant = React.useMemo(
    () => findMatchingVariant(safeVariants, selections) || safeVariants[0] || null,
    [safeVariants, selections]
  );

  const itemNo = selectedVariant?.catNo || selectedVariant?.sku || sku || "";
  const selectedSummary = selectedVariant?.optionSummary || "";
  const hasVariantButtons = (productType === "variant" || safeVariants.length > 0) && safeGroups.length > 0;

  const galleryImages = React.useMemo(() => {
    const head = selectedVariant?.imageUrl
      ? [{ url: selectedVariant.imageUrl, alt: selectedVariant.title || title }]
      : [];
    return dedupeImages([...(head as Img[]), ...(images || [])]);
  }, [images, selectedVariant?.imageUrl, selectedVariant?.title, title]);

  const safeDocs = React.useMemo(
    () =>
      Array.isArray(documents)
        ? documents
            .filter((row) => row?.url)
            .map((row) => ({ url: String(row.url), label: String(row.label || row.title || row.url) }))
        : [],
    [documents]
  );

  return (
    <>
      {summary ? <p className="mt-4 text-base leading-7 text-neutral-700">{summary}</p> : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5 lg:border-r lg:border-neutral-200">
            <ProductGalleryClient images={galleryImages} title={title} />
          </div>

          <div className="p-5">
            {itemNo ? (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Item # / Cat. No.</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{itemNo}</div>
                {selectedSummary ? <div className="mt-2 text-sm text-neutral-600">{selectedSummary}</div> : null}
              </div>
            ) : null}

            {hasVariantButtons ? (
              <div className="mt-5 space-y-5">
                {safeGroups.map((group) => {
                  const key = normalizeKey(group.key || group.name || "option");
                  const selected = selections[key] || "";
                  return (
                    <div key={key}>
                      <div className="mb-2 text-sm font-semibold text-neutral-900">
                        {group.label || group.name || "Option"}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(group.options || []).map((row, idx) => {
                          const value = normalizeValue(String(row?.value || row?.label || `option-${idx}`));
                          const active = value === selected;
                          const label = row?.label || row?.value || `Option ${idx + 1}`;
                          return (
                            <button
                              key={`${key}-${value}-${idx}`}
                              type="button"
                              onClick={() => setSelections((prev) => ({ ...prev, [key]: value }))}
                              className={[
                                "inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition",
                                active
                                  ? "border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-500/20"
                                  : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50",
                              ].join(" ")}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {hasVariantButtons ? (
              <div className="mt-6 rounded-2xl border border-dashed border-neutral-200 px-4 py-4 text-sm text-neutral-600">
                {safeGroups.map((group) => {
                  const key = normalizeKey(group.key || group.name || "option");
                  return (
                    <div key={`selected-${key}`} className="flex gap-2">
                      <span className="font-semibold text-neutral-900">{group.label || group.name || "Option"}:</span>
                      <span>{pickOptionLabel(group, selections[key] || "")}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="h-px bg-neutral-200" />

        <div className="p-5">
          <div className="itsbio-product-tabs">
            <ProductTabsClient
              specsHtml={specsHtml}
              datasheetHtml={datasheetHtml}
              documentsHtml={documentsHtml}
              faqsHtml={faqsHtml}
              referencesHtml={referencesHtml}
              reviewsHtml={reviewsHtml}
              documents={safeDocs as any}
            />
          </div>
        </div>
      </div>
    </>
  );
}
