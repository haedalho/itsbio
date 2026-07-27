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
const COMMERCE_TEXT_RE = /^(?:(?:login|sign in)\s+(?:to|for)\s+(?:see\s+)?prices?|add to cart|choose an option|clear|quantity|(?:call|contact us)\s+for\s+pric(?:e|ing)|price on request)$/i;
const PRICE_TEXT_RE = /^(?:starting\s+(?:at|from)|from\s+[$€£¥₩]|(?:price|pricing|cost|amount|msrp)\s*[:\-])/i;
const SUPPORT_HEADING_RE = /^(?:need help(?: with your order)?|chat with an expert|call us|contact us|not sure which .* right for you)$/i;
const MONEY_RE = /(?:[$€£¥₩]\s*\d[\d,.]*(?:\s*(?:USD|EUR|GBP|JPY|KRW))?|(?:USD|EUR|GBP|JPY|KRW)\s*\d[\d,.]*|\d[\d,.]*\s*(?:USD|EUR|GBP|JPY|KRW|원))/i;

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

function removePriceColumns($: cheerio.CheerioAPI, root: any) {
  root.find("table").each((_tableIndex: number, table: any) => {
    const rows = $(table).find("tr");
    const headerRow = $(table).find("thead tr").first().length ? $(table).find("thead tr").first() : rows.first();
    const indexes: number[] = [];

    headerRow.children("th,td").each((index: number, cell: any) => {
      if (PRICE_COLUMN_RE.test(cleanText($(cell).text()))) indexes.push(index);
    });

    indexes.sort((a, b) => b - a);
    if (!indexes.length) return;

    rows.each((_rowIndex: number, row: any) => {
      indexes.forEach((index) => {
        $(row).children("th,td").eq(index).remove();
      });
    });
  });
}

function removeCommerceNoise($: cheerio.CheerioAPI, root: any) {
  root
    .find(
      "script,style,noscript,iframe,form,input,button,select,option,.price,.pricing,.product-price,.product_price,.price-box,.price-wrapper,.regular-price,.sale-price,.list-price,.retail-price,.unit-price,.msrp,.woocommerce-Price-amount,.woocommerce-price-suffix,.woocommerce-variation-price,.single_variation_wrap,[itemprop='price']",
    )
    .remove();

  removePriceColumns($, root);

  root.find("p,li,td,th,span,strong,small").each((_index: number, node: any) => {
    const element = $(node);
    const text = cleanText(element.text());
    if (!text) return;

    if (COMMERCE_TEXT_RE.test(text) || PRICE_TEXT_RE.test(text) || MONEY_RE.test(text)) {
      element.remove();
      return;
    }

    if (/^Get early access to info, updates, and discounts$/i.test(text)) element.remove();
    if (/^Our product specialists are here to help with additional information/i.test(text)) element.remove();
  });
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

export function sanitizeKentSourceHtml(input: unknown) {
  const raw = typeof input === "string" ? input.trim() : "";
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
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "sup",
      "sub",
      "h2",
      "h3",
      "h4",
      "h5",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "img",
      "figure",
      "figcaption",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "div",
      "span",
      "hr",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          ...(String(attribs.href || "").startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {}),
        },
      }),
      img: (_tagName, attribs) => ({
        tagName: "img",
        attribs: { ...attribs, loading: "lazy" },
      }),
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
  if (/video/.test(value)) return "videos";
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
    if (COMMERCE_TEXT_RE.test(text) || PRICE_TEXT_RE.test(text) || MONEY_RE.test(text)) continue;
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
  const seenSections = new Set<string>();

  matches.forEach((match, index) => {
    const title = cleanText(match[1]);
    if (!title || SUPPORT_HEADING_RE.test(title)) return;

    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index || html.length : html.length;
    const body = html.slice(start, end).trim();
    const bodySignature = contentSignature(body);
    if (!bodySignature) return;

    const signature = `${contentSignature(title)}|${bodySignature}`;
    if (seenSections.has(signature)) return;
    seenSections.add(signature);

    sections.push({
      _key: `source-${slugify(title)}-${index}`,
      type: headingType(title),
      title,
      html: body,
    });
  });

  return {
    leadHtml: lead.leadHtml,
    remainderHtml: lead.remainderHtml,
    sections,
  };
}

export function pickKentSubtitle(summary: unknown, leadHtml: string) {
  const value = cleanText(summary);
  if (!value || MONEY_RE.test(value) || PRICE_TEXT_RE.test(value)) return "";

  const leadText = cleanText(leadHtml).toLowerCase();
  if (leadText && (leadText.startsWith(value.toLowerCase()) || value.toLowerCase().startsWith(leadText.slice(0, 80)))) {
    return "";
  }

  const sentences = (value.match(/[.!?](?:\s|$)/g) || []).length;
  if (value.length > 170 || sentences > 1) return "";
  return value;
}
