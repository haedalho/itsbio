import Image from "next/image";
import Link from "next/link";

const PARTNERS = [
  { name: "Applied Biological Materials", src: "/partners/abm-logo-1.png", href: "/products/abm", external: false },
  { name: "AIMS", src: "/partners/aims-logo.png", href: "https://animalid.com/", external: true },
  { name: "BIOplastics", src: "/partners/bioplastics-logo.png", href: "https://www.bioplastics.com/", external: true },
  { name: "CellFree Sciences", src: "/partners/cellfreesciences-logo.png", href: "https://www.cfsciences.com/eg/", external: true },
  { name: "Cleaver Scientific", src: "/partners/Cleaverscientific-logo.png", href: "https://www.thistlescientific.co.uk/", external: true },
  { name: "ITSChem", src: "/partners/itschem-logo.png", href: "/contact", external: false },
  { name: "Kent Scientific", src: "/partners/KentScientific-logo.png", href: "/products/kent", external: false },
  { name: "PLAS-LABS", src: "/partners/plaslabs-logo.png", href: "https://plas-labs.com/", external: true },
  { name: "Seedburo", src: "/partners/Seedburo-logo.png", href: "https://seedburo.com/", external: true },
] as const;

export default function PartnersCarousel() {
  const loop = [...PARTNERS, ...PARTNERS];

  return (
    <section id="partners" className="bg-slate-50 py-14 md:py-18">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Our Partners</h2>
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-orange-600" />
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">Trusted brands and suppliers we work with.</p>
        </div>

        <div className="mt-10">
          <div className="relative mx-auto w-full max-w-4xl overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-slate-50 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-slate-50 to-transparent" />
            <div className="flex w-max items-center gap-10 [animation:partners-marquee_22s_linear_infinite] motion-reduce:animate-none">
              {loop.map((partner, index) => (
                <Link
                  key={`${partner.name}-${index}`}
                  href={partner.href}
                  target={partner.external ? "_blank" : undefined}
                  rel={partner.external ? "noreferrer" : undefined}
                  aria-label={partner.name}
                  className="flex w-[220px] shrink-0 items-center justify-center"
                >
                  <span className="relative h-17 w-[300px]">
                    <Image src={partner.src} alt={partner.name} fill className="object-contain" sizes="300px" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
