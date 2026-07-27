"use client";

import Image from "next/image";
import * as React from "react";

type Img = { url?: string; alt?: string };

const MAX_GALLERY_IMAGES = 12;

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
      // Kent image arrays are stored in page order. Once a clearly unrelated
      // resource/support image appears after product images, later images are
      // also outside the product gallery.
      if (gallery.length) break;
      continue;
    }

    gallery.push(image);
    if (gallery.length >= MAX_GALLERY_IMAGES) break;
  }

  return gallery.length ? gallery : deduped.slice(0, 1);
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

  return (
    <div className="grid gap-4 md:grid-cols-[72px_minmax(0,1fr)]">
      {safeImages.length > 1 ? (
        <div className="order-2 flex gap-3 overflow-x-auto pb-1 md:order-1 md:max-h-[620px] md:flex-col md:overflow-y-auto md:overflow-x-hidden md:pr-1">
          {safeImages.map((img, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={`${img.url}-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={[
                  "relative shrink-0 overflow-hidden border bg-white transition",
                  isActive ? "border-[#0b4fb3]" : "border-slate-200 hover:border-slate-300",
                ].join(" ")}
              >
                <div className="relative h-[70px] w-[70px]">
                  <Image
                    src={String(img.url)}
                    alt={img.alt || title}
                    fill
                    sizes="70px"
                    className="object-contain p-2"
                    unoptimized
                  />
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="order-1 relative overflow-hidden rounded-[8px] border border-slate-200 bg-[#f7f7f7] md:order-2">
        <div className="relative aspect-square min-h-[360px] lg:min-h-[520px]">
          {active?.url ? (
            <Image
              src={active.url}
              alt={active.alt || title}
              fill
              sizes="(max-width: 1024px) 100vw, 700px"
              className="object-contain p-8"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No image
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
