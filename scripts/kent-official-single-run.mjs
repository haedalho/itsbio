#!/usr/bin/env node

// The Kent verifier is read-only. These public Sanity identifiers let CI read
// the same catalog without requiring private environment variables.
process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||= "9b5twpc8";
process.env.NEXT_PUBLIC_SANITY_DATASET ||= "production";
process.env.NEXT_PUBLIC_SANITY_API_VERSION ||= "2025-02-19";

await import("./kent-official-fidelity-verify.mjs");
