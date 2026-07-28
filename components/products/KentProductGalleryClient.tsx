"use client";

import Image from "next/image";
import * as React from "react";

type Img = { url?: string; alt?: string };

const MAX_VERIFIED_GALLERY_IMAGES = 12;
const PLACEHOLDER = "/kent-product-placeholder.svg";

function imageKey(url?: string) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, "https://www.kentscientific.com");
    return `${parsed.origin}${decodeURIComponent(parsed.pathname)}`.toLowerCase();
  } catch {
    return raw.split("?")[0].toLowerCase();
  }
}

function normalizeGalleryImages(images: Img[], verifiedGallery: boolean) {
  const rows: { url: string; alt?: string }[] = [];
  const seen = new Set<string>();

  for (const image of Array.isArray(images) ? images : []) {
    const url = String(image?.url || "").trim();
    const key = imageKey(url);
    if (!url || !key || seen.has(key)) continue;
    seen.add(key);
    rows.push({ url, alt: image?.alt });
  }

  // Gallery membership is data, not a filename/domain guess. A verified list is
  // rendered in its stored order. Legacy arrays can never form a gallery.
  return verifiedGallery
    ? rows.slice(0, MAX_VERIFIED_GALLERY_IMAGES)
    : rows.slice(0, 1);
}

export default function KentProductGalleryClient({
  images,
  title,
  verifiedGallery = false,
}: {
  productSlug: string;
  images: Img[];
  title: string;
  verifiedGallery?: boolean;
}) {
  const initialImages = React.useMemo(
    () => normalizeGalleryImages(images, verifiedGallery),
    [images, verifiedGallery],
  );
  const [failedUrls, setFailedUrls] = React.useState<Set<string>>(() => new Set());
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    setFailedUrls(new Set());
    setActiveIndex(0);
  }, [initialImages]);

  const safeImages = React.useMemo(
    () => initialImages.filter((image) => !failedUrls.has(image.url)),
    [failedUrls, initialImages],
  );

  React.useEffect(() => {
    if (activeIndex >= safeImages.length) setActiveIndex(0);
  }, [activeIndex, safeImages.length]);

  const active = safeImages[activeIndex] || safeImages[0] || null;
  const hasThumbnails = safeImages.length > 1;

  const markFailed = React.useCallback((url?: string) => {
    const value = String(url || "").trim();
    if (!value) return;
    setFailedUrls((current) => {
      if (current.has(value)) return current;
      const next = new Set(current);
      next.add(value);
      return next;
    });
  }, []);

  return (
    <div className={hasThumbnails ? "grid gap-4 md:grid-cols-[72px_minmax(0,1fr)]" : "grid"}>
      {hasThumbnails ? (
        <div className="order-2 flex max-w-full gap-3 overflow-x-auto pb-1 md:order-1 md:max-h-[560px] md:flex-col md:overflow-x-hidden md:overflow-y-auto">
          {safeImages.map((img, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={`${img.url}-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`View ${title} image ${idx + 1}`}
                className={[
                  "relative h-[70px] w-[70px] shrink-0 overflow-hidden rounded-md border bg-white transition",
                  isActive ? "border-[#0b4fb3] ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-400",
                ].join(" ")}
              >
                <Image
                  src={img.url}
                  alt={img.alt || `${title} thumbnail ${idx + 1}`}
                  fill
                  sizes="70px"
                  className="object-contain p-2"
                  unoptimized
                  onError={() => markFailed(img.url)}
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={`${hasThumbnails ? "order-1 md:order-2" : ""} relative overflow-hidden rounded-[12px] border border-slate-200 bg-white`}>
        <div className="relative aspect-square min-h-[360px] lg:min-h-[520px]">
          {active?.url ? (
            <Image
              src={active.url}
              alt={active.alt || title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 620px"
              className="object-contain p-7 lg:p-9"
              unoptimized
              onError={() => markFailed(active.url)}
            />
          ) : (
            <Image
              src={PLACEHOLDER}
              alt={`${title} image unavailable`}
              fill
              sizes="(max-width: 1024px) 100vw, 620px"
              className="object-contain p-10"
            />
          )}
        </div>
      </div>
    </div>
  );
}
