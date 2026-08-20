import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import AbmHeroBanner from "@/components/products/AbmHeroBanner";
import AbmStagedCatalog from "@/components/products/AbmStagedCatalog";
import Breadcrumb from "@/components/site/Breadcrumb";
import { ABM_SERVICE_GROUPS, abmRecordBelongsToProductPath } from "@/lib/abm/catalog-taxonomy";
import { getAbmStagedRecords } from "@/lib/abm/rebuild-staging";

export const revalidate = 300;

const PAGE_SHELL = "mx-auto max-w-[1320px] px-6";
const CONTENT_LAYOUT = "grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]";
const ROOT_PATH = ["cellular-materials"];

type CatalogNode = {
  slug: string;
  title: string;
  description?: string;
  children?: CatalogNode[];
};

const CELL_LIBRARY_CHILDREN: CatalogNode[] = [
  { slug: "immortalized-cell-lines", title: "Immortalized Cell Lines", description: "Renewable, passage-verified cell models for reproducible cell biology workflows." },
  { slug: "crispr-ko-cell-lines", title: "CRISPR KO Cell Lines", description: "Ready-to-use knockout cell models for functional genomics and target validation." },
  { slug: "cas9-expressing-cell-lines", title: "Cas9 Expressing Cell Lines", description: "Cas9-expressing stable cell lines for streamlined CRISPR editing workflows." },
  { slug: "stem-cell-derived-cells", title: "Stem Cell-Derived Cells", description: "Lineage-committed cell models for disease modelling, screening, and downstream assays." },
  { slug: "stable-cell-lines", title: "Stable Cell Lines", description: "Stable expression and engineered cell models for repeatable long-term studies." },
  { slug: "tumor-cell-lines", title: "Tumor Cell Lines", description: "Tumor-derived cell models supporting oncology and translational research." },
  { slug: "primary-cells", title: "Primary Cells", description: "Primary cell models for physiologically relevant validation and functional studies." },
];

const SPECIAL_CELL_COLLECTIONS: CatalogNode[] = [
  { slug: "mast-cell-lines", title: "Mast Cell Lines" },
  { slug: "dermal-papilla-cells-dpcs", title: "Dermal Papilla Cells (DPCs)" },
  { slug: "pre-adipocytes-and-fibroblasts", title: "Pre-adipocytes and Fibroblasts" },
  { slug: "neuronal-cell-lines", title: "Neuronal Cell Lines" },
  { slug: "breast-cancer-cell-lines", title: "Breast Cancer Cell Lines" },
  { slug: "colon-cancer-cell-lines", title: "Colon Cancer Cell Lines" },
  { slug: "sloan-kettering-tumor-cell-lines", title: "Sloan Kettering Tumor Cell Lines" },
  { slug: "oral-cancer-cell-collection", title: "Oral Cancer Cell Collection" },
  { slug: "lung-health-cell-collection", title: "Lung Health Cell Collection" },
  { slug: "blood-cell-collection", title: "Blood Cell Collection" },
  { slug: "liver-cell-collection", title: "Liver Cell Collection" },
];

