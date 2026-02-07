#!/usr/bin/env node
/**
 * One-shot ABM pipeline runner.
 *
 * What it does (in order):
 * 1) extract-abm.mjs  : crawl ABM product/category pages (stores to local cache)
 * 2) abm-transform.mjs: upsert brand/category/productPage/product docs to Sanity
 * 3) abm-enrich.mjs   : parse legacy HTML and pull intro/quickLinks/bullets/resources/topPublications + upload images
 *
 * Usage:
 *   node ./scripts/abm-all.mjs
 *   node ./scripts/abm-all.mjs --dry
 *   node ./scripts/abm-all.mjs --only-if-empty
 *   node ./scripts/abm-all.mjs --limit 30
 *
 * Notes:
 * - Reads env from .env.local first (NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET,
 *   NEXT_PUBLIC_SANITY_API_VERSION, SANITY_WRITE_TOKEN)
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);

const has = (flag) => args.includes(flag);
const readArg = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
};

const DRY = has("--dry");
const ONLY_IF_EMPTY = has("--only-if-empty");
const limitRaw = readArg("--limit");
const LIMIT = limitRaw ? Number(limitRaw) : 0;

const repoRoot = process.cwd();
const runNode = (scriptRel, scriptArgs = []) => {
  const script = path.join(repoRoot, scriptRel);
  const cmd = process.platform === "win32" ? "node.exe" : "node";
  const finalArgs = [script, ...scriptArgs];

  const r = spawnSync(cmd, finalArgs, {
    stdio: "inherit",
    env: process.env,
    shell: false,
  });

  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`Script failed: ${scriptRel} (exit ${r.status})`);
  }
};

const main = () => {
  const limitArgs = LIMIT > 0 ? ["--limit", String(LIMIT)] : [];

  // 1) extract
  runNode("scripts/extract-abm.mjs", [...limitArgs, ...(DRY ? ["--dry"] : [])]);

  // 2) transform
  runNode("scripts/abm-transform.mjs", [
    ...limitArgs,
    ...(DRY ? ["--dry"] : []),
    ...(ONLY_IF_EMPTY ? ["--only-if-empty"] : []),
  ]);

  // 3) enrich
  runNode("scripts/abm-enrich.mjs", [
    ...limitArgs,
    ...(DRY ? ["--dry"] : []),
    ...(ONLY_IF_EMPTY ? ["--only-if-empty"] : []),
  ]);

  console.log("\n✅ ABM all-in-one pipeline done.");
};

try {
  main();
} catch (e) {
  console.error("\n[abm-all] ERROR", e?.message || e);
  process.exit(1);
}
