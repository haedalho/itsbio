"use client";

import Image from "next/image";
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

  return gallery;
}

async function recoverProductImages(productSlug: string) {
  if (!productSlug) return [] as Img[];

  try {
    const key = `product:${productSlug.toLowerCase()}`;
    const response = await fetch("/api/kent/product-images", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targets: [{ key, type: "product", value: productSlug }] }),
    });
    if (!response.ok) return [];

    const payload = (await response.json()) as { images?: Record<string, string[]> };
    const urls = Array.isArray(payload?.images?.[key]) ? payload.images![key] : [];
    return urls.filter(Boolean).map((url) => ({ url, alt: "" }));
  } catch {
    return [];
  }
}

export default function KentProductGalleryClient({
  productSlug,
  images,
  title,
}: {
  productSlug: string;
  images: Img[];
  title: string;
}) {
  const initialImages = React.useMemo(() => normalizeGalleryImages(images), [images]);
  const [recoveredImages, setRecoveredImages] = React.useState<Img[]>([]);
  const [failedUrls, setFailedUrls] = React.useState<Set<string>>(() => new Set());
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setRecoveredImages([]);
    setFailedUrls(new Set());
    setActiveIndex(0);

    recoverProductImages(productSlug).then((rows) => {
      if (!cancelled) setRecoveredImages(rows.map((row) => ({ ...row, alt: row.alt || title })));
    });

    return () => {
      cancelled = true;
    };
  }, [productSlug, title]);

  const safeImages = React.useMemo(
    () => normalizeGalleryImages([...initialImages, ...recoveredImages]).filter((image) => !failedUrls.has(String(image.url || ""))),
    [failedUrls, initialImages, recoveredImages],
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
                  src={String(img.url)}
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
              src={String(active.url)}
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
