#!/usr/bin/env node
import fs from 'node:fs';
const projectId='9b5twpc8', dataset='production', apiVersion='2025-02-19';
const base=`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`;
async function q(query){const r=await fetch(`${base}?query=${encodeURIComponent(query)}`);if(!r.ok)throw new Error(`${r.status} ${await r.text()}`);return (await r.json()).result;}
const abmQ=`*[_type == "abmRebuildChunk" && version == "2026-08-09-search-v5" && kind in ["product","service"]].records[]{title,sku}`;
const kentQ=`*[_type == "product" && (!defined(isActive) || isActive == true) && (brandSlug == "kent" || brand->slug.current == "kent" || brand->themeKey == "kent")]{title,sku,variants[]{sku,catNo}}`;
const [abm,kent]=await Promise.all([q(abmQ),q(kentQ)]);
const stop=new Set(['with','from','this','that','your','pack','product','products','service','services','system','mouse','small','animal','animals','replacement','standard','laboratory','scientific']);
function words(s){return [...new Set(String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(w=>w.length>=4 && !stop.has(w) && !/^\d+$/.test(w)))];}
function index(rows){const m=new Map();for(const row of rows||[]){for(const w of words(row.title)){const a=m.get(w)||[];if(a.length<5)a.push({title:row.title,sku:row.sku||''});m.set(w,a);}}return m;}
const A=index(abm), K=index(kent);
const shared=[...A.keys()].filter(w=>K.has(w)).map(w=>({term:w,abmCount:A.get(w).length,kentCount:K.get(w).length,abmExamples:A.get(w),kentExamples:K.get(w)})).sort((a,b)=>(b.abmCount+b.kentCount)-(a.abmCount+a.kentCount)||a.term.localeCompare(b.term)).slice(0,30);
fs.writeFileSync('data/_shared-search-terms-temp.json',JSON.stringify({generatedAt:new Date().toISOString(),shared},null,2)+'\n');
console.log(JSON.stringify(shared.slice(0,15),null,2));
