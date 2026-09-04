import type { CleaverVideo } from "@/lib/cleaver/catalog";

function normalized(value?: string) {
  return String(value || "").normalize("NFKC").trim().toLowerCase();
}

function sourceProductPath(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.pathname.toLowerCase().replace(/\/+$/, "");
  } catch {
    return normalized(value).replace(/^https?:\/\/[^/]+/i, "").replace(/\/+$/, "");
  }
}

/**
 * Source-of-truth rule: never substitute a parent/family product image when
 * the exact Thistle product page has no standalone image.
 */
export function verifiedCleaverFamilyImages(_sku?: string, _sourceTitle?: string) {
  return [];
}

const VIDEO_MULTI_SUB: CleaverVideo = {
  title: "How To Cast And Run An Agarose Gel in The Multi Sub Mini Electrophoresis System",
  url: "https://www.youtube.com/watch?v=zXgM10ghY_w",
  embedUrl: "https://www.youtube.com/embed/zXgM10ghY_w",
};

const VIDEO_FLEXICASTER: CleaverVideo = {
  title: "How To Cast An Agarose Gel Using The MS Screen Flexicaster",
  url: "https://www.youtube.com/watch?v=UXt2F90fLpc",
  embedUrl: "https://www.youtube.com/embed/UXt2F90fLpc",
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

const MULTI_SUB_VIDEO_PATHS = new Set([
  "/product/multisub-mini-mini-horizontal-electrophoresis-system",
  "/product/multisub-midi-midi-horizontal-electrophoresis-system",
  "/product/multisub-choice-wide-midi-horizontal-electrophoresis-system",
  "/product/multisub-maxi-maxi-horizontal-electrophoresis-system",
  "/product/multisub-screen-high-throughput-horizontal-electrophoresis-system",
  "/product/multisub-mini-rapide-mini-horizontal-electrophoresis-system",
  "/product/multisub-system-package-deals",
  "/product/hpage-horizontal-page-system",
]);

const RUNVIEW_VIDEO_PATHS = new Set([
  "/product/runview-real-time-gel-visualisation-system",
  "/product/rundoc-gel-documentation-system",
  "/product/multisub-mini-duo-with-mini-runview-gel-viewer",
  "/product/multisub-midi-duo-with-mini-runview-gel-viewer",
  "/product/runview-base-station-bluview-lid-for-multisub-choice",
  "/product/runview-base-station-bluview-lid-for-msmini-systems",
  "/product/runview-base-station-bluview-lid-for-msmidi-systems",
]);

const OMNIPAGE_MINI_VIDEO_PATHS = new Set([
  "/product/omnipage-mini-vertical-protein-electrophoresis-system",
  "/product/omnipage-mini-tetrad-vertical-electrophoresis-for-4-handcast-gels",
  "/product/glass-plates-for-the-omnipage-mini",
  "/product/omnipage-mini-tank",
  "/product/omnipage-mini-inner-running-module",
  "/product/omnipage-mini-packages",
  "/product/flatbed-ief-package-with-chiller-and-power-supply",
]);

const WAVE_MAXI_VIDEO_PATHS = new Set([
  "/product/omnipage-wave-maxi",
  "/product/omnipage-wave-maxi-maxi-cooling-block",
  "/product/omnipage-wave-maxi-packages",
]);

/**
 * Only exact Thistle product pages that were verified to contain the Video
 * section are mapped here. Never infer a video from the product title/family.
 */
export function verifiedCleaverSourceVideos(sourceUrl?: string, _sourceTitle?: string): CleaverVideo[] {
  const path = sourceProductPath(sourceUrl);

  if (MULTI_SUB_VIDEO_PATHS.has(path)) return [VIDEO_MULTI_SUB];
  if (path === "/product/multisub-flexicasters") return [VIDEO_FLEXICASTER];
  if (RUNVIEW_VIDEO_PATHS.has(path)) return [VIDEO_RUNVIEW];
  if (OMNIPAGE_MINI_VIDEO_PATHS.has(path)) return [VIDEO_OMNIPAGE_MINI];
  if (WAVE_MAXI_VIDEO_PATHS.has(path)) return [VIDEO_WAVE_MAXI];

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
