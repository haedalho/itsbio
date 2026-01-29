"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { homeProductCategories } from "@/data/home";

type Category = {
  title: string;
  desc: string;
  href: string;
  image?: string;
  images?: string[];
};

const FALLBACK: Category[] = [
  {
    title: "qPCR",
    desc: "Master Mix · Primers · Probes",
    href: "/products?category=qpcr",
    image: "/home/cat-qpcr.png",
  },
  {
    title: "Antibodies",
    desc: "Primary · Secondary · Recombinant",
    href: "/products?category=antibodies",
    image: "/home/cat-antibodies.png",
  },
  {
    title: "RNA / DNA Extraction",
    desc: "Viral RNA · Genomic DNA · Cleanup",
    href: "/products?category=extraction",
    image: "/home/cat-extraction.jpg",
  },
  {
    title: "Cell Culture",
    desc: "Media · Supplements · Plasticware",
    href: "/products?category=cell-culture",
    image: "/home/cat-cellculture.jpg",
  },
  {
    title: "ELISA & Assays",
    desc: "ELISA Kits · Detection · Quantification",
    href: "/products?category=assays",
    image: "/home/cat-assays.jpg",
  },
  {
    title: "Protein Tools",
    desc: "Ladders · Buffers · Stains",
    href: "/products?category=protein-tools",
    image: "/home/cat-protein-tools.jpg",
  },
];

function Tile({
  c,
  itemRef,
}: {
  c: Category;
  itemRef?: React.Ref<HTMLAnchorElement>;
}) {
  const src = c.image ?? c.images?.[0];

  return (
    <Link
      ref={itemRef}
      href={c.href}
      className={[
        "group relative overflow-hidden rounded-3xl",
        "border border-slate-200/70 bg-white",
        "shadow-[0_8px_24px_rgba(15,23,42,0.08)]",
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(15,23,42,0.14)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2",
        // layout (keep 5-ish on desktop)
        "basis-[82%] sm:basis-[48%] md:basis-[32%] lg:basis-[calc((100%-4*16px)/5)]",
        "shrink-0",
        // size
        "h-[320px]",
      ].join(" ")}
    >
      {/* image */}
      <div className="absolute inset-0">
        {src ? (
          <Image
            src={src}
            alt={c.title}
            fill
            className="object-cover object-center transition-transform duration-700 group-hover:scale-[1.06]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-white" />
        )}

        {/* softer overlay (no harsh black border vibe) */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/15 to-transparent" />
      </div>

      {/* content */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="text-xl font-semibold text-white">{c.title}</div>
        <div className="mt-2 line-clamp-2 text-base text-white/90">
          {c.desc}
        </div>

        <div className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur">
          Explore{" "}
          <span className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </div>

        {/* tiny orange accent line on hover */}
        <div className="mt-4 h-px w-0 bg-orange-400/80 transition-all duration-300 group-hover:w-16" />
      </div>
    </Link>
  );
}

export default function ProductsCategoryGrid() {
  const raw =
    Array.isArray(homeProductCategories) && homeProductCategories.length > 0
      ? (homeProductCategories as Category[])
      : FALLBACK;

  // keep at least 6 items so the loop feels natural
  const categories = useMemo(() => {
    if (raw.length >= 6) return raw;
    const out: Category[] = [];
    while (out.length < 6) out.push(...raw);
    return out.slice(0, 6);
  }, [raw]);

  const VISIBLE = 5;
  const INTERVAL_MS = 2800; // 몇 초 후 하나씩
  const TRANSITION_MS = 520; // 넘어가는 속도

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [enableTransition, setEnableTransition] = useState(true);
  const [stepPx, setStepPx] = useState(0);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const firstItemRef = useRef<HTMLAnchorElement | null>(null);

  // loop: append first VISIBLE items for seamless wrap
  const loopItems = useMemo(
    () => [...categories, ...categories.slice(0, VISIBLE)],
    [categories]
  );

  // calculate step = item width + gap
  useEffect(() => {
    const calc = () => {
      const item = firstItemRef.current;
      const track = trackRef.current;
      if (!item || !track) return;

      const itemW = item.getBoundingClientRect().width;
      const styles = window.getComputedStyle(track);
      const gap = parseFloat(styles.columnGap || styles.gap || "16") || 16;

      setStepPx(itemW + gap);
    };

    calc();

    const ro = new ResizeObserver(() => calc());
    if (trackRef.current) ro.observe(trackRef.current);
    if (firstItemRef.current) ro.observe(firstItemRef.current);

    return () => ro.disconnect();
  }, []);

  // auto step slide
  useEffect(() => {
    if (paused) return;

    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;
    if (reduce) return;

    const id = window.setInterval(() => {
      setIndex((v) => v + 1);
    }, INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [paused]);

  const translateX = -(index * stepPx);

  // wrap without jump
  const handleTransitionEnd = () => {
    if (index >= categories.length) {
      setEnableTransition(false);
      setIndex(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setEnableTransition(true));
      });
    }
  };

  return (
    <section>
      

      <div
        className="mt-6 overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          ref={trackRef}
          className="flex gap-4 py-1"
          style={{
            transform: `translateX(${translateX}px)`,
            transition: enableTransition
              ? `transform ${TRANSITION_MS}ms ease`
              : "none",
            willChange: "transform",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {loopItems.map((c, i) => (
            <Tile
              key={`${c.title}-${i}`}
              c={c}
              itemRef={i === 0 ? firstItemRef : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}