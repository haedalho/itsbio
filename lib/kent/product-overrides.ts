import SOMNOSUITE from "./official-somnosuite";
import { getKentOfficialProductOverride as getLegacyOverride } from "./official-product-overrides";

export function getKentProductOverride(slug: string) {
  const key = String(slug || "").trim().toLowerCase();
  if (key === "somnosuite") return SOMNOSUITE;
  return getLegacyOverride(key);
}
