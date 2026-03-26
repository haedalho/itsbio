"use client";

import * as React from "react";

import KentProductGalleryClient from "@/components/products/KentProductGalleryClient";
import KentProductTabs from "@/components/products/KentProductTabs";

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

function buildInitialSelections(
  optionGroups: OptionGroup[],
  variants: Variant[],
  defaultVariantId?: string,
) {
  const seed =
    (defaultVariantId ? variants.find((row) => row.variantId === defaultVariantId) : null) ||
    variants[0] ||
    null;

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
    (row) => normalizeValue(String(row?.value || row?.label || "")) === selectedValue,
  );
  return matched?.label || matched?.value || selectedValue;
}

function normalizeDocs(documents?: Doc[]) {
  return Array.isArray(documents)
    ? documents
        .filter((row) => row?.url)
        .map((row) => ({
          url: String(row.url),
          label: String(row.label || row.title || row.url),
        }))
    : [];
}

function getQuickLinks(sourceUrl?: string, docs?: { url: string; label: string }[]) {
  const links: Array<{ href: string; label: string }> = [];

  if (sourceUrl) {
    links.push({ href: sourceUrl, label: "Original Page" });
  }

  for (const doc of docs || []) {
    links.push({ href: doc.url, label: doc.label });
  }

  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.href}__${link.label}`;
    if (!link.href || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function KentProductDetailClient({
  title,
  summary,
  sku,
  sourceUrl,
  images,
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
  title: string;
  summary?: string;
  sku?: string;
  sourceUrl?: string;
  images: Img[];
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
    () =>
      Array.isArray(variants)
        ? variants.filter((row) => row?.variantId || row?.sku || row?.catNo || row?.optionSummary)
        : [],
    [variants],
  );

  const [selections, setSelections] = React.useState<Record<string, string>>(() =>
    buildInitialSelections(safeGroups, safeVariants, defaultVariantId),
  );

  React.useEffect(() => {
    setSelections(buildInitialSelections(safeGroups, safeVariants, defaultVariantId));
  }, [safeGroups, safeVariants, defaultVariantId]);

  const selectedVariant = React.useMemo(
    () => findMatchingVariant(safeVariants, selections) || safeVariants[0] || null,
    [safeVariants, selections],
  );

  const itemNo = selectedVariant?.catNo || selectedVariant?.sku || sku || "";
  const selectedSummary = selectedVariant?.optionSummary || "";
  const hasVariantButtons = (productType === "variant" || safeVariants.length > 0) && safeGroups.length > 0;

  const galleryImages = React.useMemo(() => {
    const variantImage = safeExternalUrl(selectedVariant?.imageUrl);
    const head = variantImage
      ? [{ url: variantImage, alt: selectedVariant?.title || title }]
      : [];
    return dedupeImages([...(head as Img[]), ...(images || [])]);
  }, [images, selectedVariant?.imageUrl, selectedVariant?.title, title]);

  const safeDocs = React.useMemo(() => normalizeDocs(documents), [documents]);
  const quickLinks = React.useMemo(() => getQuickLinks(sourceUrl, safeDocs), [sourceUrl, safeDocs]);

  return (
    <div className="pb-12">
      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1.05fr)_420px]">
          <div>
            <KentProductGalleryClient images={galleryImages} title={title} />
          </div>

          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">
              Kent Scientific
            </div>

            <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.03em] text-[#0b4fb3] lg:text-[40px]">
              {title}
            </h1>

            {summary ? (
              <p className="mt-3 text-[15px] leading-7 text-slate-600">
                {summary}
              </p>
            ) : null}

            <div className="mt-6 rounded-md bg-[#0b4fb3] px-7 py-4 text-center text-[17px] font-semibold text-white">
              Login to see prices
            </div>

            <div className="mt-5 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Item # </span>
              {itemNo || "Contact for details"}
            </div>

            {selectedSummary ? (
              <div className="mt-3 text-sm text-slate-600">{selectedSummary}</div>
            ) : null}

            {hasVariantButtons ? (
              <div className="mt-7 space-y-5">
                {safeGroups.map((group) => {
                  const key = normalizeKey(group.key || group.name || "option");
                  const selected = selections[key] || "";

                  return (
                    <div key={key}>
                      <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-900">
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
                                "inline-flex min-h-[40px] items-center justify-center border px-4 py-2 text-sm transition",
                                active
                                  ? "border-[#0b4fb3] bg-[#0b4fb3] text-white"
                                  : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50",
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

            {safeGroups.length ? (
              <div className="mt-6 space-y-1 text-sm text-slate-600">
                {safeGroups.map((group) => {
                  const key = normalizeKey(group.key || group.name || "option");
                  return (
                    <div key={`selected-${key}`} className="flex gap-2">
                      <span className="font-semibold uppercase text-slate-900">
                        {group.label || group.name || "Option"}:
                      </span>
                      <span>{pickOptionLabel(group, selections[key] || "")}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {quickLinks.length ? (
              <div className="mt-7 border-t border-slate-200 pt-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Resources
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {quickLinks.slice(0, 8).map((link, idx) => (
                    <a
                      key={`${link.href}-${idx}`}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-8 rounded-[18px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-900">ITS BIO support</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Contact ITS BIO for pricing, compatibility questions, and availability for this Kent Scientific item.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <a
                  href="mailto:info@itsbio.co.kr"
                  className="inline-flex items-center justify-center bg-[#0b4fb3] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#093f8e]"
                >
                  Request Quote
                </a>
                <a
                  href="tel:02-3462-8658"
                  className="inline-flex items-center justify-center border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  Call ITS BIO
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <KentProductTabs
        title={title}
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
