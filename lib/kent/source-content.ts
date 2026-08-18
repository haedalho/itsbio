import "server-only";

import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";

export type DerivedKentSection = {
  _key: string;
  type: string;
  title: string;
  html: string;
};

export type DerivedKentSourceContent = {
  leadHtml: string;
  remainderHtml: string;
  sections: DerivedKentSection[];
};

const PRICE_COLUMN_RE = /^(?:price|pricing|unit price|list price|retail price|sale price|dealer price|your price|online price|web price|net price|msrp|cost|amount)$/i;
const COMMERCE_TEXT_RE = /^(?:(?:login|sign in)\s+(?:to|for)\s+(?:see\s+)?prices?|add to cart|choose an option|clear|quantity|(?:call|contact us)\s+for\s+pric(?:e|ing)|price on request|buy on amazon|get your accessories|don'?t miss)$/i;
const PRINT_UI_TEXT_RE = /^(?:print|print page|print this page)$/i;
const PRICE_TEXT_RE = /^(?:starting\s+(?:at|from)|from\s+[$€£¥₩]|(?:price|pricing|cost|amount|msrp)\s*[:\-])/i;
const MONEY_RE = /(?:[$€£¥₩]\s*\d[\d,.]*(?:\s*(?:USD|EUR|GBP|JPY|KRW))?|(?:USD|EUR|GBP|JPY|KRW)\s*\d[\d,.]*|\d[\d,.]*\s*(?:USD|EUR|GBP|JPY|KRW|원))/i;
const NO_CHARGE_RE = /^(?:no charge|free|included at no charge)$/i;
const SUPPLIER_SUPPORT_HEADING_RE = /^(?:need\s+help(?:\s+with\s+your\s+order)?\??|help\s*&\s*support|we(?:'|’)?re\s+here\s+for\s+you|chat\s+with\s+an\s+expert|call\s+us|contact\s+us|ask\s+for\s+support|we\s+reply\s+fast.*|not\s+sure\s+which\s+.*\s+right\s+for\s+you\??|want\s+to\s+see\s+how\s+.*\s+could\s+work\s+in\s+your\s+lab\??)$/i;
const EXCLUDED_PRODUCT_SECTION_RE = /^(?:how\s+much\s+could\s+you\s+save(?:\s+with\s+.*)?\??|calculate\s+your\s+savings.*|estimated\s+yearly\s+operational\s+savings.*|get\s+early\s+access.*|newsletter|supplier\s+support)$/i;

function cleanText(input?: unknown) {
  return String(input || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function contentSignature(input?: unknown) {
  return cleanText(input)
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(input: string) {
  return cleanText(input)
    .toLowerCase()
    .replace(/[®™]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "section";
}

function isExcludedHeading(title: string) {
  const value = cleanText(title);
  return SUPPLIER_SUPPORT_HEADING_RE.test(value) || EXCLUDED_PRODUCT_SECTION_RE.test(value);
}

function isWarrantyLikeContent(input: unknown) {
  const text = cleanText(input).toLowerCase();
  if (!text) return false;
  const planColumns = /\bstandard\b[\s\S]{0,180}\bextended\b[\s\S]{0,180}\bpremium\b/.test(text);
  const warrantyTerms = /(coverage period|loaner equipment|expedited repairs|parts\s*&\s*labor|warranty repairs|onsite installation)/.test(text);
  return planColumns && warrantyTerms;
}

function removePriceColumns($: cheerio.CheerioAPI, root: any) {
  root.find("table").each((_tableIndex: number, table: any) => {
    const rows = $(table).find("tr");
    const headerRow = $(table).find("thead tr").first().length ? $(table).find("thead tr").first() : rows.first();
    const indexes: number[] = [];

    headerRow.children("th,td").each((index: number, cell: any) => {
      if (PRICE_COLUMN_RE.test(cleanText($(cell).text()))) indexes.push(index);
    });

    indexes.sort((a, b) => b - a);
    if (indexes.length) {
      rows.each((_rowIndex: number, row: any) => {
        indexes.forEach((index) => {
          $(row).children("th,td").eq(index).remove();
        });
      });
    }

    rows.each((_rowIndex: number, row: any) => {
      const values = $(row)
        .children("th,td")
        .map((_cellIndex: number, cell: any) => cleanText($(cell).text()))
        .get()
        .filter(Boolean);
      if (values.some((value: string) => MONEY_RE.test(value) || NO_CHARGE_RE.test(value))) $(row).remove();
    });
  });
}

function removeCommerceNoise($: cheerio.CheerioAPI, root: any) {
  root
    .find(
      "script,style,noscript,iframe,form,input,select,option,.price,.pricing,.product-price,.product_price,.price-box,.price-wrapper,.regular-price,.sale-price,.list-price,.retail-price,.unit-price,.msrp,.woocommerce-Price-amount,.woocommerce-price-suffix,.woocommerce-variation-price,.single_variation_wrap,[itemprop='price']",
    )
    .remove();

  removePriceColumns($, root);

  root.find("p,li,td,th,span,strong,small,button,a").each((_index: number, node: any) => {
    const element = $(node);
    const text = cleanText(element.text());
    if (!text) return;

    if (COMMERCE_TEXT_RE.test(text) || PRINT_UI_TEXT_RE.test(text) || PRICE_TEXT_RE.test(text) || MONEY_RE.test(text) || NO_CHARGE_RE.test(text)) {
      element.remove();
      return;
    }

    if (/^Get early access to info, updates, and discounts$/i.test(text)) element.remove();
    if (/^Our product specialists are here to help with additional information/i.test(text)) element.remove();
  });
}

function internalKentHref(input: unknown) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, "https://www.kentscientific.com");
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== "kentscientific.com" && hostname !== "www.kentscientific.com") return raw;

    const productMatch = parsed.pathname.match(/^\/products\/([^/]+)\/?$/i);
    if (productMatch?.[1]) return `/products/kent/item/${productMatch[1]}`;

    const categoryMatch = parsed.pathname.match(/^\/product\/(.+?)\/?$/i);
    if (categoryMatch?.[1]) return `/products/kent/${categoryMatch[1]}`;

    return "/products/kent";
  } catch {
    return raw.startsWith("/") ? raw : "";
  }
}

function dedupeRepeatedBlocks($: cheerio.CheerioAPI, root: any) {
  const seen = new Set<string>();
  root.find("p,li,blockquote,figure,table").each((_index: number, node: any) => {
    const element = $(node);
    const signature = contentSignature(element.html() || element.text());
    if (!signature || signature.length < 18) return;
    if (seen.has(signature)) {
      element.remove();
      return;
    }
    seen.add(signature);
  });
}

function decodeEscapedKentMarkup(input: string) {
  let value = input;
  for (let pass = 0; pass < 2; pass += 1) {
    const ampDecoded = value.replace(/&amp;/gi, "&");
    const hasEncodedTableMarkup = /(?:&lt;|&#0*60;|&#x0*3c;)\s*\/?\s*(?:table|thead|tbody|tfoot|tr|th|td)\b/i.test(ampDecoded);
    if (!hasEncodedTableMarkup) break;
    value = ampDecoded
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#(?:39|x27);/gi, "'");
  }
  return value;
}

export function sanitizeKentSourceHtml(input: unknown) {
  const raw = decodeEscapedKentMarkup(typeof input === "string" ? input.trim() : "");
  if (!raw) return "";

  const $ = cheerio.load(`<div id="kent-source-root">${raw}</div>`, null, false);
  const root = $("#kent-source-root");
  removeCommerceNoise($, root);

  root.find("[style]").removeAttr("style");
  root.find("[onclick],[onerror],[onload],[data-price],[itemprop='price']").each((_index: number, node: any) => {
    const element = $(node);
    element.removeAttr("onclick").removeAttr("onerror").removeAttr("onload").removeAttr("data-price");
    if (element.attr("itemprop") === "price") element.remove();
  });

  dedupeRepeatedBlocks($, root);

  const cleaned = sanitizeHtml(root.html() || "", {
    allowedTags: [
      "p", "br", "strong", "b", "em", "i", "u", "sup", "sub", "h2", "h3", "h4", "h5", "button",
      "ul", "ol", "li", "blockquote", "a", "img", "figure", "figcaption", "table", "thead", "tbody",
      "tfoot", "tr", "th", "td", "div", "span", "hr",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
      button: ["type"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (_tagName, attribs) => {
        const href = internalKentHref(attribs.href);
        const external = /^https?:\/\//i.test(href);
        const { target: _target, rel: _rel, ...safeAttribs } = attribs;
        return {
          tagName: "a",
          attribs: {
            ...safeAttribs,
            href,
            ...(external ? { target: "_blank", rel: "noreferrer" } : {}),
          },
        };
      },
      img: (_tagName, attribs) => ({ tagName: "img", attribs: { ...attribs, loading: "lazy" } }),
    },
  });

  return cleaned.trim();
}

function headingType(title: string) {
  const value = cleanText(title).toLowerCase();
  if (/what you get|features?|benefits?|highlights?/.test(value)) return "features";
  if (/customer|peer|review|testimonial/.test(value)) return "reviews";
  if (/base system includes|system includes|includes|what(?:'s| is) included|in the box/.test(value)) return "included";
  if (/optional|add-on|add on|extend .* capabilities|accessories/.test(value)) return "addons";
  if (/specification|technical data|technical specification/.test(value)) return "spec-table";
  if (/resource|document|download|manual|guide|brochure/.test(value)) return "documents";
  if (/video|playlist/.test(value)) return "videos";
  if (/publication|reference|scientific article|research article|paper/.test(value)) return "publications";
  if (/warranty/.test(value)) return "warranty";
  if (/faq|frequently asked/.test(value)) return "faqs";
  if (/warning|requirement|important|notice/.test(value)) return "notice";
  if (/customers who viewed|related products|you may also/.test(value)) return "related-products";
  return "rich-text";
}

function pickSplitHeadingLevel(html: string) {
  if (/<h2\b/i.test(html)) return 2;
  if (/<h3\b/i.test(html)) return 3;
  if (/<h4\b/i.test(html)) return 4;
  return 0;
}

function extractLeadParagraphs(prefixHtml: string) {
  const paragraphPattern = /<p\b[^>]*>[\s\S]*?<\/p>/gi;
  const selected: string[] = [];
  const selectedBlocks: string[] = [];
  const seen = new Set<string>();

  for (const match of prefixHtml.matchAll(paragraphPattern)) {
    const block = match[0];
    const text = cleanText(block);
    const signature = contentSignature(text);
    if (!text || text.length < 18 || !signature) continue;
    if (COMMERCE_TEXT_RE.test(text) || PRICE_TEXT_RE.test(text) || MONEY_RE.test(text) || NO_CHARGE_RE.test(text)) continue;
    if (/^(?:item|cat\.?\s*no\.?|sku|categor(?:y|ies)|tag)\s*#/i.test(text)) continue;
    if (/^customers who viewed/i.test(text)) break;
    if (seen.has(signature)) continue;

    seen.add(signature);
    selected.push(block);
    selectedBlocks.push(block);
    if (selected.length >= 6) break;
  }

  let remainder = prefixHtml;
  for (const block of selectedBlocks) remainder = remainder.replace(block, "");
  remainder = remainder
    .replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, "")
    .replace(/<div\b[^>]*>\s*<\/div>/gi, "")
    .trim();

  return {
    leadHtml: selected.join(""),
    remainderHtml: cleanText(remainder) ? remainder : "",
  };
}

export function deriveKentSourceContent(input: unknown): DerivedKentSourceContent {
  const html = sanitizeKentSourceHtml(input);
  if (!html) return { leadHtml: "", remainderHtml: "", sections: [] };

  const level = pickSplitHeadingLevel(html);
  if (!level) {
    const lead = extractLeadParagraphs(html);
    return { leadHtml: lead.leadHtml, remainderHtml: lead.remainderHtml, sections: [] };
  }

  const headingPattern = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi");
  const matches = Array.from(html.matchAll(headingPattern));
  const prefix = matches.length ? html.slice(0, matches[0].index || 0) : html;
  const lead = extractLeadParagraphs(prefix);
  const sections: DerivedKentSection[] = [];
  const seenBodies = new Set<string>();

  matches.forEach((match, index) => {
    const title = cleanText(match[1]);
    if (!title || isExcludedHeading(title)) return;

    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index || html.length : html.length;
    const body = html.slice(start, end).trim();
    const bodySignature = contentSignature(body);
    if (!bodySignature) return;

    const type = headingType(title);
    if (type === "spec-table" && isWarrantyLikeContent(body)) return;
    if (seenBodies.has(bodySignature)) return;
    seenBodies.add(bodySignature);

    sections.push({ _key: `source-${slugify(title)}-${index}`, type, title, html: body });
  });

  return { leadHtml: lead.leadHtml, remainderHtml: lead.remainderHtml, sections };
}

function sanitizeRow(row: Record<string, unknown>) {
  const entries = Object.entries(row).filter(([key]) => !key.startsWith("_") && !PRICE_COLUMN_RE.test(cleanText(key)));
  if (!entries.length) return null;
  if (entries.some(([, value]) => MONEY_RE.test(cleanText(value)) || NO_CHARGE_RE.test(cleanText(value)))) return null;
  return Object.fromEntries(entries);
}

export function sanitizeKentSections(input: unknown) {
  if (!Array.isArray(input)) return [] as Array<Record<string, unknown>>;

  const seenBodies = new Set<string>();
  const output: Array<Record<string, unknown>> = [];

  for (const rawSection of input) {
    if (!rawSection || typeof rawSection !== "object") continue;
    const section = { ...(rawSection as Record<string, unknown>) };
    const title = cleanText(section.title);
    if (title && isExcludedHeading(title)) continue;

    for (const key of ["html", "contentHtml", "bodyHtml", "descriptionHtml"]) {
      if (typeof section[key] === "string") section[key] = sanitizeKentSourceHtml(section[key]);
    }

    if (Array.isArray(section.rows)) {
      section.rows = section.rows
        .map((row) => (row && typeof row === "object" ? sanitizeRow(row as Record<string, unknown>) : null))
        .filter(Boolean);
    }

    if (Array.isArray(section.items)) {
      section.items = section.items.filter((item) => {
        if (!item || typeof item !== "object") return false;
        const text = cleanText(Object.values(item as Record<string, unknown>).join(" "));
        return !MONEY_RE.test(text) && !NO_CHARGE_RE.test(text) && !COMMERCE_TEXT_RE.test(text);
      });
    }

    const bodyText = cleanText(
      [section.html, section.contentHtml, section.bodyHtml, section.description, JSON.stringify(section.rows || []), JSON.stringify(section.items || [])].join(" "),
    );
    if (/our team can help you with product details, configurations, and quotes/i.test(bodyText) && /contact us/i.test(bodyText)) continue;
    const type = cleanText(section.type || section.kind || section._type).toLowerCase();
    if ((/spec|technical|table/.test(type) || /specification/i.test(title)) && isWarrantyLikeContent(bodyText)) continue;

    const signature = contentSignature(bodyText);
    if (signature && seenBodies.has(signature)) continue;
    if (signature) seenBodies.add(signature);

    const hasContent = Boolean(
      bodyText || cleanText(section.imageUrl) ||
      (Array.isArray(section.rows) && section.rows.length) ||
      (Array.isArray(section.items) && section.items.length),
    );
    if (!hasContent) continue;
    output.push(section);
  }

  return output;
}

export function pickKentSubtitle(summary: unknown, leadHtml: string) {
  const value = cleanText(summary);
  if (!value || MONEY_RE.test(value) || PRICE_TEXT_RE.test(value)) return "";

  const leadText = cleanText(leadHtml).toLowerCase();
  if (leadText && (leadText.startsWith(value.toLowerCase()) || value.toLowerCase().startsWith(leadText.slice(0, 80)))) return "";

  const sentences = (value.match(/[.!?](?:\s|$)/g) || []).length;
  if (value.length > 170 || sentences > 1) return "";
  return value;
}
