from pathlib import Path

path = Path("app/products/kent/[[...path]]/page.tsx")
text = path.read_text()
old = '''  const pageType = resolvePageType(category, pathStr, directChildren.length, officialProductCount);
'''
new = '''  const pageType: PageType = currentCategory
    ? (directChildren.length > 0 ? "landing" : "listing")
    : resolvePageType(category, pathStr, directChildren.length, officialProductCount);
'''
count = text.count(old)
if count != 1:
    raise SystemExit(f"page type integration: expected one match, found {count}")
path.write_text(text.replace(old, new, 1))
print(f"Patched exact page types in {path}")
