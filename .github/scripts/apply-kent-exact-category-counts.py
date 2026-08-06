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
    'import { sanityClient } from "@/lib/sanity/sanity.client";\n',
    'import { sanityClient } from "@/lib/sanity/sanity.client";\nimport kentCurrentTaxonomy from "@/data/kent-current-taxonomy.json";\n',
    "taxonomy import",
)

replace_once(
    'type CardsKind = "product" | "category" | "resource" | "publication";\n',
    '''type CardsKind = "product" | "category" | "resource" | "publication";

type KentCurrentTaxonomyCategory = {
  id: number;
  parentId: number;
  title: string;
  slug: string;
  count: number;
  sourceUrl: string;
  categoryPath: string[];
  categoryPathTitles: string[];
  directProductSlugs: string[];
  productSlugs: string[];
};

type KentCurrentTaxonomy = {
  generatedAt: string;
  publishedProductCount: number;
  categoryCount: number;
  countMismatchCount: number;
  categories: KentCurrentTaxonomyCategory[];
};

const CURRENT_KENT_TAXONOMY = kentCurrentTaxonomy as KentCurrentTaxonomy;
''',
    "taxonomy types",
)

replace_once(
    '      && array::join(path, "/")==$pathStr\n    ][0]{\n',
    '      && array::join(path, "/")==$pathStr\n    ] | order(_updatedAt desc)[0]{\n',
    "latest category query",
)

normalize_anchor = '''function normalizePathSegments(path: string[]) {
  return Array.isArray(path)
    ? path.map((seg) => String(seg || "").trim().replace(/^\\/+|\\/+$/g, "")).filter(Boolean)
    : [];
}
'''
normalize_replacement = normalize_anchor + '''
function currentTaxonomyPathKey(path?: string[]) {
  return normalizePathSegments(path || []).join("/");
}

const CURRENT_KENT_CATEGORIES = Array.isArray(CURRENT_KENT_TAXONOMY.categories)
  ? CURRENT_KENT_TAXONOMY.categories
  : [];
const CURRENT_KENT_CATEGORY_BY_PATH = new Map(
  CURRENT_KENT_CATEGORIES.map((category) => [currentTaxonomyPathKey(category.categoryPath), category]),
);
const CURRENT_KENT_CATEGORY_BY_SOURCE = new Map(
  CURRENT_KENT_CATEGORIES
    .map((category) => [normalizeUrl(category.sourceUrl).toLowerCase(), category] as const)
    .filter(([source]) => Boolean(source)),
);
const CURRENT_KENT_CATEGORIES_BY_LEAF = new Map<string, KentCurrentTaxonomyCategory[]>();
const CURRENT_KENT_CATEGORIES_BY_TITLE = new Map<string, KentCurrentTaxonomyCategory[]>();

for (const category of CURRENT_KENT_CATEGORIES) {
  const path = normalizePathSegments(category.categoryPath || []);
  const leaf = path[path.length - 1] || "";
  if (leaf) {
    const rows = CURRENT_KENT_CATEGORIES_BY_LEAF.get(leaf) || [];
    rows.push(category);
    CURRENT_KENT_CATEGORIES_BY_LEAF.set(leaf, rows);
  }

  const title = normalizeInlineText(category.title || "");
  if (title) {
    const rows = CURRENT_KENT_CATEGORIES_BY_TITLE.get(title) || [];
    rows.push(category);
    CURRENT_KENT_CATEGORIES_BY_TITLE.set(title, rows);
  }
}

function resolveCurrentKentCategory(
  path?: string[],
  sourceUrl?: string,
  title?: string,
): KentCurrentTaxonomyCategory | null {
  const normalizedPath = normalizePathSegments(path || []);
  const exact = CURRENT_KENT_CATEGORY_BY_PATH.get(normalizedPath.join("/"));
  if (exact) return exact;

  const source = normalizeUrl(String(sourceUrl || "")).toLowerCase();
  const sourceMatch = source ? CURRENT_KENT_CATEGORY_BY_SOURCE.get(source) : null;
  if (sourceMatch) return sourceMatch;

  const leaf = normalizedPath[normalizedPath.length - 1] || "";
  const leafMatches = leaf ? CURRENT_KENT_CATEGORIES_BY_LEAF.get(leaf) || [] : [];
  if (leafMatches.length === 1) return leafMatches[0];

  const normalizedTitle = normalizeInlineText(String(title || ""));
  const titleMatches = normalizedTitle ? CURRENT_KENT_CATEGORIES_BY_TITLE.get(normalizedTitle) || [] : [];
  if (titleMatches.length === 1) return titleMatches[0];

  return null;
}

function productsForCurrentKentCategory(
  category: KentCurrentTaxonomyCategory,
  allProducts: ProductLite[],
) {
  const bySlug = new Map(
    (Array.isArray(allProducts) ? allProducts : [])
      .map((product) => [String(product.slug || "").trim().toLowerCase(), product] as const)
      .filter(([slug]) => Boolean(slug)),
  );

  return category.productSlugs
    .map((slug) => bySlug.get(String(slug || "").trim().toLowerCase()))
    .filter((product): product is ProductLite => Boolean(product));
}
'''
replace_once(normalize_anchor, normalize_replacement, "taxonomy helpers")

