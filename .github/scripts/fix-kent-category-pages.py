from pathlib import Path
import re

path = Path('app/products/kent/[[...path]]/page.tsx')
text = path.read_text()

text = text.replace(
    'import { notFound } from "next/navigation";',
    'import { notFound, redirect } from "next/navigation";',
    1,
)

helper = r'''
function categoryPathFromInternalHref(href: string) {
  const value = String(href || "").trim().split("#")[0].split("?")[0];
  const prefix = `/products/${BRAND_KEY}/`;
  if (!value.startsWith(prefix) || value.includes("/item/") || value.includes("/legacy")) return [];
  return normalizePathSegments(value.slice(prefix.length).split("/"));
}

function findCanonicalCategoryPath(requestedPath: string[], allCategories: CategoryLite[]) {
  const requested = normalizePathSegments(requestedPath || []);
  if (!requested.length) return null;

  const candidates = (Array.isArray(allCategories) ? allCategories : [])
    .map((category) => normalizePathSegments(category.path || []))
    .filter((candidate) => candidate.length > 0);
  const requestedKey = requested.join("/");
  const exact = candidates.find((candidate) => candidate.join("/") === requestedKey);
  if (exact) return exact;

  const leaf = requested[requested.length - 1] || "";
  const leafMatches = candidates.filter((candidate) => candidate[candidate.length - 1] === leaf);
  if (leafMatches.length === 1) return leafMatches[0];
  if (!leafMatches.length) return null;

  const ranked = leafMatches
    .map((candidate) => {
      let prefixScore = 0;
      const limit = Math.min(candidate.length, requested.length);
      for (let index = 0; index < limit; index += 1) {
        if (candidate[index] !== requested[index]) break;
        prefixScore += 1;
      }
      let suffixScore = 0;
      for (let offset = 1; offset <= limit; offset += 1) {
        if (candidate[candidate.length - offset] !== requested[requested.length - offset]) break;
        suffixScore += 1;
      }
      return { candidate, score: prefixScore * 10 + suffixScore };
    })
    .sort((a, b) => b.score - a.score || a.candidate.length - b.candidate.length);

  if (!ranked[0] || ranked[0].score <= 0) return null;
  if (ranked[1] && ranked[1].score === ranked[0].score) return null;
  return ranked[0].candidate;
}

function productCategoryPaths(product: ProductLite) {
  const paths: string[][] = [];
  const primary = normalizePathSegments(product.categoryPath || []);
  if (primary.length) paths.push(primary);
  for (const entry of Array.isArray(product.listingPaths) ? product.listingPaths : []) {
    const parsed = normalizePathSegments(String(entry || "").split("/"));
    if (parsed.length) paths.push(parsed);
  }
  return paths;
}

function findRepresentativeProductForCategory(categoryPath: string[], allProducts: ProductLite[]) {
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

function isManagedCategoryImageUrl(input?: unknown) {
  const value = String(input || "").trim();
  if (!value) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.toLowerCase() === "cdn.sanity.io";
  } catch {
    return false;
  }
}
'''

marker = '\nfunction resolvePageType(category: CategoryDoc | null, pathStr: string, directChildrenCount: number, productCount: number): PageType {'
if marker not in text:
    raise SystemExit('resolvePageType marker missing')
text = text.replace(marker, helper + marker, 1)

old_signature = 'function hydrateProductCardBlocks(blocks: ContentBlock[], allProducts: ProductLite[]) {'
new_signature = 'function hydrateProductCardBlocks(blocks: ContentBlock[], allProducts: ProductLite[], allCategories: CategoryLite[]) {'
if old_signature not in text:
    raise SystemExit('hydrateProductCardBlocks signature missing')
text = text.replace(old_signature, new_signature, 1)

old_item_block = r'''        const href = toAbs(String(item?.href || ""));
        const slug = kentProductSlugFromUrl(href).toLowerCase();
        const sourceUrl = normalizeUrl(href).toLowerCase();
        const categoryLabel = `${href} ${String(item?.title || "")}`.toLowerCase();
        const categoryRepresentative = categoryLabel.includes("somnosuite")
          ? bySlug.get("somnosuite")
          : categoryLabel.includes("somnoflo")
            ? bySlug.get("somnoflo")
            : categoryLabel.includes("vetflo")
              ? bySlug.get("vaporizer-with-vetflo-single-channel-anesthesia-stand")
              : undefined;
        const product =
          kind === "category"
            ? byImageSource.get(imageIdentity(item?.imageUrl)) || categoryRepresentative
            : bySourceUrl.get(sourceUrl) || bySlug.get(slug);

        return {
          ...item,
          imageUrl: product?.thumb || "",
        };'''

