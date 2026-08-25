import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE = "https://www.thistlescientific.com/product/microdoc-gel-documentation-hood-with-screen/?ss=global";

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
    return NextResponse.json({
      status: response.status,
      bytes: html.length,
      markers: {
        overview: /Overview/i.test(html),
        specifications: /Specifications/i.test(html),
        included: /What(?:'|&#0?39;|’)?s Included/i.test(html),
        documents: /Documents/i.test(html),
        variations: /All Variations/i.test(html),
        accessories: /Accessories/i.test(html),
      },
      tableCount: (html.match(/<table\b/gi) || []).length,
      pdfCount: (html.match(/\.pdf(?:[?"'&#]|$)/gi) || []).length,
      productLinkCount: (html.match(/\/product\//gi) || []).length,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
