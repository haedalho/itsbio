import { NextResponse } from "next/server";

import { abmSearchUrl, parseAbmSearch, looksLikeCatNo } from "@/lib/abm/abm";

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
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qRaw = (searchParams.get("q") || "").trim();
  const q = qRaw.replace(/\s+/g, " ").trim();

  if (!q) {
    return NextResponse.json({ ok: false, error: "Missing q" }, { status: 200 });
  }

  // 키워드 입력은 resolve 대상이 아님(요구사항). 다만 Cat.No/짧은 코드만 resolve 허용.
  if (!looksLikeCatNo(q)) {
    return NextResponse.json({ ok: true, type: "skip", abmSearchUrl: abmSearchUrl(q) }, { status: 200 });
  }

  try {
    const url = abmSearchUrl(q);
    const html = await fetchHtml(url);
    const result = parseAbmSearch(html, q);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (e: any) {
    console.error("ABM resolve fetch error:", e?.name, e?.message, e?.cause);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}
