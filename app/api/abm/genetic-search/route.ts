import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const LANDING_URL = "https://www.abmgood.com/expression-ready-libraries.html";
const SEARCH_URL = "https://www.abmgood.com/product/searchProducts";
const ALLOWED_FILTERS = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "10", "11", "31"]);

function clean(value: unknown, maxLength = 200) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function validFilter(value: string) {
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 && parts.length <= 8 && parts.every((part) => ALLOWED_FILTERS.has(part));
}

function responseCookies(headers: Headers) {
  const values = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : (headers.get("set-cookie") || "").split(/,(?=\s*[^;,]+=)/);
  return values.map((value) => value.split(";", 1)[0]).filter(Boolean).join("; ");
}

function safeOfficialProductUrl(value: unknown) {
  const key = clean(value, 300).replace(/^\/+/, "");
  if (!key || !/^[a-z0-9][a-z0-9._~!$&'()*+,;=:@%/-]*$/i.test(key)) return "";
  return `https://www.abmgood.com/${key}`;
}

function safeResult(product: Record<string, unknown>) {
  const info = product.info && typeof product.info === "object"
    ? product.info as Record<string, unknown>
    : {};
  const seo = product.seo && typeof product.seo === "object"
    ? product.seo as Record<string, unknown>
    : {};
  return {
    sku: clean(product.cat_no, 64),
    title: clean(product.name, 240),
    species: clean(product.species, 100),
    accession: clean(product.accession_number, 100),
    category: clean(product.category_name, 120),
    vector: clean(info.vector, 120),
    promoter: clean(info.promoter, 120),
    url: safeOfficialProductUrl(seo.url_key),
  };
}

export async function GET(request: NextRequest) {
  const query = clean(request.nextUrl.searchParams.get("q"), 120);
  const filter = clean(request.nextUrl.searchParams.get("filter"), 40);
  const page = Math.min(100, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1));

  if (query.length < 2) {
    return NextResponse.json({ error: "Enter at least 2 characters." }, { status: 400 });
  }
  if (!validFilter(filter)) {
    return NextResponse.json({ error: "Unsupported Genetic Materials filter." }, { status: 400 });
  }

  try {
    const landing = await fetch(LANDING_URL, {
      cache: "no-store",
      headers: { accept: "text/html", "user-agent": "ITSBIO-ABM-Genetic-Search/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!landing.ok) throw new Error(`ABM landing HTTP ${landing.status}`);
    const html = await landing.text();
    const token = html.match(/name=["']X-CSRF-TOKEN["'][^>]+content=["']([^"']+)/i)?.[1]
      || html.match(/content=["']([^"']+)["'][^>]+name=["']X-CSRF-TOKEN["']/i)?.[1]
      || "";
    const cookie = responseCookies(landing.headers);
    if (!token || !cookie) throw new Error("ABM search session is unavailable");

    const upstream = await fetch(SEARCH_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        cookie,
        referer: LANDING_URL,
        "user-agent": "ITSBIO-ABM-Genetic-Search/1.0",
        "x-csrf-token": token,
      },
      body: JSON.stringify({ _token: token, query, filter_id: filter, page }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) throw new Error(`ABM search HTTP ${upstream.status}`);
    const payload = await upstream.json();
    const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
    const products = Array.isArray(data.products) ? data.products : [];

    return NextResponse.json({
      query,
      page: Math.max(1, Number(data.page) || page),
      lastPage: Math.max(1, Number(data.lastPage) || 1),
      total: Math.max(0, Number(data.total) || 0),
      results: products.map((product: Record<string, unknown>) => safeResult(product)),
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[ABM genetic search]", error);
    return NextResponse.json(
      { error: "The ABM catalog search is temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }
}
