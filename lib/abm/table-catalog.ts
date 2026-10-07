import { load } from "cheerio";

function collapseWhitespace(value: string) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizedHeader(value: string) {
  return collapseWhitespace(value)
    .toLowerCase()
    .replace(/[.:#()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCatalogHeader(value: string) {
  return /^(?:cat(?:alog)?\s*(?:no|number)?|catalog\s*(?:no|number)|sku|item\s*(?:no|number))$/.test(
    normalizedHeader(value),
  );
}

function isProductHeader(value: string) {
  return /^(?:product(?:\s+(?:name|description))?(?:\s*\/\s*(?:name|description))?|cloning\s+vector|name|description|cell(?:\s+line)?(?:\s+name)?|model(?:\s+name)?)$/.test(
    normalizedHeader(value),
  );
}

function isCatalogNumber(value: string) {
  const sku = collapseWhitespace(value).replace(/\s+/g, "");
  return sku.length >= 2
    && sku.length <= 64
    && /\d/.test(sku)
    && /^[a-z0-9][a-z0-9._+/\-]*$/i.test(sku);
}

/**
 * Extract only Cat.Nos that are actually presented as product identities in
 * ABM tables. The result is used to trim the inventory passed to the client;
 * labels such as "By Serotype" are deliberately excluded.
 */
export function extractAbmTableCatalogNumbers(html: string) {
  if (!html || !/<table\b/i.test(html)) return [];

  const $ = load(html);
  const catalogNumbers = new Map<string, string>();

  $("table").each((_tableIndex, table) => {
    const rows = $(table).find("tr").toArray();
    let headerIndex = -1;
    let skuIndex = -1;

    rows.slice(0, 6).some((row, index) => {
      const headers = $(row).children("th,td").toArray().map((cell) => collapseWhitespace($(cell).text()));
      const candidateSkuIndex = headers.findIndex(isCatalogHeader);
      const candidateNameIndex = headers.findIndex(isProductHeader);
      if (candidateSkuIndex < 0 || candidateNameIndex < 0 || candidateSkuIndex === candidateNameIndex) return false;
      headerIndex = index;
      skuIndex = candidateSkuIndex;
      return true;
    });

    if (headerIndex >= 0 && skuIndex >= 0) {
      rows.slice(headerIndex + 1).forEach((row) => {
        const cells = $(row).children("th,td").toArray();
        const sku = collapseWhitespace($(cells[skuIndex]).text()).replace(/\s+/g, "");
        if (!isCatalogNumber(sku)) return;
        catalogNumbers.set(sku.toLowerCase(), sku);
      });
    }

    // ABM's Lentivirus Bundles use a comparison matrix instead of a normal
    // Cat.No. column. Bundle SKUs appear horizontally on rows labelled
    // "Bundle Cat. No.", so collect those identities separately.
    rows.forEach((row) => {
      const cells = $(row).children("th,td").toArray();
      const texts = cells.map((cell) => collapseWhitespace($(cell).text()));
      const labelIndex = texts.findIndex((value) =>
        /^(?:bundle\s+cat(?:alog)?\.?\s*(?:no|number)\.?|bundle\s+sku)$/i.test(value),
      );
      if (labelIndex < 0) return;

      texts.slice(labelIndex + 1).forEach((value) => {
        const sku = value.replace(/\s+/g, "");
        if (!isCatalogNumber(sku)) return;
        catalogNumbers.set(sku.toLowerCase(), sku);
      });
    });
  });

  return [...catalogNumbers.values()];
}
