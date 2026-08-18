import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";

const ABM_BASE = "https://www.abmgood.com";

const TAB_LABELS = ["Specifications", "Datasheet", "Documents", "FAQs", "References", "Reviews"];
const JUNK_IMAGE_TERMS = [
  "logo", "favicon", "sprite", "flag", "payment", "social", "header", "footer", "menu", "nav", "badge",
  "request-quote", "request_quote", "request-sample", "request_sample", "intertek",
];

export function cleanText(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function absoluteAbmUrl(raw, baseUrl = ABM_BASE) {
  const value = String(raw || "").trim();
  if (!value || value.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(value)) return "";
  try {
    const url = new URL(value, baseUrl || ABM_BASE);
    if (!["abmgood.com", "www.abmgood.com"].includes(url.hostname)) return url.toString();
    url.protocol = "https:";
    url.hostname = "www.abmgood.com";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizedLabel(value) {
  return cleanText(value).toLowerCase().replace(/[\s:]+$/g, "");
}

function cssEscape(id) {
  return String(id || "").replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, "\\$1");
}

function isPriceHeader(value) {
  return /^(?:your\s+|list\s+|unit\s+|customer\s+|sale\s+)?(?:price|cost|amount)|^(?:usd|cad|currency)$/i.test(cleanText(value));
}

function isCurrencyValue(value) {
  const text = cleanText(value);
  if (!text || text.length > 100) return false;
  return /(?:\b(?:USD|CAD)\b\s*:?)?\s*\$\s*\d|\b(?:USD|CAD)\s+\d[\d,.]*/i.test(text);
}

function containsCurrency(value) {
  return /(?:\b(?:USD|CAD)\b\s*:?)?\s*\$\s*\d|\b(?:USD|CAD)\s+\d[\d,.]*/i.test(cleanText(value));
}

function containsPriceStatement(value) {
  return containsCurrency(value) || /\b(?:price|pricing)\b/i.test(cleanText(value));
}

function stripPriceColumnsFromTable($, table) {
  const $table = $(table);
  let headerCells = $table.find("thead tr").first().children("th,td");
  if (!headerCells.length) headerCells = $table.find("tr").first().children("th,td");
  const remove = [];
  headerCells.each((i, cell) => {
    if (isPriceHeader($(cell).text())) remove.push(i);
  });
  $table.find("tr").each((_, tr) => {
    $(tr).children("th,td").each((i, cell) => {
      if (isCurrencyValue($(cell).text())) remove.push(i);
    });
  });
  const unique = [...new Set(remove)];
  if (!unique.length) return;
  $table.find("tr").each((_, tr) => {
    const cells = $(tr).children("th,td");
    [...unique].sort((a, b) => b - a).forEach((index) => cells.eq(index).remove());
  });
}

export function sanitizeAbmStoredHtml(rawHtml, baseUrl = ABM_BASE) {
  if (!rawHtml) return "";
  const $ = cheerio.load(`<div id="__root">${rawHtml}</div>`, { decodeEntities: false });
  const root = $("#__root");

  root.find("script,style,noscript,form,input,select,textarea,button").remove();
  root.find(".price,.product-price,.abm-price,[class*='price-box'],[class*='add-to-cart'],[class*='addtocart'],[class*='quantity'],[class*='shopping-cart'],[class*='product-options'],[id*='product-options']").remove();
  root.find("table").each((_, table) => stripPriceColumnsFromTable($, table));
  root.find("*").contents().each((_, node) => {
    if (node.type !== "text" || !containsPriceStatement(node.data)) return;
    $(node).remove();
  });
  root.find("p,li").each((_, el) => {
    if (containsCurrency($(el).text())) $(el).remove();
  });
  root.find("span,div").toArray().reverse().forEach((el) => {
    const node = $(el);
    const text = cleanText(node.text());
    if (text.length <= 400 && containsCurrency(text)) node.remove();
  });
  root.find("td,th,span,div,p,strong").each((_, el) => {
    const node = $(el);
    const text = cleanText(node.text());
    if (!node.children().length && (isPriceHeader(text) || isCurrencyValue(text) || /^(?:add\s+to\s+cart|quantity)$/i.test(text))) node.remove();
  });

  root.find("a[href]").each((_, a) => {
    const rawHref = String($(a).attr("href") || "").trim();
    const label = cleanText($(a).text());
    if (
      /(?:custom-service-inquiry|request[-_/ ]?(?:a[-_/ ]?)?quote|add[-_/ ]?to[-_/ ]?cart|checkout|shopping[-_/ ]?cart)/i.test(rawHref)
      || /^(?:buy|order|purchase|request\s+(?:a\s+)?quote|inquire\s+now)$/i.test(label)
    ) {
      $(a).remove();
      return;
    }
    const href = absoluteAbmUrl($(a).attr("href"), baseUrl);
    if (href) $(a).attr("href", href);
    $(a).attr("target", "_blank").attr("rel", "noopener noreferrer");
  });
  root.find("img").each((_, img) => {
    const src = absoluteAbmUrl($(img).attr("src") || $(img).attr("data-src"), baseUrl);
    if (src) $(img).attr("src", src);
  });

  const html = root.html() || "";
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "figure", "figcaption", "details", "summary",
    ]),
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
      "*": ["class", "id"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    },
  }).trim();
}

