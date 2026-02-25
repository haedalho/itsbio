import { NextResponse } from "next/server";

import { parseAbmProductDetail } from "@/lib/abm/abm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000);

  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    signal: controller.signal,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    },
  });

  clearTimeout(t);
  if (!res.ok) {
    const sample = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} :: ${sample.slice(0, 120)}`);
  }
  return await res.text();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = (searchParams.get("url") || "").trim();
  if (!url) return NextResponse.json({ ok: false, error: "Missing url" }, { status: 200 });

  try {
    const html = await fetchHtml(url);
    const parsed = parseAbmProductDetail(html, url);

    // 너무 큰 HTML은 길이만 노출
    return NextResponse.json(
      {
        ok: true,
        sku: parsed.sku,
        title: parsed.title,
        sourceUrl: parsed.sourceUrl,
        categoryPathTitles: parsed.categoryPathTitles,
        categoryPathSlugs: parsed.categoryPathSlugs,
        sizes: {
          datasheet: parsed.datasheetHtml?.length || 0,
          documents: parsed.documentsHtml?.length || 0,
          faqs: parsed.faqsHtml?.length || 0,
          references: parsed.referencesHtml?.length || 0,
          reviews: parsed.reviewsHtml?.length || 0,
        },
        docs: parsed.docs.slice(0, 20),
        imageUrls: parsed.imageUrls.slice(0, 20),
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("ABM preview error:", e?.name, e?.message, e?.cause);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}
