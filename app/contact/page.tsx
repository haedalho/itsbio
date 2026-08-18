import Breadcrumb from "@/components/site/Breadcrumb";
import PageHero from "@/components/site/PageHero";
import KakaoOfficeMap from "@/components/site/KakaoOfficeMap";

const OFFICE = {
  addressKr: "서울특별시 강서구 양천로 551-17 (가양동 449-4) 한화비즈메트로 A동 812호",
  tel: "02-3462-8658",
  fax: "02-3462-8659",
  email: "info@itsbio.co.kr",
  hours: {
    weekdays: "09:00–18:00",
    lunch: "12:00–13:00",
    note: "Closed on weekends & holidays",
  },
};

const OFFICE_LAT = 37.559009;
const OFFICE_LNG = 126.861094;
const kakaoMapUrl = `https://map.kakao.com/link/map/ITS BIO,${OFFICE_LAT},${OFFICE_LNG}`;
const kakaoDirectionsUrl = `https://map.kakao.com/link/to/ITS BIO,${OFFICE_LAT},${OFFICE_LNG}`;

function DotItem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,.04)]">
      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-orange-500" />
      <div>
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="mt-1 text-sm leading-6 text-neutral-700">{children}</div>
      </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <div>
      <PageHero
        eyebrow="CONTACT"
        title="Talk to the ITS BIO team"
        description="For product guidance, quotations, sourcing support, lead time, or general inquiries, our team is ready to help."
        variant="contact"
        cta={{ label: "Email us", href: `mailto:${OFFICE.email}` }}
      />

      <div className="mx-auto max-w-6xl px-6">
        <div className="mt-6 flex justify-end"><Breadcrumb /></div>

        <section id="contact-details" className="mt-8">
          <div className="grid overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,.08)] lg:grid-cols-[1fr_320px]">
            <div className="relative h-[330px] w-full md:h-[410px]">
              <KakaoOfficeMap latitude={OFFICE_LAT} longitude={OFFICE_LNG} address={OFFICE.addressKr} mapUrl={kakaoMapUrl} />
              <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-2xl border border-white/60 bg-white/95 px-4 py-3 shadow-lg backdrop-blur md:left-5 md:top-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">ITS BIO</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">Seoul Office</div>
              </div>
            </div>

            <div className="flex flex-col justify-between bg-[#071d43] p-6 text-white md:p-8">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#fee500]">Kakao Map</div>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Visit ITS BIO</h2>
                <p className="mt-4 text-sm leading-7 text-white/65">카카오맵에서 이츠바이오 서울 사무실 위치를 확인하고 바로 길찾기를 시작할 수 있습니다.</p>
              </div>

              <div className="mt-8 space-y-3">
                <a className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#fee500] px-5 text-sm font-bold text-[#191919] transition hover:brightness-95" href={kakaoDirectionsUrl} target="_blank" rel="noreferrer">
                  Kakao Map 길찾기 <span className="ml-3" aria-hidden>→</span>
                </a>
                <a className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10" href={`mailto:${OFFICE.email}`}>
                  Email ITS BIO
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Office information</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">Seoul Office</h2>
              <p className="mt-2 text-neutral-700">We support sourcing, quotations, product identification, and delivery coordination.</p>
            </div>
            <a className="inline-flex h-11 items-center justify-center rounded-full border border-neutral-300 px-5 text-sm font-semibold text-neutral-900 transition hover:border-orange-300 hover:text-orange-700" href={kakaoMapUrl} target="_blank" rel="noreferrer">View in Kakao Map</a>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <DotItem title="Address">{OFFICE.addressKr}</DotItem>
            <DotItem title="Business hours">Weekdays: {OFFICE.hours.weekdays}<div className="mt-1 text-sm text-neutral-600">Lunch: {OFFICE.hours.lunch} / {OFFICE.hours.note}</div></DotItem>
            <DotItem title="Phone"><a className="hover:text-orange-700" href={`tel:${OFFICE.tel.replace(/-/g, "")}`}>{OFFICE.tel}</a></DotItem>
            <DotItem title="Fax">{OFFICE.fax}</DotItem>
            <DotItem title="E-mail"><a className="hover:text-orange-700" href={`mailto:${OFFICE.email}`}>{OFFICE.email}</a></DotItem>
            <DotItem title="Quotation / Lead time">Please include the product name and catalog number when available.</DotItem>
          </div>
        </section>

        <section className="mb-16 mt-12 rounded-[28px] bg-slate-50 px-6 py-8 md:px-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Product inquiry</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#071d43]">Need a quotation or product match?</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Catalog number, screenshot, label photo, or partial specification is enough to start an inquiry.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/quote" className="inline-flex h-11 items-center rounded-full bg-orange-600 px-6 text-sm font-semibold text-white transition hover:bg-orange-700">Request a Quote</a>
              <a href={`mailto:${OFFICE.email}`} className="inline-flex h-11 items-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-800 transition hover:border-slate-400">{OFFICE.email}</a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
