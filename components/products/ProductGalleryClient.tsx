"use client";

import * as React from "react";

type Img = {
  url: string;
  alt?: string;
  caption?: string;
  creditUrl?: string;
};

type VectorMap = {
  url: string;
  alt?: string;
};

type MediaItem =
  | ({ kind: "image" } & Img)
  | ({ kind: "vector-map" } & VectorMap);

export default function ProductGalleryClient({
  images,
  title,
  vectorMap,
}: {
  images: Img[];
  title?: string;
  vectorMap?: VectorMap;
}) {
  const safeImages = (images || []).filter((x) => x?.url);
  const media: MediaItem[] = [
    ...(vectorMap?.url ? [{ kind: "vector-map" as const, ...vectorMap }] : []),
    ...safeImages.map((image) => ({ kind: "image" as const, ...image })),
  ];
  const [activeIdx, setActiveIdx] = React.useState(0);

  React.useEffect(() => {
    setActiveIdx(0);
  }, [media.length]);

  if (!media.length) return null;

  const active = media[Math.min(activeIdx, media.length - 1)];

  return (
    <div className="w-full">
      <div className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden bg-neutral-50">
        {active.kind === "vector-map" ? (
          <iframe
            src={active.url}
            title={active.alt || `${title || "Product"} vector map`}
            width={600}
            height={620}
            className="pointer-events-none h-[620px] w-[600px] border-0 bg-white"
            style={{ transform: "translateX(-25%) scale(0.5)" }}
            loading="lazy"
            referrerPolicy="no-referrer"
            scrolling="no"
            tabIndex={-1}
            aria-hidden="true"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={active.url}
            alt={active.alt || title || "Product image"}
            className="absolute inset-0 h-full w-full object-contain"
            loading="eager"
            referrerPolicy="no-referrer"
          />
        )}
      </div>

      {active.kind === "image" && active.caption ? (
        <p className="mx-auto mt-3 max-w-[560px] text-center text-xs leading-5 text-neutral-500">
          {active.creditUrl ? (
            <a
              href={active.creditUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-neutral-600 underline decoration-neutral-300 underline-offset-4 hover:text-[#dc5a2b]"
            >
              {active.caption}
            </a>
          ) : active.caption}
        </p>
      ) : null}

      {media.length > 1 ? (
        <div className="mt-4">
          <div className="flex justify-center gap-3 overflow-x-auto pb-1">
            {media.map((item, i) => {
              const selected = i === activeIdx;
              return (
                <button
                  key={`${item.kind}-${item.url}-${i}`}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className={[
                    "relative h-16 w-16 shrink-0 overflow-hidden border bg-white transition",
                    selected
                      ? "border-orange-500 ring-2 ring-orange-500/30"
                      : "border-neutral-200 hover:border-neutral-300",
                  ].join(" ")}
                  aria-label={item.kind === "vector-map" ? "Select vector map" : `Select image ${i + 1}`}
                >
                  {item.kind === "vector-map" ? (
                    <span className="flex h-full w-full flex-col items-center justify-center bg-neutral-50 px-1 text-center text-[9px] font-semibold uppercase leading-tight tracking-wide text-neutral-600">
                      <span>Vector</span>
                      <span>Map</span>
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt={item.alt || title || "Product thumbnail"}
                      className="h-full w-full object-contain"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2 text-center text-xs text-neutral-500">
            {activeIdx + 1} / {media.length}
          </div>
        </div>
      ) : null}
    </div>
  );
}
