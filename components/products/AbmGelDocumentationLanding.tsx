import Link from "next/link";

import Breadcrumb from "@/components/site/Breadcrumb";
import AbmHeroBanner from "@/components/products/AbmHeroBanner";
import AbmStagedCatalog from "@/components/products/AbmStagedCatalog";
import { ABM_SERVICE_GROUPS } from "@/lib/abm/catalog-taxonomy";
import { getAbmStagedRecord, type AbmStagedRecord } from "@/lib/abm/rebuild-staging";

type LandingKind = "dna-stains" | "gel-imager";

const PAGE_SHELL = "mx-auto max-w-[1320px] px-6";
const CONTENT_LAYOUT = "grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]";

const DNA_STAIN_ROWS = [
  { name: "SafeView™ Classic", sku: "G108", format: "Gel casting / post-stain", color: "Green", sensitivity: "1.0–2.0 ng" },
  { name: "Safe-Green™", sku: "G108-G", format: "Loading dye", color: "Green", sensitivity: "0.2–0.6 ng" },
  { name: "Safe-Red™", sku: "G108-R", format: "Loading dye", color: "Red", sensitivity: "0.6–1.0 ng" },
  { name: "Safe-Red™ Gel", sku: "G680", format: "Gel casting / post-stain", color: "Red", sensitivity: "0.6–1.0 ng" },
];

