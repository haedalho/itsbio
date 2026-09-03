"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ManagedImageMap = Record<string, string[]>;

const CleaverManagedImagesContext = createContext<ManagedImageMap>({});

function normalizeSku(value: string) {
  return String(value || "").normalize("NFKC").trim().toUpperCase();
}

export function useCleaverManagedImages(sku?: string) {
  const images = useContext(CleaverManagedImagesContext);
  return images[normalizeSku(sku || "")] || [];
}

export default function CleaverCatalogImageProvider({
  skus,
  children,
}: {
  skus: string[];
  children: React.ReactNode;
}) {
  const normalizedSkus = useMemo(
    () => Array.from(new Set(skus.map(normalizeSku).filter(Boolean))),
    [skus],
  );
  const [managedImages, setManagedImages] = useState<ManagedImageMap>({});

  useEffect(() => {
    if (!normalizedSkus.length) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ skus: normalizedSkus.join(",") });

    fetch(`/api/cleaver/card-images?${params.toString()}`, {
      signal: controller.signal,
      cache: "force-cache",
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((payload: { images?: ManagedImageMap }) => {
        if (!payload?.images) return;
        setManagedImages(payload.images);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Unable to hydrate Cleaver managed card images:", error);
      });

    return () => controller.abort();
  }, [normalizedSkus]);

  return (
    <CleaverManagedImagesContext.Provider value={managedImages}>
      {children}
    </CleaverManagedImagesContext.Provider>
  );
}
