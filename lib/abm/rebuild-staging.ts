import { PUBLIC_CATALOG_CACHE, sanityCdnClient, sanityClient } from "@/lib/sanity/sanity.client";
import { findOfficialAbmCellModelProduct } from "@/lib/abm/cell-model-data";
import { findOfficialAbmCellDetail } from "@/lib/abm/cell-detail-data";

export const ABM_REBUILD_VERSION = "2026-08-09-search-v5";

export type AbmStagedRecord = {
  kind: "product" | "service";
  sku: string;
  title: string;
  url: string;
  unit?: string;
  searchCategory?: string;
  filterTitle?: string;
  filterPath?: string[];
  listingFilters?: Array<{ id: string; title: string; path: string[] }>;
  hasDetail?: boolean;
  previewImage?: string;
  previewSummary?: string;
  listingPaths?: string[][];
  breadcrumbs?: string[];
};

export type AbmStagedLanding = {
  kind: "service";
  path: string[];
  title: string;
  sourceUrl: string;
  html: string;
  images?: string[];
  children?: Array<{ title: string; path: string[]; sourceUrl?: string; image?: string }>;
  collectedAt?: string;
};

export type AbmStagedDetail = AbmStagedRecord & {
  sourceUnavailable?: boolean;
  category?: string;
  listingPaths?: string[][];
  introHtml?: string;
  description?: string;
  overview?: string;
  storage?: string;
  materialCitation?: string;
  specificationsHtml?: string;
  datasheetHtml?: string;
  documentsHtml?: string;
  faqsHtml?: string;
  referencesHtml?: string;
  reviewsHtml?: string;
  serviceDetailsHtml?: string;
  serviceOffer?: {
    sku?: string;
    title?: string;
    unit?: string;
    fields?: Array<{ _key?: string; label?: string; value?: string }> | Record<string, string>;
  };
  breadcrumbs?: string[];
  images?: string[];
  imageCaption?: string;
  imageCreditUrl?: string;
  imageCreditLabel?: string;
  documents?: Array<{ title?: string; url?: string; href?: string; section?: string }>;
  sourceUrl?: string;
  collectedAt?: string;
  verification?: Record<string, unknown>;
};

const SPECIAL_CELL_STORAGE = "Vapor phase of liquid nitrogen, or below -130°C.";
const SPECIAL_CELL_SHIPPING = "Dry ice";
const SPECIAL_CELL_USE = "For research use only. Not for diagnostic or therapeutic use.";

function specificationTable(rows: Array<[string, string]>) {
  return `<div class="abm-products-specification"><table><tbody>${rows.map(([label, value]) =>
    `<tr><td>${label}</td><td>${value}</td></tr>`
  ).join("")}</tbody></table></div>`;
}

function referenceList(items: Array<[string, string]>) {
  return `<ul>${items.map(([label, url]) =>
    `<li><a href="${url}" target="_blank" rel="noreferrer">${label}</a></li>`
  ).join("")}</ul>`;
}

/**
 * Current ABM Expression Systems tables still expose this live product, but it
 * is absent from the search inventory used by the staged rebuild. Keep the
 * reviewed official detail here so the Cat.No. does not silently degrade to
 * plain text while the Vector Design Studio link remains available separately.
 */
const VERIFIED_EXPRESSION_SYSTEM_PRODUCTS: Record<string, AbmStagedDetail> = {
  lv022: {
    kind: "product",
    sku: "LV022",
    title: "Lenti-III-HA Expression Vector",
    url: "https://www.abmgood.com/lenti-iii-ha-expression-vector-lv022.html",
    sourceUrl: "https://www.abmgood.com/lenti-iii-ha-expression-vector-lv022.html",
    unit: "10 µg",
    category: "Lentiviral Vectors",
    searchCategory: "Expression Systems",
    filterTitle: "Lentiviral Vectors",
    filterPath: ["Genetic Materials", "Expression Systems", "Lentiviral Vectors"],
    listingPaths: [["Genetic Materials", "Expression Systems", "Lentiviral Vectors"]],
    breadcrumbs: ["Genetic Materials", "Expression Systems", "Lentiviral Vectors"],
    hasDetail: true,
    description: "The Lenti-III-HA expression vector is an improved version of our orignal Lenti-Easy HA vector, with a greater selection of subcloning sites and a different stable selection marker, Puromycin.",
    storage: "-20°C or below.",
    materialCitation: "If use of this material results in a scientific publication, please cite the material in the following manner: Applied Biological Materials Inc, Cat. No. LV022",
    specificationsHtml: specificationTable([
      ["Cat. No.", "LV022"],
      ["Name", "Lenti-III-HA Expression Vector"],
      ["Unit", "10 µg"],
      ["Description", "The Lenti-III-HA expression vector is an improved version of our orignal Lenti-Easy HA vector, with a greater selection of subcloning sites and a different stable selection marker, Puromycin."],
      ["Storage Condition", "-20°C or below."],
      ["Note", "NOT FOR RESALE without prior written consent of abm. This product is distributed for laboratory research only."],
      ["Material Citation", "If use of this material results in a scientific publication, please cite the material in the following manner: Applied Biological Materials Inc, Cat. No. LV022"],
    ]),
    documentsHtml: referenceList([
      ["Selection-Drug Killing Curve", "https://www.abmgood.com/document/Drug%20selection%20killing%20curve%20Final_111315.pdf"],
      ["Lentivirus Infection Protocol", "https://www.abmgood.com/uploads/document/a4_lenti_infection-with-spinoculation_.pdf"],
      ["Plasmid Amplification Protocol", "https://www.abmgood.com/uploads/document/Plasmid%20Amplification%20Protocol%202026.pdf"],
      ["Enhanced Lentivirus Safety Features: Replication Incompetency", "https://www.abmgood.com/uploads/document/Lentivirus%20incompetency-abm.pdf"],
      ["Suggested MOI for Common Cancer Cell Lines", "https://www.abmgood.com/uploads/document/A4%20%20%20lenti%20infection%20%20Cancer%20Cell%20Line%20Guide.pdf"],
    ]),
    images: ["/images/abm/LV022-vector-map.svg"],
    imageCaption: "Official ABM Vector Design Studio map for pLenti-III-HA (8183 bp).",
    imageCreditUrl: "https://www.abmgood.com/vds/viewer/cat/148",
    imageCreditLabel: "View official vector map",
    verification: {
      source: "official-abm-product-page",
      checkedAt: "2026-10-06",
      skuMatches: true,
      hasSpecifications: true,
      officialImagePresent: true,
      officialImageSource: "ABM Vector Design Studio",
    },
  },
};

