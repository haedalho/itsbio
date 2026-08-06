from pathlib import Path

path = Path("app/products/kent/[[...path]]/page.tsx")
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    '  { title: "Feeding Needles", path: ["feeding-needles"] },\n  { title: "Mobile Carts", path: ["mobile-carts"] },',
    '  { title: "Feeding Needles", path: ["feeding-needles"] },\n  { title: "Imaging System", path: ["imaging-system"] },\n  { title: "Mobile Carts", path: ["mobile-carts"] },',
    "imaging system menu",
)

replace_once(
    '''const CURRENT_KENT_CATEGORIES_BY_LEAF = new Map<string, KentCurrentTaxonomyCategory[]>();
const CURRENT_KENT_CATEGORIES_BY_TITLE = new Map<string, KentCurrentTaxonomyCategory[]>();
''',
    '''const CURRENT_KENT_PATH_ALIASES = new Map<string, string>([
  ["animal-holders", "animal-handling/animal-holders"],
  ["laboratory-animal-handling/animal-holders", "animal-handling/animal-holders"],
]);
const CURRENT_KENT_CATEGORIES_BY_LEAF = new Map<string, KentCurrentTaxonomyCategory[]>();
const CURRENT_KENT_CATEGORIES_BY_TITLE = new Map<string, KentCurrentTaxonomyCategory[]>();
''',
    "taxonomy aliases",
)

replace_once(
    '''  const normalizedPath = normalizePathSegments(path || []);
  const exact = CURRENT_KENT_CATEGORY_BY_PATH.get(normalizedPath.join("/"));
  if (exact) return exact;
''',
    '''  const normalizedPath = normalizePathSegments(path || []);
  const normalizedKey = normalizedPath.join("/");
  const aliasKey = CURRENT_KENT_PATH_ALIASES.get(normalizedKey);
  const alias = aliasKey ? CURRENT_KENT_CATEGORY_BY_PATH.get(aliasKey) : null;
  if (alias) return alias;

  const exact = CURRENT_KENT_CATEGORY_BY_PATH.get(normalizedKey);
  if (exact) return exact;
''',
    "alias resolution",
)

old_category_block = '''  const allCategories: CategoryLite[] = Array.isArray(data?.allCategories) ? data.allCategories : [];
  const category: CategoryDoc | null = data?.category || null;
  if (!category?._id) {
    const canonicalPath = findCanonicalCategoryPath(pathArr, allCategories);
    if (canonicalPath && canonicalPath.join("/") !== pathStr) {
      redirect(buildCategoryHref(canonicalPath));
    }
    notFound();
  }

  const allProducts: ProductLite[] = Array.isArray(data?.allProducts) ? data.allProducts : [];
'''
new_category_block = '''  const allCategories: CategoryLite[] = Array.isArray(data?.allCategories) ? data.allCategories : [];
  const taxonomyCategoryForPath = resolveCurrentKentCategory(pathArr);
  let category: CategoryDoc | null = data?.category || null;

  if (!category?._id && taxonomyCategoryForPath?.count) {
    category = {
      _id: `kent-current-taxonomy-${taxonomyCategoryForPath.id}`,
      title: taxonomyCategoryForPath.title,
      path: pathArr,
      sourceUrl: taxonomyCategoryForPath.sourceUrl,
      summary: "",
      legacyHtml: "",
      pageType: "listing",
      contentBlocks: [],
    };
  }

  if (!category?._id) {
    const canonicalPath = findCanonicalCategoryPath(pathArr, allCategories);
    if (canonicalPath && canonicalPath.join("/") !== pathStr) {
      redirect(buildCategoryHref(canonicalPath));
    }
    notFound();
  }

  const allProducts: ProductLite[] = Array.isArray(data?.allProducts) ? data.allProducts : [];
'''
replace_once(old_category_block, new_category_block, "virtual taxonomy category")

path.write_text(text)
print(f"Patched aliases in {path}")
