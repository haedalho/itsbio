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
    <div className={depth ? "ml-3 pl-2" : ""}>
      {nodes.map((node) => {
        const path = [...parentPath, node.slug];
        const onTrail = serviceNodeActive(activePath, path);
        const exact = activePath.join("/") === path.join("/");
        return (
          <div key={path.join("/")}>
            <Link
              href={abmServiceCategoryHref(path)}
              className={`flex items-center justify-between px-2 py-1.5 text-sm leading-5 transition ${
                exact
                  ? "font-semibold text-[#dc5a2b]"
                  : onTrail
                    ? "font-semibold text-[#dc5a2b]"
                    : "text-neutral-700 hover:text-[#dc5a2b]"
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
  mode = "product",
  activeProductRoot = "",
  activeServicePath = [],
}: {
  mode?: "product" | "service";
  activeProductRoot?: string;
  activeServicePath?: string[];
}) {
  const serviceMode = mode === "service";
  return (
    <nav className="overflow-hidden rounded-sm border border-neutral-200 bg-white shadow-sm" aria-label="ABM Products and Services">
      <div className="border-b border-neutral-200 bg-neutral-100 px-5 py-3">
        <div className="text-xl font-bold text-[#dc5a2b]">{serviceMode ? "All Services" : "All Products"}</div>
      </div>

      <div className="p-3">
        {!serviceMode ? <div>
          {ABM_PRODUCT_GROUPS.map((group) => (
            <Link
              key={group.slug}
              href={group.href}
              className={`flex items-center justify-between px-2 py-2 text-sm font-semibold transition ${
                activeProductRoot === group.slug
                  ? "text-[#dc5a2b]"
                  : "text-neutral-800 hover:text-[#dc5a2b]"
              }`}
            >
              <span>{group.title}</span><span className="text-neutral-300" aria-hidden>›</span>
            </Link>
          ))}
        </div> : null}

        {serviceMode ? <div>
          {ABM_SERVICE_GROUPS.map((group) => {
            const path = [group.slug];
            const onTrail = serviceNodeActive(activeServicePath, path);
            const exact = activeServicePath.length === 1 && onTrail;
            return (
              <div key={group.slug}>
                <Link
                  href={group.href}
                  className={`flex items-center justify-between px-2 py-2 text-sm font-semibold transition ${
                    exact
                      ? "text-[#dc5a2b]"
                      : onTrail
                        ? "text-[#dc5a2b]"
                        : "text-neutral-800 hover:text-[#dc5a2b]"
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
        </div> : null}
      </div>
    </nav>
  );
}
