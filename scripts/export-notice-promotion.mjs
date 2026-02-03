import fs from "node:fs";
import { createClient } from "next-sanity";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";
const token =
  process.env.SANITY_WRITE_TOKEN ||
  process.env.SANITY_API_WRITE_TOKEN ||
  process.env.SANITY_TOKEN ||
  process.env.SANITY_API_TOKEN;

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });

async function main() {
  const notice = await client.fetch(`*[_type=="notice"] | order(publishedAt desc){...}`);
  const promotion = await client.fetch(`*[_type=="promotion"] | order(publishedAt desc){...}`);

  fs.mkdirSync("backups", { recursive: true });
  fs.writeFileSync("backups/notice.json", JSON.stringify(notice, null, 2), "utf8");
  fs.writeFileSync("backups/promotion.json", JSON.stringify(promotion, null, 2), "utf8");

  console.log("Saved backups:", notice.length, promotion.length);
}
main().catch((e) => (console.error(e), process.exit(1)));