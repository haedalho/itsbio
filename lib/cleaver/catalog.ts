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

export type CleaverIncludedItem = {
  title: string;
  quantity?: string;
  sourceUrl?: string;
  imageUrl?: string;
};

export type CleaverVariation = {
  title: string;
  sku?: string;
  packSize?: string;
  priceText?: string;
  imageUrl?: string;
  internalHref?: string;
};

export type CleaverAccessory = {
  title: string;
  sku?: string;
  packSize?: string;
  priceText?: string;
  sourceUrl?: string;
  imageUrl?: string;
  internalHref?: string;
};

export type CleaverVideo = {
  title?: string;
  url: string;
  embedUrl?: string;
};

export type CleaverSpecificationMatrix = {
  headers: string[];
  rows: Array<{ label: string; values: string[] }>;
};

export type CleaverExtraSection = {
  title: string;
  html?: string;
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
  docs?: Array<{ title?: string; label?: string; group?: string; url?: string }>;
  cleaverSourceTitle?: string;
  cleaverAtAGlance?: string[];
  cleaverSourceSectionOrder?: string[];
  cleaverExtraSections?: CleaverExtraSection[];
  cleaverSpecificationMatrix?: CleaverSpecificationMatrix;
  cleaverIncludedItems?: CleaverIncludedItem[];
  cleaverVariations?: CleaverVariation[];
  cleaverAccessories?: CleaverAccessory[];
  cleaverVideos?: CleaverVideo[];
  cleaverSourceSectionsMigratedAt?: string;
};

export const CLEAVER_CATEGORIES = categories as CleaverCategory[];

export function slugifyCleaver(value: string) {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cleaverProductSlug(title: string, sku: string) {
  const suffix = slugifyCleaver(sku.replace(/\$/g, "-variant"));
  const base = slugifyCleaver(title).slice(0, Math.max(20, 145 - suffix.length)).replace(/-+$/g, "");
  return `${base || "cleaver-product"}-${suffix}`;
}

function isCleaverAccessory(value: string) {
  const electrophoresisAccessory = /\bcomb\b|gel tray|tray dams?|positive electrode|negative electrode|\belectrode\b|loading guides?|viewing platform|cool-pack|buffer saver block|flexi\s*caster|gel scoop|electrophoresis cable|glass plates?|bonded spacer|\bspacer\b|\bgasket\b|casting (?:stand|base|gate|accessor)|platinum wire|tank \(including electrodes\)|\blid\b/.test(value);
  const generalAccessory = /\breplacement\b|\bspares?\b|\badapt(?:er|or)\b|\bholder\b|\brack\b|\brotor\b|\bshelf\b|\bprobe\b|support rod|\bcover\b|\bplatform\b|\brotisserie\b|mesh plate|block lifter|\bliner\b|acrylic stand|imaging filter|camera filter|camera hood/.test(value);
  return electrophoresisAccessory || generalAccessory;
}

export function classifyCleaverProduct(sku: string, title: string): [string, string] {
  const value = `${sku} ${title}`.toLowerCase();
  const accessory = isCleaverAccessory(value);

  if (accessory) {
    if (/microdoc|omnidoc|gelone|gellite|gelpro|gel documentation|chemidoc|geldoc|gel imaging|transilluminator|blue light illuminator|uv illuminator|imaging filter|camera filter|camera hood/.test(value)) {
      return ["accessories", "gel-documentation-accessories"];
    }
    if (/multisub|runview|runstation|clearsight|omnipage|propage|electroblot|omniblot|miniblot|\bblotter\b|semi[ -]?dry|powerpro|nanopac|electrophores|gel tray|\bcomb\b|\belectrode\b|flexi\s*caster|gel scoop|cellas|comet|\bdgge\b|isoelectric|\bief\b|dna sequencing|^csq/.test(value)) {
      if (/\breplacement\b|\blid\b|\belectrode\b|electrophoresis cable|glass plates?|bonded spacer|\bgasket\b|tank \(including electrodes\)/.test(value)) {
        return ["accessories", "replacement-parts-spares"];
      }
      return ["accessories", "electrophoresis-accessories"];
    }
    if (/\breplacement\b|\bspares?\b/.test(value)) {
      return ["accessories", "replacement-parts-spares"];
    }
    return ["accessories", "general-laboratory-accessories"];
  }

  if (/\bstudent\b|\beducation\b|\bteaching\b|^tgt|^labset/.test(value)) {
    return ["main-products", "teaching-education"];
  }

  if (/microdoc|omnidoc|gelone|gellite|gelpro|gel documentation|chemidoc|geldoc|gel imaging|transilluminator|blue light illuminator|uv illuminator|^csl-uvt/.test(value)) {
    return ["main-products", "gel-documentation-imaging"];
  }

  if (/complete .*agarose gel kit|system package|multisub|runview|runstation|clearsight|agarose electrophoresis|horizontal electrophoresis|omnipage|propage|\bpage\s+system|vertical electrophoresis|vertical gel|omniblot|miniblot|\bblotter\b|semi[ -]?dry|electroblot|western blot|vacuum blot|power\s*supply|powerpro|nanopac|power\s*pro|cellulose acetate|haemoglobin|hemoglobin|cellas|comet\s*assay|\bdgge\b|isoelectric|\bief\b|dna sequencing|^csq/.test(value)) {
    return ["main-products", "electrophoresis-systems"];
  }

  if (/dna ladder|dna marker|protein marker|loading dye|gel stain|\brunsafe\b|sybr|ethidium|\bagarose\s*(?:powder|tablet|gel reagent)|\btbe\b|\btae\b|running buffer|transfer buffer|buffer concentrate|\breagent\b|precast|lysis|gel pack|^csl-mdna|^csl-ag\d|^csl-tbep/.test(value)) {
    return ["main-products", "electrophoresis-reagents"];
  }

  return ["main-products", "general-laboratory-equipment"];
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
  return match.root.slug === match.current.slug ? [match.root.title] : [match.root.title, match.current.title];
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
  const normalized = decodeURIComponent(value).normalize("NFKC").trim().toLowerCase();
  return CLEAVER_INVENTORY.find((product) => product.slug.toLowerCase() === normalized || product.sku.toLowerCase() === normalized);
}

export function searchLocalCleaverProducts(query: string) {
  const normalized = query.normalize("NFKC").trim().toLowerCase();
  if (!normalized) return [];
  return CLEAVER_INVENTORY.filter((product) => product.sku.toLowerCase().includes(normalized) || product.title.toLowerCase().includes(normalized));
}

export function cleaverDisplayTitle(product: Pick<CleaverProduct, "title" | "cleaverSourceTitle">) {
  return product.cleaverSourceTitle?.trim() || product.title;
}
