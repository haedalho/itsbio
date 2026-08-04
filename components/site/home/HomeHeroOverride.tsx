"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/images/home/itsbio-hero.svg')" }}
          />
          <div className="absolute inset-0 bg-white/20 md:bg-transparent" />
        </div>

        <div className="absolute inset-0 bg-gradient-to-r from-[#fbfaf8] via-[#fbfaf8]/96 to-[#fbfaf8]/20 md:via-[#fbfaf8]/90 md:to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-orange-50/90 to-transparent" />

        <div className="relative mx-auto flex min-h-[600px] max-w-7xl items-center px-6 py-16 md:min-h-[680px] md:py-20">
          <div className="max-w-[920px]">
            <div className="text-base font-semibold tracking-[0.14em] text-orange-600 md:text-lg">ITS BIO</div>

            <h1 className="mt-5 max-w-[920px] text-[40px] font-semibold leading-[1.08] tracking-[-0.045em] text-[#071d43] sm:text-[46px] md:text-[50px] lg:text-[54px]">
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
