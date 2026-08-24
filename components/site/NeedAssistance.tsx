"use client";

import { useState } from "react";

const QUICK_LINKS = [
  {
    title: "Solutions",
    items: [
      { label: "Products", href: "/products" },
      { label: "Promotions", href: "/promotions" },
      { label: "Notice", href: "/notice" },
    ],
  },
  {
    title: "Services",
    items: [
      { label: "Request a Quote", href: "/quote" },
      { label: "Contact", href: "/contact" },
      { label: "Sourcing Support", href: "/about#what-we-do" },
      { label: "Delivery Coordination", href: "/about#how-we-work" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export default function NeedAssistance() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | "ok" | "fail">(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company: "",
    field: "",
    phone: "",
    dept: "",
    email: "",
    stage: "",
    type: "",
    message: "",
  });

  async function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    setErrorMessage("");

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          org: form.company,
          field: form.field,
          phone: form.phone,
          department: form.dept,
          email: form.email,
          inquiryType: form.type,
          message: form.message,
          privacyAccepted,
          sourceUrl: window.location.href,
          website: "",
        }),
      });
      const data = await response.json().catch(() => ({} as { ok?: boolean; error?: string }));
      if (!response.ok || data.ok !== true) throw new Error(data.error || "Failed to send your message.");

      setResult("ok");
      setPrivacyAccepted(false);
      setForm({ name: "", company: "", field: "", phone: "", dept: "", email: "", stage: "", type: "", message: "" });
    } catch (error) {
      setResult("fail");
      const subject = `[ITS BIO] ${form.type || "Website inquiry"} - ${form.name || "New inquiry"}`;
      const body = [
        `Name: ${form.name}`,
        `Company: ${form.company}`,
        `Field: ${form.field}`,
        `Phone: ${form.phone}`,
        `Department: ${form.dept}`,
        `Email: ${form.email}`,
        `Inquiry type: ${form.type}`,
        "",
        form.message,
      ].join("\n");
      window.location.href = `mailto:info@itsbio.co.kr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setErrorMessage("Direct sending is temporarily unavailable, so your email app has been opened with the message filled in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    // ✅ 아래쪽 여백을 섹션 자체에 추가해서 "NeedAssistance와 페이지 하단"이 딱 붙는 문제 해결
    // - pb: Need 섹션 아래 공간
    // - (필요하면) border/sep는 그대로 유지
    <section className="bg-slate-950 pb-16 md:pb-24 text-white">
      <div className="mx-auto max-w-7xl px-6 py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-12">
          {/* Left: columns */}
          <div className="md:col-span-7">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-2xl font-bold tracking-tight">Need assistance?</div>
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <div className="text-sm text-white/70">Contact our experts for support and fast quotations.</div>
            </div>

            <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_LINKS.map((col) => (
                <div key={col.title}>
                  <div className="text-sm font-semibold text-white/90">{col.title}</div>
                  <ul className="mt-3 space-y-2">
                    {col.items.map((it) => (
                      <li key={it.label}>
                        <a href={it.href} className="text-sm text-white/70 transition hover:text-white">
                          {it.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Contact details (KR + EN) */}
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-sm font-semibold text-white/90">(주)이츠바이오</div>
                <div className="mt-3 text-sm leading-6 text-white/70">
                  07532 서울특별시 강서구 양천로 551-17 한화비즈메트로 1차 812호
                  <br />
                  T : 02-3462-8658&nbsp;&nbsp;F : 02-3462-8659
                  <br />
                  E-mail :{" "}
                  <a className="text-white underline underline-offset-4" href="mailto:info@itsbio.co.kr">
                    info@itsbio.co.kr
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-sm font-semibold text-white/90">ITSBio, Inc.</div>
                <div className="mt-3 text-sm leading-6 text-white/70">
                  812, Hanwha Bizmetro A-dong, 551-17 YangcheonRo, Gangseo-Gu, Seoul, 07532, Korea,
                  Republic of
                  <br />
                  T : +82-2-3462-8658&nbsp;&nbsp;F : +82-2-3462-8659
                  <br />
                  E-mail :{" "}
                  <a className="text-white underline underline-offset-4" href="mailto:info@itsbio.co.kr">
                    info@itsbio.co.kr
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-2 text-xs text-white/50">
              <a className="transition hover:text-white/80" href="/privacy">
                Privacy Policy
              </a>
              <span>｜</span>
              <a className="transition hover:text-white/80" href="/terms">
                Terms
              </a>
              <span>｜</span>
              <span>© {new Date().getFullYear()} ITS BIO. All rights reserved.</span>
            </div>
          </div>

          {/* Right: online message form */}
          <div className="md:col-span-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white/90">Online Message</div>
                <div className="text-xs text-white/50">Send to info@itsbio.co.kr</div>
              </div>

              <form onSubmit={submitMessage} className="mt-4 grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
                  <Input
                    placeholder="Company"
                    value={form.company}
                    onChange={(v) => setForm((p) => ({ ...p, company: v }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Select
                    placeholder="Field"
                    value={form.field}
                    onChange={(v) => setForm((p) => ({ ...p, field: v }))}
                    options={["Life Science", "Biopharma", "Academic", "Other"]}
                  />
                  <Input
                    placeholder="Phone"
                    value={form.phone}
                    onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Department"
                    value={form.dept}
                    onChange={(v) => setForm((p) => ({ ...p, dept: v }))}
                  />
                  <Input
                    placeholder="Email"
                    value={form.email}
                    onChange={(v) => setForm((p) => ({ ...p, email: v }))}
                  />
                </div>

                <Select
                  placeholder="Message type"
                  value={form.type}
                  onChange={(v) => setForm((p) => ({ ...p, type: v }))}
                  options={["Quote request", "Product inquiry", "Shipping/Lead time", "Documents", "Other"]}
                />

                <Textarea placeholder="Message" value={form.message} onChange={(v) => setForm((p) => ({ ...p, message: v }))} />

                <label className="flex items-start gap-2 text-xs leading-5 text-white/65">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(event) => setPrivacyAccepted(event.target.checked)}
                    required
                    className="mt-1 accent-orange-600"
                  />
                  <span>
                    I agree to the collection and use of my information for this inquiry. See the{" "}
                    <a href="/privacy" className="underline underline-offset-2 hover:text-white">Privacy Policy</a>.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading || !privacyAccepted || !form.email.trim() || !form.message.trim()}
                  className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send"}
                </button>

                {result === "ok" ? <div className="rounded-xl bg-emerald-500/15 p-3 text-xs text-emerald-200">Your message has been sent. We will contact you soon.</div> : null}
                {result === "fail" ? <div className="rounded-xl bg-red-500/15 p-3 text-xs text-red-200">{errorMessage || "Could not send. Please email info@itsbio.co.kr."}</div> : null}
              </form>
            </div>
          </div>
        </div>

        <div className="mt-10 h-px bg-white/10" />
      </div>
    </section>
  );
}

function Input({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-white/40 outline-none ring-orange-500/40 focus:ring-2"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Textarea({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      className="min-h-[120px] w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none ring-orange-500/40 focus:ring-2"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Select({
  placeholder,
  value,
  onChange,
  options,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      className={`h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm outline-none ring-orange-500/40 focus:ring-2 ${
        value ? "text-white" : "text-white/40"
      }`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o} className="text-slate-900">
          {o}
        </option>
      ))}
    </select>
  );
}
