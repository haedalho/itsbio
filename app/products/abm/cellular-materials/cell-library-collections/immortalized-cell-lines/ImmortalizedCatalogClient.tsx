"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type ModelType = "Immortalized Cells" | "Tumor Cells" | "Primary Cells";
type FacetRule = readonly [label: string, matcher: RegExp];

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
  species?: string[];
  bioSystems?: string[];
  cellTypes?: string[];
};

type Facets = {
  species: string[];
  bioSystems: string[];
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
  ["Chicken (Galline)", /avian|chicken|\bbird\b/i],
  ["Horse (Equine)", /equine|\bhorse\b/i],
  ["Sheep (Ovine)", /ovine|\bsheep\b/i],
  ["Fish", /zebrafish|\bfish\b/i],
  ["Deer (Cervidae)", /deer|cervidae/i],
  ["Duck (Anas)", /duck|anas/i],
  ["Goat (Capra)", /goat|capra/i],
  ["Golden Hamster (M. auratus)", /hamster|auratus/i],
  ["Insect (Insecta)", /insect/i],
  ["Lizard (Dactyloidae)", /lizard|dactyloidae/i],
  ["Mink (N. vison)", /mink|vison/i],
];

const SYSTEMS: readonly FacetRule[] = [
  ["Lymphatic System", /lymph|lymphatic/i],
  ["Male Reproductive System", /male reproductive|testis|testicular|testes|prostate|seminal/i],
  ["Female Reproductive System", /female reproductive|ovary|ovarian|uter|cervix|placenta/i],
  ["Musculoskeletal System", /musculoskeletal|skeletal|muscle|bone|cartilage|oste|chondro/i],
  ["Nervous System", /nervous|neural|neuron|brain|glia|astro|microglia/i],
  ["Respiratory System", /respiratory|lung|airway|bronch|pulmonary/i],
  ["Digestive System", /digestive|hepatic|liver|stomach|intestinal|colon|oral|mouth|pancrea/i],
  ["Cardiovascular System", /cardio|vascular|heart|artery|endothelial|smooth muscle/i],
  ["Embryonic System", /embryo|embryonic|umbilical|cord/i],
  ["Integumentary System", /skin|dermal|keratin|melanocyte|hair|follicle/i],
  ["Immune System", /immune|blood|mast|t cell|b cell|myeloid|hematopo|promyelocyte/i],
  ["Excretory System", /excretory|urinary|kidney|renal|bladder/i],
  ["Endocrine System", /endocrine|thyroid|adrenal|pituitary/i],
  ["Auditory System", /auditory|\bear\b/i],
  ["Visual System", /retina|retinal|cornea|ocular|\beye\b/i],
];

const CELL_TYPES: readonly FacetRule[] = [
  ["Skin", /skin|keratinocyte/i],
  ["Liver", /hepatocyte|hepatic|\bliver\b/i],
  ["Bone Marrow", /bone marrow|promyelocyte/i],
  ["Cartilage", /cartilage|chondrocyte|chondroblast/i],
  ["Skeletal Muscle", /skeletal muscle|myoblast|myocyte/i],
  ["Smooth Muscle", /smooth muscle/i],
  ["Umbilical Cord", /umbilical cord|umbilical artery|umbilical vein/i],
  ["Mouth/Oral", /mouth|oral|lingual|periodontal/i],
  ["Cervix", /cervix|cervical/i],
  ["Colon", /\bcolon\b|colonic/i],
  ["Connective Tissue", /connective|fibroblast/i],
  ["Cord Blood", /cord blood/i],
  ["Ear", /\bear\b|auditory/i],
  ["Kidney", /kidney|renal/i],
  ["Lung", /\blung\b|pulmonary|bronch|airway/i],
  ["Brain", /\bbrain\b|cerebral/i],
  ["Neuron", /neuron|neuronal|neural/i],
  ["Astrocyte", /astrocyte|astroglia/i],
  ["Microglia", /microglia/i],
  ["Endothelial", /endothelial/i],
  ["Epithelial", /epithelial|epithelium/i],
  ["Fibroblast", /fibroblast/i],
  ["Melanocyte", /melanocyte/i],
  ["Mast Cell", /mast cell/i],
  ["T Cell", /t cell|t-cell/i],
  ["B Cell", /b cell|b-cell/i],
  ["Macrophage", /macrophage/i],
  ["Stem / Progenitor", /stem|progenitor/i],
  ["Embryo", /embryo|embryonic/i],
  ["Adipose", /adipocyte|adipose/i],
  ["Pancreas", /pancrea/i],
  ["Prostate", /prostate/i],
  ["Ovary", /ovary|ovarian/i],
  ["Placenta", /placenta/i],
  ["Retina / Eye", /retina|retinal|ocular|cornea|\beye\b/i],
  ["Testes", /testis|testicular|testes/i],
];

