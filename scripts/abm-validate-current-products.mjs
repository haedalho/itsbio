#!/usr/bin/env node
/** READ ONLY: validate every current ABM product document against live abmgood.com. */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const BASE = "https://www.abmgood.com/";
const OUT = path.resolve(".cache/abm-current-validation");
const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9b5twpc8";
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-01-01";
const argv = process.argv.slice(2);
const readArg = (name, fallback) => { const i=argv.indexOf(name); return i>=0 && argv[i+1] && !argv[i+1].startsWith("--") ? argv[i+1] : fallback; };
const CONCURRENCY = Math.max(1, Math.min(10, Number(readArg("--concurrency","6")) || 6));
const GAP_MS = Math.max(0, Number(readArg("--gap-ms","50")) || 50);

const HARD_EXCLUDE_TRAILS = [
  "Cell Library Collections",
  "Expression-Ready Libraries",
  "CRISPR KO Vectors & Virus",
  "CRISPR Activation Vectors",
];
const REVIEW_TERMS = ["Special Cell Line Collection", "Special Cell Line Collections"];
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
const clean = (v) => String(v||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();

function normalizeSourceUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  s = s.replace(/^https?:\/\/(?:www\.)?abmgood\.com\//i, "");
  s = s.replace(/^(?:\.\.\/)+/, "");
  try { const u = new URL(s, BASE); u.protocol="https:"; u.hostname="www.abmgood.com"; u.hash=""; return u.toString(); }
  catch { return ""; }
}

async function sanityProducts() {
  const q = `*[_type=="product" && !(_id in path("drafts.**")) && (brandSlug=="abm" || brand->slug.current=="abm" || brand->themeKey=="abm")]{_id,title,sku,"slug":slug.current,sourceUrl,categoryPath,categoryPathTitles,isActive}`;
  const u = new URL(`https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}`); u.searchParams.set("query", q);
  const r = await fetch(u); if(!r.ok) throw new Error(`Sanity HTTP ${r.status}`); return (await r.json()).result || [];
}

async function fetchLive(url) {
  const controller = new AbortController(); const timer=setTimeout(()=>controller.abort(),25000);
  try {
    if (GAP_MS) await sleep(GAP_MS);
    const r = await fetch(url,{redirect:"follow",cache:"no-store",signal:controller.signal,headers:{"user-agent":"Mozilla/5.0 (compatible; ITSBIO-ABM-Validator/1.0)",accept:"text/html,application/xhtml+xml"}});
    const status=r.status; const finalUrl=r.url || url; const html=await r.text(); return {status,finalUrl,html};
  } finally { clearTimeout(timer); }
}

function parse(html, finalUrl) {
  const $=cheerio.load(html,{decodeEntities:false});
  const scope=$("#content,main,.product-product,.product-info,.container").first().length ? $("#content,main,.product-product,.product-info,.container").first() : $("body");
  const body=clean(scope.text());
  const sku=body.match(/Cat\.?\s*No\.?\s*[:#]?\s*([A-Za-z0-9._/+\-]+)/i)?.[1] || "";
  const title=clean(scope.find("h1").first().text() || $("h1").first().text() || $("title").first().text()).replace(/\s*\|.*$/,"");
  const breadcrumbs=[];
  $("ul.breadcrumb a,ol.breadcrumb a,.breadcrumb a,nav[aria-label*='breadcrumb' i] a").each((_,a)=>{const t=clean($(a).text()); if(t && !breadcrumbs.includes(t)) breadcrumbs.push(t);});
  const selected=[];
  $(".active,.selected,[aria-current='page']").each((_,el)=>{const t=clean($(el).text()); if(t && t.length<120 && !selected.includes(t)) selected.push(t);});
  const trailText=[...breadcrumbs,...selected].join(" > ");
  const isProduct=Boolean(sku || /\bProduct size\b/i.test(body) || /\bDatasheet\b/i.test(body) && /\bCat\.?\s*No\.?/i.test(body));
  const hardExclude=HARD_EXCLUDE_TRAILS.some(t=>trailText.includes(t)) || /\blibrar(?:y|ies)\b/i.test(title);
  const review=REVIEW_TERMS.some(t=>trailText.includes(t)) || /\bcollection\b/i.test(title);
  return {title,sku,breadcrumbs,selected,isProduct,hardExclude,review,finalUrl};
}

async function pool(items, fn) { const out=new Array(items.length); let cursor=0; const workers=Array.from({length:Math.min(CONCURRENCY,items.length)},async()=>{while(true){const i=cursor++;if(i>=items.length)return;out[i]=await fn(items[i],i);}}); await Promise.all(workers); return out; }
function eq(a,b){return clean(a).toLowerCase()===clean(b).toLowerCase();}

async function main(){
  fs.mkdirSync(OUT,{recursive:true});
  const products=await sanityProducts();
  console.log(`[ABM validate] current products=${products.length}`);
  const rows=await pool(products,async(p,i)=>{
    if(i%100===0) console.log(`[validate ${i}/${products.length}]`);
    const normalizedUrl=normalizeSourceUrl(p.sourceUrl);
    if(!normalizedUrl) return {...p,normalizedUrl,status:"NO_SOURCE_URL",httpStatus:0};
    try{
      const live=await fetchLive(normalizedUrl); const parsed=parse(live.html,live.finalUrl);
      let status="LIVE_INCLUDE";
      if(live.status>=400) status=`HTTP_${live.status}`;
      else if(!parsed.isProduct) status="NOT_PRODUCT_PAGE";
      else if(parsed.hardExclude) status="EXCLUDE_LIBRARY";
      else if(parsed.review) status="REVIEW";
      const skuMatch=!p.sku || !parsed.sku ? null : eq(p.sku,parsed.sku);
      const titleMatch=!p.title || !parsed.title ? null : eq(p.title,parsed.title);
      return {...p,normalizedUrl,httpStatus:live.status,liveTitle:parsed.title,liveSku:parsed.sku,breadcrumbs:parsed.breadcrumbs,selected:parsed.selected,finalUrl:parsed.finalUrl,status,skuMatch,titleMatch};
    }catch(e){return {...p,normalizedUrl,httpStatus:0,status:"FETCH_ERROR",error:String(e?.message||e)};}
  });

  const counts={}; for(const r of rows) counts[r.status]=(counts[r.status]||0)+1;
  const badSku=rows.filter(r=>r.skuMatch===false);
  const normalizedChanged=rows.filter(r=>r.sourceUrl && r.normalizedUrl && r.sourceUrl!==r.normalizedUrl);
  const summary={generatedAt:new Date().toISOString(),total:rows.length,counts,skuMismatches:badSku.length,sourceUrlsNeedingNormalization:normalizedChanged.length,sanityWrites:0};
  fs.writeFileSync(path.join(OUT,"all.json"),JSON.stringify(rows,null,2));
  fs.writeFileSync(path.join(OUT,"summary.json"),JSON.stringify(summary,null,2));
  fs.writeFileSync(path.join(OUT,"sku-mismatches.json"),JSON.stringify(badSku,null,2));
  fs.writeFileSync(path.join(OUT,"source-url-normalization.json"),JSON.stringify(normalizedChanged,null,2));
  for(const status of Object.keys(counts)) fs.writeFileSync(path.join(OUT,`${status.toLowerCase()}.json`),JSON.stringify(rows.filter(r=>r.status===status),null,2));
  const md=`# Current ABM Sanity live validation\n\nGenerated: ${summary.generatedAt}\n\n- Current product docs: **${summary.total}**\n- Source URLs needing normalization: **${summary.sourceUrlsNeedingNormalization}**\n- SKU mismatches: **${summary.skuMismatches}**\n- Sanity writes: **0**\n\n## Status\n${Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`- ${k}: **${v}**`).join("\n")}\n`;
  fs.writeFileSync(path.join(OUT,"summary.md"),md);
  console.log(JSON.stringify(summary,null,2));
}
main().catch(e=>{console.error(e?.stack||e);process.exit(1);});
