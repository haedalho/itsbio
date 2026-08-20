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

type FacetRule = readonly [label: string, rule: RegExp];

type Facets = {
  species: string[];
  systems: string[];
  cellTypes: string[];
};

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
  ["Female Reproductive System", /female reproductive|ovary|ovarian|uter|cervix|placenta/i],
  ["Musculoskeletal System", /musculoskeletal|skeletal|muscle|bone|cartilage|oste|chondro/i],
  ["Nervous System", /nervous|neural|neuron|brain|glia|astro|microglia/i],
  ["Respiratory System", /respiratory|lung|airway|bronch|pulmonary/i],
  ["Digestive System", /digestive|hepatic|liver|stomach|intestinal|colon|pancrea/i],
  ["Cardiovascular System", /cardio|vascular|heart|endothelial|smooth muscle/i],
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
    ...(product.listingFilters || []).flatMap((f) => [f.title, ...(f.path || [])]),
  ]
    .filter(Boolean)
    .join(" ");
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

function toggleValue(current: string[], value: string) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function matchesSelected(productValues: string[], selected: string[]) {
  return selected.length === 0 || selected.some((value) => productValues.includes(value));
}

function FacetList({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ed5a2b]">{label}</div>
      <div className="h-[200px] overflow-y-auto rounded-[15px] border border-[#ece4df] bg-white px-1 py-2 shadow-[0_5px_14px_rgba(35,20,12,0.025)]">
        {values.map((value) => {
          const active = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onToggle(value)}
              className={`block w-full rounded-[9px] px-4 py-2.5 text-left text-[12px] leading-4 transition ${
                active
                  ? "bg-[#fff0e9] font-semibold text-[#e65321]"
                  : "text-[#303030] hover:bg-[#fff8f4] hover:text-[#e65321]"
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function chip(label: string, value: string) {
  return (
    <span className="inline-flex rounded-full border border-[#eadfd9] bg-white px-2.5 py-1 text-[10px] leading-4 text-neutral-600">
      <span className="mr-1 text-neutral-400">{label}:</span>{value}
    </span>
  );
}

export default function ImmortalizedCatalogClient({ products }: { products: Product[] }) {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [modelType, setModelType] = useState<Product["modelType"]>("Immortalized Cells");
  const [species, setSpecies] = useState<string[]>([]);
  const [systems, setSystems] = useState<string[]>([]);
  const [cellTypes, setCellTypes] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);

  const withFacets = useMemo(
    () => products.map((product) => ({ product, facets: productFacets(product) })),
    [products],
  );

  const modelProducts = useMemo(
    () => withFacets.filter(({ product }) => product.modelType === modelType),
    [withFacets, modelType],
  );

  const speciesOptions = useMemo(
    () => SPECIES.map(([label]) => label).filter((label) => modelProducts.some(({ facets }) => facets.species.includes(label))),
    [modelProducts],
  );
  const systemOptions = useMemo(
    () => SYSTEMS.map(([label]) => label).filter((label) => modelProducts.some(({ facets }) => facets.systems.includes(label))),
    [modelProducts],
  );
  const cellTypeOptions = useMemo(
    () => CELL_TYPES.map(([label]) => label).filter((label) => modelProducts.some(({ facets }) => facets.cellTypes.includes(label))),
    [modelProducts],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return modelProducts.filter(({ product, facets }) => {
      if (needle && !fullText(product).toLowerCase().includes(needle)) return false;
      if (!matchesSelected(facets.species, species)) return false;
      if (!matchesSelected(facets.systems, systems)) return false;
      if (!matchesSelected(facets.cellTypes, cellTypes)) return false;
      return true;
    });
  }, [modelProducts, query, species, systems, cellTypes]);

  const visible = filtered.slice(0, visibleCount);

  const resetResults = () => setVisibleCount(12);
  const clearAll = () => {
    setDraftQuery("");
    setQuery("");
    setModelType("Immortalized Cells");
    setSpecies([]);
    setSystems([]);
    setCellTypes([]);
    resetResults();
  };

  const switchModel = (next: Product["modelType"]) => {
    setModelType(next);
    setSpecies([]);
    setSystems([]);
    setCellTypes([]);
    resetResults();
  };

  return (
    <section id="catalog" className="mt-10">
      <div className="rounded-[22px] border border-[#eadfd9] bg-[#fffaf7] p-6 md:p-7">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#f15a29]">Find your cell line</div>
        <h2 className="mt-1 text-[25px] font-semibold tracking-[-0.025em] text-[#3f4953]">Search and filter cell models</h2>
        <p className="mt-2 text-[13px] leading-6 text-neutral-600">Search by name or catalogue number, then narrow the results with the same model, species, biological-system, and cell-type flow used by abm.</p>

        <form
          className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_112px]"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(draftQuery);
            resetResults();
          }}
        >
          <input
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Name, cat. no., or keyword..."
            className="h-11 min-w-0 rounded-full border border-[#efd7cb] bg-white px-4 text-[12px] outline-none transition focus:border-[#f15a29]"
          />
          <button type="submit" className="h-11 rounded-full bg-[#f15a29] px-5 text-[12px] font-bold text-white transition hover:bg-[#db4e1d]">Search</button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["Immortalized Cells", "Tumor Cells", "Primary Cells"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => switchModel(type)}
              className={`rounded-full border px-4 py-2 text-[12px] font-semibold transition ${
                modelType === type
                  ? "border-[#f15a29] bg-[#f15a29] text-white"
                  : "border-[#efd7cb] bg-white text-neutral-700 hover:border-[#f15a29] hover:text-[#f15a29]"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <FacetList
            label="Species"
            values={speciesOptions}
            selected={species}
            onToggle={(value) => { setSpecies((current) => toggleValue(current, value)); resetResults(); }}
          />
          <FacetList
            label="Bio System"
            values={systemOptions}
            selected={systems}
            onToggle={(value) => { setSystems((current) => toggleValue(current, value)); resetResults(); }}
          />
          <FacetList
            label="Cell Type"
            values={cellTypeOptions}
            selected={cellTypes}
            onToggle={(value) => { setCellTypes((current) => toggleValue(current, value)); resetResults(); }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-neutral-500">
            {species.length + systems.length + cellTypes.length > 0 ? (
              <span><strong className="font-semibold text-neutral-800">{species.length + systems.length + cellTypes.length}</strong> filters selected</span>
            ) : <span>Select one or more filters to narrow the collection.</span>}
          </div>
          <button type="button" onClick={clearAll} className="min-w-[110px] rounded-full border border-[#f09a78] bg-white px-5 py-2.5 text-[11px] font-medium text-[#ed774e] transition hover:bg-[#fff2ec]">Clear All</button>
        </div>
      </div>

      <div className="mt-7 text-[10px] font-bold uppercase tracking-[0.13em] text-[#ef5a2a]">Search Result</div>
      <div className="mt-4 space-y-3">
        {visible.length ? visible.map(({ product, facets }) => {
          const speciesLabel = facets.species[0];
          const systemLabel = facets.systems[0];
          const cellTypeLabel = facets.cellTypes[0];
          return (
            <article key={`${product.modelType}-${product.sku || product.url}`} className="rounded-[17px] border border-[#eadfd9] bg-white px-4 py-4 shadow-[0_5px_16px_rgba(30,18,10,0.025)] sm:px-5">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_105px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-3">
                    <h3 className="min-w-0 flex-1 text-[14px] font-semibold leading-5 text-[#ef5a2a]">{product.title}</h3>
                    <Link href={productHref(product)} prefetch={false} className="shrink-0 rounded-full bg-[#f15a29] px-4 py-2 text-[10px] font-bold text-white transition hover:bg-[#d94e1c]">View Product</Link>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-[#f0d6ca] bg-[#fff8f4] px-2.5 py-1 text-[10px] text-neutral-700"><strong className="mr-1 font-semibold text-[#ef5a2a]">Cat. No.:</strong>{product.sku || "—"}</span>
                    <span className="inline-flex rounded-full border border-[#f0d6ca] bg-[#fff8f4] px-2.5 py-1 text-[10px] text-neutral-700"><strong className="mr-1 font-semibold text-[#ef5a2a]">Unit:</strong>{product.unit || "—"}</span>
                    <span className="inline-flex rounded-full border border-[#f0d6ca] bg-[#fff8f4] px-2.5 py-1 text-[10px] text-neutral-700"><strong className="mr-1 font-semibold text-[#ef5a2a]">Price:</strong>Inquiry</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {speciesLabel ? chip("Species", speciesLabel) : null}
                    {systemLabel ? chip("Bio system", systemLabel) : null}
                    {cellTypeLabel ? chip("Cell type", cellTypeLabel) : null}
                  </div>
                </div>

                <div className="flex items-center justify-center rounded-[13px] border border-neutral-100 bg-[#fbfbfb] p-2">
                  {product.previewImage ? (
                    <img src={product.previewImage} alt="" className="h-[92px] w-full object-contain" loading="lazy" />
                  ) : (
                    <div className="flex h-[92px] items-center justify-center text-[10px] text-neutral-400">No image</div>
                  )}
                </div>
              </div>
            </article>
          );
        }) : (
          <div className="rounded-[17px] border border-dashed border-neutral-300 bg-white px-5 py-12 text-center text-sm text-neutral-500">No matching cell lines found.</div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
        <div className="text-[12px] text-neutral-500"><strong className="font-semibold text-neutral-800">{filtered.length.toLocaleString()}</strong> results</div>
        {visibleCount < filtered.length ? (
          <button type="button" onClick={() => setVisibleCount((count) => count + 12)} className="rounded-full border border-[#f15a29] bg-white px-5 py-2.5 text-[11px] font-semibold text-[#e65321] transition hover:bg-[#fff5ef]">Load More</button>
        ) : null}
      </div>
    </section>
  );
}
