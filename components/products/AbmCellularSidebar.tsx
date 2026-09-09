import Link from "next/link";

import abmCellularTaxonomy from "@/data/abm-cellular-taxonomy.json";
import { ABM_SERVICE_GROUPS } from "@/lib/abm/catalog-taxonomy";

type TaxonomyNode = {
  slug: string;
  title: string;
  sourceUrl: string;
  children?: TaxonomyNode[];
};

const CELLULAR_ROOT = ["cellular-materials"];

function categoryHref(path: string[]) {
  return `/products/abm/${path.map(encodeURIComponent).join("/")}`;
}

function isPathPrefix(activePath: string[], candidatePath: string[]) {
  return candidatePath.every((segment, index) => activePath[index] === segment);
}

function FlyoutRows({
  nodes,
  activePath,
  parentPath,
  parentTitle,
}: {
  nodes: TaxonomyNode[];
  activePath: string[];
  parentPath: string[];
  parentTitle: string;
}) {
  if (!nodes.length) return null;

  return (
    <div className="relative z-[9999] w-[272px] overflow-visible rounded-xl border border-orange-200 bg-white p-1.5 shadow-[0_20px_50px_rgba(15,23,42,0.24)]">
      <div className="-mx-1.5 -mt-1.5 mb-1.5 rounded-t-xl bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-2.5 text-[12px] font-bold tracking-[0.03em] text-white shadow-sm">
        {parentTitle}
      </div>

      <div className="space-y-0.5">
        {nodes.map((node) => {
          const nodePath = [...parentPath, node.slug];
          const isActive = activePath.join("/") === nodePath.join("/");
          const isOnTrail = !isActive && isPathPrefix(activePath, nodePath);
          const children = node.children || [];
          const hasChildren = children.length > 0;

          return (
            <div key={nodePath.join("/")} className="group/cellular-flyout relative">
              <Link
                href={categoryHref(nodePath)}
                prefetch={false}
                className={[
                  "flex min-h-9 items-center justify-between gap-3 rounded-lg px-3 py-2 text-[13px] leading-5 transition",
                  isActive
                    ? "bg-orange-100 font-semibold text-orange-700"
                    : isOnTrail
                      ? "bg-orange-50 font-semibold text-orange-600"
                      : "text-neutral-700 hover:bg-orange-50 hover:text-orange-700",
                ].join(" ")}
              >
                <span className="min-w-0 whitespace-normal">{node.title}</span>
                {hasChildren ? <span className="shrink-0 text-orange-500" aria-hidden>›</span> : null}
              </Link>

              {hasChildren ? (
                <div className="absolute left-full top-0 z-[10000] hidden pl-2 lg:group-hover/cellular-flyout:block">
                  <FlyoutRows
                    nodes={children}
                    activePath={activePath}
                    parentPath={nodePath}
                    parentTitle={node.title}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaxonomyRows({
  nodes,
  activePath,
  parentPath = CELLULAR_ROOT,
  depth = 0,
}: {
  nodes: TaxonomyNode[];
  activePath: string[];
  parentPath?: string[];
  depth?: number;
}) {
  return (
    <div className={depth ? "ml-4 space-y-0.5 border-l border-dashed border-orange-200 pl-3" : "space-y-1"}>
      {nodes.map((node) => {
        const nodePath = [...parentPath, node.slug];
        const isActive = activePath.join("/") === nodePath.join("/");
        const isOnTrail = !isActive && isPathPrefix(activePath, nodePath);
        const children = node.children || [];
        const hasChildren = children.length > 0;
        const isOpen = hasChildren && (isActive || isOnTrail);

        return (
          <div key={nodePath.join("/")} className="group/cellular-row relative">
            <Link
              href={categoryHref(nodePath)}
              prefetch={false}
              className={[
                "group flex min-h-10 items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[13px] leading-5 transition",
                isActive
                  ? "bg-orange-100 font-semibold text-orange-700"
                  : isOnTrail
                    ? "bg-orange-50 font-semibold text-orange-600"
                    : "text-neutral-700 hover:bg-orange-50 hover:text-orange-700",
              ].join(" ")}
            >
              <span className="min-w-0 whitespace-normal">{node.title}</span>
              {hasChildren ? (
                <span className="shrink-0 text-orange-500" aria-hidden>
                  <span className="hidden lg:inline">›</span>
                  <span className="lg:hidden">{isOpen ? "⌃" : "⌄"}</span>
                </span>
              ) : (
                <span className="shrink-0 text-neutral-300 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden>›</span>
              )}
            </Link>

            {isOpen ? (
              <div className="lg:block">
                <TaxonomyRows
                  nodes={children}
                  activePath={activePath}
                  parentPath={nodePath}
                  depth={depth + 1}
                />
              </div>
            ) : null}

            {hasChildren ? (
              <div className="absolute left-full top-0 z-[9998] hidden pl-2 lg:group-hover/cellular-row:block">
                <FlyoutRows
                  nodes={children}
                  activePath={activePath}
                  parentPath={nodePath}
                  parentTitle={node.title}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function AbmCellularSidebar({ activePath }: { activePath: string[] }) {
  const taxonomy = abmCellularTaxonomy as TaxonomyNode[];

  return (
    <div className="relative z-[500] overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-orange-100 bg-orange-50 px-5 py-4">
        <div className="text-base font-semibold text-orange-600">All Products</div>
      </div>

      <nav className="max-h-[calc(100vh-170px)] overflow-y-auto p-2 lg:max-h-none lg:overflow-visible" aria-label="ABM product categories">
        <div className="group/cellular-root relative mb-1">
          <Link
            href={categoryHref(CELLULAR_ROOT)}
            prefetch={false}
            className="flex min-h-10 items-center justify-between rounded-xl bg-orange-50 px-3 py-2.5 text-[13px] font-semibold text-[#dc5a2b] transition hover:bg-orange-100"
          >
            <span>Cellular Materials</span>
            <span className="text-orange-500" aria-hidden>
              <span className="hidden lg:inline">›</span>
              <span className="lg:hidden">⌃</span>
            </span>
          </Link>

          <div className="absolute left-full top-0 z-[9997] hidden pl-2 lg:group-hover/cellular-root:block">
            <FlyoutRows
              nodes={taxonomy}
              activePath={activePath}
              parentPath={CELLULAR_ROOT}
              parentTitle="Cellular Materials"
            />
          </div>
        </div>

        <TaxonomyRows nodes={taxonomy} activePath={activePath} />

        <div className="mt-2 border-t border-slate-200 pt-2">
          <Link href="/products/abm/general-materials" prefetch={true} className="flex min-h-10 items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 hover:text-[#dc5a2b]">
            <span>General Materials</span><span aria-hidden>⌄</span>
          </Link>
          <Link href="/products/abm/genetic-materials" prefetch={true} className="flex min-h-10 items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 hover:text-[#dc5a2b]">
            <span>Genetic Materials</span><span aria-hidden>⌄</span>
          </Link>
        </div>

        <div className="mt-3 border-t border-slate-200 pt-3">
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">Services</div>
          {ABM_SERVICE_GROUPS.map((group) => (
            <Link
              key={group.slug}
              href={group.href}
              prefetch={true}
              className="flex min-h-10 items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 hover:text-[#dc5a2b]"
            >
              <span>{group.title}</span><span className="text-neutral-300" aria-hidden>›</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
