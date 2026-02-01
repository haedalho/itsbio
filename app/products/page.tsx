// app/promotions/page.tsx
import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "@/components/site/Breadcrumb";

import imageUrlBuilder from "@sanity/image-url";
import { sanityClient } from "../../lib/sanity.client";

type PromotionDoc = {
  _id: string;
  title: string;
  summary?: string;
  publishedAt?: string;
  isActive?: boolean;
  order?: number;
  ctaUrl?: string;
  ctaLabel?: string;
  image?: any;

  // (나중에 필드 추가할 때 대비용 - 없어도 됨)
  startDate?: string;
  endDate?: string;
  tag?: string;
  slug?: string;
};

const builder = imageUrlBuilder(sanityClient as any);
function urlFor(source: any) {
  return builder.image(source);
}

function formatYMD(dateIso?: string) {
  if (!dateIso) return "";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function rangeLabel(p: PromotionDoc) {
  // startDate/endDate가 있으면 그걸 우선 사용
  if (p.startDate || p.endDate) {
    const a = formatYMD(p.startDate);
    const b = formatYMD(p.endDate);
    if (a && b) return `${a} ~ ${b}`;
    if (a && !b) return `${a} ~`;
    if (!a && b) return `~ ${b}`;
  }

  // 없으면 publishedAt 표시
  const pub = formatYMD(p.publishedAt);
  return pub || "Ongoing";
}

function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
      {children}
    </span>
  );
}

export default async function PromotionsPage() {
  const PROMOTIONS_QUERY = `
    *[_type=="promotion" && isActive==true]
      | order(order asc, publishedAt desc, _createdAt desc) {
        _id,
        title,
        summary,
        publishedAt,
        isActive,
        order,
        ctaUrl,
        ctaLabel,
        image,

        // 아래는 나중에 스키마에 추가할 경우 자동으로 읽힘(없으면 null)
        startDate,
        endDate,
        tag,
        "slug": slug.current
      }
  `;

  const promotions = await sanityClient.fetch<PromotionDoc[]>(PROMOTIONS_QUERY);

  return (
    <div>
      {/* ✅ Banner (About과 동일 사이즈 규격: 220/280) */}
      <section className="relative">
        <div className="relative h-[220px] w-full overflow-hidden md:h-[280px]">
          <Image src="/contact-hero.png" alt="Promotions" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-transparent to-transparent" />

          <div className="absolute inset-0">
            <div className="mx-auto flex h-full max-w-6xl items-center px-6">
              <div>
                <div className="text-xs font-semibold tracking-wide text-white/80">ITS BIO</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Promotions</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80 md:text-base">
                  Latest offers, events, and announcements from ITS BIO.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ✅ Breadcrumb */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="mt-6 flex justify-end">
          <Breadcrumb />
        </div>
      </div>

      {/* ✅ Content */}
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Current Promotions</h2>
            <p className="mt-2 text-sm text-slate-600">Check ongoing discounts, seasonal events, and service updates.</p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
            >
              Browse products
            </Link>
            <Link
              href="/quote"
              className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700"
            >
              Request a quote
            </Link>
          </div>
        </div>

        {/* ✅ Grid */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {promotions.map((p) => {
            const tagLabel = p.tag || "Promotion";
            const dateLabel = rangeLabel(p);

            // 링크 정책:
            // - ctaUrl 있으면 그걸로
            // - 없으면 현재는 리스트 페이지(/promotions)로 (상세 페이지는 추후 /promotions/[slug] 만들면 교체)
            const href = p.ctaUrl || "/promotions";
            const isExternal = !!p.ctaUrl && /^https?:\/\//i.test(p.ctaUrl);

            const imgUrl =
              p.image ? urlFor(p.image).width(1200).height(750).fit("crop").auto("format").url() : "";

            return (
              <Link
                key={p._id}
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noreferrer" : undefined}
                className={[
                  "group block rounded-3xl",
                  "transition-shadow duration-300",
                  "shadow-[0_8px_24px_rgba(15,23,42,0.08)]",
                  "hover:shadow-[0_14px_40px_rgba(15,23,42,0.12)]",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2",
                ].join(" ")}
              >
                {/* ✅ 안쪽 래퍼: border + overflow + radius를 여기서만 처리 (틈 방지 핵심) */}
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                  {/* 이미지 영역 */}
                  <div className="relative aspect-[16/10] bg-slate-100">
                    {imgUrl ? (
                      // ✅ Sanity 이미지: next/image 도메인 설정 없이 쓰려고 <img> 사용
                      <img
                        src={imgUrl}
                        alt={p.title}
                        className="h-full w-full object-cover [transform:translateZ(0)] transition-transform duration-700 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-100" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                    <div className="absolute left-4 top-4 flex items-center gap-2">
                      <TagPill>{tagLabel}</TagPill>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="text-lg font-semibold text-white">{p.title}</div>
                      {p.summary ? (
                        <div className="mt-1 line-clamp-2 text-sm text-white/85">{p.summary}</div>
                      ) : null}
                    </div>
                  </div>

                  {/* 하단 바 */}
                  <div className="flex items-center justify-between gap-3 px-5 py-4">
                    <div className="text-xs font-medium text-slate-500">{dateLabel}</div>
                    <div className="text-sm font-semibold text-orange-700">
                      {p.ctaLabel ? p.ctaLabel : "View →"}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer note + ITS BIO Contact (KR/EN 고정) */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
          <div className="font-medium">
            Need help finding the right product or offer?{" "}
            <Link href="/contact" className="font-semibold text-orange-700 hover:underline">
              Contact us
            </Link>
            .
          </div>

          <div className="mt-4 space-y-2 text-xs leading-5 text-slate-700">
            <div className="font-semibold text-slate-900">ITS BIO Contact</div>
            <div>
              <span className="font-semibold">KR</span> · 서울특별시 강서구 양천로 551-17 (가양동 449-4) 한화비즈메트로 A동 812호
            </div>
            <div>
              <span className="font-semibold">EN</span> · Room 812, Building A, Hanwha BizMetro, 551-17 Yangcheon-ro,
              Gangseo-gu, Seoul, Republic of Korea
            </div>
            <div>
              <span className="font-semibold">Tel</span> 02-3462-8658 · <span className="font-semibold">Fax</span>{" "}
              02-3462-8659 · <span className="font-semibold">Email</span> info@itsbio.co.kr
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
