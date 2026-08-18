import { NextRequest, NextResponse } from "next/server";

import { isOfficialAbmResourceImageUrl } from "@/lib/abm/resource-links";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const sourceUrl = request.nextUrl.searchParams.get("u") || "";
  if (!isOfficialAbmResourceImageUrl(sourceUrl)) {
    return NextResponse.json({ error: "Invalid ABM resource image" }, { status: 400 });
  }

  try {
    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": "ITSBIO-ABM-Resource/1.0" },
      next: { revalidate: 604800 },
      signal: AbortSignal.timeout(15000),
    });
    const contentType = response.headers.get("content-type") || "";
    const contentLength = Number.parseInt(response.headers.get("content-length") || "0", 10);
    if (!response.ok || !contentType.toLowerCase().startsWith("image/") || contentLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Resource image unavailable" }, { status: 502 });
    }

    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Resource image too large" }, { status: 413 });
    }

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Resource image unavailable" }, { status: 502 });
  }
}
