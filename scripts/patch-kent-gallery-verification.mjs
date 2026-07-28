#!/usr/bin/env node
import fs from "node:fs";

function replaceExact(path, before, after) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(before)) {
    throw new Error(`Expected source block not found in ${path}`);
  }
  fs.writeFileSync(path, source.replace(before, after), "utf8");
}

const galleryPath = "components/products/KentProductGalleryClient.tsx";
replaceExact(
  galleryPath,
  `function isDirectKentImage(url?: string) {\n  const raw = String(url || "").trim();\n  if (!raw) return false;\n  try {\n    const host = new URL(raw, "https://www.kentscientific.com").hostname.toLowerCase();\n    return host === "kentscientific.com" || host === "www.kentscientific.com";\n  } catch {\n    return false;\n  }\n}\n\nfunction normalizeGalleryImages(images: Img[]) {`,
  `function normalizeGalleryImages(images: Img[], verifiedGallery: boolean) {`,
);
replaceExact(
  galleryPath,
  `  // Multiple thumbnails are shown only when every supplied image is a direct,\n  // full-size Kent source image. Legacy Sanity/page-wide arrays are reduced to\n  // a single representative image until the product receives a verified\n  // official gallery snapshot.\n  const trustedOfficialSet = normalized.length > 0 && normalized.every((image) => isDirectKentImage(image.url));\n  return (trustedOfficialSet ? normalized.slice(0, MAX_GALLERY_IMAGES) : normalized.slice(0, 1));`,
  `  // A Kent-domain URL alone is not proof that an image belongs to the product\n  // gallery. Page-body graphics and legacy thumbnails are hosted on the same\n  // domain. Multiple thumbnails are allowed only when the server explicitly\n  // marks the supplied list as a verified official gallery snapshot.\n  return verifiedGallery ? normalized.slice(0, MAX_GALLERY_IMAGES) : normalized.slice(0, 1);`,
);
replaceExact(
  galleryPath,
  `export default function KentProductGalleryClient({\n  images,\n  title,\n}: {\n  productSlug: string;\n  images: Img[];\n  title: string;\n}) {\n  const initialImages = React.useMemo(() => normalizeGalleryImages(images), [images]);`,
  `export default function KentProductGalleryClient({\n  images,\n  title,\n  verifiedGallery = false,\n}: {\n  productSlug: string;\n  images: Img[];\n  title: string;\n  verifiedGallery?: boolean;\n}) {\n  const initialImages = React.useMemo(\n    () => normalizeGalleryImages(images, verifiedGallery),\n    [images, verifiedGallery],\n  );`,
);

const detailPath = "components/products/KentProductDetailClientV2.tsx";
replaceExact(
  detailPath,
  `  images,\n  kentSections,`,
  `  images,\n  verifiedGallery,\n  kentSections,`,
);
replaceExact(
  detailPath,
  `  images: Img[];\n  kentSections?: KentSection[];`,
  `  images: Img[];\n  verifiedGallery?: boolean;\n  kentSections?: KentSection[];`,
);
replaceExact(
  detailPath,
  `            images={galleryImages}\n            title={title}`,
  `            images={galleryImages}\n            title={title}\n            verifiedGallery={verifiedGallery}`,
);

const routePath = "app/products/kent/item/[...slug]/page.tsx";
replaceExact(
  routePath,
  `  const images = officialImages.length ? officialImages : productImages;`,
  `  // Only an explicitly verified official snapshot may render as a multi-image\n  // gallery. Unverified legacy arrays are reduced to one representative image.\n  const images = officialImages.length ? officialImages : productImages.slice(0, 1);`,
);
replaceExact(
  routePath,
  `          images={images}\n          kentSections={kentSections as any[]}`,
  `          images={images}\n          verifiedGallery={officialImages.length > 0}\n          kentSections={kentSections as any[]}`,
);

console.log("Applied explicit Kent gallery verification gate.");
