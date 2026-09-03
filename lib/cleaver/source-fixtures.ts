import sourceMap from "@/data/cleaver-source-map.json";
import { cleaverProductSlug, type CleaverProduct } from "@/lib/cleaver/catalog";
import {
  mergeCleaverVideos,
  verifiedCleaverFamilyImages,
  verifiedCleaverSourceVideos,
} from "@/lib/cleaver/source-fallbacks";

const SOURCE_URL = "https://www.thistlescientific.com/product/multisub-mini-mini-horizontal-electrophoresis-system/";
const SOURCE_TITLE = "multiSUB Mini, Mini Horizontal Electrophoresis System";

type SourceIdentity = {
  sourceTitle?: string;
  sourceUrl?: string;
  sourceSlug?: string;
  images?: string[];
};

const SOURCE_MAP = sourceMap as Record<string, SourceIdentity>;
const internalHref = (title: string, sku: string) => `/products/cleaver/item/${encodeURIComponent(cleaverProductSlug(title, sku))}`;

// Keep the exact WordPress image derivatives exposed by the manufacturer page.
// These URLs are verified source assets; guessing a larger filename by stripping
// the WordPress size suffix can yield a broken image when the original upload
// name differs from the generated derivative name.
const variations = [
  {
    title: "multiSUB Mini with 7 x 10cm Gel tray",
    sku: "MSMINI10",
    packSize: "1 / Each",
    imageUrl: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MSMINI-4.WEB_-600x600.jpg",
    internalHref: internalHref("multiSUB Mini with 7 x 10cm Gel tray", "MSMINI10"),
  },
  {
    title: "multiSUB Mini with 7 x 7cm & 7 x 10cm Gel tray",
    sku: "MSMINIDUO",
    packSize: "1 / Each",
    imageUrl: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MSMINI-3.WEB_-600x600.jpg",
    internalHref: internalHref("multiSUB Mini with 7 x 7cm & 7 x 10cm Gel tray", "MSMINIDUO"),
  },
  {
    title: "multiSUB Mini with 7 x 7cm Gel tray",
    sku: "MSMINI7",
    packSize: "1 / Each",
    imageUrl: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MSMINI-4.WEB_-600x600.jpg",
    internalHref: internalHref("multiSUB Mini with 7 x 7cm Gel tray", "MSMINI7"),
  },
];

const accessories = [
  ["multiSUB Mini - 7 x 10cm Gel tray", "MS7-UV10", "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7-UV10-1.WEB_-150x150.jpg", "1 / Each"],
  ["multiSUB Mini - Loading Guides", "MS7-LG", "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS10-LG-1.WEB_-150x150.jpg", "1 / Each"],
  ["multiSUB Mini - Viewing Platform", "MS7-WP", "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS10-WP-1.WEB_-150x150.jpg", "1 / Each"],
  ["multiSUB Mini Buffer Saver Blocks", "MSMINIBSB", "https://www.thistlescientific.com/wp-content/uploads/2024/11/MSMINIBSB-1.WEB_-150x150.jpg", "1 / Each"],
  ["multiSUB Mini - 7 x 7cm Gel tray", "MS7-UV7", "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7-UV7-1.WEB_-150x150.jpg", "1 / Each"],
  ["multiSUB Mini - Cool-pack and platform", "MSMINICP", "https://www.thistlescientific.com/wp-content/uploads/2024/11/MSMINICP-1.WEB_-150x150.jpg", "1 / Each"],
  ["multiSUB Mini - Negative Electrode", "MS7-NE", "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7-NE-1.WEB_-150x150.jpg", "1 / Each"],
  ["multiSUB Mini - Gel tray Dams", "MS7-UVDAM", "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7-UVDAM-1.WEB_-150x150.jpg", "2 / Pack"],
  ["multiSUB Mini - Positive Electrode", "MS7-PE", "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7-PE-1.WEB_-150x150.jpg", "1 / Each"],
  ["multiSUB Mini - 7cm UV Gel Scoop", "MS7-UVS", "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7-UVS-1.WEB_-150x150.jpg", "1 / Each"],
  ["multiSUB Mini Lid", "MS7LID", "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7LID-1.WEB_-150x150.jpg", "1 / Each"],
  ["multiSUB Mini Tank (Including Electrodes)", "MS7TANK", "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7TANK-1.WEB_-150x150.jpg", "1 / Each"],
  ["Electrophoresis cable (Black & Red)", "CSL-CAB", "https://www.thistlescientific.com/wp-content/uploads/2024/11/CSL-CAB-1.WEB_-150x150.jpg", "1 / Each"],
].map(([title, sku, imageUrl, packSize]) => ({
  title,
  sku,
  imageUrl,
  packSize,
  internalHref: internalHref(title, sku),
}));

const combAccessory = {
  title: "multiSUB Mini Combs",
  packSize: "1 / Each",
  imageUrl: "https://www.thistlescientific.com/wp-content/uploads/2024/11/MS7-10-1-1.WEB_-150x150.jpg",
  internalHref: "/products/cleaver?q=multiSUB+Mini+Comb",
};

