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

// Search-engine snapshot of the official ABM page, crawled while the official host was reachable.
// This is intentionally price-free to match the ITS BIO ABM migration policy.
const OFFICIAL_SNAPSHOT_HTML = `
<section>
  <p>Rabbit monoclonal antibodies are key tools in research and diagnostics, especially for immunohistochemistry (IHC), flow cytometry, and immunofluorescence (IF). Traditional methods using rabbit hybridomas were time-consuming and had low success rates. With advancements like phage display libraries and next-generation sequencing, production has improved, but costs remain high.</p>
  <p>At abm, we offer a more efficient approach using primary rabbit plasma cells/plasmablasts and single-cell cloning, ensuring higher success rates. Our service includes memory B cell expansion, FACS-based selection, humane animal treatment, custom antigen preparation, stable cell-line generation, and guaranteed polyclonal Western Blot results. We provide three flexible protocol packages tailored to your specific research needs.</p>
  <p>Trust abm for high-quality rabbit monoclonal antibodies, delivered efficiently with expert support throughout your project.</p>

  <h3>Service Details</h3>
  <p>abm’s Rabbit Recombinant Monoclonal Antibody Production Service is divided into different phases. The basic package includes Phase I-IV and the complete package includes generation of recombinant antibody secreting stable cell line. Customer can also supply antigen or immunized whole spleen/PBMC/Bone marrow as the starting material for the project; please refer to the notes section for sample requirements.</p>
  <h4>Core Services</h4>
  <table>
    <thead><tr><th>Service Name</th><th>Description</th><th>Cat. No.</th><th>Unit</th></tr></thead>
    <tbody>
      <tr>
        <td>PHASE I Services: Antigen Production</td>
        <td><ol><li>Cloning/sub-cloning of gene of interest into a protein-encoding gene expression vector</li><li>Sequence confirmation</li><li>A set of multivariate small scale protein production trials are conducted to test for yield, solubility and optimal growth conditions</li><li>Large scale (&gt;1mg) recombinant protein production and purification (purity ≥90%)</li></ol></td>
        <td>C151</td><td>1 Service</td>
      </tr>
      <tr>
        <td>PHASE II Service: Immunization</td>
        <td><ol><li>Immunization (2 rabbits) of antigen from PHASE I or customer provided sample*</li><li>Titre testing by ELISA</li><li>Guaranteed rabbit antiserum titre of 1:10000</li></ol></td>
        <td>C152</td><td>1 Service</td>
      </tr>
      <tr>
        <td>PHASE III Service: Single-Cell Cloning</td>
        <td><ol><li>Isolation of antibody secreting cell from PHASE II or customer provided sample**</li><li>Staining cells with fluorescently labelled reagents</li><li>Single cell sorting by FACS</li><li>Amplification of cognate pair of heavy and light chain variable regions from sorted single cell</li><li>DNA sequencing and single cell cloning of heavy &amp; light chain variable regions</li><li>Cloning/subcloning of heavy and light chain variable regions into a recombinant antibody expression vector</li></ol><p><strong>Deliverables:</strong> DNA sequencing data of variable regions</p></td>
        <td>C153</td><td>1 Service</td>
      </tr>
      <tr>
        <td>PHASE IV Service: Antibody Production</td>
        <td><ol><li>Small scale antibody production for validation studies with expression vector from PHASE III</li><li>Expression of full-length and complete recombinant antibody generation</li><li>Guaranteed 3 positive clones (tested via Western Blot)</li></ol><p><strong>Deliverables:</strong> 25mL of cell culture supernatant of all 3 clones</p></td>
        <td>C154</td><td>1 Service</td>
      </tr>
      <tr>
        <td>PHASE V Service: Stable Cell Line Development</td>
        <td><ol><li>Cloning/subcloning of heavy and light chain variable regions into a viral vector</li><li>Viral packaging for gene delivery into a producer cell line</li><li>Drug screening and selection of high stable expression</li><li>Validation of recombinant antibody from the producer cell lines via Western Blot</li><li>Expansion and cryopresevation of selected clones</li><li>PCR based mycoplasma testing on selected producer cell lines</li></ol><p><strong>Deliverables:</strong> 25mL of cell culture supernatant of all 3 clones</p></td>
        <td>C155</td><td>1 Service</td>
      </tr>
    </tbody>
  </table>

  <h4>Note</h4>
  <ol>
    <li>* Customers can supply the recombinant antigen for immunization: 3-4 mg of purified protein antigen or 2mg of KLH and BSA conjugated antigen (if the antigen is a small molecule).</li>
    <li>** Customers can supply immunized whole spleen (in complete growth media) on ice, splenocytes (growth media with 10% DMSO) on dry-ice, fresh whole-blood with heparin on ice, PBMC (growth media with 10% DMSO) on dry-ice, or bone marrow (growth media with 10% DMSO) on dry-ice. Minimal of 10 million cells (splenocytes, PBMC, bone marrow) or 10-30mL of fresh whole-blood is required.</li>
    <li>Customers have the option to start or stop the project from any stages of the rabbit monoclonal antibody generation service. Customers will be responsible for the material and labour cost incurred thus far should early termination be requested.</li>
  </ol>

  <h3>Additional Info</h3>
  <h4>Comparison of Rabbit Monoclonal Antibody Generation Methods</h4>
  <table>
    <thead><tr><th></th><th>Traditional Fusion Method</th><th>abm Single-cell Method</th><th>Phage Display Method</th></tr></thead>
    <tbody>
      <tr><th>Lead Time</th><td>&gt; 7-8 months</td><td>&lt; 6 months</td><td>&gt; 8-10 months</td></tr>
      <tr><th>Disadvantages</th><td><ul><li>Low fusion rate</li><li>Low survival rate</li><li>Instability</li><li>Cell-line unavailable</li></ul></td><td><ul><li>Insufficient mRNA</li><li>Technical difficulty</li></ul></td><td><ul><li>Random pairing</li><li>Slow process</li><li>Instability</li><li>Very high cost</li></ul></td></tr>
      <tr><th>Advantages</th><td><ul><li>Mass production</li><li>Established method</li></ul></td><td><ul><li>Fast process</li><li>No cell storage</li><li>Antibody engineering</li></ul></td><td><ul><li>Antibody library</li><li>Antibody engineering</li></ul></td></tr>
    </tbody>
  </table>

  <h4>Rabbit Monoclonal Antibody Advantages</h4>
  <table>
    <thead><tr><th></th><th>Mouse</th><th>Rabbit</th></tr></thead>
    <tbody>
      <tr><th>Antigen recognition</th><td>Limited immune response<br>Limited response to rodent/human<br>Inability to recognize small molecules/peptides<br>Recognize limited epitopes</td><td>Recognize small molecule/peptides<br>Response to rodent/human<br>Recognizes several epitopes<br>Recognize structural variations</td></tr>
      <tr><th>Affinities</th><td>Nanomolar (~10^-9 Kd M)</td><td>Picomolar (10^-12 Kd M) to 10^-14 M</td></tr>
      <tr><th>Specificity</th><td>Medium to High</td><td>High</td></tr>
      <tr><th>Applications</th><td>Westerns, ELISA, Flow Cytometry, IP, may not be suitable for IHC, ICC, diagnostic kits</td><td>Western, ELISA, Flow Cytometry, IP, excellent IHC, ICC, diagnostic kits</td></tr>
    </tbody>
  </table>

  <h3>Related Products</h3>
  <ul><li>Mouse Monoclonal Antibody Production Service</li></ul>

  <h3>FAQs</h3>
  <h4>What process do you use to generate rabbit monoclonal antibody?</h4>
  <p>We use FACS to isolate plasma cell, plasmablast or memory B cells. We then clone out and sequence the single antibody secreting cell. In the case of memory B cells, the single memory B cell will be expanded using our proprietary method. We will test the expanded supernatant and clone out any positive clone. After sequence analysis, we will perform transient transfection and collect the culture supernatant to test the antibody’s functionality.</p>

  <h4>What will be delivered at the end of the project?</h4>
  <p>For the basic package, we will deliver ~25 mL of cell culture supernatant and the monoclonal antibody sequences. Stable cell-line will be supplied with the complete package. We do offer additional services, including large-scale antibody production; please contact us for more information.</p>

  <h4>What assay do you use to confirm the functionality of the produced antibody?</h4>
  <p>For rabbit monoclonal antibody service, we use Western Blotting to ensure the produced antibody have affinity and specificity towards the antigen. Immunohistochemistry (C095) and Immunoprecipition tests (C094) are also available, however are NOT included in the production service. Please inquire with us for further antibody characterization. For rabbit polyclonal antibody services, we guarantee the antibodies will work against the designed antigens in ELISA format. Due to experimental variations, we do not guarantee downstream applications. It is important to understand that the customer takes full responsibility for the antigen designs or delivery.</p>

  <h4>What is the shortest length peptide that you can produce an antibody against?</h4>
  <p>To produce an antibody that has specificity and affinity at acceptable levels, we require a minimum of 10 amino acids.</p>

  <h4>Can you produce an antibody against a native protein?</h4>
  <p>Yes, however, in order to guarantee the antibody is effective against the native protein, purified native protein must be used for immunization. Recombinant protein or peptide extracts can also be used to immunize, but we cannot guarantee these will be effective against the native protein due to folding and other conformational concerns. Our service guarantees that the immunized protein (native or recombinant) or peptide will be recognized by the produced antibody.</p>

  <h4>What concentration and amount of antigen is required for production if I am supplying the protein/peptide?</h4>
  <p>For peptide or small molecule antigens we require at least 2 mg conjugated to carrier proteins such as KLH, OVA or BSA, while if it is a protein, 3-4 mg with concentrations of 0.5-1.0 mg/ml are acceptable.</p>

  <h4>Do you deliver the cloned expression vectors along with the custom antibody?</h4>
  <p>No, the customer will only receive the custom antibody and the variable domains sequences. The customer will not receive any antibody expression vectors.</p>

  <h4>What information do I need to provide to start the project?</h4>
  <p>Please provide the antigen design or gene accession number and the service you are looking for (i.e. basic, complete or partial) to quotes@abmgood.com.</p>

  <h4>If I want to deliver fresh whole-blood, when I should bleed rabbit and collect sample after re-boost?</h4>
  <p>You can collect blood either 7 days after or 14-days after boost.</p>

  <h3>Citations</h3>
  <p>Ko, FC et al. “PKA-induced dimerization of the RhoGAP DLC1 promotes its inhibition of tumorigenesis and metastasis.” Nat Commun 4:1618 (2013). PubMed: 23511482.</p>
</section>`;

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
        ) return { html, finalUrl, snapshotFallback: false };

        errors.push(`${sourceUrl} attempt ${attempt}: HTTP ${response.status} or invalid Rabbit service content`);
      } catch (error) {
        errors.push(`${sourceUrl} attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        clearTimeout(timeout);
      }

      await sleep(1_000 * attempt);
    }
  }

  console.warn(`Official Rabbit service hosts are unavailable; applying validated official-page snapshot. ${errors.slice(-6).join(" | ")}`);
  return { html: OFFICIAL_SNAPSHOT_HTML, finalUrl: SOURCE_URL, snapshotFallback: true };
}

function extractLanding(sourceHtml, sourceUrl, snapshotFallback = false) {
  if (snapshotFallback) return sanitizeAbmStoredHtml(sourceHtml, sourceUrl);

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
  return html;
}

function validateLanding(html) {
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
  return text;
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
const extractedHtml = extractLanding(fetched.html, fetched.finalUrl, fetched.snapshotFallback);
validateLanding(extractedHtml);

const imageRehoster = createAbmImageRehoster({ client: APPLY ? client : null, dryRun: !APPLY });
const html = await imageRehoster.rewriteHtml(extractedHtml, fetched.finalUrl);
const parsed = cheerio.load(`<div id="__landing">${html}</div>`, { decodeEntities: false });
const htmlImages = [...new Set(parsed("#__landing img[src]").toArray().map((image) => clean(parsed(image).attr("src"))).filter(Boolean))];
const existingManagedImages = Array.isArray(target.record.images)
  ? target.record.images.map(clean).filter((url) => url && isManagedAbmImageUrl(url))
  : [];
const images = htmlImages.length ? htmlImages : existingManagedImages;
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
const verifiedText = validateLanding(verified?.html || "");
if (!verified || verified.sourceUrl !== SOURCE_URL) throw new Error("Rabbit service landing repair verification failed");

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  documentId: target._id,
  pathKey: PATH_KEY,
  fetchedFrom: fetched.snapshotFallback ? "official-search-snapshot" : fetched.finalUrl,
  sourceUrl: verified.sourceUrl,
  textLength: verifiedText.length,
  images: verified.images?.length || 0,
  uploadedAssets: imageRehoster.stats.uploadedAssets,
}, null, 2));
