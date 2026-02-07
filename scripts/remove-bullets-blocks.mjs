import "dotenv/config";
import { createClient } from "next-sanity";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2026-02-05",
  token: process.env.SANITY_WRITE_TOKEN, // write token
  useCdn: false,
});

const QUERY = `
*[_type=="category" && defined(contentBlocks) && count(contentBlocks[_type=="contentBlockBullets"]) > 0]{
  _id,
  contentBlocks
}
`;

function isBadNavLikeBullets(block) {
  if (!block || block._type !== "contentBlockBullets") return false;
  const items = Array.isArray(block.items) ? block.items : [];
  const joined = items.filter(Boolean).join(" | ");
  // 네비/푸터 냄새 나는 키워드가 섞이면 제거 대상으로 본다
  return /Cart\s*0|My Account|Distributors|Promotion|Home|Sign In|Shopping Cart|Resources & Support/i.test(joined);
}

(async () => {
  const docs = await client.fetch(QUERY);
  console.log("found docs:", docs.length);

  for (const d of docs) {
    const next = (d.contentBlocks || []).filter((b) => !isBadNavLikeBullets(b));
    if (next.length === (d.contentBlocks || []).length) continue;

    await client.patch(d._id).set({ contentBlocks: next }).commit();
    console.log("patched:", d._id, "blocks:", (d.contentBlocks || []).length, "->", next.length);
  }

  console.log("done");
})();
