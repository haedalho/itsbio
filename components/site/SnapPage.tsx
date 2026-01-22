"use client";

import React, { useEffect, useRef } from "react";

type Props = {
  children: React.ReactNode;
  headerHeight?: number;
};

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function SnapPage({ children, headerHeight = 56 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<number | null>(null);
  const lockRef = useRef(false);
  const accRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const getSections = () =>
      Array.from(el.querySelectorAll<HTMLElement>("[data-snap]"));

    const getClosestIndex = () => {
      const sections = getSections();
      const y = el.scrollTop;
      let idx = 0;
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < sections.length; i++) {
        const dist = Math.abs(sections[i].offsetTop - y);
        if (dist < best) {
          best = dist;
          idx = i;
        }
      }
      return idx;
    };

    const animateTo = (to: number, duration = 1100) => {
      if (animRef.current) cancelAnimationFrame(animRef.current);

      const from = el.scrollTop;
      const start = performance.now();
      lockRef.current = true;

      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = easeInOutCubic(t);
        el.scrollTop = from + (to - from) * eased;

        if (t < 1) {
          animRef.current = requestAnimationFrame(tick);
        } else {
          animRef.current = null;
          lockRef.current = false;
          accRef.current = 0;
        }
      };

      animRef.current = requestAnimationFrame(tick);
    };

    const THRESHOLD = 180;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      accRef.current += e.deltaY;

      if (lockRef.current) return;
      if (Math.abs(accRef.current) < THRESHOLD) return;

      const sections = getSections();
      const current = getClosestIndex();
      const dir = accRef.current > 0 ? 1 : -1;
      const next = Math.max(0, Math.min(sections.length - 1, current + dir));

      // ✅ 여기서만 헤더 보정(밀림 방지)
      const targetTop = Math.max(0, sections[next].offsetTop - headerHeight);

      // ✅ 지금보다 “조금” 빠른 속도
      const distance = Math.abs(targetTop - el.scrollTop);
      const duration = Math.min(1350, Math.max(750, distance * 1.1));

      animateTo(targetTop, duration);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel as any);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [headerHeight]);
  
    return (
    <div
        id="snap-root"
        ref={ref}
        className="snap-scroll overflow-y-auto"
        style={{ height: `calc(100dvh - ${headerHeight}px)` }}
    >
        {children}
    </div>
    );
}
