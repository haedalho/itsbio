"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type Props = {
  title: string;
  sources: string[];
};

export default function CleaverCatalogImage({ title, sources }: Props) {
  const candidates = useMemo(
    () => Array.from(new Set(sources.map((value) => String(value || "").trim()).filter(Boolean))),
    [sources],
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
      quality={85}
      sizes="(max-width: 768px) 48vw, (max-width: 1280px) 32vw, 350px"
      className="object-contain p-3 transition duration-500 group-hover:scale-[1.04]"
      onError={() => setIndex((current) => current + 1)}
    />
  );
}
