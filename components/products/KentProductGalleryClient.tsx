"use client";

import * as React from "react";

type Img = { url?: string; alt?: string };

const MAX_GALLERY_IMAGES = 12;
const PLACEHOLDER = "/kent-product-placeholder.svg";

const DOWNSTREAM_IMAGE_PATTERNS = [
  /(?:^|[\/_\-.])faq(?:[\/_\-.]|$)/i,
  /frequently[-_ ]asked/i,
  /(?:^|[\/_\-.])support(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])help(?:[\/_\-.]|$)/i,
  /customer[-_ ]?(?:service|support)/i,
  /(?:^|[\/_\-.])testimonial(?:s)?(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])avatar(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])profile(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])people(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])team(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])staff(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])expert(?:[\/_\-.]|$)/i,
  /reply[-_ ]fast/i,
  /we[-_ ]?re[-_ ]here/i,
  /ask[-_ ]for[-_ ]support/i,
  /(?:^|[\/_\-.])chat(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])newsletter(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])subscribe(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])publication(?:s)?(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])reference(?:s)?(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])resource(?:s)?(?:[\/_\-.]|$)/i,
  /white[-_ ]?paper/i,
  /book[-_ ]?cover/i,
  /laboratory[-_ ]animal[-_ ]anesthesia/i,
  /(?:^|[\/_\-.])amazon(?:[\/_\-.]|$)/i,
  /request[-_ ]?(?:a[-_ ]?)?(?:quote|sample)/i,
  /(?:^|[\/_\-.])intertek(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])badge(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])certificate(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])logo(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])icon(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])banner(?:[\/_\-.]|$)/i,
];

function normalizedImagePath(url?: string) {
  const raw = String(url || "").trim();
  if (!raw) return "";

  try {
    return decodeURIComponent(new URL(raw, "https://www.kentscientific.com").pathname).toLowerCase();
  } catch {
    return raw.split("?")[0].toLowerCase();
  }
}

function imageMasterKey(url?: string) {
  return normalizedImagePath(url)
    .replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+$)/i, "")
    .replace(/-(?:scaled|optimized)(?=\.[a-z0-9]+$)/i, "");
}

function isDownstreamPageImage(url?: string) {
  const path = normalizedImagePath(url);
  return Boolean(path && DOWNSTREAM_IMAGE_PATTERNS.some((pattern) => pattern.test(path)));
}

function normalizeGalleryImages(images: Img[]) {
  const deduped: Img[] = [];
  const seen = new Set<string>();

  for (const image of Array.isArray(images) ? images : []) {
    const url = String(image?.url || "").trim();
    if (!url) continue;

    const key = imageMasterKey(url) || url;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...image, url });
  }

  const gallery: Img[] = [];
  for (const image of deduped) {
    if (isDownstreamPageImage(image.url)) {
      if (gallery.length) break;
      continue;
    }
    gallery.push(image);
    if (gallery.length >= MAX_GALLERY_IMAGES) break;
  }

  return gallery.length ? gallery : deduped.slice(0, 1);
}

function resolveKentImageUrl(input?: string) {
  const raw = String(input || "").trim();
  if (!raw) return PLACEHOLDER;

  try {
    const parsed = new URL(raw);
    if (
      (parsed.hostname === "www.kentscientific.com" || parsed.hostname === "kentscientific.com") &&
      parsed.pathname.startsWith("/wp-content/uploads/")
    ) {
      return `/api/kent/asset?src=${encodeURIComponent(parsed.toString())}`;
    }
  } catch {
    // Local paths and Sanity URLs are used as-is.
  }

  return raw;
}

function SafeGalleryImage({
  src,
  alt,
  className,
  loading,
}: {
  src?: string;
  alt: string;
  className: string;
  loading?: "eager" | "lazy";
}) {
  const original = React.useMemo(() => resolveKentImageUrl(src), [src]);
  const [resolved, setResolved] = React.useState(original);

  React.useEffect(() => {
    setResolved(original);
  }, [original]);

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => {
        if (resolved !== PLACEHOLDER) setResolved(PLACEHOLDER);
      }}
    />
  );
}

export default function KentProductGalleryClient({
  images,
  title,
}: {
  images: Img[];
  title: string;
}) {
  const safeImages = React.useMemo(() => normalizeGalleryImages(images), [images]);
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [safeImages.length, safeImages[0]?.url]);

  const active = safeImages[activeIndex] || safeImages[0] || null;
  const hasThumbnails = safeImages.length > 1;

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
                <SafeGalleryImage
                  src={img.url}
                  alt={img.alt || `${title} thumbnail ${idx + 1}`}
                  className="absolute inset-0 h-full w-full object-contain p-2"
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={`${hasThumbnails ? "order-1 md:order-2" : ""} relative overflow-hidden rounded-[12px] border border-slate-200 bg-[#f7f7f7]`}>
        <div className="relative aspect-square min-h-[360px] lg:min-h-[520px]">
          {active?.url ? (
            <SafeGalleryImage
              src={active.url}
              alt={active.alt || title}
              className="absolute inset-0 h-full w-full object-contain p-8 lg:p-10"
              loading="eager"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">No image</div>
          )}
        </div>
      </div>
    </div>
  );
}
