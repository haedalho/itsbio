import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const KENT_BASE = "https://www.kentscientific.com";
export const SHOP_URL = `${KENT_BASE}/shop/`;

export function clean(value) {
  return String(value ?? "").trim();
}

export function stripTags(value) {
  return clean(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePath(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean).join("/").toLowerCase();
  return clean(value).replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/").toLowerCase();
}

export function normalizeSku(value) {
  return clean(value)
    .normalize("NFKC")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9._/-]/g, "");
}

export function humanizeSlug(slug) {
  return clean(slug)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function cleanTitle(value, slug) {
  return (
    stripTags(value)
      .replace(/\s*[|–—]\s*Kent Scientific(?: Corporation)?\s*$/i, "")
      .trim() || humanizeSlug(slug)
  );
}

export function normalizeAbsoluteUrl(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw, KENT_BASE);
    url.hash = "";
    url.search = "";
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = decodeURIComponent(url.pathname).replace(/\/{2,}/g, "/");
    return url.toString();
  } catch {
    return "";
  }
}

export function normalizedUrlKey(value) {
  const abs = normalizeAbsoluteUrl(value);
  if (!abs) return "";
  try {
    const url = new URL(abs);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "").toLowerCase()}`;
  } catch {
    return abs.toLowerCase().replace(/\/$/, "");
  }
}

export function kentSlugFromHref(value) {
  const raw = clean(value);
  if (!raw) return "";
  const internalPatterns = [
    /^\/?products\/kent\/item\/([^/?#]+)\/?$/i,
    /^\/?kent\/item\/([^/?#]+)\/?$/i,
    /^\/?item\/([^/?#]+)\/?$/i,
  ];
  for (const pattern of internalPatterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1].replace(/^\/+|\/+$/g, "");
  }
  const abs = normalizeAbsoluteUrl(raw);
  if (!abs) return "";
  try {
    const url = new URL(abs);
    if (!/(^|\.)kentscientific\.com$/i.test(url.hostname)) return "";
    const match = url.pathname.match(/^\/products\/([^/]+)\/?$/i);
    return match?.[1] ? match[1].replace(/^\/+|\/+$/g, "") : "";
  } catch {
    return "";
  }
}

export function kentCategoryPathFromHref(value) {
  const abs = normalizeAbsoluteUrl(value);
  if (!abs) return "";
  try {
    const url = new URL(abs);
    if (!/(^|\.)kentscientific\.com$/i.test(url.hostname)) return "";
    const match = url.pathname.match(/^\/product\/(.+?)\/?$/i);
    return match?.[1] ? normalizePath(match[1]) : "";
  } catch {
    return "";
  }
}

export function canonicalSourceUrl(slug) {
  return `${KENT_BASE}/products/${clean(slug).replace(/^\/+|\/+$/g, "")}/`;
}

export function stableProductId(slug) {
  const hash = crypto.createHash("sha1").update(`kent|${slug}`).digest("hex").slice(0, 24);
  return `product-kent-${hash}`;
}

export function unique(values, normalizer = (value) => clean(value).toLowerCase()) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const key = normalizer(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function best(values, fallback = "") {
  return [...(values || [])]
    .map(clean)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] || fallback;
}

export function createFetchPage(root, refresh = false) {
  const cacheDir = path.join(root, ".cache", "kent-product-census", "http");
  return async function fetchPage(url) {
    fs.mkdirSync(cacheDir, { recursive: true });
    const hash = crypto.createHash("sha1").update(url).digest("hex");
    const cachePath = path.join(cacheDir, `${hash}.json`);
    if (!refresh && fs.existsSync(cachePath)) {
      try {
        return JSON.parse(fs.readFileSync(cachePath, "utf8"));
      } catch {
        // Ignore corrupt cache.
      }
    }

    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      try {
        const response = await fetch(url, {
          redirect: "follow",
          signal: controller.signal,
          headers: {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
        const text = await response.text();
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const result = {
          requestedUrl: url,
          finalUrl: response.url || url,
          status: response.status,
          contentType: response.headers.get("content-type") || "",
          text,
        };
        fs.writeFileSync(cachePath, JSON.stringify(result), "utf8");
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  };
}

export async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index], index) };
      } catch (error) {
        results[index] = { status: "rejected", reason: error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, () => run()));
  return results;
}
