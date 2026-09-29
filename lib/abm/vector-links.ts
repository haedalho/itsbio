export type AbmVectorLinkRecord = {
  kind?: string;
  sku?: string;
  title?: string;
  url?: string;
  sourceUrl?: string;
  searchCategory?: string;
  filterTitle?: string;
  filterPath?: string[];
  listingFilters?: Array<{ title?: string; path?: string[] }>;
  listingPaths?: string[][];
  breadcrumbs?: string[];
};

const OFFICIAL_ABM_HOSTS = new Set(["abmgood.com", "www.abmgood.com"]);
const MANUALLY_VERIFIED_VECTOR_URLS: Record<string, string> = {
  K002: "https://www.abmgood.com/cas9-nuclease-lentiviral-vector.html",
  K003: "https://www.abmgood.com/cas9-nuclease-lentivirus.html",
  K207: "https://www.abmgood.com/sacas9-nuclease-aav-vector.html",
  K004: "https://www.abmgood.com/cas9-nuclease-adenovirus.html",
  K014: "https://www.abmgood.com/dcas9-c-terminal-cloning-vector.html",
  K097: "https://www.abmgood.com/crispra-dcas9-vpr-lentiviral-vector.html",
  K098: "https://www.abmgood.com/crispra-dcas9-vpr-lentivirus.html",
  K203: "https://www.abmgood.com/dcas9-krab-lentiviral-vector.html",
  K204: "https://www.abmgood.com/dcas9-krab-lentivirus.html",
  K096: "https://www.abmgood.com/dcas9-tet1cd-lentiviral-vector.html",
  K090: "https://www.abmgood.com/dcas9-tet1cd-lentivirus.html",
  K091: "https://www.abmgood.com/dcas9-dnmt3a-lentiviral-vector.html",
  K092: "https://www.abmgood.com/dcas9-dnmt3a-lentivirus.html",
};


const VECTOR_FAMILY_HINTS = [
  "lentiviral vectors",
  "lentiviral vectors and virus",
  "aav vectors",
  "aav vectors and virus",
  "adenovirus",
  "sirna lentivirus",
  "sirna aav",
  "orf vectors",
  "control vectors and viruses",
  "crispr ko vectors and virus",
  "crispr activation vectors",
  "cas9 vectors and virus",
  "lentiviral vector",
  "aav vector",
  "adenoviral vector",
  "retroviral vector",
  "specialized vectors",
  "targeted cell apoptosis adenoviruses",
  "ipsc reporters",
];

const NON_VECTOR_HINTS = [
  "kits for viral vectors",
  "virus packaging dna mixes",
  "qpcr virus titer kits",
  "virus transduction enhancer",
  "virus purification kits",
  "cas proteins and crispr screening",
];

function norm(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function recordLabels(record: AbmVectorLinkRecord) {
  return [
    record.title,
    record.searchCategory,
    record.filterTitle,
    ...(record.filterPath || []),
    ...(record.listingFilters || []).flatMap((item) => [item.title, ...(item.path || [])]),
    ...(record.listingPaths || []).flat(),
    ...(record.breadcrumbs || []),
  ].map(norm).filter(Boolean);
}

function isVectorFamilyRecord(record: AbmVectorLinkRecord) {
  if (record.kind && record.kind !== "product") return false;

  const labels = recordLabels(record);
  const joined = labels.join(" | ");
  if (!joined.includes("genetic materials")) return false;
  if (NON_VECTOR_HINTS.some((hint) => joined.includes(hint))) return false;

  const title = norm(record.title);
  const titleLooksVectorLike =
    /\bvector\b|\bvectors\b|\blentivector\b|\blentivirus\b|\baav\b|\badenovirus\b|\bretrovirus\b/.test(title);

  const familyLooksVectorLike = VECTOR_FAMILY_HINTS.some((hint) => joined.includes(hint));
  return titleLooksVectorLike || familyLooksVectorLike;
}

function normalizedSku(value: string | null | undefined) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function exactSkuPresentInProductPath(pathname: string, sku: string) {
  const skuToken = normalizedSku(sku);
  if (!skuToken) return false;

  const basename = decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) || "")
    .toLowerCase()
    .replace(/\.html?$/i, "");
  const basenameCompact = basename.replace(/[^a-z0-9]+/g, "");

  // ABM's modern individual product pages normally end with the catalog number,
  // e.g. ...-G6101.html, ...-LG247326.html, ...-VG124830.html.
  return basenameCompact.endsWith(skuToken);
}

function cleanOfficialProductUrl(rawValue: string | null | undefined) {
  const value = String(rawValue || "").trim();
  if (!value) return "";

  try {
    const url = new URL(value, "https://www.abmgood.com");
    if (!OFFICIAL_ABM_HOSTS.has(url.hostname.toLowerCase())) return "";
    if (url.protocol !== "https:") url.protocol = "https:";

    const path = url.pathname.toLowerCase();
    if (
      !path ||
      path === "/" ||
      path.includes("/search") ||
      path.includes("/vds/") ||
      path.includes("pagenotfound") ||
      /(?:^|\/)(?:category|categories)(?:\/|$)/i.test(path)
    ) {
      return "";
    }

    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

/**
 * Return an external ABM product URL only when we can verify the mapping from
 * the staged record itself without guessing:
 *  - product belongs to a vector/virus family under Genetic Materials
 *  - source is an official ABM individual product URL
 *  - the URL basename contains the exact Cat.No.
 *
 * Older ABM pages whose URL omits the Cat.No. intentionally fail this check and
 * stay internal until they are added to a separately reviewed manual map.
 */
export function verifiedAbmVectorProductUrl(record: AbmVectorLinkRecord) {
  if (!isVectorFamilyRecord(record)) return "";

  const sku = String(record.sku || "").trim();
  if (!sku) return "";

  const manual = MANUALLY_VERIFIED_VECTOR_URLS[sku.toUpperCase()];
  if (manual) return manual;

  const candidates = [record.sourceUrl, record.url]
    .map(cleanOfficialProductUrl)
    .filter(Boolean);

  return candidates.find((url) => {
    try {
      return exactSkuPresentInProductPath(new URL(url).pathname, sku);
    } catch {
      return false;
    }
  }) || "";
}

export function isVerifiedAbmVectorExternal(record: AbmVectorLinkRecord) {
  return Boolean(verifiedAbmVectorProductUrl(record));
}
