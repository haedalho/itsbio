#!/usr/bin/env node
import fs from "node:fs";

const file = "app/products/kent/item/[...slug]/page.tsx";
const source = fs.readFileSync(file, "utf8");
const before = `  const stagedOfficialImages = ["STAGING", "APPROVED"].includes(String(product?.kentOfficialGalleryStatus || ""))
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
  const verifiedGallery = officialImages.length > 0;`;
const after = `  const galleryStatus = String(product?.kentOfficialGalleryStatus || "");
  const stagedOfficialImages = ["STAGING", "APPROVED"].includes(galleryStatus)
    ? (Array.isArray(product?.kentOfficialGallery) ? product.kentOfficialGallery : [])
        .filter((image: any) => typeof image?.sourceUrl === "string" && image.sourceUrl.trim())
        .sort((a: any, b: any) => Number(a?.order || 0) - Number(b?.order || 0))
        .map((image: any) => ({ url: String(image.sourceUrl).trim(), alt: cleanText(image.alt) || title }))
    : [];
  const overrideOfficialImages = Array.isArray(official?.fallbackImages)
    ? official.fallbackImages.filter((image) => image?.url)
    : [];
  const activeProductImages = normalizeImages(product, title);
  const approvedActiveImages = galleryStatus === "APPROVED" && !stagedOfficialImages.length
    ? activeProductImages
    : [];
  const officialImages = stagedOfficialImages.length
    ? stagedOfficialImages
    : overrideOfficialImages.length
      ? overrideOfficialImages
      : approvedActiveImages;
  const images = officialImages.length ? officialImages : activeProductImages.slice(0, 1);
  const verifiedGallery = officialImages.length > 0;`;

if (source.includes(after)) {
  console.log("Approved active gallery handling already applied.");
  process.exit(0);
}
if (!source.includes(before)) throw new Error("Expected gallery selection block not found.");
fs.writeFileSync(file, source.replace(before, after), "utf8");
console.log("Applied approved active Kent gallery handling.");
