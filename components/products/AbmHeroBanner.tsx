import Image from "next/image";

export default function AbmHeroBanner({
  title = "ABM Products & Services",
  eyebrow = "ITS BIO",
}: {
  title?: string;
  eyebrow?: string;
}) {
  return (
    <section className="relative" aria-label="ABM page hero">
      <div className="relative h-[220px] w-full overflow-hidden md:h-[280px]">
        <Image src="/hero.png" alt="" fill priority className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/55 via-slate-950/20 to-transparent" />
        <div className="absolute inset-0">
          <div className="mx-auto flex h-full max-w-[1320px] items-center px-6">
            <div className="max-w-4xl">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">{eyebrow}</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">{title}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
