"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HERO_IMAGE =
  "data:image/jpeg;base64,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";

export default function HomeHeroOverride() {
  const pathname = usePathname();
  if (pathname !== "/") return null;

  return (
    <>
      <style jsx global>{`
        body:has(.itsbio-home-hero-override) main > section#top {
          display: none !important;
        }
      `}</style>

      <section className="itsbio-home-hero-override relative isolate overflow-hidden bg-[#fbfaf8]">
        <div className="absolute inset-y-0 right-0 w-full md:w-[62%]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${HERO_IMAGE})` }}
          />
          <div className="absolute inset-0 bg-white/24 md:bg-transparent" />
        </div>

        <div className="absolute inset-0 bg-gradient-to-r from-[#fbfaf8] via-[#fbfaf8]/95 to-[#fbfaf8]/15 md:via-[#fbfaf8]/88 md:to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-orange-50/90 to-transparent" />

        <div className="relative mx-auto flex min-h-[600px] max-w-7xl items-center px-6 py-16 md:min-h-[680px] md:py-20">
          <div className="max-w-[900px]">
            <div className="text-base font-semibold tracking-[0.14em] text-orange-600 md:text-lg">ITS BIO</div>

            <h1 className="mt-5 max-w-[900px] text-[40px] font-semibold leading-[1.08] tracking-[-0.045em] text-[#071d43] sm:text-[48px] md:text-[52px] lg:text-[56px]">
              <span className="block">Innovative Solutions for</span>
              <span className="mt-1 block">Life Science Research and Animal Care</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 md:text-lg md:leading-8">
              Trusted products and services to accelerate your discovery and improve animal lives.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/products"
                className="inline-flex h-14 items-center justify-center gap-5 rounded-full bg-orange-600 px-8 text-base font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-orange-700"
              >
                Explore Products <span aria-hidden>→</span>
              </Link>
              <Link
                href="/about"
                className="inline-flex h-14 items-center justify-center gap-5 rounded-full border border-orange-400 bg-white/75 px-8 text-base font-semibold text-orange-700 backdrop-blur transition hover:-translate-y-0.5 hover:bg-orange-50"
              >
                Learn More <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
