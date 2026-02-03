"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type BrandItem = {
  label: string;
  value: string; // "" = All
  goLabel: string;
  introTitle: string;
  introDesc: string;
};

type BrandTheme = {
  // ✅ 선택 시 적용되는 "연한" 컬러 세트
  softBg: string;        // header bg / badge bg
  softBorder: string;    // panel border / active border
  softRing: string;      // focus ring
  dot: string;           // active dot
  text: string;          // accent text
  goBg: string;          // Go 버튼 배경(연하게)
  goText: string;        // Go 버튼 텍스트(브랜드색)
  goHover: string;       // Go 버튼 hover
};

function normalizeBrandKey(labelOrValue: string) {
  return labelOrValue.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}

/**
 * ✅ 눈 편한 버전:
 * - 헤더: 연한 배경 + 진한 텍스트
 * - 버튼: 연한 배경 + 브랜드색 텍스트
 * - Active 카드: 연한 border/ring
 */
const BRAND_THEMES: Record<string, BrandTheme> = {
  all: {
    softBg: "bg-slate-50",
    softBorder: "border-slate-200",
    softRing: "ring-slate-200",
    dot: "bg-slate-600",
    text: "text-slate-800",
    goBg: "bg-slate-900",
    goText: "text-white",
    goHover: "hover:bg-slate-950",
  },

  abm: {
    softBg: "bg-orange-50",
    softBorder: "border-orange-200",
    softRing: "ring-orange-200",
    dot: "bg-orange-500",
    text: "text-orange-800",
    goBg: "bg-orange-50",
    goText: "text-orange-800",
    goHover: "hover:bg-orange-100",
  },

  kentscientifics: {
    softBg: "bg-blue-50",
    softBorder: "border-blue-200",
    softRing: "ring-blue-200",
    dot: "bg-blue-500",
    text: "text-blue-800",
    goBg: "bg-blue-50",
    goText: "text-blue-800",
    goHover: "hover:bg-blue-100",
  },

  itschem: {
    softBg: "bg-rose-50",
    softBorder: "border-rose-200",
    softRing: "ring-rose-200",
    dot: "bg-rose-500",
    text: "text-rose-800",
    goBg: "bg-rose-50",
    goText: "text-rose-800",
    goHover: "hover:bg-rose-100",
  },

  aims: {
    softBg: "bg-sky-50",
    softBorder: "border-sky-200",
    softRing: "ring-sky-200",
    dot: "bg-sky-500",
    text: "text-sky-800",
    goBg: "bg-sky-50",
    goText: "text-sky-800",
    goHover: "hover:bg-sky-100",
  },

  seedburo: {
    softBg: "bg-green-50",
    softBorder: "border-green-200",
    softRing: "ring-green-200",
    dot: "bg-green-500",
    text: "text-green-800",
    goBg: "bg-green-50",
    goText: "text-green-800",
    goHover: "hover:bg-green-100",
  },

  bioplastics: {
    softBg: "bg-amber-50",
    softBorder: "border-amber-200",
    softRing: "ring-amber-200",
    dot: "bg-amber-500",
    text: "text-amber-800",
    goBg: "bg-amber-50",
    goText: "text-amber-800",
    goHover: "hover:bg-amber-100",
  },

  cleaverscientific: {
    softBg: "bg-purple-50",
    softBorder: "border-purple-200",
    softRing: "ring-purple-200",
    dot: "bg-purple-500",
    text: "text-purple-800",
    goBg: "bg-purple-50",
    goText: "text-purple-800",
    goHover: "hover:bg-purple-100",
  },

  cellfreesciences: {
    softBg: "bg-indigo-50",
    softBorder: "border-indigo-200",
    softRing: "ring-indigo-200",
    dot: "bg-indigo-600",
    text: "text-indigo-900",
    goBg: "bg-indigo-50",
    goText: "text-indigo-900",
    goHover: "hover:bg-indigo-100",
  },

  plaslabs: {
    softBg: "bg-slate-100",
    softBorder: "border-slate-300",
    softRing: "ring-slate-200",
    dot: "bg-slate-800",
    text: "text-slate-900",
    goBg: "bg-slate-100",
    goText: "text-slate-900",
    goHover: "hover:bg-slate-200",
  },

  affinityimmuno: {
    softBg: "bg-cyan-50",
    softBorder: "border-cyan-200",
    softRing: "ring-cyan-200",
    dot: "bg-cyan-500",
    text: "text-cyan-900",
    goBg: "bg-cyan-50",
    goText: "text-cyan-900",
    goHover: "hover:bg-cyan-100",
  },

  dogen: {
    softBg: "bg-red-50",
    softBorder: "border-red-200",
    softRing: "ring-red-200",
    dot: "bg-red-600",
    text: "text-red-900",
    goBg: "bg-red-50",
    goText: "text-red-900",
    goHover: "hover:bg-red-100",
  },
};

