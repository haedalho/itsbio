import type { ReactNode } from "react";
import Link from "next/link";

import AbmHeroBanner from "@/components/products/AbmHeroBanner";
import AbmCellularSidebar from "@/components/products/AbmCellularSidebar";
import Breadcrumb from "@/components/site/Breadcrumb";

export function CellLibraryShell({ title, active, subActive, children }: { title: string; active: string; subActive?: string; children: ReactNode }) {
  const parentCrumb = active === "stem-cell-derived-cells" && subActive
    ? { label: "Stem Cell-Derived Cells", href: "/products/abm/cellular-materials/cell-library-collections/stem-cell-derived-cells" }
    : active === "hematopoietic-cells" && subActive
      ? { label: "Hematopoietic Cells", href: "/products/abm/cellular-materials/cell-library-collections/hematopoietic-cells" }
      : null;
  return (
    <div className="bg-white">
      <AbmHeroBanner title="Applied Biological Materials (abm) Products & Services" />
      <div className="mx-auto max-w-[1320px] px-6">
        <div className="mt-4"><Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Cellular Materials", href: "/products/abm/cellular-materials" }, { label: "Cell Library Collections", href: "/products/abm/cellular-materials/cell-library-collections" }, ...(parentCrumb ? [parentCrumb] : []), { label: title }]} /></div>
        <div className="mt-5 grid gap-8 pb-20 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]">
          <aside className="self-start lg:sticky lg:top-24">
            <AbmCellularSidebar activePath={["cellular-materials", "cell-library-collections", active, ...(subActive ? [subActive] : [])]} />
          </aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
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
