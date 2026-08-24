import categories from "@/data/cleaver-categories.json";
import inventory from "@/data/cleaver-product-catalog.json";

export const CLEAVER_BRAND_KEY = "cleaver";
export const CLEAVER_BRAND_NAME = "Cleaver Scientific";
export const CLEAVER_PAGE_SIZE = 24;

export type CleaverCategory = {
  slug: string;
  title: string;
  description: string;
  sourceUrl: string;
  children: Array<{ slug: string; title: string }>;
};

export type CleaverProduct = {
  _id: string;
  title: string;
  sku: string;
  slug: string;
  order: number;
  summary?: string;
  sourceUrl?: string;
  categoryPath: string[];
  categoryPathTitles: string[];
  image?: string;
  images?: string[];
  overviewHtml?: string;
  specsHtml?: string;
  documentsHtml?: string;
  highlights?: string[];
  specRows?: Array<{ label: string; value: string }>;
  docs?: Array<{ title?: string; label?: string; url?: string }>;
  cleaverContent?: {
    sourceUrl?: string;
    familyId?: string;
    videos?: Array<{ title: string; url: string; embedUrl: string }>;
    included?: Array<{
      sku: string;
      title: string;
      quantity?: number;
      href?: string;
    }>;
    variants?: Array<{ sku: string; title: string; href: string }>;
    accessories?: Array<{ sku: string; title: string; href: string }>;
  };
};

export const CLEAVER_CATEGORIES = categories as CleaverCategory[];

