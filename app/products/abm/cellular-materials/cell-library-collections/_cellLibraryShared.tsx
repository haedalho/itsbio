import type { ReactNode } from "react";
import Link from "next/link";

import AbmHeroBanner from "@/components/products/AbmHeroBanner";
import Breadcrumb from "@/components/site/Breadcrumb";

const MENU = [
  ["Immortalized Cell Lines", "immortalized-cell-lines"],
  ["CRISPR KO Cell Lines", "crispr-ko-cell-lines"],
  ["Cas9 Expressing Cell Lines", "cas9-expressing-cell-lines"],
  ["Stem Cell-Derived Cells", "stem-cell-derived-cells"],
  ["Hematopoietic Cells", "hematopoietic-cells"],
  ["Stable Cell Lines", "stable-cell-lines"],
  ["Tumor Cell Lines", "tumor-cell-lines"],
  ["Primary Cells", "primary-cells"],
] as const;

const STEM_CHILDREN = [["Cardiovascular", "cardiovascular"], ["Neurological", "neurological"]] as const;

export function CellLibraryShell({ title, active, subActive, children }: { title: string; active: string; subActive?: string; children: ReactNode }) {
  return (
    <div className="bg-white">
      <AbmHeroBanner title="Applied Biological Materials (abm) Products & Services" />
      <div className="mx-auto max-w-[1320px] px-6">
        <div className="mt-4"><Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Cellular Materials", href: "/products/abm/cellular-materials" }, { label: "Cell Library Collections", href: "/products/abm/cellular-materials/cell-library-collections" }, ...(active === "stem-cell-derived-cells" && subActive ? [{ label: "Stem Cell-Derived Cells", href: "/products/abm/cellular-materials/cell-library-collections/stem-cell-derived-cells" }] : []), { label: title }]} /></div>
        <div className="mt-5 grid gap-8 pb-20 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]">
          <aside className="self-start lg:sticky lg:top-24"><CellLibrarySideNav active={active} subActive={subActive} /></aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}

function CellLibrarySideNav({ active, subActive }: { active: string; subActive?: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 bg-[#f2f2f2] px-5 py-3.5"><div className="text-[20px] font-bold text-[#f15a29]">All Products</div></div>
      <nav className="px-3 py-3 text-[13px] leading-5 text-neutral-900" aria-label="ABM cell library categories">
        <Link href="/products/abm/general-materials" className="flex items-center justify-between px-2 py-2 font-semibold hover:text-[#f15a29]"><span>General Materials</span><span>⌄</span></Link>
        <Link href="/products/abm/cellular-materials" className="flex items-center justify-between px-2 py-2 font-semibold"><span>Cellular Materials</span><span className="text-[#0d9bd7]">⌃</span></Link>
        <div className="pl-2">
          <Link href="/products/abm/cellular-materials/cell-library-collections" className="flex items-center justify-between px-2 py-1.5 font-medium text-[#f15a29]"><span>Cell Library Collections</span><span>⌃</span></Link>
          <div className="pl-3">
            {MENU.map(([label, slug]) => {
              const selected = active === slug;
              const stem = slug === "stem-cell-derived-cells";
              return <div key={slug}>
                <Link href={`/products/abm/cellular-materials/cell-library-collections/${slug}`} className={`flex items-center justify-between px-2 py-1.5 ${selected ? "font-semibold text-[#f15a29]" : "hover:text-[#f15a29]"}`}><span>{label}</span>{stem ? <span className="text-[#0d9bd7]">{selected ? "⌃" : "⌄"}</span> : null}</Link>
                {stem && selected ? <div className="pl-3 text-[12px]">{STEM_CHILDREN.map(([child, childSlug]) => <Link key={childSlug} href={`/products/abm/cellular-materials/cell-library-collections/stem-cell-derived-cells/${childSlug}`} className={`block px-2 py-1.5 ${subActive === childSlug ? "font-semibold text-[#f15a29]" : "text-neutral-700 hover:text-[#f15a29]"}`}>{child}</Link>)}</div> : null}
              </div>;
            })}
          </div>
          {["Special Cell Line Collections", "3D and Organoid", "Microbial Contamination", "Cell Immortalization Reagents", "Media & Supplements", "Growth Factors and Cytokines", "Culture Consumables", "Cell Assay Products", "Cell Culture Equipment"].map((label) => <div key={label} className="px-2 py-1.5 text-neutral-800">{label}</div>)}
        </div>
        <Link href="/products/abm/genetic-materials" className="mt-1 flex items-center justify-between border-t border-neutral-100 px-2 py-2 font-semibold hover:text-[#f15a29]"><span>Genetic Materials</span><span>⌄</span></Link>
      </nav>
    </div>
  );
}

export function SectionTitle({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return <div>{eyebrow ? <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#f15a29]">{eyebrow}</div> : null}<h2 className="mt-1 text-[25px] font-semibold tracking-[-0.025em] text-[#3f4953]">{title}</h2>{text ? <p className="mt-2 max-w-4xl text-[13px] leading-6 text-neutral-600">{text}</p> : null}</div>;
}

export function Stat({ value, label }: { value: string; label: string }) {
  return <div className="rounded-[16px] border border-[#eadfd9] bg-white px-4 py-4 text-center"><div className="text-[22px] font-bold text-[#f15a29]">{value}</div><div className="mt-1 text-[12px] text-neutral-600">{label}</div></div>;
}

export function SmallCard({ title, text, index }: { title: string; text: string; index?: string }) {
  return <article className="rounded-[17px] border border-[#e8dfdb] bg-white p-5 shadow-[0_6px_18px_rgba(34,24,18,0.025)]">{index ? <div className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[#f3d8cc] bg-[#fff5ef] px-2 text-[11px] font-bold text-[#f15a29]">{index}</div> : null}<h3 className={`${index ? "mt-3" : ""} text-[15px] font-bold text-[#3d464f]`}>{title}</h3><p className="mt-2 text-[12px] leading-[1.65] text-neutral-600">{text}</p></article>;
}

export function SearchBox({ title, placeholder }: { title: string; placeholder: string }) {
  return <section className="mt-8 border-t border-neutral-200 pt-8"><SectionTitle eyebrow="Find your model" title={title} /><form className="mt-5 grid gap-3 rounded-[18px] border border-neutral-200 bg-[#fafafa] p-4 sm:grid-cols-[minmax(0,1fr)_auto]" method="get"><input name="q" placeholder={placeholder} className="h-11 rounded-md border border-neutral-300 bg-white px-4 text-sm outline-none focus:border-[#f15a29]" /><button className="h-11 rounded-md bg-[#f15a29] px-6 text-sm font-semibold text-white">Search</button></form></section>;
}

export function FilterStrip() {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["SELECT CATEGORY", "All Cell Types"], ["SPECIES", "All Species"], ["BIO SYSTEM", "All Systems"], ["CELL TYPE", "All Cell Types"]].map(([label, value]) => <label key={label} className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">{label}<select className="mt-2 h-10 w-full border border-neutral-300 bg-white px-3 text-[12px] font-normal normal-case tracking-normal text-neutral-700"><option>{value}</option></select></label>)}</div>;
}
