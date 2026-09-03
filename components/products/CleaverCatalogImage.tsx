"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Props = {
  title: string;
  sources: string[];
};

function isManufacturerImage(url: string) {
  try {
    return /(^|\.)thistlescientific\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export default function CleaverCatalogImage({ title, sources }: Props) {
  const [fallbackImages, setFallbackImages] = useState<string[]>([]);
  const [fallbackRequested, setFallbackRequested] = useState(false);
  const candidates = useMemo(
    () => Array.from(new Set([...sources, ...fallbackImages].map((value) => String(value || "").trim()).filter(Boolean))),
    [sources, fallbackImages],
  );
  const [index, setIndex] = useState(0);
  const active = candidates[index] || "";

  useEffect(() => {
    if (active || fallbackRequested) return;
    setFallbackRequested(true);

    const controller = new AbortController();
    const params = new URLSearchParams({ title });
    fetch(`/api/cleaver/card-images?${params.toString()}`, {
      signal: controller.signal,
      cache: "force-cache",
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((payload: { images?: string[] }) => {
        if (Array.isArray(payload?.images) && payload.images.length) setFallbackImages(payload.images);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Unable to hydrate Cleaver card image:", error);
      });

    return () => controller.abort();
  }, [active, fallbackRequested, title]);

  if (!active) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center" role="img" aria-label={`${title} - official product image unavailable`}>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Cleaver Scientific</div>
          <div className="mt-2 text-xs leading-5 text-slate-400">Official product image unavailable</div>
        </div>
      </div>
    );
  }

  return (
    <Image
      key={active}
      src={active}
      alt={title}
      fill
      unoptimized={isManufacturerImage(active)}
      quality={85}
      sizes="(max-width: 768px) 48vw, (max-width: 1280px) 32vw, 350px"
      className="object-contain p-3 transition duration-500 group-hover:scale-[1.04]"
      onError={() => setIndex((current) => current + 1)}
    />
  );
}
