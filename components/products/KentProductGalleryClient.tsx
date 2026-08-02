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

function firstManagedProductImage(images: Img[], title: string) {
  const managed = (Array.isArray(images) ? images : [])
    .map((image) => ({
      url: String(image?.url || "").trim(),
      alt: String(image?.alt || "").trim(),
    }))
    .filter((image) => isManagedImageUrl(image.url));

  return managed.find((image) => image.alt === title) || managed[0] || null;
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
  const heroImage = React.useMemo(() => firstManagedProductImage(images, title), [images, title]);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [heroImage?.url]);

  const active = !failed ? heroImage : null;

  return (
    <div className="relative overflow-hidden rounded-[12px] border border-slate-200 bg-white">
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
            onError={() => setFailed(true)}
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
  );
}
