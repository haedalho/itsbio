// scripts/abm-audit-and-scrape-missing-categories.mjs
// -----------------------------------------------------------------------------
// 목적:
//  1) ABM 카테고리 페이지(All Products 메뉴)의 .html 링크를 BFS로 수집
//  2) Sanity의 category(sourceUrl)와 비교해서 누락된 페이지를 찾음
//  3) 누락된 카테고리는 ABM에서 페이지를 fetch해서
//     - title, breadcrumbs 기반 path
//     - legacyHtml
//     - contentBlocks(HTML/Resources/Top Publications)
//     를 생성해 Sanity에 upsert
//
// 사용 예:
//   node --env-file=.env.local scripts/abm-audit-and-scrape-missing-categories.mjs --brand abm
//   node --env-file=.env.local scripts/abm-audit-and-scrape-missing-categories.mjs --seed https://www.abmgood.com/cellular-materials.html
//
// 옵션:
//   --brand abm
//   --seed <url>               : 수집 시작 페이지(여러 개면 콤마)
//   --maxPages 200             : fetch 최대 페이지 수(수집용)
//   --limit 30                 : 생성/패치 최대 개수
//   --dryRun                   : Sanity 커밋 안 함
//   --onlyIfEmpty              : 기존 category가 있어도 contentBlocks가 비어있을 때만 패치
// -----------------------------------------------------------------------------

import crypto from 'node:crypto';
import { createClient } from 'next-sanity';
import * as cheerio from 'cheerio';

// ---------------- args ----------------
const argv = process.argv.slice(2);
const hasFlag = (k) => argv.includes(k);
const getArg = (k, fallback = null) => {
  const i = argv.indexOf(k);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  if (!v || v.startsWith('--')) return fallback;
  return v;
};

const BRAND = String(getArg('--brand', 'abm') || 'abm').trim().toLowerCase();
const SEED_RAW = String(getArg('--seed', '') || '').trim();
const DRY = hasFlag('--dryRun') || hasFlag('--dry');
const ONLY_IF_EMPTY = hasFlag('--onlyIfEmpty') || hasFlag('--only-if-empty');

const MAX_PAGES = Number(getArg('--maxPages', '200') || '200') || 200;
const LIMIT = Number(getArg('--limit', '0') || '0') || 0;

// ---------------- sanity client ----------------
const PROJECT_ID = (process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '').trim();
const DATASET = (process.env.NEXT_PUBLIC_SANITY_DATASET || '').trim();
const API_VERSION = (process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2025-01-01').trim();
const TOKEN = (process.env.SANITY_WRITE_TOKEN || '').trim();

if (!PROJECT_ID || !DATASET) throw new Error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET');
if (!TOKEN) throw new Error('Missing SANITY_WRITE_TOKEN (write permission needed)');

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: TOKEN,
  useCdn: false,
});

// ---------------- constants ----------------
const ABM_BASE = 'https://www.abmgood.com';

const browserHeaders = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9,ko;q=0.8',
  referer: 'https://www.abmgood.com/',
};

// ---------------- utils ----------------
function sha1Hex(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex');
}

function normUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  try {
    const x = new URL(s, ABM_BASE);
    x.hash = '';
    // query 제거(카테고리 페이지는 보통 불필요)
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
  // ABM 카테고리 페이지 특징
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

  // url이 .html인 crumb만 남김(카테고리)
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

function extractTopPublications($, $root, baseUrl) {
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

  // 상단 카테고리 네비 리스트 제거
  work.find('ul.abm-page-category-nav-list').remove();

  // Resource/Top Publications 영역 제거(따로 블록으로 넣을 거라)
  work.find('ul.htmlcontent-home').remove();
  work
    .find('table')
    .filter((_, el) => work.find(el).find('.citations-num').length > 0)
    .remove();

  // 스크립트 제거
  work.find('script, style').remove();

  // 제목(h2)은 페이지 타이틀로 쓰니 본문에서 제거
  work.find('h2.abm-categories-title-h2').first().remove();

  let html = work.html() || '';
  html = rewriteRelativeUrls(html, baseUrl);
  html = html.trim();

  // 너무 짧으면 .abm-categories-text만이라도
  if (collapseWs(html).length < 30) {
    const text = $root.find('.abm-categories-text').first();
    if (text.length) {
      const fb = rewriteRelativeUrls($.html(text), baseUrl).trim();
      if (collapseWs(fb).length >= 30) html = fb;
    }
  }

  return html;
}

function findCategoryLinksFromMenu($, baseUrl) {
  const out = new Set();

  const add = (href) => {
    const u = normUrl(absUrl(href, baseUrl));
    if (!u) return;
    if (!/\.html$/i.test(u)) return;
    // product page도 .html이지만, 여기서는 일단 다 수집하고 나중에 categoryPage로만 걸러냄
    out.add(u);
  };

  // ABM 카테고리 페이지에서 자주 보이는 메뉴
  $('ul.abm-page-category-nav-list a[href]').each((_, a) => add($(a).attr('href')));

  // 다른 메뉴 케이스 대응: left nav / sidebar 안의 .html 링크
  $('#abm-category-left-outer a[href], #abm-category-left-nav a[href], .abm-category-left a[href]').each((_, a) => add($(a).attr('href')));

  return [...out];
}

function computeCategoryId(url) {
  // 기존 id 패턴(category-abm-xxxxxxxxxx)과 맞추기
  const h = sha1Hex(normUrl(url)).slice(0, 10);
  return `category-${BRAND}-${h}`;
}

async function ensureBrandRef() {
  const b = await sanity.fetch(
    `*[_type=="brand" && (slug.current==$brand || themeKey==$brand)][0]{_id, title, "slug": slug.current}`,
    { brand: BRAND }
  );
  if (!b?._id) throw new Error(`Brand doc not found for brand=${BRAND}`);
  return { _id: b._id, ref: { _type: 'reference', _ref: b._id } };
}

async function fetchExistingCategories() {
  const rows = await sanity.fetch(
    `*[_type=="category" && (brand->slug.current==$brand || brand->themeKey==$brand || themeKey==$brand || brandSlug==$brand)]{
      _id, title, sourceUrl, path,
      "blocksCount": count(contentBlocks),
      "legacyLen": length(legacyHtml)
    }`,
    { brand: BRAND }
  );

  const byUrl = new Map();
  const byPathStr = new Map();
  const meta = new Map();

  for (const r of rows || []) {
    const u = normUrl(r?.sourceUrl || '');
    if (u) byUrl.set(u, r._id);
    const pathArr = Array.isArray(r?.path) ? r.path : [];
    const ps = pathArr.length ? pathArr.join('/') : '';
    if (ps) byPathStr.set(ps, r._id);
    meta.set(r._id, r);
  }

  return { rows, byUrl, byPathStr, meta };
}

async function buildSeedsFromSanity() {
  // Sanity에 있는 root category(count(path)==1) sourceUrl을 seed로 사용
  const roots = await sanity.fetch(
    `*[_type=="category" && (brand->slug.current==$brand || brand->themeKey==$brand || themeKey==$brand || brandSlug==$brand) && count(path)==1 && defined(sourceUrl)]|order(order asc, title asc){sourceUrl}`,
    { brand: BRAND }
  );
  return (roots || [])
    .map((r) => normUrl(r?.sourceUrl || ''))
    .filter(Boolean);
}

async function upsertCategoryFromUrl(url, brandRef, existing) {
  const pageUrl = normUrl(url);
  const html = await fetchHtml(pageUrl);
  const $ = cheerio.load(html, { decodeEntities: false });

  if (!isCategoryPage($)) {
    return { status: 'skip-not-category', url: pageUrl };
  }

  const $root = pickRightOuter($);
  const title = extractTitle($, $root) || slugFromUrl(pageUrl);

  const crumbs = extractBreadcrumbs($, pageUrl);
  const crumbSlugs = crumbs.map((c) => c.slug).filter(Boolean);
  const lastSlug = slugFromUrl(pageUrl);

  // path 만들기
  let pathArr = crumbSlugs.length ? crumbSlugs : [];
  if (!pathArr.length) pathArr = lastSlug ? [lastSlug] : [];
  if (pathArr[pathArr.length - 1] !== lastSlug && lastSlug) pathArr = [...pathArr, lastSlug];

  // parent 찾기
  const parentPath = pathArr.slice(0, -1);
  const parentStr = parentPath.join('/');
  const parentId = parentStr ? existing.byPathStr.get(parentStr) : '';

  // contentBlocks
  const resources = extractResources($root, pageUrl);
  const pubs = extractTopPublications($, $root, pageUrl);
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

  const existingId = existing.byUrl.get(pageUrl);
  const targetId = existingId || computeCategoryId(pageUrl);

  // onlyIfEmpty 옵션
  if (existingId && ONLY_IF_EMPTY) {
    const m = existing.meta.get(existingId);
    const blocksCount = Number(m?.blocksCount || 0);
    if (blocksCount > 0) {
      return { status: 'skip-existing-not-empty', id: existingId, url: pageUrl };
    }
  }

  const doc = {
    _id: targetId,
    _type: 'category',
    title,
    brand: brandRef.ref,
    path: pathArr,
    parent: parentId ? { _type: 'reference', _ref: parentId } : undefined,
    themeKey: BRAND,
    sourceUrl: pageUrl,
    legacyHtml,
    contentBlocks: blocks,
    order: 0,
  };

  if (DRY) {
    return { status: existingId ? 'dry-would-patch' : 'dry-would-create', id: targetId, url: pageUrl, path: pathArr };
  }

  if (existingId) {
    // patch existing
    const patch = {
      title,
      path: pathArr,
      parent: parentId ? { _type: 'reference', _ref: parentId } : undefined,
      sourceUrl: pageUrl,
      legacyHtml,
      contentBlocks: blocks,
    };
    await sanity.patch(existingId).set(patch).commit({ autoGenerateArrayKeys: true });
    return { status: 'patched', id: existingId, url: pageUrl, path: pathArr };
  }

  // createIfNotExists
  await sanity.createIfNotExists(doc);
  return { status: 'created', id: targetId, url: pageUrl, path: pathArr };
}

async function main() {
  const brandRef = await ensureBrandRef();
  const existing = await fetchExistingCategories();

  let seeds = [];
  if (SEED_RAW) {
    seeds = SEED_RAW.split(',').map((s) => normUrl(s)).filter(Boolean);
  } else {
    seeds = await buildSeedsFromSanity();
  }

  if (!seeds.length) {
    // 최후 fallback
    seeds = [
      `${ABM_BASE}/general-materials.html`,
      `${ABM_BASE}/cellular-materials.html`,
      `${ABM_BASE}/genetic-materials.html`,
    ].map(normUrl);
  }

  console.log(JSON.stringify({ brand: BRAND, dryRun: DRY, onlyIfEmpty: ONLY_IF_EMPTY, maxPages: MAX_PAGES, seedCount: seeds.length, existingCategories: existing.rows.length }, null, 2));

  // BFS 수집
  const visited = new Set();
  const queue = [...seeds];
  const discovered = new Set(seeds);

  let fetched = 0;

  while (queue.length && fetched < MAX_PAGES) {
    const url = queue.shift();
    const u = normUrl(url);
    if (!u || visited.has(u)) continue;
    visited.add(u);

    try {
      const html = await fetchHtml(u);
      fetched++;

      const $ = cheerio.load(html, { decodeEntities: false });
      const links = findCategoryLinksFromMenu($, u);

      for (const l of links) {
        if (!discovered.has(l)) {
          discovered.add(l);
          queue.push(l);
        }
      }

      // 진행 로그(너무 시끄럽지 않게)
      if (fetched % 10 === 0) {
        console.log(`crawl: fetched=${fetched} discovered=${discovered.size} queue=${queue.length}`);
      }
    } catch (e) {
      console.warn(`crawl fail: ${u} :: ${e?.message || e}`);
    }
  }

  const allUrls = [...discovered];
  const missing = allUrls.filter((u) => !existing.byUrl.has(normUrl(u)));

  console.log(JSON.stringify({ crawledPages: fetched, discoveredUrls: allUrls.length, missing: missing.length }, null, 2));

  // 누락 생성/패치
  let done = 0;
  let created = 0;
  let patched = 0;
  let skipped = 0;
  let failed = 0;

  const targets = LIMIT ? missing.slice(0, LIMIT) : missing;

  for (const u of targets) {
    try {
      const res = await upsertCategoryFromUrl(u, brandRef, existing);
      done++;
      if (res.status === 'created') created++;
      else if (res.status === 'patched') patched++;
      else skipped++;

      // upsert 후 existing 맵 갱신(다음 parent 연결 위해)
      if (res?.id && res?.url && (res.status === 'created' || res.status === 'patched')) {
        existing.byUrl.set(normUrl(res.url), res.id);
        if (Array.isArray(res.path) && res.path.length) {
          existing.byPathStr.set(res.path.join('/'), res.id);
        }
      }

      console.log(res);
    } catch (e) {
      failed++;
      console.error(`! upsert fail: ${u} :: ${e?.message || e}`);
    }
  }

  console.log(JSON.stringify({ done, created, patched, skipped, failed }, null, 2));
}

main();