const commonIncluded = [
  { title: "multiSUB Mini Lid", quantity: "1" },
  { title: "multiSUB Mini Tank (Including Electrodes)", quantity: "1" },
  { title: "multiSUB Mini Combs", quantity: "2" },
  { title: "multiSUB Mini - Viewing Platform", quantity: "1" },
  { title: "multiSUB Mini - Loading Guides", quantity: "1" },
  { title: "multiSUB Mini - Gel tray Dams", quantity: "1" },
  { title: "Electrophoresis cable (Black & Red)", quantity: "1" },
];

const includedBySku = {
  MSMINI7: [{ title: "multiSUB Mini - 7 x 7cm Gel tray", quantity: "1" }, ...commonIncluded],
  MSMINI10: [{ title: "multiSUB Mini - 7 x 10cm Gel tray", quantity: "1" }, ...commonIncluded],
  MSMINIDUO: [
    { title: "multiSUB Mini - 7 x 10cm Gel tray", quantity: "1" },
    { title: "multiSUB Mini - 7 x 7cm Gel tray", quantity: "1" },
    ...commonIncluded,
  ],
} as const;

// The manufacturer product gallery has four logical images in this exact order.
const manufacturerImages = [
  "https://www.thistlescientific.com/wp-content/uploads/2024/11/MSMINI-4.WEB_.jpg",
  "https://www.thistlescientific.com/wp-content/uploads/2024/11/MSMINI-3.WEB_.jpg",
  "https://www.thistlescientific.com/wp-content/uploads/2024/11/MSMINI-2.WEB_.jpg",
  "https://www.thistlescientific.com/wp-content/uploads/2024/11/MSMINI-1.WEB_.jpg",
];

const baseFixture: Partial<CleaverProduct> = {
  sourceUrl: SOURCE_URL,
  cleaverSourceTitle: SOURCE_TITLE,
  image: manufacturerImages[0],
  images: manufacturerImages,
  overviewHtml: `<p>The MultiSUB Mini is the smallest unit in the range, designed for low to medium numbers of samples. The small gel size maximises run economy but does not compromise versatility as two tray options are available - 7 x 7cm and 7 x 10cm - and combs ranging from preparative up to 16 samples. Simply by altering the gel tray or comb, this compact unit is capable of resolving up to 64 different samples, prepping 1ml of sample or separating sample bands over a distance of 9cm.</p><p>Buffer saver blocks physically reduce the volume of a gel chamber and buffer requirements, therefore saving cost.</p>`,
  cleaverAtAGlance: [
    "Available with 7 x 7cm, 7 x 10cm or with both gel trays",
    "Economic low gel and buffer volumes",
    "Small lab bench footprint",
  ],
  cleaverSpecificationMatrix: {
    headers: ["MSMINI10", "MSMINI7", "MSMINIDUO"],
    rows: [
      { label: "Unit Dimensions (cm)", values: ["9 x 21 x 9", "9 x 21 x 9", "9 x 21 x 9"] },
      { label: "Maximum Sample Capacity", values: ["64", "32", "64"] },
      { label: "Base Buffer Volume", values: ["225", "225", "225"] },
      { label: "Buffer Recirculation", values: ["No", "No", "No"] },
      { label: "Flexicaster Options", values: ["MS7/10-FC, MS15/20-FC, MS26-FC", "MS7/10-FC, MS15/20-FC, MS26-FC", "MS7/10-FC, MS15/20-FC, MS26-FC"] },
      { label: "Typical Running Conditions", values: ["80V, 45-60 minutes", "80V, 45-60 minutes", "80V, 45-60 minutes"] },
      { label: "Bromophenol Blue Migration Rate", values: ["~4-5cm/h at 80V", "~4-5cm/h at 80V", "~4-5cm/h at 80V"] },
      { label: "Gel Dimensions", values: ["7 x 10", "7 x 7", "7 x 7 & 7 x 10"] },
    ],
  },
  docs: [
    {
      group: "Instructions",
      title: "TSL - MULTISUB RANGE manual",
      label: "TSL - MULTISUB RANGE manual",
      url: "https://files.plytix.com/api/v1.1/file/public_files/pim/assets/9e/65/2f/5c/5c2f659ed1855f04664d45e8/texts/b3/61/86/67/678661b37d62ad55995de439/TSL%20-%20MULTISUB%20RANGE%20manual.pdf",
    },
    {
      group: "Product Flyers",
      title: "MULTISUB.WEB",
      label: "MULTISUB.WEB",
      url: "https://files.plytix.com/api/v1.1/file/public_files/pim/assets/9e/65/2f/5c/5c2f659ed1855f04664d45e8/texts/6d/17/ee/5d/5dee176d92d98bff49f8bf69/MULTISUB.WEB.PDF",
    },
    {
      group: "Product Flyers",
      title: "Cleaver Scientific catalogue page 12",
      label: "Cleaver Scientific catalogue page 12",
      url: "https://files.plytix.com/api/v1.1/file/public_files/pim/assets/9e/65/2f/5c/5c2f659ed1855f04664d45e8/texts/3d/17/ee/5d/5dee173d92d98bff49f8bea3/Cleaver%20Scientific%20catalogue%20page%2012.pdf",
    },
  ],
  cleaverVariations: variations,
  cleaverAccessories: [...accessories, combAccessory],
  cleaverVideos: [
    {
      title: "How To Cast And Run An Agarose Gel in The Multi Sub Mini Electrophoresis System",
      url: "https://www.youtube.com/watch?v=zXgM10ghY_w",
      embedUrl: "https://www.youtube.com/embed/zXgM10ghY_w",
    },
  ],
};

