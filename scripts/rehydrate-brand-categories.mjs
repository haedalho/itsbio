// scripts/rehydrate-brand-categories.mjs
import "dotenv/config";
import { createClient } from "next-sanity";
import { rehydrateOneCategoryFromLegacy } from "./rehydrate-lib.mjs"; // 아래에 같이 만들어줄 거

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const client = createClient({
  projectId: mustEnv("NEXT_PUBLIC_SANITY_PROJECT_ID"),
  dataset: mustEnv("NEXT_PUBLIC_SANITY_DATASET"),
  apiVersion: "2025-01-01",
  token: process.env.SANITY_WRITE_TOKEN, // write 필요
  useCdn: false,
});

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    args[k] = v;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const brandKey = String(args.brandKey || "").trim().toLowerCase();
const baseUrl = String(args.baseUrl || "").trim();
const dryRun = !!args.dryRun;
const onlyEmpty = args.onlyEmpty !== undefined ? true : false;

if (!brandKey) {
  console.error("Usage: node --env-file=.env.local scripts/rehydrate-brand-categories.mjs --brandKey abm --baseUrl https://www.abmgood.com [--onlyEmpty] [--dryRun]");
  process.exit(1);
}

const LIST_Q = `
*[
  _type=="category"
  && (brand->themeKey==$brandKey || themeKey==$brandKey || brand->slug.current==$brandKey)
]{
  _id,title,
  "blocksCount": count(contentBlocks),
  "legacyLen": length(legacyHtml),
  path
} | order(blocksCount asc, legacyLen desc)
`;

(async () => {
  const rows = await client.fetch(LIST_Q, { brandKey });
  const targets = rows.filter((r) => {
    if (onlyEmpty) return (r.blocksCount || 0) === 0 && (r.legacyLen || 0) > 0;
    return (r.legacyLen || 0) > 0;
  });

  console.log(JSON.stringify({ brandKey, total: rows.length, targets: targets.length, dryRun, onlyEmpty }, null, 2));

  let patched = 0;
  let skipped = 0;

  for (const r of targets) {
    const res = await rehydrateOneCategoryFromLegacy({
      client,
      id: r._id,
      brandKey,
      baseUrl,
      dryRun,
    });

    if (res.status === "patched") patched++;
    else skipped++;

    console.log(JSON.stringify(res, null, 2));
  }

  console.log(JSON.stringify({ done: true, patched, skipped }, null, 2));
})();
