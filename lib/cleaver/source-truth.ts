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

const VERIFIED_PRODUCT_OVERRIDES: Record<string, Partial<CleaverProduct>> = {
  "MS7-UVS": {
    cleaverAtAGlance: [
      "Made of UV-transmitting Acrylic.",
      "Gels can be observed directly on a UV transilluminator without needing to be removed from the scoop, which minimizes the risk of damaging them during handling.",
    ],
    overviewHtml: "<p>UV Scoops are designed to eliminate manual handling of agarose and polyacrylamide gels. This scoop has a 7cm width and 12.5cm length, perfect for use with multiSUB mini gels.</p>",
    cleaverVideos: [],
    cleaverWorksWith: [
      {
        title: "multiSUB Mini DUO with mini runVIEW gel viewer",
        sku: "CSL-RVMSMINI-S",
        packSize: "1 / Each",
        sourceUrl: "https://www.thistlescientific.com/product/multisub-mini-duo-with-mini-runview-gel-viewer/",
        imageUrl: "https://www.thistlescientific.com/wp-content/uploads/2024/11/RUNVIEWOLD37.WEB_.jpg",
        internalHref: "/products/cleaver/item/multisub-mini-duo-with-mini-runview-gel-viewer",
      },
      {
        title: "multiSUB Mini, Mini Horizontal Electrophoresis System",
        sku: "MSMINI10",
        packSize: "1 / Each",
        sourceUrl: "https://www.thistlescientific.com/product/multisub-mini-mini-horizontal-electrophoresis-system/",
        imageUrl: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MSMINI-4.WEB_.jpg",
        internalHref: "/products/cleaver/item/multisub-mini-mini-horizontal-electrophoresis-system",
      },
    ],
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
  const verified = VERIFIED_PRODUCT_OVERRIDES[key];
  const sparseMedia = VERIFIED_SPARSE_MEDIA_PATHS.has(path);

  if (!sparse && !verified && !sparseMedia) return null;

  return {
    ...(sparse || {}),
    ...(verified || {}),
    ...(sparseMedia ? { image: "", images: [], cleaverVideos: [] } : {}),
  };
}
