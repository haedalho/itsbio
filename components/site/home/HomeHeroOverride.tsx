"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HERO_IMAGE =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDACweISchHCwnJCcyLyw1Qm9IQj09QohhZlBvoY2ppp6Nm5ixx//Ysbzxv5ib3v/g8f//////rNX/////////////2wBDAS8yMkI6QoJISIL/t5u3////////////////////////////////////////////////////////////////////wAARCAECASwDASIAAhEBAxEB/8QAGQAAAwEBAQAAAAAAAAAAAAAAAAECAwQF/8QAKxAAAgICAQQBBAMBAAMBAAAAAAECESExEgNBUWFxBCIykROBoUIUseHw/8QAFwEBAQEBAAAAAAAAAAAAAAAAAAECA//EABoRAQEBAQEBAQAAAAAAAAAAAAABEQISITH/2gAMAwEAAhEDEQA/APVAAAYhgAgGIAAAAAAAAQ2RkCrAnIroCwEpDAAAABDAUgFYEjQAMAAAAABK2W6wSnQ8NgNkynSHJ0jDqTXHBm3GpNX/ACeROno5ubbNum7VCXV65wZWjRZQnQoqr9mmV3RongxNFoIU5UYt2zWeTFrJiunLqEMDbmAAGACAAAAGAmCChgBNFWTYAKgsLCpaoaYxBFAJFAKyXkbERQAAUAxAEMBAgBoaH2ERT6iuJydS2dSfYzn00zPU1rm45oxyb9NAunRpFJMsmHV0OLY2qh7L2yOq80aYRZSlSIGBV2KkCWB0FagABAJjZIUAAEFIYkFlQxUMlySIqZOjKU8jnKzGTMWunMacxqZgpFxYlLG6ZRnFmhuOdIqyWBQ2IYBCAYUAgGJgAgGFKx71slhZA2sYE7QWJuXkqDL0XGLbyKLSdspzfbADcuKM3lgACEUIATaHyYJFcGwNAAQAxDEFAgACrBMTBEDbMZs1MupsnTXLOTMpMqRmzk6w47NDNGsI+TUZ6aQTo0Qo1RR0cqljQPY0UAANLzgIApky6qTqKtkNye5E1caOl3Jco/8A5ip1Vti4LwA/5Iexfyw8sHH0S0vA+r8V/JDzXyNNPTTIUYv0D6ab7x+MhFgRc4Omr/8AZUZKauLKAe6AQQxAKwGArCwNIq2K3LK12CL+x+WUpUqQVQAAQgAAoAACGJDEAETjaLEyWLK5ZRJo6XBMj+Mx5dPTKKdmsUPjQ0iyJapFLJKRpFGmBxJSzg0YkVCxFWYuUupLGip3N8V+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";

export default function HomeHeroOverride() {
  const pathname = usePathname();
  if (pathname !== "/") return null;

  return (
    <>
      <style jsx global>{`
        body:has(.itsbio-home-hero-override) main > section#top {
          display: none !important;
        }
      `}</style>

      <section className="itsbio-home-hero-override relative isolate overflow-hidden bg-[#fbfaf8]">
        <div className="absolute inset-y-0 right-0 w-full md:w-[62%]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${HERO_IMAGE})` }}
          />
          <div className="absolute inset-0 bg-white/20 md:bg-transparent" />
        </div>

        <div className="absolute inset-0 bg-gradient-to-r from-[#fbfaf8] via-[#fbfaf8]/96 to-[#fbfaf8]/20 md:via-[#fbfaf8]/90 md:to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-orange-50/90 to-transparent" />

        <div className="relative mx-auto flex min-h-[600px] max-w-7xl items-center px-6 py-16 md:min-h-[680px] md:py-20">
          <div className="max-w-[920px]">
            <div className="text-base font-semibold tracking-[0.14em] text-orange-600 md:text-lg">ITS BIO</div>

            <h1 className="mt-5 max-w-[920px] text-[40px] font-semibold leading-[1.08] tracking-[-0.045em] text-[#071d43] sm:text-[46px] md:text-[50px] lg:text-[54px]">
              <span className="block">Innovative Solutions for</span>
              <span className="mt-1 block">Life Science Research and Animal Care</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 md:text-lg md:leading-8">
              Trusted products and services to accelerate your discovery and improve animal lives.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/products"
                className="inline-flex h-14 items-center justify-center gap-5 rounded-full bg-orange-600 px-8 text-base font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-orange-700"
              >
                Explore Products <span aria-hidden>→</span>
              </Link>
              <Link
                href="/about"
                className="inline-flex h-14 items-center justify-center gap-5 rounded-full border border-orange-400 bg-white/75 px-8 text-base font-semibold text-orange-700 backdrop-blur transition hover:-translate-y-0.5 hover:bg-orange-50"
              >
                Learn More <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
