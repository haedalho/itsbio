"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";

const SHOW_DELAY_MS = 140;
const SLOW_NAVIGATION_MS = 760;
const COMPLETE_HOLD_MS = 180;
const FAILSAFE_MS = 12000;

type IndicatorState = "hidden" | "running" | "complete";

type SlowTarget = {
  element: HTMLElement;
  top: number;
  height: number;
};

function sameDocumentHashOnly(current: URL, target: URL) {
  return (
    current.origin === target.origin
    && current.pathname === target.pathname
    && current.search === target.search
    && current.hash !== target.hash
  );
}

function findContentTarget() {
  const mains = Array.from(document.querySelectorAll<HTMLElement>("main"));
  if (!mains.length) return null;

  // ABM and Kent keep the changing page content next to their persistent sidebar.
  const productContent = mains.find((main) => main.classList.contains("min-w-0"));
  if (productContent) return productContent;

  // Cleaver's main wraps a sidebar/content grid. Cover only its content section.
  for (const main of mains) {
    const aside = main.querySelector("aside");
    const grid = aside?.parentElement;
    if (!grid) continue;
    const section = Array.from(grid.children).find(
      (child): child is HTMLElement => child instanceof HTMLElement && child.tagName === "SECTION",
    );
    if (section) return section;
  }

  return mains[0];
}

function createSlowTarget(): SlowTarget | null {
  const element = findContentTarget();
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  const viewportTop = Math.max(rect.top, 92);
  const top = Math.max(0, viewportTop - rect.top);
  const visibleHeight = Math.max(420, window.innerHeight - viewportTop);
  const remainingContentHeight = Math.max(visibleHeight, rect.height - top);

  element.classList.add("navigation-loading-target");
  element.setAttribute("aria-busy", "true");

  return {
    element,
    top,
    // Cover the whole visible content column so the skeleton reads as the
    // page itself loading, not as a card floating above the previous page.
    height: Math.min(960, remainingContentHeight),
  };
}

function SlowContentSkeleton({ target }: { target: SlowTarget }) {
  return createPortal(
    <div
      className="navigation-content-skeleton"
      style={{ top: target.top, height: target.height }}
      aria-hidden="true"
    >
      <div className="navigation-skeleton-inner">
        <div className="navigation-skeleton-line navigation-skeleton-line-short" />
        <div className="navigation-skeleton-line navigation-skeleton-line-title" />
        <div className="navigation-skeleton-line navigation-skeleton-line-wide" />
        <div className="navigation-skeleton-line navigation-skeleton-line-medium" />
        <div className="navigation-skeleton-grid">
          <div className="navigation-skeleton-card" />
          <div className="navigation-skeleton-card" />
          <div className="navigation-skeleton-card" />
        </div>
        <div className="navigation-skeleton-rows">
          <div />
          <div />
          <div />
          <div />
        </div>
      </div>
    </div>,
    target.element,
  );
}

export default function NavigationLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [indicatorState, setIndicatorState] = useState<IndicatorState>("hidden");
  const [slowTarget, setSlowTarget] = useState<SlowTarget | null>(null);
  const pendingRef = useRef(false);
  const indicatorVisibleRef = useRef(false);
  const activeAnchorRef = useRef<HTMLAnchorElement | null>(null);
  const slowTargetRef = useRef<SlowTarget | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    if (failsafeRef.current) clearTimeout(failsafeRef.current);
    showTimerRef.current = null;
    slowTimerRef.current = null;
    completeTimerRef.current = null;
    failsafeRef.current = null;
  };

  const clearPendingDecorations = () => {
    if (activeAnchorRef.current) {
      activeAnchorRef.current.removeAttribute("data-navigation-loading");
      activeAnchorRef.current = null;
    }
    if (slowTargetRef.current) {
      slowTargetRef.current.element.classList.remove("navigation-loading-target");
      slowTargetRef.current.element.removeAttribute("aria-busy");
      slowTargetRef.current = null;
    }
    setSlowTarget(null);
  };

  const finish = () => {
    pendingRef.current = false;
    clearTimers();
    clearPendingDecorations();

    if (!indicatorVisibleRef.current) {
      setIndicatorState("hidden");
      return;
    }

    setIndicatorState("complete");
    completeTimerRef.current = setTimeout(() => {
      indicatorVisibleRef.current = false;
      setIndicatorState("hidden");
      completeTimerRef.current = null;
    }, COMPLETE_HOLD_MS);
  };

  const begin = (anchor?: HTMLAnchorElement) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    clearTimers();
    clearPendingDecorations();
    indicatorVisibleRef.current = false;
    setIndicatorState("hidden");

    if (anchor) {
      activeAnchorRef.current = anchor;
      anchor.setAttribute("data-navigation-loading", "true");
    }

    showTimerRef.current = setTimeout(() => {
      indicatorVisibleRef.current = true;
      setIndicatorState("running");
    }, SHOW_DELAY_MS);

    slowTimerRef.current = setTimeout(() => {
      const target = createSlowTarget();
      if (!target) return;
      slowTargetRef.current = target;
      setSlowTarget(target);
    }, SLOW_NAVIGATION_MS);

    failsafeRef.current = setTimeout(finish, FAILSAFE_MS);
  };

  useEffect(() => {
    finish();
    // A pathname/search change means the requested client route has committed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams?.toString()]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.dataset.noNavigationLoading === "true") return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      const currentUrl = new URL(window.location.href);
      if (nextUrl.origin !== currentUrl.origin) return;
      if (sameDocumentHashOnly(currentUrl, nextUrl)) return;
      if (
        nextUrl.pathname === currentUrl.pathname
        && nextUrl.search === currentUrl.search
        && nextUrl.hash === currentUrl.hash
      ) return;

      // Keep ownership of the navigation with Next.js so its cache remains intact.
      begin(anchor);
    };

    const onSubmit = (event: SubmitEvent) => {
      if (event.defaultPrevented) return;
      const form = event.target as HTMLFormElement | null;
      if (!form || form.method.toLowerCase() === "post") return;
      if (form.target && form.target !== "_self") return;
      if (form.dataset.noNavigationLoading === "true") return;

      let action: URL;
      try {
        action = new URL(form.action || window.location.href, window.location.href);
      } catch {
        return;
      }
      if (action.origin !== window.location.origin) return;

      begin();
    };

    const onPageShow = () => {
      // BFCache restores should remain instant; never force a refresh here.
      finish();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener("pageshow", onPageShow);
      clearTimers();
      clearPendingDecorations();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {indicatorState !== "hidden" ? (
        <div className="navigation-progress" role="status" aria-live="polite" aria-label="Loading page">
          <span className="sr-only">Loading the next page</span>
          <span className="navigation-progress-rail">
            <span className="navigation-progress-bar" data-state={indicatorState} />
          </span>
        </div>
      ) : null}
      {slowTarget ? <SlowContentSkeleton target={slowTarget} /> : null}
    </>
  );
}
