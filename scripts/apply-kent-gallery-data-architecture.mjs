#!/usr/bin/env node
import fs from "node:fs";

function replaceExact(file, before, after) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes(before)) throw new Error(`Expected block not found in ${file}`);
  fs.writeFileSync(file, source.replace(before, after), "utf8");
}

const galleryFile = "components/products/KentProductGalleryClient.tsx";
fs.writeFileSync(
  galleryFile,
  `"use client";

import Image from "next/image";
import * as React from "react";

type Img = { url?: string; alt?: string };

const MAX_VERIFIED_GALLERY_IMAGES = 12;
const PLACEHOLDER = "/kent-product-placeholder.svg";

function imageKey(url?: string) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, "https://www.kentscientific.com");
    return \`\${parsed.origin}\${decodeURIComponent(parsed.pathname)}\`.toLowerCase();
  } catch {
    return raw.split("?")[0].toLowerCase();
  }
}

function normalizeGalleryImages(images: Img[], verifiedGallery: boolean) {
  const rows: { url: string; alt?: string }[] = [];
  const seen = new Set<string>();

  for (const image of Array.isArray(images) ? images : []) {
    const url = String(image?.url || "").trim();
    const key = imageKey(url);
    if (!url || !key || seen.has(key)) continue;
    seen.add(key);
    rows.push({ url, alt: image?.alt });
  }

  // No filename, domain, thumbnail or visual heuristic decides gallery membership.
  // The server-provided verifiedGallery flag means that this exact ordered list
  // was captured from the official product gallery. Legacy data is never allowed
  // to create a multi-image gallery.
  return verifiedGallery
    ? rows.slice(0, MAX_VERIFIED_GALLERY_IMAGES)
    : rows.slice(0, 1);
}

export default function KentProductGalleryClient({
  images,
  title,
  verifiedGallery = false,
}: {
  productSlug: string;
  images: Img[];
  title: string;
  verifiedGallery?: boolean;
}) {
  const initialImages = React.useMemo(
    () => normalizeGalleryImages(images, verifiedGallery),
    [images, verifiedGallery],
  );
  const [failedUrls, setFailedUrls] = React.useState<Set<string>>(() => new Set());
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    setFailedUrls(new Set());
    setActiveIndex(0);
  }, [initialImages]);

  const safeImages = React.useMemo(
    () => initialImages.filter((image) => !failedUrls.has(image.url)),
    [failedUrls, initialImages],
  );

  React.useEffect(() => {
    if (activeIndex >= safeImages.length) setActiveIndex(0);
  }, [activeIndex, safeImages.length]);

  const active = safeImages[activeIndex] || safeImages[0] || null;
  const hasThumbnails = safeImages.length > 1;

  const markFailed = React.useCallback((url?: string) => {
    const value = String(url || "").trim();
    if (!value) return;
    setFailedUrls((current) => {
      if (current.has(value)) return current;
      const next = new Set(current);
      next.add(value);
      return next;
    });
  }, []);

  return (
    <div className={hasThumbnails ? "grid gap-4 md:grid-cols-[72px_minmax(0,1fr)]" : "grid"}>
      {hasThumbnails ? (
        <div className="order-2 flex max-w-full gap-3 overflow-x-auto pb-1 md:order-1 md:max-h-[560px] md:flex-col md:overflow-x-hidden md:overflow-y-auto">
          {safeImages.map((img, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={\`\${img.url}-\${idx}\`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={\`View \${title} image \${idx + 1}\`}
                className={[
                  "relative h-[70px] w-[70px] shrink-0 overflow-hidden rounded-md border bg-white transition",
                  isActive ? "border-[#0b4fb3] ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-400",
                ].join(" ")}
              >
                <Image
                  src={img.url}
                  alt={img.alt || \`\${title} thumbnail \${idx + 1}\`}
                  fill
                  sizes="70px"
                  className="object-contain p-2"
                  unoptimized
                  onError={() => markFailed(img.url)}
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={\`\${hasThumbnails ? "order-1 md:order-2" : ""} relative overflow-hidden rounded-[12px] border border-slate-200 bg-white\`}>
        <div className="relative aspect-square min-h-[360px] lg:min-h-[520px]">
          {active?.url ? (
            <Image
              src={active.url}
              alt={active.alt || title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 620px"
              className="object-contain p-7 lg:p-9"
              unoptimized
              onError={() => markFailed(active.url)}
            />
          ) : (
            <Image
              src={PLACEHOLDER}
              alt={\`\${title} image unavailable\`}
              fill
              sizes="(max-width: 1024px) 100vw, 620px"
              className="object-contain p-10"
            />
          )}
        </div>
      </div>
    </div>
  );
}
`,
  "utf8",
);

const detailFile = "components/products/KentProductDetailClientV2.tsx";
replaceExact(detailFile, "  images,\n  kentSections,", "  images,\n  verifiedGallery,\n  kentSections,");
replaceExact(detailFile, "  images: Img[];\n  kentSections?: KentSection[];", "  images: Img[];\n  verifiedGallery?: boolean;\n  kentSections?: KentSection[];");
replaceExact(detailFile, "            images={galleryImages}\n            title={title}", "            images={galleryImages}\n            title={title}\n            verifiedGallery={verifiedGallery}");

const routeFile = "app/products/kent/item/[...slug]/page.tsx";
replaceExact(
  routeFile,
  "    imageFiles,\n    images[]{ _key, asset->{ url } }",
  `    imageFiles,
    images[]{ _key, asset->{ url } },
    kentOfficialGalleryStatus,
    kentOfficialGallery[]{
      _key,
      sourceUrl,
      alt,
      order,
      sourceWidth,
      sourceHeight,
      sourceFingerprint
    },
    kentOfficialSourceUrl,
    kentOfficialGalleryVerifiedAt,
    kentOfficialGalleryFingerprint`,
);
replaceExact(
  routeFile,
  "  const productImages = normalizeImages(product, title);\n  const officialImages = Array.isArray(official?.fallbackImages)\n    ? official.fallbackImages.filter((image) => image?.url)\n    : [];\n  const images = officialImages.length ? officialImages : productImages;",
  `  const stagedOfficialImages = ["STAGING", "APPROVED"].includes(String(product?.kentOfficialGalleryStatus || ""))
    ? (Array.isArray(product?.kentOfficialGallery) ? product.kentOfficialGallery : [])
        .filter((image: any) => typeof image?.sourceUrl === "string" && image.sourceUrl.trim())
        .sort((a: any, b: any) => Number(a?.order || 0) - Number(b?.order || 0))
        .map((image: any) => ({ url: String(image.sourceUrl).trim(), alt: cleanText(image.alt) || title }))
    : [];
  const overrideOfficialImages = Array.isArray(official?.fallbackImages)
    ? official.fallbackImages.filter((image) => image?.url)
    : [];
  const officialImages = stagedOfficialImages.length ? stagedOfficialImages : overrideOfficialImages;
  const productImages = normalizeImages(product, title).slice(0, 1);
  const images = officialImages.length ? officialImages : productImages;
  const verifiedGallery = officialImages.length > 0;`,
);
replaceExact(
  routeFile,
  "          images={images}\n          kentSections={kentSections as any[]}",
  "          images={images}\n          verifiedGallery={verifiedGallery}\n          kentSections={kentSections as any[]}",
);

console.log("Applied Kent official gallery data architecture.");
