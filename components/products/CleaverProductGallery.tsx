"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Props = {
  title: string;
  images: string[];
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

export default function CleaverProductGallery({ title, images }: Props) {
  const [selected, setSelected] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const availableImages = images.filter((image) => !failedImages.includes(image));
  const active = availableImages[selected] || availableImages[0];

  const markFailed = (image: string) => {
    setFailedImages((current) => current.includes(image) ? current : [...current, image]);
    setSelected(0);
  };

  useEffect(() => {
    if (!zoomed) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomed(false);
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [zoomed]);

  if (!active) {
    return (
      <div className="relative aspect-square overflow-hidden border border-slate-200 bg-[#fbf9fd]">
        <div className="absolute inset-0 flex items-center justify-center p-16">
          <Image src="/partners/Cleaverscientific-logo.png" alt="Cleaver Scientific" width={220} height={92} className="h-auto max-w-full object-contain opacity-60" />
        </div>
      </div>
    );
  }

  const directManufacturer = isManufacturerImage(active);

  return (
    <div>
      <div className="relative aspect-square overflow-hidden border border-slate-200 bg-white">
        <Image
          key={active}
          src={deliveryUrl(active)}
          alt={title}
          fill
          priority
          unoptimized={directManufacturer}
          quality={90}
          sizes="(max-width: 768px) 94vw, (max-width: 1280px) 52vw, 1000px"
          className="object-contain p-2 md:p-3"
          onError={() => markFailed(active)}
        />
        {availableImages.length > 1 ? <div className="absolute right-4 top-4 bg-slate-950/75 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">{selected + 1} / {availableImages.length}</div> : null}
        <button type="button" onClick={() => setZoomed(true)} className="absolute bottom-4 right-4 inline-flex items-center gap-2 border border-slate-200 bg-white/95 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-[#9b6caf] hover:text-[#61247b]"><span aria-hidden>↗</span>View original</button>
      </div>

      {availableImages.length > 1 ? (
        <div className="mt-4 grid grid-cols-5 gap-3 sm:grid-cols-6">
          {availableImages.map((image, index) => {
            const direct = isManufacturerImage(image);
            return <button key={image} type="button" onClick={() => setSelected(index)} aria-label={`View ${title} photograph ${index + 1}`} aria-pressed={selected === index} className={`relative aspect-square overflow-hidden border bg-white transition ${selected === index ? "border-[#6d2c86] ring-2 ring-[#6d2c86]/15" : "border-slate-200 hover:border-[#9b6caf]"}`}><Image src={deliveryUrl(image)} alt="" fill unoptimized={direct} quality={90} sizes="(max-width: 640px) 18vw, 120px" className="object-contain p-1" onError={() => markFailed(image)} /></button>;
          })}
        </div>
      ) : null}

      {zoomed ? (
        <div role="dialog" aria-modal="true" aria-label={`${title} full-resolution product photograph`} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/88 p-4 md:p-10" onClick={() => setZoomed(false)}>
          <button type="button" onClick={() => setZoomed(false)} aria-label="Close full-resolution product photograph" className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl text-slate-800 transition hover:bg-slate-100">×</button>
          <div className="relative h-[min(90vh,1200px)] w-[min(94vw,1600px)]" onClick={(event) => event.stopPropagation()}><Image src={deliveryUrl(active)} alt={title} fill unoptimized={directManufacturer} quality={90} sizes="94vw" className="object-contain" onError={() => markFailed(active)} /></div>
        </div>
      ) : null}
    </div>
  );
}
