import Link from "next/link";

import AbmHeroBanner from "@/components/products/AbmHeroBanner";
import Breadcrumb from "@/components/site/Breadcrumb";

const PAGE_SHELL = "mx-auto max-w-[1320px] px-6";

const cellLibraryChildren = [
  ["Immortalized Cell Lines", "immortalized-cell-lines"],
  ["CRISPR KO Cell Lines", "crispr-ko-cell-lines"],
  ["Cas9 Expressing Cell Lines", "cas9-expressing-cell-lines"],
  ["Stem Cell-Derived Cells", "stem-cell-derived-cells"],
  ["Stable Cell Lines", "stable-cell-lines"],
  ["Tumor Cell Lines", "tumor-cell-lines"],
  ["Primary Cells", "primary-cells"],
] as const;

const cellularSections = [
  ["Special Cell Line Collections", "special-cell-line-collections"],
  ["3D and Organoid", "3d-and-organoid"],
  ["Microbial Contamination", "microbial-contamination"],
  ["Cell Immortalization Reagents", "cell-immortalization-reagents"],
  ["Media & Supplements", "media-and-supplements"],
  ["Growth Factors and Cytokines", "growth-factors-and-cytokines"],
  ["Culture Consumables", "culture-consumables"],
  ["Cell Assay Products", "cell-assay-products"],
  ["Cell Culture Equipment", "cell-culture-equipment"],
] as const;

const categories = [
  {
    eyebrow: "Core Collection",
    title: "Immortalized Cell Lines",
    href: "/products/abm/cellular-materials/cell-library-collections/immortalized-cell-lines",
    image: "https://www.abmgood.com/assets/images/tinymce/QKWWmTOkaulJpeQOV4nflnSn1xegUKpSCWjxU9CJ.png",
  },
  {
    eyebrow: "Genome Editing",
    title: "CRISPR KO Cell Lines",
    href: "/products/abm/cellular-materials/cell-library-collections/crispr-ko-cell-lines",
    image: "https://www.abmgood.com/assets/images/tinymce/4z8Ofdu6xjpEUlvSnEZjrgfkdJWq1ouXssWlr5hT.png",
  },
  {
    eyebrow: "Genome Editing",
    title: "Cas9 Expressing Cell Lines",
    href: "/products/abm/cellular-materials/cell-library-collections/cas9-expressing-cell-lines",
    image: "https://www.abmgood.com/assets/images/tinymce/vgqNGJE33i6GLPyjnKQi95784QCKnA7EdSAUOrlY.png",
  },
  {
    eyebrow: "Differentiation",
    title: "Stem Cell-Derived Cells",
    href: "/products/abm/cellular-materials/cell-library-collections/stem-cell-derived-cells",
    image: "https://www.abmgood.com/assets/images/tinymce/GuxeFxhz0xAShGhEtRW21kVqvswpbeKN11BfbSxa.png",
  },
  {
    eyebrow: "Engineered Lines",
    title: "Stable Cell Lines",
    href: "/products/abm/cellular-materials/cell-library-collections/stable-cell-lines",
    image: "https://www.abmgood.com/assets/images/tinymce/AyCmMqvv66BntReScmkF1j8YPAJ32Cjy4wRFoDit.png",
  },
  {
    eyebrow: "Oncology",
    title: "Tumor Cell Lines",
    href: "/products/abm/cellular-materials/cell-library-collections/tumor-cell-lines",
    image: "https://www.abmgood.com/assets/images/tinymce/QEddm39LxP2M6jaXZa7belIyl14nsubr4djJdgvI.png",
  },
  {
    eyebrow: "Physiological Models",
    title: "Primary Cells",
    href: "/products/abm/cellular-materials/cell-library-collections/primary-cells",
    image: "https://www.abmgood.com/assets/images/tinymce/aw7cnpDbjyetAUr2u59EMHi9wO9bA2GRxBQIcO83.png",
  },
  {
    eyebrow: "Specialty",
    title: "Special Cell Line Collections",
    href: "/products/abm/cellular-materials/cell-library-collections/special-cell-line-collection",
    image: "https://www.abmgood.com/assets/images/tinymce/VJNQNC82ZB6xVfHDvAll5qJtOhackLfeA3qeXdiS.png",
  },
] as const;

