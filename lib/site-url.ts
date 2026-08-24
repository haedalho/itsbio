const FALLBACK_SITE_URL = "https://itsbio.vercel.app";

export function siteUrl() {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL).trim();
  try {
    const url = new URL(configured);
    return url.origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export function absoluteSiteUrl(path = "/") {
  return new URL(path, `${siteUrl()}/`).toString();
}