old_children = '''function getDirectChildren(allCategories: CategoryLite[], currentPath: string[]) {
  return (Array.isArray(allCategories) ? allCategories : [])
    .filter((cat) => {
      const path = normalizePathSegments(cat.path || []);
      return path.length === currentPath.length + 1 && isPrefix(currentPath, path);
    })
    .sort((a, b) => {
      const ao = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
      const bo = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
}
'''
new_children = '''function getDirectChildren(allCategories: CategoryLite[], currentPath: string[]) {
  const seen = new Set<string>();
  return (Array.isArray(allCategories) ? allCategories : [])
    .filter((cat) => {
      const path = normalizePathSegments(cat.path || []);
      if (path.length !== currentPath.length + 1 || !isPrefix(currentPath, path)) return false;
      const currentCategory = resolveCurrentKentCategory(path, undefined, cat.title);
      if (!currentCategory || currentCategory.count <= 0) return false;
      const key = path.join("/");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const ao = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
      const bo = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
}
'''
replace_once(old_children, new_children, "direct category children")

old_representative = '''function findRepresentativeProductForCategory(categoryPath: string[], allProducts: ProductLite[]) {
  const target = normalizePathSegments(categoryPath || []);
  if (!target.length) return undefined;
  const products = (Array.isArray(allProducts) ? allProducts : []).filter((product) => String(product.thumb || "").trim());

  const exact = products.find((product) =>
    productCategoryPaths(product).some((candidate) => candidate.join("/") === target.join("/")),
  );
  if (exact) return exact;

  return products.find((product) =>
    productCategoryPaths(product).some((candidate) => isPrefix(target, candidate)),
  );
}
'''
new_representative = '''function findRepresentativeProductForCategory(categoryPath: string[], allProducts: ProductLite[]) {
  const target = normalizePathSegments(categoryPath || []);
  if (!target.length) return undefined;
  const products = (Array.isArray(allProducts) ? allProducts : []).filter((product) => String(product.thumb || "").trim());
  const currentCategory = resolveCurrentKentCategory(target);

  if (currentCategory) {
    const representative = productsForCurrentKentCategory(currentCategory, products)[0];
    if (representative) return representative;
  }

  const exact = products.find((product) =>
    productCategoryPaths(product).some((candidate) => candidate.join("/") === target.join("/")),
  );
  if (exact) return exact;

  return products.find((product) =>
    productCategoryPaths(product).some((candidate) => isPrefix(target, candidate)),
  );
}
'''
replace_once(old_representative, new_representative, "category representative")

old_resolve_listing = '''function resolveListingProducts(pathArr: string[], category: CategoryDoc | null, allProducts: ProductLite[]) {
  const matched = matchProductsForListing(pathArr, category, allProducts);
  const legacyCards = parseLegacyProductCards(category?.legacyHtml);

  if (legacyCards.length) {
    return hydrateProductsFromLegacyCards(matched, legacyCards, allProducts);
  }

  return matched;
}
'''
new_resolve_listing = '''function resolveListingProducts(pathArr: string[], category: CategoryDoc | null, allProducts: ProductLite[]) {
  const currentCategory = resolveCurrentKentCategory(pathArr, category?.sourceUrl, category?.title);
  if (currentCategory) {
    return dedupeProducts(productsForCurrentKentCategory(currentCategory, allProducts));
  }

  // Strict fallback for a not-yet-mapped category. Never merge by leaf slug and
  // never add products from stale legacy HTML because both inflate category counts.
  const exactKeys = new Set<string>();
  for (const candidate of [
    pathArr,
    category?.path || [],
    kentCategoryPathFromUrl(String(category?.sourceUrl || "")),
  ]) {
    const key = currentTaxonomyPathKey(candidate);
    if (key) exactKeys.add(key);
  }

  return dedupeProducts(
    allProducts.filter((product) =>
      productCategoryPaths(product).some((candidate) => exactKeys.has(candidate.join("/"))),
    ),
  );
}
'''
replace_once(old_resolve_listing, new_resolve_listing, "exact listing products")

