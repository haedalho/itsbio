import { abmResourcePagePath, normalizeAbmResourcePageUrl } from "@/lib/abm/resource-links";

const ABM_HOSTS = new Set(["abmgood.com", "www.abmgood.com", "info.abmgood.com"]);
const DOCUMENT_PATH = /\.(?:pdf|docx?|xlsx?|pptx?|csv|zip)(?:$|[?#])/i;
const COMMERCE_PATH = /\/(?:free-sample|shopping-cart|checkout|customer\/account|my-account)(?:\/|$)/i;

const ABM_CATEGORY_ROUTES = new Map<string, string>([
  ["/crispr-cas9-sgrna.html", "/products/abm/genetic-materials/crispr"],
  ["/a1bg-crispr-cas9-knockout.html", "/products/abm/genetic-materials/crispr/crispr-ko-vectors-and-virus"],
  ["/crispr-knockout-library.html", "/products/abm/genetic-materials/crispr/crispr-ko-vectors-and-virus"],
  ["/crispr-activation-lentivirus-library.html", "/products/abm/genetic-materials/crispr/crispr-activation-vectors"],
  ["/cas9-expression-vectors-and-viruses.html", "/products/abm/genetic-materials/crispr/cas9-vectors-and-virus"],
  ["/cas9-proteins.html", "/products/abm/genetic-materials/crispr/cas-proteins-and-crispr-screening"],
  ["/custom-crispr-vectors-viruses.html", "/products/abm/services/dna-and-cloning-services/custom-crispr-vectors-and-viruses"],
]);

export function isOfficialAbmUrl(value: string) {
  try {
    return ABM_HOSTS.has(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Keep ABM product/service navigation inside ITS BIO. Official files remain
 * direct downloads, while official HTML pages go through the staged resolver.
 */
export function internalizeAbmHref(rawHref: string, baseUrl = "") {
  const href = String(rawHref || "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!href || href.startsWith("#") || /^(?:mailto:|tel:)/i.test(href)) return href;
  if (/^\/(?:products|notice|promotions|studio-admin|contact|quote)(?:\/|$|\?)/i.test(href)) return href;

  let resolved: URL;
  try {
    resolved = new URL(href, baseUrl || "https://www.abmgood.com");
  } catch {
    return href;
  }

  if (!ABM_HOSTS.has(resolved.hostname.toLowerCase())) return resolved.toString();
  resolved.protocol = "https:";
  if (normalizeAbmResourcePageUrl(resolved.toString())) return abmResourcePagePath(resolved.toString());
  resolved.hostname = "www.abmgood.com";

  const categoryRoute = ABM_CATEGORY_ROUTES.get(resolved.pathname.toLowerCase().replace(/\/+$/, "") || "/");
  if (categoryRoute) return categoryRoute;

  if (COMMERCE_PATH.test(resolved.pathname)) return "";
  if (resolved.pathname.startsWith("/uploads/") || DOCUMENT_PATH.test(resolved.pathname)) {
    return resolved.toString();
  }

  resolved.hash = "";
  return `/products/abm/legacy?u=${encodeURIComponent(resolved.toString())}`;
}