new_item_block = r'''        const rawHref = String(item?.href || "").trim();
        const href = toAbs(rawHref);
        const slug = kentProductSlugFromUrl(href).toLowerCase();
        const sourceUrl = normalizeUrl(href).toLowerCase();
        const resolvedHref = resolveKentHref(rawHref);
        const requestedCategoryPath = categoryPathFromInternalHref(resolvedHref);
        const canonicalCategoryPath =
          findCanonicalCategoryPath(requestedCategoryPath, allCategories) || requestedCategoryPath;
        const canonicalCategoryHref = canonicalCategoryPath.length
          ? buildCategoryHref(canonicalCategoryPath)
          : resolvedHref;
        const categoryLabel = `${href} ${String(item?.title || "")}`.toLowerCase();
        const namedRepresentative = categoryLabel.includes("somnosuite")
          ? bySlug.get("somnosuite")
          : categoryLabel.includes("somnoflo")
            ? bySlug.get("somnoflo")
            : categoryLabel.includes("vetflo")
              ? bySlug.get("vaporizer-with-vetflo-single-channel-anesthesia-stand")
              : undefined;
        const pathRepresentative = canonicalCategoryPath.length
          ? findRepresentativeProductForCategory(canonicalCategoryPath, allProducts)
          : undefined;
        const product =
          kind === "category"
            ? byImageSource.get(imageIdentity(item?.imageUrl)) || namedRepresentative || pathRepresentative
            : bySourceUrl.get(sourceUrl) || bySlug.get(slug);
        const existingManagedImage = isManagedCategoryImageUrl(item?.imageUrl)
          ? String(item?.imageUrl || "").trim()
          : "";

        return {
          ...item,
          href: kind === "category" ? canonicalCategoryHref : resolvedHref,
          imageUrl: product?.thumb || existingManagedImage || "",
        };'''

if old_item_block not in text:
    raise SystemExit('hydrate item block missing')
text = text.replace(old_item_block, new_item_block, 1)

new_child_grid = r'''function KentChildCategoryGrid({
  items,
  products,
  title = "Subcategories",
  theme,
}: {
  items: CategoryLite[];
  products: ProductLite[];
  title?: string;
  theme: Theme;
}) {
  if (!items.length) return null;

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <KentH2>{title}</KentH2>
        <div
          className={[
            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
            theme.accentBorder,
            theme.accentSoftBg,
            theme.accentText,
          ].join(" ")}
        >
          {items.length} categor{items.length > 1 ? "ies" : "y"}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const path = normalizePathSegments(item.path || []);
          const href = buildCategoryHref(path);
          const titleText = STATIC_LABEL_BY_PATH.get(path.join("/")) || normalizeTitle(item.title || "", path[path.length - 1] || "");
          const summary = String(item.summary || "").trim();
          const representative = findRepresentativeProductForCategory(path, products);

          return (
            <Link
              key={item._id}
              href={href}
              prefetch={false}
              className="group overflow-hidden rounded-[22px] border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-[4/3] border-b border-slate-100 bg-white">
                {representative?.thumb ? (
                  <img
                    src={toAbs(representative.thumb)}
                    alt=""
                    className="absolute inset-0 h-full w-full object-contain p-5"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-slate-50" />
                )}
              </div>
              <div className="p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Kent Category</div>
                <div className="mt-2 text-[22px] font-semibold leading-snug tracking-tight text-slate-900 group-hover:text-blue-700">
                  {titleText}
                </div>
                {summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{summary}</p> : <div className="mt-3 h-[48px]" />}
                <div className={`mt-5 inline-flex items-center gap-2 text-sm font-semibold ${theme.accentText}`}>
                  Browse category <span aria-hidden>›</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}'''

text, count = re.subn(
    r'function KentChildCategoryGrid\(\{[\s\S]*?\n\}\n\nfunction ListingIntro',
    lambda _: new_child_grid + '\n\nfunction ListingIntro',
    text,
    count=1,
)
if count != 1:
    raise SystemExit(f'KentChildCategoryGrid replacement count={count}')

old_category_init = r'''  const category: CategoryDoc | null = data?.category || null;
  if (!category?._id) notFound();

  const allProducts: ProductLite[] = Array.isArray(data?.allProducts) ? data.allProducts : [];
  const allCategories: CategoryLite[] = Array.isArray(data?.allCategories) ? data.allCategories : [];'''
new_category_init = r'''  const allCategories: CategoryLite[] = Array.isArray(data?.allCategories) ? data.allCategories : [];
  const category: CategoryDoc | null = data?.category || null;
  if (!category?._id) {
    const canonicalPath = findCanonicalCategoryPath(pathArr, allCategories);
    if (canonicalPath && canonicalPath.join("/") !== pathStr) {
      redirect(buildCategoryHref(canonicalPath));
    }
    notFound();
  }

  const allProducts: ProductLite[] = Array.isArray(data?.allProducts) ? data.allProducts : [];'''
if old_category_init not in text:
    raise SystemExit('category init block missing')
text = text.replace(old_category_init, new_category_init, 1)

old_hydrate_call = r'''  const blocks = hydrateProductCardBlocks(
    coerceContentBlocks(Array.isArray(category.contentBlocks) ? category.contentBlocks : []),
    allProducts,
  );'''
new_hydrate_call = r'''  const blocks = hydrateProductCardBlocks(
    coerceContentBlocks(Array.isArray(category.contentBlocks) ? category.contentBlocks : []),
    allProducts,
    allCategories,
  );'''
if old_hydrate_call not in text:
    raise SystemExit('hydrate call missing')
text = text.replace(old_hydrate_call, new_hydrate_call, 1)

text = text.replace(
    '<KentChildCategoryGrid items={directChildren} title="Explore categories" theme={THEME_KENT} />',
    '<KentChildCategoryGrid items={directChildren} products={allProducts} title="Explore categories" theme={THEME_KENT} />',
)
text = text.replace(
    '<KentChildCategoryGrid items={directChildren} title="Subcategories" theme={THEME_KENT} />',
    '<KentChildCategoryGrid items={directChildren} products={allProducts} title="Subcategories" theme={THEME_KENT} />',
)

# Category cards should contain product cutouts without cropping.
text = text.replace(
    'className="absolute inset-0 h-full w-full object-cover" loading="lazy"',
    'className="absolute inset-0 h-full w-full object-contain p-5" loading="lazy"',
)

path.write_text(text)
