import { createClient } from "next-sanity";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";
const token =
  process.env.SANITY_WRITE_TOKEN ||
  process.env.SANITY_API_WRITE_TOKEN ||
  process.env.SANITY_TOKEN ||
  process.env.SANITY_API_TOKEN;

if (!token) {
  console.error("Missing write token.");
  process.exit(1);
}

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });

const TYPES_TO_DELETE = [
  "product",
  "category",
  "brand",
  // 필요하면 아래도 같이 초기화(현재 schemaTypes/index.ts에선 productPage가 빠져있지만, 데이터가 있을 수 있음)
  "productPage",
];

async function delInBatches(ids, batchSize = 50) {
  let deleted = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const tx = client.transaction();
    for (const id of batch) tx.delete(id);
    await tx.commit();
    deleted += batch.length;
    console.log(`Deleted ${deleted}/${ids.length}`);
  }
}

async function main() {
  console.log("Project:", projectId, "Dataset:", dataset);
  console.log("Types:", TYPES_TO_DELETE.join(", "));

  const ids = await client.fetch(
    `*[_type in $types]{ _id }`,
    { types: TYPES_TO_DELETE }
  );

  const list = (ids || []).map((x) => x._id).filter(Boolean);
  console.log("Found docs:", list.length);

  if (!list.length) {
    console.log("Nothing to delete.");
    return;
  }

  await delInBatches(list, 50);
  console.log("Done.");
}

main().catch((e) => (console.error(e), process.exit(1)));