// ABM assigns new feature colors each time its live map renders. The local
// SVGs retain reviewed product-page color snapshots and canonical geometry.
const VERIFIED_IPSC_VECTOR_MAPS: Record<string, { catId: string; label: string }> = {
  "000776A": { catId: "406", label: "pAdeno-Oct4-ECFP" },
  "000774A": { catId: "405", label: "pAdeno-Myc-EYFP" },
  "000834A": { catId: "399", label: "pAdeno-EOS-C(3)-EiP" },
  "000835A": { catId: "400", label: "pAdeno-EOS-S(4)-EiP" },
  LV028858: { catId: "316", label: "PL-SIN-EOS-C(3)-EiP" },
  LV028859: { catId: "315", label: "PL-SIN-EOS-S(4)-EiP" },
};

function applyVerifiedIpscVectorMap(detail: AbmStagedDetail) {
  const sku = String(detail.sku || "").trim().toUpperCase();
  const map = VERIFIED_IPSC_VECTOR_MAPS[sku];
  if (!map) return detail;
  const image = `/images/abm/${sku}-vector-map.svg`;
  return {
    ...detail,
    previewImage: image,
    images: [image],
    imageCaption: `Official ABM Vector Design Studio map for ${map.label}.`,
    imageCreditUrl: `https://www.abmgood.com/vds/viewer/cat/${map.catId}`,
    imageCreditLabel: "View official vector map",
    verification: {
      ...(detail.verification || {}),
      officialImagePresent: true,
      officialImageSource: "ABM Vector Design Studio",
      officialVectorMapCatId: map.catId,
      officialVectorMapCheckedAt: sku === "LV028859" ? "2026-10-06" : "2026-10-07",
    },
  };
}

function verifiedExpressionSystemProduct(key: string) {
  const normalized = decodeURIComponent(String(key || "")).trim().toLowerCase();
  return VERIFIED_EXPRESSION_SYSTEM_PRODUCTS[normalized]
    || Object.values(VERIFIED_EXPRESSION_SYSTEM_PRODUCTS).find((record) =>
      record.url.toLowerCase() === normalized || String(record.sourceUrl || "").toLowerCase() === normalized
    );
}

/**
 * ABM retired these six product-detail URLs while retaining the products in
 * its current Special Cell Line Collection tables. The reviewed records below
 * complete those otherwise table-only entries from the current ABM collection,
 * distributor records, and named cell-line repositories. Reference microscopy
 * is explicitly labelled whenever it is parental or patient-matched rather
 * than an image of the engineered ABM vial itself.
 */
