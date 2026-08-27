"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type Props = {
  title: string;
  sources: string[];
};

const CLEAVER_LOGO = "/partners/Cleaverscientific-logo.png";

function isManufacturerImage(url: string) {
  try {
    return /(^|\.)thistlescientific\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export default function CleaverCatalogImage({ title, sources }: Props) {
  const candidates = useMemo(() => {
    const unique = Array.from(new Set(sources.map((value) => String(value || "").trim()).filter(Boolean)));
    return [...unique, CLEAVER_LOGO];
  }, [sources]);
  const [index, setIndex] = useState(0);
  const active = candidates[Math.min(index, candidates.length - 1)] || CLEAVER_LOGO;
  const isLogo = active === CLEAVER_LOGO;

  return (
    <Image
      key={active}
      src={active}
      alt={isLogo ? "Cleaver Scientific" : title}
      fill
      unoptimized={isManufacturerImage(active)}
      quality={85}
      sizes="(max-width: 768px) 48vw, (max-width: 1280px) 32vw, 350px"
      className={isLogo ? "object-contain p-10 opacity-70" : "object-contain p-3 transition duration-500 group-hover:scale-[1.04]"}
      onError={() => setIndex((current) => Math.min(current + 1, candidates.length - 1))}
    />
  );
}
