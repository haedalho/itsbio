import type { ReactNode } from "react";

// Staged ABM detail pages are actively backfilled in Sanity. Force fresh reads so
// newly migrated reviewed detail appears immediately instead of serving an older
// cached fallback response from before the detail chunk existed.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default function AbmStagedDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
