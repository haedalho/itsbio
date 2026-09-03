"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import BrandLogo from "./BrandLogo";
import ProductsMegaMenu from "./ProductsMegaMenu";
import SearchBox from "./SearchBox";

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);

  return ref;
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useClickOutside<HTMLDivElement>(() => setMobileOpen(false));
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const warmRoutes = () => {
      // Warm only the routes a Cleaver visitor is most likely to use next.
      // This keeps the original mega-menu UI untouched while removing the
      // cold-navigation delay from the first Cleaver click.
      router.prefetch("/products/cleaver");

      if (!pathname.startsWith("/products/cleaver")) return;

      if (pathname === "/products/cleaver" || pathname === "/products/cleaver/") {
        router.prefetch("/products/cleaver/main-products");
        router.prefetch("/products/cleaver/accessories");
        return;
      }

      if (pathname.startsWith("/products/cleaver/main-products")) {
        [
          "/products/cleaver/main-products/electrophoresis-systems",
          "/products/cleaver/main-products/gel-documentation-imaging",
          "/products/cleaver/main-products/general-laboratory-equipment",
          "/products/cleaver/main-products/electrophoresis-reagents",
          "/products/cleaver/main-products/teaching-education",
        ].forEach((href) => router.prefetch(href));
        return;
      }

      if (pathname.startsWith("/products/cleaver/accessories")) {
        [
          "/products/cleaver/accessories/electrophoresis-accessories",
          "/products/cleaver/accessories/gel-documentation-accessories",
          "/products/cleaver/accessories/general-laboratory-accessories",
          "/products/cleaver/accessories/replacement-parts-spares",
        ].forEach((href) => router.prefetch(href));
      }
    };

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(warmRoutes, { timeout: 1200 });
    } else {
      timeoutId = setTimeout(warmRoutes, 450);
    }

    return () => {
      if (idleId !== null && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [pathname, router]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center gap-4 px-4 md:px-6">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-white md:hidden"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <div className="grid gap-1">
            <span className="h-0.5 w-5 bg-slate-900" />
            <span className="h-0.5 w-5 bg-slate-900" />
            <span className="h-0.5 w-5 bg-slate-900" />
          </div>
        </button>

        <BrandLogo className="shrink-0" />

        <nav className="hidden items-center gap-7 text-[15px] font-medium text-slate-700 md:flex">
          <ProductsMegaMenu />
          <Link href="/promotions" className="transition hover:text-orange-600">Promotions</Link>
          <Link href="/notice" className="transition hover:text-orange-600">Notice</Link>
          <Link href="/about" className="transition hover:text-orange-600">About</Link>
          <Link href="/contact" className="transition hover:text-orange-600">Contact</Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <SearchBox className="hidden w-80 md:block xl:w-[420px]" />
          <Link
            href="/quote"
            className="rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 md:px-6"
          >
            Request a Quote
          </Link>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-white/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          <div
            ref={panelRef}
            className="absolute left-0 top-0 h-full w-[min(86vw,360px)] bg-white shadow-2xl ring-1 ring-black/10"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile menu"
          >
            <div className="flex h-[76px] items-center justify-between border-b px-4">
              <BrandLogo />
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-white"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              <SearchBox
                className="w-full"
                placeholder="Search by Product Name, Catalog No..."
                onSubmitted={() => setMobileOpen(false)}
              />

              <nav className="mt-4 space-y-1">
                <Link
                  href="/products"
                  className="block rounded-xl border bg-slate-50 px-3 py-3 text-base font-semibold text-slate-900 hover:bg-slate-100"
                  onClick={() => setMobileOpen(false)}
                >
                  Products
                </Link>
                <Link href="/promotions" className="block rounded-xl px-3 py-3 text-base text-slate-700 hover:bg-slate-50" onClick={() => setMobileOpen(false)}>Promotions</Link>
                <Link href="/resources" className="block rounded-xl px-3 py-3 text-base text-slate-700 hover:bg-slate-50" onClick={() => setMobileOpen(false)}>Resources</Link>
                <Link href="/notice" className="block rounded-xl px-3 py-3 text-base text-slate-700 hover:bg-slate-50" onClick={() => setMobileOpen(false)}>Notice</Link>
                <Link href="/about" className="block rounded-xl px-3 py-3 text-base text-slate-700 hover:bg-slate-50" onClick={() => setMobileOpen(false)}>About</Link>
                <Link href="/contact" className="block rounded-xl px-3 py-3 text-base text-slate-700 hover:bg-slate-50" onClick={() => setMobileOpen(false)}>Contact</Link>
              </nav>

              <div className="mt-4 border-t pt-4">
                <Link
                  href="/quote"
                  className="block rounded-xl bg-orange-600 px-4 py-3 text-center text-base font-semibold text-white hover:bg-orange-700"
                  onClick={() => setMobileOpen(false)}
                >
                  Request a Quote
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
