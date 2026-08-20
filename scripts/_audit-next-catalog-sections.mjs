#!/usr/bin/env node
import fs from 'node:fs';

const projectId='9b5twpc8';
const dataset='production';
const apiVersion='2025-02-19';
const base=`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`;
async function q(query, params={}) {
  const usp = new URLSearchParams({query});
  for (const [k,v] of Object.entries(params)) usp.set(`$${k}`, JSON.stringify(v));
  const r = await fetch(`${base}?${usp.toString()}`, {headers:{accept:'application/json'}});
  if(!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()).result;
}

const kentPaths = [
  ['physiological-monitoring','physiological-monitoring-accessories'],
  ['noninvasive-blood-pressure','noninvasive-blood-pressure-accessories','accessories-for-coda-monitor'],
  ['noninvasive-blood-pressure','noninvasive-blood-pressure-accessories'],
  ['surgery','surgical-instruments'],
  ['surgery','surgical-accessories'],
];

const kent = [];
for (const path of kentPaths) {
  const pathStr = path.join('/');
  const category = await q(`*[_type=="category" && (!defined(isActive)||isActive==true) && (brandSlug=="kent" || themeKey=="kent" || brand->themeKey=="kent" || brand->slug.current=="kent") && array::join(path,"/")==$pathStr][0]{_id,title,path,summary,sourceUrl,pageType,legacyHtml,contentBlocks,blocks}`, {pathStr});
  const products = await q(`*[_type=="product" && (!defined(isActive)||isActive==true) && (brandSlug=="kent" || brand->themeKey=="kent" || brand->slug.current=="kent") && (categoryPath==$path || $pathStr in listingPaths)]|order(title asc){_id,title,sku,"slug":slug.current,categoryPath,listingPaths,sourceUrl,"imageCount":count(images)}`, {path, pathStr});
  const descendants = await q(`*[_type=="category" && (!defined(isActive)||isActive==true) && (brandSlug=="kent" || themeKey=="kent" || brand->themeKey=="kent" || brand->slug.current=="kent") && count(path)>$depth && path[0...$depth]==$path]|order(path asc){title,path,summary,sourceUrl}`, {path, depth:path.length});
  kent.push({path,pathStr,category,productCount:products.length,products:products.slice(0,60),descendantCount:descendants.length,descendants:descendants.slice(0,40)});
}

const abmRecords = await q(`*[_type=="abmRebuildChunk" && version=="2026-08-09-search-v5" && kind=="product"].records[]{sku,title,searchCategory,filterTitle,filterPath,listingFilters,hasDetail}`);
const norm = v=>String(v||'').replace(/&/g,'and').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase();
const cellular = (abmRecords||[]).filter(r=>{
  const vals=[r.filterTitle,...(r.filterPath||[]),...(r.listingFilters||[]).flatMap(f=>[f?.title,...(f?.path||[])])].filter(Boolean).map(norm);
  return vals.includes('cellular materials');
});
const cats = new Map();
for (const r of cellular) {
  const labels=[r.searchCategory, ...(r.listingFilters||[]).map(f=>f?.title)].filter(Boolean);
  for (const label of labels) {
    const key=String(label).trim(); if(!key || norm(key)==='cellular materials') continue;
    cats.set(key,(cats.get(key)||0)+1);
  }
}
const cellularCategories=[...cats.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));

const out={generatedAt:new Date().toISOString(),kent,cellular:{count:cellular.length,detailReady:cellular.filter(r=>r.hasDetail).length,categoryCounts:cellularCategories,examples:cellular.slice(0,80)}};
fs.writeFileSync('data/_next-catalog-sections-audit-temp.json',JSON.stringify(out,null,2)+'\n');
const summary={
  generatedAt: out.generatedAt,
  kent: kent.map(x=>({
    path:x.pathStr,
    title:x.category?.title||null,
    hasSummary:Boolean(String(x.category?.summary||'').trim()),
    hasStructuredBlocks:Boolean((x.category?.contentBlocks?.length||0)||(x.category?.blocks?.length||0)),
    hasLegacyHtml:Boolean(String(x.category?.legacyHtml||'').trim()),
    productCount:x.productCount,
    productSamples:x.products.slice(0,12).map(p=>({title:p.title,sku:p.sku,slug:p.slug,imageCount:p.imageCount})),
    descendantCount:x.descendantCount,
    descendants:x.descendants.slice(0,20).map(d=>({title:d.title,path:(d.path||[]).join('/')})),
  })),
  cellular:{
    count:out.cellular.count,
    detailReady:out.cellular.detailReady,
    missingDetail:out.cellular.count-out.cellular.detailReady,
    topCategories:cellularCategories.slice(0,30),
    examples:cellular.slice(0,20).map(r=>({title:r.title,sku:r.sku,searchCategory:r.searchCategory,filterTitle:r.filterTitle,hasDetail:r.hasDetail}))
  }
};
fs.writeFileSync('data/_next-catalog-sections-audit-summary-temp.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