old_hydrate_segment = '''        const canonicalCategoryHref = canonicalCategoryPath.length
          ? buildCategoryHref(canonicalCategoryPath)
          : resolvedHref;
        const categoryLabel = `${href} ${String(item?.title || "")}`.toLowerCase();
'''
new_hydrate_segment = '''        const canonicalCategoryHref = canonicalCategoryPath.length
          ? buildCategoryHref(canonicalCategoryPath)
          : resolvedHref;
        const currentCategory = kind === "category"
          ? resolveCurrentKentCategory(canonicalCategoryPath, href, String(item?.title || ""))
          : null;
        const categoryLabel = `${href} ${String(item?.title || "")}`.toLowerCase();
'''
replace_once(old_hydrate_segment, new_hydrate_segment, "card taxonomy category")

old_hydrate_return = '''        return {
          ...item,
          href: kind === "category" ? canonicalCategoryHref : resolvedHref,
          imageUrl: product?.thumb || existingManagedImage || "",
        };
'''
new_hydrate_return = '''        return {
          ...item,
          href: kind === "category" ? canonicalCategoryHref : resolvedHref,
          imageUrl: product?.thumb || existingManagedImage || "",
          count: kind === "category" && currentCategory ? currentCategory.count : item.count,
        };
'''
replace_once(old_hydrate_return, new_hydrate_return, "official card count")

old_child_details = '''          const summary = String(item.summary || "").trim();
          const representative = findRepresentativeProductForCategory(path, products);
'''
new_child_details = '''          const summary = String(item.summary || "").trim();
          const currentCategory = resolveCurrentKentCategory(path, undefined, item.title);
          const representative = findRepresentativeProductForCategory(path, products);
'''
replace_once(old_child_details, new_child_details, "child category taxonomy")

old_child_title = '''                <div className="mt-2 text-[22px] font-semibold leading-snug tracking-tight text-slate-900 group-hover:text-blue-700">
                  {titleText}
                </div>
                {summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{summary}</p> : <div className="mt-3 h-[48px]" />}
'''
new_child_title = '''                <div className="mt-2 text-[22px] font-semibold leading-snug tracking-tight text-slate-900 group-hover:text-blue-700">
                  {titleText}
                </div>
                {currentCategory ? <div className="mt-2 text-sm text-slate-500">{currentCategory.count} products</div> : null}
                {summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{summary}</p> : <div className="mt-3 h-[48px]" />}
'''
replace_once(old_child_title, new_child_title, "child category count display")

old_main_setup = '''  const allProducts: ProductLite[] = Array.isArray(data?.allProducts) ? data.allProducts : [];
  const productsInCategory = resolveListingProducts(pathArr, category, allProducts);
  const directChildren = getDirectChildren(allCategories, pathArr);
  const pageType = resolvePageType(category, pathStr, directChildren.length, dedupeProducts(productsInCategory).length);
'''
new_main_setup = '''  const allProducts: ProductLite[] = Array.isArray(data?.allProducts) ? data.allProducts : [];
  const currentCategory = resolveCurrentKentCategory(pathArr, category.sourceUrl, category.title);
  if (currentCategory?.count === 0) notFound();
  const productsInCategory = resolveListingProducts(pathArr, category, allProducts);
  const officialProductCount = currentCategory?.count ?? dedupeProducts(productsInCategory).length;
  const directChildren = getDirectChildren(allCategories, pathArr);
  const pageType = resolvePageType(category, pathStr, directChildren.length, officialProductCount);
'''
replace_once(old_main_setup, new_main_setup, "main official category count")

replace_once(
    '<ListingHeader count={dedupeProducts(productsInCategory).length} theme={THEME_KENT} />',
    '<ListingHeader count={officialProductCount} theme={THEME_KENT} />',
    "listing header count",
)

path.write_text(text)
print(f"Patched {path}")