const VERIFIED_SPECIAL_CELL_DETAILS: Record<string, Partial<AbmStagedDetail>> = {
  T3172: {
    title: "SIRT1 Knockout Stable RKO Cell Line",
    unit: "1x10^6 cells / 1.0 ml",
    category: "Colon Cancer Cell Lines",
    searchCategory: "General Cancer Research",
    sourceUrl: "https://www.abmgood.com/sirt1-knockout-stable-rko-cell-line.html",
    description: "A human RKO colon carcinoma cell line with stable knockout of SIRT1 for studies of SIRT1-dependent signaling, metabolism, stress responses, and cell survival.",
    introHtml: "<p><strong>SIRT1 Knockout Stable RKO Cell Line</strong> is an engineered human colon carcinoma model with stable knockout of <em>SIRT1</em>, an NAD+-dependent deacetylase involved in transcription, metabolism, apoptosis, inflammation, and stress resistance.</p><p>Use the matched SIRT1 wildtype RKO control (Cat. No. T3171) for comparative experiments.</p>",
    storage: SPECIAL_CELL_STORAGE,
    specificationsHtml: specificationTable([
      ["Cat. No.", "T3172"],
      ["Name", "SIRT1 Knockout Stable RKO Cell Line"],
      ["Description", "Human RKO colon carcinoma cell line with stable knockout of SIRT1."],
      ["Organism", "Human (H. sapiens)"],
      ["Tissue", "Colon"],
      ["Donor History", "Colon carcinoma"],
      ["Parental Cell Line", "RKO"],
      ["Target Gene", "SIRT1"],
      ["Model Type", "Stable knockout cell line"],
      ["Growth Properties", "Adherent, epithelial-like"],
      ["Product Format", "Frozen"],
      ["Unit", "1x10^6 cells / 1.0 ml"],
      ["Storage Condition", SPECIAL_CELL_STORAGE],
      ["Shipping Condition", SPECIAL_CELL_SHIPPING],
      ["BioSafety Level", "II"],
      ["Growth Conditions", "PriCoat T25 flasks (G299) or Applied Cell Extracellular Matrix (G422); EMEM (TM511) with 10% regular FBS and 1% Penicillin/Streptomycin (G255); 37°C, 5% CO<sub>2</sub>. Do not heat-inactivate the FBS."],
      ["Unpacking and Storage", "Inspect the shipment on arrival and transfer the vial immediately to the vapor phase of liquid nitrogen or below -130°C. Do not store at -70°C."],
      ["Thawing Protocol", "Thaw rapidly in a 37°C water bath for no longer than 2 minutes, disinfect the vial, transfer aseptically into 5 ml pre-warmed complete medium, centrifuge at 125 × g for 5–7 minutes, resuspend, and seed into a T25 flask."],
      ["Subculture Protocol", "At approximately 80% confluence, rinse as required, detach with 0.25% Trypsin-EDTA for 2–10 minutes, neutralize with complete medium, centrifuge at 125 × g for 5 minutes, resuspend, and split into fresh coated vessels."],
      ["Cryopreservation", "CryoGuard Cryopreservation Medium (TM078) or Cryopreservation Medium (TM024)."],
      ["Intended Use", SPECIAL_CELL_USE],
      ["Depositor", "NIH"],
      ["Application", "Research Use Only"],
      ["Material Citation", "Applied Biological Materials Inc., Cat. No. T3172"],
    ]),
    referencesHtml: referenceList([
      ["Official ABM T3172 product page", "https://www.abmgood.com/sirt1-knockout-stable-rko-cell-line.html"],
      ["ABM Colon Cancer Cell Collection", "https://www.abmgood.com/colon-cancer-cell-collection.html"],
      ["ABM CRISPR Knockout Cell Line Collection", "https://www.abmgood.com/crispr-knockout-cell-line-collection.html"],
    ]),
    images: ["https://www.abmgood.com/assets/product/upload/ryDG8vHK4Jcl40jD3nJAYkYDx5NdZipyIInJ87xI.png"],
    imageCaption: "Official ABM product image for T3172.",
    imageCreditUrl: "https://www.abmgood.com/sirt1-knockout-stable-rko-cell-line.html",
    imageCreditLabel: "View official product page",
    verification: { source: "official-abm-product-page", skuMatches: true, hasSpecifications: true, hasOfficialImage: true },
  },
  T8987: {
    title: "T-47D Cells",
    unit: "1x10^6 cells / 1.0 ml",
    category: "Breast Cancer Cell Lines",
    searchCategory: "Hormone Receptor+ / HER2+",
    sourceUrl: "https://www.abmgood.com/breast-cancer-cell-collection.html",
    description: "T-47D is a human breast cancer cell line used as a hormone-receptor-positive breast tumor model.",
    introHtml: "<p><strong>T-47D Cells</strong> are a human breast ductal carcinoma-derived tumor cell model. ABM lists T8987 in its Hormone Receptor+ / HER2+ breast cancer collection. The cells grow adherently with epithelial-like morphology and are supplied frozen for research use.</p>",
    storage: SPECIAL_CELL_STORAGE,
    specificationsHtml: specificationTable([
      ["Cat. No.", "T8987"],
      ["Name", "T-47D Cells"],
      ["Description", "Human breast cancer cell line used as a hormone-receptor-positive tumor model."],
      ["Organism", "Human (H. sapiens)"],
      ["Tissue", "Breast / mammary gland"],
      ["Disease", "Ductal carcinoma"],
      ["Model Type", "Hormone Receptor+ / HER2+"],
      ["Growth Properties", "Adherent"],
      ["Morphology", "Epithelial-like"],
      ["Product Format", "Frozen"],
      ["Unit", "1x10^6 cells / 1.0 ml"],
      ["Storage Condition", SPECIAL_CELL_STORAGE],
      ["Shipping Condition", SPECIAL_CELL_SHIPPING],
      ["Intended Use", SPECIAL_CELL_USE],
    ]),
    referencesHtml: referenceList([
      ["ABM Breast Cancer Cell Collection", "https://www.abmgood.com/breast-cancer-cell-collection.html"],
      ["BioCat T8987 distributor record", "https://biocat.com/products/t-47d-cells"],
      ["Cytion T47D cell-line reference", "https://www.cytion.com/T47D-Cells/300353"],
    ]),
    images: ["https://cytion.b-cdn.net/media/4b/a4/80/1739541872/T-47D%20P1%20WaKo%2020x01%20070225_ch00.jpg"],
    imageCaption: "Reference micrograph of the same T-47D cell line (Cytion).",
    imageCreditUrl: "https://www.cytion.com/T47D-Cells/300353",
    imageCreditLabel: "View image source",
    verification: { source: "verified-special-cell-reference", skuMatches: true, hasSpecifications: true, hasReferenceImage: true },
  },
  T7723: {
    title: "Scrambled (spCas9) Negative Control KRASG12D SW48 Stable Cell Line",
    unit: "1x10^6 cells / 1.0 ml",
    category: "Colon Cancer Cell Lines",
    searchCategory: "Normal / Rare Colon Lines",
    sourceUrl: "https://www.abmgood.com/colon-cancer-cell-collection.html",
    description: "A scrambled spCas9 negative-control stable line in the human KRASG12D SW48 colorectal cancer background.",
    introHtml: "<p><strong>Scrambled (spCas9) Negative Control KRAS<sup>G12D</sup> SW48 Stable Cell Line</strong> is a human colorectal cancer control model in the SW48 background. The scrambled guide provides a matched negative control for experiments using the corresponding CRISPR-engineered KRAS<sup>G12D</sup> system.</p>",
    storage: SPECIAL_CELL_STORAGE,
    specificationsHtml: specificationTable([
      ["Cat. No.", "T7723"],
      ["Name", "Scrambled (spCas9) Negative Control KRAS<sup>G12D</sup> SW48 Stable Cell Line"],
      ["Description", "Scrambled spCas9 negative-control stable line in the KRAS<sup>G12D</sup> SW48 background."],
      ["Organism", "Human (H. sapiens)"],
      ["Tissue", "Colon / colorectal"],
      ["Parental Cell Line", "SW48"],
      ["Model Type", "Stable CRISPR negative control"],
      ["Growth Properties", "Adherent"],
      ["Morphology", "Epithelial-like"],
      ["Product Format", "Frozen"],
      ["Unit", "1x10^6 cells / 1.0 ml"],
      ["Storage Condition", SPECIAL_CELL_STORAGE],
      ["Shipping Condition", SPECIAL_CELL_SHIPPING],
      ["Intended Use", SPECIAL_CELL_USE],
    ]),
    referencesHtml: referenceList([
      ["ABM Colon Cancer Cell Collection", "https://www.abmgood.com/colon-cancer-cell-collection.html"],
      ["Caltag T7723 distributor record", "https://www.caltagmedsystems.co.uk/"],
      ["Cytion SW48 parental cell-line reference", "https://www.cytion.com/SW48-Cells/305235"],
    ]),
    images: ["https://cytion.b-cdn.net/media/7e/9b/5a/1730710747/SW48%20WaKo%20P1%2020x01%20011024_ch00.jpg"],
    imageCaption: "Parental cell-line reference micrograph: SW48 (Cytion). The ABM product is the engineered scrambled-control derivative.",
    imageCreditUrl: "https://www.cytion.com/SW48-Cells/305235",
    imageCreditLabel: "View image source",
    verification: { source: "verified-special-cell-reference", skuMatches: true, hasSpecifications: true, hasReferenceImage: true },
  },
  T3834: {
    title: "PAH CRISPR Knockout HepG2 Stable Cell Line - AY209",
    unit: "1 vial (>1 million cells)",
    category: "Liver Cell Collection",
    searchCategory: "CRISPR Knockout Cell Line",
    sourceUrl: "https://www.abmgood.com/liver-cell-collection.html",
    description: "A human HepG2 stable cell line carrying a CRISPR knockout of PAH, clone AY209.",
    introHtml: "<p><strong>PAH CRISPR Knockout HepG2 Stable Cell Line - AY209</strong> is a human liver-derived HepG2 model engineered for stable knockout of <em>PAH</em>. It supports gene-function and liver-biology studies that compare the AY209 knockout clone with an appropriate HepG2 control.</p>",
    storage: SPECIAL_CELL_STORAGE,
    specificationsHtml: specificationTable([
      ["Cat. No.", "T3834"],
      ["Name", "PAH CRISPR Knockout HepG2 Stable Cell Line - AY209"],
      ["Description", "Human HepG2 stable cell line with CRISPR knockout of PAH; clone AY209."],
      ["Organism", "Human (H. sapiens)"],
      ["Tissue", "Liver"],
      ["Disease", "Hepatocellular carcinoma"],
      ["Parental Cell Line", "HepG2"],
      ["Target Gene", "PAH"],
      ["Clone", "AY209"],
      ["Model Type", "CRISPR Knockout Cell Line"],
      ["Growth Properties", "Adherent"],
      ["Morphology", "Epithelial-like"],
      ["Product Format", "Frozen"],
      ["Unit", "1 vial (>1 million cells)"],
      ["Storage Condition", SPECIAL_CELL_STORAGE],
      ["Shipping Condition", SPECIAL_CELL_SHIPPING],
      ["Intended Use", SPECIAL_CELL_USE],
    ]),
    referencesHtml: referenceList([
      ["ABM Liver Cell Collection", "https://www.abmgood.com/liver-cell-collection.html"],
      ["Nordic Biosite T3834 distributor record", "https://www.nordicbiosite.com/product/402-T3834/Human-PAH-CRISPR-Knockout-Hep-G2-Stable-Cell-Line-AY209"],
      ["Cytion HepG2 parental cell-line reference", "https://www.cytion.com/Knowledge-Hub/Cell-Line-Insights/HepG2-Cell-Line-A-Liver-Cancer-Research-Resource/"],
    ]),
    images: ["https://cytion.b-cdn.net/media/0b/51/a0/1657023463/hepg2-%283%29.jpg"],
    imageCaption: "Parental cell-line reference micrograph: HepG2 (Cytion). The ABM product is the PAH-knockout AY209 clone.",
    imageCreditUrl: "https://www.cytion.com/Knowledge-Hub/Cell-Line-Insights/HepG2-Cell-Line-A-Liver-Cancer-Research-Resource/",
    imageCreditLabel: "View image source",
    verification: { source: "verified-special-cell-reference", skuMatches: true, hasSpecifications: true, hasReferenceImage: true },
  },
  T6197: {
    title: "K-Ras G12C Stable AALE Cell Line",
    unit: "1x10^6 cells / 1.0 ml",
    category: "Lung Health Cell Collection",
    searchCategory: "Stable Cell Lines",
    sourceUrl: "https://www.abmgood.com/lung-health-collection.html",
    description: "A human AALE lung epithelial stable cell line expressing K-Ras G12C.",
    introHtml: "<p><strong>K-Ras G12C Stable AALE Cell Line</strong> is an engineered human lung epithelial model expressing K-Ras G12C. The adherent, epithelial cells are maintained under serum-free conditions and can be used for lung-biology, signaling, phenotype-comparison, and cell-based assay studies.</p>",
    storage: SPECIAL_CELL_STORAGE,
    specificationsHtml: specificationTable([
      ["Cat. No.", "T6197"],
      ["Name", "K-Ras G12C Stable AALE Cell Line"],
      ["Description", "Human AALE lung epithelial stable cell line expressing K-Ras G12C."],
      ["Organism", "Human (H. sapiens)"],
      ["Tissue", "Lung"],
      ["Parental Cell Line", "AALE"],
      ["Expressed Variant", "K-Ras G12C"],
      ["Selection Marker", "Puromycin resistance"],
      ["Growth Properties", "Adherent; serum-free conditions"],
      ["Morphology", "Epithelial"],
      ["Growth Conditions", "PriGrow X Series Medium (TM6197), 37°C, 5% CO₂"],
      ["Biosafety Level", "BSL-2"],
      ["Product Format", "Frozen"],
      ["Unit", "1x10^6 cells / 1.0 ml"],
      ["Storage Condition", SPECIAL_CELL_STORAGE],
      ["Shipping Condition", SPECIAL_CELL_SHIPPING],
      ["Intended Use", SPECIAL_CELL_USE],
    ]),
    referencesHtml: referenceList([
      ["ABM Lung Health Cell Collection", "https://www.abmgood.com/lung-health-collection.html"],
      ["BioHippo T6197 distributor record", "https://www.ebiohippo.com/products/k-ras-g12c-stable-aale-cell-line-bhc10901270"],
      ["TOPSAN T6197 distributor record", "https://topsan.org/k-ras-g12c-stable-aale-cell-line-t6197/"],
    ]),
    images: ["https://www.ebiohippo.com/cdn/shop/files/d1jX7HpE84dRVmpi1L96on3sJdo9ZQc7epp1zzTS.png?v=1774957809"],
    imageCaption: "Representative T6197 product vial image supplied by the ABM distributor. Final product may vary in appearance.",
    imageCreditUrl: "https://www.ebiohippo.com/products/k-ras-g12c-stable-aale-cell-line-bhc10901270",
    imageCreditLabel: "View product source",
    verification: { source: "verified-special-cell-reference", skuMatches: true, hasSpecifications: true, hasReferenceImage: true },
  },
  T0418: {
    title: "Immortalized Oral Cancer Associated Fibroblast Cells (UM-SCC-122-CAF) - SV40T + SV40",
    unit: "1x10^6 cells / 1.0 ml",
    category: "Oral Cancer Cell Collection",
    searchCategory: "Stromal & tumor microenvironment",
    sourceUrl: "https://www.abmgood.com/oral-cancer-cell-collection.html",
    description: "Patient-matched immortalized oral cancer-associated fibroblasts from the UM-SCC-122 donor background.",
    introHtml: "<p><strong>Immortalized Oral Cancer Associated Fibroblast Cells (UM-SCC-122-CAF) - SV40T + SV40</strong> were isolated from the same patient as the UM-SCC-122 squamous cell carcinoma line (T8061). The matched tumor and fibroblast models can be used together in three-dimensional immunotherapy and oral-cancer microenvironment studies.</p>",
    storage: SPECIAL_CELL_STORAGE,
    specificationsHtml: specificationTable([
      ["Cat. No.", "T0418"],
      ["Name", "Immortalized Oral Cancer Associated Fibroblast Cells (UM-SCC-122-CAF) - SV40T + SV40"],
      ["Description", "Immortalized oral cancer-associated fibroblasts isolated from the same patient as UM-SCC-122 (T8061)."],
      ["Organism", "Human (H. sapiens)"],
      ["Tissue", "Mouth / oral; tongue tumor microenvironment"],
      ["Donor", "Male, 63 years; tongue squamous cell carcinoma"],
      ["Patient-matched Partner", "UM-SCC-122 squamous cell carcinoma line (T8061)"],
      ["Immortalization", "SV40T + SV40"],
      ["Growth Properties", "Adherent; fibroblast"],
      ["Biosafety Level", "BSL-2"],
      ["Product Format", "Frozen"],
      ["Growth Conditions", "PriGrow III (TM003) + 10% FBS + 5 ng/mL hEGF + 1% Penicillin/Streptomycin, 37°C, 5% CO₂"],
      ["Unit", "1x10^6 cells / 1.0 ml"],
      ["Storage Condition", SPECIAL_CELL_STORAGE],
      ["Shipping Condition", SPECIAL_CELL_SHIPPING],
      ["Intended Use", SPECIAL_CELL_USE],
    ]),
    referencesHtml: referenceList([
      ["ABM Oral Cancer Cell Collection", "https://www.abmgood.com/oral-cancer-cell-collection.html"],
      ["BioCat T0418 distributor record", "https://biocat.com/products/immortalized-oral-cancer-associated-fibroblast-cells-um-scc-122-caf-sv40t"],
      ["BioHippo T0418 distributor record", "https://www.ebiohippo.com/products/immortalized-oral-cancer-associated-fibroblast-cells-um-scc-122-caf-negative-sv40t-positive-sv40-bhc10902144"],
      ["ABM patient-matched UM-SCC-122 partner line", "https://www.abmgood.com/squamous-cell-carcinoma-cell-line-um-scc-122.html"],
    ]),
    images: ["https://www.abmgood.com/assets/product/images/cells/T8061.png"],
    imageCaption: "Patient-matched partner reference: UM-SCC-122 (T8061). T0418 is the CAF line isolated from the same donor.",
    imageCreditUrl: "https://www.abmgood.com/squamous-cell-carcinoma-cell-line-um-scc-122.html",
    imageCreditLabel: "View matched-line source",
    verification: { source: "verified-special-cell-reference", skuMatches: true, hasSpecifications: true, hasReferenceImage: true },
  },
  T9997: {
    title: "Kasumi-1 Cells",
    unit: "1x10^6 cells / 1.0 ml",
    category: "Blood Cell Collection",
    searchCategory: "Tumor Cells",
    sourceUrl: "https://www.abmgood.com/blood-cell-collection.html",
    description: "Kasumi-1 is a human acute myeloid leukemia myeloblast cell line carrying the t(8;21) translocation.",
    introHtml: "<p><strong>Kasumi-1 Cells</strong> are a human acute myeloid leukemia (AML) myeloblast model established from peripheral blood. The line carries the t(8;21) translocation and AML1-ETO fusion and grows as round single cells or small clumps in suspension.</p>",
    storage: SPECIAL_CELL_STORAGE,
    specificationsHtml: specificationTable([
      ["Cat. No.", "T9997"],
      ["Name", "Kasumi-1 Cells"],
      ["Description", "Human AML myeloblast cell line carrying the t(8;21) translocation and AML1-ETO fusion."],
      ["Organism", "Human (H. sapiens)"],
      ["Tissue", "Peripheral blood"],
      ["Disease", "Acute myeloid leukemia (FAB M2)"],
      ["Donor", "Male, 7 years, Japanese"],
      ["Cell Type", "Myeloblast"],
      ["Growth Properties", "Suspension; single cells or small clumps"],
      ["Morphology", "Round cells with variation in size and nuclear-to-cytoplasmic ratio"],
      ["Doubling Time", "Approximately 40–45 hours"],
      ["Characteristic", "t(8;21); AML1-ETO fusion"],
      ["Product Format", "Frozen"],
      ["Unit", "1x10^6 cells / 1.0 ml"],
      ["Storage Condition", SPECIAL_CELL_STORAGE],
      ["Shipping Condition", SPECIAL_CELL_SHIPPING],
      ["Intended Use", SPECIAL_CELL_USE],
    ]),
    referencesHtml: referenceList([
      ["ABM Blood Cell Collection", "https://www.abmgood.com/blood-cell-collection.html"],
      ["JCRB1003 Kasumi-1 cell-bank record", "https://cellbank.nibn.go.jp/~cellbank/en/search_res_det.cgi?ID=2072"],
      ["ATCC Kasumi-1 (CRL-2724) reference", "https://www.atcc.org/products/crl-2724"],
    ]),
    images: ["https://cellbank.nibn.go.jp/~cellbank/images/pictures/clp04057.jpg"],
    imageCaption: "Reference image of the same Kasumi-1 cell line (JCRB1003, JCRB Cell Bank).",
    imageCreditUrl: "https://cellbank.nibn.go.jp/~cellbank/en/search_res_det.cgi?ID=2072",
    imageCreditLabel: "View image source",
    verification: { source: "verified-special-cell-reference", skuMatches: true, hasSpecifications: true, hasReferenceImage: true },
  },
};

