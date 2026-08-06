import { createClient } from "next-sanity";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION!,
  // ✅ 디버깅/즉시 반영을 위해 CDN 비활성 (patch 직후 stale 방지)
  useCdn: false,
});

const originalFetch = client.fetch.bind(client);

const kentAwareFetch = ((
  query: string,
  params?: Record<string, unknown>,
  options?: unknown,
) => {
  const resolvedParams =
    params?.brandKey === "kent" && params?.productType === "product"
      ? { ...params, productType: "kentPreviewProduct" }
      : params;

  return originalFetch(query, resolvedParams, options as never);
}) as typeof client.fetch;

Object.defineProperty(client, "fetch", {
  configurable: true,
  value: kentAwareFetch,
});

export const sanityClient = client;
