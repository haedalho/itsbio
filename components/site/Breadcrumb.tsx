"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Crumb = { label: string; href?: string };

const SEGMENT_LABEL_EN: Record<string, string> = {
  products: "Products",
  promotions: "Promotions",
  resources: "Resources",
  notice: "Notice",
  about: "About",
  contact: "Contact",
  services: "Services",
};

const SLUG_LABEL_EN: Record<string, string> = {
  // 필요하면 여기 추가
  "custom-gmp-protein": "Custom GMP-grade Protein Service",
};

function humanize(segment: string) {
  if (SLUG_LABEL_EN[segment]) return SLUG_LABEL_EN[segment];
  if (SEGMENT_LABEL_EN[segment]) return SEGMENT_LABEL_EN[segment];

  return decodeURIComponent(segment)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean);

  const crumbs: Crumb[] = [{ label: "Home", href: "/" }];

  let acc = "";
  segments.forEach((seg, idx) => {
    acc += `/${seg}`;
    const isLast = idx === segments.length - 1;

    crumbs.push({
      label: humanize(seg),
      href: isLast ? undefined : acc,
    });
  });

  return crumbs;
}

export default function Breadcrumb() {
  const pathname = usePathname();

  // ✅ 홈에서는 숨김
  if (!pathname || pathname === "/") return null;

  const items = buildCrumbs(pathname);
  if (items.length <= 1) return null;

  return (
  <nav aria-label="Breadcrumb" className="w-full">
    <ol className="flex flex-wrap items-center justify-end gap-3 text-[22px] font-medium text-neutral-700 leading-none">
      {items.map((c, i) => {
        const isLast = i === items.length - 1;
        return (
          <li key={`${c.label}-${i}`} className="flex items-center gap-3">
            {c.href && !isLast ? (
              <Link href={c.href} className="hover:text-neutral-900">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-neutral-900">
                {c.label}
              </span>
            )}
            {!isLast && <span className="text-neutral-400">›</span>}
          </li>
        );
      })}
    </ol>
  </nav>
);
}