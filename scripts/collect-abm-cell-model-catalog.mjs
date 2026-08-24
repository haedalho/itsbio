import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT = path.resolve(process.cwd(), "data/abm-cell-model-catalog.json");
const SOURCE = "https://www.abmgood.com/product/searchApi";
const MIRROR = "https://r.jina.ai/http://www.abmgood.com/product/searchApi";
const CACHE_DIRECTORY = "/tmp/itsbio-abm-cell-catalog-pages";
const CONCURRENCY = 2;

const collections = [
  { filterId: 14, modelType: "Immortalized Cells" },
  { filterId: 15, modelType: "Tumor Cells" },
  { filterId: 16, modelType: "Primary Cells" },
];

function plainText(value) {
  return String(value || "")
    .replace(/<sup>(.*?)<\/sup>/gi, "^$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&micro;/gi, "µ")
    .replace(/&times;/gi, "×")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteSourceUrl(product) {
  const pathValue = String(product?.seo?.url_key || "").trim();
  if (pathValue) return new URL(pathValue, "https://www.abmgood.com").toString();
  return `https://www.abmgood.com/catalog/products/${product.id}`;
}

function compactProduct(product, modelType) {
  const sourceUrl = absoluteSourceUrl(product);
  return {
    title: plainText(product.name),
    sku: plainText(product.cat_no),
    url: sourceUrl,
    sourceUrl,
    unit: plainText(product.unit_quantity),
    modelType,
    species: [plainText(product.species)].filter(Boolean),
    bioSystems: [plainText(product.tissue_system)].filter(Boolean),
    cellTypes: [plainText(product.tissue)].filter(Boolean),
  };
}

function unwrapJina(body) {
  const marker = "Markdown Content:";
  const index = body.indexOf(marker);
  return index >= 0 ? body.slice(index + marker.length).trim() : body.trim();
}

async function fetchPage(filterId, page, attempt = 1) {
  const cachePath = path.join(CACHE_DIRECTORY, `${filterId}-${page}.json`);
  try {
    return JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    // A missing or invalid cache entry is collected again below.
  }

  const params = new URLSearchParams({ filter_id: String(filterId), page: String(page) });
  const url = `${MIRROR}?${params}`;
  const response = await fetch(url, { headers: { accept: "text/plain" } });
  if (!response.ok) {
    if (attempt < 9) {
      const retryAfter = Number(response.headers.get("retry-after")) || 0;
      const backoff = Math.max(retryAfter * 1_000, Math.min(20_000, attempt * attempt * 1_250));
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return fetchPage(filterId, page, attempt + 1);
    }
    throw new Error(`ABM catalog request failed (${response.status}) for filter ${filterId}, page ${page}`);
  }

  const payload = JSON.parse(unwrapJina(await response.text()));
  if (payload?.code !== 0 || !payload?.data) throw new Error(`Invalid ABM response for filter ${filterId}, page ${page}`);
  const compact = {
    products: (payload.data.products || []).map((product) => ({
      id: product.id,
      cat_no: product.cat_no,
      name: product.name,
      unit_quantity: product.unit_quantity,
      species: product.species,
      tissue_system: product.tissue_system,
      tissue: product.tissue,
      seo: product.seo ? { url_key: product.seo.url_key } : undefined,
    })),
    total: payload.data.total,
    lastPage: payload.data.lastPage,
    perPage: payload.data.perPage,
  };
  await mkdir(CACHE_DIRECTORY, { recursive: true });
  await writeFile(cachePath, JSON.stringify(compact), "utf8");
  console.log(`Collected filter ${filterId}, page ${page}/${compact.lastPage}`);
  return compact;
}

async function mapConcurrent(values, limit, mapper) {
  const results = new Array(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
      await new Promise((resolve) => setTimeout(resolve, 4_000));
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

const products = [];
const totals = {};

for (const collection of collections) {
  const first = await fetchPage(collection.filterId, 1);
  const pages = Array.from({ length: first.lastPage }, (_, index) => index + 1);
  const pageResults = await mapConcurrent(pages, CONCURRENCY, (page) => (
    page === 1 ? first : fetchPage(collection.filterId, page)
  ));

  const rows = pageResults.flatMap((result) => result.products || []);
  totals[collection.modelType] = {
    filterId: collection.filterId,
    expected: first.total,
    collected: rows.length,
  };
  products.push(...rows.map((product) => compactProduct(product, collection.modelType)));
}

const unique = Array.from(
  new Map(products.map((product) => [`${product.modelType}:${product.sku || product.url}`, product])).values(),
).sort((a, b) => a.modelType.localeCompare(b.modelType) || a.sku.localeCompare(b.sku));

for (const [modelType, total] of Object.entries(totals)) {
  if (total.expected !== total.collected) {
    throw new Error(`${modelType}: expected ${total.expected}, collected ${total.collected}`);
  }
}

const output = {
  source: SOURCE,
  collectedAt: new Date().toISOString(),
  totals,
  products: unique,
};

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: OUTPUT, products: unique.length, totals }, null, 2));
