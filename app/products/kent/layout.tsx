import type { ReactNode } from "react";

import KentImageRecoveryClient from "@/components/products/KentImageRecoveryClient";

export default function KentLayout({ children }: { children: ReactNode }) {
  return (
    <div data-kent-image-recovery-root>
      <KentImageRecoveryClient />
      {children}
    </div>
  );
}
