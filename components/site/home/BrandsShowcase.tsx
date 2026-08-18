"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type BrandItem = {
  key: string;
  name: string;
  title: string;
  eyebrow: string;
  description: string;
  logo: string;
  href: string;
  tags: string[];
  external?: boolean;
};

const BRANDS: BrandItem[] = [
  {
    key: "abm",
    name: "Applied Biological Materials (abm) Inc.",
    title: "Applied Biological Materials",
    eyebrow: "LIFE SCIENCE",
    description: "Research reagents and custom services for molecular and cellular biology.",
    logo: "/partners/abm-logo-1.png",
    href: "/products/abm",
    tags: ["Research Reagents", "Cellular Biology", "Custom Services"],
  },
  {
    key: "kent",
    name: "Kent Scientific",
    title: "Kent Scientific",
    eyebrow: "ANIMAL RESEARCH",
    description: "Integrated equipment for anesthesia, ventilation, monitoring and animal physiology research.",
    logo: "/partners/KentScientific-logo.png",
    href: "/products/kent",
    tags: ["Anesthesia", "Ventilation", "Monitoring"],
  },
];

export default function BrandsShowcase() {
  const [selectedKey, setSelectedKey] = useState("abm");
  const selectedIndex = Math.max(0, BRANDS.findIndex((brand) => brand.key === selectedKey));
  const selected = BRANDS[selectedIndex];

  function move(step: number) {
    const nextIndex = (selectedIndex + step + BRANDS.length) % BRANDS.length;
    setSelectedKey(BRANDS[nextIndex].key);
  }

  return (
    <section id="brands" className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950 md:text-4xl">
            Brands &amp; Solutions
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">
            글로벌 파트너십을 통해 연구와 산업을 연결하는 솔루션을 제공합니다.
          </p>
        </div>

        <div className="mt-8 overflow-hidden border border-slate-200 bg-white lg:grid lg:h-[600px] lg:grid-cols-[1.02fr_1fr]">
          <div className="grid grid-cols-2 gap-px bg-slate-200 p-px lg:h-full lg:grid-cols-1 lg:grid-rows-2">
            {BRANDS.map((brand) => {
              const active = brand.key === selected.key;
              return (
                <button
                  key={brand.key}
                  type="button"
                  onClick={() => setSelectedKey(brand.key)}
                  aria-pressed={active}
                  aria-label={`${brand.name} 정보 보기`}
                  className={[
                    "group relative flex min-h-[180px] flex-col items-center justify-center bg-white px-4 py-8 text-center transition lg:min-h-0",
                    "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500",
                    active ? "bg-orange-50/45" : "hover:bg-slate-50",
                  ].join(" ")}
                >
                  <span className="relative h-20 w-full max-w-[240px]">
                    <Image src={brand.logo} alt="" fill className="object-contain" sizes="240px" />
                  </span>
                  <span className="mt-4 line-clamp-2 text-xs font-semibold leading-5 text-slate-800 sm:text-[13px]">
                    {brand.name}
                  </span>
                  <span
                    className={[
                      "absolute inset-x-0 bottom-0 h-[3px] origin-left bg-orange-600 transition-transform duration-300",
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                    ].join(" ")}
                  />
                </button>
              );
            })}
          </div>

          <div className="relative flex min-h-[500px] flex-col overflow-hidden bg-[#fffdfb] px-7 py-9 sm:px-12 sm:py-12 lg:h-full lg:min-h-0 lg:px-16">
            <div className="pointer-events-none absolute -right-20 -top-12 h-80 w-80 rounded-full border border-orange-100/70" />
            <div className="pointer-events-none absolute -bottom-28 right-8 h-64 w-64 rounded-full border border-slate-200/70" />
            <div className="pointer-events-none absolute right-24 top-24 h-3 w-3 rounded-full bg-orange-100" />
            <div className="pointer-events-none absolute right-12 top-48 h-5 w-5 rounded-full border border-orange-100" />

            <div className="relative z-10">
              <div className="relative h-20 w-full max-w-[310px]">
                <Image src={selected.logo} alt={`${selected.name} logo`} fill className="object-contain object-left" sizes="310px" priority />
              </div>

              <div className="mt-8 text-xs font-semibold tracking-[0.22em] text-orange-600">
                {selected.eyebrow}
              </div>
              <h3 className="mt-4 max-w-lg text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 md:text-[38px]">
                {selected.title}
              </h3>
              <div className="mt-5 h-px w-8 bg-orange-500" />
              <p className="mt-6 max-w-lg text-base leading-7 text-slate-600">
                {selected.description}
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {selected.tags.map((tag) => (
                  <span key={tag} className="border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>

              <Link
                href={selected.href}
                target={selected.external ? "_blank" : undefined}
                rel={selected.external ? "noreferrer" : undefined}
                className="mt-9 inline-flex h-12 items-center justify-center gap-5 border border-orange-500 bg-white px-6 text-sm font-semibold text-orange-600 transition hover:bg-orange-600 hover:text-white"
              >
                Explore {selected.key === "abm" ? "ABM" : selected.title}
                <span aria-hidden>→</span>
              </Link>
            </div>

            <div className="relative z-10 mt-auto flex items-center justify-end gap-5 pt-10">
              <span className="text-sm tabular-nums text-slate-400">
                <strong className="font-semibold text-orange-600">{String(selectedIndex + 1).padStart(2, "0")}</strong>
                {" / "}{String(BRANDS.length).padStart(2, "0")}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => move(-1)}
                  className="flex h-10 w-10 items-center justify-center border border-slate-200 bg-white text-slate-500 transition hover:border-orange-300 hover:text-orange-600"
                  aria-label="이전 브랜드"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  className="flex h-10 w-10 items-center justify-center border border-slate-200 bg-white text-orange-600 transition hover:border-orange-400 hover:bg-orange-50"
                  aria-label="다음 브랜드"
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
