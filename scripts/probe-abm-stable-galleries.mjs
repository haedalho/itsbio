#!/usr/bin/env node
import * as cheerio from "cheerio";
import { parseAbmRebuildDetailV2 } from "../lib/abm/rebuild-parser-v2.mjs";

const SAMPLES = [
  ["T6352", "https://www.abmgood.com/3xflag-ago2-stable-expressing-hek293t-cell-line.html"],
  ["T3211", "https://www.abmgood.com/5-ht2ar-expressing-stable-293t-cell-line.html"],
  ["T3212", "https://www.abmgood.com/5-ht2br-expressing-stable-293t-cell-line.html"],
  ["T3213", "https://www.abmgood.com/5-ht2cr-expressing-stable-293t-cell-line.html"],
  ["T3170", "https://www.abmgood.com/88-tag-stable-y-liz-dna-polymerase-beta-knockout-mouse-embryonic-fibroblast-cell-line.html"],
];

const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();
const abs = (v, base) => {
  try { return new URL(String(v || ""), base).toString(); } catch { return ""; }
};
const unique = (xs) => [...new Set(xs.filter(Boolean))];

function urlsFrom($, selector, base) {
  const out = [];
  $(selector).each((_, el) => {
    const e = $(el);
    if (e.is("a")) {
      out.push(abs(e.attr("href"), base));
      const img = e.find("img").first();
      out.push(abs(img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src"), base));
    } else {
      out.push(abs(e.attr("data-src") || e.attr("data-lazy-src") || e.attr("src"), base));
      const a = e.closest("a[href]");
      if (a.length) out.push(abs(a.attr("href"), base));
    }
  });
  return unique(out).filter((url) => /\/assets\/product\//i.test(url));
}

async function fetchHtml(url) {
  let last;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0", accept: "text/html" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { html: await r.text(), finalUrl: r.url || url };
    } catch (e) {
      last = e;
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw last;
}

for (const [sku, url] of SAMPLES) {
  const { html, finalUrl } = await fetchHtml(url);
  const $ = cheerio.load(html, { decodeEntities: false });
  const selectors = {
    fancyboxAnchors: "a[data-fancybox][href]",
    fancyboxImages: "a[data-fancybox] img",
    productImages: ".product-images img",
    productGallery: ".product-gallery img",
    imageGallery: ".image-gallery img",
    productImage: ".product-image img",
    productDetail: ".product_detail img, .product-detail img",
  };
  const report = {};
  for (const [name, selector] of Object.entries(selectors)) report[name] = urlsFrom($, selector, finalUrl);
  const parsed = parseAbmRebuildDetailV2(html, finalUrl, { sku, title: sku, url: finalUrl, kind: "product" });
  report.parserV2 = unique(parsed.images || []);

  console.log(`\n===== ${sku} =====`);
  console.log(`finalUrl=${finalUrl}`);
  for (const [name, urls] of Object.entries(report)) {
    console.log(`${name}: ${urls.length}`);
    urls.forEach((value, i) => console.log(`  ${i + 1}. ${clean(value)}`));
  }
}
