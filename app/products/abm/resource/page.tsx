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

const METHODS_SOURCE = "https://info.abmgood.com/crispr-cas9-methods-tools";
const DCAS9_SOURCE = "https://info.abmgood.com/crispr-cas9-gene-regulation-dCas9";

function cleanTitle(value: string) {
  return value.replace(/\s*\|\s*abm.*$/i, "").replace(/\s+/g, " ").trim() || "ABM Learning Resource";
}

function isCrisprKnowledgeResource(sourceUrl: string) {
  return sourceUrl === METHODS_SOURCE || sourceUrl === DCAS9_SOURCE;
}

function fallbackReadTime(sourceUrl: string) {
  if (sourceUrl === METHODS_SOURCE) return "35 min Read";
  if (sourceUrl === DCAS9_SOURCE) return "45 min Read";
  return "";
}

function cleanResourceArtifacts($: cheerio.CheerioAPI, article: cheerio.Cheerio<any>) {
  // Official KB pages contain utility/list markup around icons and navigation.
  // Once those UI images are removed, empty anchors/list items can survive and
  // show up as rows of bullets in our rich-content styles. Remove only nodes
  // with no meaningful text/media so real editorial lists remain untouched.
  article.find("a").each((_, element) => {
    const anchor = $(element);
    const text = anchor.text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const hasContent = anchor.find("img,svg,picture,video,table").length > 0;
    if (!text && !hasContent) anchor.remove();
  });

  article.find("li").each((_, element) => {
    const item = $(element);
    const text = item.text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const hasContent = item.find("img,svg,picture,video,table").length > 0;
    if ((!text || /^[•·.\-–—]+$/.test(text)) && !hasContent) item.remove();
  });

  // Run twice because removing nested empty list items can make their parents empty.
  for (let pass = 0; pass < 2; pass += 1) {
    article.find("ul,ol").each((_, element) => {
      const list = $(element);
      const text = list.text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      if (!text && !list.find("img,svg,picture,video,table").length) list.remove();
    });
  }
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

  const articleText = article.text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const detectedReadTime = articleText.match(/\b\d+\s*min\s*Read\b/i)?.[0] || "";
  const readTime = detectedReadTime || fallbackReadTime(sourceUrl);

  article.find(".abm-kb-right-title").first().remove();

  // The read-time row is recreated by ITS BIO directly below the article title.
  // Remove only compact source elements whose entire text is the read-time label.
  if (readTime) {
    article.find("p,span,div").each((_, element) => {
      const node = $(element);
      const text = node.text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      if (text.toLowerCase() === readTime.toLowerCase() && node.children().length <= 2) node.remove();
    });
  }

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

  cleanResourceArtifacts($, article);

  return { title, html: article.html()?.trim() || "", readTime };
}

