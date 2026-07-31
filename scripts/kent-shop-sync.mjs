#!/usr/bin/env node
/**
 * Kent Shop-only synchronizer.
 *
 * Discovery source is ONLY https://www.kentscientific.com/shop/ pagination.
 * Default is audit-only. Add --write to create missing Sanity products.
 * Existing products are refreshed only with --write --refreshExisting.
 * Products no longer visible in Shop are reported and never deleted/deactivated.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";
import {createClient} from "next-sanity";

const root=process.cwd();
dotenv.config({path:path.join(root,".env.local")});
dotenv.config({path:path.join(root,".env")});
const args=process.argv.slice(2);
const has=(x)=>args.includes(x);
const arg=(x,d="")=>{const i=args.indexOf(x);return i<0?d:(args[i+1]??d)};
const WRITE=has("--write");
const REFRESH=has("--refreshExisting");
const LIMIT=Number(arg("--limit","0"))||0;
const MAX_PAGES=Number(arg("--maxPages","100"))||100;
const MIN_PRODUCTS=Number(arg("--minShopProducts","100"))||100;
const SHOP=String(arg("--shop","https://www.kentscientific.com/shop/")).trim();
const BRAND_ALIASES=[...new Set([String(arg("--brand","kent")).trim(),"kent","kentscientifics"])];
const CACHE=path.join(root,".cache","kent-shop");
const SHOP_CACHE=path.join(CACHE,"shop-pages");
const PRODUCT_CACHE=path.join(CACHE,"product-pages");
const REPORT=path.join(CACHE,"audit-report.json");
const IMG_CACHE_PATH=path.join(root,".cache","kent","kent-image-upload-cache.json");
fs.mkdirSync(SHOP_CACHE,{recursive:true});
fs.mkdirSync(PRODUCT_CACHE,{recursive:true});

const projectId=process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset=process.env.NEXT_PUBLIC_SANITY_DATASET;
const token=process.env.SANITY_WRITE_TOKEN;
if(!projectId||!dataset) throw new Error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET");
if(WRITE&&!token) throw new Error("--write requires SANITY_WRITE_TOKEN");
const sanity=createClient({projectId,dataset,apiVersion:process.env.NEXT_PUBLIC_SANITY_API_VERSION||"2025-01-01",token:token||undefined,useCdn:false});

const wait=(ms)=>new Promise((r)=>setTimeout(r,ms));
const clean=(v)=>String(v||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();
const hash=(v)=>crypto.createHash("sha1").update(String(v)).digest("hex").slice(0,12);
const key=(p,v)=>`${p}_${hash(v)}`;
const abs=(v,b=SHOP)=>{const s=String(v||"").trim();if(!s)return "";try{return new URL(s,b).toString()}catch{return s}};
function norm(v){
  try{
    const u=new URL(abs(v));u.hash="";u.search="";if(["kentscientific.com","www.kentscientific.com"].includes(u.hostname.toLowerCase()))u.hostname="www.kentscientific.com";
    u.pathname=u.pathname.replace(/\/{2,}/g,"/");
    const file=/\/[^/]+\.[a-z0-9]{2,8}$/i.test(u.pathname);
    if(!file&&!u.pathname.endsWith("/"))u.pathname+="/";
    return u.toString();
  }catch{return String(v||"").trim()}
}
function productSlug(v){try{const p=new URL(norm(v)).pathname.split("/").filter(Boolean);const i=p.indexOf("products");return i<0?"":(p[i+1]||"")}catch{return ""}}
const isProductUrl=(v)=>/^https:\/\/www\.kentscientific\.com\/products\/[^/]+\/$/i.test(norm(v));
function categoryPath(v){try{const p=new URL(norm(v)).pathname.split("/").filter(Boolean);const i=p.indexOf("product");return i<0?[]:p.slice(i+1)}catch{return []}}
const titleCase=(v)=>clean(String(v||"").replaceAll("-"," ")).replace(/\b\w/g,(m)=>m.toUpperCase());
function writeJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+"\n","utf8")}
function safeHtml(html){
  if(!html)return "";
  return sanitizeHtml(html,{allowedTags:sanitizeHtml.defaults.allowedTags.concat(["img","table","thead","tbody","tr","th","td","figure","figcaption","iframe","hr","sup","sub"]),allowedAttributes:{a:["href","target","rel"],img:["src","alt","title","loading","width","height"],iframe:["src","title","allow","allowfullscreen","frameborder"],"*":["class","id","style"]},transformTags:{a:sanitizeHtml.simpleTransform("a",{target:"_blank",rel:"noopener noreferrer"})}}).trim();
}

function readImageCache(){try{const x=JSON.parse(fs.readFileSync(IMG_CACHE_PATH,"utf8"));return x?.byUrl?x:{byUrl:x||{}}}catch{return {byUrl:{}}}}
function writeImageCache(cache){fs.mkdirSync(path.dirname(IMG_CACHE_PATH),{recursive:true});fs.writeFileSync(IMG_CACHE_PATH,JSON.stringify(cache,null,2)+"\n","utf8")}
const imageCache=readImageCache();
const isSanityImage=(v)=>String(v||"").includes("cdn.sanity.io/images/");
const isJunkImage=(v)=>/(?:logo|favicon|sprite|icon|header|footer|banner|badge|seal|trust|doubleclick)/i.test(String(v||""));
function imageCacheHit(url){const u=norm(url);return imageCache.byUrl[u]||imageCache.byUrl[u.replace("https://www.kentscientific.com/","https://kentscientific.com/")]||null}
function imageExt(contentType,url){const ct=String(contentType||"").toLowerCase();if(ct.includes("png"))return "png";if(ct.includes("jpeg")||ct.includes("jpg"))return "jpg";if(ct.includes("webp"))return "webp";if(ct.includes("gif"))return "gif";return String(url).toLowerCase().match(/\.(png|jpe?g|webp|gif)(?:$|[?#])/)?.[1]?.replace("jpeg","jpg")||"png"}
async function fetchBinary(url){const c=new AbortController();const t=setTimeout(()=>c.abort(),40000);try{const r=await fetch(url,{redirect:"follow",cache:"no-store",signal:c.signal,headers:{"user-agent":"itsbio-kent-shop-sync/1.0",accept:"image/*,*/*;q=0.8",referer:SHOP}});if(!r.ok)throw new Error(`Image HTTP ${r.status} :: ${url}`);return {buf:Buffer.from(await r.arrayBuffer()),contentType:r.headers.get("content-type")||""}}finally{clearTimeout(t)}}
async function uploadImage(url){const sourceUrl=norm(url);if(!sourceUrl||isJunkImage(sourceUrl))return null;if(isSanityImage(sourceUrl))return {assetId:"",assetUrl:sourceUrl,sourceUrl};const hit=imageCacheHit(sourceUrl);if(hit?.assetUrl||hit?.url)return {assetId:hit.assetId||"",assetUrl:hit.assetUrl||hit.url,sourceUrl};const {buf,contentType}=await fetchBinary(sourceUrl);if(!buf.length)throw new Error(`Empty image: ${sourceUrl}`);const asset=await sanity.assets.upload("image",buf,{filename:`kent-shop-${hash(sourceUrl)}.${imageExt(contentType,sourceUrl)}`,contentType:contentType||undefined});const saved={assetId:asset._id,assetUrl:asset.url};imageCache.byUrl[sourceUrl]=saved;writeImageCache(imageCache);return {...saved,sourceUrl}}
async function rehostImages(parsed){
  const imageUrls=[];const images=[];
  for(const src of parsed.imageUrls||[]){const up=await uploadImage(src);if(!up?.assetUrl||imageUrls.includes(up.assetUrl))continue;imageUrls.push(up.assetUrl);if(up.assetId)images.push({_key:key("img",up.sourceUrl),_type:"image",asset:{_type:"reference",_ref:up.assetId},caption:"",sourceUrl:up.sourceUrl})}
  const variants=[];
  for(const variant of parsed.variants||[]){if(!variant.imageUrl){variants.push(variant);continue}const up=await uploadImage(variant.imageUrl);variants.push({...variant,...(up?.assetUrl?{imageUrl:up.assetUrl}:{})})}
  return {...parsed,imageUrls,images,variants};
}

