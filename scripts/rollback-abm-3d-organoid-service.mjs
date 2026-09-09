#!/usr/bin/env node

import { createClient } from "next-sanity";

const APPLY = process.argv.includes("--apply");
const PROJECT_ID = String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8").trim();
const DATASET = String(process.env.NEXT_PUBLIC_SANITY_DATASET || "production").trim();
const TOKEN = [
  process.env.SANITY_WRITE_TOKEN,
  process.env.SANITY_API_WRITE_TOKEN,
  process.env.SANITY_API_TOKEN,
  process.env.SANITY_TOKEN,
  process.env.SANITY_AUTH_TOKEN,
].map((value) => String(value || "").trim()).find(Boolean);

const DOCUMENT_ID = "abm-rebuild-landing-service-chunk-0000";
const PATH_KEY = "cell-and-antibody-services/3d-and-organoid-services";
// The mistaken service mutation committed at ~2026-09-09T01:59:29Z.
// Read the exact document state immediately before that transaction.
const RESTORE_TIME = "2026-09-09T01:59:20.000Z";
const HISTORY_API_VERSION = "v2026-08-19";

if (!TOKEN) throw new Error("Sanity token is required");

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: "2026-08-19",
  token: TOKEN,
  useCdn: false,
});

const clean = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const textFromHtml = (html) => clean(String(html || "").replace(/<[^>]+>/g, " "));

async function getHistoricalDocument() {
  const url = new URL(`https://${PROJECT_ID}.api.sanity.io/${HISTORY_API_VERSION}/data/history/${DATASET}/documents/${encodeURIComponent(DOCUMENT_ID)}`);
  url.searchParams.set("time", RESTORE_TIME);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Sanity History API ${response.status}: ${JSON.stringify(body).slice(0, 1200)}`);
  const doc = Array.isArray(body?.documents) ? body.documents[0] : null;
  if (!doc?._id) throw new Error(`Historical document not found at ${RESTORE_TIME}`);
  return doc;
}

function getRecord(doc) {
  return Array.isArray(doc?.records) ? doc.records.find((record) => record?.pathKey === PATH_KEY) : undefined;
}

const historicalDoc = await getHistoricalDocument();
const priorRecord = getRecord(historicalDoc);
if (!priorRecord?._key) throw new Error(`Historical service record missing: ${PATH_KEY}`);

const currentDoc = await client.getDocument(DOCUMENT_ID);
if (!currentDoc?._id) throw new Error(`Current service chunk missing: ${DOCUMENT_ID}`);
const currentRecord = getRecord(currentDoc);
if (!currentRecord?._key) throw new Error(`Current service record missing: ${PATH_KEY}`);

const priorText = textFromHtml(priorRecord.html);
const currentText = textFromHtml(currentRecord.html);
if (priorText.length < 1000) throw new Error(`Historical service content unexpectedly sparse: ${priorText.length}`);
if (!/3d-organoid-services\.html/i.test(String(priorRecord.sourceUrl || ""))) {
  throw new Error(`Historical source URL is unexpected: ${priorRecord.sourceUrl || "missing"}`);
}

const summary = {
  mode: APPLY ? "apply" : "dry-run",
  restoreTime: RESTORE_TIME,
  documentId: DOCUMENT_ID,
  pathKey: PATH_KEY,
  historicalRevision: historicalDoc._rev,
  currentRevision: currentDoc._rev,
  prior: {
    sourceUrl: priorRecord.sourceUrl,
    collectedAt: priorRecord.collectedAt,
    textLength: priorText.length,
    images: Array.isArray(priorRecord.images) ? priorRecord.images.length : 0,
  },
  current: {
    sourceUrl: currentRecord.sourceUrl,
    collectedAt: currentRecord.collectedAt,
    textLength: currentText.length,
    images: Array.isArray(currentRecord.images) ? currentRecord.images.length : 0,
  },
};
console.log(JSON.stringify(summary, null, 2));

if (!APPLY) process.exit(0);

await client
  .patch(DOCUMENT_ID)
  .ifRevisionId(currentDoc._rev)
  .set({ [`records[_key=="${currentRecord._key}"]`]: priorRecord })
  .commit({ autoGenerateArrayKeys: true, visibility: "sync" });

const verifiedDoc = await client.getDocument(DOCUMENT_ID);
const verifiedRecord = getRecord(verifiedDoc);
if (!verifiedRecord) throw new Error("Restored service record missing after patch");

const fields = ["pathKey", "title", "sourceUrl", "html", "collectedAt"];
for (const field of fields) {
  if (JSON.stringify(verifiedRecord[field] ?? null) !== JSON.stringify(priorRecord[field] ?? null)) {
    throw new Error(`Rollback verification mismatch: ${field}`);
  }
}
if (JSON.stringify(verifiedRecord.images || []) !== JSON.stringify(priorRecord.images || [])) {
  throw new Error("Rollback verification mismatch: images");
}

console.log(JSON.stringify({
  restored: true,
  revision: verifiedDoc._rev,
  pathKey: PATH_KEY,
  sourceUrl: verifiedRecord.sourceUrl,
  collectedAt: verifiedRecord.collectedAt,
  textLength: textFromHtml(verifiedRecord.html).length,
  images: Array.isArray(verifiedRecord.images) ? verifiedRecord.images.length : 0,
}, null, 2));
