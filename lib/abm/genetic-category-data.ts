import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

type GeneticCategoryRecord = {
  path: string;
  title: string;
  sourceUrl: string;
  html: string;
};

type GeneticCategoryPayload = {
  source: string;
  generatedAt: string;
  count: number;
  records: Record<string, GeneticCategoryRecord>;
};

let cache: GeneticCategoryPayload | undefined;

function readPayload() {
  if (cache) return cache;
  const filename = path.join(process.cwd(), "data", "abm-genetic-content.json.gz");
  cache = JSON.parse(gunzipSync(readFileSync(filename)).toString("utf8")) as GeneticCategoryPayload;
  return cache;
}

export function getOfficialAbmGeneticCategory(pathStr: string) {
  return readPayload().records[pathStr];
}

export function getOfficialAbmGeneticCategoryCount() {
  return readPayload().count;
}
