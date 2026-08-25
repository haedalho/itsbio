#!/usr/bin/env node
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const cheerio = require("cheerio");

const url = "https://www.thistlescientific.com/product/microdoc-gel-documentation-hood-with-screen/?attribute_pa_item=microdoc-system-with-254-365nm-uv-transilluminator-analysis-software";
const response = await fetch(url, {
  headers: {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
    "Accept-Language": "en-GB,en;q=0.9",
  },
  redirect: "follow",
  signal: AbortSignal.timeout(60000),
});
console.log(JSON.stringify({ status: response.status, finalUrl: response.url, type: response.headers.get("content-type") }));
if (!response.ok) process.exit(1);
const html = await response.text();
const $ = cheerio.load(html);
const wanted = [/^overview\+?$/i,/^specifications?\+?$/i,/^what['’]?s included\+?$/i,/^documents?\+?$/i,/^all variations\+?$/i,/^accessories\+?$/i];
const matches = [];
$("body *").each((_, node) => {
  const text = $(node).clone().children().remove().end().text().replace(/\s+/g," ").trim();
  if (!wanted.some((rx) => rx.test(text))) return;
  const el = $(node);
  const parent = el.parent();
  matches.push({
    tag: node.tagName,
    text,
    cls: el.attr("class") || "",
    id: el.attr("id") || "",
    parentTag: parent[0]?.tagName || "",
    parentClass: parent.attr("class") || "",
    parentId: parent.attr("id") || "",
    parentHtml: (parent.html() || "").slice(0, 6000),
  });
});
console.log(JSON.stringify({ htmlBytes: html.length, title: $("title").text(), matches }, null, 2));