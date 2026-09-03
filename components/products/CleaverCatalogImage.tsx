"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { useCleaverManagedImages } from "./CleaverCatalogImageProvider";

type Props = {
  sku: string;
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

export default function CleaverCatalogImage({ sku, title, sources }: Props) {
  const managedImages = useCleaverManagedImages(sku);
  const candidates = useMemo(
    () => Array.from(new Set([...sources, ...managedImages].map((value) => String(value || "").trim()).filter(Boolean))),
    [sources, managedImages],
  );
  const [index, setIndex] = useState(0);
  const active = candidates[index] || "";

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