const TRUSTED_SPECIAL_CELL_REFERENCE_IMAGES = new Set(
  Object.values(VERIFIED_SPECIAL_CELL_DETAILS).flatMap((detail) => detail.images || [])
);

export function isTrustedSpecialCellReferenceImageUrl(value?: string) {
  return Boolean(value && TRUSTED_SPECIAL_CELL_REFERENCE_IMAGES.has(value));
}

function applyVerifiedSpecialCellDetail(detail: AbmStagedDetail) {
  const verified = VERIFIED_SPECIAL_CELL_DETAILS[String(detail.sku || "").trim().toUpperCase()];
  if (!verified) return detail;
  const merged = mergeNonEmpty(
    detail as AbmStagedDetail & Record<string, unknown>,
    verified
  ) as AbmStagedDetail;
  merged.hasDetail = true;
  merged.sourceUnavailable = false;
  return merged;
}

function applyVerifiedProductDetail(detail: AbmStagedDetail) {
  return applyVerifiedIpscVectorMap(applyVerifiedSpecialCellDetail(detail));
}

export function isManagedAbmImageUrl(value?: string) {
  if (!value) return false;
  if (/^\/images\/abm\/[A-Za-z0-9._-]+\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(value)) return true;
  try {
    const url = new URL(value);
    if (url.hostname !== "cdn.sanity.io" || !url.pathname.startsWith("/images/9b5twpc8/")) return false;

    // Sanity image asset paths end in `-WIDTHxHEIGHT.ext`. Tiny assets collected
    // from source pages are document icons, controls, or placeholders—not
    // meaningful product/service imagery—and must never be enlarged in a gallery.
    const dimensions = url.pathname.match(/-(\d+)x(\d+)\.[a-z0-9]+$/i);
    if (!dimensions) return false;
    const width = Number.parseInt(dimensions[1], 10);
    const height = Number.parseInt(dimensions[2], 10);
    return width >= 96 && height >= 96;
  } catch {
    return false;
  }
}

