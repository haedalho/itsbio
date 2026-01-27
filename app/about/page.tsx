import Image from "next/image";

const HIGHLIGHTS = [
  { title: "Fast, clear quotations", desc: "견적·납기 정보를 빠르게 정리해 드립니다." },
  { title: "Reliable sourcing", desc: "정확한 품목 확인 후 대체 옵션까지 제안합니다." },
  { title: "Delivery coordination", desc: "발주부터 배송까지 커뮤니케이션 부담을 줄입니다." },
];

const WHAT_WE_DO = [
  {
    title: "Product sourcing",
    desc: "카탈로그 번호/스펙 기반으로 정확 매칭을 우선 확인하고, 필요 시 대체품 옵션을 함께 제공합니다.",
  },
  {
    title: "Quotation & lead time",
    desc: "재고/납기 확인 후 견적을 신속히 공유하며, 의사결정에 필요한 핵심 정보를 정리합니다.",
  },
  {
    title: "Documents",
    desc: "Catalog, Datasheet, SDS 등 제조사 제공 문서 요청을 지원합니다.",
  },
  {
    title: "Project support",
    desc: "복수 품목/일정이 있는 프로젝트 단위 요청도 우선순위·납기 기준으로 함께 정리합니다.",
  },
];

const WHY_US = [
  {
    title: "Friendly supply partner",
    desc: "단순 문의도 괜찮아요. 필요한 정보만 주시면 나머지는 우리가 정리합니다.",
  },
  {
    title: "Decision clarity",
    desc: "가능/불가능, 리드타임, 옵션(대체·패키지)을 한 번에 비교할 수 있게 제공합니다.",
  },
  {
    title: "Reduced back-and-forth",
    desc: "반복 확인을 줄이기 위해 진행 상황과 변경 사항을 투명하게 공유합니다.",
  },
];

const HOW_WE_WORK = [
  { n: "01", title: "Inquiry", desc: "품목/스펙/수량/희망 납기일 전달" },
  { n: "02", title: "Confirm", desc: "가용성/리드타임 확인 + 대체 옵션(필요 시)" },
  { n: "03", title: "Order", desc: "발주 및 일정/배송 커뮤니케이션" },
  { n: "04", title: "Delivery", desc: "납품 및 사후 지원(필요 시)" },
];

const FAQ = [
  {
    q: "카탈로그 번호가 없고 스크린샷만 있어도 되나요?",
    a: "네. 라벨/스크린샷/스펙 일부만 있어도 확인 가능한 범위에서 식별하거나 가장 가까운 옵션을 제안드립니다.",
  },
  {
    q: "SDS, datasheet 같은 문서도 받을 수 있나요?",
    a: "제조사 제공 범위 내에서 요청을 지원합니다. 필요 문서 종류를 알려주시면 수급을 도와드립니다.",
  },
  {
    q: "여러 품목을 한 번에 요청해도 되나요?",
    a: "가능합니다. 우선순위(실험 일정/납기 기준)로 정리해서 리드타임과 옵션을 함께 제안드립니다.",
  },
];

