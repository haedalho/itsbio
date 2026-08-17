import * as cheerio from "cheerio";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = await fetch("https://www.kentscientific.com/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ITSBIO-Brand-Audit/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });

  const html = await response.text();
  const $ = cheerio.load(html);

  const images = $("header img, img")
    .map((_, element) => {
      const image = $(element);
      return {
        src: image.attr("src") || "",
        srcset: image.attr("srcset") || "",
        alt: image.attr("alt") || "",
        className: image.attr("class") || "",
        id: image.attr("id") || "",
        parentClass: image.parent().attr("class") || "",
        inHeader: image.closest("header").length > 0,
      };
    })
    .get()
    .filter((item) => /logo|kent|scientific/i.test(`${item.src} ${item.srcset} ${item.alt} ${item.className} ${item.id} ${item.parentClass}`));

  const icons = $('link[rel*="icon"], link[rel*="apple"]')
    .map((_, element) => ({
      rel: $(element).attr("rel") || "",
      href: $(element).attr("href") || "",
      sizes: $(element).attr("sizes") || "",
    }))
    .get();

  return NextResponse.json({
    status: response.status,
    finalUrl: response.url,
    images,
    icons,
  });
}
