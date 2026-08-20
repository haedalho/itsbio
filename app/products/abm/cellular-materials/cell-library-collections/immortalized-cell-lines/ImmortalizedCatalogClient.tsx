"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Product = {
  title: string;
  sku?: string;
  url: string;
  unit?: string;
  previewImage?: string;
  searchCategory?: string;
  filterTitle?: string;
  filterPath?: string[];
  listingFilters?: Array<{ title?: string; path?: string[] }>;
  modelType: "Immortalized Cells" | "Tumor Cells" | "Primary Cells";
};

const SPECIES = [
  ["Human", /human|h\.\s*sapiens/i],
  ["Mouse", /mouse|m\.\s*musculus/i],
  ["Rat", /\brat\b|r\.\s*norvegicus/i],
  ["Monkey / Primate", /monkey|primate|marmoset|macaque/i],
  ["Canine", /canine|dog/i],
  ["Feline", /feline|cat\b/i],
  ["Bovine", /bovine|cow/i],
  ["Avian", /avian|chicken|bird/i],
  ["Bat", /\bbat\b/i],
  ["Dolphin", /dolphin/i],
  ["Porcine", /porcine|pig/i],
  ["Rabbit", /rabbit/i],
] as const;

const SYSTEMS = [
  ["Digestive System", /digestive|hepatic|liver|stomach|intestinal|colon|pancrea/i],
  ["Nervous System", /nervous|neural|neuron|brain|glia|astro|microglia/i],
  ["Cardiovascular System", /cardio|vascular|heart|endothelial|smooth muscle/i],
  ["Respiratory System", /respiratory|lung|airway|bronch|pulmonary/i],
  ["Integumentary System", /skin|dermal|keratin|melanocyte|hair|follicle/i],
  ["Immune / Hematopoietic", /immune|blood|lymph|mast|t cell|b cell|myeloid|hematopo/i],
  ["Musculoskeletal System", /skeletal|muscle|bone|cartilage|oste|chondro/i],
  ["Reproductive System", /reproductive|ovary|ovarian|uter|test|prostate|placenta/i],
  ["Urinary System", /urinary|kidney|renal|bladder/i],
  ["Endocrine System", /endocrine|thyroid|adrenal|pituitary/i],
] as const;

const CELL_TYPES = [
  ["Fibroblast", /fibroblast/i],
  ["Epithelial", /epithelial|epithelium/i],
  ["Endothelial", /endothelial/i],
  ["Keratinocyte", /keratinocyte/i],
  ["Hepatocyte / Liver", /hepatocyte|hepatic|liver/i],
  ["Neuronal / Glial", /neuron|neural|astro|microglia|glial/i],
  ["Muscle", /muscle|myoblast|myocyte/i],
  ["Stem / Progenitor", /stem|progenitor/i],
  ["Immune / Blood", /immune|lymph|mast|t cell|b cell|myeloid|blood/i],
  ["Adipocyte", /adipocyte|adipose/i],
] as const;

function fullText(product: Product) {
  return [
    product.title,
    product.sku,
    product.searchCategory,
    product.filterTitle,
    ...(product.filterPath || []),
    ...(product.listingFilters || []).flatMap((f) => [f.title, ...(f.path || [])]),
  ].filter(Boolean).join(" ");
}

function matchesFacet(text: string, value: string, defs: readonly (readonly [string, RegExp])[]) {
  if (!value) return true;
  const rule = defs.find(([label]) => label === value)?.[1];
  return rule ? rule.test(text) : true;
}

function productHref(product: Product) {
  return `/products/abm/staged/product/${encodeURIComponent(product.sku || product.url)}`;
}

