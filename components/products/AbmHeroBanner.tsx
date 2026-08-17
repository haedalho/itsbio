export default function AbmHeroBanner({
  title = "ABM Products & Services",
  eyebrow = "ITS BIO",
}: {
  title?: string;
  eyebrow?: string;
}) {
  return (
    <section
      className="relative overflow-hidden border-b border-orange-200/50 bg-[#111827]"
      aria-label="ABM page hero"
    >
      <div className="absolute inset-0 bg-[linear-gradient(108deg,#111827_0%,#182235_38%,#c94d20_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.16]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage: "linear-gradient(to right, transparent 0%, black 52%, black 100%)",
        }}
      />

      <div className="pointer-events-none absolute -right-16 top-1/2 h-[310px] w-[310px] -translate-y-1/2 rounded-full border border-orange-200/25 md:right-[6%]" aria-hidden="true" />
      <div className="pointer-events-none absolute right-4 top-1/2 h-[210px] w-[210px] -translate-y-1/2 rounded-full border border-orange-100/30 md:right-[11%]" aria-hidden="true" />
      <div className="pointer-events-none absolute right-[85px] top-1/2 h-[82px] w-[82px] -translate-y-1/2 rounded-full bg-orange-400/25 blur-[1px] md:right-[16%]" aria-hidden="true" />
      <div className="pointer-events-none absolute right-[108px] top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-orange-300/90 shadow-[0_0_55px_rgba(251,146,60,.6)] md:right-[18%]" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[220px] max-w-[1320px] items-center px-6 py-12 md:min-h-[280px] md:py-16">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-orange-200">
            <span className="h-px w-8 bg-orange-300" aria-hidden="true" />
            {eyebrow}
          </div>
          <h1 className="mt-4 max-w-[850px] text-3xl font-semibold leading-[1.12] tracking-[-0.035em] text-white md:text-[44px]">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 md:text-[15px]">
            Life science reagents, cellular materials, genetic materials and research services from ABM.
          </p>
        </div>
      </div>
    </section>
  );
}
