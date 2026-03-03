// scripts/abm-refresh-category-1to1.mjs
// -----------------------------------------------------------------------------
// 목적: 특정 ABM 카테고리 페이지 1개를 다시 fetch해서
//      Sanity category 문서(기존)를 1:1로 리프레시(legacyHtml/contentBlocks/path/title).
//
// 사용:
//   node --env-file=.env.local scripts/abm-refresh-category-1to1.mjs --url https://www.abmgood.com/hematopoietic-cells.html
//   node --env-file=.env.local scripts/abm-refresh-category-1to1.mjs --id category-abm-xxxxxxxxxx
// 옵션:
//   --dryRun
// -----------------------------------------------------------------------------

import crypto from 'node:crypto';
import { createClient } from 'next-sanity';
import * as cheerio from 'cheerio';

const argv = process.argv.slice(2);
const hasFlag = (k) => argv.includes(k);
const getArg = (k, fallback = null) => {
  const i = argv.indexOf(k);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  if (!v || v.startsWith('--')) return fallback;
  return v;
};

const URL = String(getArg('--url', '') || '').trim();
const ID = String(getArg('--id', '') || '').trim();
const DRY = hasFlag('--dryRun') || hasFlag('--dry');

const PROJECT_ID = (process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '').trim();
const DATASET = (process.env.NEXT_PUBLIC_SANITY_DATASET || '').trim();
const API_VERSION = (process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2025-01-01').trim();
const TOKEN = (process.env.SANITY_WRITE_TOKEN || '').trim();

if (!PROJECT_ID || !DATASET) throw new Error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET');
if (!TOKEN) throw new Error('Missing SANITY_WRITE_TOKEN');

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: TOKEN,
  useCdn: false,
});

const ABM_BASE = 'https://www.abmgood.com';

const browserHeaders = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9,ko;q=0.8',
  referer: 'https://www.abmgood.com/',
};

function sha1Hex(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex');
}

function normUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  try {
    const x = new URL(s, ABM_BASE);
    x.hash = '';
    x.search = '';
    return x.toString();
  } catch {
    return s;
  }
}

