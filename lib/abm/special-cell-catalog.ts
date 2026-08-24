import * as cheerio from "cheerio";

import {
  getOfficialAbmCellModelCatalog,
  type OfficialAbmCellModelProduct,
} from "@/lib/abm/cell-model-data";
import { isManagedAbmImageUrl } from "@/lib/abm/rebuild-staging";
import { abmResourceImagePath } from "@/lib/abm/resource-links";
import { PUBLIC_CATALOG_CACHE, sanityCdnClient } from "@/lib/sanity/sanity.client";

export type AbmSpecialCellCollection = "cas9" | "crispr" | "stable" | "stem";

export type AbmSpecialCellProduct = {
  title: string;
  sku: string;
  href: string;
  sourceUrl?: string;
  unit?: string;
  species: string;
  bioSystem: string;
  cellType: string;
  previewImage?: string;
};

type ExistingCellProduct = {
  title?: string;
  sku?: string;
  slug?: string;
  sourceUrl?: string;
  summary?: string;
  assetUrls?: string[];
  imageUrls?: string[];
};

const EXISTING_CELL_PRODUCTS_QUERY = `*[
  _type == "product"
  && (!defined(isActive) || isActive == true)
  && (brandSlug == "abm" || brand._ref == "brand-abm" || brand->slug.current == "abm")
  && defined(sku)
  && sku match "T*"
  && select(
    $collection == "cas9" => title match "*Cas9*" && (title match "*Cell*" || title match "*Line*"),
    $collection == "crispr" => (title match "*Knockout*" || title match "*CRISPR*") && (title match "*Cell*" || title match "*Line*"),
    $collection == "stable" => (title match "*Stable*" || title match "*Reporter*" || title match "*Luciferase*" || title match "*Transduced*"),
    $collection == "stem" => title match "*Stem*" || title match "*iPSC*" || title match "*Cardiomyocyte*" || title match "*Neuron*" || title match "*Astrocyte*",
    false
  )
] | order(title asc) {
  title,
  sku,
  "slug": slug.current,
  sourceUrl,
  summary,
  "assetUrls": images[].asset->url,
  imageUrls
}`;

const CAS9_OFFICIAL_TABLE_QUERY = `*[
  _type == "category"
  && array::join(path, "/") == "cellular-materials/cell-library-collections/cas9-expressing-cell-lines"
][0]{
  "html": contentBlocks[_type == "contentBlockHtml"][0].html
}`;

const SPECIAL_PATTERNS: Record<Exclude<AbmSpecialCellCollection, "cas9">, RegExp> = {
  crispr: /crispr|knock[\s-]?out|\bko\b/i,
  stable: /stable|stably|reporter|luciferase|transduced|\bgfp\b|\brfp\b/i,
  stem: /stem cell|\bips\b|ipsc|embryonic stem|neural stem|cardiomyocyte|astrocyte|neuron/i,
};

function clean(value: unknown) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalize(value: unknown) {
  return clean(value).toLowerCase();
}

function managedPreview(product?: ExistingCellProduct) {
  const urls = [...(product?.assetUrls || []), ...(product?.imageUrls || [])];
  return urls.find((url) => isManagedAbmImageUrl(url))
    || urls.map((url) => abmResourceImagePath(url)).find(Boolean);
}