const CELLULAR_CATALOG: CatalogNode[] = [
  {
    slug: "cell-library-collections",
    title: "Cell Library Collections",
    description: "Cell line collections spanning immortalized, CRISPR knockout, Cas9-expressing, stem cell-derived, stable, tumor, and primary cell models.",
    children: CELL_LIBRARY_CHILDREN,
  },
  {
    slug: "special-cell-line-collections",
    title: "Special Cell Line Collections",
    description: "Curated cell collections organized around disease areas, tissue systems, and specialized research models.",
    children: SPECIAL_CELL_COLLECTIONS,
  },
  {
    slug: "3d-and-organoid",
    title: "3D and Organoid",
    children: [
      { slug: "3d-culture-platforms", title: "3D Culture Platforms" },
      { slug: "organoid-biobanks-ready-to-use-organoids", title: "Organoid Biobanks / Ready-to-Use Organoids" },
      { slug: "3dcelmatrix", title: "3DCelMatrix™" },
    ],
  },
  {
    slug: "microbial-contamination",
    title: "Microbial Contamination",
    children: [
      { slug: "mycoplasma-control", title: "Mycoplasma Control" },
      { slug: "nanobacteria-control", title: "Nanobacteria Control" },
      { slug: "bacteria-control", title: "Bacteria Control" },
    ],
  },
  { slug: "cell-immortalization-reagents", title: "Cell Immortalization Reagents" },
  {
    slug: "media-and-supplements",
    title: "Media & Supplements",
    children: [
      { slug: "organoid-media-and-kits", title: "Organoid Media & Kits" },
      { slug: "spheroid-and-organoid-kits", title: "Spheroid & Organoid Kits" },
      { slug: "cell-freezing-media", title: "Cell Freezing Media" },
      { slug: "fbs-nano-free", title: "FBS (Nano-free)" },
      { slug: "culture-medium", title: "Culture Medium" },
      { slug: "serum-free-media", title: "Serum-Free Media" },
      { slug: "specialized-medium-and-kits", title: "Specialized Medium and Kits" },
      { slug: "trypsin", title: "Trypsin" },
      { slug: "supplements", title: "Supplements" },
      { slug: "coating-solutions", title: "Coating Solutions" },
      { slug: "antibiotics", title: "Antibiotics" },
    ],
  },
  { slug: "growth-factors-and-cytokines", title: "Growth Factors and Cytokines" },
  {
    slug: "culture-consumables",
    title: "Culture Consumables",
    children: [
      { slug: "cell-culture-vessels", title: "Cell Culture Vessels" },
      { slug: "serological-pipettes", title: "Serological Pipettes" },
      { slug: "centrifuge-tubes", title: "Centrifuge Tubes" },
      { slug: "culture-medium-bottles", title: "Culture Medium Bottles" },
      { slug: "centrifuge-bottles-tubes", title: "Centrifuge Bottles/Tubes" },
      { slug: "culture-inserts", title: "Culture Inserts" },
      { slug: "filtration-units", title: "Filtration Units" },
      { slug: "cryo-supplies", title: "Cryo Supplies" },
    ],
  },
  { slug: "cell-assay-products", title: "Cell Assay Products" },
  { slug: "cell-culture-equipment", title: "Cell Culture Equipment" },
];

function hrefFor(parts: string[]) {
  return `/products/abm/${[...ROOT_PATH, ...parts].join("/")}`;
}

function findNode(parts: string[]) {
  if (!parts.length) return null;
  let nodes = CELLULAR_CATALOG;
  let current: CatalogNode | undefined;
  for (const slug of parts) {
    current = nodes.find((node) => node.slug === slug);
    if (!current) return null;
    nodes = current.children || [];
  }
  return current || null;
}

function titleForPath(parts: string[], index: number) {
  const node = findNode(parts.slice(0, index + 1));
  return node?.title || parts[index].replaceAll("-", " ");
}

