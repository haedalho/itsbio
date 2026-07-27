import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = new Set(["www.kentscientific.com", "kentscientific.com"]);
const PLACEHOLDER = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#f8fafc"/>
  <rect x="140" y="140" width="920" height="920" rx="48" fill="none" stroke="#cbd5e1" stroke-width="8"/>
  <path d="M380 730l150-160 120 115 92-94 160 170" fill="none" stroke="#94a3b8" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="450" cy="430" r="62" fill="#cbd5e1"/>
  <text x="600" y="930" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="44">Kent Scientific product image</text>
</svg>`;

function placeholderResponse(status = 502) {
  return new NextResponse(PLACEHOLDER, {
    status,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const source = requestUrl.searchParams.get("src") || "";

  let target: URL;
  try {
    target = new URL(source);
  } catch {
    return placeholderResponse(400);
  }

  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return placeholderResponse(403);
  }

  if (!target.pathname.startsWith("/wp-content/uploads/")) {
    return placeholderResponse(403);
  }

  try {
    const response = await fetch(target.toString(), {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        referer: "https://www.kentscientific.com/",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      },
      cache: "force-cache",
      next: { revalidate: 604800 },
    });

    if (!response.ok) return placeholderResponse(response.status);

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) return placeholderResponse(415);

    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      },
    });
  } catch {
    return placeholderResponse();
  }
}
