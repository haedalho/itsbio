import Link from "next/link";

type HeroVariant = "products" | "promotions" | "notice" | "about" | "contact" | "quote";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  variant: HeroVariant;
  cta?: { label: string; href: string };
};

const VARIANT_ACCENTS: Record<HeroVariant, { accent: string; soft: string; label: string }> = {
  products: { accent: "#f97316", soft: "#fff7ed", label: "Catalog" },
  promotions: { accent: "#fb923c", soft: "#fff7ed", label: "Featured" },
  notice: { accent: "#38bdf8", soft: "#f0f9ff", label: "Updates" },
  about: { accent: "#2dd4bf", soft: "#f0fdfa", label: "Network" },
  contact: { accent: "#818cf8", soft: "#eef2ff", label: "Support" },
  quote: { accent: "#34d399", soft: "#ecfdf5", label: "Inquiry" },
};

function ProductsVisual() {
  return (
    <div className="relative h-[252px] w-full max-w-[470px]">
      <div className="absolute left-8 top-10 h-40 w-60 -rotate-3 rounded-[28px] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-300">Scientific catalog</div>
        <div className="mt-5 grid grid-cols-5 gap-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <span key={i} className="aspect-square rounded-md border border-white/20 bg-white/10" />
          ))}
        </div>
      </div>
      <div className="absolute bottom-4 right-3 w-60 rotate-2 rounded-[28px] bg-white p-5 shadow-[0_26px_70px_rgba(0,0,0,.28)]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-[0.16em] text-[#123d76]">ITS BIO</span>
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
        </div>
        <div className="mt-5 h-3 w-32 rounded-full bg-slate-200" />
        <div className="mt-3 h-2 w-44 rounded-full bg-slate-100" />
        <div className="mt-2 h-2 w-36 rounded-full bg-slate-100" />
        <div className="mt-5 inline-flex rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold text-orange-700">Products · Services</div>
      </div>
    </div>
  );
}

function PromotionsVisual() {
  return (
    <div className="relative h-[252px] w-full max-w-[470px]">
      <div className="absolute left-5 top-12 h-40 w-60 -rotate-3 rounded-[28px] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
        <span className="rounded-full bg-orange-400/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-orange-200">Featured</span>
        <div className="mt-5 h-3 w-32 rounded-full bg-white/35" />
        <div className="mt-3 h-2 w-40 rounded-full bg-white/15" />
        <div className="mt-7 inline-flex rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/85">Partner offer</div>
      </div>
      <div className="absolute right-7 top-3 flex h-28 w-28 rotate-6 items-center justify-center rounded-[30px] bg-orange-500 text-5xl font-black text-white shadow-[0_22px_60px_rgba(249,115,22,.35)]">%</div>
      <div className="absolute bottom-2 right-10 w-56 rotate-1 rounded-[26px] bg-white p-5 shadow-[0_24px_65px_rgba(0,0,0,.25)]">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Limited time</div>
        <div className="mt-3 text-xl font-semibold text-slate-900">Scientific offers</div>
        <div className="mt-3 h-2 w-32 rounded-full bg-orange-100" />
      </div>
    </div>
  );
}

function NoticeVisual() {
  return (
    <div className="relative h-[252px] w-full max-w-[470px]">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute h-36 w-60 rounded-[26px] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-md"
          style={{ left: `${18 + i * 66}px`, top: `${74 - i * 25}px`, transform: `rotate(${i * 2 - 2}deg)`, zIndex: i + 1 }}
        >
          <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-200">
            {i === 0 ? "News" : i === 1 ? "Update" : "Notice"}
          </span>
          <div className="mt-4 h-3 w-32 rounded-full bg-white/35" />
          <div className="mt-3 h-2 w-40 rounded-full bg-white/15" />
          <div className="mt-2 h-2 w-28 rounded-full bg-white/15" />
        </div>
      ))}
      <div className="absolute right-4 top-3 z-10 flex h-16 w-16 items-center justify-center rounded-full bg-sky-400 text-[#071d43] shadow-xl">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
      </div>
    </div>
  );
}

function AboutVisual() {
  return (
    <div className="relative flex h-[252px] w-full max-w-[470px] items-center justify-center">
      <div className="relative flex h-48 w-48 items-center justify-center rounded-full border border-white/15 bg-white/10 shadow-2xl backdrop-blur-md">
        <div className="absolute inset-6 rounded-full border border-dashed border-teal-300/40" />
        <svg viewBox="0 0 100 100" className="h-32 w-32 text-teal-200" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="50" cy="50" r="38"/><ellipse cx="50" cy="50" rx="18" ry="38"/><path d="M12 50h76M20 32h60M20 68h60"/>
        </svg>
      </div>
      {[[18,42,"Partners"],[320,28,"Science"],[330,177,"Trust"],[5,182,"Support"]].map(([left, top, label]) => (
        <div key={String(label)} className="absolute rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xl" style={{ left, top }}>{label}</div>
      ))}
    </div>
  );
}

