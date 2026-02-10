"use client";

import * as React from "react";

type Img = {
  url: string;
  alt?: string;
};

export default function ProductGalleryClient({
  images,
  title,
}: {
  images: Img[];
  title?: string;
}) {
  const safe = (images || []).filter((x) => x?.url);
  const [activeIdx, setActiveIdx] = React.useState(0);

  React.useEffect(() => {
    setActiveIdx(0);
  }, [safe.length]);

  if (!safe.length) return null;

  const active = safe[Math.min(activeIdx, safe.length - 1)];

  return (
    <div className="w-full">
      {/* Main (카드 제거, 내부만 유지) */}
      <div className="relative mx-auto aspect-[4/3] w-full max-w-[560px] overflow-hidden rounded-2xl bg-neutral-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active.url}
          alt={active.alt || title || "Product image"}
          className="absolute inset-0 h-full w-full object-contain"
          loading="eager"
        />
      </div>

      {/* Thumbnails */}
      {safe.length > 1 ? (
        <div className="mt-4">
          <div className="flex justify-center gap-3 overflow-x-auto pb-1">
            {safe.map((img, i) => {
              const selected = i === activeIdx;
              return (
                <button
                  key={`${img.url}-${i}`}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className={[
                    "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white transition",
                    selected
                      ? "border-orange-500 ring-2 ring-orange-500/30"
                      : "border-neutral-200 hover:border-neutral-300",
                  ].join(" ")}
                  aria-label={`Select image ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt || title || "Product thumbnail"}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-2 text-center text-xs text-neutral-500">
            {activeIdx + 1} / {safe.length}
          </div>
        </div>
      ) : null}
    </div>
  );
}
