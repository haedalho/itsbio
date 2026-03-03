// scripts/abm-restore-abm-categories.mjs
import { createClient } from "next-sanity";

const PROJECT_ID = (process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "").trim();
const DATASET = (process.env.NEXT_PUBLIC_SANITY_DATASET || "").trim();
const API_VERSION = (process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01").trim();
const TOKEN = (process.env.SANITY_WRITE_TOKEN || "").trim();

if (!PROJECT_ID || !DATASET) throw new Error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET");
if (!TOKEN) throw new Error("Missing SANITY_WRITE_TOKEN");

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: TOKEN,
  useCdn: false,
});

const BRAND = "abm";

async function main() {
  // abm 카테고리 중 isActive=false 인 것만 복구
  const ids = await client.fetch(
    `*[
      _type=="category"
      && (brand->slug.current==$brand || brand->themeKey==$brand || themeKey==$brand || brandSlug==$brand)
      && defined(isActive) && isActive==false
    ]._id`,
    { brand: BRAND }
  );

  console.log("targets:", ids.length);
  if (!ids.length) return;

  let tx = client.transaction();
  let c = 0;

  for (const id of ids) {
    tx = tx.patch(id, {
      set: { isActive: true },
      // order는 어차피 ABM sync로 다시 맞출 거라 여기선 건드리지 않음
    });
    c++;

    if (c >= 200) {
      await tx.commit({ autoGenerateArrayKeys: true });
      tx = client.transaction();
      c = 0;
    }
  }

  if (c > 0) await tx.commit({ autoGenerateArrayKeys: true });

  console.log("restored:", ids.length);
}

main().catch((e) => {
  console.error("[FATAL]", e?.message || e);
  process.exit(1);
});