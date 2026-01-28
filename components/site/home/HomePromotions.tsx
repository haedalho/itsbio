import Image from "next/image";
import Link from "next/link";

type PromoItem = {
  title: string;
  href: string;
  image: string;
  label?: string;
};

type ActivityItem = {
  title: string;
  href: string;
};

const RECENT: ActivityItem[] = [
  { title: "GMP 시설 온라인 투어", href: "/promotions" },
  {
    title:
      "리뷰 작성 이벤트: 작성 시 사은품 증정(예시)",
    href: "/promotions",
  },
  { title: "Bridging ELISA 키트 맞춤 개발 서비스 요청", href: "/promotions" },
  { title: "QC/규제 지원 안내", href: "/promotions" },
  { title: "설문 참여 이벤트(예시)", href: "/promotions" },
  { title: "FC 수용체 설문 참여 이벤트(예시)", href: "/promotions" },
];

const POPULAR: PromoItem[] = [
  {
    title: "GMP 시설 온라인 투어",
    href: "/promotions",
    image: "/home/promo-gmp.jpg", // ✅ 이미지 넣어두면 됨
    label: "Popular",
  },
  {
    title: "Citation Rewards",
    href: "/promotions",
    image: "/home/promo-citation.jpg",
    label: "Event",
  },
];

export default function HomePromotions() {
  return (
    <section className="relative overflow-hidden bg-slate-50">
      {/* diagonal accent background */}
      <div className="pointer-events-none absolute inset-0">
        {/* base */}
        <div className="absolute inset-0 bg-slate-50" />

        {/* diagonal wedge (오른쪽 붉은 영역) */}
        <div
          className={[
            "absolute -right-32 top-0 h-[120%] w-[55%]",
            "bg-orange-600", // 여기 색만 바꾸면 레드 느낌도 가능: bg-red-600
            "rotate-[18deg] origin-top",
          ].join(" ")}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-14 md:py-16">
        {/* title */}
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            프로모션
          </h2>
          <div className="mx-auto mt-3 h-[3px] w-14 rounded-full bg-orange-600" />
        </div>

        {/* content grid */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* LEFT: Recent activities */}
          <div>
            <div className="text-lg font-semibold text-slate-900">최근 활동</div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <ul className="space-y-4">
                {RECENT.map((a) => (
                  <li key={a.title}>
                    <Link
                      href={a.href}
                      className="text-sm leading-6 text-slate-700 hover:underline"
                    >
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>

              <Link
                href="/promotions"
                className="mt-6 inline-flex items-center text-sm font-semibold text-slate-800 hover:underline"
              >
                더 많은 활동 보기 <span className="ml-1">→</span>
              </Link>
            </div>
          </div>

          {/* RIGHT: Popular activities */}
          <div>
            <div className="text-lg font-semibold text-slate-900">인기 활동</div>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {POPULAR.map((p) => (
                <Link
                  key={p.title}
                  href={p.href}
                  className={[
                    "group",
                    "rounded-2xl bg-white",
                    "border border-white/30",
                    "shadow-[0_10px_30px_rgba(15,23,42,0.15)]",
                    "transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(15,23,42,0.22)]",
                    "overflow-hidden",
                  ].join(" ")}
                >
                  <div className="relative aspect-[4/5] w-full bg-slate-100">
                    <Image
                      src={p.image}
                      alt={p.title}
                      fill
                      className="object-cover"
                    />

                    {/* small badge */}
                    {p.label ? (
                      <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm">
                        {p.label}
                      </div>
                    ) : null}
                  </div>

                  {/* bottom red label bar */}
                  <div className="bg-orange-700 px-4 py-3">
                    <div className="line-clamp-1 text-sm font-semibold text-white">
                      {p.title}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-5">
              <Link
                href="/promotions"
                className="inline-flex items-center text-sm font-semibold text-white/95 lg:text-white hover:underline"
              >
                전체 프로모션 보기 <span className="ml-1">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}