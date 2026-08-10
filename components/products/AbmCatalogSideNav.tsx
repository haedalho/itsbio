import Link from "next/link";

import {
  ABM_PRODUCT_GROUPS,
  ABM_SERVICE_GROUPS,
  abmServiceCategoryHref,
  type AbmServiceCategory,
} from "@/lib/abm/catalog-taxonomy";

function serviceNodeActive(activePath: string[], nodePath: string[]) {
  return nodePath.every((segment, index) => activePath[index] === segment);
}

function ServiceNodes({
  nodes,
  parentPath,
  activePath,
  depth = 0,
}: {
  nodes: AbmServiceCategory[];
  parentPath: string[];
  activePath: string[];
  depth?: number;
}) {
  if (!nodes.length) return null;
  return (
    <div className={depth ? "ml-3 border-l border-neutral-200 pl-2" : ""}>
      {nodes.map((node) => {
        const path = [...parentPath, node.slug];
        const onTrail = serviceNodeActive(activePath, path);
        const exact = activePath.join("/") === path.join("/");
        return (
          <div key={path.join("/")}>
            <Link
              href={abmServiceCategoryHref(path)}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm leading-5 transition ${
                exact
                  ? "bg-orange-100 font-semibold text-orange-800"
                  : onTrail
                    ? "font-semibold text-orange-700 hover:bg-orange-50"
                    : "text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <span>{node.title}</span>
              <span className="ml-2 shrink-0 text-neutral-300" aria-hidden>›</span>
            </Link>
            {node.children?.length && onTrail ? (
              <ServiceNodes nodes={node.children} parentPath={path} activePath={activePath} depth={depth + 1} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function AbmCatalogSideNav({
  activeProductRoot = "",
  activeServicePath = [],
}: {
  activeProductRoot?: string;
  activeServicePath?: string[];
}) {
  return (
    <nav className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm" aria-label="ABM Products and Services">
      <div className="border-b border-neutral-200 px-5 py-4">
        <div className="text-base font-semibold text-orange-700">ABM Catalog</div>
      </div>

      <div className="p-2">
        <div className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Products</div>
        <div className="space-y-1">
          {ABM_PRODUCT_GROUPS.map((group) => (
            <Link
              key={group.slug}
              href={group.href}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
                activeProductRoot === group.slug
                  ? "bg-orange-100 font-semibold text-orange-800"
                  : "text-neutral-800 hover:bg-neutral-50"
              }`}
            >
              <span>{group.title}</span><span className="text-neutral-300" aria-hidden>›</span>
            </Link>
          ))}
        </div>

        <div className="my-3 border-t border-neutral-200" />
        <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Services</div>
        <div className="space-y-1">
          {ABM_SERVICE_GROUPS.map((group) => {
            const path = [group.slug];
            const onTrail = serviceNodeActive(activeServicePath, path);
            const exact = activeServicePath.length === 1 && onTrail;
            return (
              <div key={group.slug}>
                <Link
                  href={group.href}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
                    exact
                      ? "bg-orange-100 font-semibold text-orange-800"
                      : onTrail
                        ? "font-semibold text-orange-700 hover:bg-orange-50"
                        : "text-neutral-800 hover:bg-neutral-50"
                  }`}
                >
                  <span>{group.title}</span><span className="text-neutral-300" aria-hidden>›</span>
                </Link>
                {group.children?.length && onTrail ? (
                  <ServiceNodes nodes={group.children} parentPath={path} activePath={activeServicePath} depth={1} />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
