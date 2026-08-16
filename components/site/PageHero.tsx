import Link from "next/link";

type HeroVariant = "products" | "promotions" | "notice" | "about" | "contact" | "quote";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  variant: HeroVariant;
  cta?: { label: string; href: string };
};

function MiniLabVial({ className = "" }: { className?: string }) {
  return (
    <div className={`relative w-10 ${className}`}>
      <div className="mx-auto h-3 w-8 rounded-t-md bg-[#123d76]" />
      <div className="mx-auto h-20 w-7 rounded-b-xl border border-slate-200 bg-white/90 shadow-sm">
        <div className="mx-auto mt-4 h-px w-4 bg-slate-300" />
        <div className="mx-auto mt-2 h-px w-4 bg-slate-300" />
        <div className="mx-auto mt-2 h-px w-3 bg-slate-300" />
      </div>
    </div>
  );
}

function ProductsVisual() {
  return (
    <div className="relative mx-auto h-[250px] w-full max-w-[460px]">
      <div className="absolute left-14 top-14 flex items-end gap-3">
        <MiniLabVial />
        <MiniLabVial className="scale-110" />
        <MiniLabVial className="scale-75 opacity-80" />
      </div>
      <div className="absolute bottom-10 right-7 h-28 w-48 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
        <div className="text-xs font-bold tracking-[0.18em] text-[#123d76]">ITS BIO</div>
        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {Array.from({ length: 15 }).map((_, i) => <span key={i} className="aspect-square rounded-sm border border-slate-200 bg-slate-50" />)}
        </div>
      </div>
      <div className="absolute bottom-6 left-10 h-10 w-56 -rotate-12 rounded-full border border-slate-200 bg-white shadow-lg">
        <span className="absolute right-8 top-1.5 h-7 w-12 rounded-full bg-[#123d76]" />
        <span className="absolute -right-10 top-[18px] h-px w-12 bg-slate-400" />
      </div>
    </div>
  );
}

function PromotionsVisual() {
  return (
    <div className="relative mx-auto h-[250px] w-full max-w-[460px]">
      <div className="absolute left-5 top-12 h-40 w-52 -rotate-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_22px_55px_rgba(15,23,42,0.10)]">
        <span className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-orange-600">Featured</span>
        <div className="mt-5 h-3 w-28 rounded-full bg-slate-200" />
        <div className="mt-3 h-2 w-36 rounded-full bg-slate-100" />
        <div className="mt-7 inline-flex rounded-full bg-[#123d76] px-3 py-1 text-xs font-semibold text-white">Partner offer</div>
      </div>
      <div className="absolute right-4 top-4 flex h-28 w-28 rotate-6 items-center justify-center rounded-[30px] bg-orange-600 text-5xl font-black text-white shadow-[0_22px_50px_rgba(234,88,12,0.25)]">%</div>
      <div className="absolute bottom-7 right-12 h-28 w-56 rotate-2 rounded-3xl border border-orange-100 bg-[#fffaf5] p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Limited time</div>
        <div className="mt-3 text-xl font-semibold text-slate-900">Scientific offers</div>
        <div className="mt-3 h-2 w-32 rounded-full bg-orange-100" />
      </div>
    </div>
  );
}