function getBrandTheme(value: string) {
  const key = value ? normalizeBrandKey(value) : "all";
  return BRAND_THEMES[key] ?? BRAND_THEMES.all;
}

function makeQS(params: Record<string, string>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "") sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default function BrandGridSelector({
  brands,
  qRaw,
  category,
}: {
  brands: BrandItem[];
  currentBrand: string; // (사용 안 함 유지: 나중에 동기화 원하면 씀)
  qRaw: string;
  category: string;
}) {
  const router = useRouter();

  // ✅ 처음에는 All 선택
  const [selected, setSelected] = useState<string>("");

  const selectedBrand = useMemo(
    () => brands.find((b) => b.value === selected) ?? brands[0],
    [brands, selected]
  );
  const theme = useMemo(() => getBrandTheme(selected), [selected]);

  const goHref = `/products${makeQS({
    q: qRaw,
    brand: selected,
    category,
    page: "1",
  })}#results`;

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      {/* ✅ 브랜드 그리드 (적당히 간격) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {brands.map((b) => {
          const active = b.value === selected;
          const bt = getBrandTheme(b.value);

          return (
            <button
              key={b.label}
              type="button"
              onClick={() => setSelected(b.value)}
              className={[
                "relative rounded-2xl border bg-white px-4 py-4 text-left shadow-sm transition",
                "hover:shadow-md",
                active ? [bt.softBorder, "ring-2 ring-offset-2", bt.softRing].join(" ") : "border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              {/* ✅ 과한 상단 바 제거하고, 선택 시만 연한 틴트 느낌 */}
              {active ? (
                <span className={["absolute inset-0 rounded-2xl", bt.softBg, "opacity-60"].join(" ")} aria-hidden="true" />
              ) : null}

              <div className="relative flex items-center gap-2">
                <span className={["h-2 w-2 rounded-full", active ? bt.dot : "bg-slate-300"].join(" ")} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{b.label}</div>
                  <div className={["mt-1 text-xs font-semibold", active ? bt.text : "text-slate-500"].join(" ")}>
                    Select
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ✅ 브랜드 소개 패널: 연한 배경 + 텍스트로만 강조 */}
      <div className={["mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm", theme.softBorder].join(" ")}>
        <div className={["px-5 py-3", theme.softBg].join(" ")}>
          <div className={["text-sm font-semibold", theme.text].join(" ")}>{selectedBrand.introTitle}</div>
        </div>

        <div className="px-5 py-4">
          <div className="text-sm text-slate-700">{selectedBrand.introDesc}</div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* ✅ Go 버튼도 '연한 배경' + '브랜드 텍스트' */}
            <button
              type="button"
              onClick={() => router.push(goHref)}
              className={[
                "inline-flex items-center justify-center rounded-lg border px-5 py-2 text-sm font-semibold transition",
                theme.softBorder,
                theme.goBg,
                theme.goText,
                theme.goHover,
              ].join(" ")}
            >
              {selectedBrand.goLabel}
            </button>

            {/* reset */}
            <button
              type="button"
              onClick={() => {
                setSelected("");
                router.push(`/products${makeQS({ q: qRaw, brand: "", category: "", page: "1" })}`);
              }}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 hover:underline"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
