#!/usr/bin/env node
const BASE = "https://www.abmgood.com";
const SEARCH = `${BASE}/search`;
const UA = "Mozilla/5.0 (compatible; ITSBIO-ABM-StableGlobalProbe/1.0)";

function clean(v) { return String(v || "").replace(/\s+/g, " ").trim(); }
function textOnly(html) {
  return clean(String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"'));
}

async function get(url) {
  const response = await fetch(url, { redirect: "follow", headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" } });
  const html = await response.text();
  console.log(`GET ${url} -> ${response.status} bytes=${html.length}`);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return html;
}

function stableCount(html) {
  return html.match(/title=["']Stable Cell Lines["'][\s\S]{0,500}?abm-search-filter-item-count[^>]*>\s*([\d,]+)/i)?.[1] || "";
}

function skusFromHtml(html) {
  const text = textOnly(html);
  return [...text.matchAll(/Cat\.\s*No\.\s*:\s*([A-Za-z0-9][A-Za-z0-9._-]*)/gi)].map((m) => m[1]);
}

const root = await get(SEARCH);
const count = stableCount(root);
const fcId = root.match(/title=["']Stable Cell Lines["'][\s\S]{0,900}?name=["']fc_ids\[\]["'][^>]+value=["']([^"']+)/i)?.[1] || "";
console.log(`STABLE_FILTER_META=${JSON.stringify({ count, fcId })}`);

for (const page of [1, 2, 3, 50, 100, 110, 111, 112]) {
  const params = new URLSearchParams();
  params.append("fc_ids[]", "25");
  if (page > 1) params.set("page", String(page));
  const url = `${SEARCH}?${params.toString()}`;
  const html = await get(url);
  const skus = skusFromHtml(html);
  const loadMoreHits = (html.match(/Load more/gi) || []).length;
  const pageMatches = [...html.matchAll(/(?:data-page|page)[=\"': ]+([0-9]+)/gi)].slice(-15).map((m) => m[1]);
  console.log(`PAGE_META=${JSON.stringify({ page, stableCount: stableCount(html), skuCount: skus.length, skus, loadMoreHits, pageMatches })}`);
  const marker = html.search(/Cat\.\s*No\.?/i);
  if (marker >= 0 && page <= 2) console.log(`CATNO_SNIPPET_${page}=${clean(html.slice(Math.max(0, marker - 1200), marker + 2200))}`);
}
