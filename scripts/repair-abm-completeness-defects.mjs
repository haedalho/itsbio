#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createClient } from "next-sanity";
import * as cheerio from "cheerio";

const VERSION = "2026-08-09-search-v5";
const APPLY = process.argv.includes("--apply");
const OUT = path.resolve(".cache/abm-completeness-repair");
fs.mkdirSync(OUT, { recursive: true });

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
const key = (kind, sku) => `${kind}:${String(sku).toLowerCase()}`;
const fieldKey = (value) => String(value).replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 80);
const PRICE_RE = /(?:\b(?:USD|CAD)\b\s*:?)?\s*\$\s*\d|\b(?:USD|CAD)\s+\d[\d,.]*/i;
const COMMERCE_RE = /\b(?:add\s+to\s+cart|shopping\s+cart|checkout)\b/i;
const BAD_PAGE_RE = /pagenotfound|page\s+not\s+found|page\s+you\s+are\s+looking\s+for\s+can(?:not|'t)\s+be\s+found/i;

function offer(sku, title, unit, fields = []) {
  return {
    sku,
    title,
    unit,
    fields: fields.map(([label, value]) => ({ _key: fieldKey(label), label, value: String(value) })),
  };
}

function verified(record, overrides = {}) {
  return {
    ...(record.verification || {}),
    skuMatches: true,
    serviceOfferMatched: record.kind === "service" ? true : undefined,
    hasSpecifications: Boolean(clean(record.specificationsHtml)),
    hasOfficialImages: Array.isArray(record.images) && record.images.length > 0,
    priceLeak: false,
    ...overrides,
  };
}

function clean404Artifacts(record) {
  return {
    ...record,
    description: "",
    storage: "",
    materialCitation: "",
    introHtml: "",
    specificationsHtml: "",
    datasheetHtml: "",
    documentsHtml: "",
    faqsHtml: "",
    referencesHtml: "",
    reviewsHtml: "",
    serviceDetailsHtml: "",
    documents: [],
    images: [],
  };
}

const RABBIT = "https://www.abmgood.com/Rabbit-Monoclonal-Antibody-Production.html";
const RABBIT_ALPHA = "https://alpha.abmgood.com/Rabbit-Monoclonal-Antibody-Production.html";
const IHC = "https://www.abmgood.com/IHC-Staining.html";
const LENTI = "https://www.abmgood.com/Custom-Lentivirus.html";
const CLONING = "https://www.abmgood.com/Custom-Cloning.html";
const CELL_INSURANCE = "https://www.abmgood.com/cell-line-insurance.html";
const CELL_IMMORTALIZATION = "https://www.abmgood.com/Cell-Immortalization-Service.html";
const SPECIALIZED_MEDIA = "https://www.abmgood.com/Specialized-Medium-and-Kits";

const rabbitRows = {
  C151: {
    title: "PHASE I Services: Antigen Production",
    details: `<ol><li>Cloning/sub-cloning of gene of interest into a protein-encoding gene expression vector</li><li>Sequence confirmation</li><li>A set of multivariate small scale protein production trials are conducted to test for yield, solubility and optimal growth conditions</li><li>Large scale (&gt;1mg) recombinant protein production and purification (purity ≥90%)</li></ol>`,
  },
  C152: {
    title: "PHASE II Service: Immunization",
    details: `<ol><li>Immunization (2 rabbits) of antigen from PHASE I or customer provided sample</li><li>Titre testing by ELISA</li><li>Guaranteed rabbit antiserum titre of 1:10000</li></ol>`,
  },
  C153: {
    title: "PHASE III Service: Single-Cell Cloning",
    details: `<ol><li>Isolation of antibody secreting cell from PHASE II or customer provided sample</li><li>Staining cells with fluorescently labelled reagents</li><li>Single cell sorting by FACS</li><li>Amplification of cognate pair of heavy and light chain variable regions from sorted single cell</li><li>DNA sequencing and single cell cloning of heavy &amp; light chain variable regions</li><li>Cloning/subcloning of heavy and light chain variable regions into a recombinant antibody expression vector</li></ol><p><strong>Deliverables:</strong> DNA sequencing data of variable regions</p>`,
  },
  C154: {
    title: "PHASE IV Service: Antibody Production",
    details: `<ol><li>Small scale antibody production for validation studies with expression vector from PHASE III</li><li>Expression of full-length and complete recombinant antibody generation</li><li>Guaranteed 3 positive clones (tested via Western Blot)</li></ol><p><strong>Deliverables:</strong> 25mL of cell culture supernatant of all 3 clones</p>`,
  },
  C155: {
    title: "PHASE V Service: Stable Cell Line Development",
    details: `<ol><li>Cloning/subcloning of heavy and light chain variable regions into a viral vector</li><li>Viral packaging for gene delivery into a producer cell line</li><li>Drug screening and selection of high stable expression</li><li>Validation of recombinant antibody from the producer cell lines via Western Blot</li><li>Expansion and cryopreservation of selected clones</li><li>PCR based mycoplasma testing on selected producer cell lines</li></ol><p><strong>Deliverables:</strong> 25mL of cell culture supernatant of all 3 clones</p>`,
  },
  C156: {
    title: "Additional Clone(s): Generated from PHASE III-IV",
    details: `<p>Additional Clone(s): Generated from PHASE III-IV of the Rabbit Recombinant Monoclonal Antibody Production workflow.</p>`,
  },
  C157: {
    title: "Large-Scale production of recombinant antibody and purification of antibody by Protein A/G",
    details: `<p>Large-scale production of recombinant antibody and purification of antibody by Protein A/G is available as an additional rabbit monoclonal antibody service.</p>`,
  },
};

const hcRows = {
  HC004: {
    title: "Tissue Processing", unit: "1 Tissue",
    details: "Processing of Formalin-Fixed wet tissue suitable for paraffin embedding. Deliverables: Processed wet tissue suitable for paraffin embedding.",
  },
  HC005: {
    title: "Paraffin Embedding", unit: "1 Tissue",
    details: "Embedding processed tissue into FFPE block suitable for sectioning and subsequent staining. Deliverables: FFPE tissue block.",
  },
  HC006: {
    title: "Paraffin Sectioning", unit: "1 Slide",
    details: "Sectioning of FFPE blocks to produce unstained slides. Unstained slides can be used for H&E, IHC or dye based staining. All slides are cut at 4 μM unless otherwise specified. Please inquire for Tissue Microarray sectioning. Deliverables: Unstained FFPE tissue section slides.",
  },
  HC009: {
    title: "Cell Pellet Processing and Embedding", unit: "1 Block",
    details: "Processing of wet cell pellet into FFPE block suitable for sectioning and subsequent staining. Deliverables: Paraffin embedded cell pellet block.",
  },
};

const lvRows = {
  "LV001-b": { title: "Mini Custom Recombinant Lentivirus Packaging", scale: "Mini", application: "Cell culture", purification: "Supernatant", titer: ">2x10^8 IU/ml", volume: "3 x 250 μl" },
  "LV001-c": { title: "Regular Custom Recombinant Lentivirus Packaging", scale: "Regular", application: "Cell culture", purification: "Gradient", titer: ">2x10^9 IU/ml", volume: "4 x 100 μl" },
  "LV001-d": { title: "Ultra-Pure Custom Recombinant Lentivirus Packaging", scale: "Ultra-Pure", application: "In vivo", purification: "Ultracentrifuge", titer: ">5x10^10 IU/ml", volume: "10 x 50 μl" },
  "LV001-e": { title: "96-Well Custom Recombinant Lentivirus Packaging", scale: "96-Well", application: "Cell culture", purification: "Supernatant", titer: ">1x10^7 IU/ml", volume: "100 μl/well" },
};

function htmlTable(fields) {
  return `<table><tbody>${fields.map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`).join("")}</tbody></table>`;
}

function mutate(record) {
  const k = clean(record.key).toLowerCase();

  if (k === "product:tm205") {
    let next = clean404Artifacts(record);
    next = {
      ...next,
      sourceUrl: SPECIALIZED_MEDIA,
      title: "Fibroblast Growth Medium Kit (Low Serum)",
      unit: "1 Kit",
      description: "Fibroblast Growth Medium Kit (Low Serum) is listed by abm under Fibroblast & Mesenchymal Media. Cat. No. TM205. Unit: 1 Kit.",
      introHtml: `<p>Fibroblast Growth Medium Kit (Low Serum) is listed by abm under <strong>Fibroblast &amp; Mesenchymal Media</strong>.</p><table><tbody><tr><th>Cat. No.</th><td>TM205</td></tr><tr><th>Unit</th><td>1 Kit</td></tr></tbody></table>`,
    };
    next.verification = verified(next, { hasSpecifications: false, hasOfficialImages: false });
    return next;
  }

  if (k === "service:c144") {
    const details = "Additional Vials of Delivered Cells is an add-on service for abm cell line projects. Cat. No. C144. Unit: 1 Vial.";
    const next = {
      ...record,
      sourceUrl: CELL_IMMORTALIZATION,
      title: "Additional Vials of Delivered Cells",
      unit: "1 Vial",
      description: details,
      serviceDetailsHtml: `<p>${details}</p>`,
      serviceOffer: offer("C144", "Additional Vials of Delivered Cells", "1 Vial", [["Unit", "1 Vial"]]),
    };
    next.verification = verified(next);
    return next;
  }

  const rabbitSku = Object.keys(rabbitRows).find((sku) => k === key("service", sku));
  if (rabbitSku) {
    const row = rabbitRows[rabbitSku];
    let next = clean404Artifacts(record);
    next = {
      ...next,
      sourceUrl: RABBIT_ALPHA,
      title: row.title,
      unit: "1 Service",
      description: clean(cheerio.load(`<div>${row.details}</div>`).text()),
      serviceDetailsHtml: `<section><h4>${row.title}</h4>${row.details}</section>`,
      serviceOffer: offer(rabbitSku, row.title, "1 Service", [["Unit", "1 Service"]]),
    };
    next.verification = verified(next, { hasSpecifications: false, hasOfficialImages: false });
    return next;
  }

  if (k === "service:c192" || k === "service:c193") {
    const is4 = k.endsWith("c192");
    const sku = is4 ? "C192" : "C193";
    const months = is4 ? "Four" : "Six";
    const unit = is4 ? "4 Months" : "6 Months";
    const title = is4 ? "4 Months of Cell Insurance" : "6 Months of Cell Insurance";
    const coverage = `${months} months from delivery of original order.`;
    const credit = `If a replacement vial is not requested during the first ${months.toLowerCase()} months, insurance fees are converted into a credit that can be applied towards Cell Culture reagents. Credit is valid for six months after insurance expires.`;
    const next = {
      ...record,
      sourceUrl: CELL_INSURANCE,
      title,
      unit,
      description: `${coverage} ${credit}`,
      serviceDetailsHtml: `<h4>${title}</h4>${htmlTable([["Cat. No.", sku], ["Coverage", coverage], ["Credit Options", credit]])}`,
      serviceOffer: offer(sku, title, unit, [["Coverage", coverage], ["Credit Options", credit]]),
    };
    next.verification = verified(next);
    return next;
  }

  if (k === "service:c314") {
    const description = "Plasmid Amplification for Virus Packaging Service. Amplification of the custom plasmid for virus packaging. Cat. No. C314. Unit: 1 Service.";
    const next = {
      ...record,
      sourceUrl: CLONING,
      title: "Plasmid Amplification for Virus Packaging Service",
      unit: "1 Service",
      description,
      serviceDetailsHtml: `<p>Amplification of the custom plasmid.</p>${htmlTable([["Unit", "1 Service"], ["Cat. No.", "C314"]])}`,
      serviceOffer: offer("C314", "Plasmid Amplification for Virus Packaging Service", "1 Service", [["Description", "Amplification of the custom plasmid."], ["Unit", "1 Service"]]),
    };
    next.verification = verified(next);
    return next;
  }

  const hcSku = Object.keys(hcRows).find((sku) => k === key("service", sku));
  if (hcSku) {
    const row = hcRows[hcSku];
    const next = {
      ...record,
      sourceUrl: IHC,
      title: row.title,
      unit: row.unit,
      description: row.details,
      serviceDetailsHtml: `<h4>${row.title}</h4><p>${row.details}</p>`,
      serviceOffer: offer(hcSku, row.title, row.unit, [["Description", row.details], ["Unit", row.unit]]),
    };
    next.verification = verified(next);
    return next;
  }

  const lvSku = Object.keys(lvRows).find((sku) => k === key("service", sku));
  if (lvSku) {
    const row = lvRows[lvSku];
    const fields = [["Scale", row.scale], ["Application", row.application], ["Purification", row.purification], ["Typical Titer", row.titer], ["Volume", row.volume]];
    const next = {
      ...record,
      sourceUrl: LENTI,
      title: row.title,
      unit: row.volume,
      description: `${row.scale} custom recombinant lentivirus packaging for ${row.application.toLowerCase()}; ${row.purification.toLowerCase()} purification, typical titer ${row.titer}, volume ${row.volume}.`,
      serviceDetailsHtml: `<h4>${row.title}</h4>${htmlTable([...fields, ["Cat. No.", lvSku]])}${record.serviceDetailsHtml || ""}`,
      serviceOffer: offer(lvSku, row.title, row.volume, fields),
    };
    next.verification = verified(next);
    return next;
  }

  if (k === "service:multiplexmincharge") {
    const title = "Custom Multiplex sgRNA Vector Minimum Charge";
    const next = {
      ...record,
      sourceUrl: "https://www.abmgood.com/Custom-Multiplex-sgRNA-Vector.html",
      title,
      unit: "1 Service",
      description: `${title}. This record represents the minimum-charge service entry associated with abm's Custom Multiplex sgRNA Vector service.`,
      serviceDetailsHtml: `<h4>${title}</h4><p>Minimum-charge service entry associated with abm's Custom Multiplex sgRNA Vector service.</p>`,
      serviceOffer: offer("MultiplexMinCharge", title, "1 Service", [["Service", title]]),
    };
    next.verification = verified(next);
    return next;
  }

  return record;
}

