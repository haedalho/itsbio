// app/go/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const u = url.searchParams.get("u") || "";

  try {
    const target = new URL(u);

    // 안전: http/https만 허용
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return NextResponse.json({ ok: false, error: "Invalid protocol" }, { status: 400 });
    }

    return NextResponse.redirect(target.toString(), 302);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid url" }, { status: 400 });
  }
}
