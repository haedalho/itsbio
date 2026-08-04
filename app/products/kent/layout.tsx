import type { ReactNode } from "react";

import "./kent-product-cards.css";

export default function KentLayout({ children }: { children: ReactNode }) {
  return <div className="kent-product-scope">{children}</div>;
}
