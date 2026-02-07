// scripts/rehydrate-category-contentBlocks-from-legacy.mjs
import process from "node:process";
import * as cheerio from "cheerio";
import { createClient } from "next-sanity";

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

function normalizeText(s) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absolutifyUrl(raw, baseUrl) {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^\/\//.test(v)) return `https:${v}`;
  if (v.startsWith("/")) return `${baseUrl}${v}`;
  return v;
}

function stripScripts(html) {
  let out = html || "";
  out = out.replace(/<script[^>]*type=["']application\/ld\+json["'][\s\S]*?<\/script>/gi, "");
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  return out;
}

function stripAbmTopNavList(html) {
  return (html || "").replace(
    /<ul[^>]*class=["'][^"']*\babm-page-category-nav-list\b[^"']*["'][\s\S]*?<\/ul>/gi,
    ""
  );
}

function rewriteRelativeUrls(html, baseUrl) {
  if (!html) return "";
  let out = html;
  out = out.replace(
    /\s(href|src)=["'](\/(?!\/)[^"']*)["']/gi,
    (_m, attr, p) => ` ${attr}="${baseUrl}${p}"`
  );
  out = out.replace(
    /\s(href|src)=["'](\/\/[^"']+)["']/gi,
    (_m, attr, p) => ` ${attr}="https:${p}"`
  );
  return out;
}

function pickRoot($) {
  let root = $("#abm-category-right-outer").first();
  if (root.length) return root;

  const candidates = $(".col-md-9, .col-lg-9, .col-sm-12, .col-xs-12").toArray();
  for (const el of candidates) {
    const $el = $(el);
    if ($el.find("h2.abm-categories-title-h2").length) return $el;
  }

  root = $(".abm-categories-text").first().parent();
  if (root.length) return root;

  return null;
}

function extractTitle($, root) {
  const t =
    normalizeText(root?.find("h2.abm-categories-title-h2").first().text()) ||
    normalizeText($("h2.abm-categories-title-h2").first().text()) ||
    normalizeText($("h1").first().text()) ||
    normalizeText($("title").first().text()) ||
    "";
  return t.includes("|") ? normalizeText(t.split("|")[0]) : t;
}

function extractResources($, root, baseUrl) {
  const list = root.find("ul.htmlcontent-home").first();
  if (!list.length) return [];

  const items = [];
  const lis = list.find("li").toArray();

  for (const li of lis) {
    const $li = $(li);

    const a = $li.find("a").first();
    const href = absolutifyUrl(a.attr("href"), baseUrl);

    const img = $li.find("img").first();
    const rawSrc = img.attr("src") || "";
    const imageUrl = absolutifyUrl(rawSrc, baseUrl);

    let title =
      normalizeText($li.find(".abm-category-image-title strong").first().text()) ||
      normalizeText($li.find("strong").first().text()) ||
      normalizeText(img.attr("alt")) ||
      "";

    let subtitle =
      normalizeText($li.find(".abm-category-image-title i").first().text()) ||
      normalizeText($li.find("i").first().text()) ||
      "Learning Resources";

    if (!href || !title) continue;

    items.push({
      _type: "contentResourceItem",
      title,
      subtitle,
      href,
      imageUrl,
      meta: {
        imageUrlRaw: rawSrc,
        imageUrlUsed: imageUrl,
        imageStatus: imageUrl ? "ok" : "missing",
        imageReason: imageUrl ? "" : "no src",
      },
    });
  }

  return items;
}

function extractTopPublications($, root, baseUrl) {
  const pubs = [];
  const table = root
    .find("table")
    .filter((_i, el) => $(el).find(".citations-num").length > 0)
    .first();

  if (!table.length) return pubs;

  const rows = table.find("tr").toArray();
  for (const tr of rows) {
    const $tr = $(tr);

    const noText =
      normalizeText($tr.find(".citations-num").first().text()) ||
      normalizeText($tr.find("td").first().text());

    const order = parseInt(String(noText).replace(/\D/g, ""), 10);
    const td = $tr.find("td").eq(1);

    const citation = normalizeText(td.text());
    if (!citation) continue;

    let doi = "";
    const doiA = td
      .find("a")
      .toArray()
      .map((a) => $(a).attr("href"))
      .find((h) => /doi\.org/i.test(h || ""));
    if (doiA) doi = absolutifyUrl(doiA, baseUrl);

    let product = "";
    const m = citation.match(/Product:\s*(.+)$/i);
    if (m) product = normalizeText(m[1]);

    pubs.push({
      _type: "contentPublicationItem",
      order: Number.isFinite(order) ? order : undefined,
      citation,
      doi,
      product,
    });
  }

  pubs.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return pubs;
}

function extractHtml($, root, baseUrl) {
  const work = root.clone();

  work.find("ul.abm-page-category-nav-list").remove();
  work.find("ul.htmlcontent-home").remove();
  work.find("table").filter((_i, el) => $(el).find(".citations-num").length > 0).remove();
  work.find("script").remove();
  work.find("h2.abm-categories-title-h2").first().remove();

  let html = work.html() || "";
  html = stripScripts(html);
  html = stripAbmTopNavList(html);
  html = rewriteRelativeUrls(html, baseUrl);
  html = html.trim();

  // ✅ 핵심: Genetic 같은 케이스 fallback
  if (normalizeText(html).length < 20) {
    const text = root.find(".abm-categories-text").first();
    if (text.length) {
      let fb = $.html(text);
      fb = stripScripts(fb);
      fb = stripAbmTopNavList(fb);
      fb = rewriteRelativeUrls(fb, baseUrl);
      fb = fb.trim();
      if (normalizeText(fb).length >= 20) html = fb;
    } else {
      html = "";
    }
  }

  return html;
}

function buildBlocks({ html, resources, pubs }) {
  const blocks = [];

  if (html && normalizeText(html).length >= 20) {
    blocks.push({ _type: "contentBlockHtml", title: "Content", html });
  }
  if (Array.isArray(resources) && resources.length) {
    blocks.push({ _type: "contentBlockResources", title: "Resources", items: resources });
  }
  if (Array.isArray(pubs) && pubs.length) {
    blocks.push({ _type: "contentBlockPublications", title: "Top Publications", items: pubs });
  }

  return blocks;
}

async function main() {
  const id = arg("--id");
  const baseUrl = arg("--baseUrl") || "https://www.abmgood.com";
  const dryRun = process.argv.includes("--dryRun");

  if (!id) {
    console.error("Usage: node --env-file=.env.local scripts/rehydrate-category-contentBlocks-from-legacy.mjs --id <docId> --baseUrl https://www.abmgood.com [--dryRun]");
    process.exit(1);
  }

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const token = process.env.SANITY_WRITE_TOKEN;

  if (!projectId || !dataset) {
    throw new Error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET");
  }
  if (!dryRun && !token) {
    throw new Error("Missing SANITY_WRITE_TOKEN (required when not dryRun)");
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion: "2025-01-01",
    useCdn: false,
    token: dryRun ? undefined : token,
  });

  const doc = await client.fetch(
    `*[_type=="category" && _id==$id][0]{ _id, title, legacyHtml }`,
    { id }
  );

  const legacyHtml = String(doc?.legacyHtml || "");
  const legacyHtmlLen = legacyHtml.length;

  const $ = cheerio.load(legacyHtml);
  const root = pickRoot($);

  const rootFound = !!(root && root.length);
  let title = "";
  let html = "";
  let resources = [];
  let pubs = [];

  if (rootFound) {
    title = extractTitle($, root);
    resources = extractResources($, root, baseUrl);
    pubs = extractTopPublications($, root, baseUrl);
    html = extractHtml($, root, baseUrl);
  }

  const blocks = buildBlocks({ html, resources, pubs });

  const result = {
    id,
    title: title || normalizeText(doc?.title || ""),
    rootFound,
    legacyHtmlLen,
    htmlLen: html ? html.length : 0,
    resourcesCount: resources.length,
    pubsCount: pubs.length,
    blocksCount: blocks.length,
    blockTypes: blocks.map((b) => b._type),
  };

  console.log(JSON.stringify(result, null, 2));

  if (dryRun) {
    console.log("DRY RUN: not patching.");
    return;
  }

  // ✅ bullets 같은 “쓰레기 블록”이 들어갔던 과거를 완전히 없애기 위해
  // contentBlocks를 통째로 덮어씀
  await client
    .patch(id)
    .set({ contentBlocks: blocks })
    .commit({ autoGenerateArrayKeys: true });

  console.log(`Patched: ${id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