function absUrl(href, baseUrl) {
  const s = String(href || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  try {
    return new URL(s, baseUrl || ABM_BASE).toString();
  } catch {
    return s;
  }
}

function collapseWs(s) {
  return String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripBrandSuffix(title) {
  const t = collapseWs(title);
  const i = t.indexOf('|');
  return (i >= 0 ? t.slice(0, i) : t).trim();
}

function slugFromUrl(u) {
  try {
    const p = new URL(u).pathname;
    const name = (p.split('/').pop() || '').trim();
    return name.replace(/\.html$/i, '').trim();
  } catch {
    return '';
  }
}

function rewriteRelativeUrls(html, baseUrl) {
  if (!html) return '';
  let out = String(html);
  out = out.replace(/\s(href|src)=(["'])(\/(?!\/)[^"']*)\2/gi, (_m, attr, q, p) => {
    return ` ${attr}=${q}${(baseUrl || ABM_BASE).replace(/\/$/, '')}${p}${q}`;
  });
  out = out.replace(/\s(href|src)=(["'])(\/\/[^"']+)\2/gi, (_m, attr, q, p) => {
    return ` ${attr}=${q}https:${p}${q}`;
  });
  return out;
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, { headers: browserHeaders, redirect: 'follow', cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function isCategoryPage($) {
  if ($('#abm-category-right-outer').length) return true;
  if ($('h2.abm-categories-title-h2').length) return true;
  if ($('.abm-categories-text').length) return true;
  return false;
}

function pickRightOuter($) {
  const a = $('#abm-category-right-outer').first();
  if (a.length) return a;
  const b = $('#content').first();
  if (b.length) return b;
  return $('body');
}

function extractTitle($, $root) {
  const t =
    collapseWs($root.find('h2.abm-categories-title-h2').first().text()) ||
    collapseWs($('h2.abm-categories-title-h2').first().text()) ||
    collapseWs($('h1').first().text()) ||
    collapseWs($('title').first().text()) ||
    '';
  return stripBrandSuffix(t);
}

function extractBreadcrumbs($, pageUrl) {
  const crumbs = [];

  const grab = (sel) => {
    $(sel)
      .find('a')
      .each((_, a) => {
        const title = collapseWs($(a).text());
        const href = absUrl($(a).attr('href') || '', pageUrl);
        if (!title) return;
        if (title.toLowerCase() === 'home') return;
        crumbs.push({ title, url: href });
      });
  };

  grab('ul.breadcrumb');
  grab('ol.breadcrumb');
  grab('nav[aria-label="breadcrumb"], nav[aria-label*="breadcrumb" i]');

  const out = [];
  const seen = new Set();

  for (const c of crumbs) {
    const url = c.url ? normUrl(c.url) : '';
    if (url && !/\.html$/i.test(url)) continue;
    const slug = url ? slugFromUrl(url) : '';
    const key = `${c.title}__${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: c.title, url, slug });
  }

  return out;
}

function extractResources($root, baseUrl) {
  const items = [];
  const list = $root.find('ul.htmlcontent-home').first();
  if (!list.length) return items;

  list.find('li').each((i, li) => {
    const $li = $root.find(li).first();
    const a = $li.find('a').first();
    const href = absUrl(a.attr('href') || '', baseUrl);
    if (!href) return;

    const img = $li.find('img').first();
    const imageUrl = absUrl(img.attr('src') || '', baseUrl);

    const title =
      collapseWs($li.find('.abm-category-image-title strong').first().text()) ||
      collapseWs($li.find('strong').first().text()) ||
      collapseWs(img.attr('alt') || '') ||
      '';

    const subtitle = collapseWs($li.find('.abm-category-image-title i').first().text()) || 'Learning Resources';

    if (!title) return;

    items.push({
      _type: 'contentBlockResourceItem',
      _key: `${sha1Hex(`${href}__${i}`).slice(0, 12)}`,
      title,
      subtitle,
      href,
      imageUrl,
    });
  });

  return items;
}

function extractTopPublications($root, baseUrl) {
  const items = [];
  const table = $root
    .find('table')
    .filter((_, el) => $root.find(el).find('.citations-num').length > 0)
    .first();

  if (!table.length) return items;

  table.find('tr').each((i, tr) => {
    const $tr = $root.find(tr).first();
    const noText = collapseWs($tr.find('.citations-num').first().text());
    const order = Number(String(noText).replace(/\D/g, '')) || undefined;

    const tds = $tr.find('td');
    if (tds.length < 2) return;

    const citation = collapseWs(tds.eq(1).text());
    if (!citation) return;

    let doi = '';
    tds.eq(1)
      .find('a')
      .each((_, a) => {
        const href = absUrl($root.find(a).attr('href') || '', baseUrl);
        if (/doi\.org/i.test(href)) doi = href;
      });

    items.push({
      _type: 'contentBlockPublicationItem',
      _key: `${sha1Hex(`${order || i}__${citation}`).slice(0, 12)}`,
      order,
      citation,
      doi,
      product: '',
    });
  });

  return items;
}

function extractMainHtmlBlock($, $root, baseUrl) {
  const work = $root.clone();

  work.find('ul.abm-page-category-nav-list').remove();
  work.find('ul.htmlcontent-home').remove();
  work
    .find('table')
    .filter((_, el) => work.find(el).find('.citations-num').length > 0)
    .remove();

  work.find('script, style').remove();
  work.find('h2.abm-categories-title-h2').first().remove();

  let html = work.html() || '';
  html = rewriteRelativeUrls(html, baseUrl);
  html = html.trim();

  if (collapseWs(html).length < 30) {
    const text = $root.find('.abm-categories-text').first();
    if (text.length) {
      const fb = rewriteRelativeUrls($.html(text), baseUrl).trim();
      if (collapseWs(fb).length >= 30) html = fb;
    }
  }

  return html;
}

async function resolveTargetDoc() {
  if (ID) {
    const d = await sanity.fetch(`*[_type=="category" && _id==$id][0]{_id,sourceUrl,brand->{"slug":slug.current,themeKey}}`, { id: ID });
    if (!d?._id) throw new Error(`Category not found by id=${ID}`);
    return d;
  }

  if (!URL) throw new Error('Provide --url <abm category url> OR --id <categoryId>');

  const u = normUrl(URL);
  const d = await sanity.fetch(
    `*[_type=="category" && defined(sourceUrl) && (sourceUrl==$u || sourceUrl match $uWild)][0]{_id,sourceUrl,brand->{"slug":slug.current,themeKey}}`,
    { u, uWild: u + '*' }
  );
  if (!d?._id) throw new Error(`Category not found by sourceUrl=${u}`);
  return d;
}

async function main() {
  const target = await resolveTargetDoc();
  const pageUrl = normUrl(URL || target.sourceUrl);

  console.log(JSON.stringify({ id: target._id, pageUrl, dryRun: DRY }, null, 2));

  const html = await fetchHtml(pageUrl);
  const $ = cheerio.load(html, { decodeEntities: false });

  if (!isCategoryPage($)) throw new Error('Fetched page does not look like a category page');

  const $root = pickRightOuter($);
  const title = extractTitle($, $root) || slugFromUrl(pageUrl);

  const crumbs = extractBreadcrumbs($, pageUrl);
  const crumbSlugs = crumbs.map((c) => c.slug).filter(Boolean);
  const lastSlug = slugFromUrl(pageUrl);

  let pathArr = crumbSlugs.length ? crumbSlugs : [];
  if (!pathArr.length) pathArr = lastSlug ? [lastSlug] : [];
  if (pathArr[pathArr.length - 1] !== lastSlug && lastSlug) pathArr = [...pathArr, lastSlug];

  const resources = extractResources($root, pageUrl);
  const pubs = extractTopPublications($root, pageUrl);
  const mainHtml = extractMainHtmlBlock($, $root, pageUrl);

  const blocks = [];
  if (mainHtml && collapseWs(mainHtml).length >= 20) {
    blocks.push({
      _type: 'contentBlockHtml',
      _key: sha1Hex(`${pageUrl}__html`).slice(0, 12),
      title: 'Content',
      html: mainHtml,
    });
  }
  if (resources.length) {
    blocks.push({
      _type: 'contentBlockResources',
      _key: sha1Hex(`${pageUrl}__resources`).slice(0, 12),
      title: 'Resources',
      items: resources,
    });
  }
  if (pubs.length) {
    blocks.push({
      _type: 'contentBlockPublications',
      _key: sha1Hex(`${pageUrl}__pubs`).slice(0, 12),
      title: 'Top Publications',
      items: pubs,
    });
  }

  const legacyHtml = rewriteRelativeUrls($.html($root), pageUrl).trim();

  const patch = {
    title,
    sourceUrl: pageUrl,
    path: pathArr,
    legacyHtml,
    contentBlocks: blocks,
  };

  if (DRY) {
    console.log({ status: 'dry-would-patch', id: target._id, title, path: pathArr, blocks: blocks.length });
    return;
  }

  await sanity.patch(target._id).set(patch).commit({ autoGenerateArrayKeys: true });
  console.log({ status: 'patched', id: target._id, title, path: pathArr, blocks: blocks.length });
}

main();