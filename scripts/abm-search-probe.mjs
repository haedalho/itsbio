#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const BASE = "https://www.abmgood.com";
const OUT = path.resolve(".cache/abm-search-probe");
fs.mkdirSync(OUT, { recursive: true });

const urls = [`${BASE}/search`, `${BASE}/index.php/search?page=2`];

async function fetchHtml(url) {
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; ITSBIO-ABM-SearchProbe/1.0)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return await res.text();
}

function clean(v) { return String(v || "").replace(/\s+/g, " ").trim(); }
function abs(v, base) { try { return new URL(v, base).toString(); } catch { return ""; } }

for (const url of urls) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html, { decodeEntities: false });
  const key = url.includes("page=2") ? "page2" : "search";
  fs.writeFileSync(path.join(OUT, `${key}.html`), html);

  const forms = [];
  $("form").each((i, form) => {
    const $f = $(form);
    const controls = [];
    $f.find("input,select,button").each((_, el) => {
      const $el = $(el);
      controls.push({
        tag: el.tagName,
        type: $el.attr("type") || "",
        name: $el.attr("name") || "",
        value: $el.attr("value") || "",
        id: $el.attr("id") || "",
        class: $el.attr("class") || "",
        text: clean($el.text()),
        checked: $el.is(":checked"),
      });
    });
    forms.push({
      index: i,
      action: abs($f.attr("action") || url, url),
      method: ($f.attr("method") || "GET").toUpperCase(),
      id: $f.attr("id") || "",
      class: $f.attr("class") || "",
      controls,
    });
  });

  const interestingLinks = [];
  $("a[href]").each((_, a) => {
    const $a = $(a);
    const href = abs($a.attr("href"), url);
    const label = clean($a.text() || $a.attr("title"));
    if (!href) return;
    if (/search|page=|categor|filter|load|general|cellular|genetic|antibod|growth|media|crispr|service/i.test(`${href} ${label}`)) {
      interestingLinks.push({ label, href, class: $a.attr("class") || "", id: $a.attr("id") || "" });
    }
  });

  const dataAttrs = [];
  $("[data-category],[data-id],[data-url],[data-href],[data-page],[data-filter],[data-value]").each((_, el) => {
    const $el = $(el);
    const rec = { tag: el.tagName, text: clean($el.text()).slice(0, 120) };
    for (const name of ["data-category","data-id","data-url","data-href","data-page","data-filter","data-value","class","id"]) {
      if ($el.attr(name) != null) rec[name] = $el.attr(name);
    }
    dataAttrs.push(rec);
  });

  const scripts = [];
  $("script").each((_, s) => {
    const src = $(s).attr("src");
    const body = $(s).html() || "";
    if (src || /search|filter|load.more|ajax|category/i.test(body)) {
      scripts.push({ src: src ? abs(src, url) : "", body: src ? "" : body.slice(0, 12000) });
    }
  });

  const report = {
    url,
    title: clean($("title").text()),
    forms,
    interestingLinks: interestingLinks.slice(0, 2000),
    dataAttrs: dataAttrs.slice(0, 3000),
    scripts: scripts.slice(0, 100),
  };
  fs.writeFileSync(path.join(OUT, `${key}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ key, forms: forms.length, links: interestingLinks.length, dataAttrs: dataAttrs.length, scripts: scripts.length }, null, 2));
}