function systemsByTissue() {
  const counts = new Map<string, Map<string, number>>();

  for (const product of getOfficialAbmCellModelCatalog()) {
    for (const tissue of product.cellTypes || []) {
      const key = normalize(tissue);
      const systems = counts.get(key) || new Map<string, number>();
      for (const system of product.bioSystems || []) {
        systems.set(system, (systems.get(system) || 0) + 1);
      }
      counts.set(key, systems);
    }
  }

  return new Map(Array.from(counts, ([tissue, systems]) => [
    tissue,
    Array.from(systems.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || "",
  ]));
}

function officialProductRow(product: OfficialAbmCellModelProduct, existing?: ExistingCellProduct): AbmSpecialCellProduct {
  const sku = clean(product.sku);
  return {
    title: clean(product.title),
    sku,
    href: `/products/abm/staged/product/${encodeURIComponent(sku || product.url)}`,
    sourceUrl: product.sourceUrl || product.url,
    unit: product.unit,
    species: clean(product.species?.[0]),
    bioSystem: clean(product.bioSystems?.[0]),
    cellType: clean(product.cellTypes?.[0]),
    previewImage: managedPreview(existing),
  };
}

function existingProductRow(product: ExistingCellProduct, official?: OfficialAbmCellModelProduct): AbmSpecialCellProduct | null {
  const sku = clean(product.sku);
  const title = clean(product.title);
  if (!sku || !title) return null;
  if (official) return officialProductRow(official, product);

  return {
    title,
    sku,
    href: product.slug
      ? `/products/abm/item/${encodeURIComponent(product.slug)}`
      : `/products/abm/resolve?sku=${encodeURIComponent(sku)}${product.sourceUrl ? `&u=${encodeURIComponent(product.sourceUrl)}` : ""}`,
    sourceUrl: product.sourceUrl,
    species: "",
    bioSystem: "",
    cellType: "",
    previewImage: managedPreview(product),
  };
}

function parseOfficialCas9Rows(html: string, existingBySku: Map<string, ExistingCellProduct>): AbmSpecialCellProduct[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const table = $("table").filter((_index, element) => /Cat\.?\s*No\.?/i.test($(element).text())).first();
  const tissueSystems = systemsByTissue();
  let species = "";
  const products: AbmSpecialCellProduct[] = [];

  table.find("tr").each((_index, element) => {
    const cells = $(element).find("td");
    if (cells.length === 1) {
      species = clean($(cells[0]).text());
      return;
    }
    if (cells.length < 3) return;

    const title = clean($(cells[0]).text());
    const sku = clean($(cells[1]).text());
    const cellType = clean($(cells[2]).text());
    const sourceUrl = clean($(cells[0]).find("a[href]").first().attr("href"));
    if (!title || !/^T\d+/i.test(sku)) return;

    const existing = existingBySku.get(normalize(sku));
    const official = getOfficialAbmCellModelCatalog().find((product) => normalize(product.sku) === normalize(sku));
    const base = official
      ? officialProductRow(official, existing)
      : existingProductRow(existing || { title, sku, sourceUrl });
    if (!base) return;

    products.push({
      ...base,
      title,
      species: species || base.species,
      cellType: cellType || base.cellType,
      bioSystem: base.bioSystem || tissueSystems.get(normalize(cellType)) || "",
      sourceUrl: sourceUrl || base.sourceUrl,
    });
  });

  return products.sort((left, right) => left.title.localeCompare(right.title, "en", { numeric: true }));
}

export async function getSpecialAbmCellCatalog(collection: AbmSpecialCellCollection) {
  const [existing, officialTable] = await Promise.all([
    sanityCdnClient.fetch<ExistingCellProduct[]>(
      EXISTING_CELL_PRODUCTS_QUERY,
      { collection },
      PUBLIC_CATALOG_CACHE,
    ),
    collection === "cas9"
      ? sanityCdnClient.fetch<{ html?: string } | null>(CAS9_OFFICIAL_TABLE_QUERY, {}, PUBLIC_CATALOG_CACHE)
      : Promise.resolve(null),
  ]);

  const existingBySku = new Map((existing || []).map((product) => [normalize(product.sku), product]));
  if (collection === "cas9") return parseOfficialCas9Rows(officialTable?.html || "", existingBySku);

  const pattern = SPECIAL_PATTERNS[collection];
  const bySku = new Map<string, AbmSpecialCellProduct>();
  const officialBySku = new Map(getOfficialAbmCellModelCatalog().map((product) => [normalize(product.sku), product]));

  for (const product of getOfficialAbmCellModelCatalog()) {
    if (!pattern.test(product.title)) continue;
    const row = officialProductRow(product, existingBySku.get(normalize(product.sku)));
    bySku.set(normalize(row.sku), row);
  }

  for (const product of existing || []) {
    if (!pattern.test(`${product.title || ""} ${product.summary || ""}`)) continue;
    const row = existingProductRow(product, officialBySku.get(normalize(product.sku)));
    if (row && !bySku.has(normalize(row.sku))) bySku.set(normalize(row.sku), row);
  }

  return Array.from(bySku.values()).sort((left, right) => left.title.localeCompare(right.title, "en", { numeric: true }));
}
