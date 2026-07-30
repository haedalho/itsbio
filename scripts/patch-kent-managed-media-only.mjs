#!/usr/bin/env node
import fs from "node:fs";

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Expected block not found: ${label}`);
  return source.replace(before, after);
}

const routeFile = "app/products/kent/item/[...slug]/page.tsx";
let route = fs.readFileSync(routeFile, "utf8");

const oldNormalize = `function normalizeImages(product: any, title: string) {
  const assetUrls = Array.isArray(product?.images)
    ? product.images.map((image: any) => image?.asset?.url).filter((url: any) => typeof url === "string" && url.trim())
    : [];
  const verifiedUrls = Array.isArray(product?.galleryImageUrls)
    ? product.galleryImageUrls.filter((url: any) => typeof url === "string" && url.trim())
    : [];
  const rawUrls = Array.isArray(product?.imageUrls)
    ? product.imageUrls.filter((url: any) => typeof url === "string" && url.trim())
    : [];

  const source = assetUrls.length ? assetUrls : verifiedUrls.length ? verifiedUrls : rawUrls;
  const seen = new Set<string>();
  return source
    .map((url: unknown) => String(url).trim())
    .filter((url: string) => url && !isGalleryNoiseUrl(url))
    .filter((url: string) => {
      const key = imageMasterKey(url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((url: string) => ({ url, alt: title }));
}`;

const newNormalize = `function isManagedKentImageUrl(input?: unknown) {
  const value = String(input || "").trim();
  if (!value) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "cdn.sanity.io";
  } catch {
    return false;
  }
}

function normalizeImages(product: any, title: string) {
  // Active product galleries may only use files uploaded to Sanity. Legacy
  // imageUrls/galleryImageUrls remain source metadata and never render.
  const source = Array.isArray(product?.images)
    ? product.images
        .map((image: any) => image?.asset?.url)
        .filter((url: any) => isManagedKentImageUrl(url))
    : [];
  const seen = new Set<string>();
  return source
    .map((url: unknown) => String(url).trim())
    .filter((url: string) => url && !isGalleryNoiseUrl(url))
    .filter((url: string) => {
      const key = imageMasterKey(url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((url: string) => ({ url, alt: title }));
}`;

if (!route.includes(newNormalize)) {
  route = replaceRequired(route, oldNormalize, newNormalize, "managed gallery normalization");
}

route = route.replace(
  `.filter((image: any) => typeof image?.sourceUrl === "string" && image.sourceUrl.trim())`,
  `.filter((image: any) => isManagedKentImageUrl(image?.sourceUrl))`,
);
route = route.replace(
  `? official.fallbackImages.filter((image) => image?.url)`,
  `? official.fallbackImages.filter((image) => isManagedKentImageUrl(image?.url))`,
);

fs.writeFileSync(routeFile, route, "utf8");

const rendererFile = "components/products/KentProductSectionRendererV2.tsx";
let renderer = fs.readFileSync(rendererFile, "utf8");

const priceLine = `const PRICE_COLUMN_RE = /^(?:price|pricing|unit price|list price|retail price|sale price|dealer price|your price|online price|web price|net price|msrp|cost|amount)$/i;`;
const managedHelpers = `${priceLine}

function isManagedKentImageUrl(input?: unknown) {
  const value = String(input || "").trim();
  if (!value) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "cdn.sanity.io";
  } catch {
    return false;
  }
}

function stripUnmanagedImages(html?: string) {
  return String(html || "").replace(
    /<img\\b[^>]*\\bsrc\\s*=\\s*(["'])(.*?)\\1[^>]*>/gi,
    (tag, _quote, src) => (isManagedKentImageUrl(src) ? tag : ""),
  );
}`;

if (!renderer.includes("function isManagedKentImageUrl")) {
  renderer = replaceRequired(renderer, priceLine, managedHelpers, "renderer managed media helpers");
}

renderer = renderer.replace(
  `      cleanText(section.imageUrl) ||`,
  `      isManagedKentImageUrl(section.imageUrl) ||`,
);

const oldHtmlBlock = `function HtmlBlock({ html }: { html?: string }) {
  if (!cleanText(html)) return null;
  return (
    <div
      className="prose prose-slate max-w-none prose-a:font-semibold prose-a:text-[#0755a6] prose-a:no-underline hover:prose-a:underline prose-headings:text-[#0a4d96] prose-h2:text-[29px] prose-h3:text-[22px] prose-p:text-[16px] prose-p:leading-8 prose-li:text-[16px] prose-li:leading-7 prose-img:h-auto prose-img:max-w-full prose-table:w-full prose-table:border-collapse prose-th:border-b prose-th:border-slate-300 prose-th:bg-white prose-th:px-4 prose-th:py-3 prose-th:text-[#0a4d96] prose-td:border-b prose-td:border-slate-200 prose-td:px-4 prose-td:py-3"
      dangerouslySetInnerHTML={{ __html: String(html || "") }}
    />
  );
}`;
const newHtmlBlock = `function HtmlBlock({ html }: { html?: string }) {
  const managedHtml = stripUnmanagedImages(html);
  if (!cleanText(managedHtml)) return null;
  return (
    <div
      className="prose prose-slate max-w-none prose-a:font-semibold prose-a:text-[#0755a6] prose-a:no-underline hover:prose-a:underline prose-headings:text-[#0a4d96] prose-h2:text-[29px] prose-h3:text-[22px] prose-p:text-[16px] prose-p:leading-8 prose-li:text-[16px] prose-li:leading-7 prose-img:h-auto prose-img:max-w-full prose-table:w-full prose-table:border-collapse prose-th:border-b prose-th:border-slate-300 prose-th:bg-white prose-th:px-4 prose-th:py-3 prose-th:text-[#0a4d96] prose-td:border-b prose-td:border-slate-200 prose-td:px-4 prose-td:py-3"
      dangerouslySetInnerHTML={{ __html: managedHtml }}
    />
  );
}`;
if (!renderer.includes("const managedHtml = stripUnmanagedImages(html);")) {
  renderer = replaceRequired(renderer, oldHtmlBlock, newHtmlBlock, "managed HTML images");
}

const oldMedia = `function MediaImage({ src, alt, className = "" }: { src?: string; alt: string; className?: string }) {
  const [visible, setVisible] = React.useState(Boolean(src));
  React.useEffect(() => setVisible(Boolean(src)), [src]);
  if (!visible || !src) return null;`;
const newMedia = `function MediaImage({ src, alt, className = "" }: { src?: string; alt: string; className?: string }) {
  const managed = isManagedKentImageUrl(src);
  const [visible, setVisible] = React.useState(managed);
  React.useEffect(() => setVisible(isManagedKentImageUrl(src)), [src]);
  if (!visible || !src || !managed) return null;`;
if (!renderer.includes("const managed = isManagedKentImageUrl(src);")) {
  renderer = replaceRequired(renderer, oldMedia, newMedia, "managed section image component");
}

renderer = renderer.replace(
  `        if (item.imageUrl) return null;`,
  `        if (isManagedKentImageUrl(item.imageUrl)) return null;`,
);
renderer = renderer.replace(
  `        const imageUrl = String(item.imageUrl || resolvedImages[slug] || "");`,
  `        const explicitImage = isManagedKentImageUrl(item.imageUrl) ? String(item.imageUrl) : "";
        const resolvedImage = isManagedKentImageUrl(resolvedImages[slug]) ? String(resolvedImages[slug]) : "";
        const imageUrl = explicitImage || resolvedImage;`,
);
renderer = renderer.replace(
  `{entry.answerHtml ? <div dangerouslySetInnerHTML={{ __html: entry.answerHtml }} /> : <p>{entry.answerText}</p>}`,
  `{entry.answerHtml ? <div dangerouslySetInnerHTML={{ __html: stripUnmanagedImages(entry.answerHtml) }} /> : <p>{entry.answerText}</p>}`,
);

fs.writeFileSync(rendererFile, renderer, "utf8");
console.log("Applied managed-only Kent media policy.");
