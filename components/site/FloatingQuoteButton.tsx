"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type QuoteContext = {
  productName?: string;
  referenceNo?: string;
  referenceLabel?: string;
};

type QuoteOpenDetail = QuoteContext & {
  product?: string;
  catalogNo?: string;
  itemNo?: string;
};

function clean(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function contextFromCombinedProduct(value: unknown): QuoteContext {
  const raw = clean(value);
  if (!raw) return {};

  const catMatch = raw.match(/^(.*?)\s+[—–-]\s+Cat\.?\s*No\.?\s*[:#]?\s*(.+)$/i);
  if (catMatch) {
    return {
      productName: clean(catMatch[1]),
      referenceNo: clean(catMatch[2]),
      referenceLabel: "Cat. No.",
    };
  }

  const itemMatch = raw.match(/^(.*?)\s+[—–-]\s+Item\s*#?\s*[:#]?\s*(.+)$/i);
  if (itemMatch) {
    return {
      productName: clean(itemMatch[1]),
      referenceNo: clean(itemMatch[2]),
      referenceLabel: "Item #",
    };
  }

  return { productName: raw };
}

function contextFromDetail(detail?: QuoteOpenDetail): QuoteContext {
  if (!detail) return {};
  const combined = contextFromCombinedProduct(detail.product);
  const itemNo = clean(detail.itemNo);
  const catalogNo = clean(detail.catalogNo);
  const explicitReference = clean(detail.referenceNo) || itemNo || catalogNo;

  return {
    productName: clean(detail.productName) || combined.productName,
    referenceNo: explicitReference || combined.referenceNo,
    referenceLabel:
      clean(detail.referenceLabel) ||
      (itemNo ? "Item #" : catalogNo ? "Cat. No." : combined.referenceLabel),
  };
}

function findLabeledValue(labelPattern: RegExp) {
  const candidates = Array.from(document.querySelectorAll("dt, span, strong"));
  const label = candidates.find((element) => labelPattern.test(clean(element.textContent)));
  if (!label) return "";

  if (label.tagName.toLowerCase() === "dt") {
    const dd = label.parentElement?.querySelector("dd");
    if (dd) return clean(dd.textContent);
  }

  const parentText = clean(label.parentElement?.textContent);
  const labelText = clean(label.textContent);
  if (parentText && labelText && parentText !== labelText) {
    return clean(parentText.slice(parentText.indexOf(labelText) + labelText.length));
  }

  return "";
}

function inferPageContext(pathname: string): QuoteContext {
  if (!pathname.startsWith("/products")) return {};

  const productName = clean(document.querySelector("h1")?.textContent);

  if (pathname.startsWith("/products/kent/")) {
    return {
      productName,
      referenceNo: findLabeledValue(/^Item\s*#$/i),
      referenceLabel: "Item #",
    };
  }

  return {
    productName,
    referenceNo: findLabeledValue(/^Cat\.?\s*No\.?$/i),
    referenceLabel: "Cat. No.",
  };
}

export default function FloatingQuoteButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<null | "ok" | "fail">(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [referenceLabel, setReferenceLabel] = useState("Cat. No. / Item #");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const productNameRef = useRef<HTMLInputElement | null>(null);
  const referenceNoRef = useRef<HTMLInputElement | null>(null);
  const pendingContextRef = useRef<QuoteContext>({});

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
      pendingContextRef.current = contextFromDetail(detail);
      openPanel(pendingContextRef.current);
    };

    window.addEventListener("itsbio:open-quote", onOpenQuote);
    return () => window.removeEventListener("itsbio:open-quote", onOpenQuote);
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
    setDone(null);
    setErrorMsg("");
    setReferenceLabel("Cat. No. / Item #");
    pendingContextRef.current = {};
  }, [pathname]);

  function openPanel(contextOverride: QuoteContext = {}) {
    const pending = pendingContextRef.current;
    const inferred = inferPageContext(pathname);
    const context = {
      productName: clean(contextOverride.productName) || clean(pending.productName) || clean(inferred.productName),
      referenceNo: clean(contextOverride.referenceNo) || clean(pending.referenceNo) || clean(inferred.referenceNo),
      referenceLabel: clean(contextOverride.referenceLabel) || clean(pending.referenceLabel) || clean(inferred.referenceLabel) || "Cat. No. / Item #",
    };

    setOpen(true);
    setDone(null);
    setErrorMsg("");
    setReferenceLabel(context.referenceLabel);

    window.setTimeout(() => {
      if (productNameRef.current && !productNameRef.current.value.trim()) {
        productNameRef.current.value = context.productName;
      }
      if (referenceNoRef.current && !referenceNoRef.current.value.trim()) {
        referenceNoRef.current.value = context.referenceNo;
      }
      pendingContextRef.current = {};
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
      productName: String(form.get("productName") ?? ""),
      referenceNo: String(form.get("referenceNo") ?? ""),
      referenceLabel,
      message: String(form.get("message") ?? ""),
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
                ref={productNameRef}
                name="productName"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                placeholder="Product name"
              />

              <input
                ref={referenceNoRef}
                name="referenceNo"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                placeholder={referenceLabel}
              />

              <textarea
                name="message"
                required
                rows={4}
                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                placeholder="Message *"
              />

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
