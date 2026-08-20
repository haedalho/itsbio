import Link from "next/link";

import { CellLibraryShell } from "../../_cellLibraryShared";

export default function HscPage() {
  return <CellLibraryShell title="Hematopoietic Stem Cell (HSC)" active="hematopoietic-cells" subActive="hematopoietic-stem-cell-hsc">
    <section className="border-b border-neutral-200 pb-8">
      <h1 className="text-[29px] font-semibold tracking-[-0.025em] text-[#414b55]">Hematopoietic Stem Cell (HSC)</h1>
      <p className="mt-4 max-w-4xl text-[13px] leading-6 text-neutral-700">Hematopoietic stem cells are multipotent progenitors used broadly in hematology, immunology, regenerative medicine, and oncology. abm provides ready-to-use human CD34⁺ HSCs alongside a matched expansion medium.</p>
      <p className="mt-3 max-w-4xl text-[13px] leading-6 text-neutral-700">The cells are enriched from high-quality human donor sources such as cord blood, bone marrow, or mobilized peripheral blood and retain the capacity to generate major blood-cell lineages.</p>
      <p className="mt-3 max-w-4xl text-[13px] leading-6 text-neutral-700">PrimGrow Xpan™ is a serum-free medium formulated to support expansion and maintenance of human CD34⁺ HSCs while preserving multipotency.</p>
    </section>
    <section className="mt-7"><h2 className="text-[22px] font-semibold text-[#414b55]">Product List</h2><div className="mt-4 overflow-x-auto"><table className="w-full border-collapse text-left text-[13px]"><thead><tr className="border-y border-neutral-300 bg-neutral-50"><th className="px-4 py-3">Product Name</th><th className="px-4 py-3">Cat. No.</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3">Price</th></tr></thead><tbody><tr className="border-b border-neutral-200"><td className="px-4 py-3"><Link href="/products/abm/staged/product/T4164" className="font-semibold text-[#d95628]">Hematopoietic Stem Cells</Link></td><td className="px-4 py-3">T4164</td><td className="px-4 py-3">1×10⁶ Cells</td><td className="px-4 py-3">$999</td></tr><tr className="border-b border-neutral-200"><td className="px-4 py-3"><Link href="/products/abm/staged/product/TM181" className="font-semibold text-[#d95628]">PrimGrow Xpan™ Medium Kit</Link></td><td className="px-4 py-3">TM181</td><td className="px-4 py-3">500 ml</td><td className="px-4 py-3">$499</td></tr></tbody></table></div></section>
  </CellLibraryShell>;
}
