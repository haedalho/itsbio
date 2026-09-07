#!/usr/bin/env node

import * as cheerio from "cheerio";
import { createClient } from "next-sanity";

import { sanitizeAbmStoredHtml } from "../lib/abm/rebuild-parser.mjs";
import { createAbmImageRehoster, isManagedAbmImageUrl } from "./lib/abm-sanity-image-assets.mjs";

const VERSION = "2026-08-09-search-v5";
const PATH_KEY = "cell-and-antibody-services/custom-antibody-engineering/rabbit-monoclonal-antibody-production";
const SOURCE_URL = "https://www.abmgood.com/Rabbit-Monoclonal-Antibody-Production.html";
const SOURCE_URLS = [
  SOURCE_URL,
  "https://alpha.abmgood.com/Rabbit-Monoclonal-Antibody-Production.html",
];
const APPLY = process.argv.includes("--apply");
const projectId = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const dataset = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const apiVersion = String(process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const token = [
  process.env.SANITY_WRITE_TOKEN,
  process.env.SANITY_API_WRITE_TOKEN,
  process.env.SANITY_API_TOKEN,
  process.env.SANITY_TOKEN,
  process.env.SANITY_AUTH_TOKEN,
].map((value) => String(value || "").trim()).find(Boolean) || undefined;

if (APPLY && !token) throw new Error("A Sanity write token is required with --apply");
const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });
const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchOfficialPage() {
  const errors = [];

  for (const sourceUrl of SOURCE_URLS) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await fetch(sourceUrl, {
          cache: "no-store",
          redirect: "follow",
          signal: controller.signal,
          headers: {
            accept: "text/html,application/xhtml+xml",
            "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-Repair/1.0; +https://itsbio.vercel.app)",
          },
        });
        const html = await response.text();
        const finalUrl = response.url || sourceUrl;
        if (
          response.ok
          && !new URL(finalUrl).pathname.toLowerCase().includes("pagenotfound")
          && /Rabbit Monoclonal Antibody Production/i.test(html)
          && !/page you are looking for can(?:not|'t) be found/i.test(html)
        ) return { html, finalUrl };

        errors.push(`${sourceUrl} attempt ${attempt}: HTTP ${response.status} or invalid Rabbit service content`);
      } catch (error) {
        errors.push(`${sourceUrl} attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        clearTimeout(timeout);
      }

      await sleep(1_000 * attempt);
    }
  }

  throw new Error(`Official Rabbit Monoclonal Antibody Production page did not return valid content from any official host: ${errors.slice(-6).join(" | ")}`);
}

function extractLanding(sourceHtml, sourceUrl) {
  const $ = cheerio.load(sourceHtml, { decodeEntities: false });
  let root = $("#abm-category-right-outer").first();
  if (!root.length) root = $("#content").first();
  if (!root.length) root = $("main").first();
  if (!root.length) throw new Error("Official service content root was not found");

  const work = root.clone();
  work.find("header,footer,nav,script,style,noscript,form,.breadcrumb,.breadcrumbs,.abm-top-nav,.abm-nav,.abm-category-container,ul.abm-page-category-nav-list").remove();
  work.find("h1,h2.abm-categories-title-h2").filter((_, heading) =>
    /Rabbit Monoclonal Antibody Production/i.test(clean($(heading).text()))
  ).first().remove();

  let html = sanitizeAbmStoredHtml(work.html() || "", sourceUrl);
  const scrub = cheerio.load(`<div id="__landing">${html}</div>`, { decodeEntities: false });
  scrub("#__landing *").toArray().reverse().forEach((element) => {
    const node = scrub(element);
    if (/(?:\$\s*\d|\b(?:USD|CAD)\s+\d)/i.test(clean(node.text()))) node.remove();
  });
  html = sanitizeAbmStoredHtml(scrub("#__landing").html() || "", sourceUrl);

  const text = clean(cheerio.load(`<div>${html}</div>`).text());
  const required = [
    "Rabbit monoclonal antibodies are key tools",
    "PHASE I Services: Antigen Production",
    "PHASE V Service: Stable Cell Line Development",
    "Comparison of Rabbit Monoclonal Antibody Generation Methods",
    "What process do you use to generate rabbit monoclonal antibody?",
  ];
  const missing = required.filter((phrase) => !text.includes(phrase));
  if (missing.length) throw new Error(`Official service sections are missing: ${missing.join(" | ")}`);
  if (/(?:\$\s*\d|\b(?:USD|CAD)\s+\d)/i.test(html)) throw new Error("Commerce data remains in repaired service content");
  return html;
}

const target = await client.fetch(
  `*[
    _type == "abmRebuildLandingChunk"
    && version == $version
    && kind == "service"
    && $pathKey in records[].pathKey
  ][0]{_id,_rev,"record":records[pathKey == $pathKey][0]}`,
  { version: VERSION, pathKey: PATH_KEY },
);
if (!target?._id || !target.record?._key) throw new Error("Target Rabbit service landing record was not found");

const fetched = await fetchOfficialPage();
const extractedHtml = extractLanding(fetched.html, fetched.finalUrl);
const imageRehoster = createAbmImageRehoster({ client: APPLY ? client : null, dryRun: !APPLY });
const html = await imageRehoster.rewriteHtml(extractedHtml, fetched.finalUrl);
const parsed = cheerio.load(`<div id="__landing">${html}</div>`, { decodeEntities: false });
const images = [...new Set(parsed("#__landing img[src]").toArray().map((image) => clean(parsed(image).attr("src"))).filter(Boolean))];
if (APPLY && images.some((url) => !isManagedAbmImageUrl(url))) throw new Error("An unmanaged service image remains after repair");

const repaired = {
  ...target.record,
  sourceUrl: SOURCE_URL,
  html,
  images,
  collectedAt: new Date().toISOString(),
};

if (APPLY) {
  await client.patch(target._id)
    .ifRevisionId(target._rev)
    .set({ [`records[_key=="${target.record._key}"]`]: repaired })
    .commit({ autoGenerateArrayKeys: true, visibility: "sync" });
}

const verified = APPLY ? await client.fetch(
  `*[_id == $id][0].records[pathKey == $pathKey][0]{sourceUrl,html,images,collectedAt}`,
  { id: target._id, pathKey: PATH_KEY },
) : repaired;
const verifiedText = clean(cheerio.load(`<div>${verified?.html || ""}</div>`).text());
if (!verified || verified.sourceUrl !== SOURCE_URL || !verifiedText.includes("PHASE V Service: Stable Cell Line Development")) {
  throw new Error("Rabbit service landing repair verification failed");
}

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  documentId: target._id,
  pathKey: PATH_KEY,
  fetchedFrom: fetched.finalUrl,
  sourceUrl: verified.sourceUrl,
  textLength: verifiedText.length,
  images: verified.images?.length || 0,
  uploadedAssets: imageRehoster.stats.uploadedAssets,
}, null, 2));