const cleanFragment = sanitizeAbmStoredHtml;

function pageScope($) {
  for (const selector of [
    "#product-product", ".product-product", "#content", "main", ".main-content", "#abm-category-right-outer", ".container",
  ]) {
    const node = $(selector).first();
    if (node.length) return node;
  }
  return $("body");
}

function findPanelIdForLabel($, label) {
  const target = normalizedLabel(label);
  let id = "";
  $("a[href^='#'],button,[aria-controls],[data-target],[data-bs-target]").each((_, el) => {
    if (id) return;
    if (normalizedLabel($(el).text()) !== target) return;
    const candidate =
      $(el).attr("aria-controls") ||
      $(el).attr("data-target") ||
      $(el).attr("data-bs-target") ||
      $(el).attr("href") ||
      "";
    id = String(candidate).replace(/^#/, "").trim();
  });
  return id;
}

function collectAfterHeading($, heading, stopLabels = TAB_LABELS) {
  if (!heading?.length) return "";
  const parts = [];
  let current = heading.next();
  let guard = 0;
  while (current.length && guard < 200) {
    const tag = String(current.get(0)?.tagName || "").toLowerCase();
    const label = cleanText(current.text());
    if (/^h[1-6]$/.test(tag) && stopLabels.some((x) => normalizedLabel(x) === normalizedLabel(label))) break;
    parts.push($.html(current));
    current = current.next();
    guard++;
  }
  return parts.join("\n");
}

function extractPanel($, label, baseUrl) {
  const id = findPanelIdForLabel($, label);
  if (id) {
    const panel = $(`#${cssEscape(id)}`).first();
    if (panel.length) {
      const html = cleanFragment(panel.html() || "", baseUrl);
      if (cleanText(panel.text()).length > 0 || html) return html;
    }
  }

  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  for (const selector of [
    `#${slug}`, `#tab-${slug}`, `#product-${slug}`, `[id*='${slug}']`, `[class*='${slug}']`,
  ]) {
    const panel = $(selector).first();
    if (!panel.length) continue;
    const html = cleanFragment(panel.html() || "", baseUrl);
    if (cleanText(panel.text()).length >= 5) return html;
  }

  const heading = $("h1,h2,h3,h4,h5,h6,strong").filter((_, el) => normalizedLabel($(el).text()) === normalizedLabel(label)).first();
  if (heading.length) return cleanFragment(collectAfterHeading($, heading), baseUrl);
  return "";
}

function parseTableRowsFromHtml(html) {
  if (!html) return [];
  const $ = cheerio.load(`<div id="__root">${html}</div>`, { decodeEntities: false });
  const tables = [];
  $("#__root table").each((_, table) => {
    const rows = [];
    $(table).find("tr").each((__, tr) => {
      const cells = $(tr).children("th,td").toArray().map((cell) => cleanText($(cell).text()));
      if (cells.some(Boolean)) rows.push(cells);
    });
    if (rows.length) tables.push(rows);
  });
  return tables;
}

function specValue(tables, aliases) {
  const wanted = aliases.map(normalizedLabel);
  for (const table of tables) {
    for (const row of table) {
      if (row.length < 2) continue;
      if (wanted.includes(normalizedLabel(row[0]))) return cleanText(row.slice(1).join(" | "));
    }
  }
  return "";
}

function parseHeaderSkuAndUnit($) {
  const body = cleanText(pageScope($).text());
  const sku = body.match(/Cat\.?\s*No\.?\s*[:#]?\s*([A-Za-z0-9._/+\-‑–]+)/i)?.[1]?.trim() || "";
  const unit = body.match(/\bUnit\s*[:#]?\s*([^\n|]{1,80}?)(?=\s+(?:Price|Cat\.?\s*No\.?|Request\s+Quote|Specifications|Datasheet|Documents|FAQs|References|Reviews)\b|$)/i)?.[1]?.trim() || "";
  return { sku, unit };
}

function parseBreadcrumbs($) {
  const out = [];
  $("ul.breadcrumb a,ol.breadcrumb a,.breadcrumb a,.breadcrumbs a,nav[aria-label*='breadcrumb' i] a").each((_, a) => {
    const label = cleanText($(a).text());
    if (!label || /^home$/i.test(label) || /^products?$/i.test(label) || /^services?$/i.test(label)) return;
    if (!out.includes(label)) out.push(label);
  });
  return out;
}

function isJunkImage(url) {
  const value = String(url || "").toLowerCase();
  if (!value) return true;
  return JUNK_IMAGE_TERMS.some((term) => value.includes(term)) || /(?:^|[-_/])(16x11|229x65)(?:[-_.\/]|$)/.test(value);
}

function extractImages($, baseUrl) {
  const candidates = [];
  const preferredSelectors = [
    ".product-image img", ".product-gallery img", ".image-additional img", ".thumbnails img", ".product-info img",
    "[data-zoom-image]", "[data-image]", "#content img",
  ];
  for (const selector of preferredSelectors) {
    $(selector).each((_, el) => {
      const raws = [
        $(el).attr("data-zoom-image"), $(el).attr("data-image"), $(el).attr("data-src"), $(el).attr("src"), $(el).attr("data-original"),
      ];
      for (const raw of raws) {
        const url = absoluteAbmUrl(raw, baseUrl);
        if (!url || isJunkImage(url)) continue;
        if (!/\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.test(url)) continue;
        candidates.push(url);
      }
    });
    if (candidates.length) break;
  }
  return [...new Set(candidates)];
}

function documentLabel(a, $) {
  return cleanText($(a).text() || $(a).attr("title") || $(a).find("img").attr("alt") || "Document");
}

function extractDocuments($, baseUrl, panels) {
  const docs = [];
  const seen = new Set();
  const add = (title, rawUrl, section = "") => {
    const url = absoluteAbmUrl(rawUrl, baseUrl);
    if (!url || seen.has(url)) return;
    const label = cleanText(title);
    const isFile = /\.(pdf|docx?|xlsx?|zip)(?:[?#]|$)/i.test(url);
    const isNamedDocument = !/^document$/i.test(label)
      && /datasheet|msds|protocol|brochure|guide|document/i.test(`${label} ${url}`);
    if (!isFile && !isNamedDocument) return;
    seen.add(url);
    docs.push({ title: label || "Document", url, section });
  };

  for (const [section, html] of Object.entries(panels)) {
    if (!html) continue;
    const $$ = cheerio.load(`<div>${html}</div>`, { decodeEntities: false });
    $$("a[href]").each((_, a) => add(documentLabel(a, $$), $$(a).attr("href"), section));
  }
  pageScope($).find("a[href]").each((_, a) => add(documentLabel(a, $), $(a).attr("href"), "page"));
  return docs;
}

function extractIntroHtml($, baseUrl, kind) {
  const scope = pageScope($);
  const h1 = scope.find("h1").first().length ? scope.find("h1").first() : $("h1").first();
  if (!h1.length) return "";

  const parts = [];
  let node = h1.next();
  let guard = 0;
  while (node.length && guard < 80) {
    const tag = String(node.get(0)?.tagName || "").toLowerCase();
    const label = normalizedLabel(node.text());
    if (/^h[1-6]$/.test(tag) && (TAB_LABELS.map(normalizedLabel).includes(label) || label === "service details" || label === "additional info")) break;
    const html = $.html(node);
    if (html && !/request\s+quote|\bprice\b/i.test(cleanText(node.text()))) parts.push(html);
    node = node.next();
    guard++;
  }
  const result = cleanFragment(parts.join("\n"), baseUrl);
  if (kind === "service" && cleanText(result).length < 20) {
    const firstParagraphs = scope.find("p").slice(0, 4).toArray().map((p) => $.html(p)).join("\n");
    return cleanFragment(firstParagraphs, baseUrl);
  }
  return result;
}

function isolateServiceOfferRows($, root, expectedSku) {
  const wanted = cleanText(expectedSku).toLowerCase();
  if (!wanted) return;
  root.find("table").each((_, table) => {
    const rows = $(table).find("tr");
    const headers = rows.first().children("th,td").toArray().map((cell) => normalizedLabel($(cell).text()));
    const isCatalogTable = headers.some((header) => /^(?:cat\.?\s*no\.?|catalog(?:ue)?(?:\s+number)?)$/.test(header));
    const matching = rows.filter((__, tr) =>
      $(tr).children("th,td").toArray().some((cell) => cleanText($(cell).text()).toLowerCase() === wanted),
    );
    if (!matching.length) {
      // A Service page can contain several independent offering tables. A table
      // with catalogue numbers that does not contain the requested Cat.No. belongs
      // to a different offering and must not be stored on this Service record.
      if (isCatalogTable) $(table).remove();
      return;
    }
    rows.each((__, tr) => {
      const row = $(tr);
      if (row.children("th").length || row.is(matching)) return;
      row.remove();
    });
  });
}

function extractServiceDetailsHtml($, baseUrl, expectedSku) {
  const heading = $("h1,h2,h3,h4,h5,h6").filter((_, el) => normalizedLabel($(el).text()) === "service details").first();
  if (!heading.length) return "";
  const parts = [];
  let node = heading.next();
  let guard = 0;
  while (node.length && guard < 160) {
    const tag = String(node.get(0)?.tagName || "").toLowerCase();
    const label = normalizedLabel(node.text());
    if (/^h[1-6]$/.test(tag) && ["additional info", "additional resources", "documents", "faqs", "references", "reviews"].includes(label)) break;
    parts.push($.html(node));
    node = node.next();
    guard++;
  }
  const raw = parts.join("\n");
  if (!raw) return "";
  const fragment = cheerio.load(`<div id="__service-root">${raw}</div>`, { decodeEntities: false });
  isolateServiceOfferRows(fragment, fragment("#__service-root"), expectedSku);
  return cleanFragment(fragment("#__service-root").html() || "", baseUrl);
}

function findServiceOfferInTables($, expectedSku) {
  const wanted = cleanText(expectedSku).toLowerCase();
  if (!wanted) return null;
  let match = null;

  pageScope($).find("table").each((_, table) => {
    if (match) return;
    const rows = $(table).find("tr");
    let headers = [];
    rows.each((rowIndex, tr) => {
      if (match) return;
      const cells = $(tr).children("th,td").toArray();
      const texts = cells.map((cell) => cleanText($(cell).text()));
      if (!texts.length) return;
      if (rowIndex === 0 || $(tr).children("th").length) {
        const maybeHeaders = texts.map((x) => normalizedLabel(x));
        if (maybeHeaders.some((x) => x.includes("cat. no") || x.includes("cat no") || x === "service" || x === "service description")) headers = texts;
      }
      const hit = texts.some((value) => cleanText(value).toLowerCase() === wanted);
      if (!hit) return;

      const fields = {};
      if (headers.length === texts.length) {
        headers.forEach((header, i) => {
          if (!isPriceHeader(header)) fields[cleanText(header) || `column${i + 1}`] = texts[i];
        });
      } else {
        fields.values = texts;
      }
      match = {
        sku: expectedSku,
        title:
          fields.Service || fields["Service Description"] || fields.Name || fields.Scale ||
          texts.find((x) => x && x.toLowerCase() !== wanted) || "",
        unit: fields.Unit || fields.Volume || "",
        fields,
      };
    });
  });
  return match;
}

function countFaqs(html) {
  if (!html) return 0;
  const $ = cheerio.load(`<div>${html}</div>`);
  const rows = $("table tr").length;
  if (rows) return rows;
  return $("details,dt,.faq-item,.accordion-item").length;
}

export function parseAbmRebuildDetail(html, sourceUrl, expected = {}) {
  const $ = cheerio.load(html || "", { decodeEntities: false });
  const kind = expected.kind === "service" ? "service" : "product";
  const scope = pageScope($);
  const pageTitle = cleanText(scope.find("h1").first().text() || $("h1").first().text() || $("title").first().text()).replace(/\s*\|.*$/, "");

  const panels = {};
  for (const label of TAB_LABELS) panels[label.toLowerCase()] = extractPanel($, label, sourceUrl);
  const specificationsHtml = panels.specifications || "";
  const specTables = parseTableRowsFromHtml(specificationsHtml);
  const header = parseHeaderSkuAndUnit($);
  const specSku = specValue(specTables, ["Cat. No.", "Cat No", "Catalogue Number", "Catalog Number"]);
  const specUnit = specValue(specTables, ["Unit", "Product Size", "Size"]);
  const directSku = specSku || header.sku || "";
  const expectedSku = cleanText(expected.sku);
  const serviceOffer = kind === "service" && expectedSku ? findServiceOfferInTables($, expectedSku) : null;
  const sku = serviceOffer?.sku || directSku || expectedSku || "";
  const displayTitle =
    (kind === "service" && cleanText(expected.title)) ||
    serviceOffer?.title ||
    pageTitle ||
    cleanText(expected.title);
  const unit = serviceOffer?.unit || specUnit || header.unit || cleanText(expected.unit);
  const serviceDetailsHtml = kind === "service" ? extractServiceDetailsHtml($, sourceUrl, expectedSku) : "";

  const documents = extractDocuments($, sourceUrl, {
    datasheet: panels.datasheet,
    documents: panels.documents,
    serviceDetails: serviceDetailsHtml,
  });
  const images = extractImages($, sourceUrl);
  const description = specValue(specTables, ["Description", "Product Description"]);
  const category = specValue(specTables, ["Category"]);
  const storage = specValue(specTables, ["Storage Condition", "Storage", "Storage Conditions"]);
  const materialCitation = specValue(specTables, ["Material Citation", "Citation"]);
  const breadcrumbs = parseBreadcrumbs($);

  const result = {
    kind,
    sourceUrl,
    sourcePageTitle: pageTitle,
    title: displayTitle,
    sku,
    unit,
    category,
    breadcrumbs,
    introHtml: extractIntroHtml($, sourceUrl, kind),
    description,
    storage,
    materialCitation,
    specificationsHtml,
    specificationTables: specTables,
    datasheetHtml: panels.datasheet || "",
    documentsHtml: panels.documents || "",
    faqsHtml: panels.faqs || "",
    referencesHtml: panels.references || "",
    reviewsHtml: panels.reviews || "",
    serviceDetailsHtml,
    serviceOffer,
    documents,
    images,
    counts: {
      images: images.length,
      documents: documents.length,
      faqs: countFaqs(panels.faqs),
      specificationTables: specTables.length,
    },
    verification: {
      expectedSku: expectedSku || null,
      expectedTitle: cleanText(expected.title) || null,
      skuMatches: expectedSku ? cleanText(sku).toLowerCase() === expectedSku.toLowerCase() : null,
      serviceOfferMatched: kind === "service" && expectedSku ? Boolean(serviceOffer) : null,
      hasSpecifications: Boolean(cleanText(specificationsHtml)),
      hasImages: images.length > 0,
      hasDocuments: documents.length > 0,
    },
  };

  return result;
}
