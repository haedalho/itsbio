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
        const isOpen = children.length > 0 && (isActive || isOnTrail);
        return (
          <div key={nodePath.join("/")}>
            <Link
              href={categoryHref(nodePath)}
              prefetch={false}
              className={[
                "group flex min-h-10 items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[13px] leading-5 transition",
                isActive
                  ? "bg-orange-100 font-semibold text-orange-700"
                  : isOnTrail
                    ? "bg-orange-50 font-semibold text-orange-600"
                    : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950",
              ].join(" ")}
            >
              <span className="min-w-0">{node.title}</span>
              {children.length ? (
                <span className={isOpen ? "text-orange-600" : "text-neutral-300 group-hover:text-neutral-500"} aria-hidden>
                  {isOpen ? "⌃" : "⌄"}
                </span>
              ) : (
                <span className="text-neutral-300 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden>›</span>
              )}
            </Link>
            {isOpen ? (
              <TaxonomyRows
                nodes={children}
                activePath={activePath}
                parentPath={nodePath}
                depth={depth + 1}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function AbmCellularSidebar({ activePath }: { activePath: string[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-orange-100 bg-orange-50 px-5 py-4">
        <div className="text-base font-semibold text-orange-600">All Products</div>
      </div>

      <nav className="max-h-[calc(100vh-170px)] overflow-y-auto p-2" aria-label="ABM product categories">
        <Link
          href={categoryHref(CELLULAR_ROOT)}
          prefetch={false}
          className="mb-1 flex min-h-10 items-center justify-between rounded-xl bg-orange-50 px-3 py-2.5 text-[13px] font-semibold text-[#dc5a2b]"
        >
          <span>Cellular Materials</span><span aria-hidden>⌃</span>
        </Link>

        <TaxonomyRows nodes={abmCellularTaxonomy as TaxonomyNode[]} activePath={activePath} />

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
