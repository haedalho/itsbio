const RESOURCE_PAGE_HOSTS = new Set(["info.abmgood.com"]);
const RESOURCE_IMAGE_HOSTS = new Set(["abmgood.com", "www.abmgood.com", "info.abmgood.com"]);
const RESOURCE_IMAGE_PATH = /\/(?:assets\/images|assets\/img|uploads\/images|hubfs)\//i;
const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|webp)$/i;

function cleanUrl(rawValue: string) {
  return String(rawValue || "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

export function normalizeAbmResourcePageUrl(rawValue: string) {
  const value = cleanUrl(rawValue);
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!RESOURCE_PAGE_HOSTS.has(url.hostname.toLowerCase())) return "";
    url.protocol = "https:";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function isOfficialAbmResourceImageUrl(rawValue?: string) {
  const value = cleanUrl(rawValue || "");
  if (!value) return false;
  try {
    const url = new URL(value);
    return RESOURCE_IMAGE_HOSTS.has(url.hostname.toLowerCase())
      && RESOURCE_IMAGE_PATH.test(url.pathname)
      && IMAGE_EXTENSION.test(url.pathname);
  } catch {
    return false;
  }
}

export function abmResourcePagePath(rawValue: string) {
  const url = normalizeAbmResourcePageUrl(rawValue);
  return url ? `/products/abm/resource?u=${encodeURIComponent(url)}` : "";
}

export function abmResourceImagePath(rawValue: string) {
  return isOfficialAbmResourceImageUrl(rawValue)
    ? `/products/abm/resource-image?u=${encodeURIComponent(rawValue)}`
    : "";
}
