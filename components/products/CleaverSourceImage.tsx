"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  src: string;
  alt: string;
  size: number;
  className?: string;
};

function isManufacturerImage(url: string) {
  try {
    return /(^|\.)thistlescientific\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function deliveryUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)thistlescientific\.com$/i.test(parsed.hostname) || !parsed.pathname.startsWith("/wp-content/uploads/")) return url;
    return `https://i0.wp.com/${parsed.hostname}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export default function CleaverSourceImage({ src, alt, size, className = "object-contain p-1" }: Props) {
  const [mode, setMode] = useState<"direct" | "proxy" | "failed">("direct");
  const manufacturer = isManufacturerImage(src);
  const proxy = deliveryUrl(src);
  const resolvedSrc = mode === "proxy" ? proxy : src;

  if (mode === "failed") {
    return <span className="absolute inset-0 flex items-center justify-center bg-[#faf8fc] px-2 text-center text-xs text-slate-400">Image unavailable</span>;
  }

  return (
    <Image
      key={`${resolvedSrc}-${mode}`}
      src={resolvedSrc}
      alt={alt}
      fill
      unoptimized={manufacturer || mode === "proxy"}
      quality={100}
      sizes={`${size}px`}
      className={className}
      onError={() => {
        if (manufacturer && mode === "direct" && proxy !== src) {
          setMode("proxy");
          return;
        }
        setMode("failed");
      }}
    />
  );
}
