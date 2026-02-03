// scripts/link-abm-categories.mjs
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@sanity/client";

function readEnvFile(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le");
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.slice(3).toString("utf8");
  return buf.toString("utf8");
}
function loadDotEnv(files = [".env.local", ".env"]) {
  for (const f of files) {
    const p = path.resolve(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    const raw = readEnvFile(p);
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const eq = s.indexOf("=");
      if (eq < 0) continue;
      const key = s.slice(0, eq).trim();
      let val = s.slice(eq + 1).trim();
      val = val.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}
loadDotEnv();

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET;
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";
const TOKEN = (process.env.SANITY_WRITE_TOKEN || "").trim();

if (!PROJECT_ID || !DATASET || !TOKEN) {
  console.error("[ERROR] Missing env vars");
  process.exit(1);
}

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: TOKEN,
  useCdn: false,
});

const DRY = process.argv.includes("--dry");

async function main() {
  // 1) abm brand 찾기
  const brand = await client.fetch(
    `*[_type=="brand" && (themeKey==$k || slug.current==$k)][0]{_id,title,themeKey,"slug":slug.current}`,
    { k: "abm" }
  );
  if (!brand?._id) {
    throw new Error("ABM brand not found. 먼저 brand 문서가 있어야 해요.");
  }
  console.log("[brand]", brand);

  // 2) ABM 카테고리 후보 찾기: sourceUrl이 abmgood.com 인 것들
  //    (themeKey/brand가 비어있어도 잡히게)
  const cats = await client.fetch(
    `*[_type=="category" && defined(sourceUrl) && sourceUrl match "https://www.abmgood.com/*"]{
      _id, title, sourceUrl, themeKey, brand
    }`
  );

  console.log("[found categories]", cats.length);

  // 3) brand reference / themeKey 패치 (이미 되어 있으면 스킵)
  let updated = 0;
  for (const c of cats) {
    const hasBrand = c?.brand?._ref === brand._id;
    const hasTheme = c?.themeKey === "abm";

    if (hasBrand && hasTheme) continue;

    updated++;

    if (DRY) {
      console.log("[DRY] patch", c._id, { setBrand: !hasBrand, setThemeKey: !hasTheme });
      continue;
    }

    await client
      .patch(c._id)
      .set({
        themeKey: "abm",
        brand: { _type: "reference", _ref: brand._id },
      })
      .commit();

    console.log("[OK] patched", c._id);
  }

  console.log(`✅ done. patched: ${updated}${DRY ? " (dry-run)" : ""}`);
}

main().catch((e) => {
  console.error("[ERROR]", e?.responseBody || e);
  process.exit(1);
});
