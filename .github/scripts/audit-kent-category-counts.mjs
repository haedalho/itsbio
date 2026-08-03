const projectId = '9b5twpc8';
const dataset = 'production';
const apiVersion = '2025-02-19';

function normalizePath(value) {
  return Array.isArray(value)
    ? value.map((part) => String(part || '').trim().replace(/^\/+|\/+$/g, '')).filter(Boolean)
    : [];
}

function productSlugFromHref(href) {
  const raw = String(href || '').replace(/&amp;/g, '&').trim();
  const match = raw.match(/https?:\/\/(?:www\.)?kentscientific\.com\/products\/([^\/?#"']+)/i)
    || raw.match(/\/products\/([^\/?#"']+)/i);
  return match?.[1] ? decodeURIComponent(match[1]).toLowerCase() : '';
}

function productSlugsFromHtml(html) {
  const out = [];
  const seen = new Set();
  const source = String(html || '');
  const re = /href=["']([^"']+)["']/gi;
  for (const match of source.matchAll(re)) {
    const slug = productSlugFromHref(match[1]);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

function pathMatchesProduct(categoryPath, product) {
  const requested = normalizePath(categoryPath);
  const requestedKey = requested.join('/');
  const leaf = requested[requested.length - 1] || '';
  const primary = normalizePath(product.categoryPath);
  const listing = Array.isArray(product.listingPaths)
    ? product.listingPaths.map((entry) => normalizePath(String(entry || '').split('/'))).filter((parts) => parts.length)
    : [];
  if (primary.join('/') === requestedKey) return true;
  if (listing.some((parts) => parts.join('/') === requestedKey)) return true;
  if (primary[primary.length - 1] === leaf) return true;
  if (listing.some((parts) => parts[parts.length - 1] === leaf)) return true;
  return false;
}

async function sanityFetch(query) {
  const url = new URL(`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`);
  url.searchParams.set('query', query);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sanity ${response.status}`);
  return (await response.json()).result;
}

const data = await sanityFetch(`{
  "categories": *[_type=="category" && (!defined(isActive) || isActive==true) && (brand->themeKey=="kent" || brand->slug.current=="kent" || themeKey=="kent" || brandSlug=="kent") && defined(path)] | order(array::join(path, "/") asc) {
    title, path, sourceUrl, legacyHtml, contentBlocks[]{..., items[]{...}}
  },
  "products": *[_type=="kentPreviewProduct" && (!defined(isActive) || isActive==true)] {
    title, "slug": slug.current, sourceUrl, categoryPath, listingPaths
  }
}`);

const products = Array.isArray(data?.products) ? data.products : [];
const productBySlug = new Map(products.map((product) => [String(product.slug || '').toLowerCase(), product]));
const rows = [];

for (const category of Array.isArray(data?.categories) ? data.categories : []) {
  const path = normalizePath(category.path);
  if (!path.length) continue;
  const pathKey = path.join('/');
  let officialSlugs = productSlugsFromHtml(category.legacyHtml);
  let officialSource = officialSlugs.length ? 'legacyHtml' : '';

  if (!officialSlugs.length && category.sourceUrl) {
    try {
      const response = await fetch(category.sourceUrl, { redirect: 'follow' });
      if (response.ok) {
        officialSlugs = productSlugsFromHtml(await response.text());
        officialSource = 'live';
      }
    } catch {}
  }

  const matched = products.filter((product) => pathMatchesProduct(path, product));
  const matchedSlugs = [...new Set(matched.map((product) => String(product.slug || '').toLowerCase()).filter(Boolean))];
  const currentUnion = [...new Set([...matchedSlugs, ...officialSlugs])];
  const officialSet = new Set(officialSlugs);
  const currentSet = new Set(currentUnion);
  const extras = currentUnion.filter((slug) => !officialSet.has(slug));
  const missing = officialSlugs.filter((slug) => !productBySlug.has(slug));
  const cardCounts = [];
  for (const block of Array.isArray(category.contentBlocks) ? category.contentBlocks : []) {
    for (const item of Array.isArray(block?.items) ? block.items : []) {
      if (typeof item?.count === 'number') cardCounts.push({ title: item.title, count: item.count, href: item.href });
    }
  }

  rows.push({
    path: pathKey,
    title: category.title,
    officialSource,
    officialCount: officialSlugs.length,
    matchedCount: matchedSlugs.length,
    currentUnionCount: currentUnion.length,
    delta: currentUnion.length - officialSlugs.length,
    extras,
    missingFromSanity: missing,
    cardCounts,
  });
}

const comparable = rows.filter((row) => row.officialCount > 0);
const mismatches = comparable.filter((row) => row.currentUnionCount !== row.officialCount);
console.log(JSON.stringify({
  categoryCount: rows.length,
  comparableCount: comparable.length,
  mismatchCount: mismatches.length,
  exactCount: comparable.length - mismatches.length,
  mismatches,
  noOfficialProducts: rows.filter((row) => row.officialCount === 0).map((row) => ({ path: row.path, title: row.title, cardCounts: row.cardCounts })),
}, null, 2));
