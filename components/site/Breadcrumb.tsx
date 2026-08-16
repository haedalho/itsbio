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

function DesktopBreadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <ol className="hidden min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[15px] font-medium leading-none text-neutral-600 sm:flex">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <li
            key={`${crumb.label}-${index}`}
            className={`flex min-w-0 items-center gap-2 ${isLast ? "flex-1" : "shrink-0"}`}
          >
            {crumb.href && !isLast ? (
              <Link href={crumb.href} className="shrink-0 transition hover:text-neutral-950">
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? "page" : undefined}
                title={crumb.label}
                className={isLast ? "block min-w-0 max-w-[min(58vw,720px)] truncate font-semibold text-neutral-900" : "shrink-0 text-neutral-900"}
              >
                {crumb.label}
              </span>
            )}
            {!isLast ? <span className="shrink-0 text-neutral-300">›</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function MobileBreadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  const first = crumbs[0];
  const last = crumbs[crumbs.length - 1];

  return (
    <ol className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[13px] font-medium text-neutral-600 sm:hidden">
      <li className="shrink-0">
        {first.href ? <Link href={first.href}>{first.label}</Link> : <span>{first.label}</span>}
      </li>
      <li className="shrink-0 text-neutral-300">›</li>
      {crumbs.length > 2 ? (
        <>
          <li className="shrink-0 text-neutral-400">…</li>
          <li className="shrink-0 text-neutral-300">›</li>
        </>
      ) : null}
      <li className="min-w-0 flex-1">
        <span title={last.label} aria-current="page" className="block truncate font-semibold text-neutral-900">
          {last.label}
        </span>
      </li>
    </ol>
  );
}

export default function Breadcrumb({ items }: { items?: Crumb[] }) {
  const pathname = usePathname();
  const resolved = items && items.length ? items : pathname ? buildCrumbs(pathname) : [];

  if ((!items || items.length === 0) && (!pathname || pathname === "/")) return null;
  if (resolved.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="w-full min-w-0 overflow-hidden">
      <DesktopBreadcrumb crumbs={resolved} />
      <MobileBreadcrumb crumbs={resolved} />
    </nav>
  );
}
