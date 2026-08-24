import Link from "next/link";

import { CellLibraryShell, SectionTitle, SmallCard } from "../_cellLibraryShared";

const groups = [
  ["Hematopoietic Stem Cell (HSC)", "hematopoietic-stem-cell-hsc", "CD34⁺ multipotent progenitor cells for hematology, immunology, oncology, and regenerative medicine."],
  ["T Cells (CD4⁺, CD8⁺, Treg, γδ)", "t-cells-cd4-cd8-treg", "Purified human T-cell subsets for signaling, CAR-T, tolerance, inflammation, and immunomodulator studies."],
  ["NK Cells", "nk-cells", "Highly purified primary human NK cells for cytotoxicity, immune research, cell therapy, and screening."],
  ["Dendritic Cells", "dendritic-cells", "Monocyte-derived antigen-presenting cells for immunology, vaccine, cancer, and tolerance research."],
  ["Granulocytes", "granulocytes", "Neutrophils, eosinophils, and basophils for innate-immunity, inflammation, and allergen-response studies."],
] as const;

export default function HematopoieticCellsPage() {
  return <CellLibraryShell title="Hematopoietic Cells" active="hematopoietic-cells">
    <section className="rounded-[18px] border border-neutral-200 bg-white p-7 md:p-8">
      <h1 className="text-[30px] font-semibold tracking-[-0.025em] text-[#414b55]">Hematopoietic Cells</h1>
      <h2 className="mt-3 text-[23px] font-semibold text-[#414b55]">The Foundation of Blood and Immune System Research</h2>
      <p className="mt-4 max-w-4xl text-[13px] leading-6 text-neutral-700">abm’s hematopoietic cell collection provides research-ready human blood and immune cell populations for studying hematopoiesis, immune development, oncology, and regenerative medicine. The portfolio includes highly defined CD34⁺ stem/progenitor cells as well as lineage-committed immune populations.</p>
    </section>

    <section className="mt-6 rounded-[20px] border border-[#eadfd9] bg-[#fffaf7] p-7">
      <SectionTitle eyebrow="Hematopoietic cell types" title="Browse the collection" />
      <div className="mt-5 grid gap-4 md:grid-cols-2">{groups.map(([title, slug, text]) => <Link key={slug} href={`/products/abm/cellular-materials/cell-library-collections/hematopoietic-cells/${slug}`} className="block"><SmallCard title={title} text={text} /></Link>)}</div>
    </section>
  </CellLibraryShell>;
}
