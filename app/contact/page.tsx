import Breadcrumb from "@/components/site/Breadcrumb";
import PageHero from "@/components/site/PageHero";

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

const OFFICE_LAT = 37.5636;
const OFFICE_LNG = 126.8537;
const googleMapsEmbedWithMarker = `https://www.google.com/maps?hl=en&z=16&output=embed&q=${OFFICE_LAT},${OFFICE_LNG}&markers=${OFFICE_LAT},${OFFICE_LNG}`;
const kakaoSearchQuery = encodeURIComponent(OFFICE.addressKr);
const kakaoMapUrl = `https://map.kakao.com/link/search/${kakaoSearchQuery}`;

function DotItem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-orange-500" />
      <div>
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="mt-1 text-neutral-700">{children}</div>
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
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="h-[300px] w-full md:h-[360px]">
              <iframe title="ITS BIO map" className="h-full w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={googleMapsEmbedWithMarker} />
            </div>
          </div>
        </section>

        <section className="mt-10 border-t border-neutral-200 pt-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">Office</h2>
              <p className="mt-2 text-neutral-700">We’re based in Seoul and support fast sourcing and reliable coordination.</p>
            </div>
            <div className="flex gap-3">
              <a className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50" href={kakaoMapUrl} target="_blank" rel="noreferrer">Kakao Map</a>
              <a className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800" href={`mailto:${OFFICE.email}`}>Email Us</a>
            </div>
          </div>

          <div className="mt-8 grid gap-7 lg:grid-cols-2">
            <DotItem title="Address">{OFFICE.addressKr}</DotItem>
            <DotItem title="Business hours">Weekdays: {OFFICE.hours.weekdays}<div className="text-sm text-neutral-600">Lunch: {OFFICE.hours.lunch} / {OFFICE.hours.note}</div></DotItem>
            <DotItem title="Phone"><a className="hover:text-neutral-900" href={`tel:${OFFICE.tel.replace(/-/g, "")}`}>{OFFICE.tel}</a></DotItem>
            <DotItem title="Fax">{OFFICE.fax}</DotItem>
            <DotItem title="E-mail"><a className="hover:text-neutral-900" href={`mailto:${OFFICE.email}`}>{OFFICE.email}</a></DotItem>
          </div>
        </section>

        <section className="mb-16 mt-12 border-t border-neutral-200 pt-10">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">Contacts</h2>
          <p className="mt-3 text-neutral-700">Please use the channel below. We will get back to you as soon as possible.</p>
          <div className="mt-8 grid gap-7 lg:grid-cols-2">
            <DotItem title="General inquiries"><a className="hover:text-neutral-900" href={`mailto:${OFFICE.email}`}>{OFFICE.email}</a><div className="mt-1 text-sm text-neutral-600">T {OFFICE.tel} / F {OFFICE.fax}</div></DotItem>
            <DotItem title="Quotation / Lead time"><a className="hover:text-neutral-900" href={`mailto:${OFFICE.email}`}>{OFFICE.email}</a><div className="mt-1 text-sm text-neutral-600">Please include product name & catalog number.</div></DotItem>
          </div>
        </section>
      </div>
    </div>
  );
}
