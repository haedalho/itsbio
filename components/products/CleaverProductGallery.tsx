"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  title: string;
  images: string[];
};

export default function CleaverProductGallery({ title, images }: Props) {
  const [selected, setSelected] = useState(0);
  const active = images[selected] || images[0];

  if (!active) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-[28px] border border-[#ece7f1] bg-[#fbf9fd]">
        <div className="absolute inset-0 flex items-center justify-center p-16">
          <Image src="/partners/Cleaverscientific-logo.png" alt="Cleaver Scientific" width={220} height={92} className="h-auto max-w-full object-contain opacity-60" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-[28px] border border-[#ece7f1] bg-white shadow-[0_16px_60px_rgba(75,35,97,0.07)]">
        <Image
          key={active}
          src={active}
          alt={title}
          fill
          priority
          quality={90}
          sizes="(max-width: 768px) 94vw, (max-width: 1280px) 48vw, 650px"
          className="object-contain p-5 md:p-7"
        />
        {images.length > 1 ? (
          <div className="absolute right-4 top-4 rounded-full bg-[#281335]/80 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            {selected + 1} / {images.length}
          </div>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="mt-4 grid grid-cols-5 gap-3 sm:grid-cols-6">
          {images.slice(0, 6).map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`View ${title} photograph ${index + 1}`}
              aria-pressed={selected === index}
              className={`relative aspect-square overflow-hidden rounded-xl border bg-white transition ${selected === index ? "border-[#773395] ring-2 ring-[#773395]/15" : "border-slate-200 hover:border-[#be9dce]"}`}
            >
              <Image src={image} alt="" fill quality={85} sizes="(max-width: 640px) 18vw, 100px" className="object-contain p-1.5" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
