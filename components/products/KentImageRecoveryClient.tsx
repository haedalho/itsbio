"use client";

import * as React from "react";

type Target = {
  key: string;
  type: "product" | "category";
  value: string;
};

type PendingEntry = {
  target: Target;
  images: Set<HTMLImageElement>;
};

const PLACEHOLDER = "/kent-product-placeholder.svg";
const ROOT_SELECTOR = "[data-kent-image-recovery-root]";

function cleanPath(value: string) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/")
    .toLowerCase();
}

function targetFromImage(image: HTMLImageElement): Target | null {
  const anchor = image.closest("a[href]") as HTMLAnchorElement | null;
  if (!anchor) return null;

  let pathname = "";
  try {
    pathname = new URL(anchor.href, window.location.origin).pathname;
  } catch {
    pathname = anchor.getAttribute("href") || "";
  }

  const productPrefix = "/products/kent/item/";
  if (pathname.startsWith(productPrefix)) {
    const value = cleanPath(decodeURIComponent(pathname.slice(productPrefix.length)));
    return value ? { key: `product:${value}`, type: "product", value } : null;
  }

  const categoryPrefix = "/products/kent/";
  if (pathname.startsWith(categoryPrefix) && !pathname.includes("/legacy")) {
    const value = cleanPath(decodeURIComponent(pathname.slice(categoryPrefix.length)));
    return value ? { key: `category:${value}`, type: "category", value } : null;
  }

  return null;
}

function showPlaceholder(image: HTMLImageElement) {
  if (image.dataset.kentImageRecovery === "placeholder") return;
  image.dataset.kentImageRecovery = "placeholder";
  image.removeAttribute("srcset");
  image.removeAttribute("sizes");
  image.src = PLACEHOLDER;
}

function applyCandidates(image: HTMLImageElement, candidates: string[]) {
  const current = String(image.currentSrc || image.src || "").split("?")[0];
  const queue = [...new Set(candidates.map((value) => String(value || "").trim()).filter(Boolean))]
    .filter((value) => value.split("?")[0] !== current);

  if (!queue.length) {
    showPlaceholder(image);
    return;
  }

  image.dataset.kentImageRecovery = "recovering";
  image.removeAttribute("srcset");
  image.removeAttribute("sizes");

  let index = 0;

  const cleanup = () => {
    image.removeEventListener("error", tryNext);
    image.removeEventListener("load", handleLoad);
  };

  const handleLoad = () => {
    image.dataset.kentImageRecovery = "recovered";
    cleanup();
  };

  const tryNext = () => {
    if (index >= queue.length) {
      cleanup();
      showPlaceholder(image);
      return;
    }

    image.src = queue[index];
    index += 1;
  };

  image.addEventListener("error", tryNext);
  image.addEventListener("load", handleLoad);
  tryNext();
}

export default function KentImageRecoveryClient() {
  React.useEffect(() => {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;

    const pending = new Map<string, PendingEntry>();
    let flushTimer: number | null = null;

    const flush = async () => {
      flushTimer = null;
      const batch = [...pending.values()];
      pending.clear();
      if (!batch.length) return;

      try {
        const response = await fetch("/api/kent/product-images", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ targets: batch.map((entry) => entry.target) }),
        });

        if (!response.ok) throw new Error(`Image recovery failed: ${response.status}`);
        const payload = await response.json() as { images?: Record<string, string[]> };
        const map = payload?.images || {};

        for (const entry of batch) {
          const candidates = Array.isArray(map[entry.target.key]) ? map[entry.target.key] : [];
          for (const image of entry.images) applyCandidates(image, candidates);
        }
      } catch {
        for (const entry of batch) {
          for (const image of entry.images) showPlaceholder(image);
        }
      }
    };

    const queueImage = (image: HTMLImageElement) => {
      const status = image.dataset.kentImageRecovery;
      if (status === "queued" || status === "recovering" || status === "recovered" || status === "placeholder") return;

      const target = targetFromImage(image);
      if (!target) {
        showPlaceholder(image);
        return;
      }

      image.dataset.kentImageRecovery = "queued";
      const entry = pending.get(target.key) || { target, images: new Set<HTMLImageElement>() };
      entry.images.add(image);
      pending.set(target.key, entry);

      if (flushTimer === null) flushTimer = window.setTimeout(flush, 60);
    };

    const handleError = (event: Event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      if (!root.contains(image)) return;
      queueImage(image);
    };

    root.addEventListener("error", handleError, true);

    const scanBrokenImages = () => {
      root.querySelectorAll("img").forEach((node) => {
        const image = node as HTMLImageElement;
        if (image.complete && image.naturalWidth === 0) queueImage(image);
      });
    };

    const observer = new MutationObserver(() => window.setTimeout(scanBrokenImages, 0));
    observer.observe(root, { childList: true, subtree: true });
    window.setTimeout(scanBrokenImages, 0);

    return () => {
      root.removeEventListener("error", handleError, true);
      observer.disconnect();
      if (flushTimer !== null) window.clearTimeout(flushTimer);
    };
  }, []);

  return null;
}