const omniDocViewingWindowFixture: Partial<CleaverProduct> = {
  sourceUrl: "https://www.thistlescientific.com/product/omnidoc-viewing-window-replacement/",
  cleaverSourceTitle: "omniDOC Viewing Window Replacement",
  image: "https://www.thistlescientific.com/wp-content/uploads/2024/11/OMNID-4.WEB_.jpg",
  images: ["https://www.thistlescientific.com/wp-content/uploads/2024/11/OMNID-4.WEB_.jpg"],
  overviewHtml: `<p>Replacement viewing window for the Cleaver Scientific omniDOC Gel Documentation System. The manufacturer identifies the omniDOC viewing window as a 560nm universal orange/amber filter used for safe, convenient gel inspection.</p>`,
  cleaverAtAGlance: [
    "Replacement viewing window for the omniDOC Gel Documentation System",
    "Amber/orange filter",
    "560nm viewing window",
  ],
  specRows: [
    { label: "Accessory Type", value: "Replacement viewing window" },
    { label: "Filter", value: "Amber / universal orange filter" },
    { label: "Wavelength", value: "560nm" },
    { label: "Compatible System", value: "omniDOC Gel Documentation System" },
  ],
  docs: [
    {
      group: "Instructions",
      title: "TSL - OmniDOC MANUAL V1.1",
      label: "TSL - OmniDOC MANUAL V1.1",
      url: "https://files.plytix.com/api/v1.1/file/public_files/pim/assets/9e/65/2f/5c/5c2f659ed1855f04664d45e8/texts/17/fc/b7/69/69b7fc17308073ddaf43ac60/TSL-%20OmniDOC%20MANUAL%20V1.1.pdf",
    },
    {
      group: "Product Flyers",
      title: "OMNIDOC.WEB",
      label: "OMNIDOC.WEB",
      url: "https://files.plytix.com/api/v1.1/file/public_files/pim/assets/9e/65/2f/5c/5c2f659ed1855f04664d45e8/texts/d6/4c/a5/65/65a54cd67d2fb1e6195f9bb2/OMNIDOC.WEB.PDF",
    },
  ],
  cleaverWorksWith: [
    {
      title: "omniDOC Gel Documentation System",
      sku: "OMNIDOC",
      packSize: "1 / Each",
      imageUrl: "https://www.thistlescientific.com/wp-content/uploads/2024/11/OMNID-4.WEB_.jpg",
      sourceUrl: "https://www.thistlescientific.com/product/omnidoc-gel-documentation-system/",
      internalHref: "/products/cleaver/item/omnidoc-gel-documentation-system",
    },
  ],
};

const explicitFixtures: Record<string, Partial<CleaverProduct>> = {
  ...Object.fromEntries(
    Object.entries(includedBySku).map(([sku, included]) => [sku, { ...baseFixture, cleaverIncludedItems: [...included] }]),
  ),
  "OMNIDOC-F1": omniDocViewingWindowFixture,
};

export function getVerifiedCleaverSourceFixture(sku: string) {
  const key = sku.trim().toUpperCase();
  const explicit = explicitFixtures[key] || null;
  const identity = SOURCE_MAP[key];
  const exactImages = (identity?.images || []).filter(Boolean);
  const familyImages = exactImages.length ? [] : verifiedCleaverFamilyImages(key, identity?.sourceTitle || explicit?.cleaverSourceTitle);
  const sourceUrl = identity?.sourceUrl || explicit?.sourceUrl;
  const sourceTitle = identity?.sourceTitle || explicit?.cleaverSourceTitle;
  const sourceVideos = verifiedCleaverSourceVideos(sourceUrl, sourceTitle);
  const videos = mergeCleaverVideos(explicit?.cleaverVideos, sourceVideos);

  if (!explicit && !familyImages.length && !videos.length) return null;

  return {
    ...(familyImages.length ? { image: familyImages[0], images: familyImages } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceTitle ? { cleaverSourceTitle: sourceTitle } : {}),
    ...(videos.length ? { cleaverVideos: videos } : {}),
    ...(explicit || {}),
    ...(videos.length ? { cleaverVideos: videos } : {}),
  } as Partial<CleaverProduct>;
}
