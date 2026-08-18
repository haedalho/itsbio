"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SHOW_DELAY_MS = 140;
const FAILSAFE_MS = 12000;

function sameDocumentHashOnly(current: URL, target: URL) {
  return (
    current.origin === target.origin
    && current.pathname === target.pathname
    && current.search === target.search
    && current.hash !== target.hash
  );
}

export default function NavigationLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const pendingRef = useRef(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    if (failsafeRef.current) clearTimeout(failsafeRef.current);
    showTimerRef.current = null;
    failsafeRef.current = null;
  };

  const finish = () => {
    pendingRef.current = false;
    clearTimers();
    setVisible(false);
  };

  const begin = () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    clearTimers();
    showTimerRef.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
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

      // Do not prevent the click and do not call router.push here.
      // Next.js Link must keep ownership of the navigation so its native
      // prefetch/cache path remains intact. The overlay is visual feedback only.
      begin();
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

      // Keep the browser/framework's normal form navigation path as well.
      begin();
    };

    const onPageShow = () => {
      // BFCache restores should be instant. Do not force router.refresh() here;
      // it turns an otherwise instant back/forward navigation into a server fetch.
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-white/58 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="flex min-w-[190px] flex-col items-center rounded-[24px] border border-slate-200 bg-white/95 px-8 py-7 shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
        <div className="relative h-11 w-11" aria-hidden="true">
          <div className="absolute inset-0 rounded-full border-[3px] border-amber-100" />
          <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-r-amber-400 border-t-amber-500" />
          <div className="absolute inset-[15px] rounded-full bg-amber-400" />
        </div>
        <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">ITS BIO</div>
        <div className="mt-1 text-sm font-semibold text-slate-900">Loading…</div>
      </div>
    </div>
  );
}