function normalizedDetailImages(previewImage?: string, images?: string[]) {
  return Array.from(new Set([
    String(previewImage || "").trim(),
    ...(Array.isArray(images) ? images : []),
  ].filter((value): value is string => isManagedAbmImageUrl(value))));
}

const STAGED_QUERY = `{
  "records": *[_type == "abmRebuildChunk" && version == $version && kind == $kind].records[]{
    kind,
    sku,
    title,
    url,
    unit,
    searchCategory,
    filterTitle,
    filterPath,
    listingFilters,
    hasDetail,
    previewImage,
    previewSummary
  },
  "details": select(
    $kind == "service" => *[_type == "abmRebuildDetailChunk" && version == $version && kind == $kind].records[]{
      key,
      listingPaths,
      breadcrumbs
    },
    []
  )
}`;

function isNonProductCatalogTool(record: Pick<AbmStagedRecord, "sku" | "url">) {
  if (String(record.sku || "").trim().toLowerCase() === "coa") return true;
  try {
    return new URL(String(record.url || ""), "https://www.abmgood.com").pathname.toLowerCase().endsWith("/coa-library.html");
  } catch {
    return false;
  }
}

function isNonProductCatalogToolKey(key: string) {
  const normalized = String(key || "").trim().toLowerCase();
  return normalized === "coa" || normalized.endsWith("/coa-library.html") || normalized === "coa-library.html";
}

