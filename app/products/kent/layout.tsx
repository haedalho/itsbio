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

        /* Kent product/category hero only. The current official Kent header logo
           is blue/purple (#0040A8 / #300088); keep page structure/navigation intact. */
        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child {
          isolation: isolate;
          min-height: 220px;
          background: linear-gradient(108deg, #003783 0%, #0040a8 48%, #300088 100%);
        }

        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child > img {
          display: none !important;
        }

        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child > div:nth-of-type(1) {
          background: linear-gradient(90deg, rgba(0, 24, 74, .18), transparent 65%) !important;
        }

        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child > div:nth-of-type(2) {
          background-image:
            linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px) !important;
          background-size: 46px 46px !important;
          opacity: .7;
          mask-image: linear-gradient(to right, transparent 22%, black 70%, black 100%);
        }

        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child::before,
        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child::after {
          content: "";
          position: absolute;
          z-index: 2;
          pointer-events: none;
        }

        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child::before {
          top: 50%;
          right: max(6%, calc((100vw - 1320px) / 2 + 24px));
          width: 350px;
          height: 124px;
          transform: translateY(-50%);
          border: 1px solid rgba(255, 255, 255, .45);
          border-radius: 22px;
          background: rgba(255,255,255,.96);
          box-shadow: 0 22px 60px rgba(5, 17, 70, .22);
        }

        .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child::after {
          top: 50%;
          right: max(calc(6% + 32px), calc((100vw - 1320px) / 2 + 56px));
          width: 286px;
          height: 76px;
          transform: translateY(-50%);
          background: url('/partners/KentScientific-logo.png') center / contain no-repeat;
        }

        .kent-product-scope section:has(img[alt="Products hero"]) h1 {
          max-width: 650px;
          padding-right: 22px;
          font-weight: 600;
          letter-spacing: -.035em;
          line-height: 1.12;
        }

        .kent-product-scope section:has(img[alt="Products hero"]) h1::after {
          content: "The Care of Science.";
          display: block;
          max-width: 520px;
          margin-top: 14px;
          color: rgba(255,255,255,.76);
          font-size: 14px;
          font-weight: 500;
          letter-spacing: .01em;
          line-height: 1.6;
        }

        @media (min-width: 768px) {
          .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child {
            min-height: 280px;
          }
        }

        @media (max-width: 960px) {
          .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child::before {
            right: 24px;
            width: 270px;
            height: 106px;
            opacity: .95;
          }

          .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child::after {
            right: 48px;
            width: 222px;
            height: 62px;
          }

          .kent-product-scope section:has(img[alt="Products hero"]) h1 {
            max-width: 480px;
          }
        }

        @media (max-width: 767px) {
          .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child::before {
            top: 22px;
            right: 18px;
            width: 178px;
            height: 70px;
            transform: none;
            border-radius: 14px;
            opacity: .92;
          }

          .kent-product-scope section:has(img[alt="Products hero"]) > div:first-child::after {
            top: 36px;
            right: 34px;
            width: 146px;
            height: 42px;
            transform: none;
          }

          .kent-product-scope section:has(img[alt="Products hero"]) h1 {
            max-width: 76%;
            padding-top: 44px;
          }

          .kent-product-scope section:has(img[alt="Products hero"]) h1::after {
            display: none;
          }
        }
      `}</style>
      {children}
    </div>
  );
}
