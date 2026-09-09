# Applies the recursive ABM desktop hover-flyout behavior while preserving active-path inline navigation.
from pathlib import Path

PAGE = Path("app/products/abm/[[...path]]/page.tsx")
text = PAGE.read_text(encoding="utf-8")

if "function FlyoutRows({ nodes }" in text:
    print("ABM sidebar flyout behavior is already present.")
    raise SystemExit(0)

start_marker = "  function TreeRows({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {"
end_marker = "  return (\n    <div className=\"overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm\">"

if start_marker not in text:
    raise SystemExit("Could not find TreeRows start marker")
if end_marker not in text:
    raise SystemExit("Could not find SideNavTree return marker")

start = text.index(start_marker)
end = text.index(end_marker, start)

replacement = r'''  function FlyoutRows({ nodes }: { nodes: TreeNode[] }) {
    if (!nodes.length) return null;

    return (
      <div className="w-[250px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_38px_rgba(15,23,42,0.16)]">
        <div className="space-y-0.5">
          {nodes.map((node) => {
            const nodePath = node.path.join("/");
            const isActive = activePathStr === nodePath;
            const isOnTrail = isPrefix(activePathStr, nodePath) && !isActive;
            const hasChildren = node.children.length > 0;

            return (
              <div key={node.key} className="group/flyout relative">
                <Link
                  href={nodeHref(node)}
                  prefetch={false}
                  className={[
                    "flex min-h-9 items-center justify-between gap-3 rounded-lg px-3 py-2 text-[13px] leading-5 transition",
                    isActive
                      ? `${theme.accentActiveBg} ${theme.accentActiveText} font-semibold`
                      : isOnTrail
                        ? `${theme.accentSoftBg} ${theme.accentText} font-semibold`
                        : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950",
                  ].join(" ")}
                >
                  <span className="min-w-0 whitespace-normal">{stripBrandSuffix(node.title)}</span>
                  {hasChildren ? (
                    <span className={`${theme.accentText} shrink-0`} aria-hidden>›</span>
                  ) : null}
                </Link>

                {hasChildren ? (
                  <div className="absolute left-full top-0 z-[90] hidden pl-2 lg:group-hover/flyout:block">
                    <FlyoutRows nodes={node.children} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function TreeRows({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
    if (!nodes.length) return null;

    return (
      <div className={depth ? "ml-4 space-y-0.5 border-l border-dashed border-orange-200 pl-3" : "space-y-1"}>
        {nodes.map((node) => {
          const nodePath = node.path.join("/");
          const isActive = activePathStr === nodePath;
          const isOnTrail = isPrefix(activePathStr, nodePath) && !isActive;
          const hasChildren = node.children.length > 0;
          const isOpen = hasChildren && (isActive || isOnTrail);

          return (
            <div key={node.key} className="group/tree-row relative">
              <Link
                href={nodeHref(node)}
                prefetch={false}
                className={[
                  "group flex min-h-10 items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[13px] leading-5 transition",
                  isActive
                    ? `${theme.accentActiveBg} ${theme.accentActiveText} font-semibold`
                    : isOnTrail
                      ? `${theme.accentSoftBg} ${theme.accentText} font-semibold`
                      : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950",
                ].join(" ")}
              >
                <span className="min-w-0 whitespace-normal">{stripBrandSuffix(node.title)}</span>
                {hasChildren ? (
                  <span className={`${isOpen ? theme.accentText : "text-neutral-300 group-hover:text-neutral-500"} shrink-0`} aria-hidden>
                    {isOpen ? "⌃" : <span className="hidden lg:inline">›</span>}
                    {!isOpen ? <span className="lg:hidden">⌄</span> : null}
                  </span>
                ) : (
                  <span className="shrink-0 text-neutral-300 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden>›</span>
                )}
              </Link>

              {isOpen ? <TreeRows nodes={node.children} depth={depth + 1} /> : null}

              {hasChildren && !isOpen ? (
                <div className="absolute left-full top-0 z-[80] hidden pl-2 lg:group-hover/tree-row:block">
                  <FlyoutRows nodes={node.children} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

'''

updated = text[:start] + replacement + text[end:]
updated = updated.replace(
    '<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">',
    '<div className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">',
    1,
)
updated = updated.replace(
    '<nav className="max-h-[calc(100vh-170px)] overflow-y-auto p-2" aria-label="Product categories">',
    '<nav className="max-h-[calc(100vh-170px)] overflow-y-auto p-2 lg:max-h-none lg:overflow-visible" aria-label="Product categories">',
    1,
)

if updated == text:
    raise SystemExit("No sidebar changes were applied")

PAGE.write_text(updated, encoding="utf-8")
print("Applied recursive ABM sidebar hover flyouts.")