export function slugifyCleaver(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cleaverProductSlug(title: string, sku: string) {
  const suffix = slugifyCleaver(sku.replace(/\$/g, "-variant"));
  const base = slugifyCleaver(title)
    .slice(0, Math.max(20, 145 - suffix.length))
    .replace(/-+$/g, "");
  return `${base || "cleaver-product"}-${suffix}`;
}

export function classifyCleaverProduct(
  sku: string,
  title: string,
): [string, string] {
  const value = `${sku} ${title}`.toLowerCase();

  if (/\bstudent\b|\beducation\b|\bteaching\b|^tgt|^labset/.test(value)) {
    return [
      "teaching-and-education",
      /student|^tgt/.test(value)
        ? "student-electrophoresis-systems"
        : "teaching-kits-and-accessories",
    ];
  }
  if (
    /^csr-|\bbeta\s+(?:radiation\s+)?shield|\bgamma\s+(?:radiation\s+)?shield|radiation shield|pipette shield/.test(
      value,
    )
  ) {
    return ["general-laboratory-products", "radiation-protection"];
  }
  if (
    /glove\s*box|uv\s*(?:sterili[sz]ation\s*)?cabinet|pcr\s*(?:cabinet|hood|chamber)|^csl-gb|^csl-uvcab/.test(
      value,
    )
  ) {
    return ["general-laboratory-products", "glove-boxes-and-pcr-cabinets"];
  }
  if (
    /safe\s*tray|spill\s*tray|biohazard|\btray\s*liner|^t[oy]\d/.test(value)
  ) {
    return ["general-laboratory-products", "laboratory-safety-and-accessories"];
  }
  if (
    /omnipette|ezeepette|epette|\bpipett(?:e|or|ing)\b|^cv(?:-|\d)|multichannel pipette/.test(
      value,
    )
  ) {
    return ["general-laboratory-products", "liquid-handling"];
  }
  if (
    /vortex|shaker|\bmixer\b|hybridisation|hybridization|\bincubat|orbital|rocker|rotator|^si-/.test(
      value,
    )
  ) {
    return ["general-laboratory-products", "mixers-shakers-and-incubators"];
  }
  if (
    /water\s*bath|\bstirring\s*bath|aqualab|water\s*still|water distill/.test(
      value,
    )
  ) {
    return ["general-laboratory-products", "water-baths-and-stills"];
  }
  if (
    /centrifuge|ezeefuge|\bph\s*meter|portable meter|conductivity meter|magnetic stirr/.test(
      value,
    )
  ) {
    return ["general-laboratory-products", "centrifuges-and-meters"];
  }
  if (
    /cellulose acetate|haemoglobin|hemoglobin|cellas|^csl-ca(?:hb)?/.test(value)
  ) {
    return ["electrophoresis-equipment", "cellulose-acetate"];
  }
  if (/comet\s*assay|^csl-com/.test(value)) {
    return ["electrophoresis-equipment", "comet-assay"];
  }
  if (/\bdgge\b|isoelectric|\bief\b|dna sequencing|^csq/.test(value)) {
    return ["electrophoresis-equipment", "dgge-and-sequencing"];
  }
  if (
    /power\s*supply|powerpro|nanopac|power\s*pro|^pp\d|^eps\d/.test(value) &&
    !/with (?:a |\d+v )?power supply|package with power supply/.test(value)
  ) {
    return ["electrophoresis-equipment", "power-supplies"];
  }
  if (
    /omniblot|miniblot|\bblotter\b|semi[ -]?dry|electroblot|western blot|vacuum blot|^sd\d/.test(
      value,
    )
  ) {
    return ["electrophoresis-equipment", "electroblotters"];
  }
  if (
    /transilluminator|blue light illuminator|uv illuminator|^csl-uvt/.test(
      value,
    )
  ) {
    return ["gel-documentation", "transilluminators"];
  }
  if (
    /microdoc|omnidoc|gelone|gellite|gelpro|gel documentation|chemidoc|geldoc|gel imaging|camera|imaging filter|^mu-/.test(
      value,
    )
  ) {
    return [
      "gel-documentation",
      /filter|camera|hood|replacement|accessor|^mu-/.test(value)
        ? "imaging-accessories"
        : "gel-documentation-systems",
    ];
  }
  if (
    /dna ladder|dna marker|protein marker|loading dye|gel stain|\brunsafe\b|sybr|ethidium|\bagarose\s*(?:powder|tablet|gel reagent)|^csl-mdna|^csl-ag\d/.test(
      value,
    )
  ) {
    return [
      "electrophoresis-reagents",
      /ladder|marker|stain|dye|runsafe|sybr|ethidium/.test(value)
        ? "dna-ladders-and-stains"
        : "agarose-and-gel-reagents",
    ];
  }
  if (
    /\btbe\b|\btae\b|running buffer|transfer buffer|buffer concentrate|^csl-tbep/.test(
      value,
    )
  ) {
    return ["electrophoresis-reagents", "buffers-and-components"];
  }
  if (
    /omnipage|propage|\bpage\s+system|vertical electrophoresis|vertical gel|glass plates?|bonded spacer|^vs\d|^cvs\d|^hpage/.test(
      value,
    )
  ) {
    return ["electrophoresis-equipment", "page-tanks"];
  }
  if (
    /multisub|runview|runstation|clearsight|agarose electrophoresis|horizontal electrophoresis|gel tray|flexicaster|^ms(?:mini|midi|choice|maxi|screen|\d)|^cs[lt]-rv/.test(
      value,
    )
  ) {
    return ["electrophoresis-equipment", "agarose-gel-tanks"];
  }
  if (
    /comb|electrode|casting|platinum wire|gel scoop|electrophoresis cable/.test(
      value,
    )
  ) {
    return ["electrophoresis-equipment", "spares-and-accessories"];
  }
  if (/reagent|agarose|buffer|precast|lysis|gel pack/.test(value)) {
    return ["electrophoresis-reagents", "agarose-and-gel-reagents"];
  }
  return ["general-laboratory-products", "laboratory-safety-and-accessories"];
}

export function cleaverCategory(path: string[]) {
  const root = CLEAVER_CATEGORIES.find((category) => category.slug === path[0]);
  if (!root) return undefined;
  if (path.length === 1) return { root, current: root };
  const child = root.children.find((category) => category.slug === path[1]);
  return child && path.length === 2 ? { root, current: child } : undefined;
}

export function cleaverCategoryTitles(path: string[]) {
  const match = cleaverCategory(path);
  if (!match) return [];
  return match.root.slug === match.current.slug
    ? [match.root.title]
    : [match.root.title, match.current.title];
}

export const CLEAVER_INVENTORY: CleaverProduct[] = inventory.map((row) => {
  const categoryPath = classifyCleaverProduct(row.sku, row.title);
  return {
    _id: `cleaver-local-${slugifyCleaver(row.sku)}`,
    sku: row.sku,
    title: row.title,
    order: row.order,
    slug: cleaverProductSlug(row.title, row.sku),
    categoryPath,
    categoryPathTitles: cleaverCategoryTitles(categoryPath),
  };
});

export function cleaverProductHref(product: Pick<CleaverProduct, "slug">) {
  return `/products/cleaver/item/${encodeURIComponent(product.slug)}`;
}

export function findLocalCleaverProduct(value: string) {
  const normalized = decodeURIComponent(value)
    .normalize("NFKC")
    .trim()
    .toLowerCase();
  return CLEAVER_INVENTORY.find(
    (product) =>
      product.slug.toLowerCase() === normalized ||
      product.sku.toLowerCase() === normalized,
  );
}

export function searchLocalCleaverProducts(query: string) {
  const normalized = query.normalize("NFKC").trim().toLowerCase();
  if (!normalized) return [];
  return CLEAVER_INVENTORY.filter(
    (product) =>
      product.sku.toLowerCase().includes(normalized) ||
      product.title.toLowerCase().includes(normalized),
  );
}
