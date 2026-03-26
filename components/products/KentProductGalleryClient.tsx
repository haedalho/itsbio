"use client";

import * as React from "react";
import Image from "next/image";

type Img = { url?: string; alt?: string };

export default function KentProductGalleryClient({
  images,
  title,
}: {
  images: Img[];
  title: string;
}) {
  const safeImages = Array.isArray(images) ? images.filter((img) => img?.url) : [];
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [safeImages.length]);

  const active = safeImages[activeIndex] || safeImages[0] || null;

  return (
    <div className="grid gap-4 md:grid-cols-[72px_minmax(0,1fr)]">
      {safeImages.length > 1 ? (
        <div className="order-2 flex gap-3 md:order-1 md:flex-col">
          {safeImages.map((img, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={`${img.url}-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={[
                  "relative overflow-hidden border bg-white transition",
                  isActive ? "border-[#0b4fb3]" : "border-slate-200 hover:border-slate-300",
                ].join(" ")}
              >
                <div className="relative h-[70px] w-[70px]">
                  <Image
                    src={String(img.url)}
                    alt={img.alt || title}
                    fill
                    sizes="70px"
                    className="object-contain p-2"
                    unoptimized
                  />
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="order-1 relative overflow-hidden rounded-[8px] border border-slate-200 bg-[#f7f7f7] md:order-2">
        <div className="relative aspect-square min-h-[360px] lg:min-h-[520px]">
          {active?.url ? (
            <Image
              src={active.url}
              alt={active.alt || title}
              fill
              sizes="(max-width: 1024px) 100vw, 700px"
              className="object-contain p-8"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No image
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
