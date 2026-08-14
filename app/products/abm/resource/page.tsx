import * as cheerio from "cheerio";
import { notFound } from "next/navigation";

import AbmCatalogSideNav from "@/components/products/AbmCatalogSideNav";
import AbmHeroBanner from "@/components/products/AbmHeroBanner";
import Breadcrumb from "@/components/site/Breadcrumb";
import HtmlContent from "@/components/site/HtmlContent";
import {
  abmResourceImagePath,
  isOfficialAbmResourceImageUrl,
  normalizeAbmResourcePageUrl,
} from "@/lib/abm/resource-links";

export const dynamic = "force-dynamic";
export const revalidate = 86400;

function cleanTitle(value: string) {
  return value.replace(/\s*\|\s*abm.*$/i, "").replace(/\s+/g, " ").trim() || "ABM Learning Resource";
}

function extractResourcePage(sourceHtml: string, sourceUrl: string) {
  const $ = cheerio.load(sourceHtml);
  $("script, style, noscript, iframe, form, input, button, nav, header, footer").remove();

  const article = $(".abm-kb-row .col-lg-8").first().length
    ? $(".abm-kb-row .col-lg-8").first()
    : $("main article, main, article, [role='main'], .body-container-wrapper").first();
  const title = cleanTitle(
    article.find(".abm-kb-right-title, h1").first().text()
      || $("h1").first().text()
      || $("title").text(),
  );

  article.find(".abm-kb-right-title").first().remove();
  article.find("img").each((_, element) => {
    const image = $(element);
    const rawSrc = image.attr("src") || image.attr("data-src") || image.attr("data-original") || "";
    let resolved = "";
    try {
      resolved = new URL(rawSrc, sourceUrl).toString();
    } catch {
      image.remove();
      return;
    }
    const width = Number.parseInt(image.attr("width") || "0", 10);
    const height = Number.parseInt(image.attr("height") || "0", 10);
    const label = `${resolved} ${image.attr("alt") || ""}`.toLowerCase();
    const isTiny = width > 0 && height > 0 && (width < 96 || height < 96);
    const isUiAsset = /(?:logo|flag|avatar|social|share|cart|timer|pdf[-_ ]?icon|\/assets\/img\/general\/)/i.test(label);
    if (!isOfficialAbmResourceImageUrl(resolved) || isTiny || isUiAsset) {
      image.remove();
      return;
    }
    image.attr("src", abmResourceImagePath(resolved));
    image.removeAttr("srcset data-srcset data-src data-original style width height");
    image.attr("loading", "lazy");
  });

  article.find("a[href]").each((_, element) => {
    const anchor = $(element);
    const rawHref = anchor.attr("href") || "";
    try {
      const resolved = new URL(rawHref, sourceUrl).toString();
      if (isOfficialAbmResourceImageUrl(resolved)) anchor.attr("href", abmResourceImagePath(resolved));
    } catch {
      // HtmlContent safely handles local anchors and malformed links.
    }
  });

  return { title, html: article.html()?.trim() || "" };
}

export default async function AbmResourcePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string }> | { u?: string };
}) {
  const resolvedSearch = await Promise.resolve(searchParams);
  const sourceUrl = normalizeAbmResourcePageUrl(resolvedSearch?.u || "");
  if (!sourceUrl) notFound();

  let title = "ABM Learning Resource";
  let articleHtml = "";
  try {
    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": "ITSBIO-ABM-Resource/1.0" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(20000),
    });
    if (response.ok) {
      const extracted = extractResourcePage(await response.text(), sourceUrl);
      title = extracted.title;
      articleHtml = extracted.html;
    }
  } catch {
    // The internal page remains available with a clear source-retrieval state.
  }

  return (
    <div className="bg-white">
      <AbmHeroBanner title={title} eyebrow="ABM Learning Resource" />
      <div className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-[1320px] px-6 py-5">
          <Breadcrumb items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            { label: "ABM", href: "/products/abm" },
            { label: "Resources", href: `/products/abm/resource?u=${encodeURIComponent(sourceUrl)}` },
            { label: title, href: `/products/abm/resource?u=${encodeURIComponent(sourceUrl)}` },
          ]} />
        </div>
      </div>

      <main className="mx-auto max-w-[1320px] px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]">
          <aside className="self-start lg:sticky lg:top-24">
            <AbmCatalogSideNav />
          </aside>
          <article className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950">{title}</h1>
            {articleHtml ? (
              <div className="mt-7">
                <HtmlContent html={articleHtml} baseUrl={sourceUrl} mode="abm-detail" />
              </div>
            ) : (
              <div className="mt-7 border-y border-neutral-200 py-8 text-sm leading-7 text-neutral-700">
                This ABM learning resource is temporarily unavailable. Please contact ITS BIO for the source material.
              </div>
            )}
          </article>
        </div>
      </main>
    </div>
  );
}
