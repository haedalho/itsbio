import "server-only";

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import type { AbmStagedDetail } from "@/lib/abm/rebuild-staging";

type CellDetailShard = Record<string, AbmStagedDetail>;

const shardCache = new Map<string, CellDetailShard>();

function normalizedSku(value: string) {
  return String(value || "").normalize("NFKC").trim().toLowerCase();
}

function shardKey(sku: string) {
  return createHash("sha256").update(normalizedSku(sku)).digest("hex").slice(0, 1);
}

function readShard(key: string) {
  const cached = shardCache.get(key);
  if (cached) return cached;
  const filename = path.join(process.cwd(), "data", "abm-cell-details", `${key}.json.gz`);
  if (!existsSync(filename)) return undefined;
  const parsed = JSON.parse(gunzipSync(readFileSync(filename)).toString("utf8")) as CellDetailShard;
  shardCache.set(key, parsed);
  return parsed;
}

export function findOfficialAbmCellDetail(sku: string) {
  const normalized = normalizedSku(sku);
  if (!normalized) return undefined;
  return readShard(shardKey(normalized))?.[normalized];
}
