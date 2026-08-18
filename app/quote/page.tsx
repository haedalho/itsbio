"use client";

import { useState } from "react";
import PageHero from "@/components/site/PageHero";

// Forces a fresh Preview deployment after server environment changes.
export default function QuotePage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<null | "ok" | "fail">(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setDone(null);
    setErrorMsg("");

    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const payload = {
      name: String(form.get("name") ?? ""),
      org: String(form.get("org") ?? ""),
      email: String(form.get("email") ?? ""),
      productName: String(form.get("productName") ?? ""),
      referenceNo: String(form.get("referenceNo") ?? ""),
      referenceLabel: "Cat. No. / Item #",
      message: String(form.get("message") ?? ""),
      sourceUrl: typeof window !== "undefined" ? window.location.href : "",
    };

    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.ok !== true) {
        const msg = data?.error || `Request failed (status ${res.status})`;
        setErrorMsg(msg);
        throw new Error(msg);
      }
      setDone("ok");
      formEl.reset();
    } catch (err) {
      console.error("Send failed:", err);
      setDone("fail");
    } finally {
      setLoading(false);
    }
  }

  const fieldClass = "h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-50";

  return (
    <main className="bg-slate-50/70">
      <PageHero
        eyebrow="REQUEST A QUOTE"
        title="Tell us what you need"
        description="Share a product name, catalog number, item number, or requirement. Our team will review your request and prepare the information you need."
        variant="quote"
        cta={{ label: "Start request", href: "#quote-form" }}
      />

      <section id="quote-form" className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14">
          <div className="pt-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Quotation support</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">A few details are enough to get started.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">If you do not know the exact catalog or item number, send the product name, a short specification, or the application. We can help identify the right option.</p>
            <div className="mt-8 space-y-5 border-t border-slate-200 pt-6 text-sm text-slate-600">
              <div><span className="font-semibold text-slate-900">Product request</span><div className="mt-1">Product name, Cat. No. / Item #, quantity, or specification.</div></div>
              <div><span className="font-semibold text-slate-900">Response</span><div className="mt-1">Availability, lead time, quotation, and alternatives when needed.</div></div>
              <div><span className="font-semibold text-slate-900">Email</span><div className="mt-1">info@itsbio.co.kr</div></div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] sm:p-7">
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="name" className={fieldClass} placeholder="Name" />
              <input name="org" className={fieldClass} placeholder="Company / Lab" />
            </div>
            <input name="email" type="email" className={`${fieldClass} mt-3`} placeholder="Email *" required />
            <input name="productName" className={`${fieldClass} mt-3`} placeholder="Product name" />
            <input name="referenceNo" className={`${fieldClass} mt-3`} placeholder="Cat. No. / Item #" />
            <textarea name="message" className="mt-3 min-h-[150px] w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-50" placeholder="Message *" required />

            <button type="submit" disabled={loading} className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-orange-600 px-5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? "Sending..." : "Send request"}
            </button>

            {done === "ok" ? <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Sent! We will contact you soon.</div> : null}
            {done === "fail" ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Failed to send{errorMsg ? `: ${errorMsg}` : ". Please try again."}</div> : null}
          </form>
        </div>
      </section>
    </main>
  );
}
