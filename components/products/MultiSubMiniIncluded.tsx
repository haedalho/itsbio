import Image from "next/image";

const ITEMS = [
  {
    title: "multiSUB Mini - 7 × 7cm Gel tray",
    quantity: "1",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7-UV7-1.WEB_-150x150.jpg",
  },
  {
    title: "multiSUB Mini Lid",
    quantity: "1",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7LID-1.WEB_-150x150.jpg",
  },
  {
    title: "multiSUB Mini Tank (Including Electrodes)",
    quantity: "1",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7TANK-1.WEB_-150x150.jpg",
  },
  {
    title: "multiSUB Mini Combs",
    quantity: "2",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7-10-1-1.WEB_-150x150.jpg",
  },
  {
    title: "multiSUB Mini - Viewing Platform",
    quantity: "1",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS10-WP-1.WEB_-150x150.jpg",
  },
  {
    title: "multiSUB Mini - Loading Guides",
    quantity: "1",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS10-LG-1.WEB_-150x150.jpg",
  },
  {
    title: "multiSUB Mini - Gel tray Dams",
    quantity: "1",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7-UVDAM-1.WEB_-150x150.jpg",
  },
  {
    title: "Electrophoresis cable (Black & Red)",
    quantity: "1",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/CSL-CAB-1.WEB_-150x150.jpg",
  },
] as const;

export default function MultiSubMiniIncluded() {
  return (
    <details open className="group border-t border-[#d9d9d9]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-[18px] text-left marker:content-none md:py-5 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[22px] w-[22px] shrink-0 text-[#5a2df5]" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="1" />
            <path d="M3 9h18M8 4v16M13 4v16M18 4v16" />
          </svg>
          <span className="text-[17px] font-semibold leading-6 tracking-[-0.01em] text-[#111] md:text-[18px]">WHAT&apos;S INCLUDED</span>
        </span>
        <span aria-hidden className="relative h-6 w-6 shrink-0 text-[#111]">
          <span className="absolute inset-0 hidden items-center justify-center text-[22px] leading-none group-open:flex">×</span>
          <span className="absolute inset-0 flex items-center justify-center text-[22px] leading-none group-open:hidden">+</span>
        </span>
      </summary>

      <div className="pb-10 pt-5 md:pb-12 md:pt-7">
        <div className="grid max-w-[1040px] grid-cols-2 gap-x-7 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-9 lg:gap-y-12">
          {ITEMS.map((item) => (
            <article key={item.title} className="min-w-0">
              <div className="relative aspect-[1.08/1] w-full max-w-[190px] bg-white">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 42vw, (max-width: 1024px) 28vw, 190px"
                  className="object-contain object-center"
                />
              </div>
              <h3 className="mt-4 max-w-[210px] text-[15px] font-semibold leading-[1.35] text-[#5b24f2] md:text-[16px]">
                {item.title}
              </h3>
              <p className="mt-3 text-[14px] leading-5 text-[#5b24f2]">Qty: {item.quantity}</p>
            </article>
          ))}
        </div>
      </div>
    </details>
  );
}