function fullText(product: Product) {
  return [
    product.title,
    product.sku,
    product.searchCategory,
    product.filterTitle,
    ...(product.filterPath || []),
    ...(product.listingFilters || []).flatMap((filter) => [filter.title, ...(filter.path || [])]),
  ]
    .filter(Boolean)
    .join(" ");
}

function fallbackLabels(product: Product, rules: readonly FacetRule[]) {
  const text = fullText(product);
  return rules.filter(([, matcher]) => matcher.test(text)).map(([label]) => label);
}

function facetsFor(product: Product): Facets {
  return {
    species: product.species?.length ? product.species : fallbackLabels(product, SPECIES),
    bioSystems: product.bioSystems?.length ? product.bioSystems : fallbackLabels(product, SYSTEMS),
    cellTypes: product.cellTypes?.length ? product.cellTypes : fallbackLabels(product, CELL_TYPES),
  };
}

function productHref(product: Product) {
  return `/products/abm/staged/product/${encodeURIComponent(product.sku || product.url)}`;
}

function FacetList({
  label,
  rules,
  active,
  onSelect,
}: {
  label: string;
  rules: readonly FacetRule[];
  active: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#ef5a29]">{label}</div>
      <div className="h-[198px] overflow-y-auto rounded-[15px] border border-[#eee6e1] bg-white py-2 shadow-[0_4px_14px_rgba(44,28,18,0.025)]">
        {rules.map(([value]) => {
          const selected = active === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(selected ? "" : value)}
              className={`block w-full px-5 py-2.5 text-left text-[12px] leading-4 transition ${
                selected
                  ? "bg-[#fff1ea] font-bold text-[#ed5a29]"
                  : "text-[#272727] hover:bg-[#fff7f3] hover:text-[#ed5a29]"
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

function MetaChip({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <span className="inline-flex rounded-full border border-[#e8dfda] bg-white px-2.5 py-1 text-[10px] text-[#555]">
      <span className="mr-1 text-[#777]">{label}:</span>
      {value}
    </span>
  );
}

export default function ImmortalizedCatalogClient({
  products: initialProducts,
  initialTotal,
  initialModelType = "Immortalized Cells",
}: {
  products: Product[];
  initialTotal: number;
  initialModelType?: ModelType;
}) {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [modelType, setModelType] = useState<ModelType>(initialModelType);
  const [species, setSpecies] = useState("");
  const [bioSystem, setBioSystem] = useState("");
  const [cellType, setCellType] = useState("");
  const [products, setProducts] = useState(initialProducts);
  const [total, setTotal] = useState(initialTotal);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const initialRequest = useRef(true);

  useEffect(() => {
    if (initialRequest.current) {
      initialRequest.current = false;
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ modelType, offset: String(offset), limit: "12" });
    if (query) params.set("q", query);
    if (species) params.set("species", species);
    if (bioSystem) params.set("bioSystem", bioSystem);
    if (cellType) params.set("cellType", cellType);

    fetch(`/api/abm/cell-model-catalog?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Catalog request failed");
        return response.json() as Promise<{ items?: Product[]; total?: number }>;
      })
      .then((payload) => {
        const nextItems = Array.isArray(payload.items) ? payload.items : [];
        setProducts((current) => (offset > 0 ? [...current, ...nextItems] : nextItems));
        setTotal(Number(payload.total) || 0);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError("The catalog could not be updated. Please try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [modelType, query, species, bioSystem, cellType, offset]);

  const rows = useMemo(
    () => products.map((product) => ({ product, facets: facetsFor(product) })),
    [products],
  );

  const resetResults = () => setOffset(0);
  const startRequest = () => {
    setLoading(true);
    setLoadError("");
  };

  const clearAll = () => {
    if (draftQuery || query || modelType !== initialModelType || species || bioSystem || cellType || offset) startRequest();
    setDraftQuery("");
    setQuery("");
    setModelType(initialModelType);
    setSpecies("");
    setBioSystem("");
    setCellType("");
    resetResults();
  };

  const switchModel = (next: ModelType) => {
    if (next !== modelType || species || bioSystem || cellType || offset) startRequest();
    setModelType(next);
    setSpecies("");
    setBioSystem("");
    setCellType("");
    resetResults();
  };

  return (
    <section id="catalog" className="mt-10">
      <div className="rounded-[20px] border border-[#ebe1dc] bg-[#fffaf7] p-6 md:p-7">
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_112px]"
          onSubmit={(event) => {
            event.preventDefault();
            if (draftQuery !== query || offset) startRequest();
            setQuery(draftQuery);
            resetResults();
          }}
        >
          <input
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Name, cat. no., or keyword..."
            className="h-11 rounded-full border border-[#efd5c8] bg-white px-4 text-[12px] outline-none focus:border-[#ef5a29]"
          />
          <button className="h-11 rounded-full bg-[#f15a24] text-[12px] font-bold text-white hover:bg-[#dd4c18]">
            Search
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["Immortalized Cells", "Tumor Cells", "Primary Cells"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => switchModel(type)}
              className={`rounded-full border px-4 py-2 text-[12px] font-semibold ${
                modelType === type
                  ? "border-[#f15a24] bg-[#f15a24] text-white"
                  : "border-[#efd5c8] bg-white text-neutral-800 hover:border-[#f15a24] hover:text-[#f15a24]"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <FacetList
            label="Species"
            rules={SPECIES}
            active={species}
            onSelect={(value) => {
              if (value !== species || offset) startRequest();
              setSpecies(value);
              resetResults();
            }}
          />
          <FacetList
            label="Bio System"
            rules={SYSTEMS}
            active={bioSystem}
            onSelect={(value) => {
              if (value !== bioSystem || offset) startRequest();
              setBioSystem(value);
              resetResults();
            }}
          />
          <FacetList
            label="Cell Type"
            rules={CELL_TYPES}
            active={cellType}
            onSelect={(value) => {
              if (value !== cellType || offset) startRequest();
              setCellType(value);
              resetResults();
            }}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={clearAll}
            className="min-w-[112px] rounded-full border border-[#f09a78] bg-white px-5 py-2.5 text-[11px] text-[#ee7a52] hover:bg-[#fff3ed]"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="mt-7 flex items-center justify-between gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#ef5a29]">Search Result</div>
        <div className="text-[11px] text-neutral-500">{total.toLocaleString()} products</div>
      </div>

      {loadError ? (
        <div className="mt-4 rounded-[18px] border border-red-200 bg-red-50 px-5 py-4 text-center text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      {!rows.length && !loading ? (
        <div className="mt-4 rounded-[18px] border border-[#eee4df] bg-white px-5 py-8 text-center text-sm text-neutral-500">
          No products match the selected filters.
        </div>
      ) : null}

      <div className="relative mt-4 min-h-[120px] space-y-3">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-start justify-center rounded-[18px] bg-white/85 pt-10 backdrop-blur-[1px]" role="status" aria-live="polite">
            <div className="flex items-center gap-3 rounded-full border border-[#f0d8cc] bg-white px-5 py-3 text-[12px] font-semibold text-[#e35422] shadow-sm">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#f2b7a0] border-t-[#e35422]" />
              Loading catalog...
            </div>
          </div>
        ) : null}
        {rows.map(({ product, facets }) => (
          <article
            key={`${product.modelType}:${product.sku || product.url}`}
            className="rounded-[18px] border border-[#eadfd9] bg-white p-4 shadow-[0_5px_15px_rgba(35,22,16,0.025)] md:p-5"
          >
            <div className={`grid gap-4 ${product.previewImage ? "md:grid-cols-[minmax(0,1fr)_94px]" : ""}`}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eee7e3] pb-3">
                  <h3 className="text-[14px] font-bold leading-5 text-[#f15a24]">{product.title}</h3>
                  <Link
                    href={productHref(product)}
                    prefetch={false}
                    className="shrink-0 rounded-full bg-[#f15a24] px-4 py-2 text-[11px] font-bold text-white hover:bg-[#dc4d19]"
                  >
                    View Product
                  </Link>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#f0d8cc] bg-[#fffaf7] px-2.5 py-1 text-[10px]">
                    <span className="mr-1 text-[#ef5a29]">Cat. No.:</span>
                    {product.sku || "—"}
                  </span>
                  <span className="rounded-full border border-[#f0d8cc] bg-[#fffaf7] px-2.5 py-1 text-[10px]">
                    <span className="mr-1 text-[#ef5a29]">Unit:</span>
                    {product.unit || "—"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <MetaChip label="Species" value={facets.species[0]} />
                  <MetaChip label="Bio system" value={facets.bioSystems[0]} />
                  <MetaChip label="Cell type" value={facets.cellTypes[0]} />
                </div>
              </div>

              {product.previewImage ? (
                <div className="flex min-h-[90px] items-center justify-center overflow-hidden rounded-[12px] border border-[#eee9e6] bg-[#fbfbfb]">
                  <Image
                    src={product.previewImage}
                    alt=""
                    width={86}
                    height={86}
                    className="h-[86px] w-full object-contain p-2"
                  />
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {products.length < total ? (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              startRequest();
              setOffset(products.length);
            }}
            disabled={loading}
            className="rounded-full border border-[#f15a24] bg-white px-6 py-2.5 text-[12px] font-semibold text-[#f15a24] hover:bg-[#fff6f1]"
          >
            Load More
          </button>
        </div>
      ) : null}
    </section>
  );
}
