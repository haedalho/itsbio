import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OFFICIAL_IMAGES: Record<
  string,
  { sourceUrl: string; referer: string }
> = {
  "somnosuite-y-adapter": {
    sourceUrl:
      "https://www.kentscientific.com/Customer-Content/www/products/Photos/Full/SOMNO-0602_10-4500_4_5.jpg",
    referer:
      "https://www.kentscientific.com/products/somnosuite-y-adapter/",
  },
};

export async function GET(request: NextRequest) {
  const slug = String(request.nextUrl.searchParams.get("slug") || "").trim();
  const image = OFFICIAL_IMAGES[slug];

  if (!image) {
    return new Response("Unknown Kent official image", { status: 404 });
  }

  try {
    const response = await fetch(image.sourceUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: image.referer,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
      },
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 * 30 },
    });

    if (!response.ok) {
      return new Response(`Kent image request failed: ${response.status}`, {
        status: 502,
      });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new Response("Kent image response was not an image", { status: 502 });
    }

    const body = await response.arrayBuffer();
    if (!body.byteLength) {
      return new Response("Kent image response was empty", { status: 502 });
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Kent official image proxy failed", { slug, error });
    return new Response("Kent image request failed", { status: 502 });
  }
}
