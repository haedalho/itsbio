import type { CleaverVideo } from "@/lib/cleaver/catalog";

const OMNIDOC_FAMILY_IMAGE = "https://www.thistlescientific.com/wp-content/uploads/2024/11/OMNID-4.WEB_.jpg";
const UV_TRANSILLUMINATOR_IMAGE = "https://www.thistlescientific.com/wp-content/uploads/2024/11/UVTRAN2.WEB_-scaled.jpg";
const RUNDOC_FAMILY_IMAGE = "https://www.thistlescientific.com/wp-content/uploads/2024/11/CSL-RVGELDOC-1.WEB_.jpg";

function normalized(value?: string) {
  return String(value || "").normalize("NFKC").trim().toLowerCase();
}

/**
 * Some Thistle accessory pages intentionally have no standalone product image.
 * Use only a verified first-party image from the exact compatible product
 * family in those cases. Exact source-page images always take precedence.
 */
export function verifiedCleaverFamilyImages(sku?: string, sourceTitle?: string) {
  const normalizedSku = String(sku || "").normalize("NFKC").trim().toUpperCase();
  const title = normalized(sourceTitle);

  if (normalizedSku.startsWith("OMNIDOC-") || title.includes("omnidoc")) {
    return [OMNIDOC_FAMILY_IMAGE];
  }

  if (/^CSL-F(?:21|26)/.test(normalizedSku) || title.includes("replacement transilluminator")) {
    return [UV_TRANSILLUMINATOR_IMAGE];
  }

  if (normalizedSku === "CSL-CAMCHARGER" || title.includes("rundoc camera")) {
    return [RUNDOC_FAMILY_IMAGE];
  }

  return [];
}

const VIDEO_MULTI_SUB: CleaverVideo = {
  title: "How To Cast And Run An Agarose Gel in The Multi Sub Mini Electrophoresis System",
  url: "https://www.youtube.com/watch?v=zXgM10ghY_w",
  embedUrl: "https://www.youtube.com/embed/zXgM10ghY_w",
};

const VIDEO_RUNVIEW: CleaverVideo = {
  title: "runVIEW system for DNA recovery from EtBr and SYBR stained gels",
  url: "https://www.youtube.com/watch?v=zuVyXPUbThk",
  embedUrl: "https://www.youtube.com/embed/zuVyXPUbThk",
};

const VIDEO_OMNIPAGE_MINI: CleaverVideo = {
  title: "Cast And Run A Polyacrylamide Gel Omni Page Mini Vertical Cleaver Scientific",
  url: "https://www.youtube.com/watch?v=x4X6WdOFHjk",
  embedUrl: "https://www.youtube.com/embed/x4X6WdOFHjk",
};

const VIDEO_WAVE_MAXI: CleaverVideo = {
  title: "How To Cast and Run a Polyacrylamide Gel In The Wave Maxi Vertical",
  url: "https://www.youtube.com/watch?v=529G-tXO5s4",
  embedUrl: "https://www.youtube.com/embed/529G-tXO5s4",
};

/**
 * Videos are attached only where the corresponding Thistle product page is
 * verified to expose that video. This deliberately avoids a generic Cleaver
 * video being shown on unrelated products.
 */
export function verifiedCleaverSourceVideos(sourceUrl?: string, sourceTitle?: string): CleaverVideo[] {
  const source = normalized(sourceUrl);
  const title = normalized(sourceTitle);

  if (
    source.includes("/product/multisub-mini-mini-horizontal-electrophoresis-system")
    || source.includes("/product/multisub-midi-midi-horizontal-electrophoresis-system")
    || source.includes("/product/multisub-choice-wide-midi-horizontal-electrophoresis-system")
    || source.includes("/product/multisub-maxi-maxi-horizontal-electrophoresis-system")
    || source.includes("/product/multisub-screen-high-throughput-horizontal-electrophoresis-system")
    || source.includes("/product/multisub-mini-rapide-mini-horizontal-electrophoresis-system")
    || source.includes("/product/multisub-system-package-deals")
  ) {
    return [VIDEO_MULTI_SUB];
  }

  if (
    source.includes("/product/runview-real-time-gel-visualisation-system")
    || source.includes("/product/rundoc-gel-documentation-system")
    || source.includes("/product/multisub-mini-duo-with-mini-runview-gel-viewer")
    || source.includes("/product/multisub-midi-duo-with-mini-runview-gel-viewer")
    || title.includes("runview")
    || title.includes("rundoc gel documentation system")
  ) {
    return [VIDEO_RUNVIEW];
  }

  if (source.includes("/product/omnipage-mini-") || source.includes("/product/glass-plates-for-the-omnipage-mini")) {
    return [VIDEO_OMNIPAGE_MINI];
  }

  if (source.includes("/product/omnipage-wave-maxi")) {
    return [VIDEO_WAVE_MAXI];
  }

  return [];
}

export function mergeCleaverVideos(...groups: Array<CleaverVideo[] | undefined>) {
  const seen = new Set<string>();
  const merged: CleaverVideo[] = [];
  for (const group of groups) {
    for (const video of group || []) {
      const key = normalized(video.embedUrl || video.url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(video);
    }
  }
  return merged;
}
