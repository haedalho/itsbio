import type { CleaverProduct } from "@/lib/cleaver/catalog";

function sourceProductPath(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.pathname.toLowerCase().replace(/\/+$/, "");
  } catch {
    return String(value || "").trim().toLowerCase().replace(/^https?:\/\/[^/]+/i, "").replace(/\/+$/, "");
  }
}

const VERIFIED_SPARSE_MEDIA_PATHS = new Set([
  "/product/replacement-transilluminator-cover",
  "/product/replacement-transilluminator-filter-21cm-254nm",
  "/product/replacement-transilluminator-filter-21cm-312nm",
  "/product/replacement-transilluminator-filter-21cm-365nm",
  "/product/replacement-transilluminator-filter-26cm-254nm",
  "/product/replacement-transilluminator-filter-26cm-312nm",
  "/product/replacement-transilluminator-filter-26cm-365nm",
]);

const SPARSE_PRODUCT_OVERRIDES: Record<string, Partial<CleaverProduct>> = {
  "OMNIDOC-F1": {
    image: "",
    images: [],
    overviewHtml: "",
    cleaverAtAGlance: [],
    specRows: [],
    docs: [],
    cleaverWorksWith: [],
    cleaverVideos: [],
  },
};

/**
 * Product-level corrections backed by the exact Thistle source page audit.
 * Empty arrays/strings are intentional: they remove legacy/inferred content
 * when the manufacturer page does not expose that section.
 */
export function getCleaverSourceTruthOverride(sku?: string, sourceUrl?: string): Partial<CleaverProduct> | null {
  const key = String(sku || "").normalize("NFKC").trim().toUpperCase();
  const path = sourceProductPath(sourceUrl);
  const sparse = SPARSE_PRODUCT_OVERRIDES[key];
  const sparseMedia = VERIFIED_SPARSE_MEDIA_PATHS.has(path);

  if (!sparse && !sparseMedia) return null;

  return {
    ...(sparse || {}),
    ...(sparseMedia ? { image: "", images: [], cleaverVideos: [] } : {}),
  };
}
