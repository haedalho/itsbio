"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ModelType = "Immortalized Cells" | "Tumor Cells" | "Primary Cells";

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
  modelType: ModelType;
};

type FacetRule = readonly [label: string, rule: RegExp];
type Facets = { species: string[]; systems: string[]; cellTypes: string[] };

const SPECIES: readonly FacetRule[] = [
  ["Human (H. sapiens)", /\bhuman\b|h\.\s*sapiens/i],
  ["Mouse (M. musculus)", /\bmouse\b|m\.\s*musculus/i],
  ["Rat (R. norvegicus)", /\brat\b|r\.\s*norvegicus/i],
  ["Bat (Chiroptera)", /\bbat\b|chiroptera/i],
  ["Bottlenose Dolphin (Tursiops)", /dolphin|tursiops/i],
  ["Monkey (Primate)", /monkey|primate|marmoset|macaque/i],
  ["Dog (Canine)", /canine|\bdog\b/i],
  ["Cat (Feline)", /feline|\bcat\b/i],
  ["Cow (Bovine)", /bovine|\bcow\b/i],
  ["Pig (Porcine)", /porcine|\bpig\b/i],
  ["Rabbit", /rabbit/i],
  ["Chicken / Avian", /avian|chicken|\bbird\b/i],
  ["Horse (Equine)", /equine|\bhorse\b/i],
  ["Sheep / Ovine", /ovine|\bsheep\b/i],
];

const SYSTEMS: readonly FacetRule[] = [
  ["Lymphatic System", /lymph|lymphatic/i],
  ["Male Reproductive System", /male reproductive|testis|testicular|prostate|seminal/i],
  ["Musculoskeletal System", /musculoskeletal|skeletal|muscle|bone|cartilage|oste|chondro/i],
  ["Nervous System", /nervous|neural|neuron|brain|glia|astro|microglia/i],
  ["Respiratory System", /respiratory|lung|airway|bronch|pulmonary/i],
  ["Digestive System", /digestive|hepatic|liver|stomach|intestinal|colon|pancrea/i],
  ["Cardiovascular System", /cardio|vascular|heart|endothelial|smooth muscle/i],
  ["Female Reproductive System", /female reproductive|ovary|ovarian|uter|cervix|placenta/i],
  ["Integumentary System", /skin|dermal|keratin|melanocyte|hair|follicle/i],
  ["Immune System", /immune|blood|mast|t cell|b cell|myeloid|hematopo/i],
  ["Urinary System", /urinary|kidney|renal|bladder/i],
  ["Endocrine System", /endocrine|thyroid|adrenal|pituitary/i],
  ["Sensory System", /retina|retinal|cornea|ocular|eye|ear|auditory/i],
];

const CELL_TYPES: readonly FacetRule[] = [
  ["Cervix", /cervix|cervical/i],
  ["Colon", /\bcolon\b|colonic/i],
  ["Connective Tissue", /connective|fibroblast/i],
  ["Cord Blood", /cord blood/i],
  ["Ear", /\bear\b|auditory/i],
  ["Liver", /hepatocyte|hepatic|\bliver\b/i],
  ["Kidney", /kidney|renal/i],
  ["Lung", /\blung\b|pulmonary|bronch|airway/i],
  ["Brain", /\bbrain\b|cerebral/i],
  ["Neuron", /neuron|neuronal|neural/i],
  ["Astrocyte", /astrocyte|astroglia/i],
  ["Microglia", /microglia/i],
  ["Endothelial", /endothelial/i],
  ["Epithelial", /epithelial|epithelium/i],
  ["Fibroblast", /fibroblast/i],
  ["Keratinocyte", /keratinocyte/i],
  ["Melanocyte", /melanocyte/i],
  ["Bone Marrow", /bone marrow/i],
  ["Mast Cell", /mast cell/i],
  ["T Cell", /t cell|t-cell/i],
  ["B Cell", /b cell|b-cell/i],
  ["Macrophage", /macrophage/i],
  ["Myocyte / Muscle", /myocyte|myoblast|muscle/i],
  ["Stem / Progenitor", /stem|progenitor/i],
  ["Adipose", /adipocyte|adipose/i],
  ["Pancreas", /pancrea/i],
  ["Prostate", /prostate/i],
  ["Ovary", /ovary|ovarian/i],
  ["Placenta", /placenta/i],
  ["Retina / Eye", /retina|retinal|ocular|cornea|\beye\b/i],
];

