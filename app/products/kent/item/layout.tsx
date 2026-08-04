import Image from "next/image";
import type { ReactNode } from "react";

const PAGE_SHELL = "mx-auto max-w-[1320px] px-6";

export default function KentItemLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <section className="relative">
        <div className="relative h-[220px] w-full overflow-hidden md:h-[280px]">
          <Image src="/hero.png" alt="Kent Scientific products hero" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-transparent to-transparent" />
          <div className="absolute inset-0">
            <div className={`${PAGE_SHELL} flex h-full items-center`}>
              <div>
                <div className="text-xs font-semibold tracking-wide text-white/80">ITS BIO</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Kent Scientific Product
                </h1>
              </div>
            </div>
          </div>
        </div>
      </section>

      {children}
    </>
  );
}