function CellularSideNav({ activeParts }: { activeParts: string[] }) {
  const activeTop = activeParts[0] || "";

  return (
    <div className="overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 bg-neutral-100 px-5 py-3">
        <div className="text-xl font-bold text-orange-600">All Products</div>
      </div>
      <div className="p-3">
        <Link href={hrefFor([])} className="flex items-center justify-between px-2 py-2 text-sm font-semibold text-[#dc5a2b]">
          <span>Cellular Materials</span><span aria-hidden>⌃</span>
        </Link>
        <div className="space-y-1">
          {CELLULAR_CATALOG.map((node) => {
            const active = activeTop === node.slug;
            const open = active && Boolean(node.children?.length);
            return (
              <div key={node.slug} className="group/section">
                <Link
                  href={hrefFor([node.slug])}
                  className={[
                    "flex items-center justify-between px-2 py-1.5 text-sm transition",
                    active ? "font-semibold text-orange-700" : "text-neutral-800 hover:bg-neutral-50",
                  ].join(" ")}
                >
                  <span className="min-w-0 truncate">{node.title}</span>
                  <span className={active ? "text-orange-600" : "text-neutral-300"} aria-hidden>{node.children?.length ? (open ? "⌃" : "›") : "›"}</span>
                </Link>
                {open ? (
                  <div className="ml-3 space-y-1 border-l border-neutral-200 pl-3">
                    {node.children!.map((child) => {
                      const childActive = activeParts[1] === child.slug;
                      return (
                        <Link
                          key={child.slug}
                          href={hrefFor([node.slug, child.slug])}
                          className={[
                            "block px-2 py-1.5 text-sm leading-5 transition",
                            childActive ? "bg-orange-100 font-semibold text-orange-700" : "text-neutral-700 hover:bg-neutral-50",
                          ].join(" ")}
                        >
                          {child.title}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-3 border-t border-neutral-200 pt-3">
          <Link href="/products/abm/general-materials" className="flex items-center justify-between px-2 py-2 text-sm font-semibold text-neutral-800 hover:text-[#dc5a2b]"><span>General Materials</span><span aria-hidden>⌄</span></Link>
          <Link href="/products/abm/genetic-materials" className="flex items-center justify-between px-2 py-2 text-sm font-semibold text-neutral-800 hover:text-[#dc5a2b]"><span>Genetic Materials</span><span aria-hidden>⌄</span></Link>
        </div>
        <div className="mt-3 border-t border-neutral-200 pt-3">
          <div className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Services</div>
          {ABM_SERVICE_GROUPS.map((group) => (
            <Link key={group.slug} href={group.href} className="flex items-center justify-between px-2 py-2 text-sm font-semibold text-neutral-800 hover:text-[#dc5a2b]"><span>{group.title}</span><span className="text-neutral-300" aria-hidden>›</span></Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryRows({ parts, nodes }: { parts: string[]; nodes: CatalogNode[] }) {
  return (
    <div className="mt-6 border-y border-neutral-300">
      {nodes.map((node) => (
        <Link
          key={node.slug}
          href={hrefFor([...parts, node.slug])}
          className="group grid gap-2 border-b border-neutral-200 px-3 py-5 transition last:border-b-0 hover:bg-orange-50/70 md:grid-cols-[260px_minmax(0,1fr)_auto] md:items-center md:gap-6"
        >
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-600">Product category</span>
            <h3 className="mt-1 text-lg font-semibold leading-7 text-neutral-900 group-hover:text-orange-700 group-hover:underline group-hover:underline-offset-4">{node.title}</h3>
          </div>
          <p className="text-sm leading-6 text-neutral-600">{node.description || "Browse products and research materials in this category."}</p>
          <span className="text-lg font-semibold text-orange-700 transition group-hover:translate-x-1" aria-hidden>›</span>
        </Link>
      ))}
    </div>
  );
}

export default async function AbmCellularMaterialsPage({ params, searchParams }: {
  params: Promise<{ path?: string[] }> | { path?: string[] };
  searchParams?: Promise<{ q?: string; page?: string }> | { q?: string; page?: string };
}) {
  const resolved = await Promise.resolve(params as { path?: string[] });
  const sp = await Promise.resolve(searchParams as { q?: string; page?: string } | undefined);
  const rawParts = Array.isArray(resolved?.path) ? resolved.path : [];
  const parts = rawParts.map((part) => String(part || "").trim().toLowerCase()).filter(Boolean);

  if (rawParts.join("/") !== parts.join("/")) redirect(hrefFor(parts));
  if (parts[0] === "cell-library-collections" && ["special-cell-line-collection", "special-cell-line-collections"].includes(parts[1] || "")) {
    redirect(hrefFor(["special-cell-line-collections", ...parts.slice(2)]));
  }
  if (parts[0] === "special-cell-line-collection") redirect(hrefFor(["special-cell-line-collections", ...parts.slice(1)]));

  const selected = findNode(parts);
  if (parts.length && !selected) notFound();

  const children = parts.length ? selected?.children || [] : CELLULAR_CATALOG;
  const title = selected?.title || "Cellular Materials";
  const description = selected?.description || (parts.length
    ? "Browse ABM cellular research products in this category."
    : "Cell lines, culture reagents, growth factors, contamination control, consumables, and cell-based research tools organized to match the current ABM catalog hierarchy.");

  const query = String(sp?.q || "").trim();
  const page = Math.max(1, Number.parseInt(String(sp?.page || "1"), 10) || 1);
  const records = children.length ? [] : await getAbmStagedRecords("product");
  const visibleRecords = children.length ? [] : records.filter((record) =>
    abmRecordBelongsToProductPath(record, [...ROOT_PATH, ...parts], title),
  );

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: "ABM", href: "/products/abm" },
    { label: "Cellular Materials", href: hrefFor([]) },
    ...parts.map((_, index) => ({ label: titleForPath(parts, index), href: hrefFor(parts.slice(0, index + 1)) })),
  ];

  return (
    <div>
      <AbmHeroBanner title="ABM Products & Services" />
      <div className={PAGE_SHELL}>
        <div className="mt-4"><Breadcrumb items={breadcrumbItems} /></div>
        <div className={`mt-5 pb-14 ${CONTENT_LAYOUT}`}>
          <aside className="self-start lg:sticky lg:top-24"><CellularSideNav activeParts={parts} /></aside>
          <main className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-600">ABM Product category</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 md:text-4xl">{title}</h1>
            <p className="mt-3 max-w-3xl leading-7 text-neutral-600">{description}</p>

            {children.length ? <CategoryRows parts={parts} nodes={children} /> : null}

            {!children.length ? (
              visibleRecords.length ? (
                <section className="mt-8">
                  <AbmStagedCatalog kind="product" records={visibleRecords} query={query} page={page} basePath={hrefFor(parts)} />
                </section>
              ) : (
                <div className="mt-8 border-y border-neutral-200 py-6 text-sm leading-6 text-neutral-600">
                  This category is part of the current ABM catalog. No matching product records are indexed in the current ITS BIO catalog snapshot yet.
                </div>
              )
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
