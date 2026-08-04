import type { ReactNode } from "react";

export default function KentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="kent-product-scope">
      <style>{`
        .kent-product-scope main .grid > a[href^="/products/kent/item/"] {
          display: block;
          height: 100%;
        }

        .kent-product-scope main .grid > a[href^="/products/kent/item/"] > article {
          display: flex;
          height: 100%;
          flex-direction: column;
        }

        .kent-product-scope main .grid > a[href^="/products/kent/item/"] > article > div:last-child {
          display: flex;
          flex: 1 1 auto;
          flex-direction: column;
        }

        .kent-product-scope main .grid > a[href^="/products/kent/item/"] > article > div:last-child > div:last-child {
          margin-top: auto;
          padding-top: 1.25rem;
        }
      `}</style>
      {children}
    </div>
  );
}