function GelDocumentationSideNav({ active }: { active: LandingKind }) {
  const gelHref = "/products/abm/general-materials/gel-documentation";
  const itemClass = (selected: boolean) =>
    `flex items-center justify-between px-3 py-2 text-sm transition ${selected ? "bg-orange-50 font-semibold text-orange-700" : "text-neutral-700 hover:bg-neutral-50 hover:text-orange-700"}`;

  return (
    <nav className="overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-sm" aria-label="ABM catalog navigation">
      <div className="border-b border-neutral-200 bg-neutral-100 px-5 py-3">
        <div className="text-xl font-bold text-orange-600">All Products</div>
      </div>
      <div className="p-3">
        <Link href="/products/abm/general-materials" className="flex items-center justify-between px-2 py-2 text-sm font-semibold text-orange-700">
          <span>General Materials</span><span aria-hidden>⌃</span>
        </Link>
        <div className="mt-1 border-l border-orange-100 pl-2">
          <Link href={gelHref} className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-neutral-900 hover:text-orange-700">
            <span>Gel Documentation</span><span aria-hidden>⌄</span>
          </Link>
          <Link href={`${gelHref}/gel-imager`} className={itemClass(active === "gel-imager")}>
            <span>Gel Imager</span><span className="text-neutral-300" aria-hidden>›</span>
          </Link>
          <Link href={`${gelHref}/dna-stains`} className={itemClass(active === "dna-stains")}>
            <span>DNA Stains</span><span className="text-neutral-300" aria-hidden>›</span>
          </Link>
        </div>

        <div className="mt-3 border-t border-neutral-200 pt-2">
          <Link href="/products/abm/cellular-materials" className="flex items-center justify-between px-2 py-2 text-sm font-semibold text-neutral-800 hover:text-orange-700">
            <span>Cellular Materials</span><span aria-hidden>⌄</span>
          </Link>
          <Link href="/products/abm/genetic-materials" className="flex items-center justify-between px-2 py-2 text-sm font-semibold text-neutral-800 hover:text-orange-700">
            <span>Genetic Materials</span><span aria-hidden>⌄</span>
          </Link>
        </div>

        <div className="mt-3 border-t border-neutral-200 pt-3">
          <div className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Services</div>
          {ABM_SERVICE_GROUPS.map((group) => (
            <Link key={group.slug} href={group.href} className="flex items-center justify-between px-2 py-2 text-sm font-semibold text-neutral-800 hover:text-orange-700">
              <span>{group.title}</span><span className="text-neutral-300" aria-hidden>›</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

function DnaStainsIntro() {
  return (
    <>
      <div className="rounded-[24px] border border-orange-100 bg-gradient-to-br from-orange-50/80 to-white p-6 md:p-8">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">SafeView™ DNA Stains</div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">Safer nucleic-acid visualization for agarose gels</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-650">
          ABM’s SafeView™ stain family is designed for detection of double-stranded DNA, single-stranded DNA, and RNA in agarose gel electrophoresis. The range includes green and red fluorescence in both gel-casting and loading-dye formats, so the stain can be matched to the laboratory workflow.
        </p>
      </div>

      <section className="mt-9">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Product guide</p>
            <h2 className="mt-2 text-2xl font-semibold text-neutral-950">Choose the right SafeView™ format</h2>
          </div>
          <Link href="/products/abm/general-materials/gel-documentation/gel-imager" className="text-sm font-semibold text-orange-700 underline underline-offset-4">View SafeViewER™ Imager</Link>
        </div>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-5 py-3 font-semibold">Product</th>
                <th className="px-5 py-3 font-semibold">Cat. No.</th>
                <th className="px-5 py-3 font-semibold">Format</th>
                <th className="px-5 py-3 font-semibold">Fluorescence</th>
                <th className="px-5 py-3 font-semibold">Sensitivity / band</th>
              </tr>
            </thead>
            <tbody>
              {DNA_STAIN_ROWS.map((row) => (
                <tr key={row.sku} className="border-t border-neutral-200">
                  <td className="px-5 py-4 font-semibold text-neutral-950">{row.name}</td>
                  <td className="px-5 py-4 text-neutral-700">{row.sku}</td>
                  <td className="px-5 py-4 text-neutral-700">{row.format}</td>
                  <td className="px-5 py-4 text-neutral-700">{row.color}</td>
                  <td className="px-5 py-4 text-neutral-700">{row.sensitivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function GelImagerIntro() {
  const features = [
    ["Blue LED illumination", "Visualize compatible fluorescent stains without relying on UV illumination."],
    ["Designed around SafeView™", "Optimized for SafeView™ Classic, Safe-Green™, Safe-Red™, and Safe-Red™ Gel."],
    ["Analytical + preparative use", "A compact system intended to support routine gel documentation as well as gel handling workflows."],
  ];

  return (
    <>
      <div className="rounded-[24px] border border-amber-100 bg-gradient-to-br from-amber-50/80 to-white p-6 md:p-8">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">SafeViewER™ Imager · E1001</div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">UV-free gel visualization with blue LED technology</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-650">
          SafeViewER™ Imager is ABM’s gel documentation system for visualizing agarose gels with compatible SafeView™ stains. It combines blue LED illumination with a compact imaging workflow and is designed to reduce UV exposure to users and nucleic-acid samples.
        </p>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {features.map(([title, text]) => (
          <article key={title} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-sm font-black text-amber-600">✓</div>
            <h3 className="mt-4 text-base font-semibold text-neutral-950">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5 md:p-6">
        <h3 className="text-lg font-semibold text-neutral-950">Compatible ABM DNA stains</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {["SafeView™ Classic · G108", "Safe-Green™ · G108-G", "Safe-Red™ · G108-R", "Safe-Red™ Gel · G680"].map((item) => (
            <span key={item} className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700">{item}</span>
          ))}
        </div>
      </section>
    </>
  );
}

async function loadProducts(kind: LandingKind): Promise<AbmStagedRecord[]> {
  const skus = kind === "dna-stains" ? ["G108", "G108-G", "G108-R", "G680"] : ["E1001"];
  const records = await Promise.all(skus.map((sku) => getAbmStagedRecord("product", sku)));
  return records.filter((record): record is AbmStagedRecord => Boolean(record));
}

export default async function AbmGelDocumentationLanding({ kind }: { kind: LandingKind }) {
  const isDna = kind === "dna-stains";
  const title = isDna ? "DNA Stains" : "Gel Imager";
  const products = await loadProducts(kind);
  const basePath = `/products/abm/general-materials/gel-documentation/${kind}`;

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: "ABM", href: "/products/abm" },
    { label: "General Materials", href: "/products/abm/general-materials" },
    { label: "Gel Documentation", href: "/products/abm/general-materials/gel-documentation" },
    { label: title, href: basePath },
  ];

  return (
    <div>
      <AbmHeroBanner title="ABM Gel Documentation" eyebrow="ABM · ITS BIO" />
      <div className={PAGE_SHELL}>
        <div className="mt-4"><Breadcrumb items={breadcrumbItems} /></div>
        <div className={`mt-5 pb-14 ${CONTENT_LAYOUT}`}>
          <aside className="self-start lg:sticky lg:top-24">
            <GelDocumentationSideNav active={kind} />
          </aside>
          <main className="min-w-0">
            <div className="border-b border-neutral-200 pb-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Gel Documentation</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 md:text-4xl">{title}</h1>
            </div>

            <div className="mt-7">{isDna ? <DnaStainsIntro /> : <GelImagerIntro />}</div>

            <AbmStagedCatalog kind="product" records={products} query="" page={1} basePath={basePath} />
          </main>
        </div>
      </div>
    </div>
  );
}
