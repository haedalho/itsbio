from pathlib import Path

PAGE = Path("app/products/abm/[[...path]]/page.tsx")
text = PAGE.read_text(encoding="utf-8")
original = text

# 1) Give every desktop flyout a parent label so the second-level menu has a clear orange header bar.
text = text.replace(
    '  function FlyoutRows({ nodes }: { nodes: TreeNode[] }) {',
    '  function FlyoutRows({ nodes, parentTitle }: { nodes: TreeNode[]; parentTitle?: string }) {',
    1,
)

flyout_shell = '''    return (\n      <div className="w-[250px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_38px_rgba(15,23,42,0.16)]">\n        <div className="space-y-0.5">'''
flyout_shell_new = '''    return (\n      <div className="w-[264px] overflow-visible rounded-xl border border-orange-200 bg-white p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.22)]">\n        {parentTitle ? (\n          <div className="-mx-1.5 -mt-1.5 mb-1.5 rounded-t-xl bg-orange-500 px-4 py-2.5 text-[12px] font-bold tracking-[0.04em] text-white">\n            {stripBrandSuffix(parentTitle)}\n          </div>\n        ) : null}\n        <div className="space-y-0.5">'''
if flyout_shell in text:
    text = text.replace(flyout_shell, flyout_shell_new, 1)

# 2) Nested menus keep the same pattern and show their own orange section title.
text = text.replace(
    '<FlyoutRows nodes={node.children} />',
    '<FlyoutRows nodes={node.children} parentTitle={node.title} />',
)

# 3) Do not suppress flyout on the currently-open trail. Hover should still work on active sections.
text = text.replace(
    '{hasChildren && !isOpen ? (',
    '{hasChildren ? (',
)

# 4) Raise all flyouts above product imagery/content stacking contexts.
text = text.replace('z-[90] hidden pl-2 lg:group-hover/flyout:block', 'z-[140] hidden pl-2 lg:group-hover/flyout:block')
text = text.replace('z-[80] hidden pl-2 lg:group-hover/tree-row:block', 'z-[130] hidden pl-2 lg:group-hover/tree-row:block')

# 5) The active root (notably Cellular Materials) also gets a desktop hover flyout.
old_root = '''        {!isKentMode && activeRoot ? (\n          <Link href={buildHref(brandKey, [activeRoot])} prefetch={false} className="mb-1 flex min-h-10 items-center justify-between rounded-xl bg-orange-50 px-3 py-2.5 text-[13px] font-semibold text-[#dc5a2b]">\n            <span>{stripBrandSuffix(activeRootTitle)}</span><span aria-hidden>⌃</span>\n          </Link>\n        ) : null}'''
new_root = '''        {!isKentMode && activeRoot ? (\n          <div className="group/root relative mb-1">\n            <Link href={buildHref(brandKey, [activeRoot])} prefetch={false} className="flex min-h-10 items-center justify-between rounded-xl bg-orange-50 px-3 py-2.5 text-[13px] font-semibold text-[#dc5a2b]">\n              <span>{stripBrandSuffix(activeRootTitle)}</span><span className="hidden lg:inline" aria-hidden>›</span><span className="lg:hidden" aria-hidden>⌃</span>\n            </Link>\n            {activeRootTree?.length ? (\n              <div className="absolute left-full top-0 z-[150] hidden pl-2 lg:group-hover/root:block">\n                <FlyoutRows nodes={activeRootTree} parentTitle={activeRootTitle} />\n              </div>\n            ) : null}\n          </div>\n        ) : null}'''
if old_root in text:
    text = text.replace(old_root, new_root, 1)

# 6) Put the sidebar itself in a high stacking layer so no landing-page image can paint over its flyout.
text = text.replace(
    'className="self-start lg:sticky lg:top-24"',
    'className="relative z-[70] self-start lg:sticky lg:top-24"',
)

if text == original:
    print("ABM sidebar hover/flyout polish is already applied.")
    raise SystemExit(0)

PAGE.write_text(text, encoding="utf-8")
print("Applied Cellular Materials root hover, high-z flyouts, and orange flyout headers.")
