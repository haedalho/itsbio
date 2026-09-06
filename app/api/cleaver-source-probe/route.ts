import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE = "https://www.thistlescientific.com/product/multisub-mini-mini-horizontal-electrophoresis-system/";
const SECTION_LABELS = ["Specifications", "What's Included", "Video", "Documents", "All Variations", "Accessories"];

function decode(value: string) {
  return value.replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'").replace(/&amp;/g, "&");
}

function svgNear(html: string, label: string) {
  const index = html.toLowerCase().indexOf(label.toLowerCase());
  if (index < 0) return null;
  const before = html.slice(Math.max(0, index - 3000), index + 300);
  const svgs = [...before.matchAll(/<svg\b[\s\S]*?<\/svg>/gi)].map((match) => match[0]);
  return svgs.at(-1)?.slice(0, 2400) || null;
}

export async function GET() {
  try {
    const response = await fetch(SOURCE, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (compatible; ITS-BIO-CleaverCatalog/1.0; +https://itsbio.vercel.app)",
      },
      cache: "no-store",
    });
    const html = await response.text();
    const rawImages = [...html.matchAll(/(?:src|data-src|data-large_image|href)=["']([^"']+\.(?:jpe?g|png|webp))(?:\?[^"']*)?["']/gi)]
      .map((match) => decode(match[1]))
      .filter((url) => /MSMINI/i.test(url));
    const imageUrls = Array.from(new Set(rawImages));
    const likelyGallery = imageUrls.filter((url) => !/-150x150\.|\/woocommerce-placeholder|MS7-|MS10-|CSL-CAB|MSMINIBSB|MSMINICP/i.test(url));

    return NextResponse.json({
      status: response.status,
      bytes: html.length,
      imageUrls,
      likelyGallery,
      likelyGalleryCount: likelyGallery.length,
      sectionIcons: Object.fromEntries(SECTION_LABELS.map((label) => [label, svgNear(html, label)])),
      markers: Object.fromEntries(SECTION_LABELS.map((label) => [label, html.toLowerCase().includes(label.toLowerCase())])),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
