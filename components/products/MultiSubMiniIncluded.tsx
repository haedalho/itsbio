import Image from "next/image";
import Link from "next/link";

import { cleaverProductSlug } from "@/lib/cleaver/catalog";

const productHref = (title: string, sku: string) =>
  `/products/cleaver/item/${encodeURIComponent(cleaverProductSlug(title, sku))}`;

const ITEMS = [
  {
    title: "multiSUB Mini - 7 × 7cm Gel tray",
    quantity: "1",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7-UV7-1.WEB_-150x150.jpg",
    href: productHref("multiSUB Mini - 7 x 7cm Gel tray", "MS7-UV7"),
  },
  {
    title: "multiSUB Mini Lid",
    quantity: "1",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7LID-1.WEB_-150x150.jpg",
    href: productHref("multiSUB Mini Lid", "MS7LID"),
  },
  {
    title: "multiSUB Mini Tank (Including Electrodes)",
    quantity: "1",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7TANK-1.WEB_-150x150.jpg",
    href: productHref("multiSUB Mini Tank (Including Electrodes)", "MS7TANK"),
  },
  {
    title: "multiSUB Mini Combs",
    quantity: "2",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7-10-1-1.WEB_-150x150.jpg",
    href: "/products/cleaver?q=multiSUB+Mini+Comb",
  },
  {
    title: "multiSUB Mini - Viewing Platform",
    quantity: "1",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS10-WP-1.WEB_-150x150.jpg",
    href: productHref("multiSUB Mini - Viewing Platform", "MS7-WP"),
  },
  {
    title: "multiSUB Mini - Loading Guides",
    quantity: "1",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS10-LG-1.WEB_-150x150.jpg",
    href: productHref("multiSUB Mini - Loading Guides", "MS7-LG"),
  },
  {
    title: "multiSUB Mini - Gel tray Dams",
    quantity: "1",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7-UVDAM-1.WEB_-150x150.jpg",
    href: productHref("multiSUB Mini - Gel tray Dams", "MS7-UVDAM"),
  },
  {
    title: "Electrophoresis cable (Black & Red)",
    quantity: "1",
    image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/CSL-CAB-1.WEB_-150x150.jpg",
    href: productHref("Electrophoresis cable (Black & Red)", "CSL-CAB"),
  },
] as const;

export default function MultiSubMiniIncluded() {
  return (
    <details className="group border-t border-[#d9d9d9]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-[18px] text-left marker:content-none md:py-5 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[22px] w-[22px] shrink-0 text-[#6d2c86]" aria-hidden>
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
        <div className="grid w-full max-w-[1040px] grid-cols-2 gap-x-7 gap-y-12 sm:gap-x-8 lg:grid-cols-4 lg:gap-x-9 lg:gap-y-14">
          {ITEMS.map((item) => (
            <article key={item.title} className="h-full min-w-0">
              <Link
                href={item.href}
                className="group/card grid h-full w-full grid-rows-[150px_minmax(52px,auto)_24px] text-left sm:grid-rows-[165px_minmax(52px,auto)_24px] lg:grid-rows-[190px_minmax(52px,auto)_24px]"
                aria-label={`View ${item.title} in ITS BIO`}
              >
                <div className="relative h-full w-full overflow-hidden bg-white">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 42vw, (max-width: 1024px) 28vw, 240px"
                    className="object-contain object-center transition-transform duration-200 group-hover/card:scale-[1.03]"
                  />
                </div>
                <h3 className="mt-4 w-full pr-2 text-[15px] font-semibold leading-[1.35] text-[#5b24f2] transition group-hover/card:underline md:text-[16px]">
                  {item.title}
                </h3>
                <p className="mt-2 self-end text-[14px] leading-5 text-[#5b24f2]">Qty: {item.quantity}</p>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </details>
  );
}
