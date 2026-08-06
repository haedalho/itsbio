import * as cheerio from 'cheerio';

const projectId = '9b5twpc8';
const dataset = 'production';
const apiVersion = '2025-02-19';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36';

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

function productSlugsFromGrid(html) {
  const $ = cheerio.load(String(html || ''));
  const selectors = [
    '.products .product',
    '.woocommerce ul.products li.product',
    'ul.products li.product',
    '.archive-products .product',
    '.content-products .product',
    '.wc-block-grid__product',
  ].join(',');
  const out = [];
  const seen = new Set();
  $(selectors).each((_, element) => {
    const href = $(element).find('a[href*="/products/"]').first().attr('href')
      || $(element).find('a').first().attr('href')
      || '';
    const slug = productSlugFromHref(href);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    out.push(slug);
  });
  return out;
}

function parseResultCount(html) {
  const $ = cheerio.load(String(html || ''));
  const candidates = [
    $('.woocommerce-result-count').first().text(),
    $('[class*="result-count"]').first().text(),
    $('[class*="results-count"]').first().text(),
  ].map((value) => String(value || '').replace(/\s+/g, ' ').trim()).filter(Boolean);

  for (const text of candidates) {
    const patterns = [
      /of\s+([\d,]+)\s+results?/i,
      /showing\s+all\s+([\d,]+)\s+results?/i,
      /([\d,]+)\s+results?/i,
      /([\d,]+)\s+products?/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return Number(match[1].replace(/,/g, ''));
    }
  }
  return null;
}

function paginationUrls(html, baseUrl) {
  const $ = cheerio.load(String(html || ''));
  const urls = new Set();
  $('a.page-numbers[href], .woocommerce-pagination a[href], a[href*="/page/"]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    try {
      const url = new URL(href, baseUrl);
      if (url.hostname.toLowerCase().endsWith('kentscientific.com')) urls.add(url.toString());
    } catch {}
  });
  return [...urls];
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return { html: await response.text(), finalUrl: response.url };
}

async function readOfficialCategory(sourceUrl) {
  if (!sourceUrl) return { count: null, slugs: [], source: 'none', error: 'missing sourceUrl' };
  try {
    const first = await fetchHtml(sourceUrl);
    const firstCount = parseResultCount(first.html);
    const slugs = new Set(productSlugsFromGrid(first.html));
    const pages = paginationUrls(first.html, first.finalUrl).slice(0, 20);
    for (const pageUrl of pages) {
      try {
        const page = await fetchHtml(pageUrl);
        for (const slug of productSlugsFromGrid(page.html)) slugs.add(slug);
      } catch {}
    }
    return {
      count: Number.isFinite(firstCount) ? firstCount : slugs.size,
      slugs: [...slugs],
      source: 'live',
      resultTextCount: firstCount,
      pageCount: pages.length + 1,
      error: '',
    };
  } catch (error) {
    return { count: null, slugs: [], source: 'live', error: String(error?.message || error) };
  }
}

function exactProductMatches(categoryPath, product) {
  const requested = normalizePath(categoryPath);
  const key = requested.join('/');
  const primary = normalizePath(product.categoryPath);
  const listing = Array.isArray(product.listingPaths)
    ? product.listingPaths.map((entry) => normalizePath(String(entry || '').split('/'))).filter((parts) => parts.length)
    : [];
  return primary.join('/') === key || listing.some((parts) => parts.join('/') === key);
}

function currentLooseMatches(categoryPath, product) {
  const requested = normalizePath(categoryPath);
  const key = requested.join('/');
  const leaf = requested[requested.length - 1] || '';
  const primary = normalizePath(product.categoryPath);
  const listing = Array.isArray(product.listingPaths)
    ? product.listingPaths.map((entry) => normalizePath(String(entry || '').split('/'))).filter((parts) => parts.length)
    : [];
  if (primary.join('/') === key) return true;
  if (listing.some((parts) => parts.join('/') === key)) return true;
  if (primary[primary.length - 1] === leaf) return true;
  if (listing.some((parts) => parts[parts.length - 1] === leaf)) return true;
  return false;
}

function internalCategoryPath(href) {
  const value = String(href || '').trim().split('#')[0].split('?')[0];
  const prefix = '/products/kent/';
  if (!value.startsWith(prefix) || value.includes('/item/') || value.includes('/legacy')) return [];
  return normalizePath(value.slice(prefix.length).split('/'));
}

