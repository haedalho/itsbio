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
  kent.push({path,pathStr,category,productCount:products.length,products:products.slice(0,60)});
}

const abmRecords = await q(`*[_type=="abmRebuildChunk" && version=="2026-08-09-search-v5" && kind=="product"].records[]{sku,title,url,searchCategory,filterTitle,filterPath,listingFilters,hasDetail}`);
const detailKeys = await q(`*[_type=="abmRebuildDetailChunk" && version=="2026-08-09-search-v5" && kind=="product"].records[].key`);
const detailSet = new Set((detailKeys||[]).map(v=>String(v||'').toLowerCase()));
const abmCategoryDocs = await q(`*[_type=="category" && (!defined(isActive)||isActive==true) && (brandSlug=="abm" || themeKey=="abm" || brand->themeKey=="abm" || brand->slug.current=="abm") && defined(path) && path[0]=="cellular-materials"]|order(count(path) asc, order asc, title asc){_id,title,path,summary,sourceUrl}`);
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
const cellularDetailReady=cellular.filter(r=>detailSet.has(`product:${String(r.sku||r.url||'').trim().toLowerCase()}`));

const out={generatedAt:new Date().toISOString(),kent,cellular:{count:cellular.length,detailReady:cellularDetailReady.length,categoryCounts:cellularCategories,categoryDocs:abmCategoryDocs,examples:cellular.slice(0,80)}};
fs.writeFileSync('data/_next-catalog-sections-audit-temp.json',JSON.stringify(out,null,2)+'\n');
const summary={
  generatedAt: out.generatedAt,
  kent: kent.map(x=>({path:x.pathStr,title:x.category?.title||null,hasSummary:Boolean(String(x.category?.summary||'').trim()),hasStructuredBlocks:Boolean((x.category?.contentBlocks?.length||0)||(x.category?.blocks?.length||0)),hasLegacyHtml:Boolean(String(x.category?.legacyHtml||'').trim()),productCount:x.productCount,productSamples:x.products.slice(0,12).map(p=>({title:p.title,sku:p.sku,slug:p.slug,imageCount:p.imageCount}))})),
  cellular:{
    count:cellular.length,
    detailReady:cellularDetailReady.length,
    missingDetail:cellular.length-cellularDetailReady.length,
    categoryDocCount:(abmCategoryDocs||[]).length,
    categoryDocs:(abmCategoryDocs||[]).slice(0,80).map(c=>({title:c.title,path:(c.path||[]).join('/'),hasSummary:Boolean(String(c.summary||'').trim())})),
    topCategories:cellularCategories.slice(0,40),
    examples:cellular.slice(0,20).map(r=>({title:r.title,sku:r.sku,searchCategory:r.searchCategory,filterTitle:r.filterTitle,detailReady:detailSet.has(`product:${String(r.sku||r.url||'').trim().toLowerCase()}`)}))
  }
};
fs.writeFileSync('data/_next-catalog-sections-audit-summary-temp.json',JSON.stringify(summary,null,2)+'\n');
const categoryMap=(abmCategoryDocs||[]).map(c=>`${(c.path||[]).join('/')}\t${c.title}\t${String(c.summary||'').trim()?'summary':'no-summary'}`).join('\n')+'\n';
fs.writeFileSync('data/_cellular-category-map-temp.txt',categoryMap);
console.log(JSON.stringify(summary,null,2));
