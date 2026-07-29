#!/usr/bin/env node
import fs from "node:fs";

const file = "components/products/KentProductDetailClientV2.tsx";
const source = fs.readFileSync(file, "utf8");
const before = `  const galleryImages = React.useMemo(() => {\n    const variantImage = safeExternalUrl(selectedVariant?.imageUrl);\n    const head = variantImage ? [{ url: variantImage, alt: selectedVariant?.title || title }] : [];\n    return dedupeImages([...(head as Img[]), ...(images || [])]);\n  }, [images, selectedVariant?.imageUrl, selectedVariant?.title, title]);`;
const after = `  const galleryImages = React.useMemo(() => {\n    // A verified official gallery is authoritative. Legacy variant image URLs may\n    // point to thumbnails, page-body graphics or stale assets, so they must not\n    // be injected into an approved/staging official gallery.\n    if (verifiedGallery) return dedupeImages(images || []);\n\n    const variantImage = safeExternalUrl(selectedVariant?.imageUrl);\n    const head = variantImage ? [{ url: variantImage, alt: selectedVariant?.title || title }] : [];\n    return dedupeImages([...(head as Img[]), ...(images || [])]);\n  }, [images, selectedVariant?.imageUrl, selectedVariant?.title, title, verifiedGallery]);`;

if (source.includes(after)) {
  console.log("Verified gallery variant-image protection already applied.");
  process.exit(0);
}
if (!source.includes(before)) {
  throw new Error("Expected gallery image block not found.");
}
fs.writeFileSync(file, source.replace(before, after), "utf8");
console.log("Prevented legacy variant images from entering verified galleries.");
