#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { parseAbmRebuildDetailV2 } from "../lib/abm/rebuild-parser-v2.mjs";
import { cleanText } from "../lib/abm/rebuild-parser.mjs";

const OUT = path.resolve(".cache/abm-rebuild-parser-qa");
fs.mkdirSync(OUT, { recursive: true });

const samples = [
  {
    id: "product-g898",
    kind: "product",
    title: "miRNA All-In-One cDNA Synthesis Kit",
    sku: "G898",
    url: "https://www.abmgood.com/mirna-all-in-one-cdna-synthesis-kit.html",
    require: ["sku", "specifications", "description", "documents", "images", "faqs"],
  },
  {
    id: "product-g596",
    kind: "product",
    title: "BlasTaq™ Probe One-Step RT-qPCR",
    sku: "G596",
    url: "https://www.abmgood.com/blastaq-probe-one-step-rt-qpcr.html",
    require: ["sku", "specifications", "images"],
  },
  {
    id: "product-antibody",
    kind: "product",
    title: "Anti-GSK3ß (Phospho-Ser9) Antibody",
    sku: "Y011002",
    url: "https://www.abmgood.com/anti-gsk3-szlig-phospho-ser9-antibody-y011002.html",
    require: ["sku", "specifications", "images"],
  },
  {
    id: "product-growth-factor",
    kind: "product",
    title: "Recombinant Human FGF1 (E. coli)",
    sku: "Z100005",
    url: "https://www.abmgood.com/recombinant-human-fgf1-z100005.html",
    require: ["sku", "specifications", "images"],
  },
  {
    id: "product-genetic",
    kind: "product",
    title: "pShuttle(+) Vector",
    sku: "A002",
    url: "https://www.abmgood.com/pshuttle-vector-a002.html",
    require: ["sku", "specifications"],
  },
  {
    id: "service-cloning",
    kind: "service",
    title: "Subcloning Service I",
    sku: "C096",
    url: "https://www.abmgood.com/Custom-Cloning.html",
    require: ["sku", "serviceOffer", "serviceDetails"],
  },
  {
    id: "service-lentivirus",
    kind: "service",
    title: "Custom Lentivirus Titration",
    sku: "C099",
    url: "https://www.abmgood.com/Custom-Lentivirus.html",
    require: ["sku", "serviceOffer", "serviceDetails", "documents", "faqs"],
  },
  {
    id: "service-cell-auth",
    kind: "service",
    title: "Human Cell Line Authentication Service",
    sku: "C287",
    url: "https://www.abmgood.com/Cell-Line-Authentication-Service.html",
    require: ["sku", "serviceOffer", "serviceDetails"],
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchHtml(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(250 + attempt * 350);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-ParserQA/2.0; +https://itsbio.vercel.app)",
          accept: "text/html,application/xhtml+xml",
        },
      });
      clearTimeout(timer);
      if (res.status === 429) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (error) {
      clearTimeout(timer);
      if (attempt === 3) throw error;
    }
  }
  throw new Error("fetch failed");
}

function check(sample, result) {
  const storedProjection = {
    introHtml: result.introHtml,
    specificationsHtml: result.specificationsHtml,
    datasheetHtml: result.datasheetHtml,
    documentsHtml: result.documentsHtml,
    faqsHtml: result.faqsHtml,
    referencesHtml: result.referencesHtml,
    reviewsHtml: result.reviewsHtml,
    serviceDetailsHtml: result.serviceDetailsHtml,
    serviceOffer: result.serviceOffer,
  };
  const serialized = JSON.stringify(storedProjection);
  const priceFree = !/(?:\b(?:USD|CAD)\b\s*:?)?\s*\$\s*\d|\b(?:USD|CAD)\s+\d[\d,.]*|"(?:price|cost|amount|currency|cart|quantity)"\s*:/i.test(serialized);

  let serviceRowsExact = true;
  if (sample.kind === "service") {
    const $ = cheerio.load(`<div id="__root">${result.serviceDetailsHtml || ""}</div>`, { decodeEntities: false });
    let catalogTables = 0;
    $("#__root table").each((_, table) => {
      const rows = $(table).find("tr");
      const headers = rows.first().children("th,td").toArray().map((cell) => cleanText($(cell).text()).toLowerCase().replace(/[\s:]+$/g, ""));
      if (!headers.some((header) => /^(?:cat\.?\s*no\.?|catalog(?:ue)?(?:\s+number)?)$/.test(header))) return;
      catalogTables++;
      const dataRows = rows.filter((__, row) => !$(row).children("th").length);
      if (!dataRows.length || dataRows.toArray().some((row) =>
        !$(row).children("td").toArray().some((cell) => cleanText($(cell).text()).toLowerCase() === sample.sku.toLowerCase()),
      )) serviceRowsExact = false;
    });
    serviceRowsExact = serviceRowsExact && catalogTables > 0;
  }

  const checks = {
    sku: result.verification?.skuMatches === true,
    specifications: result.verification?.hasSpecifications === true,
    description: Boolean(result.description?.trim()),
    documents: (result.counts?.documents || 0) > 0,
    images: (result.counts?.images || 0) > 0,
    faqs: Boolean(result.faqsHtml?.trim()),
    serviceOffer: result.verification?.serviceOfferMatched === true,
    serviceDetails: Boolean(result.serviceDetailsHtml?.trim()),
    serviceRowsExact,
    priceFree,
  };
  const requiredNames = [...sample.require, "priceFree", ...(sample.kind === "service" ? ["serviceRowsExact"] : [])];
  const required = Object.fromEntries(requiredNames.map((name) => [name, Boolean(checks[name])]));
  const passed = Object.values(required).every(Boolean);
  return { passed, required, all: checks };
}

const results = [];
for (let i = 0; i < samples.length; i++) {
  const sample = samples[i];
  console.log(`[QA ${i + 1}/${samples.length}] ${sample.id} ${sample.sku}`);
  try {
    const html = await fetchHtml(sample.url);
    const parsed = parseAbmRebuildDetailV2(html, sample.url, sample);
    const qa = check(sample, parsed);
    results.push({ sample, qa, parsed });
    console.log(JSON.stringify({
      id: sample.id,
      passed: qa.passed,
      required: qa.required,
      parsed: {
        title: parsed.title,
        sku: parsed.sku,
        unit: parsed.unit,
        description: Boolean(parsed.description),
        specTables: parsed.counts.specificationTables,
        docs: parsed.counts.documents,
        images: parsed.counts.images,
        faqs: parsed.counts.faqs,
        serviceOffer: parsed.serviceOffer,
      },
    }, null, 2));
  } catch (error) {
    results.push({ sample, qa: { passed: false }, error: String(error?.stack || error) });
    console.error(sample.id, error?.stack || error);
  }
}

const failed = results.filter((x) => !x.qa?.passed);
const summary = {
  generatedAt: new Date().toISOString(),
  samples: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  failedIds: failed.map((x) => x.sample.id),
};

fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
fs.writeFileSync(
  path.join(OUT, "summary.md"),
  `# ABM rebuild parser QA\n\n- Samples: **${summary.samples}**\n- Passed: **${summary.passed}**\n- Failed: **${summary.failed}**\n- Failed IDs: **${summary.failedIds.join(", ") || "none"}**\n`,
);
console.log(JSON.stringify(summary, null, 2));
if (failed.length) process.exitCode = 2;
