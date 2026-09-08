#!/usr/bin/env node
const BASE = "https://www.abmgood.com";
const SEARCH = `${BASE}/search`;
const UA = "Mozilla/5.0 (compatible; ITSBIO-ABM-StableGlobalProbe/1.0)";

function clean(v) { return String(v || "").replace(/\s+/g, " ").trim(); }
function abs(v, base = SEARCH) { try { return new URL(v, base).toString(); } catch { return ""; } }

async function get(url, headers = {}) {
  const response = await fetch(url, { redirect: "follow", headers: { "user-agent": UA, accept: "text/html,*/*", ...headers } });
  const text = await response.text();
  console.log(`GET ${url} -> ${response.status} bytes=${text.length}`);
  return { response, text };
}

const first = await get(SEARCH);
const html = first.text;
const count = html.match(/title=["']Stable Cell Lines["'][\s\S]{0,500}?abm-search-filter-item-count[^>]*>\s*([\d,]+)/i)?.[1] || "";
const input = html.match(/title=["']Stable Cell Lines["'][\s\S]{0,900}?name=["']fc_ids\[\]["'][^>]+value=["']([^"']+)/i)?.[1] || "";
console.log(`STABLE_FILTER_META=${JSON.stringify({ count, fcId: input })}`);

const scriptSrcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)].map((m) => abs(m[1])).filter(Boolean);
console.log(`SCRIPT_SRCS=${scriptSrcs.length}`);
for (const src of scriptSrcs) {
  if (!/abm|search|pub|app|main|catalog/i.test(src)) continue;
  try {
    const { text } = await get(src, { accept: "application/javascript,text/javascript,*/*" });
    const lower = text.toLowerCase();
    const needles = ["searchapi", "searchproducts", "fc_ids", "fetch(", "/product/", "loadmore", "load more"];
    for (const needle of needles) {
      let at = 0; let shown = 0;
      while ((at = lower.indexOf(needle.toLowerCase(), at)) >= 0 && shown < 5) {
        console.log(`JS_HIT src=${src} needle=${needle} at=${at}`);
        console.log(clean(text.slice(Math.max(0, at - 900), Math.min(text.length, at + 1800))));
        at += needle.length; shown += 1;
      }
    }
  } catch (error) {
    console.log(`JS_ERROR ${src}: ${error?.message || error}`);
  }
}

for (const url of [
  `${SEARCH}?fc_ids%5B%5D=25`,
  `${SEARCH}?fc_ids[]=25`,
  `${SEARCH}?filter_id=63`,
]) {
  const { text } = await get(url);
  const stableCount = text.match(/title=["']Stable Cell Lines["'][\s\S]{0,500}?abm-search-filter-item-count[^>]*>\s*([\d,]+)/i)?.[1] || "";
  const productCards = (text.match(/abm-search-result-item|search-result-item|View Product/gi) || []).length;
  console.log(`FILTERED_PAGE_META=${JSON.stringify({ url, stableCount, productCards, title: clean(text.match(/<title>([\s\S]*?)<\/title>/i)?.[1]) })}`);
}
