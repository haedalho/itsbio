#!/usr/bin/env node
// Read-only ABM search census. Two workers + 429 backoff to respect the official search service.
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const BASE='https://www.abmgood.com', SEARCH=`${BASE}/search`, OUT=path.resolve('.cache/abm-search-census-v5');
const PROJECT=process.env.NEXT_PUBLIC_SANITY_PROJECT_ID||'9b5twpc8', DATASET=process.env.NEXT_PUBLIC_SANITY_DATASET||'production', API=process.env.NEXT_PUBLIC_SANITY_API_VERSION||'2025-01-01';
const INCLUDE=['General Materials','3D and Organoid','Microbial Contamination','Cell Immortalization Reagents','Media & Supplements','Growth Factors and Cytokines','Culture Consumables','Cell Assay Products','Cas9 Vectors & Virus','Cas Proteins & CRISPR Screening','Expression Systems','Specialized Vectors','Kits for Viral Vectors'];
const EXCLUDE=['Cell Library Collections','Expression-Ready Libraries','CRISPR KO Vectors & Virus','CRISPR Activation Vectors'];
const SERVICES=['Cell & Antibody Services','DNA & Cloning Services','Recombinant Virus Packaging'];
const clean=v=>String(v||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim(), sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function getSession(){
  const r=await fetch(SEARCH,{cache:'no-store',headers:{'user-agent':'Mozilla/5.0 (compatible; ITSBIO-ABM-Census/5.0)',accept:'text/html'}}); if(!r.ok)throw new Error(`GET ${r.status}`);
  const html=await r.text(), $=cheerio.load(html,{decodeEntities:false}), form=$('#abm-search-filter-sections-form').first(), token=String(form.find("input[name='_token']").val()||''); if(!token)throw new Error('token missing');
  const cookies=(typeof r.headers.getSetCookie==='function'?r.headers.getSetCookie():[r.headers.get('set-cookie')||'']).map(x=>String(x).split(';',1)[0]).filter(Boolean).join('; '), filters=[];
  form.find("input[name='fc_ids[]']").each((_,el)=>{const i=$(el),a=i.closest('a.abm-search-filter-item'),title=clean(a.attr('title')||a.find('.abm-search-filter-item-name').clone().children().remove().end().text()),count=Number(clean(a.find('.abm-search-filter-item-count').text()).replace(/,/g,''))||0,level=Number(String(a.attr('style')||'').match(/--level:\s*(\d+)/)?.[1]||0);filters.push({id:String(i.val()||''),title,count,level})});
  const stack=[];for(const f of filters){while(stack.length>=f.level)stack.pop();f.path=[...stack.map(x=>x.title),f.title];stack.push(f)} return {token,cookies,filters};
}

async function searchPage(s,f,page){
  for(let attempt=0;attempt<6;attempt++){
    await sleep(160);
    const body=new URLSearchParams({_token:s.token,query:'',search_mode:'exact'});body.append('fc_ids[]',f.id);if(page>1)body.append('page',String(page));
    const r=await fetch(SEARCH,{method:'POST',cache:'no-store',headers:{'user-agent':'Mozilla/5.0 (compatible; ITSBIO-ABM-Census/5.0)',accept:'application/json','content-type':'application/x-www-form-urlencoded;charset=UTF-8',cookie:s.cookies,'x-requested-with':'XMLHttpRequest'},body});
    if(r.status===429){const retry=Number(r.headers.get('retry-after')||0);await sleep(Math.max(retry*1000,1500*(attempt+1)));continue}
    if(!r.ok)throw new Error(`${f.title} page=${page} HTTP ${r.status}`);return await r.json();
  } throw new Error(`${f.title} page=${page} repeated 429`);
}

function parse(html,f){const $=cheerio.load(`<div>${html||''}</div>`,{decodeEntities:false}),out=[];$('.abm-search-results-item').each((_,el)=>{const e=$(el),a=e.find('.abm-search-results-item-product_name a[href]').first(),title=clean(a.text()),url=String(a.attr('href')||'').trim();let sku='',unit='';e.find('.abm-search-results-item-product_info-row').each((_,r)=>{const l=clean($(r).find('.abm-search-results-item-product_info-label').text()).toLowerCase(),v=clean($(r).find('.abm-search-results-item-product_info-value').text());if(l.includes('cat.no'))sku=v;if(l.startsWith('unit'))unit=v});if(title&&url)out.push({title,url,sku,unit,searchCategory:clean(e.find('.abm-search-results-item-product_category').text()),filterId:f.id,filterTitle:f.title,filterPath:f.path})});return out}

async function workerPool(tasks,fn){const out=new Array(tasks.length);let cursor=0;await Promise.all(Array.from({length:Math.min(2,tasks.length)},async()=>{while(true){const i=cursor++;if(i>=tasks.length)return;out[i]=await fn(tasks[i],i)}}));return out}

async function collect(s,filters){
  const runs=[];
  for(const f of filters){const j=await searchPage(s,f,1),rows=parse(j?.data?.resultHTML,f),count=Number(j.count||f.count||rows.length),pages=Math.max(1,Math.ceil(count/(rows.length||10)));runs.push({filter:f,count,pages,rows:[...rows]});console.log(`[first] ${f.title}: ${rows.length}/${count} pages=${pages}`)}
  const tasks=[];for(const r of runs)for(let page=2;page<=r.pages;page++)tasks.push({f:r.filter,page});console.log(`remaining pages=${tasks.length}; workers=2`);
  const rest=await workerPool(tasks,async(t,i)=>{if(i%100===0)console.log(`page ${i}/${tasks.length}`);const j=await searchPage(s,t.f,t.page);return {id:t.f.id,rows:parse(j?.data?.resultHTML,t.f)}});
  const by=new Map(runs.map(r=>[r.filter.id,r]));for(const x of rest)by.get(x.id).rows.push(...x.rows);return runs.map(r=>({...r,complete:r.rows.length===r.count}));
}

function dedupe(rows){const m=new Map();for(const r of rows){const key=r.sku?`sku:${r.sku.toLowerCase()}`:`url:${r.url.toLowerCase()}`;if(!m.has(key))m.set(key,{...r,listingFilters:[{id:r.filterId,title:r.filterTitle,path:r.filterPath}]});else{const e=m.get(key);if(!e.listingFilters.some(x=>x.id===r.filterId))e.listingFilters.push({id:r.filterId,title:r.filterTitle,path:r.filterPath})}}return [...m.values()]}
async function sanity(){const q=`*[_type=="product" && !(_id in path("drafts.**")) && (brandSlug=="abm" || brand->slug.current=="abm" || brand->themeKey=="abm")]{_id,title,sku,sourceUrl}`;const u=new URL(`https://${PROJECT}.api.sanity.io/v${API}/data/query/${DATASET}`);u.searchParams.set('query',q);const r=await fetch(u);if(!r.ok)throw new Error(`Sanity ${r.status}`);return (await r.json()).result||[]}

async function main(){fs.mkdirSync(OUT,{recursive:true});const s=await getSession(),map=new Map(s.filters.map(x=>[x.title,x])),get=xs=>xs.map(x=>map.get(x)).filter(Boolean),inc=get(INCLUDE),exc=get(EXCLUDE),svc=get(SERVICES);for(const x of [...INCLUDE,...EXCLUDE,...SERVICES])if(!map.has(x))console.warn(`MISSING ${x}`);
  const pr=await collect(s,inc),sr=await collect(s,svc),products=dedupe(pr.flatMap(x=>x.rows)),services=dedupe(sr.flatMap(x=>x.rows)),old=await sanity(),sku=new Set(old.map(x=>clean(x.sku).toLowerCase()).filter(Boolean)),url=new Set(old.map(x=>String(x.sourceUrl||'').replace('/../../','/').toLowerCase()).filter(Boolean));
  const missing=products.filter(x=>!(x.sku&&sku.has(x.sku.toLowerCase()))&&!url.has(x.url.toLowerCase())),existing=products.filter(x=>!missing.includes(x));
  const summary={generatedAt:new Date().toISOString(),sanityWrites:0,products:{facetCountSum:inc.reduce((n,x)=>n+x.count,0),raw:pr.reduce((n,x)=>n+x.rows.length,0),unique:products.length,alreadyInSanity:existing.length,missingFromSanity:missing.length,incomplete:pr.filter(x=>!x.complete).map(x=>({title:x.filter.title,count:x.count,got:x.rows.length}))},excluded:{facetCountSum:exc.reduce((n,x)=>n+x.count,0),filters:exc.map(x=>({title:x.title,count:x.count,path:x.path}))},services:{facetCountSum:svc.reduce((n,x)=>n+x.count,0),raw:sr.reduce((n,x)=>n+x.rows.length,0),unique:services.length,incomplete:sr.filter(x=>!x.complete).map(x=>({title:x.filter.title,count:x.count,got:x.rows.length}))},currentSanityProducts:old.length};
  const files={summary,products,services,missing,existing,filters:s.filters,productRuns:pr.map(x=>({filter:x.filter,count:x.count,pages:x.pages,got:x.rows.length,complete:x.complete})),serviceRuns:sr.map(x=>({filter:x.filter,count:x.count,pages:x.pages,got:x.rows.length,complete:x.complete}))};for(const [n,v]of Object.entries(files))fs.writeFileSync(path.join(OUT,`${n}.json`),JSON.stringify(v,null,2));fs.writeFileSync(path.join(OUT,'summary.md'),`# ABM search census v5\n\n- Normal product facet sum: **${summary.products.facetCountSum}**\n- Unique normal products: **${summary.products.unique}**\n- Existing in Sanity: **${summary.products.alreadyInSanity}**\n- Missing from Sanity: **${summary.products.missingFromSanity}**\n- Excluded large generated/library results: **${summary.excluded.facetCountSum}**\n- Unique services: **${summary.services.unique}**\n- Incomplete product filters: **${summary.products.incomplete.length}**\n- Incomplete service filters: **${summary.services.incomplete.length}**\n- Sanity writes: **0**\n`);console.log(JSON.stringify(summary,null,2));if(summary.products.incomplete.length||summary.services.incomplete.length)process.exitCode=2}
main().catch(e=>{console.error(e?.stack||e);process.exit(1)});