function ContactVisual() {
  return (
    <div className="relative h-[252px] w-full max-w-[470px]">
      <div className="absolute right-5 top-5 h-48 w-72 rounded-[32px] bg-white p-6 shadow-[0_26px_70px_rgba(0,0,0,.28)]">
        <div className="text-xs font-bold tracking-[0.18em] text-[#123d76]">ITS BIO</div>
        <div className="mt-4 text-xl font-semibold text-slate-900">How can we help?</div>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center text-[11px] font-medium text-slate-500">
          {['Email','Product','Support'].map((x) => <div key={x} className="rounded-xl bg-slate-50 px-2 py-3">{x}</div>)}
        </div>
      </div>
      <div className="absolute left-7 top-16 rounded-[28px_28px_28px_8px] bg-indigo-400 px-7 py-5 shadow-xl">
        <div className="flex gap-2">{[0,1,2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-white" />)}</div>
      </div>
      <div className="absolute bottom-5 left-28 rounded-[24px_24px_8px_24px] border border-white/15 bg-white/10 px-6 py-4 shadow-lg backdrop-blur-md">
        <div className="flex gap-2">{[0,1,2].map(i => <span key={i} className="h-2 w-2 rounded-full bg-white/55" />)}</div>
      </div>
    </div>
  );
}

function QuoteVisual() {
  return (
    <div className="relative h-[252px] w-full max-w-[470px]">
      <div className="absolute left-20 top-3 h-56 w-72 rotate-2 rounded-[28px] bg-white p-6 shadow-[0_26px_70px_rgba(0,0,0,.28)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-[0.14em] text-[#123d76]">Quote request</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">✓</span>
        </div>
        <div className="mt-6 space-y-3">
          {["Product / Service", "Catalog Number", "Quantity", "Additional information"].map((x, i) => (
            <div key={x} className={`${i === 3 ? "h-12" : "h-8"} rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-medium text-slate-400`}>{x}</div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-2 left-5 rounded-2xl bg-emerald-400 px-5 py-3 text-xs font-semibold text-[#073b32] shadow-lg">Fast response</div>
    </div>
  );
}

function HeroVisual({ variant }: { variant: HeroVariant }) {
  if (variant === "promotions") return <PromotionsVisual />;
  if (variant === "notice") return <NoticeVisual />;
  if (variant === "about") return <AboutVisual />;
  if (variant === "contact") return <ContactVisual />;
  if (variant === "quote") return <QuoteVisual />;
  return <ProductsVisual />;
}

export default function PageHero({ eyebrow, title, description, variant, cta }: PageHeroProps) {
  const accent = VARIANT_ACCENTS[variant];

  return (
    <section className="relative isolate overflow-hidden border-b border-slate-900/10 bg-[#071d43] text-white">
      <div className="pointer-events-none absolute -right-24 -top-48 h-[560px] w-[560px] rounded-full bg-orange-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-[-260px] h-[520px] w-[520px] rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[17%] top-10 h-56 w-56 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:28px_28px] [mask-image:linear-gradient(to_right,transparent,black_42%,black_92%,transparent)]" />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-orange-300 to-sky-400" />

      <div className="relative mx-auto grid min-h-[330px] max-w-6xl items-center gap-8 px-6 py-12 md:min-h-[360px] lg:grid-cols-[1.04fr_.96fr] lg:py-0">
        <div className="relative z-10 max-w-[650px]">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent.accent }} />
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-orange-300">{eyebrow}</div>
          </div>
          <h1 className="mt-4 text-[38px] font-semibold leading-[1.06] tracking-[-0.045em] text-white sm:text-[44px] md:text-[52px]">
            {title}
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-7 text-white/70 md:text-base">{description}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {cta ? (
              <Link href={cta.href} className="inline-flex h-11 items-center gap-5 rounded-full bg-orange-500 px-6 text-sm font-semibold text-white shadow-lg shadow-orange-950/20 transition hover:-translate-y-0.5 hover:bg-orange-400">
                {cta.label}<span aria-hidden>→</span>
              </Link>
            ) : null}
            <span className="inline-flex h-9 items-center rounded-full border border-white/15 bg-white/5 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
              {accent.label}
            </span>
          </div>
        </div>

        <div className="relative hidden min-h-[285px] items-center lg:flex">
          <HeroVisual variant={variant} />
        </div>
      </div>
    </section>
  );
}
