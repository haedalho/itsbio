"use client";

import { useState } from "react";

export default function QuotePage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<null | "ok" | "fail">(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setDone(null);
    setErrorMsg("");

    const formEl = e.currentTarget; // ✅ 폼을 안전하게 저장
    const form = new FormData(formEl);

    const payload = {
      name: String(form.get("name") ?? ""),
      org: String(form.get("org") ?? ""),
      email: String(form.get("email") ?? ""),
      product: String(form.get("product") ?? ""),
      message: String(form.get("message") ?? ""),
    };

    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({} as any));

      // ✅ 성공 조건: HTTP ok + data.ok === true
      if (!res.ok || data.ok !== true) {
        const msg = data?.error || `Request failed (status ${res.status})`;
        setErrorMsg(msg);
        console.error("Quote API failed:", res.status, data);
        throw new Error(msg);
      }

      setDone("ok");

      // ✅ reset이 가능한 경우에만 실행(안전)
      if (typeof (formEl as any).reset === "function") {
        (formEl as HTMLFormElement).reset();
      }
    } catch (err) {
      console.error("Send failed:", err);
      setDone("fail");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-3xl font-bold">Request a Quote</h1>
        <p className="mt-2 text-slate-600">Fill out the form and we’ll get back to you.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3 rounded-2xl bg-white border p-5">
          <input name="name" className="w-full rounded-xl border px-4 py-3" placeholder="Name" />
          <input name="org" className="w-full rounded-xl border px-4 py-3" placeholder="Company / Lab" />

          <input
            name="email"
            type="email"
            className="w-full rounded-xl border px-4 py-3"
            placeholder="Email *"
            required
          />

          <input
            name="product"
            className="w-full rounded-xl border px-4 py-3"
            placeholder="Product name / Cat No"
          />

          <textarea
            name="message"
            className="w-full rounded-xl border px-4 py-3"
            placeholder="Message *"
            rows={5}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-700 text-white px-4 py-3 font-semibold disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send"}
          </button>

          {done === "ok" && (
            <div className="text-sm rounded-xl bg-green-50 text-green-700 p-3">
              Sent! We will contact you soon.
            </div>
          )}

          {done === "fail" && (
            <div className="text-sm rounded-xl bg-red-50 text-red-700 p-3">
              Failed to send{errorMsg ? `: ${errorMsg}` : ". Please try again."}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