export default function AboutPage() {
  return (
    <main className="bg-white">
      {/* HERO BANNER (simple + low height, like ABL) */}
      <section className="relative">
        <div className="relative h-[220px] w-full md:h-[280px] overflow-hidden">
          {/* you already have about-hero.png */}
          <Image src="/about-hero.png" alt="About ITS BIO" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-transparent to-transparent" />

          <div className="absolute inset-0">
            <div className="mx-auto flex h-full max-w-6xl items-center px-6">
              <div>
                <div className="text-xs font-semibold tracking-wide text-white/80">ITS BIO</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  About us
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80 md:text-base">
                  We are a friendly supply partner for life science and biopharma teams—supporting fast
                  sourcing, clear lead time, and reliable coordination.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENT */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pt-12">
        {/* Intro line (no big boxed card) */}
        <div className="max-w-3xl">
          <p className="text-sm leading-7 text-slate-600 md:text-base">
            ITS BIO는 “필요한 제품을 정확하게, 필요한 시점에” 공급하는 것을 목표로 합니다.
            견적/납기/대체 옵션을 한 번에 정리해 드리고, 발주부터 배송까지 커뮤니케이션 비용을 줄입니다.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/quote"
              className="inline-flex h-11 items-center justify-center rounded-full bg-orange-600 px-6 text-sm font-semibold text-white hover:bg-orange-700 transition"
            >
              Request a Quote
            </a>
            <a
              href="/contact"
              className="inline-flex h-11 items-center justify-center rounded-full border bg-white px-6 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition"
            >
              Contact
            </a>
          </div>
        </div>

        {/* Highlights (light, airy) */}
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {HIGHLIGHTS.map((x) => (
            <div key={x.title} className="border-t pt-5">
              <div className="text-base font-semibold text-slate-900">{x.title}</div>
              <div className="mt-2 text-sm leading-7 text-slate-600">{x.desc}</div>
            </div>
          ))}
        </div>

        <div className="my-12 h-px w-full bg-slate-200/70" />

        {/* What we do */}
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">What we do</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
              필요한 정보를 빠르게 정리하고, 선택 가능한 옵션을 명확하게 제시합니다.
            </p>
          </div>

          <div className="md:col-span-8 grid gap-6 md:grid-cols-2">
            {WHAT_WE_DO.map((x) => (
              <div key={x.title} className="border-t pt-5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-600" />
                  <div className="text-sm font-semibold text-slate-900">{x.title}</div>
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-600">{x.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="my-12 h-px w-full bg-slate-200/70" />

        {/* Why us */}
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">Why ITS BIO</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
              “친절한 공급 파트너”라는 기준으로, 정보/속도/조율을 책임집니다.
            </p>
          </div>

          <div className="md:col-span-8 space-y-7">
            {WHY_US.map((x) => (
              <div key={x.title} className="flex gap-3">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">{x.title}</div>
                  <div className="mt-1 text-sm leading-7 text-slate-600">{x.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="my-12 h-px w-full bg-slate-200/70" />

        {/* How we work */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">How we work</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
            단순한 단계로 진행하지만, 결정에 필요한 정보(가용성/리드타임/대체 옵션)는 빠짐없이 제공합니다.
          </p>

          <ol className="mt-7 grid gap-6 md:grid-cols-4">
            {HOW_WE_WORK.map((s) => (
              <li key={s.n} className="border-t pt-5">
                <div className="text-xs font-semibold text-orange-700">{s.n}</div>
                <div className="mt-1 text-base font-semibold text-slate-900">{s.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">{s.desc}</div>
              </li>
            ))}
          </ol>
        </div>

        <div className="my-12 h-px w-full bg-slate-200/70" />

        {/* FAQ */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">FAQ</h2>
          <div className="mt-6 space-y-6">
            {FAQ.map((x) => (
              <div key={x.q} className="border-t pt-5">
                <div className="text-sm font-semibold text-slate-900">{x.q}</div>
                <div className="mt-2 text-sm leading-7 text-slate-600">{x.a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Soft CTA (footer has NeedAssistance already) */}
        <div className="mt-12 border-t pt-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-lg font-semibold text-slate-900">Ready to request?</div>
              <div className="mt-2 text-sm leading-7 text-slate-600">
                Catalog number 또는 간단한 스펙만 보내주세요. 리드타임과 옵션을 빠르게 정리해 드립니다.
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href="/quote"
                className="inline-flex h-11 items-center justify-center rounded-full bg-orange-600 px-6 text-sm font-semibold text-white hover:bg-orange-700 transition"
              >
                Request a Quote
              </a>
              <a
                href="/products"
                className="inline-flex h-11 items-center justify-center rounded-full border bg-white px-6 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition"
              >
                Browse Products
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}