async function sanityFetch(query) {
  const url = new URL(`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`);
  url.searchParams.set('query', query);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sanity ${response.status}`);
  return (await response.json()).result;
}

const data = await sanityFetch(`{
  "categories": *[_type=="category" && (!defined(isActive) || isActive==true) && (brand->themeKey=="kent" || brand->slug.current=="kent" || themeKey=="kent" || brandSlug=="kent") && defined(path)] | order(array::join(path, "/") asc, _updatedAt desc) {
    _id, _updatedAt, title, path, sourceUrl, pageType, legacyHtml,
    contentBlocks[]{..., items[]{...}}
  },
  "products": *[_type=="kentPreviewProduct" && (!defined(isActive) || isActive==true)] {
    _id, title, "slug": slug.current, sourceUrl, categoryPath, listingPaths
  }
}`);

const categories = Array.isArray(data?.categories) ? data.categories : [];
const products = Array.isArray(data?.products) ? data.products : [];
const docsByPath = new Map();
for (const category of categories) {
  const pathKey = normalizePath(category.path).join('/');
  if (!pathKey) continue;
  if (!docsByPath.has(pathKey)) docsByPath.set(pathKey, []);
  docsByPath.get(pathKey).push(category);
}

const canonicalCategories = [...docsByPath.entries()].map(([path, docs]) => ({
  path,
  doc: [...docs].sort((a, b) => String(b._updatedAt || '').localeCompare(String(a._updatedAt || '')))[0],
  duplicateCount: docs.length,
  duplicateIds: docs.map((doc) => doc._id),
}));
const canonicalByPath = new Map(canonicalCategories.map((entry) => [entry.path, entry.doc]));
const officialCache = new Map();

async function officialFor(category) {
  const key = String(category?.sourceUrl || '').trim();
  if (!key) return { count: null, slugs: [], error: 'missing sourceUrl' };
  if (!officialCache.has(key)) officialCache.set(key, readOfficialCategory(key));
  return officialCache.get(key);
}

const listingRows = [];
for (const entry of canonicalCategories) {
  const category = entry.doc;
  const path = normalizePath(category.path);
  const official = await officialFor(category);
  const looseSlugs = [...new Set(products.filter((product) => currentLooseMatches(path, product)).map((product) => String(product.slug || '').toLowerCase()).filter(Boolean))];
  const exactSlugs = [...new Set(products.filter((product) => exactProductMatches(path, product)).map((product) => String(product.slug || '').toLowerCase()).filter(Boolean))];
  const legacySlugs = productSlugsFromGrid(category.legacyHtml);
  const currentRenderedSlugs = legacySlugs.length ? [...new Set([...looseSlugs, ...legacySlugs])] : looseSlugs;
  const isComparable = official.count !== null && official.count > 0;
  listingRows.push({
    path: entry.path,
    title: category.title,
    sourceUrl: category.sourceUrl,
    duplicateCount: entry.duplicateCount,
    officialCount: official.count,
    officialGridSlugs: official.slugs.length,
    currentRenderedCount: currentRenderedSlugs.length,
    looseMatchedCount: looseSlugs.length,
    exactMatchedCount: exactSlugs.length,
    legacyFirstPageCount: legacySlugs.length,
    delta: isComparable ? currentRenderedSlugs.length - official.count : null,
    error: official.error || '',
  });
}

const cardRows = [];
for (const entry of canonicalCategories) {
  const owner = entry.doc;
  for (const block of Array.isArray(owner.contentBlocks) ? owner.contentBlocks : []) {
    for (const item of Array.isArray(block?.items) ? block.items : []) {
      if (typeof item?.count !== 'number') continue;
      const requestedPath = internalCategoryPath(item.href);
      if (!requestedPath.length) continue;
      let target = canonicalByPath.get(requestedPath.join('/'));
      if (!target) {
        const leaf = requestedPath[requestedPath.length - 1];
        const candidates = canonicalCategories.filter((candidate) => candidate.path.split('/').at(-1) === leaf);
        if (candidates.length === 1) target = candidates[0].doc;
      }
      const official = target ? await officialFor(target) : { count: null, error: 'target category not found' };
      cardRows.push({
        ownerPath: entry.path,
        title: item.title,
        href: item.href,
        storedCount: item.count,
        targetPath: target ? normalizePath(target.path).join('/') : '',
        officialCount: official.count,
        delta: official.count === null ? null : item.count - official.count,
        error: official.error || '',
      });
    }
  }
}

const listingMismatches = listingRows.filter((row) => row.officialCount !== null && row.officialCount > 0 && row.currentRenderedCount !== row.officialCount);
const cardMismatches = cardRows.filter((row) => row.officialCount !== null && row.storedCount !== row.officialCount);
const duplicatePaths = canonicalCategories.filter((entry) => entry.duplicateCount > 1).map((entry) => ({ path: entry.path, count: entry.duplicateCount, ids: entry.duplicateIds }));

console.log(JSON.stringify({
  rawCategoryDocuments: categories.length,
  uniqueCategoryPaths: canonicalCategories.length,
  duplicatePathCount: duplicatePaths.length,
  duplicatePaths,
  productCount: products.length,
  listingComparableCount: listingRows.filter((row) => row.officialCount !== null && row.officialCount > 0).length,
  listingMismatchCount: listingMismatches.length,
  listingMismatches,
  cardComparableCount: cardRows.filter((row) => row.officialCount !== null).length,
  cardMismatchCount: cardMismatches.length,
  cardMismatches,
  fetchErrors: listingRows.filter((row) => row.error).map((row) => ({ path: row.path, sourceUrl: row.sourceUrl, error: row.error })),
}, null, 2));
