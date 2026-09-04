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

const MINI_WORKS_WITH = [
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
];

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
  "CSL-MDOCEB": {
    overviewHtml: "",
    cleaverAtAGlance: [],
    specsHtml: "",
    specRows: [],
    docs: [],
    cleaverIncludedItems: [],
    cleaverVariations: [],
    cleaverAccessories: [],
    cleaverWorksWith: [],
    cleaverVideos: [],
  },
  "CSL-MDOCSBRG": {
    overviewHtml: "",
    cleaverAtAGlance: [],
    specsHtml: "",
    specRows: [],
    docs: [],
    cleaverIncludedItems: [],
    cleaverVariations: [],
    cleaverAccessories: [],
    cleaverWorksWith: [],
    cleaverVideos: [],
  },
};

const VERIFIED_PRODUCT_OVERRIDES: Record<string, Partial<CleaverProduct>> = {
  "MSO-1-12/22DS": {
    cleaverAtAGlance: [
      "Molded, 1 mm thick double-sided comb.",
      "12/22 well.",
      "For MSMINIONE Large Tray.",
    ],
    overviewHtml: "<p>Comb 12/22, 1mm thick DS</p>",
    specRows: [
      { label: "COMPATIBLE ELECTROPHORESIS SYSTEM", value: "multiSUM MINI ONE" },
      { label: "WELL NUMBER", value: "22/12" },
      { label: "COMB SPECS", value: "3mmx1mmx22 (30 µl) 5.6mmx1mmx12 (15 µl) Teeth width x Teeth thickness x Teeth no." },
    ],
    cleaverSourceSectionOrder: ["Overview", "Specifications", "Documents", "Works With"],
    cleaverIncludedItems: [],
    cleaverVariations: [],
    cleaverAccessories: [],
    cleaverWorksWith: [
      {
        title: "multiSUB MINI ONE, All in One Horizontal Electrophoresis System",
        sku: "MSMINIONE",
        packSize: "1 / Each",
        sourceUrl: "https://www.thistlescientific.com/product/multisub-mini-one-all-in-one-horizontal-electrophoresis-system/",
        internalHref: "/products/cleaver/item/multisub-mini-one-all-in-one-horizontal-electrophoresis-system",
      },
    ],
    cleaverVideos: [],
  },
  "CSL-MDOCWLB": {
    cleaverAtAGlance: [
      "White light box for Microdoc or standalone 240V",
      "Dimmable LED lights",
      "Energy Efficient",
      "2m USB cable",
    ],
    overviewHtml: "<p>A white light tablet is used in gel documentation systems to visualize protein gels that have been stained with visible dyes such as Coomassie blue or silver stain. These tablets provide a uniform light source that illuminates the gel from below, allowing for clear visualization and documentation of the stained proteins. This is particularly useful in laboratories for analysing and recording protein samples separated by electrophoresis.</p>",
    specRows: [
      { label: "Power", value: "Main UK/EU Plug with USB Slot" },
      { label: "Overall Dimensions", value: "36 x 27 x 8mm" },
      { label: "Working light area", value: "32 x 23cm" },
      { label: "Weight", value: "0.9Kg" },
    ],
    cleaverSourceSectionOrder: ["Overview", "Specifications"],
    docs: [],
    cleaverVideos: [],
    cleaverWorksWith: [],
  },
  "MS7-UV7": {
    cleaverAtAGlance: [
      "7 x 7cm agarose gel electrophoresis casting tray.",
      "Designed to be transparent to ultraviolet (UV) light and is used to create and hold an agarose gel for separating DNA, RNA.",
      "For use with multiSUB Mini horizontal electrophoresis system.",
    ],
    cleaverSourceSectionOrder: ["Documents", "Works With"],
    cleaverVideos: [],
    cleaverWorksWith: MINI_WORKS_WITH.map((item) => ({ ...item })),
  },
  "MS7-UV10": {
    cleaverAtAGlance: [
      "7 x 10cm agarose gel electrophoresis casting tray.",
      "Designed to be transparent to ultraviolet (UV) light and is used to create and hold an agarose gel for separating DNA, RNA.",
      "For use with multiSUB Mini horizontal electrophoresis system.",
    ],
    cleaverSourceSectionOrder: ["Documents", "Works With"],
    cleaverVideos: [],
    cleaverWorksWith: MINI_WORKS_WITH.map((item) => ({ ...item })),
  },
  "MS7-LG": {
    cleaverAtAGlance: [
      "To assist in the proper loading of DNA samples during electrophoresis by enhancing the visibility of the wells.",
      "Ensure consistency, accuracy, and efficiency in the loading process, leading to better experimental outcomes and avoid errors, such as cross-contamination.",
      "For use with MultiSUB Mini gel tank.",
    ],
    cleaverSourceSectionOrder: ["Documents", "Works With"],
    cleaverVideos: [],
    cleaverWorksWith: MINI_WORKS_WITH.map((item) => ({ ...item })),
  },
  "MS7-WP": {
    cleaverAtAGlance: [
      "To view nucleic acids bands.",
      "For use with MultiSUB Mini gel tank.",
    ],
    cleaverSourceSectionOrder: ["Documents", "Works With"],
    cleaverVideos: [],
    cleaverWorksWith: MINI_WORKS_WITH.map((item) => ({ ...item })),
  },
  "MS7-UVS": {
    cleaverAtAGlance: [
      "Made of UV-transmitting Acrylic.",
      "Gels can be observed directly on a UV transilluminator without needing to be removed from the scoop, which minimizes the risk of damaging them during handling.",
    ],
    overviewHtml: "<p>UV Scoops are designed to eliminate manual handling of agarose and polyacrylamide gels. This scoop has a 7cm width and 12.5cm length, perfect for use with multiSUB mini gels.</p>",
    cleaverSourceSectionOrder: ["Overview", "Documents", "Works With"],
    cleaverVideos: [],
    cleaverWorksWith: MINI_WORKS_WITH.map((item) => ({ ...item })),
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
