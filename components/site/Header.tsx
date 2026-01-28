"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ProductsMegaMenu from "./ProductsMegaMenu";

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

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-6">
        {/* Mobile: hamburger */}
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

        {/* Logo */}
        <div className="font-bold text-xl md:text-2xl">
          <Link href="/" className="hover:text-slate-900">
            Itsbio
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-base text-slate-600 md:flex">
          {/* ✅ Products: hover=mega, click=/product (로직은 ProductsMegaMenu 안에서 처리) */}
          <ProductsMegaMenu />

          <Link href="/promotions" className="hover:text-slate-900">
            Promotions
          </Link>
          <Link href="/notice" className="hover:text-slate-900">
            Notice
          </Link>
          <Link href="/about" className="hover:text-slate-900">
            About
          </Link>
          <Link href="/contact" className="hover:text-slate-900">
            Contact
          </Link>
        </nav>

        {/* Right */}
        <div className="ml-auto flex items-center gap-3">
          <input
            className="hidden h-11 w-80 rounded-full border bg-white px-5 text-sm md:block"
            placeholder="Search by Product Name, Catalog No..."
          />
          <Link
            href="/quote"
            className="rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 md:px-5"
          >
            Request a Quote
          </Link>
        </div>
      </div>

      {/* Mobile drawer */}
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
            <div className="flex h-16 items-center justify-between border-b px-4">
              <div className="font-bold text-lg">Menu</div>
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
              <input
                className="h-11 w-full rounded-xl border bg-white px-4 text-sm"
                placeholder="Search by Product Name, Catalog No..."
              />

              <nav className="mt-4 space-y-1">
                <Link
                  href="/products"
                  className="block rounded-xl border bg-slate-50 px-3 py-3 text-base font-semibold text-slate-900 hover:bg-slate-100"
                  onClick={() => setMobileOpen(false)}
                >
                  Products
                </Link>

                <Link
                  href="/promotions"
                  className="block rounded-xl px-3 py-3 text-base text-slate-700 hover:bg-slate-50"
                  onClick={() => setMobileOpen(false)}
                >
                  Promotions
                </Link>
                <Link
                  href="/resources"
                  className="block rounded-xl px-3 py-3 text-base text-slate-700 hover:bg-slate-50"
                  onClick={() => setMobileOpen(false)}
                >
                  Resources
                </Link>
                <Link
                  href="/notice"
                  className="block rounded-xl px-3 py-3 text-base text-slate-700 hover:bg-slate-50"
                  onClick={() => setMobileOpen(false)}
                >
                  Notice
                </Link>
                <Link
                  href="/about"
                  className="block rounded-xl px-3 py-3 text-base text-slate-700 hover:bg-slate-50"
                  onClick={() => setMobileOpen(false)}
                >
                  About
                </Link>
                <Link
                  href="/contact"
                  className="block rounded-xl px-3 py-3 text-base text-slate-700 hover:bg-slate-50"
                  onClick={() => setMobileOpen(false)}
                >
                  Contact
                </Link>
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