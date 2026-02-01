// lib/sanity/image.ts
import createImageUrlBuilder from "@sanity/image-url";
import { sanityClient } from "@/lib/sanity/sanity.client";

const builder = createImageUrlBuilder(sanityClient);

// ✅ 타입 경로 문제 회피: 어떤 형태의 image reference/document도 받게
export function urlFor(source: unknown) {
  return builder.image(source as any);
}