export async function getAbmStagedRecords(kind: AbmStagedRecord["kind"]): Promise<AbmStagedRecord[]> {
  const result = await sanityCdnClient.fetch<{
    records?: AbmStagedRecord[];
    details?: Array<{
      key?: string;
      listingPaths?: string[][];
      breadcrumbs?: string[];
    }>;
  }>(STAGED_QUERY, {
    version: ABM_REBUILD_VERSION,
    kind,
  }, PUBLIC_CATALOG_CACHE);
  const details = new Map((result?.details || []).map((detail) => [String(detail.key || "").toLowerCase(), detail]));
  const records = (Array.isArray(result?.records) ? result.records : []).filter((record) =>
    kind !== "product" || !isNonProductCatalogTool(record)
  ).map((record) => {
    const key = `${kind}:${String(record.sku || record.url).trim().toLowerCase()}`;
    const detail = details.get(key);
    return {
      ...record,
      listingPaths: detail?.listingPaths,
      breadcrumbs: detail?.breadcrumbs,
    };
  });
  if (kind !== "product") return records;

  const existingSkus = new Set(records.map((record) => String(record.sku || "").trim().toLowerCase()));
  return [
    ...records,
    ...Object.values(VERIFIED_EXPRESSION_SYSTEM_PRODUCTS).filter((record) =>
      !existingSkus.has(record.sku.toLowerCase())
    ),
  ];
}

const STAGED_CATALOG_NUMBERS_QUERY = `*[
  _type == "abmRebuildChunk"
  && version == $version
  && kind == $kind
].records[].sku`;

/**
 * Compact catalog-number lookup used when category tables need to distinguish
 * product rows from custom-service rows. Keeping this query SKU-only avoids
 * shipping the complete staged service inventory into the page renderer.
 */
export async function getAbmStagedCatalogNumbers(kind: AbmStagedRecord["kind"]): Promise<string[]> {
  const result = await sanityCdnClient.fetch<string[]>(STAGED_CATALOG_NUMBERS_QUERY, {
    version: ABM_REBUILD_VERSION,
    kind,
  }, PUBLIC_CATALOG_CACHE);

  const catalogNumbers = (Array.isArray(result) ? result : [])
    .map((sku) => String(sku || "").trim())
    .filter(Boolean);
  if (kind === "product") {
    catalogNumbers.push(...Object.values(VERIFIED_EXPRESSION_SYSTEM_PRODUCTS).map((record) => record.sku));
  }
  return Array.from(new Set(catalogNumbers));
}

const STAGED_COUNT_QUERY = `select(
  $kind == "product" => count(*[
    _type == "abmRebuildChunk"
    && version == $version
    && kind == $kind
  ].records[lower(sku) != "coa"]),
  count(*[
    _type == "abmRebuildChunk"
    && version == $version
    && kind == $kind
  ].records[])
)`;

/** Lightweight inventory count for landing pages; avoids transferring the full catalog. */
export async function getAbmStagedRecordCount(kind: AbmStagedRecord["kind"]): Promise<number> {
  const count = await sanityCdnClient.fetch<number>(STAGED_COUNT_QUERY, {
    version: ABM_REBUILD_VERSION,
    kind,
  }, PUBLIC_CATALOG_CACHE);
  return Number.isFinite(count) ? count : 0;
}

const STAGED_LANDING_QUERY = `*[
  _type == "abmRebuildLandingChunk"
  && version == $version
  && kind == "service"
  && $path in records[].pathKey
][0].records[pathKey == $path][0]{
  kind,
  path,
  title,
  sourceUrl,
  html,
  images,
  children,
  collectedAt
}`;

export async function getAbmStagedServiceLanding(path: string[]): Promise<AbmStagedLanding | undefined> {
  if (!path.length) return undefined;
  const result = await sanityCdnClient.fetch<AbmStagedLanding | null>(STAGED_LANDING_QUERY, {
    version: ABM_REBUILD_VERSION,
    path: path.join("/"),
  }, PUBLIC_CATALOG_CACHE);
  return result || undefined;
}

