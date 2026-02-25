// lib/sanity/sanity.write.ts
// Server-only Sanity client for on-demand import/enrich (requires SANITY_WRITE_TOKEN).
import "server-only";

import { createClient } from "next-sanity";

export const sanityWriteClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION!,
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
});
