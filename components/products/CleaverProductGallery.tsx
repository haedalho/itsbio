"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Props = {
  title: string;
  images: string[];
};

export default function CleaverProductGallery({ title, images }: Props) {
  const [selected, setSelected] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const active = images[selected] || images[0];
  const dimensions = active?.match(/-(\d+)x(\d+)\.[a-z]+(?:\?|$)/i);

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
      <div className="relative aspect-square overflow-hidden rounded-[28px] border border-[#ece7f1] bg-[#fbf9fd]">
        <div className="absolute inset-0 flex items-center justify-center p-16">
          <Image src="/partners/Cleaverscientific-logo.png" alt="Cleaver Scientific" width={220} height={92} className="h-auto max-w-full object-contain opacity-60" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-[28px] border border-[#ece7f1] bg-white shadow-[0_16px_60px_rgba(75,35,97,0.07)]">
        <Image
          key={active}
          src={active}
          alt={title}
          fill
          priority
          quality={95}
          sizes="(max-width: 768px) 94vw, (max-width: 1280px) 70vw, 1000px"
          className="object-contain p-3 md:p-4"
        />
        {images.length > 1 ? (
          <div className="absolute right-4 top-4 rounded-full bg-[#281335]/80 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            {selected + 1} / {images.length}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-[#be9dce] hover:text-[#61247b]"
        >
          <span aria-hidden>↗</span>
          View original{dimensions ? ` · ${dimensions[1]} × ${dimensions[2]}` : ""}
        </button>
      </div>

      {images.length > 1 ? (
        <div className="mt-4 grid grid-cols-5 gap-3 sm:grid-cols-6">
          {images.slice(0, 6).map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`View ${title} photograph ${index + 1}`}
              aria-pressed={selected === index}
              className={`relative aspect-square overflow-hidden rounded-xl border bg-white transition ${selected === index ? "border-[#773395] ring-2 ring-[#773395]/15" : "border-slate-200 hover:border-[#be9dce]"}`}
            >
              <Image src={image} alt="" fill quality={85} sizes="(max-width: 640px) 18vw, 100px" className="object-contain p-1.5" />
            </button>
          ))}
        </div>
      ) : null}

      {zoomed ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} full-resolution product photograph`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 md:p-10"
          onClick={() => setZoomed(false)}
        >
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label="Close full-resolution product photograph"
            className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl text-slate-800 transition hover:bg-slate-100"
          >
            ×
          </button>
          <div className="relative h-[min(88vh,1200px)] w-[min(92vw,1500px)]" onClick={(event) => event.stopPropagation()}>
            <Image src={active} alt={title} fill unoptimized sizes="92vw" className="object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
