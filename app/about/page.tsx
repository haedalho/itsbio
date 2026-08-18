import Breadcrumb from "@/components/site/Breadcrumb";
import PageHero from "@/components/site/PageHero";

export default function AboutPage() {
  return (
    <main className="bg-white">
      <PageHero
        eyebrow="ABOUT ITS BIO"
        title="A trusted partner for better science"
        description="ITS BIO supports researchers with reliable scientific products, responsive service, and practical sourcing expertise built around the needs of the research field."
        variant="about"
        cta={{ label: "Contact our team", href: "/contact" }}
      />

      <div className="mx-auto mt-6 flex max-w-6xl justify-end px-4">
        <Breadcrumb />
      </div>

      <section id="ceo-message" className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pb-20 md:pt-14">
        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#fffaf5_52%,#f8fafc_100%)] shadow-[0_18px_50px_rgba(15,23,42,.06)]">
          <div className="grid gap-0 lg:grid-cols-[300px_1fr]">
            <div className="border-b border-slate-200 bg-[#071d43] p-7 text-white lg:border-b-0 lg:border-r lg:p-9">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-300">CEO Message</div>
              <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.03em] md:text-3xl">대표 인사말</h2>
              <div className="mt-6 h-px w-12 bg-orange-400" />
              <p className="mt-6 text-sm leading-7 text-white/65">대한민국 생명과학 연구의 발전과 함께하는 신뢰받는 파트너가 되겠습니다.</p>
            </div>

            <div className="p-7 md:p-10 lg:p-12">
              <div className="max-w-3xl space-y-6 text-[15px] leading-8 text-slate-700 md:text-base md:leading-9">
                <p className="text-lg font-semibold leading-8 text-[#071d43] md:text-xl md:leading-9">
                  (주)이츠바이오는 대한민국 생명과학 연구의 발전에 기여하는 든든한 파트너가 되고자 합니다.
                </p>
                <p>
                  빠르게 변화하는 생명과학 연구 환경 속에서 연구자 여러분이 더 나은 결과에 집중할 수 있도록,
                  검증된 글로벌 제품과 새로운 기술을 신속하고 정확하게 공급하며 책임 있는 지원을 제공하겠습니다.
                </p>
                <p>
                  단순히 제품을 공급하는 데 그치지 않고 연구 현장의 필요를 이해하고 함께 해결하는 파트너가 되겠습니다.
                  신뢰할 수 있는 제품, 빠른 대응, 세심한 서비스로 대한민국 생명과학 발전에 실질적인 도움이 되는 회사가 되도록 끊임없이 노력하겠습니다.
                </p>
                <p>앞으로도 많은 관심과 지도 부탁드립니다.</p>
              </div>

              <div className="mt-9 flex items-center gap-4 border-t border-slate-200 pt-6">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                <div className="text-sm font-semibold text-slate-900">– (주)이츠바이오 임직원 일동 –</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
