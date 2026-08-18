#!/usr/bin/env node
/**
 * ABM authoritative search-index census v3 — READ ONLY.
 *
 * Uses ABM's current /search POST API (same endpoint used by the site's Load more UI).
 * This is the authoritative candidate census for ITS BIO:
 *   INCLUDE: all regular Products
 *   EXCLUDE_LIBRARY: large library/generated-catalog product branches
 *   SERVICES: all service search results + service taxonomy
 * No Sanity writes.
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const BASE = "https://www.abmgood.com";
const SEARCH = `${BASE}/search`;
const OUT = path.resolve(".cache/abm-search-census-v3");
const argv = process.argv.slice(2);
const readArg=(n,f)=>{const i=argv.indexOf(n);return i>=0&&argv[i+1]&&!argv[i+1].startsWith("--")?argv[i+1]:f};
const GAP_MS=Math.max(0,Number(readArg("--gap-ms","80"))||80);
const MAX_PAGES=Math.max(1,Number(readArg("--max-pages","1000"))||1000);
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const clean=(v)=>String(v||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();

const PROJECT_ID=process.env.NEXT_PUBLIC_SANITY_PROJECT_ID||"9b5twpc8";
const DATASET=process.env.NEXT_PUBLIC_SANITY_DATASET||"production";
const API_VERSION=process.env.NEXT_PUBLIC_SANITY_API_VERSION||"2025-01-01";

// Huge ABM generated catalogs intentionally excluded from Product migration.
const EXCLUDED_PRODUCT_FILTER_TITLES = new Set([
  "Cell Library Collections",
  "Expression-Ready Libraries",
  "CRISPR KO Vectors & Virus",
  "CRISPR Activation Vectors",
]);

// Product filters we do want. General is safe as a whole; Cellular must omit Cell Library Collections;
// Genetic must omit the two huge CRISPR generated catalogs and Expression-Ready Libraries.
const INCLUDED_FILTER_TITLES = [
  "General Materials",
  "3D and Organoid",
  "Microbial Contamination",
  "Cell Immortalization Reagents",
  "Media & Supplements",
  "Growth Factors and Cytokines",
  "Culture Consumables",
  "Cell Assay Products",
  "Cas9 Vectors & Virus",
  "Cas Proteins & CRISPR Screening",
  "Expression Systems",
  "Specialized Vectors",
  "Kits for Viral Vectors",
];

const SERVICE_ROOT_TITLES = [
  "Cell & Antibody Services",
  "DNA & Cloning Services",
  "Recombinant Virus Packaging",
];

function cookieHeader(setCookies){
  return (setCookies||[]).map(v=>String(v).split(";",1)[0]).filter(Boolean).join("; ");
}
function getSetCookies(headers){
  if(typeof headers.getSetCookie==="function") return headers.getSetCookie();
  const raw=headers.get("set-cookie"); return raw?[raw]:[];
}
async function getSession(){
  const r=await fetch(SEARCH,{cache:"no-store",headers:{"user-agent":"Mozilla/5.0 (compatible; ITSBIO-ABM-SearchCensus/3.0)",accept:"text/html"}});
  if(!r.ok) throw new Error(`GET /search HTTP ${r.status}`);
  const html=await r.text();
  const $=cheerio.load(html,{decodeEntities:false});
  const form=$("#abm-search-filter-sections-form").first();
  const token=String(form.find("input[name='_token']").val()||"");
  if(!token) throw new Error("ABM search CSRF token not found");
  const filters=[];
  form.find("input[name='fc_ids[]']").each((_,input)=>{
    const $i=$(input); const a=$i.closest("a.abm-search-filter-item");
    const title=clean(a.attr("title")||a.find(".abm-search-filter-item-name").clone().children().remove().end().text());
    const count=Number(clean(a.find(".abm-search-filter-item-count").text()).replace(/,/g,""))||0;
    const style=String(a.attr("style")||"");
    const level=Number(style.match(/--level:\s*(\d+)/)?.[1]||0);
    filters.push({id:String($i.val()||""),title,count,level});
  });
  // sequence + level reconstructs parent relationships
  const stack=[]; for(const f of filters){ while(stack.length>=f.level) stack.pop(); f.parentId=stack.at(-1)?.id||""; f.path=[...stack.map(x=>x.title),f.title]; stack.push(f); }
  return {token,cookie:cookieHeader(getSetCookies(r.headers)),filters,html};
}

async function postSearch(session, filterIds, page=1){
  if(GAP_MS) await sleep(GAP_MS);
  const body=new URLSearchParams();
  body.append("_token",session.token); body.append("query",""); body.append("search_mode","exact");
  for(const id of filterIds) body.append("fc_ids[]",String(id));
  if(page>1) body.append("page",String(page));
  const r=await fetch(SEARCH,{method:"POST",redirect:"follow",cache:"no-store",headers:{
    "user-agent":"Mozilla/5.0 (compatible; ITSBIO-ABM-SearchCensus/3.0)",accept:"application/json","content-type":"application/x-www-form-urlencoded;charset=UTF-8",cookie:session.cookie,"x-requested-with":"XMLHttpRequest",
  },body});
  if(!r.ok) throw new Error(`POST /search HTTP ${r.status} filters=${filterIds.join(",")} page=${page}`);
  const ct=r.headers.get("content-type")||""; const txt=await r.text();
  if(!ct.includes("json")){ throw new Error(`POST /search non-JSON ${ct}: ${txt.slice(0,160)}`); }
  return JSON.parse(txt);
}

function parseResultHTML(html, filter){
  const $=cheerio.load(`<div id="root">${html||""}</div>`,{decodeEntities:false});
  const rows=[];
  $(".abm-search-results-item").each((_,el)=>{
    const $el=$(el);
    const nameA=$el.find(".abm-search-results-item-product_name a[href]").first();
    const title=clean(nameA.text()); const url=String(nameA.attr("href")||"").trim();
    const category=clean($el.find(".abm-search-results-item-product_category").first().text());
    let sku="",unit="";
    $el.find(".abm-search-results-item-product_info-row").each((_,row)=>{
      const label=clean($(row).find(".abm-search-results-item-product_info-label").text()).toLowerCase();
      const value=clean($(row).find(".abm-search-results-item-product_info-value").text());
      if(label.includes("cat.no")) sku=value; if(label.startsWith("unit")) unit=value;
    });
    if(title&&url) rows.push({title,url,sku,unit,searchCategory:category,filterId:filter.id,filterTitle:filter.title,filterPath:filter.path});
  });
  return rows;
}

async function collectFilter(session, filter){
  const all=[]; let page=1; let responseCount=null; let showMore=true;
  while(showMore && page<=MAX_PAGES){
    const res=await postSearch(session,[filter.id],page);
    if(responseCount==null) responseCount=Number(res.count||0);
    const parsed=parseResultHTML(res?.data?.resultHTML||"",filter); all.push(...parsed);
    showMore=Boolean(res?.data?.showLoadMore);
    console.log(`[${filter.title}] page=${page} got=${parsed.length} cumulative=${all.length}/${responseCount} more=${showMore}`);
    if(!parsed.length && showMore) throw new Error(`${filter.title}: empty page while showLoadMore=true at page ${page}`);
    page++;
  }
  return {filter,count:responseCount??all.length,pages:page-1,rows:all,truncated:showMore};
}

function dedupe(rows){
  const map=new Map();
  for(const row of rows){
    const key=(row.sku?`sku:${row.sku.toLowerCase()}`:`url:${row.url.toLowerCase()}`);
    const old=map.get(key);
    if(!old) map.set(key,{...row,listingFilters:[{id:row.filterId,title:row.filterTitle,path:row.filterPath}]});
    else if(!old.listingFilters.some(x=>x.id===row.filterId)) old.listingFilters.push({id:row.filterId,title:row.filterTitle,path:row.filterPath});
  }
  return [...map.values()];
}

async function sanityProducts(){
  const q=`*[_type=="product" && !(_id in path("drafts.**")) && (brandSlug=="abm" || brand->slug.current=="abm" || brand->themeKey=="abm")]{_id,title,sku,"slug":slug.current,sourceUrl,categoryPath,isActive}`;
  const u=new URL(`https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}`);u.searchParams.set("query",q);
  const r=await fetch(u);if(!r.ok)throw new Error(`Sanity HTTP ${r.status}`);return (await r.json()).result||[];
}

async function main(){
  fs.mkdirSync(OUT,{recursive:true});
  const session=await getSession();
  fs.writeFileSync(path.join(OUT,"filters.json"),JSON.stringify(session.filters,null,2));
  const byTitle=new Map(session.filters.map(f=>[f.title,f]));

  const includedFilters=[];
  for(const title of INCLUDED_FILTER_TITLES){ const f=byTitle.get(title); if(!f) console.warn(`[WARN] included filter missing: ${title}`); else includedFilters.push(f); }
  const serviceFilters=[];
  for(const title of SERVICE_ROOT_TITLES){ const f=byTitle.get(title); if(!f) console.warn(`[WARN] service filter missing: ${title}`); else serviceFilters.push(f); }
  const excludedFilters=[...EXCLUDED_PRODUCT_FILTER_TITLES].map(t=>byTitle.get(t)).filter(Boolean);

  console.log("[ABM v3] Included filter targets:", includedFilters.map(x=>`${x.title}(${x.count})`).join(", "));
  console.log("[ABM v3] Excluded large catalog filters:", excludedFilters.map(x=>`${x.title}(${x.count})`).join(", "));
  console.log("[ABM v3] Service filters:", serviceFilters.map(x=>`${x.title}(${x.count})`).join(", "));

  const productRuns=[]; for(const f of includedFilters) productRuns.push(await collectFilter(session,f));
  const serviceRuns=[]; for(const f of serviceFilters) serviceRuns.push(await collectFilter(session,f));

  const products=dedupe(productRuns.flatMap(r=>r.rows));
  const services=dedupe(serviceRuns.flatMap(r=>r.rows));
  const sanity=await sanityProducts();
  const sanitySku=new Map(sanity.filter(x=>x.sku).map(x=>[String(x.sku).toLowerCase(),x]));
  const sanityUrl=new Set(sanity.map(x=>String(x.sourceUrl||"").replace("/../../","/").toLowerCase()).filter(Boolean));
  const missing=products.filter(p=>!(p.sku&&sanitySku.has(p.sku.toLowerCase()))&&!sanityUrl.has(p.url.toLowerCase()));
  const existing=products.filter(p=>(p.sku&&sanitySku.has(p.sku.toLowerCase()))||sanityUrl.has(p.url.toLowerCase()));

  const expectedProductCount = includedFilters.reduce((n,f)=>n+f.count,0);
  const duplicateFacetOverlap = productRuns.reduce((n,r)=>n+r.rows.length,0)-products.length;
  const excludedCatalogCount = excludedFilters.reduce((n,f)=>n+f.count,0);
  const summary={
    generatedAt:new Date().toISOString(),sanityWrites:0,
    products:{filters:includedFilters.length,facetCountSum:expectedProductCount,rawResults:productRuns.reduce((n,r)=>n+r.rows.length,0),unique:products.length,facetOverlapDuplicates:duplicateFacetOverlap,alreadyInSanity:existing.length,missingFromSanity:missing.length},
    excludedLargeCatalogs:{filters:excludedFilters.map(({id,title,count,path})=>({id,title,count,path})),facetCountSum:excludedCatalogCount},
    services:{rootFilters:serviceFilters.length,facetCountSum:serviceFilters.reduce((n,f)=>n+f.count,0),rawResults:serviceRuns.reduce((n,r)=>n+r.rows.length,0),unique:services.length},
    currentSanityProducts:sanity.length,
    truncatedRuns:[...productRuns,...serviceRuns].filter(r=>r.truncated).map(r=>r.filter.title),
  };
  fs.writeFileSync(path.join(OUT,"products.json"),JSON.stringify(products,null,2));
  fs.writeFileSync(path.join(OUT,"services.json"),JSON.stringify(services,null,2));
  fs.writeFileSync(path.join(OUT,"missing-from-sanity.json"),JSON.stringify(missing,null,2));
  fs.writeFileSync(path.join(OUT,"already-in-sanity.json"),JSON.stringify(existing,null,2));
  fs.writeFileSync(path.join(OUT,"product-runs.json"),JSON.stringify(productRuns.map(r=>({filter:r.filter,count:r.count,pages:r.pages,rows:r.rows.length,truncated:r.truncated})),null,2));
  fs.writeFileSync(path.join(OUT,"service-runs.json"),JSON.stringify(serviceRuns.map(r=>({filter:r.filter,count:r.count,pages:r.pages,rows:r.rows.length,truncated:r.truncated})),null,2));
  fs.writeFileSync(path.join(OUT,"summary.json"),JSON.stringify(summary,null,2));
  const md=`# ABM official search-index census v3\n\nGenerated: ${summary.generatedAt}\n\nSanity writes: **0**\n\n## Normal products\n- Included search filters: **${summary.products.filters}**\n- Official facet count sum: **${summary.products.facetCountSum}**\n- Raw search results collected: **${summary.products.rawResults}**\n- Unique products after SKU/URL dedupe: **${summary.products.unique}**\n- Facet-overlap duplicates removed: **${summary.products.facetOverlapDuplicates}**\n- Already in current Sanity: **${summary.products.alreadyInSanity}**\n- Missing from current Sanity: **${summary.products.missingFromSanity}**\n\n## Excluded large library/generated catalogs\n${summary.excludedLargeCatalogs.filters.map(f=>`- ${f.title}: **${f.count}**`).join("\n")}\n- Facet count sum (not migrated): **${summary.excludedLargeCatalogs.facetCountSum}**\n\n## Services\n- Root filters: **${summary.services.rootFilters}**\n- Official facet count sum: **${summary.services.facetCountSum}**\n- Unique service results: **${summary.services.unique}**\n\n## Current Sanity\n- Existing published ABM products: **${summary.currentSanityProducts}**\n\nTruncated runs: **${summary.truncatedRuns.length ? summary.truncatedRuns.join(", ") : "none"}**\n`;
  fs.writeFileSync(path.join(OUT,"summary.md"),md);
  console.log(JSON.stringify(summary,null,2));
}
main().catch(e=>{console.error("[ABM search census v3] FATAL",e?.stack||e);process.exit(1)});
