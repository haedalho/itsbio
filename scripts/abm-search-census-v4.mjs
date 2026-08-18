#!/usr/bin/env node
/** ABM official search census v4 — read only, bounded parallel pagination. */
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const BASE='https://www.abmgood.com';
const SEARCH=`${BASE}/search`;
const OUT=path.resolve('.cache/abm-search-census-v4');
const PROJECT_ID=process.env.NEXT_PUBLIC_SANITY_PROJECT_ID||'9b5twpc8';
const DATASET=process.env.NEXT_PUBLIC_SANITY_DATASET||'production';
const API_VERSION=process.env.NEXT_PUBLIC_SANITY_API_VERSION||'2025-01-01';
const CONCURRENCY=6;
const GAP_MS=30;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=v=>String(v||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();

const INCLUDE=[
  'General Materials',
  '3D and Organoid','Microbial Contamination','Cell Immortalization Reagents','Media & Supplements','Growth Factors and Cytokines','Culture Consumables','Cell Assay Products',
  'Cas9 Vectors & Virus','Cas Proteins & CRISPR Screening','Expression Systems','Specialized Vectors','Kits for Viral Vectors',
];
const EXCLUDE=['Cell Library Collections','Expression-Ready Libraries','CRISPR KO Vectors & Virus','CRISPR Activation Vectors'];
const SERVICES=['Cell & Antibody Services','DNA & Cloning Services','Recombinant Virus Packaging'];

function getCookies(h){return typeof h.getSetCookie==='function'?h.getSetCookie():(h.get('set-cookie')?[h.get('set-cookie')]:[])}
function cookieHeader(xs){return xs.map(x=>String(x).split(';',1)[0]).join('; ')}

async function session(){
  const r=await fetch(SEARCH,{cache:'no-store',headers:{'user-agent':'Mozilla/5.0 (compatible; ITSBIO-ABM-Census/4.0)',accept:'text/html'}});
  if(!r.ok) throw new Error(`GET search ${r.status}`);
  const html=await r.text(); const $=cheerio.load(html,{decodeEntities:false}); const form=$('#abm-search-filter-sections-form').first();
  const token=String(form.find("input[name='_token']").val()||''); if(!token) throw new Error('CSRF token not found');
  const filters=[];
  form.find("input[name='fc_ids[]']").each((_,input)=>{
    const $i=$(input), a=$i.closest('a.abm-search-filter-item');
    const title=clean(a.attr('title')||a.find('.abm-search-filter-item-name').clone().children().remove().end().text());
    const count=Number(clean(a.find('.abm-search-filter-item-count').text()).replace(/,/g,''))||0;
    const level=Number(String(a.attr('style')||'').match(/--level:\s*(\d+)/)?.[1]||0);
    filters.push({id:String($i.val()||''),title,count,level});
  });
  const stack=[]; for(const f of filters){while(stack.length>=f.level)stack.pop();f.path=[...stack.map(x=>x.title),f.title];stack.push(f)}
  return {token,cookie:cookieHeader(getCookies(r.headers)),filters};
}

async function post(s,filter,page){
  if(GAP_MS) await sleep(GAP_MS);
  const body=new URLSearchParams(); body.append('_token',s.token);body.append('query','');body.append('search_mode','exact');body.append('fc_ids[]',filter.id);if(page>1)body.append('page',String(page));
  const r=await fetch(SEARCH,{method:'POST',cache:'no-store',headers:{'user-agent':'Mozilla/5.0 (compatible; ITSBIO-ABM-Census/4.0)',accept:'application/json','content-type':'application/x-www-form-urlencoded;charset=UTF-8',cookie:s.cookie,'x-requested-with':'XMLHttpRequest'},body});
  if(!r.ok)throw new Error(`${filter.title} page ${page}: HTTP ${r.status}`);
  const j=await r.json(); return j;
}

function parse(html,filter){
  const $=cheerio.load(`<div>${html||''}</div>`,{decodeEntities:false});const rows=[];
  $('.abm-search-results-item').each((_,el)=>{
    const $el=$(el), a=$el.find('.abm-search-results-item-product_name a[href]').first();
    const title=clean(a.text()),url=String(a.attr('href')||'').trim();let sku='',unit='';
    $el.find('.abm-search-results-item-product_info-row').each((_,r)=>{const l=clean($(r).find('.abm-search-results-item-product_info-label').text()).toLowerCase(),v=clean($(r).find('.abm-search-results-item-product_info-value').text());if(l.includes('cat.no'))sku=v;if(l.startsWith('unit'))unit=v});
    const searchCategory=clean($el.find('.abm-search-results-item-product_category').text());
    if(title&&url)rows.push({title,url,sku,unit,searchCategory,filterId:filter.id,filterTitle:filter.title,filterPath:filter.path});
  });return rows;
}

async function pool(tasks,fn){const out=new Array(tasks.length);let cursor=0;const workers=Array.from({length:Math.min(CONCURRENCY,tasks.length)},async()=>{while(true){const i=cursor++;if(i>=tasks.length)return;out[i]=await fn(tasks[i],i)}});await Promise.all(workers);return out}

async function collect(s,filters){
  const first=[];
  for(const f of filters){const j=await post(s,f,1);const rows=parse(j?.data?.resultHTML,f);const count=Number(j.count||f.count||rows.length);const per=rows.length||10;const pages=Math.max(1,Math.ceil(count/per));first.push({filter:f,count,per,pages,rows});console.log(`[first] ${f.title}: ${rows.length}/${count}, pages=${pages}`)}
  const tasks=[];for(const r of first)for(let p=2;p<=r.pages;p++)tasks.push({filter:r.filter,page:p});
  console.log(`parallel pages: ${tasks.length}, concurrency=${CONCURRENCY}`);
  const rest=await pool(tasks,async(t,i)=>{if(i%100===0)console.log(`page task ${i}/${tasks.length}`);const j=await post(s,t.filter,t.page);return {filter:t.filter,page:t.page,rows:parse(j?.data?.resultHTML,t.filter)}});
  const by=new Map(first.map(x=>[x.filter.id,{...x,allRows:[...x.rows]}]));for(const r of rest)by.get(r.filter.id).allRows.push(...r.rows);
  return [...by.values()].map(x=>({filter:x.filter,count:x.count,pages:x.pages,rows:x.allRows,complete:x.allRows.length===x.count}));
}

function dedupe(rows){const m=new Map();for(const r of rows){const key=r.sku?`sku:${r.sku.toLowerCase()}`:`url:${r.url.toLowerCase()}`;if(!m.has(key))m.set(key,{...r,listingFilters:[{id:r.filterId,title:r.filterTitle,path:r.filterPath}]});else{const e=m.get(key);if(!e.listingFilters.some(x=>x.id===r.filterId))e.listingFilters.push({id:r.filterId,title:r.filterTitle,path:r.filterPath})}}return [...m.values()]}

async function sanity(){const q=`*[_type=="product" && !(_id in path("drafts.**")) && (brandSlug=="abm" || brand->slug.current=="abm" || brand->themeKey=="abm")]{_id,title,sku,sourceUrl}`;const u=new URL(`https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}`);u.searchParams.set('query',q);const r=await fetch(u);if(!r.ok)throw new Error(`Sanity ${r.status}`);return (await r.json()).result||[]}

async function main(){fs.mkdirSync(OUT,{recursive:true});const s=await session();const map=new Map(s.filters.map(x=>[x.title,x]));
  const inc=INCLUDE.map(x=>map.get(x)).filter(Boolean),exc=EXCLUDE.map(x=>map.get(x)).filter(Boolean),svc=SERVICES.map(x=>map.get(x)).filter(Boolean);
  for(const name of [...INCLUDE,...EXCLUDE,...SERVICES])if(!map.has(name))console.warn(`MISSING FILTER: ${name}`);
  const pruns=await collect(s,inc);const sruns=await collect(s,svc);const products=dedupe(pruns.flatMap(x=>x.rows));const services=dedupe(sruns.flatMap(x=>x.rows));const old=await sanity();
  const sku=new Set(old.map(x=>String(x.sku||'').toLowerCase()).filter(Boolean));const url=new Set(old.map(x=>String(x.sourceUrl||'').replace('/../../','/').toLowerCase()).filter(Boolean));
  const missing=products.filter(x=>!(x.sku&&sku.has(x.sku.toLowerCase()))&&!url.has(x.url.toLowerCase()));const existing=products.filter(x=>!missing.includes(x));
  const summary={generatedAt:new Date().toISOString(),sanityWrites:0,products:{facetCountSum:inc.reduce((n,x)=>n+x.count,0),raw:pruns.reduce((n,x)=>n+x.rows.length,0),unique:products.length,alreadyInSanity:existing.length,missingFromSanity:missing.length,incompleteFilters:pruns.filter(x=>!x.complete).map(x=>({title:x.filter.title,count:x.count,got:x.rows.length}))},excludedLargeCatalogs:{facetCountSum:exc.reduce((n,x)=>n+x.count,0),filters:exc.map(x=>({title:x.title,count:x.count,path:x.path}))},services:{facetCountSum:svc.reduce((n,x)=>n+x.count,0),raw:sruns.reduce((n,x)=>n+x.rows.length,0),unique:services.length,incompleteFilters:sruns.filter(x=>!x.complete).map(x=>({title:x.filter.title,count:x.count,got:x.rows.length}))},currentSanityProducts:old.length};
  for(const [n,v] of Object.entries({summary,products,services,missing,existing,filters:s.filters,productRuns:pruns.map(x=>({...x,rows:undefined})),serviceRuns:sruns.map(x=>({...x,rows:undefined}))}))fs.writeFileSync(path.join(OUT,`${n}.json`),JSON.stringify(v,null,2));
  fs.writeFileSync(path.join(OUT,'summary.md'),`# ABM search census v4\n\n- Normal product facet sum: **${summary.products.facetCountSum}**\n- Raw collected: **${summary.products.raw}**\n- Unique normal products: **${summary.products.unique}**\n- Existing in Sanity: **${summary.products.alreadyInSanity}**\n- Missing from Sanity: **${summary.products.missingFromSanity}**\n- Excluded large catalog facet sum: **${summary.excludedLargeCatalogs.facetCountSum}**\n- Unique service results: **${summary.services.unique}**\n- Product incomplete filters: **${summary.products.incompleteFilters.length}**\n- Service incomplete filters: **${summary.services.incompleteFilters.length}**\n- Sanity writes: **0**\n`);
  console.log(JSON.stringify(summary,null,2));if(summary.products.incompleteFilters.length||summary.services.incompleteFilters.length)process.exitCode=2;
}
main().catch(e=>{console.error(e?.stack||e);process.exit(1)});