export default function ImmortalizedCatalogClient({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [modelType, setModelType] = useState<Product["modelType"]>("Immortalized Cells");
  const [species, setSpecies] = useState("");
  const [system, setSystem] = useState("");
  const [cellType, setCellType] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      if (product.modelType !== modelType) return false;
      const text = fullText(product);
      if (needle && !text.toLowerCase().includes(needle)) return false;
      if (!matchesFacet(text, species, SPECIES)) return false;
      if (!matchesFacet(text, system, SYSTEMS)) return false;
      if (!matchesFacet(text, cellType, CELL_TYPES)) return false;
      return true;
    });
  }, [products, query, modelType, species, system, cellType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const resetPage = () => setPage(1);
  const clearAll = () => {
    setQuery("");
    setModelType("Immortalized Cells");
    setSpecies("");
    setSystem("");
    setCellType("");
    setPage(1);
  };

  return (
    <section id="catalog" className="mt-10 rounded-[22px] border border-[#eadfd9] bg-white p-6 md:p-7">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#f15a29]">Find your cell line</div>
      <h2 className="mt-1 text-[25px] font-semibold tracking-[-0.025em] text-[#3f4953]">Search and filter immortalized cell lines</h2>
      <p className="mt-2 text-[13px] leading-6 text-neutral-600">Search by product name or catalogue number, then narrow the collection by model type, species, biological system, or cell type.</p>

      <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); resetPage(); }}>
        <input value={query} onChange={(e) => { setQuery(e.target.value); resetPage(); }} placeholder="Name, cat. no., or keyword…" className="h-11 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-4 text-sm outline-none focus:border-[#f15a29]" />
        <button type="submit" className="h-11 rounded-md bg-[#f15a29] px-6 text-sm font-semibold text-white hover:bg-[#d95221]">Search</button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["Immortalized Cells", "Tumor Cells", "Primary Cells"] as const).map((type) => (
          <button key={type} type="button" onClick={() => { setModelType(type); resetPage(); }} className={`rounded-full border px-4 py-2 text-[12px] font-semibold transition ${modelType === type ? "border-[#f15a29] bg-[#f15a29] text-white" : "border-neutral-300 bg-white text-neutral-700 hover:border-[#f15a29] hover:text-[#f15a29]"}`}>{type}</button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">Species
          <select value={species} onChange={(e) => { setSpecies(e.target.value); resetPage(); }} className="mt-2 h-10 w-full border border-neutral-300 bg-white px-3 text-[12px] font-normal normal-case tracking-normal text-neutral-700"><option value="">All Species</option>{SPECIES.map(([label]) => <option key={label}>{label}</option>)}</select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">Bio system
          <select value={system} onChange={(e) => { setSystem(e.target.value); resetPage(); }} className="mt-2 h-10 w-full border border-neutral-300 bg-white px-3 text-[12px] font-normal normal-case tracking-normal text-neutral-700"><option value="">All Systems</option>{SYSTEMS.map(([label]) => <option key={label}>{label}</option>)}</select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">Cell type
          <select value={cellType} onChange={(e) => { setCellType(e.target.value); resetPage(); }} className="mt-2 h-10 w-full border border-neutral-300 bg-white px-3 text-[12px] font-normal normal-case tracking-normal text-neutral-700"><option value="">All Cell Types</option>{CELL_TYPES.map(([label]) => <option key={label}>{label}</option>)}</select>
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4">
        <div className="text-sm text-neutral-500"><span className="font-semibold text-neutral-800">{filtered.length.toLocaleString()}</span> results</div>
        <button type="button" onClick={clearAll} className="text-sm font-semibold text-[#e35422] hover:underline">Clear All</button>
      </div>

      {visible.length ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((product) => (
            <article key={`${product.modelType}-${product.sku || product.url}`} className="overflow-hidden rounded-[16px] border border-neutral-200 bg-white shadow-[0_5px_16px_rgba(20,20,20,0.04)]">
              {product.previewImage ? <div className="relative aspect-[4/3] overflow-hidden bg-[#fafafa]"><img src={product.previewImage} alt="" className="absolute inset-0 h-full w-full object-contain p-3" loading="lazy" /></div> : null}
              <div className="p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#f15a29]">{product.modelType}</div>
                <h3 className="mt-1 text-[14px] font-semibold leading-5 text-neutral-900">{product.title}</h3>
                <div className="mt-3 space-y-1 text-[12px] text-neutral-600">
                  <div><span className="font-semibold text-neutral-800">Cat. No.:</span> {product.sku || "—"}</div>
                  <div><span className="font-semibold text-neutral-800">Unit:</span> {product.unit || "—"}</div>
                  <div><span className="font-semibold text-neutral-800">Price:</span> Inquiry</div>
                </div>
                <Link href={productHref(product)} prefetch={false} className="mt-4 inline-flex rounded-full bg-[#f15a29] px-4 py-2 text-[11px] font-bold text-white hover:bg-[#d95221]">View Product</Link>
              </div>
            </article>
          ))}
        </div>
      ) : <div className="mt-6 rounded-[14px] border border-dashed border-neutral-300 px-5 py-10 text-center text-sm text-neutral-500">No matching cell lines found.</div>}

      {totalPages > 1 ? <div className="mt-6 flex items-center justify-between border-t border-neutral-200 pt-4"><button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="text-sm font-semibold text-neutral-700 disabled:opacity-30">← Previous</button><span className="text-xs text-neutral-500">Page {safePage} of {totalPages}</span><button type="button" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="text-sm font-semibold text-neutral-700 disabled:opacity-30">Next →</button></div> : null}
    </section>
  );
}
