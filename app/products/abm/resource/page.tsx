import * as cheerio from "cheerio";
import Link from "next/link";
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

const KB_GROUPS = [
  "Introduction",
  "Methods and Tools",
  "sgRNA Design",
  "Screening and Validation",
  "Gene Regulation with dCas9",
  "Gene Knockout/Knock-in Case Studies",
  "Gene Silencing Methods: CRISPR vs. RNAi vs. TALENs",
  "Guide for CRISPR Gene Knockout",
  "CRISPR Crash Course",
] as const;

const KB_SUBSECTIONS: Record<string, string[]> = {
  "Methods and Tools": [
    "Video Summary",
    "CRISPR Design Tools",
    "Non-viral Gene Delivery",
    "Planning Your Experiment",
    "Our Experience with CRISPR Cas9 Gene Delivery",
    "References",
  ],
  "Gene Regulation with dCas9": [
    "Video Summary",
    "dCas9 as a Tool for Transcriptional Modulation",
    "dCas9 Mediated Gene Activation and Repression",
    "dCas9 Mediated Epigenetic Editing",
    "Modulating DNA methylation status with dCas9 systems",
    "References",
  ],
};

function cleanTitle(value: string) {
  return value.replace(/\s*\|\s*abm.*$/i, "").replace(/\s+/g, " ").trim() || "ABM Learning Resource";
}