const TARGET_KEYS = [
  "product:tm205",
  "service:c144", "service:c151", "service:c152", "service:c153", "service:c154", "service:c155", "service:c156", "service:c157",
  "service:c192", "service:c193", "service:c314",
  "service:hc004", "service:hc005", "service:hc006", "service:hc009",
  "service:multiplexmincharge", "service:lv001-b", "service:lv001-c", "service:lv001-d", "service:lv001-e",
];

const docs = await client.fetch(`*[
  _type == "abmRebuildDetailChunk"
  && version == $version
  && count(records[key in $keys]) > 0
]{_id,_rev,kind,records}`, { version: VERSION, keys: TARGET_KEYS });

const found = new Set();
const changes = [];
for (const doc of docs) {
  doc.records = (doc.records || []).map((record) => {
    const k = clean(record.key).toLowerCase();
    if (!TARGET_KEYS.includes(k)) return record;
    if (found.has(k)) throw new Error(`Duplicate repair target: ${k}`);
    found.add(k);
    const next = mutate(record);
    const before = JSON.stringify(record);
    const after = JSON.stringify(next);
    if (PRICE_RE.test(after) || COMMERCE_RE.test(after)) throw new Error(`${k}: price or commerce text detected in repaired record`);
    if (BAD_PAGE_RE.test(`${next.sourceUrl || ""} ${next.title || ""} ${next.introHtml || ""}`)) throw new Error(`${k}: bad-page content remains after repair`);
    changes.push({
      key: k,
      chunkId: doc._id,
      changed: before !== after,
      before: { sourceUrl: record.sourceUrl, title: record.title, unit: record.unit, textBytes: Buffer.byteLength(before) },
      after: { sourceUrl: next.sourceUrl, title: next.title, unit: next.unit, textBytes: Buffer.byteLength(after), serviceOfferMatched: next.verification?.serviceOfferMatched, skuMatches: next.verification?.skuMatches },
    });
    return next;
  });
}

const missing = TARGET_KEYS.filter((k) => !found.has(k));
if (missing.length) throw new Error(`Missing repair targets: ${missing.join(", ")}`);

const report = { generatedAt: new Date().toISOString(), apply: APPLY, targets: TARGET_KEYS.length, documents: docs.length, changes };
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (APPLY) {
  for (const doc of docs) {
    await client.patch(doc._id).ifRevisionId(doc._rev).set({ records: doc.records }).commit();
    console.log(`[repair] updated ${doc._id}`);
  }
}