const STAGED_RECORD_QUERY = `*[
  _type == "abmRebuildChunk"
  && version == $version
  && kind == $kind
  && count(records[lower(sku) == lower($key) || lower(url) == lower($key)]) > 0
][0].records[lower(sku) == lower($key) || lower(url) == lower($key)][0]`;

function officialCellRecord(key: string): AbmStagedRecord | undefined {
  const officialCell = findOfficialAbmCellModelProduct(key);
  if (!officialCell) return undefined;
  return {
    kind: "product",
    sku: officialCell.sku || "",
    title: officialCell.title,
    url: officialCell.url,
    unit: officialCell.unit,
    searchCategory: officialCell.modelType,
    filterTitle: officialCell.modelType,
    filterPath: ["Cellular Materials", "Cell Library Collections", officialCell.modelType],
    listingFilters: [
      {
        id: `cell-model:${officialCell.modelType}`,
        title: officialCell.modelType,
        path: ["Cellular Materials", "Cell Library Collections", officialCell.modelType],
      },
    ],
    hasDetail: Boolean(findOfficialAbmCellDetail(officialCell.sku || key)),
  };
}

export async function getAbmStagedRecord(kind: AbmStagedRecord["kind"], key: string) {
  const decodedKey = decodeURIComponent(key);
  if (kind === "product") {
    const expressionSystemRecord = verifiedExpressionSystemProduct(decodedKey);
    if (expressionSystemRecord) return expressionSystemRecord;
    if (isNonProductCatalogToolKey(decodedKey)) return null;
    const cellRecord = officialCellRecord(decodedKey);
    if (cellRecord) return cellRecord;
  }
  const staged = await sanityCdnClient.fetch<AbmStagedRecord | null>(STAGED_RECORD_QUERY, {
    version: ABM_REBUILD_VERSION,
    kind,
    key: decodedKey,
  }, PUBLIC_CATALOG_CACHE);
  if (kind === "product" && staged && isNonProductCatalogTool(staged)) return null;
  return staged;
}

export function stagedRecordKey(row: AbmStagedRecord) {
  return row.sku || row.url;
}

export function stagedRecordPath(kind: AbmStagedRecord["kind"], row: AbmStagedRecord) {
  return `/products/abm/staged/${kind}/${encodeURIComponent(stagedRecordKey(row))}`;
}

const STAGED_DETAIL_QUERY = `(*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == $kind
  && $key in records[].key
] | order(_id asc))[0].records[key == $key][0]`;

const STAGED_DETAIL_PRESENCE_QUERY = `
*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && kind == $kind
  && count(records[key in $keys]) > 0
]{
  "records": records[key in $keys]{
    key,
    sourceUnavailable,
    previewImage,
    images,
    introHtml,
    description,
    overview,
    specificationsHtml,
    datasheetHtml,
    documentsHtml,
    faqsHtml,
    referencesHtml,
    reviewsHtml,
    serviceDetailsHtml,
    documents
  }
}
`;

type StagedDetailPresenceRecord = {
  key?: string;
  sourceUnavailable?: boolean;
  previewImage?: string;
  images?: unknown[];
  introHtml?: string;
  description?: string;
  overview?: string;
  specificationsHtml?: string;
  datasheetHtml?: string;
  documentsHtml?: string;
  faqsHtml?: string;
  referencesHtml?: string;
  reviewsHtml?: string;
  serviceDetailsHtml?: string;
  documents?: unknown[];
};

function plainDetailText(value: unknown) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Vector routing treats only visibly useful migrated detail as internal.
function hasUsableStagedDetail(record: StagedDetailPresenceRecord) {
  if (record.sourceUnavailable) return false;

  const hasMedia = Boolean(String(record.previewImage || "").trim())
    || (Array.isArray(record.images) && record.images.length > 0);
  const hasDocuments = Array.isArray(record.documents) && record.documents.some((item) => {
    if (!item || typeof item !== "object") return false;
    const doc = item as { url?: unknown; href?: unknown };
    return Boolean(String(doc.url || doc.href || "").trim());
  });

  const structured = [
    record.specificationsHtml,
    record.datasheetHtml,
    record.documentsHtml,
    record.faqsHtml,
    record.referencesHtml,
    record.reviewsHtml,
    record.serviceDetailsHtml,
  ].some((value) => plainDetailText(value).length >= 60);

  const narrativeLength = [
    record.introHtml,
    record.description,
    record.overview,
  ].map(plainDetailText).join(" ").trim().length;

  return hasMedia || hasDocuments || structured || narrativeLength >= 160;
}

export async function getAbmStagedDetailPresence(
  kind: AbmStagedRecord["kind"],
  catalogNumbers: readonly string[],
) {
  const keys = [...new Set(
    catalogNumbers
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
      .map((value) => `${kind}:${value}`),
  )];

  if (!keys.length) return new Set<string>();

  const chunks = await sanityClient.fetch<Array<{ records?: StagedDetailPresenceRecord[] }>>(
    STAGED_DETAIL_PRESENCE_QUERY,
    { version: ABM_REBUILD_VERSION, kind, keys },
    PUBLIC_CATALOG_CACHE,
  );

  const usable = new Set(
    (Array.isArray(chunks) ? chunks : [])
      .flatMap((chunk) => Array.isArray(chunk.records) ? chunk.records : [])
      .filter(hasUsableStagedDetail)
      .map((record) => String(record.key || "").trim().toLowerCase())
      .filter(Boolean),
  );

  const present = new Set(
    catalogNumbers
      .map((value) => String(value || "").trim())
      .filter((value) => usable.has(`${kind}:${value.toLowerCase()}`)),
  );
  if (kind === "product") {
    catalogNumbers.forEach((value) => {
      if (verifiedExpressionSystemProduct(value)) present.add(String(value || "").trim());
    });
  }
  return present;
}

// A small number of rebuild records have reviewed content but no copied image array.
// Reuse only already-managed Sanity media from the matching legacy ABM product;
// never use its body, price, or external supplier media as a content fallback.
const EXISTING_ABM_IMAGE_QUERY = `*[
  _type == "product"
  && (
    brand._ref == "brand-abm"
    || brandSlug == "abm"
    || brand->slug.current == "abm"
    || brand->themeKey == "abm"
  )
  && (
    ($sku != "" && lower(sku) == lower($sku))
    || ($sku != "" && count(variants[defined(sku) && lower(sku) == lower($sku)]) > 0)
    || ($title != "" && lower(title) == lower($title))
    || ($sourceUrl != "" && sourceUrl == $sourceUrl)
  )
][0]{ imageUrls, "assetUrls": images[].asset->url }`;

