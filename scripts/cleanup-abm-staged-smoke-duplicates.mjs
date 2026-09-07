#!/usr/bin/env node

import { createClient } from "next-sanity";

const VERSION = "2026-08-09-search-v5";
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
const targets = [
  {
    id: "abm-rebuild-detail-product-chunk-0000",
    kind: "product",
    keys: ["product:g898", "product:g596", "product:y011002", "product:z100005", "product:a002"],
  },
  {
    id: "abm-rebuild-detail-service-chunk-0000",
    kind: "service",
    keys: ["service:c096", "service:c099", "service:c287"],
  },
];

const sorted = (values) => [...values].map(String).sort();
const sameValues = (left, right) => JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));

const targetDocuments = [];
for (const target of targets) {
  const document = await client.fetch(
    `*[_id == $id][0]{_id,_rev,_type,kind,version,"keys":records[].key}`,
    { id: target.id },
  );
  targetDocuments.push(document);
  if (!document) continue;
  if (document._type !== "abmRebuildDetailChunk" || document.kind !== target.kind || document.version !== VERSION) {
    throw new Error(`Cleanup target identity changed: ${target.id}`);
  }
  if (!sameValues(document.keys || [], target.keys)) {
    throw new Error(`Cleanup target contents changed: ${target.id}`);
  }

  const replacementKeys = await client.fetch(
    `*[
      _type == "abmRebuildDetailChunk"
      && version == $version
      && kind == $kind
      && _id != $id
    ].records[key in $keys].key`,
    { id: target.id, version: VERSION, kind: target.kind, keys: target.keys },
  );
  const replacementCounts = target.keys.map((key) => ({
    key,
    count: (replacementKeys || []).filter((value) => value === key).length,
  }));
  const unsafe = replacementCounts.filter((row) => row.count !== 1);
  if (unsafe.length) throw new Error(`Expected exactly one replacement for every key in ${target.id}: ${JSON.stringify(unsafe)}`);
}

const presentTargets = targets.filter((_, index) => targetDocuments[index]);
if (presentTargets.length > 0 && presentTargets.length !== targets.length) {
  throw new Error("Only part of the obsolete smoke-test chunks remain; refusing partial cleanup");
}

if (APPLY && presentTargets.length) {
  const transaction = client.transaction();
  for (const target of presentTargets) transaction.delete(target.id);
  await transaction.commit({ visibility: "sync" });
}

const remainingTargets = await client.fetch(`count(*[_id in $ids])`, { ids: targets.map((target) => target.id) });
const remainingKeys = await client.fetch(
  `*[
    _type == "abmRebuildDetailChunk"
    && version == $version
    && kind in ["product", "service"]
  ].records[].key`,
  { version: VERSION },
);
const duplicateKeys = [...new Set((remainingKeys || []).filter((key, index, values) => values.indexOf(key) !== index))];
const detailCounts = await client.fetch(
  `{
    "product": count(*[_type == "abmRebuildDetailChunk" && version == $version && kind == "product"].records[]),
    "service": count(*[_type == "abmRebuildDetailChunk" && version == $version && kind == "service"].records[])
  }`,
  { version: VERSION },
);

const report = {
  mode: APPLY ? "apply" : "dry-run",
  targets: targets.map((target) => target.id),
  alreadyClean: presentTargets.length === 0,
  remainingTargets,
  duplicateKeys: duplicateKeys || [],
  detailCounts,
};
console.log(JSON.stringify(report, null, 2));

if (remainingTargets !== 0 || report.duplicateKeys.length || detailCounts?.product !== 5144 || detailCounts?.service !== 251) {
  throw new Error("ABM staged detail cleanup verification failed");
}