async function fetchText(url){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),40000);
  try{const r=await fetch(url,{redirect:"follow",cache:"no-store",signal:c.signal,headers:{"user-agent":"Mozilla/5.0 Chrome/124 Safari/537.36",accept:"text/html,application/xhtml+xml","accept-language":"en-US,en;q=0.9",referer:SHOP}});if(!r.ok)throw new Error(`HTTP ${r.status} :: ${url}`);return await r.text()}finally{clearTimeout(t)}
}
async function cached(url,file){if(!has("--refreshCache")&&fs.existsSync(file))return fs.readFileSync(file,"utf8");const html=await fetchText(url);fs.writeFileSync(file,html,"utf8");return html}

function shopPage(html,pageUrl){
  const $=cheerio.load(html,{decodeEntities:false});
  const lists=$("ul.products").filter((_,el)=>!$(el).closest("header,footer,nav,.mega-menu,.elementor-location-header,.elementor-location-footer").length).toArray();
  const list=lists.map((el)=>({el,n:$(el).children("li.product").length})).sort((a,b)=>b.n-a.n)[0]?.el;
  if(!list)return {items:[],bad:[{reason:"Shop product grid not found"}],next:""};
  const items=[];const bad=[];
  $(list).children("li.product").each((index,el)=>{
    const card=$(el);
    const href=card.find('a.woocommerce-LoopProduct-link[href*="/products/"],a[href*="/products/"]').first().attr("href")||"";
    const sourceUrl=norm(abs(href,pageUrl));const slug=productSlug(sourceUrl);
    const title=clean(card.find(".woocommerce-loop-product__title,h2,h3").first().text());
    if(!slug||!title||!isProductUrl(sourceUrl)){bad.push({index,href,title});return}
    items.push({slug,title,sourceUrl,shopPageUrl:norm(pageUrl)});
  });
  const nextHref=$("nav.woocommerce-pagination a.next.page-numbers,.woocommerce-pagination a.next.page-numbers").first().attr("href")||"";
  return {items,bad,next:nextHref?norm(abs(nextHref,pageUrl)):""};
}
async function discover(){
  const bySlug=new Map();const pages=[];const bad=[];const seen=new Set();let url=norm(SHOP);
  for(let page=1;page<=MAX_PAGES&&url;page++){
    if(seen.has(url))throw new Error(`Pagination loop: ${url}`);seen.add(url);
    const parsed=shopPage(await cached(url,path.join(SHOP_CACHE,`page-${page}.html`)),url);
    if(!parsed.items.length)throw new Error(`No Shop product cards found: ${url}`);
    parsed.items.forEach((p)=>{if(!bySlug.has(p.slug))bySlug.set(p.slug,p)});
    pages.push({page,url,cardCount:parsed.items.length,uniqueCount:bySlug.size});
    bad.push(...parsed.bad.map((x)=>({page,url,...x})));
    process.stdout.write(`\rShop pages ${page}, unique products ${bySlug.size}`);
    url=parsed.next;await wait(120);
  }
  process.stdout.write("\n");
  if(url)throw new Error(`Shop pagination exceeded --maxPages=${MAX_PAGES}`);
  const all=[...bySlug.values()];
  if(all.length<MIN_PRODUCTS)throw new Error(`Safety stop: discovered only ${all.length} Shop products (minimum ${MIN_PRODUCTS})`);
  return {allCount:all.length,all,pages,bad};
}
async function brand(){
  const b=await sanity.fetch(`*[_type=="brand"&&(slug.current in $a||themeKey in $a)][0]{_id,title,themeKey,"slug":slug.current}`,{a:BRAND_ALIASES});
  if(!b?._id)throw new Error(`Kent brand not found: ${BRAND_ALIASES.join(", ")}`);return b;
}
const existingProducts=(brandId)=>sanity.fetch(`*[_type=="product"&&(brand._ref==$brandId||brandSlug in $a||brand->slug.current in $a||brand->themeKey in $a)]{_id,title,sku,isActive,sourceUrl,"slug":slug.current,productType,"variantCount":count(variants)}`,{brandId,a:BRAND_ALIASES});
function compare(shop,existing){
  const bySlug=new Map();const bySource=new Map();const duplicates=[];const duplicateSources=[];
  existing.forEach((p)=>{
    if(p.slug){if(bySlug.has(p.slug))duplicates.push({slug:p.slug,ids:[bySlug.get(p.slug)._id,p._id]});else bySlug.set(p.slug,p)}
    const source=norm(p.sourceUrl||"");if(source){if(bySource.has(source))duplicateSources.push({sourceUrl:source,ids:[bySource.get(source)._id,p._id]});else bySource.set(source,p)}
  });
  const matchByShopSlug=new Map();const present=[];const missing=[];const slugMismatches=[];const matchedIds=new Set();
  shop.forEach((item)=>{const exact=bySlug.get(item.slug);const source=bySource.get(norm(item.sourceUrl));const match=exact||source;if(!match){missing.push(item);return}present.push(item);matchByShopSlug.set(item.slug,match);matchedIds.add(match._id);if(match.slug!==item.slug)slugMismatches.push({shopSlug:item.slug,sanitySlug:match.slug,sanityId:match._id,sourceUrl:item.sourceUrl})});
  return {bySlug,matchByShopSlug,duplicates,duplicateSources,slugMismatches,missing,present,notInShop:existing.filter((p)=>!matchedIds.has(p._id))};
}
function variationJson(raw){
  for(const text of [raw,raw?.replaceAll("&quot;",'"').replaceAll("&#039;","'").replaceAll("&amp;","&")]){try{const x=JSON.parse(text||"");if(Array.isArray(x))return x}catch{}}
  return [];
}
const optionKey=(v)=>String(v||"").replace(/^attribute_/,"").replace(/^pa_/,"").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"").toLowerCase();
function optionsAndVariants($){
  const groups=new Map();
  $("table.variations tr").each((_,row)=>{
    const r=$(row);const select=r.find("select[name^='attribute_']").first();if(!select.length)return;
    const k=optionKey(select.attr("name"));if(!k)return;
    const label=clean(r.find("label,th.label").first().text())||titleCase(k);const opts=[];
    select.find("option[value]").each((_,o)=>{const value=clean($(o).attr("value"));if(value)opts.push({_key:key("opt",`${k}:${value}`),_type:"optionValue",value,label:clean($(o).text())||titleCase(value)})});
    groups.set(k,{_key:key("grp",k),_type:"optionGroup",key:k,name:k,label,displayType:opts.length<=5?"button":"select",options:opts});
  });
  const raw=variationJson($("form.variations_form").first().attr("data-product_variations")||"");
  const variants=raw.flatMap((v)=>{
    const id=String(v?.variation_id||v?.id||"");if(!id)return [];
    const attrs=Object.entries(v?.attributes||{}).map(([rk,rv])=>{const k=optionKey(rk);return {_key:key("attr",`${id}:${k}`),_type:"attributePair",key:k,value:String(rv||"")}});
    const pairs=attrs.map((a)=>{const g=groups.get(a.key);const o=g?.options?.find((x)=>x.value===a.value);return {_key:key("pair",`${id}:${a.key}:${a.value}`),_type:"optionValuePair",key:a.key,label:g?.label||titleCase(a.key),value:o?.label||titleCase(a.value)}});
    const summary=pairs.map((x)=>`${x.label}: ${x.value}`).join(" / ");const sku=clean(v?.sku);const imageUrl=norm(v?.image?.full_src||v?.image?.src||"");
    return [{_key:key("var",id),_type:"variant",variantId:id,title:summary||sku||`Variant ${id}`,sku,catNo:sku,optionSummary:summary,optionValues:pairs,attributes:attrs,...(imageUrl?{imageUrl}:{}),sourceVariationId:id}];
  });
  return {productType:groups.size?"variant":"simple",defaultVariantId:variants[0]?.variantId||"",optionGroups:[...groups.values()],variants};
}
function section($,main,re){
  const h=main.find("h1,h2,h3,h4").filter((_,el)=>re.test(clean($(el).text()))).first();if(!h.length)return "";
  const parts=[];let cur=h.next();let guard=0;while(cur.length&&guard++<80){const tag=(cur.get(0)?.tagName||"").toLowerCase();if(/^h[1-4]$/.test(tag))break;parts.push($.html(cur));cur=cur.next()}return safeHtml(parts.join("\n"));
}
function parseProduct(html,requested){
  const $=cheerio.load(html,{decodeEntities:false});const sourceUrl=norm($("link[rel='canonical']").attr("href")||requested);const slug=productSlug(sourceUrl);const main=$("main").first().length?$("main").first():$("body");
  const title=clean($("h1.product_title,h1").first().text())||titleCase(slug);
  const sku=clean($(".product_meta .sku").first().text())||(clean($(".product_meta").text()).match(/\bItem\s*#\s*[:#]?\s*([A-Za-z0-9_.-]{2,80})\b/i)?.[1]||"");
  const short=safeHtml($(".woocommerce-product-details__short-description").first().html()||"");const summary=clean(cheerio.load(short||"").text()).slice(0,500);
  const cats=[];$(".product_meta a[href*='/product/']").each((_,a)=>{const p=categoryPath($(a).attr("href"));if(p.length)cats.push(p)});cats.sort((a,b)=>b.length-a.length);const pathArr=cats[0]||[];
  const imageUrls=[];$(".woocommerce-product-gallery img").each((_,img)=>{const u=norm(abs($(img).attr("data-large_image")||$(img).attr("data-src")||$(img).attr("src")||"",sourceUrl));if(u&&!imageUrls.includes(u))imageUrls.push(u)});
  const docs=[];main.find("a[href]").each((_,a)=>{const u=norm(abs($(a).attr("href"),sourceUrl));if(!u.toLowerCase().includes(".pdf")||docs.some((d)=>d.url===u))return;const title=clean($(a).text())||"Document";docs.push({_key:key("doc",u),_type:"docItem",title,label:title,url:u})});
  return {slug,title,sku,sourceUrl,summary,categoryPath:pathArr,listingPaths:pathArr.map((_,i)=>pathArr.slice(0,i+1).join("/")),categoryPathTitles:pathArr.map(titleCase),extraHtml:short,datasheetHtml:safeHtml($("#tab-description,.woocommerce-Tabs-panel--description").first().html()||""),specsHtml:safeHtml($("#tab-additional_information,.woocommerce-Tabs-panel--additional_information").first().html()||""),documentsHtml:section($,main,/\b(resources?|product\s*videos?)\b/i),referencesHtml:section($,main,/(scientific\s+publications?|publications|references?)/i),reviewsHtml:safeHtml($("#reviews").first().html()||""),imageUrls,docs,...optionsAndVariants($)};
}
async function categoryRef(pathArr){if(!pathArr.length)return "";return await sanity.fetch(`*[_type=="category"&&array::join(path,"/")==$p&&(themeKey in $a||brand->themeKey in $a||brand->slug.current in $a)][0]._id`,{p:pathArr.join("/"),a:BRAND_ALIASES})||""}
function payload(values){return Object.fromEntries(Object.entries(values).filter(([,v])=>v!==undefined&&v!==null&&v!==""&&(!Array.isArray(v)||v.length)))}
async function upsert(brandId,existing,parsed){
  const cat=await categoryRef(parsed.categoryPath);const id=existing?._id||`prod_kent__${parsed.slug}`;
  const data=payload({...(!existing?{isActive:true}:{}),title:parsed.title,brand:{_type:"reference",_ref:brandId},summary:parsed.summary,sku:parsed.sku,slug:{_type:"slug",current:parsed.slug},...(cat?{categoryRef:{_type:"reference",_ref:cat}}:{}),categoryPath:parsed.categoryPath,listingPaths:parsed.listingPaths,categoryPathTitles:parsed.categoryPathTitles,sourceUrl:parsed.sourceUrl,extraHtml:parsed.extraHtml,specsHtml:parsed.specsHtml,datasheetHtml:parsed.datasheetHtml,documentsHtml:parsed.documentsHtml,referencesHtml:parsed.referencesHtml,reviewsHtml:parsed.reviewsHtml,imageUrls:parsed.imageUrls,images:parsed.images,docs:parsed.docs,productType:parsed.productType,defaultVariantId:parsed.defaultVariantId,optionGroups:parsed.optionGroups,variants:parsed.variants,enrichedAt:new Date().toISOString()});
  if(existing)await sanity.patch(id).set(data).commit({autoGenerateArrayKeys:true});
  else await sanity.transaction().createIfNotExists({_id:id,_type:"product"}).patch(id,(p)=>p.set(data)).commit({autoGenerateArrayKeys:true});
  return {id,categoryRef:cat,variantCount:parsed.variants.length};
}

async function main(){
  console.log(`[kent-shop-sync] ${WRITE?(REFRESH?"write + refresh":"write missing only"):"audit only"}`);
  const b=await brand();const found=await discover();const existing=await existingProducts(b._id);const audit=compare(found.all,existing);
  const fullTargets=REFRESH?found.all:audit.missing;const targets=LIMIT>0?fullTargets.slice(0,LIMIT):fullTargets;
  const report={generatedAt:new Date().toISOString(),shopUrl:SHOP,mode:WRITE?"write":"audit",shopProductCount:found.allCount,targetProductCount:WRITE?targets.length:found.allCount,sanityProductCount:existing.length,presentCount:audit.present.length,missingCount:audit.missing.length,notInShopCount:audit.notInShop.length,pages:found.pages,badShopCards:found.bad,duplicateSanitySlugs:audit.duplicates,duplicateSanitySourceUrls:audit.duplicateSources,slugMismatches:audit.slugMismatches,missing:audit.missing,notInShop:audit.notInShop};
  writeJson(REPORT,report);
  console.log(`Shop ${found.allCount} / Sanity ${existing.length} / present ${audit.present.length} / missing ${audit.missing.length} / Sanity-only ${audit.notInShop.length}`);
  console.log(`Report: ${REPORT}`);
  if(!WRITE){console.log("No Sanity documents changed.");return}
  let ok=0,failed=0;const failures=[];
  for(let i=0;i<targets.length;i++){
    const item=targets[i];try{const html=await cached(item.sourceUrl,path.join(PRODUCT_CACHE,`${item.slug}.html`));let parsed=parseProduct(html,item.sourceUrl);if(parsed.slug!==item.slug)throw new Error(`Canonical slug mismatch: ${parsed.slug}`);parsed=await rehostImages(parsed);await upsert(b._id,audit.matchByShopSlug.get(item.slug)||null,parsed);ok++;process.stdout.write(`\rSynced ${i+1}/${targets.length}, ok ${ok}, failed ${failed}`);await wait(140)}catch(e){failed++;failures.push({slug:item.slug,url:item.sourceUrl,error:e?.message||String(e)});console.log(`\nFAIL ${item.slug}: ${e?.message||e}`)}
  }
  process.stdout.write("\n");writeJson(REPORT,{...report,sync:{targetCount:targets.length,ok,failed,failures}});console.log(`Done. ok=${ok}, failed=${failed}. Sanity-only products were not changed.`);
}
main().catch((e)=>{console.error(e?.stack||e);process.exit(1)});
