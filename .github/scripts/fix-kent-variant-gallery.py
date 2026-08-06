from pathlib import Path
import re

page = Path('app/products/kent/item/[...slug]/page.tsx')
text = page.read_text()
text = text.replace(
    'images[]{ _key, asset->{ url } },',
    'images[]{ _key, sourceUrl, asset->{ url } },',
)

new_normalize = r'''function normalizeImages(product: any, title: string) {
  // Preserve Kent's original image URL beside the Sanity asset. Variant data
  // still identifies images by the Kent URL, so sourceUrl is the join key.
  const source = Array.isArray(product?.images)
    ? product.images
        .map((image: any) => ({
          url: String(image?.asset?.url || "").trim(),
          sourceUrl: String(image?.sourceUrl || "").trim(),
          alt: title,
        }))
        .filter((image: any) => isManagedKentImageUrl(image.url))
    : [];
  const seen = new Set<string>();
  return source
    .filter((image: any) => image.url && !isGalleryNoiseUrl(image.url) && !isGalleryNoiseUrl(image.sourceUrl))
    .filter((image: any) => {
      const key = imageMasterKey(image.url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}'''
text, count = re.subn(
    r'function normalizeImages\(product: any, title: string\) \{.*?\n\}\n\nfunction sectionBody',
    new_normalize + '\n\nfunction sectionBody',
    text,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f'normalizeImages replacement count={count}')

marker = '  const galleryStatus = String(product?.kentOfficialGalleryStatus || "");'
replacement = '''  const sourceUrlByAssetUrl = new Map<string, string>(
    (Array.isArray(product?.images) ? product.images : [])
      .filter((image: any) => isManagedKentImageUrl(image?.asset?.url))
      .map((image: any) => [
        String(image.asset.url).trim(),
        String(image?.sourceUrl || "").trim(),
      ]),
  );
  const galleryStatus = String(product?.kentOfficialGalleryStatus || "");'''
if marker not in text:
    raise SystemExit('galleryStatus marker missing')
text = text.replace(marker, replacement, 1)

old_map = '.map((image: any) => ({ url: String(image.sourceUrl).trim(), alt: cleanText(image.alt) || title }))'
new_map = '''.map((image: any) => {
        const url = String(image.sourceUrl).trim();
        return {
          url,
          sourceUrl: sourceUrlByAssetUrl.get(url) || "",
          alt: cleanText(image.alt) || title,
        };
      })'''
if old_map not in text:
    raise SystemExit('staged official image map missing')
text = text.replace(old_map, new_map, 1)
page.write_text(text)

detail = Path('components/products/KentProductDetailClient.tsx')
text = detail.read_text()
text = text.replace(
    'type Img = { url?: string; alt?: string };',
    'type Img = { url?: string; alt?: string; sourceUrl?: string };',
    1,
)
text = text.replace(
    '}) as { url: string; alt?: string }[];',
    '}) as { url: string; alt?: string; sourceUrl?: string }[];',
    1,
)

new_resolution = r'''function variantSearchText(variant: Variant | null) {
  if (!variant) return "";
  return normalizeValue(
    [
      variant.optionSummary,
      variant.title,
      ...Object.values(buildVariantLookup(variant)),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function imageSourceKey(input?: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, "https://www.kentscientific.com");
    const decoded = decodeURIComponent(url.pathname).toLowerCase();
    return decoded.replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+$)/i, "");
  } catch {
    return raw.split("?")[0].toLowerCase().replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+$)/i, "");
  }
}

const IMAGE_TOKEN_STOP_WORDS = new Set([
  "image", "img", "product", "copy", "final", "new", "v2", "left", "right",
  "front", "back", "side", "view", "single", "channel", "system", "with", "for",
  "the", "and", "jpg", "jpeg", "png", "webp", "kent", "scientific",
]);

function sourceTokens(input?: string) {
  const key = imageSourceKey(input)
    .replace(/^.*\//, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, " ");
  return new Set(
    key.split(/\s+/)
      .filter((token) => token.length >= 2)
      .filter((token) => !IMAGE_TOKEN_STOP_WORDS.has(token)),
  );
}

function findKeywordImage(
  selectedVariant: Variant | null,
  images: Array<{ url: string; alt?: string; sourceUrl?: string }>,
) {
  const variantTokens = new Set(
    variantSearchText(selectedVariant)
      .split("-")
      .filter((token) => token.length >= 2)
      .filter((token) => !IMAGE_TOKEN_STOP_WORDS.has(token)),
  );
  if (!variantTokens.size) return null;

  const ranked = images
    .map((image) => {
      const tokens = sourceTokens(image.sourceUrl || image.url);
      let score = 0;
      for (const token of tokens) if (variantTokens.has(token)) score += 1;
      return { image, score };
    })
    .sort((a, b) => b.score - a.score);

  if (!ranked[0] || ranked[0].score < 1) return null;
  if (ranked[1] && ranked[1].score === ranked[0].score) return null;
  return ranked[0].image;
}

function resolveSelectedGalleryImage({
  slug,
  selectedVariant,
  variants,
  images,
}: {
  slug: string;
  selectedVariant: Variant | null;
  variants: Variant[];
  images: { url: string; alt?: string; sourceUrl?: string }[];
}) {
  if (!images.length) return null;

  const selectedVariantImage = safeVariantImageUrl(selectedVariant?.imageUrl);
  const selectedSourceKey = imageSourceKey(selectedVariantImage);
  const managedVariantImage = selectedSourceKey
    ? images.find((image) => imageSourceKey(image.sourceUrl) === selectedSourceKey)
    : null;

  // Use the Sanity-managed copy of the exact Kent variant image first.
  if (managedVariantImage) return managedVariantImage;

  // Kent supplies one shared variant image for all VetFlo vaporizer options.
  // Its gallery still contains distinct tabletop and pole-mounted system views.
  if (slug === VETFLO_VAPORIZER_SLUG && images.length >= 4) {
    const isPoleMounted = variantSearchText(selectedVariant).includes("pole-mounted");
    return isPoleMounted ? images[3] : images[0];
  }

  const distinctVariantImages = new Set(
    variants
      .map((variant) => imageSourceKey(safeVariantImageUrl(variant.imageUrl)))
      .filter(Boolean),
  );

  if (selectedVariantImage && distinctVariantImages.size > 1) {
    return { url: selectedVariantImage, alt: selectedVariant?.title, sourceUrl: selectedVariantImage };
  }

  const selectedIndex = selectedVariant
    ? variants.findIndex((variant) => variant.variantId === selectedVariant.variantId)
    : -1;

  // Exact one-to-one galleries retain the source ordering of their variants.
  if (selectedIndex >= 0 && variants.length === images.length) {
    return images[selectedIndex] || images[0];
  }

  // Only accept filename matching when one image is the unique best match.
  return findKeywordImage(selectedVariant, images) || images[0];
}'''
text, count = re.subn(
    r'function variantSearchText\(variant: Variant \| null\) \{.*?\n\}\n\nexport default function',
    new_resolution + '\n\nexport default function',
    text,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f'variant resolution replacement count={count}')
detail.write_text(text)

gallery = Path('components/products/KentProductGalleryClient.tsx')
text = gallery.read_text()
text = text.replace(
    'type Img = { url?: string; alt?: string };',
    'type Img = { url?: string; alt?: string; sourceUrl?: string };',
    1,
)
text = text.replace(
    'alt: String(image?.alt || "").trim() || title,',
    'alt: String(image?.alt || "").trim() || title,\n      sourceUrl: String(image?.sourceUrl || "").trim(),',
    1,
)
gallery.write_text(text)