function slugifyHeading(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isCrisprKnowledgeBase(sourceUrl: string) {
  return sourceUrl === METHODS_SOURCE || sourceUrl === DCAS9_SOURCE;
}

function knowledgeBaseGroup(sourceUrl: string) {
  return sourceUrl === DCAS9_SOURCE ? "Gene Regulation with dCas9" : "Methods and Tools";
}

function internalResourceHref(sourceUrl: string) {
  return `/products/abm/resource?u=${encodeURIComponent(sourceUrl)}`;
}

function groupHref(group: string) {
  if (group === "Methods and Tools") return internalResourceHref(METHODS_SOURCE);
  if (group === "Gene Regulation with dCas9") return internalResourceHref(DCAS9_SOURCE);
  return "";
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

  article.find("h1,h2,h3,h4,h5,h6").each((_, element) => {
    const heading = $(element);
    const text = heading.text().replace(/\s+/g, " ").trim();
    if (!text || heading.attr("id")) return;
    const id = slugifyHeading(text);
    if (id) heading.attr("id", id);
  });

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
    const isUiAsset = /(?:logo|flag|avatar|social|share|cart|pdf[-_ ]?icon|\/assets\/img\/general\/)/i.test(label);
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

function KnowledgeBaseSidebar({ sourceUrl }: { sourceUrl: string }) {
  const active = knowledgeBaseGroup(sourceUrl);
  const subsections = KB_SUBSECTIONS[active] || [];

  return (
    <aside className="kb-sidebar self-start lg:sticky lg:top-24">
      <div className="kb-sidebar-title">CRISPR Cas9</div>
      <nav aria-label="CRISPR Cas9 knowledge base">
        {KB_GROUPS.map((group) => {
          const href = groupHref(group);
          const isActive = group === active;
          return (
            <div key={group} className={`kb-nav-group ${isActive ? "is-active" : ""}`}>
              {href ? (
                <Link href={href} className="kb-nav-heading">{group}</Link>
              ) : (
                <div className="kb-nav-heading kb-nav-heading-static">{group}</div>
              )}
              {isActive && subsections.length ? (
                <div className="kb-nav-subitems">
                  {subsections.map((label) => (
                    <a key={label} href={`#${slugifyHeading(label)}`}>{label}</a>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

const KB_STYLE = `
.kb-page{background:#fff}
.kb-page .kb-shell{display:grid;gap:42px;grid-template-columns:280px minmax(0,1fr);align-items:start}
.kb-sidebar{border:1px solid #e5e7eb;background:#fff}
.kb-sidebar-title{padding:18px 20px;background:#f36b34;color:#fff;font-size:23px;font-weight:700;line-height:1.2}
.kb-nav-group{border-top:1px solid #e7e7e7}
.kb-nav-group:first-child{border-top:0}
.kb-nav-heading{display:block;padding:12px 18px;color:#333;text-decoration:none;font-size:14px;font-weight:700;line-height:1.35;transition:background .15s ease,color .15s ease}
.kb-nav-heading:hover{background:#f7f7f7;color:#e85f2f}
.kb-nav-heading-static{color:#555}
.kb-nav-group.is-active>.kb-nav-heading{background:#f36b34;color:#fff}
.kb-nav-subitems{padding:8px 0 12px;background:#fafafa}
.kb-nav-subitems a{display:block;padding:5px 18px 5px 28px;color:#555;text-decoration:none;font-size:12.5px;line-height:1.4}
.kb-nav-subitems a:hover{color:#e85f2f;text-decoration:underline}
.kb-article{min-width:0;max-width:920px}
.kb-article-header{border-bottom:1px solid #d9d9d9;padding-bottom:12px;margin-bottom:18px}
.kb-article h1{margin:0;color:#333;font-size:32px;font-weight:500;line-height:1.2;letter-spacing:-.02em}
.kb-readtime{display:flex;align-items:center;gap:7px;margin-top:12px;color:#888;font-size:13px}
.kb-clock{position:relative;width:15px;height:15px;border:1.5px solid #9a9a9a;border-radius:50%}
.kb-clock:before{content:"";position:absolute;left:6px;top:3px;width:1px;height:4px;background:#9a9a9a}
.kb-clock:after{content:"";position:absolute;left:6px;top:7px;width:3px;height:1px;background:#9a9a9a;transform:rotate(30deg);transform-origin:left center}
.kb-body{color:#444;font-size:15px;line-height:1.72}
.kb-body :is(h1,h2,h3,h4){scroll-margin-top:112px}
.kb-body h2,.kb-body h3{color:#ed6634!important;font-weight:600!important;letter-spacing:-.01em!important}
.kb-body h2{font-size:25px!important;margin:34px 0 14px!important}
.kb-body h3{font-size:20px!important;margin:28px 0 12px!important}
.kb-body p{margin:0 0 15px!important;line-height:1.72!important}
.kb-body ul,.kb-body ol{margin:8px 0 18px 22px!important;padding:0!important}
.kb-body li{margin:5px 0!important}
.kb-body img{display:block;max-width:100%!important;height:auto!important;margin:20px auto!important}
.kb-body a{color:#e85f2f!important;text-decoration:none!important}
.kb-body a:hover{text-decoration:underline!important}
.kb-body .abm-table-scroll{margin:18px 0 26px!important;border:0!important;border-radius:0!important;box-shadow:none!important}
.kb-body .abm-data-table{width:100%!important;border-collapse:collapse!important;font-size:13px!important}
.kb-body .abm-data-table th{background:#ef6a36!important;color:white!important;border:1px solid #ddd!important;padding:9px 10px!important;text-align:center!important}
.kb-body .abm-data-table td{background:#fff!important;color:#444!important;border:1px solid #ddd!important;padding:8px 10px!important;vertical-align:middle!important}
@media(max-width:1023px){.kb-page .kb-shell{grid-template-columns:1fr}.kb-sidebar{position:static!important}.kb-article{max-width:none}}
@media(max-width:640px){.kb-article h1{font-size:27px}.kb-body{font-size:14px}.kb-sidebar-title{font-size:20px}.kb-nav-subitems{display:none}}
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

  const isKb = isCrisprKnowledgeBase(sourceUrl);
  const readTime = sourceUrl === DCAS9_SOURCE ? "45 min Read" : "35 min Read";

  return (
    <div className={isKb ? "kb-page bg-white" : "bg-white"}>
      <style dangerouslySetInnerHTML={{ __html: isKb ? KB_STYLE : "" }} />
      <AbmHeroBanner title={isKb ? "CRISPR Cas9" : title} eyebrow="ABM Learning Resource" />
      <div className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-[1320px] px-6 py-5">
          <Breadcrumb items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            { label: "ABM", href: "/products/abm" },
            { label: "CRISPR", href: "/products/abm/genetic-materials/crispr" },
            { label: title, href: internalResourceHref(sourceUrl) },
          ]} />
        </div>
      </div>

      <main className="mx-auto max-w-[1320px] px-6 py-10">
        {isKb ? (
          <div className="kb-shell">
            <KnowledgeBaseSidebar sourceUrl={sourceUrl} />
            <article className="kb-article">
              <header className="kb-article-header">
                <h1>{title}</h1>
                <div className="kb-readtime"><span className="kb-clock" aria-hidden="true" />{readTime}</div>
              </header>
              {articleHtml ? (
                <HtmlContent html={articleHtml} baseUrl={sourceUrl} mode="abm-detail" className="kb-body" />
              ) : (
                <div className="border-y border-neutral-200 py-8 text-sm leading-7 text-neutral-700">
                  This ABM learning resource is temporarily unavailable. Please contact ITS BIO for the source material.
                </div>
              )}
            </article>
          </div>
        ) : (
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
        )}
      </main>
    </div>
  );
}
