import { abmResourcePagePath, normalizeAbmResourcePageUrl } from "@/lib/abm/resource-links";

const ABM_HOSTS = new Set(["abmgood.com", "www.abmgood.com", "info.abmgood.com"]);
const DOCUMENT_PATH = /\.(?:pdf|docx?|xlsx?|pptx?|csv|zip)(?:$|[?#])/i;
const COMMERCE_PATH = /\/(?:free-sample|shopping-cart|checkout|customer\/account|my-account)(?:\/|$)/i;

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

  if (COMMERCE_PATH.test(resolved.pathname)) return "";
  if (resolved.pathname.startsWith("/uploads/") || DOCUMENT_PATH.test(resolved.pathname)) {
    return resolved.toString();
  }

  resolved.hash = "";
  return `/products/abm/legacy?u=${encodeURIComponent(resolved.toString())}`;
}