function NoticeVisual() {
  return (
    <div className="relative mx-auto h-[250px] w-full max-w-[460px]">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute h-36 w-60 rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-[0_22px_55px_rgba(15,23,42,0.10)]"
          style={{ left: `${22 + i * 62}px`, top: `${70 - i * 25}px`, transform: `rotate(${i * 2 - 2}deg)`, zIndex: i + 1 }}
        >
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${i === 2 ? "bg-orange-50 text-orange-600" : "bg-slate-100 text-slate-500"}`}>
            {i === 0 ? "News" : i === 1 ? "Update" : "Notice"}
          </span>
          <div className="mt-4 h-3 w-32 rounded-full bg-slate-800/80" />
          <div className="mt-3 h-2 w-40 rounded-full bg-slate-100" />
          <div className="mt-2 h-2 w-28 rounded-full bg-slate-100" />
        </div>
      ))}
      <div className="absolute right-4 top-3 z-10 flex h-16 w-16 items-center justify-center rounded-full border border-orange-100 bg-white text-orange-600 shadow-lg">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
      </div>
    </div>
  );
}

function AboutVisual() {
  return (
    <div className="relative mx-auto flex h-[250px] w-full max-w-[460px] items-center justify-center">
      <div className="relative flex h-48 w-48 items-center justify-center rounded-full border border-slate-200 bg-white/80 shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
        <div className="absolute inset-6 rounded-full border border-dashed border-orange-200" />
        <svg viewBox="0 0 100 100" className="h-32 w-32 text-[#123d76]" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="50" cy="50" r="38"/><ellipse cx="50" cy="50" rx="18" ry="38"/><path d="M12 50h76M20 32h60M20 68h60"/>
        </svg>
      </div>
      {[[20,40,"Partners"],[310,28,"Science"],[325,175,"Trust"],[5,180,"Support"]].map(([left, top, label]) => (
        <div key={String(label)} className="absolute rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg" style={{ left, top }}>{label}</div>
      ))}
    </div>
  );
}

function ContactVisual() {
  return (
    <div className="relative mx-auto h-[250px] w-full max-w-[460px]">
      <div className="absolute right-6 top-6 h-48 w-72 rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_65px_rgba(15,23,42,0.11)]">
        <div className="text-xs font-bold tracking-[0.18em] text-[#123d76]">ITS BIO</div>
        <div className="mt-4 text-xl font-semibold text-slate-900">How can we help?</div>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center text-[11px] font-medium text-slate-500">
          {['Email','Product','Support'].map((x) => <div key={x} className="rounded-xl bg-slate-50 px-2 py-3">{x}</div>)}
        </div>
      </div>
      <div className="absolute left-7 top-16 rounded-[28px_28px_28px_8px] bg-[#123d76] px-7 py-5 shadow-xl">
        <div className="flex gap-2">{[0,1,2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-white" />)}</div>
      </div>
      <div className="absolute bottom-7 left-28 rounded-[24px_24px_8px_24px] border border-slate-200 bg-white px-6 py-4 shadow-lg">
        <div className="flex gap-2">{[0,1,2].map(i => <span key={i} className="h-2 w-2 rounded-full bg-slate-300" />)}</div>
      </div>
    </div>
  );
}

function QuoteVisual() {
  return (
    <div className="relative mx-auto h-[250px] w-full max-w-[460px]">
      <div className="absolute left-20 top-3 h-56 w-72 rotate-2 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_26px_70px_rgba(15,23,42,0.12)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-[0.14em] text-[#123d76]">Quote request</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-orange-600">✓</span>
        </div>
        <div className="mt-6 space-y-3">
          {["Product / Service", "Catalog Number", "Quantity", "Additional information"].map((x, i) => (
            <div key={x} className={`${i === 3 ? "h-12" : "h-8"} rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-medium text-slate-400`}>{x}</div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-2 left-5 rounded-2xl border border-orange-100 bg-[#fffaf5] px-5 py-3 text-xs font-semibold text-orange-700 shadow-lg">Fast response</div>
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
  return (
    <section className="relative isolate overflow-hidden border-b border-slate-200 bg-[#fbfaf8]">
      <div className="pointer-events-none absolute -right-28 -top-44 h-[520px] w-[520px] rounded-full border border-orange-100" />
      <div className="pointer-events-none absolute right-[18%] top-14 h-52 w-52 rounded-full border border-dashed border-slate-200" />
      <div className="pointer-events-none absolute left-[44%] top-0 h-full w-px bg-gradient-to-b from-transparent via-orange-100 to-transparent" />
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:26px_26px] [mask-image:linear-gradient(to_right,transparent,transparent_45%,black_80%,transparent)]" />

      <div className="relative mx-auto grid min-h-[310px] max-w-6xl items-center gap-8 px-6 py-10 md:min-h-[340px] lg:grid-cols-[1.03fr_.97fr] lg:py-0">
        <div className="relative z-10 max-w-[650px]">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-orange-600">{eyebrow}</div>
          <h1 className="mt-4 text-[38px] font-semibold leading-[1.08] tracking-[-0.045em] text-[#071d43] sm:text-[44px] md:text-[50px]">
            {title}
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-7 text-slate-600 md:text-base">{description}</p>
          {cta ? (
            <Link href={cta.href} className="mt-7 inline-flex h-11 items-center gap-5 rounded-full bg-orange-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-orange-700">
              {cta.label}<span aria-hidden>→</span>
            </Link>
          ) : null}
        </div>

        <div className="relative hidden min-h-[270px] items-center lg:flex">
          <HeroVisual variant={variant} />
        </div>
      </div>
    </section>
  );
}