type ExistingAbmImages = { imageUrls?: string[]; assetUrls?: string[] };

async function getExistingManagedProductImages(record: AbmStagedRecord) {
  if (record.kind !== "product") return [];
  const result = await sanityCdnClient.fetch<ExistingAbmImages | null>(EXISTING_ABM_IMAGE_QUERY, {
    sku: String(record.sku || "").trim(),
    title: String(record.title || "").trim(),
    sourceUrl: String(record.url || "").trim(),
  }, PUBLIC_CATALOG_CACHE);
  return normalizedDetailImages(undefined, [
    ...(result?.assetUrls || []),
    ...(result?.imageUrls || []),
  ]);
}

function mergeNonEmpty<T extends Record<string, unknown>>(base: T, extra: Record<string, unknown>) {
  const out = { ...base } as T & Record<string, unknown>;
  for (const [key, value] of Object.entries(extra)) {
    if (Array.isArray(value) ? value.length : typeof value === "string" ? value.trim() : value != null) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

function isInvalidCollectedDetail(staged: Record<string, unknown>) {
  const sourceUrl = String(staged.sourceUrl || "").trim();
  const title = String(staged.title || "").trim();
  let missingPageUrl = false;
  try {
    missingPageUrl = new URL(sourceUrl, "https://www.abmgood.com").pathname.toLowerCase().includes("/pagenotfound");
  } catch {
    missingPageUrl = false;
  }
  return missingPageUrl || /(?:\b404\b|page\s+you\s+are\s+looking\s+for\s+can(?:not|'t)\s+be\s+found|page\s+not\s+found)/i.test(title);
}

/** Resolve reviewed staging content. Existing Product may contribute managed Sanity images only. */
export async function getAbmStagedDetail(kind: AbmStagedRecord["kind"], key: string): Promise<AbmStagedDetail | undefined> {
  const decodedKey = decodeURIComponent(key);
  if (kind === "product") {
    const expressionSystemDetail = verifiedExpressionSystemProduct(decodedKey);
    if (expressionSystemDetail) return expressionSystemDetail;
    const cellRecord = officialCellRecord(decodedKey);
    const cellDetail = cellRecord ? findOfficialAbmCellDetail(cellRecord.sku || decodedKey) : undefined;
    if (cellRecord && cellDetail) {
      let images = normalizedDetailImages(cellDetail.previewImage, cellDetail.images);
      if (!images.length) images = await getExistingManagedProductImages(cellRecord);
      return applyVerifiedProductDetail({
        ...cellRecord,
        ...cellDetail,
        kind,
        sourceUrl: String(cellDetail.sourceUrl || cellRecord.url || "").trim(),
        hasDetail: true,
        images,
      } as AbmStagedDetail);
    }
  }

  const record = await getAbmStagedRecord(kind, key);
  const detailKey = `${kind}:${String(record?.sku || record?.url || decodedKey).trim().toLowerCase()}`;

  // Read staged detail from the origin API rather than Sanity's CDN. Detail records
  // are occasionally backfilled after review (for example managed product media),
  // and the CDN can briefly serve the pre-backfill record. Next's catalog cache still
  // keeps repeated page reads fast after the fresh origin value has been observed.
  const staged = await sanityClient.fetch<Record<string, unknown> | null>(STAGED_DETAIL_QUERY, {
    version: ABM_REBUILD_VERSION,
    kind,
    key: detailKey,
  }, PUBLIC_CATALOG_CACHE);

  // New products can appear first on an official collection landing page and
  // receive a reviewed detail batch before the next full inventory census.
  // A verified detail record is sufficient to render the canonical internal
  // product page; it must not be forced through a temporary query fallback.
  if (!record && staged && !isInvalidCollectedDetail(staged)) {
    const direct = { ...staged } as AbmStagedDetail;
    direct.kind = kind;
    direct.sku = String(direct.sku || decodedKey).trim();
    direct.title = String(direct.title || direct.sku || "ABM item").trim();
    direct.url = String(direct.url || direct.sourceUrl || "").trim();
    direct.sourceUrl = String(direct.sourceUrl || direct.url || "").trim();
    direct.hasDetail = true;
    direct.images = normalizedDetailImages(direct.previewImage, direct.images);
    return applyVerifiedProductDetail(direct);
  }

  if (!record) return undefined;

  if (staged && isInvalidCollectedDetail(staged)) {
    let images = normalizedDetailImages(record.previewImage);
    if (!images.length) images = await getExistingManagedProductImages(record);
    return applyVerifiedProductDetail({
      ...record,
      sourceUrl: String(record.url || "").trim(),
      hasDetail: true,
      sourceUnavailable: true,
      images,
    } as AbmStagedDetail);
  }

  if (!staged) {
    const officialCellDetail = kind === "product" ? findOfficialAbmCellDetail(record.sku || decodedKey) : undefined;
    if (officialCellDetail) {
      let images = normalizedDetailImages(officialCellDetail.previewImage, officialCellDetail.images);
      if (!images.length) images = await getExistingManagedProductImages(record);
      return applyVerifiedProductDetail({
        ...record,
        ...officialCellDetail,
        kind,
        sourceUrl: String(officialCellDetail.sourceUrl || record.url || "").trim(),
        hasDetail: true,
        images,
      } as AbmStagedDetail);
    }
    let images = normalizedDetailImages(record.previewImage);
    if (!images.length) images = await getExistingManagedProductImages(record);
    return applyVerifiedProductDetail({
      ...record,
      sourceUrl: String(record.url || "").trim(),
      hasDetail: false,
      images,
    } as AbmStagedDetail);
  }

  const sourceUrl = String(staged.sourceUrl || record.url || "").trim();
  const detail = mergeNonEmpty({ ...record, sourceUrl }, staged) as AbmStagedDetail;
  detail.kind = kind;
  detail.hasDetail = true;
  detail.images = normalizedDetailImages(detail.previewImage, detail.images);
  if (!detail.images.length) detail.images = await getExistingManagedProductImages(record);
  return applyVerifiedProductDetail(detail);
}
