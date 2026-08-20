"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
type ProductFacets = { species?: string; system?: string; cellType?: string };

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
  ["Muscle", /myocyte|myoblast|muscle/i],
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

function firstFacet(text: string, rules: readonly FacetRule[]) {
  return rules.find(([, rule]) => rule.test(text))?.[0];
}

function facetsFor(product: Product): ProductFacets {
  const text = fullText(product);
  return {
    species: firstFacet(text, SPECIES),
    system: firstFacet(text, SYSTEMS),
    cellType: firstFacet(text, CELL_TYPES),
  };
}

function productHref(product: Product) {
  return `/products/abm/staged/product/${encodeURIComponent(product.sku || product.url)}`;
}

function FacetList({
  label,
  rules,
  value,
  onChange,
}: {
  label: string;
  rules: readonly FacetRule[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#ef592a]">{label}</div>
      <div className="h-[200px] overflow-y-auto rounded-[15px] border border-[#eee5df] bg-white py-2 shadow-[0_5px_18px_rgba(30,18,10,0.035)]">
        {rules.map(([option]) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(active ? "" : option)}
              className={`block w-full px-5 py-[9px] text-left text-[12px] leading-[1.35] transition ${
                active ? "bg-[#fff0e8] font-semibold text-[#e85320]" : "text-[#282828] hover:bg-[#fff8f4]"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <span className="inline-flex rounded-full border border-[#e7e2df] bg-white px-2.5 py-1 text-[10px] leading-4 text-[#585858]">
      <span className="mr-1 text-[#777]">{label}:</span>{value}
    </span>
  );
}

export default function ImmortalizedCatalogClient({ products }: { products: Product[] }) {
  const [liveProducts, setLiveProducts] = useState<Product[]>(products);
  const [loading, setLoading] = useState(products.length === 0);
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [modelType, setModelType] = useState<ModelType>("Immortalized Cells");
  const [species, setSpecies] = useState("");
  const [system, setSystem] = useState("");
  const [cellType, setCellType] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/abm/cell-model-catalog", { cache: "force-cache" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: { items?: Product[] }) => {
        if (cancelled) return;
        if (Array.isArray(payload.items) && payload.items.length) setLiveProducts(payload.items);
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const withFacets = useMemo(
    () => liveProducts.map((product) => ({ product, facets: facetsFor(product) })),
    [liveProducts],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return withFacets.filter(({ product, facets }) => {
      if (product.modelType !== modelType) return false;
      if (needle && !fullText(product).toLowerCase().includes(needle)) return false;
      if (species && facets.species !== species) return false;
      if (system && facets.system !== system) return false;
      if (cellType && facets.cellType !== cellType) return false;
      return true;
    });
  }, [withFacets, modelType, query, species, system, cellType]);

  const visible = filtered.slice(0, visibleCount);
  const resetResults = () => setVisibleCount(12);

  const switchModel = (next: ModelType) => {
    setModelType(next);
    setSpecies("");
    setSystem("");
    setCellType("");
    resetResults();
  };

  const clearAll = () => {
    setDraftQuery("");
    setQuery("");
    setModelType("Immortalized Cells");
    setSpecies("");
    setSystem("");
    setCellType("");
    resetResults();
  };

  return (
    <section id="catalog" className="mt-9">
      <div className="rounded-[20px] border border-[#eee3dd] bg-[#fdfbf9] px-6 py-6 md:px-7 md:py-7">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#ef592a]">Find your cell line</div>
        <h2 className="mt-1 text-[23px] font-semibold tracking-[-0.025em] text-[#3e4750]">Search and filter immortalized cell lines</h2>
        <p className="mt-2 text-[12px] leading-5 text-[#666]">Browse by keyword, species, bio system, or cell type.</p>

        <form
          className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_112px]"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(draftQuery.trim());
            resetResults();
          }}
        >
          <input
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Name, cat. no., or keyword..."
            className="h-10 min-w-0 rounded-full border border-[#efd6ca] bg-white px-4 text-[12px] outline-none focus:border-[#f15a29]"
          />
          <button type="submit" className="h-10 rounded-full bg-[#f15a24] text-[11px] font-bold text-white transition hover:bg-[#d94e1c]">Search</button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["Immortalized Cells", "Tumor Cells", "Primary Cells"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => switchModel(type)}
              className={`rounded-full border px-4 py-2 text-[11px] font-semibold transition ${
                modelType === type
                  ? "border-[#f15a24] bg-[#f15a24] text-white"
                  : "border-[#efd6ca] bg-white text-[#333] hover:border-[#f15a24]"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <FacetList label="Species" rules={SPECIES} value={species} onChange={(next) => { setSpecies(next); resetResults(); }} />
          <FacetList label="Bio System" rules={SYSTEMS} value={system} onChange={(next) => { setSystem(next); resetResults(); }} />
          <FacetList label="Cell Type" rules={CELL_TYPES} value={cellType} onChange={(next) => { setCellType(next); resetResults(); }} />
        </div>

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={clearAll} className="min-w-[112px] rounded-full border border-[#f39a78] bg-white px-5 py-2.5 text-[11px] font-medium text-[#ee7b52] hover:bg-[#fff5f0]">Clear All</button>
        </div>
      </div>

      <div className="mt-7 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ef592a]">Search Result</div>

      <div className="mt-4 space-y-3">
        {loading && visible.length === 0 ? (
          <div className="rounded-[18px] border border-[#eee3dd] bg-white px-5 py-10 text-center text-[12px] text-neutral-500">Loading cell lines…</div>
        ) : visible.length ? (
          visible.map(({ product, facets }) => (
            <article key={`${product.modelType}-${product.sku || product.url}`} className="rounded-[18px] border border-[#eaded8] bg-white px-4 py-4 shadow-[0_4px_14px_rgba(30,18,10,0.02)] md:px-5">
              <div className="flex items-start justify-between gap-4 border-b border-[#eee8e4] pb-3">
                <Link href={productHref(product)} prefetch={false} className="min-w-0 text-[14px] font-semibold leading-5 text-[#f15a24] hover:underline">
                  {product.title}
                </Link>
                <Link href={productHref(product)} prefetch={false} className="shrink-0 rounded-full bg-[#f15a24] px-4 py-2 text-[10px] font-bold text-white hover:bg-[#da4d1b]">View Product</Link>
              </div>

              <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_96px] md:items-start">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <MetaPill label="Cat. No." value={product.sku || "—"} />
                    <MetaPill label="Unit" value={product.unit || "—"} />
                    <MetaPill label="Price" value="Inquiry" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <MetaPill label="Species" value={facets.species} />
                    <MetaPill label="Bio system" value={facets.system} />
                    <MetaPill label="Cell type" value={facets.cellType} />
                  </div>
                </div>

                <div className="flex h-[96px] items-center justify-center overflow-hidden rounded-[12px] border border-[#eee8e4] bg-[#fbfbfb]">
                  {product.previewImage ? (
                    <img src={product.previewImage} alt="" loading="lazy" className="h-full w-full object-contain p-2" />
                  ) : (
                    <span className="text-[9px] uppercase tracking-[0.08em] text-neutral-300">No image</span>
                  )}
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[18px] border border-[#eee3dd] bg-white px-5 py-10 text-center text-[12px] text-neutral-500">No matching cell lines found.</div>
        )}
      </div>

      {visibleCount < filtered.length ? (
        <div className="mt-5 text-center">
          <button type="button" onClick={() => setVisibleCount((count) => count + 12)} className="rounded-full border border-[#f15a24] bg-white px-6 py-2.5 text-[11px] font-semibold text-[#f15a24] hover:bg-[#fff5f0]">Load More</button>
        </div>
      ) : null}
    </section>
  );
}
