"use client";

import { useEffect, useMemo, useState } from "react";

type Item = { id: string; label: string };

export default function SectionNav({
  containerId = "snap-root",
  headerHeight = 56,
  items,
}: {
  containerId?: string;
  headerHeight?: number;
  items: Item[];
}) {
  const [active, setActive] = useState(0);
  const ids = useMemo(() => items.map((x) => x.id), [items]);

  useEffect(() => {
    const el = document.getElementById(containerId);
    if (!el) return;

    const getTops = () =>
      ids
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((node) => (node as HTMLElement).offsetTop);

    let tops = getTops();

    const onResize = () => {
      tops = getTops();
      onScroll();
    };

    const onScroll = () => {
      const y = el.scrollTop + headerHeight + 1;
      let idx = 0;
      for (let i = 0; i < tops.length; i++) {
        if (y >= tops[i]) idx = i;
      }
      setActive(idx);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    onScroll();
    return () => {
      el.removeEventListener("scroll", onScroll as any);
      window.removeEventListener("resize", onResize);
    };
  }, [containerId, headerHeight, ids]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(containerId);
    const target = document.getElementById(id);
    if (!el || !target) return;

    el.scrollTo({
      top: Math.max(0, target.offsetTop - headerHeight),
      behavior: "smooth",
    });
  };

  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-[60] hidden md:flex flex-col gap-3">
      {items.map((it, i) => (
        <button
          key={it.id}
          onClick={() => scrollTo(it.id)}
          className="group relative flex items-center"
          aria-label={it.label}
        >
          {/* dot */}
          <span
            className={[
              "h-2.5 w-2.5 rounded-full border transition",
              i === active
                ? "bg-orange-500 border-orange-500 scale-110"
                : "bg-slate-300 border-slate-300 hover:bg-slate-400 hover:border-slate-400",
            ].join(" ")}
          />

          {/* label (검정 글씨, hover시에만 표시) */}
          <span className="absolute right-5 whitespace-nowrap text-xs px-2 py-1 rounded-md bg-white/90 text-slate-900 border border-slate-200 shadow-sm backdrop-blur opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition pointer-events-none">
            {it.label}
          </span>
        </button>
      ))}
    </div>
  );
}
