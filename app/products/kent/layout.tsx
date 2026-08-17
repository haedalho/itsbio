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

        /* Kent product/category hero only. Keep the existing page structure and
           navigation untouched while replacing the generic shared hero image. */
        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child {
          isolation: isolate;
          min-height: 220px;
          background:
            radial-gradient(circle at 83% 48%, rgba(84, 197, 255, .25) 0 5%, transparent 5.4%),
            linear-gradient(108deg, #07182b 0%, #0b3158 48%, #0878b9 100%);
        }

        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child > img {
          display: none !important;
        }

        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child > div:nth-of-type(1) {
          background: linear-gradient(90deg, rgba(4, 17, 31, .32), rgba(4, 17, 31, .05) 65%, transparent) !important;
        }

        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child > div:nth-of-type(2) {
          background-image:
            linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px) !important;
          background-size: 44px 44px !important;
          opacity: .6;
          mask-image: linear-gradient(to right, transparent 25%, black 72%, black 100%);
        }

        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child::before,
        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child::after {
          content: "";
          position: absolute;
          z-index: 1;
          top: 50%;
          right: 9%;
          transform: translateY(-50%);
          border-radius: 9999px;
          pointer-events: none;
        }

        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child::before {
          width: 250px;
          height: 250px;
          border: 1px solid rgba(186, 230, 253, .28);
          box-shadow: inset 0 0 0 54px rgba(125, 211, 252, .035);
        }

        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child::after {
          right: calc(9% + 79px);
          width: 92px;
          height: 92px;
          border: 1px solid rgba(224, 242, 254, .5);
          background: rgba(56, 189, 248, .13);
          box-shadow: 0 0 55px rgba(56, 189, 248, .22);
        }

        .kent-product-scope section:has(img[alt="Products hero"]) h1 {
          max-width: 760px;
          font-weight: 600;
          letter-spacing: -.035em;
          line-height: 1.12;
        }

        .kent-product-scope section:has(img[alt="Products hero"]) h1::after {
          content: "Laboratory animal research systems, instruments and accessories";
          display: block;
          max-width: 680px;
          margin-top: 14px;
          color: rgba(224, 242, 254, .78);
          font-size: 14px;
          font-weight: 400;
          letter-spacing: 0;
          line-height: 1.65;
        }

        @media (min-width: 768px) {
          .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child {
            min-height: 280px;
          }
        }

        @media (max-width: 767px) {
          .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child::before {
            right: -90px;
            width: 220px;
            height: 220px;
          }

          .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child::after {
            right: -10px;
          }
        }
      `}</style>
      {children}
    </div>
  );
}
