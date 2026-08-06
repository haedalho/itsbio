import fs from 'node:fs';

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '9b5twpc8';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2025-02-19';
const brandKey = 'kent';
const productType = 'kentPreviewProduct';

async function querySanity(query, params = {}) {
  const url = new URL(`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`);
  url.searchParams.set('query', query);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(`$${key}`, JSON.stringify(value));
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sanity HTTP ${response.status}: ${await response.text()}`);
  const body = await response.json();
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result;
}

function cleanPath(parts) {
  return Array.isArray(parts)
    ? parts.map((value) => String(value || '').trim().replace(/^\/+|\/+$/g, '')).filter(Boolean)
    : [];
}

function categoryPathFromHref(input) {
  const raw = String(input || '').trim();
  if (!raw || /\/item\//i.test(raw) || /\/products\//i.test(raw) && !/\/products\/kent\//i.test(raw)) return [];
  try {
    const url = new URL(raw, 'https://www.kentscientific.com');
    const path = url.pathname.replace(/^\/+|\/+$/g, '');
    if (path.startsWith('product/')) return cleanPath(path.slice('product/'.length).split('/'));
    if (path.startsWith('products/kent/')) return cleanPath(path.slice('products/kent/'.length).split('/'));
    return [];
  } catch {
    return [];
  }
}

function getImageUrl(item) {
  if (!item || typeof item !== 'object') return '';
  for (const key of ['imageUrl', 'image', 'src', 'thumbnail', 'thumb']) {
    if (typeof item[key] === 'string' && item[key].trim()) return item[key].trim();
  }
  return '';
}

function extractStaticMenuPaths(source) {
  const start = source.indexOf('const KENT_STATIC_MENU');
  const end = source.indexOf('function flattenMenu', start);
  const block = start >= 0 && end > start ? source.slice(start, end) : '';
  const paths = [];
  const regex = /path:\s*\[([\s\S]*?)\]/g;
  for (const match of block.matchAll(regex)) {
    const values = [...match[1].matchAll(/["']([^"']+)["']/g)].map((entry) => entry[1]);
    if (values.length) paths.push(values.join('/'));
  }
  return [...new Set(paths)];
}

const pageSource = fs.readFileSync('app/products/kent/[[...path]]/page.tsx', 'utf8');
const staticPaths = extractStaticMenuPaths(pageSource);

const data = await querySanity(`{
  "categories": *[_type=="category" && (!defined(isActive) || isActive==true) && (
    brand->themeKey==$brandKey || brand->slug.current==$brandKey || themeKey==$brandKey || brandSlug==$brandKey
  ) && defined(path)]{
    _id, title, path, sourceUrl,
    contentBlocks[]{
      _type, kind, title,
      items[]{..., "assetUrl": image.asset->url}
    }
  },
  "products": *[_type==$productType && (!defined(isActive) || isActive==true) && (
    brand->themeKey==$brandKey || brand->slug.current==$brandKey || brandSlug==$brandKey
  )]{
    _id, title, "slug": slug.current, categoryPath, listingPaths,
    "thumb": images[0].asset->url
  }
}`, { brandKey, productType });

const categories = Array.isArray(data?.categories) ? data.categories : [];
const products = Array.isArray(data?.products) ? data.products : [];
const categoryPaths = new Set(categories.map((category) => cleanPath(category.path).join('/')).filter(Boolean));
const missingStaticPaths = staticPaths.filter((path) => !categoryPaths.has(path));

const productByPath = new Map();
for (const product of products) {
  const paths = [cleanPath(product.categoryPath).join('/')];
  for (const listingPath of Array.isArray(product.listingPaths) ? product.listingPaths : []) {
    paths.push(cleanPath(String(listingPath || '').split('/')).join('/'));
  }
  for (const path of paths.filter(Boolean)) {
    if (!productByPath.has(path) && product.thumb) productByPath.set(path, product);
  }
}

const brokenCardLinks = [];
const cardsWithoutImages = [];
const cardsWithRepresentative = [];
let totalCards = 0;

for (const category of categories) {
  const ownerPath = cleanPath(category.path).join('/');
  for (const block of Array.isArray(category.contentBlocks) ? category.contentBlocks : []) {
    for (const item of Array.isArray(block?.items) ? block.items : []) {
      const href = String(item?.href || item?.url || item?.link || '').trim();
      const targetPath = categoryPathFromHref(href).join('/');
      if (!targetPath) continue;
      totalCards += 1;
      const imageUrl = getImageUrl(item) || String(item?.assetUrl || '').trim();
      if (!categoryPaths.has(targetPath)) {
        const leaf = targetPath.split('/').at(-1);
        const leafMatches = [...categoryPaths].filter((candidate) => candidate.split('/').at(-1) === leaf);
        brokenCardLinks.push({ ownerPath, title: item?.title || item?.label || '', href, targetPath, leafMatches });
      }
      if (!imageUrl) {
        cardsWithoutImages.push({ ownerPath, title: item?.title || item?.label || '', targetPath });
      }
      const representative = productByPath.get(targetPath);
      if (representative?.thumb) {
        cardsWithRepresentative.push({ ownerPath, title: item?.title || item?.label || '', targetPath, product: representative.slug });
      }
    }
  }
}

const report = {
  categoryCount: categories.length,
  productCount: products.length,
  staticMenuPathCount: staticPaths.length,
  missingStaticPaths,
  totalCategoryCards: totalCards,
  brokenCardLinkCount: brokenCardLinks.length,
  brokenCardLinks,
  cardsWithoutImagesCount: cardsWithoutImages.length,
  cardsWithoutImages,
  cardsWithRepresentativeCount: cardsWithRepresentative.length,
  cardsWithRepresentative,
};

console.log(JSON.stringify(report, null, 2));
fs.writeFileSync('/tmp/kent-category-audit.json', JSON.stringify(report, null, 2));
