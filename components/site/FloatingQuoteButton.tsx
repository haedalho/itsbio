"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type QuoteOpenDetail = {
  product?: string;
};

export default function FloatingQuoteButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<null | "ok" | "fail">(null);
  const [errorMsg, setErrorMsg] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const productRef = useRef<HTMLInputElement | null>(null);
  const pendingProductRef = useRef("");

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const onOpenQuote = (event: Event) => {
      const detail = (event as CustomEvent<QuoteOpenDetail>).detail;
      pendingProductRef.current = String(detail?.product || "").trim();
      openPanel(pendingProductRef.current);
    };

    window.addEventListener("itsbio:open-quote", onOpenQuote);
    return () => window.removeEventListener("itsbio:open-quote", onOpenQuote);
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
    setDone(null);
    setErrorMsg("");
    pendingProductRef.current = "";
  }, [pathname]);

  function openPanel(productOverride = "") {
    const explicitProduct = String(productOverride || pendingProductRef.current || "").trim();
    setOpen(true);
    setDone(null);
    setErrorMsg("");

    window.setTimeout(() => {
      if (!productRef.current) return;

      if (explicitProduct) {
        productRef.current.value = explicitProduct;
        pendingProductRef.current = "";
        return;
      }

      if (productRef.current.value.trim()) return;
      if (!pathname.startsWith("/products")) return;

      const heading = document.querySelector("main h1")?.textContent?.trim();
      if (heading) productRef.current.value = heading;
    }, 0);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setDone(null);
    setErrorMsg("");

    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const payload = {
      name: String(form.get("name") ?? ""),
      org: String(form.get("org") ?? ""),
      email: String(form.get("email") ?? ""),
      product: String(form.get("product") ?? ""),
      message: String(form.get("message") ?? ""),
      privacyAccepted: form.get("privacyAccepted") === "on",
      website: String(form.get("website") ?? ""),
      sourceUrl: window.location.href,
    };

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({} as { ok?: boolean; error?: string }));

      if (!response.ok || data.ok !== true) {
        const message = data?.error || `Request failed (status ${response.status})`;
        setErrorMsg(message);
        throw new Error(message);
      }

      setDone("ok");
      formEl.reset();
    } catch (error) {
      console.error("Quote send failed:", error);
      setDone("fail");
      const subject = `[ITS BIO] Quote request - ${payload.product || payload.name || "New inquiry"}`;
      const body = [`Name: ${payload.name}`, `Company / Lab: ${payload.org}`, `Email: ${payload.email}`, `Product / Cat No: ${payload.product}`, "", payload.message].join("\n");
      window.location.href = `mailto:info@itsbio.co.kr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setErrorMsg("Direct sending is temporarily unavailable. Your email app has been opened with the request filled in.");
    } finally {
      setLoading(false);
    }
  }

  if (pathname === "/quote") return null;

  return (
    <>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close quote form"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[69] bg-slate-950/20 backdrop-blur-[1px] md:bg-transparent md:backdrop-blur-none"
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Request a Quote"
            className="fixed inset-x-3 bottom-3 z-[70] max-h-[calc(100vh-24px)] overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] md:inset-x-auto md:bottom-7 md:right-7 md:w-[430px]"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur md:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">ITS BIO</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Request a Quote</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Send an inquiry without leaving this page.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-lg text-slate-500 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3 p-5 md:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="name"
                  className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  placeholder="Name"
                />
                <input
                  name="org"
                  className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  placeholder="Company / Lab"
                />
              </div>

              <input
                name="email"
                type="email"
                required
                className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                placeholder="Email *"
              />

              <input
                ref={productRef}
                name="product"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                placeholder="Product name / Cat No"
              />

              <textarea
                name="message"
                required
                rows={4}
                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                placeholder="Message *"
              />

              <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
              <label className="flex items-start gap-2 text-xs leading-5 text-slate-600">
                <input name="privacyAccepted" type="checkbox" required className="mt-1 accent-orange-600" />
                <span>
                  I agree to the use of my information for this inquiry. See the{" "}
                  <a href="/privacy" className="font-medium text-slate-900 underline underline-offset-2">Privacy Policy</a>.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? "Sending..." : "Send inquiry"}
              </button>

              {done === "ok" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  Sent successfully. We will contact you soon.
                </div>
              ) : null}

              {done === "fail" ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Failed to send{errorMsg ? `: ${errorMsg}` : ". Please try again."}
                </div>
              ) : null}
            </form>
          </div>
        </>
      ) : null}

      <button
        type="button"
        onClick={() => openPanel()}
        aria-label="Request a Quote"
        aria-expanded={open}
        className="group fixed bottom-6 right-5 z-[68] flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-white shadow-[0_12px_34px_rgba(234,88,12,0.32)] ring-1 ring-orange-700/10 transition hover:-translate-y-1 hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 md:bottom-7 md:right-7"
      >
        <span className="pointer-events-none absolute right-[calc(100%+12px)] hidden whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-lg transition md:block md:translate-x-2 md:opacity-0 md:group-hover:translate-x-0 md:group-hover:opacity-100 md:group-focus-visible:translate-x-0 md:group-focus-visible:opacity-100">
          Request a Quote
        </span>
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 5.75h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H10l-5 3v-3H5a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 2-2Z" />
          <path d="M7.5 10h9" />
          <path d="M7.5 14h6" />
        </svg>
      </button>
    </>
  );
}
