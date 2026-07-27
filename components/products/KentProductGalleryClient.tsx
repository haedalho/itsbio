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

function initialImageCandidates(input?: string) {
  const raw = String(input || "").trim();
  if (!raw) return [];

  const candidates = [raw];

  try {
    const parsed = new URL(raw);
    if (
      (parsed.hostname === "www.kentscientific.com" || parsed.hostname === "kentscientific.com") &&
      parsed.pathname.startsWith("/wp-content/uploads/")
    ) {
      // Preserve the previously working direct image first. The proxy is only
      // a secondary fallback for environments that reject the hotlink.
      candidates.push(`/api/kent/asset?src=${encodeURIComponent(parsed.toString())}`);
    }
  } catch {
    // Local paths and Sanity CDN URLs are already valid candidates.
  }

  return [...new Set(candidates)];
}

function currentKentProductSlug() {
  if (typeof window === "undefined") return "";
  const prefix = "/products/kent/item/";
  const pathname = window.location.pathname;
  if (!pathname.startsWith(prefix)) return "";
  return decodeURIComponent(pathname.slice(prefix.length)).replace(/^\/+|\/+$/g, "");
}

async function fetchSanityImageCandidates() {
  const slug = currentKentProductSlug();
  if (!slug) return [] as string[];

  try {
    const key = `product:${slug.toLowerCase()}`;
    const response = await fetch("/api/kent/product-images", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targets: [{ key, type: "product", value: slug }] }),
    });
    if (!response.ok) return [];

    const payload = (await response.json()) as { images?: Record<string, string[]> };
    return Array.isArray(payload?.images?.[key]) ? payload.images![key].filter(Boolean) : [];
  } catch {
    return [];
  }
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
  const baseCandidates = React.useMemo(() => initialImageCandidates(src), [src]);
  const [candidates, setCandidates] = React.useState<string[]>(baseCandidates);
  const [candidateIndex, setCandidateIndex] = React.useState(0);
  const recoveryAttempted = React.useRef(false);

  React.useEffect(() => {
    setCandidates(baseCandidates);
    setCandidateIndex(0);
    recoveryAttempted.current = false;
  }, [baseCandidates]);

  const resolved = candidates[candidateIndex] || PLACEHOLDER;

  const handleError = React.useCallback(async () => {
    if (candidateIndex + 1 < candidates.length) {
      setCandidateIndex((current) => current + 1);
      return;
    }

    if (!recoveryAttempted.current) {
      recoveryAttempted.current = true;
      const recovered = await fetchSanityImageCandidates();
      const next = [...new Set([...candidates, ...recovered])].filter((url) => url && url !== PLACEHOLDER);
      if (next.length > candidates.length) {
        setCandidates(next);
        setCandidateIndex(candidates.length);
        return;
      }
    }

    setCandidates([PLACEHOLDER]);
    setCandidateIndex(0);
  }, [candidateIndex, candidates]);

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={handleError}
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

      <div className={`${hasThumbnails ? "order-1 md:order-2" : ""} relative overflow-hidden rounded-[12px] border border-slate-200 bg-white`}>
        <div className="relative aspect-square min-h-[360px] lg:min-h-[520px]">
          {active?.url ? (
            <SafeGalleryImage
              src={active.url}
              alt={active.alt || title}
              className="absolute inset-0 h-full w-full object-contain p-7 lg:p-9"
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
