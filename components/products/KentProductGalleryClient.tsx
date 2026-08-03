"use client";

import Image from "next/image";
import * as React from "react";

type Img = { url?: string; alt?: string };

const PLACEHOLDER = "/kent-product-placeholder.svg";

function isManagedImageUrl(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (raw.startsWith("/")) return !raw.startsWith("//");

  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "cdn.sanity.io";
  } catch {
    return false;
  }
}

function managedProductImages(images: Img[], title: string) {
  const seen = new Set<string>();
  return (Array.isArray(images) ? images : [])
    .map((image) => ({
      url: String(image?.url || "").trim(),
      alt: String(image?.alt || "").trim() || title,
    }))
    .filter((image) => isManagedImageUrl(image.url))
    .filter((image) => {
      if (seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    });
}

export default function KentProductGalleryClient({
  images,
  title,
}: {
  productSlug: string;
  images: Img[];
  title: string;
  verifiedGallery?: boolean;
}) {
  const managedImages = React.useMemo(() => managedProductImages(images, title), [images, title]);
  const imageSignature = managedImages.map((image) => image.url).join("|");
  const [activeUrl, setActiveUrl] = React.useState(managedImages[0]?.url || "");
  const [failedUrls, setFailedUrls] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setActiveUrl(managedImages[0]?.url || "");
    setFailedUrls(new Set());
  }, [imageSignature]);

  const availableImages = managedImages.filter((image) => !failedUrls.has(image.url));
  const active = availableImages.find((image) => image.url === activeUrl) || availableImages[0] || null;
  const markFailed = (url: string) => {
    setFailedUrls((current) => new Set([...current, url]));
    if (activeUrl === url) setActiveUrl("");
  };

  return (
    <div className="grid gap-3 sm:grid-cols-[76px_minmax(0,1fr)]">
      {availableImages.length > 1 ? (
        <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col sm:overflow-x-visible" aria-label={`${title} product images`}>
          {availableImages.map((image, index) => {
            const selected = image.url === active?.url;
            return (
              <button
                key={image.url}
                type="button"
                onClick={() => setActiveUrl(image.url)}
                aria-label={`Show ${title} image ${index + 1}`}
                aria-pressed={selected}
                className={`relative h-[72px] w-[72px] shrink-0 overflow-hidden border bg-white transition ${selected ? "border-[#0752ad] ring-1 ring-[#0752ad]" : "border-[#dfe4e8] hover:border-[#7da6cf]"}`}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="72px"
                  className="object-contain p-2"
                  unoptimized
                  onError={() => markFailed(image.url)}
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="relative order-1 overflow-hidden rounded-sm border border-[#e0e4e8] bg-white sm:order-2">
        <div className="relative aspect-square min-h-[320px] sm:min-h-[420px] lg:min-h-0">
        {active?.url ? (
          <Image
            src={active.url}
            alt={active.alt || title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 620px"
            className="object-contain p-5 sm:p-7 lg:p-8"
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