function fullText(product: Product) {
  return [
    product.title,
    product.sku,
    product.searchCategory,
    product.filterTitle,
    ...(product.filterPath || []),
    ...(product.listingFilters || []).flatMap((filter) => [filter.title, ...(filter.path || [])]),
  ].filter(Boolean).join(" ");
}

function labelsFor(text: string, rules: readonly FacetRule[]) {
  return rules.filter(([, rule]) => rule.test(text)).map(([label]) => label);
}

function productFacets(product: Product): Facets {
  const text = fullText(product);
  return {
    species: labelsFor(text, SPECIES),
    systems: labelsFor(text, SYSTEMS),
    cellTypes: labelsFor(text, CELL_TYPES),
  };
}

function productHref(product: Product) {
  return `/products/abm/staged/product/${encodeURIComponent(product.sku || product.url)}`;
}

function toggle(current: string[], value: string) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function matches(values: string[], selected: string[]) {
  return !selected.length || selected.some((value) => values.includes(value));
}

function FacetList({ label, rules, selected, onToggle }: {
  label: string;
  rules: readonly FacetRule[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#ef5a29]">{label}</div>
      <div className="h-[198px] overflow-y-auto rounded-[15px] border border-[#eee6e1] bg-white py-2 shadow-[0_4px_14px_rgba(44,28,18,0.025)]">
        {rules.map(([value]) => {
          const active = selected.includes(value);
          return <button key={value} type="button" onClick={() => onToggle(value)} className={`block w-full px-5 py-2.5 text-left text-[12px] leading-4 transition ${active ? "bg-[#fff1ea] font-semibold text-[#ed5a29]" : "text-[#272727] hover:bg-[#fff7f3]"}`}>{value}</button>;
        })}
      </div>
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <span className="inline-flex rounded-full border border-[#e8dfda] bg-white px-2.5 py-1 text-[10px] text-[#555]"><span className="mr-1 text-[#777]">{label}:</span>{value}</span>;
}

export default function ImmortalizedCatalogClient({ products: initialProducts }: { products: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [loading, setLoading] = useState((initialProducts || []).length === 0);
  const [loadError, setLoadError] = useState(false);
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [modelType, setModelType] = useState<ModelType>("Immortalized Cells");
  const [species, setSpecies] = useState<string[]>([]);
  const [systems, setSystems] = useState<string[]>([]);
  const [cellTypes, setCellTypes] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/abm/cell-model-catalog", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json() as { items?: Product[] };
        if (cancelled) return;
        const apiItems = Array.isArray(payload.items) ? payload.items : [];
        const merged = Array.from(new Map([...(initialProducts || []), ...apiItems].map((item) => [`${item.modelType}:${item.sku || item.url}`, item])).values());
        setProducts(merged);
        setLoadError(false);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [initialProducts]);

  const rows = useMemo(() => products.map((product) => ({ product, facets: productFacets(product) })), [products]);
  const modelRows = useMemo(() => rows.filter(({ product }) => product.modelType === modelType), [rows, modelType]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return modelRows.filter(({ product, facets }) => {
      if (needle && !fullText(product).toLowerCase().includes(needle)) return false;
      if (!matches(facets.species, species)) return false;
      if (!matches(facets.systems, systems)) return false;
      if (!matches(facets.cellTypes, cellTypes)) return false;
      return true;
    });
  }, [modelRows, query, species, systems, cellTypes]);

  const visible = filtered.slice(0, visibleCount);
  const resetVisible = () => setVisibleCount(12);
  const clearAll = () => {
    setDraftQuery(""); setQuery(""); setModelType("Immortalized Cells");
    setSpecies([]); setSystems([]); setCellTypes([]); resetVisible();
  };
  const switchModel = (next: ModelType) => {
    setModelType(next); setSpecies([]); setSystems([]); setCellTypes([]); resetVisible();
  };

  return (
    <section id="catalog" className="mt-10">
      <div className="rounded-[20px] border border-[#ebe1dc] bg-[#fffaf7] p-6 md:p-7">
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_112px]" onSubmit={(event) => { event.preventDefault(); setQuery(draftQuery); resetVisible(); }}>
          <input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="Name, cat. no., or keyword..." className="h-11 rounded-full border border-[#efd5c8] bg-white px-4 text-[12px] outline-none focus:border-[#ef5a29]" />
          <button className="h-11 rounded-full bg-[#f15a24] text-[12px] font-bold text-white hover:bg-[#dd4c18]">Search</button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["Immortalized Cells", "Tumor Cells", "Primary Cells"] as const).map((type) => <button key={type} type="button" onClick={() => switchModel(type)} className={`rounded-full border px-4 py-2 text-[12px] font-semibold ${modelType === type ? "border-[#f15a24] bg-[#f15a24] text-white" : "border-[#efd5c8] bg-white text-neutral-800"}`}>{type}</button>)}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <FacetList label="Species" rules={SPECIES} selected={species} onToggle={(value) => { setSpecies((current) => toggle(current, value)); resetVisible(); }} />
          <FacetList label="Bio System" rules={SYSTEMS} selected={systems} onToggle={(value) => { setSystems((current) => toggle(current, value)); resetVisible(); }} />
          <FacetList label="Cell Type" rules={CELL_TYPES} selected={cellTypes} onToggle={(value) => { setCellTypes((current) => toggle(current, value)); resetVisible(); }} />
        </div>

        <div className="mt-4 flex justify-end"><button type="button" onClick={clearAll} className="min-w-[112px] rounded-full border border-[#f09a78] bg-white px-5 py-2.5 text-[11px] text-[#ee7a52] hover:bg-[#fff3ed]">Clear All</button></div>
      </div>

      <div className="mt-7 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ef5a29]">Search Result</div>

      {loading && !visible.length ? <div className="mt-4 rounded-[18px] border border-[#eee4df] bg-white px-5 py-8 text-center text-sm text-neutral-500">Loading cell lines...</div> : null}
      {!loading && loadError && !visible.length ? <div className="mt-4 rounded-[18px] border border-[#eee4df] bg-white px-5 py-8 text-center text-sm text-neutral-500">Cell-line results could not be loaded. Please refresh once.</div> : null}

      <div className="mt-4 space-y-3">
        {visible.map(({ product, facets }) => (
          <article key={`${product.modelType}:${product.sku || product.url}`} className="rounded-[18px] border border-[#eadfd9] bg-white p-4 shadow-[0_5px_15px_rgba(35,22,16,0.025)] md:p-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_94px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eee7e3] pb-3">
                  <h3 className="text-[14px] font-bold leading-5 text-[#f15a24]">{product.title}</h3>
                  <Link href={productHref(product)} prefetch={false} className="shrink-0 rounded-full bg-[#f15a24] px-4 py-2 text-[11px] font-bold text-white hover:bg-[#dc4d19]">View Product</Link>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#f0d8cc] bg-[#fffaf7] px-2.5 py-1 text-[10px]"><span className="mr-1 text-[#ef5a29]">Cat. No.:</span>{product.sku || "—"}</span>
                  <span className="rounded-full border border-[#f0d8cc] bg-[#fffaf7] px-2.5 py-1 text-[10px]"><span className="mr-1 text-[#ef5a29]">Unit:</span>{product.unit || "Inquiry"}</span>
                  <span className="rounded-full border border-[#f0d8cc] bg-[#fffaf7] px-2.5 py-1 text-[10px]"><span className="mr-1 text-[#ef5a29]">Price:</span>Inquiry</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <MetaChip label="Species" value={facets.species[0]} />
                  <MetaChip label="Bio system" value={facets.systems[0]} />
                  <MetaChip label="Cell type" value={facets.cellTypes[0]} />
                </div>
              </div>
              <div className="flex min-h-[94px] items-center justify-center rounded-[12px] border border-[#eee8e4] bg-[#fcfcfc]">
                {product.previewImage ? <img src={product.previewImage} alt="" className="h-[86px] w-[86px] object-contain p-2" loading="lazy" /> : <span className="text-[10px] text-neutral-300">No image</span>}
              </div>
            </div>
          </article>
        ))}
      </div>

      {!loading && !loadError && !filtered.length ? <div className="mt-4 rounded-[18px] border border-dashed border-neutral-300 px-5 py-10 text-center text-sm text-neutral-500">No matching cell lines found.</div> : null}
      {filtered.length > visibleCount ? <div className="mt-5 text-center"><button type="button" onClick={() => setVisibleCount((count) => count + 12)} className="rounded-full border border-[#ef5a29] bg-white px-6 py-2.5 text-[12px] font-semibold text-[#ef5a29] hover:bg-[#fff6f1]">Load More</button></div> : null}
      {filtered.length ? <div className="mt-3 text-center text-[11px] text-neutral-400">Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} results</div> : null}
    </section>
  );
}