const CRISPR_RESOURCE_STYLE = `
.abm-crispr-resource-article{min-width:0}
.abm-crispr-resource-header{max-width:940px;border-bottom:1px solid #d8d8d8;padding-bottom:15px;margin-bottom:22px}
.abm-crispr-resource-title{margin:0;color:#333;font-size:32px;font-weight:500;line-height:1.22;letter-spacing:-.025em}
.abm-crispr-resource-readtime{display:flex;align-items:center;gap:7px;margin-top:11px;color:#858585;font-size:13px;line-height:1.4}
.abm-crispr-resource-clock{position:relative;display:inline-block;width:15px;height:15px;border:1.5px solid #999;border-radius:50%;flex:0 0 auto}
.abm-crispr-resource-clock:before{content:"";position:absolute;left:6px;top:3px;width:1px;height:4px;background:#999}
.abm-crispr-resource-clock:after{content:"";position:absolute;left:6px;top:7px;width:3px;height:1px;background:#999;transform:rotate(28deg);transform-origin:left center}
.abm-crispr-resource-body{max-width:940px;color:#444!important;font-size:15px!important;line-height:1.72!important}
.abm-crispr-resource-body a::after{content:none!important;display:none!important}
.abm-crispr-resource-body a{color:#e86532!important;text-decoration:none!important}
.abm-crispr-resource-body a:hover{text-decoration:underline!important}
.abm-crispr-resource-body :is(h1,h2,h3,h4,h5,h6){scroll-margin-top:110px;color:#333!important;font-family:inherit!important}
.abm-crispr-resource-body h2{margin:34px 0 14px!important;color:#ef6633!important;font-size:25px!important;font-weight:600!important;line-height:1.3!important}
.abm-crispr-resource-body h3{margin:28px 0 12px!important;color:#ef6633!important;font-size:21px!important;font-weight:600!important;line-height:1.35!important}
.abm-crispr-resource-body h4{margin:24px 0 10px!important;color:#333!important;font-size:17px!important;font-weight:700!important;line-height:1.4!important}
.abm-crispr-resource-body p{margin:0 0 15px!important;color:#444!important;font-size:15px!important;line-height:1.72!important}
.abm-crispr-resource-body ul,.abm-crispr-resource-body ol{margin:8px 0 20px 22px!important;padding:0!important}
.abm-crispr-resource-body ul{list-style:disc outside!important}
.abm-crispr-resource-body ol{list-style:decimal outside!important}
.abm-crispr-resource-body li{margin:5px 0!important;padding-left:3px!important;color:#444!important;line-height:1.65!important}
.abm-crispr-resource-body li:empty{display:none!important}
.abm-crispr-resource-body img{display:block;max-width:100%!important;height:auto!important;margin:20px auto 24px!important;border:0!important;border-radius:0!important;box-shadow:none!important}
.abm-crispr-resource-body .abm-table-scroll{margin:18px 0 28px!important;border:0!important;border-radius:0!important;box-shadow:none!important;overflow-x:auto!important}
.abm-crispr-resource-body .abm-data-table{width:100%!important;border-collapse:collapse!important;border-spacing:0!important;font-size:13px!important}
.abm-crispr-resource-body .abm-data-table th{background:#ef6633!important;color:#fff!important;border:1px solid #d7d7d7!important;padding:9px 10px!important;text-align:center!important;font-weight:700!important}
.abm-crispr-resource-body .abm-data-table td{background:#fff!important;color:#444!important;border:1px solid #d7d7d7!important;padding:8px 10px!important;vertical-align:middle!important}
.abm-crispr-resource-body hr{margin:20px 0!important;border:0!important;border-top:1px solid #ddd!important}
@media(max-width:767px){.abm-crispr-resource-title{font-size:27px}.abm-crispr-resource-body{font-size:14px!important}.abm-crispr-resource-body p{font-size:14px!important}.abm-crispr-resource-body h2{font-size:22px!important}.abm-crispr-resource-body h3{font-size:19px!important}}
`;

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
  let readTime = fallbackReadTime(sourceUrl);
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
      readTime = extracted.readTime || readTime;
    }
  } catch {
    // The internal page remains available with a clear source-retrieval state.
  }

  const isCrisprResource = isCrisprKnowledgeResource(sourceUrl);

  return (
    <div className="bg-white">
      {isCrisprResource ? <style dangerouslySetInnerHTML={{ __html: CRISPR_RESOURCE_STYLE }} /> : null}
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
          <article className={isCrisprResource ? "abm-crispr-resource-article" : "min-w-0"}>
            {isCrisprResource ? (
              <header className="abm-crispr-resource-header">
                <h1 className="abm-crispr-resource-title">{title}</h1>
                {readTime ? (
                  <div className="abm-crispr-resource-readtime">
                    <span className="abm-crispr-resource-clock" aria-hidden="true" />
                    <span>{readTime}</span>
                  </div>
                ) : null}
              </header>
            ) : (
              <h1 className="text-3xl font-bold tracking-tight text-neutral-950">{title}</h1>
            )}

            {articleHtml ? (
              <div className={isCrisprResource ? "" : "mt-7"}>
                <HtmlContent
                  html={articleHtml}
                  baseUrl={sourceUrl}
                  mode="abm-detail"
                  className={isCrisprResource ? "abm-crispr-resource-body" : undefined}
                />
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