function SideNav() {
  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 bg-[#f2f2f2] px-5 py-3.5">
        <div className="text-[20px] font-bold text-[#f15a29]">All Products</div>
      </div>

      <nav className="px-3 py-3 text-[13px] leading-5 text-neutral-900" aria-label="ABM product categories">
        <Link
          href="/products/abm/general-materials"
          className="flex items-center justify-between px-2 py-2 font-semibold hover:text-[#f15a29]"
        >
          <span>General Materials</span><span className="text-[#111827]">⌄</span>
        </Link>

        <div>
          <Link
            href="/products/abm/cellular-materials"
            className="flex items-center justify-between px-2 py-2 font-semibold"
          >
            <span>Cellular Materials</span><span className="text-[#0d9bd7]">⌃</span>
          </Link>

          <div className="pl-2">
            <Link
              href="/products/abm/cellular-materials/cell-library-collections"
              className="flex items-center justify-between px-2 py-1.5 font-medium text-[#f15a29]"
            >
              <span>Cell Library Collections</span><span className="text-[#f15a29]">⌃</span>
            </Link>

            <div className="pl-3">
              {cellLibraryChildren.map(([label, slug]) => (
                <Link
                  key={slug}
                  href={`/products/abm/cellular-materials/cell-library-collections/${slug}`}
                  className="block px-2 py-1.5 text-neutral-900 hover:text-[#f15a29]"
                >
                  {label}
                </Link>
              ))}
            </div>

            {cellularSections.map(([label, slug]) => (
              <Link
                key={slug}
                href={slug === "special-cell-line-collections"
                  ? "/products/abm/cellular-materials/cell-library-collections/special-cell-line-collection"
                  : `/products/abm/cellular-materials/${slug}`}
                className="flex items-center justify-between px-2 py-1.5 text-neutral-900 hover:text-[#f15a29]"
              >
                <span>{label}</span>
                {[
                  "special-cell-line-collections",
                  "3d-and-organoid",
                  "microbial-contamination",
                  "media-and-supplements",
                  "culture-consumables",
                ].includes(slug) ? <span className="text-[#0d9bd7]">⌄</span> : null}
              </Link>
            ))}
          </div>
        </div>

        <Link
          href="/products/abm/genetic-materials"
          className="mt-1 flex items-center justify-between border-t border-neutral-100 px-2 py-2 font-semibold hover:text-[#f15a29]"
        >
          <span>Genetic Materials</span><span className="text-[#111827]">⌄</span>
        </Link>
      </nav>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-[#f2d8cd] bg-[#fff4ee] px-3 py-1 text-[11px] font-medium text-[#e44d1b]">
      {children}
    </span>
  );
}

function Metric({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-[82px] flex-col items-center justify-center rounded-[16px] border border-[#eadfd9] bg-white px-4 py-4 text-center shadow-[0_5px_18px_rgba(25,15,10,0.025)]">
      <div className="text-[13px] font-bold text-[#f05b27]">{title}</div>
      <div className="mt-1 text-[12px] leading-4 text-[#505050]">{text}</div>
    </div>
  );
}

function ReasonCard({ no, title, children, tone }: { no: string; title: string; children: React.ReactNode; tone: "orange" | "blue" | "green" }) {
  const toneClasses = {
    orange: "border-[#fde5da] bg-[#fff6f1] text-[#f05b27]",
    blue: "border-[#dce7f8] bg-[#f5f8ff] text-[#4e6fae]",
    green: "border-[#d5eee5] bg-[#f2fbf8] text-[#2c9a70]",
  }[tone];

  return (
    <article className="min-h-[190px] rounded-[18px] border border-[#e9dfda] bg-white p-5 shadow-[0_5px_18px_rgba(25,15,10,0.018)]">
      <div className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-[12px] font-bold ${toneClasses}`}>{no}</div>
      <h3 className="mt-3 text-[15px] font-bold text-[#3f454b]">{title}</h3>
      <p className="mt-2 text-[12px] leading-[1.65] text-[#424242]">{children}</p>
    </article>
  );
}

export default function CellLibraryCollectionsPage() {
  return (
    <div className="bg-white">
      <AbmHeroBanner title="Applied Biological Materials (abm) Products & Services" />

      <div className={PAGE_SHELL}>
        <div className="mt-4">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Cellular Materials", href: "/products/abm/cellular-materials" },
              { label: "Cell Library Collections", href: "/products/abm/cellular-materials/cell-library-collections" },
            ]}
          />
        </div>

        <div className="mt-5 grid gap-8 pb-20 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]">
          <aside className="self-start lg:sticky lg:top-24">
            <SideNav />
          </aside>

          <main className="min-w-0">
            <section className="relative overflow-hidden rounded-[22px] border border-[#f1ddd5] bg-[#fffaf7] px-6 py-7 md:px-7 md:py-8">
              <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 opacity-45 [background-image:radial-gradient(#f0b69f_1px,transparent_1px)] [background-size:11px_11px] [mask-image:linear-gradient(to_bottom_left,black,transparent_75%)]" />

              <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#ef5b2a]">abm CELL BIOLOGY</div>
                  <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.025em] text-[#44505b] md:text-[31px]">Cell Library Collections</h1>

                  <p className="mt-3 max-w-[710px] text-[13px] leading-[1.55] text-[#222]">
                    abm’s Cell Library Collections offer researchers a comprehensive, quality-verified portfolio of cell models spanning immortalized cell lines, primary cells, CRISPR-engineered lines, stem cell-derived cells, tumour models, and more.
                  </p>
                  <p className="mt-3 max-w-[710px] text-[13px] leading-[1.55] text-[#222]">
                    Each cell is sourced and authenticated to accelerate biomedical research, drug discovery, and cell therapy development with confidence and reproducibility.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <Link href="#browse-cell-categories" className="inline-flex h-10 items-center rounded-full bg-[#f15a24] px-5 text-[12px] font-bold text-white transition hover:bg-[#da4b18]">Browse Cell Categories</Link>
                    <Link href="/contact" className="inline-flex h-10 items-center rounded-full border border-[#f15a24] bg-white px-5 text-[12px] font-medium text-[#e9501c] transition hover:bg-[#fff5ef]">Ask About a Cell Line</Link>
                    <Link href="#why-choose-abm" className="inline-flex h-10 items-center rounded-full border border-[#f15a24] bg-white px-5 text-[12px] font-medium text-[#e9501c] transition hover:bg-[#fff5ef]">Why Choose abm</Link>
                  </div>
                </div>

                <div className="rounded-[16px] border border-[#eadfd9] bg-white p-4 shadow-[0_10px_26px_rgba(41,25,18,0.08)]">
                  <div className="text-[12px] font-medium leading-4 text-[#333]">Built for faster model<br />selection</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill>Authenticated Cell Models</Pill>
                    <Pill>Genome Editing</Pill>
                    <Pill>Primary Cells</Pill>
                    <Pill>Stem Cell-Derived Cells</Pill>
                    <Pill>Oncology Models</Pill>
                    <Pill>Custom Sourcing Support</Pill>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric title="8 Categories" text="Across key cell model types" />
              <Metric title="Quality-Verified" text="Sourced and authenticated cells" />
              <Metric title="Research-Ready" text="For biomedical and translational workflows" />
              <Metric title="Support Available" text="Cell sourcing and technical assistance" />
            </section>

            <section id="why-choose-abm" className="mt-5 rounded-[22px] border border-[#eadfd9] bg-white px-6 py-7 md:px-7 md:py-8">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#ef5b2a]">WHY CHOOSE abm COLLECTIONS</div>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-[#3e4852]">Find the right cell model faster</h2>
              <p className="mt-2 max-w-4xl text-[13px] leading-[1.6] text-[#424242]">
                Explore a structured portfolio of cell model categories designed to help researchers compare options, identify relevant models, and move from model selection to experimentation with fewer delays.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <ReasonCard no="01" title="Comprehensive Cell Access" tone="orange">
                  Browse immortalized, primary, engineered, stem cell-derived, immune, and tumour cell models from one organized landing page.
                </ReasonCard>
                <ReasonCard no="02" title="Quality-Verified Models" tone="blue">
                  Cell models are sourced and authenticated to support reproducible biomedical research, drug discovery, and translational applications.
                </ReasonCard>
                <ReasonCard no="03" title="Responsive Sourcing Support" tone="green">
                  If the specific cell or cell line is not listed online, the abm team can help investigate availability and sourcing options.
                </ReasonCard>
              </div>
            </section>

            <section id="browse-cell-categories" className="mt-7 rounded-[22px] border border-[#eadfd9] bg-[#fffdfc] px-6 py-7 md:px-7 md:py-8">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#ef5b2a]">BROWSE CELL CATEGORIES</div>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-[#3e4852]">Explore cell line categories by research application</h2>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {categories.map((category) => (
                  <Link
                    key={category.title}
                    href={category.href}
                    prefetch={false}
                    className="group overflow-hidden rounded-[18px] border border-[#eadfd9] bg-white transition hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(41,25,18,0.08)]"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden bg-[#f4f4f4]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={category.image} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
                    </div>
                    <div className="p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-[#ef5b2a]">{category.eyebrow}</div>
                      <h3 className="mt-1.5 text-[16px] font-semibold leading-5 text-[#3f4850]">{category.title}</h3>
                      <div className="mt-3 text-[12px] font-semibold text-[#e9501c]">View Category <span aria-hidden>→</span></div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="mt-7 rounded-[22px] border border-[#eadfd9] bg-[#fff7f2] px-6 py-7 md:flex md:items-center md:justify-between md:gap-8 md:px-7">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#ef5b2a]">CELL SOURCING SUPPORT</div>
                <h2 className="mt-2 text-[21px] font-semibold tracking-[-0.02em] text-[#3e4852]">Can’t find the specific cell or cell line you need?</h2>
                <p className="mt-2 max-w-3xl text-[13px] leading-[1.6] text-[#424242]">Contact our team and we’ll help identify availability, alternatives, and sourcing options for your research.</p>
              </div>
              <div className="mt-5 flex shrink-0 flex-wrap gap-2 md:mt-0">
                <Link href="/contact" className="inline-flex h-10 items-center rounded-full bg-[#f15a24] px-5 text-[12px] font-bold text-white">Contact Technical Support</Link>
                <Link href="/quote" className="inline-flex h-10 items-center rounded-full border border-[#f15a24] bg-white px-5 text-[12px] font-medium text-[#e9501c]">Request a Quote</Link>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
