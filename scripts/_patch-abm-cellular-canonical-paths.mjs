#!/usr/bin/env node
import fs from 'node:fs';

const file='app/products/abm/[[...path]]/page.tsx';
let s=fs.readFileSync(file,'utf8');
let changed=false;

function replaceOnce(oldText,newText,label){
  if(s.includes(oldText)){
    s=s.replace(oldText,newText);
    changed=true;
    console.log(`patched ${label}`);
    return;
  }
  if(s.includes(newText)){
    console.log(`${label} already patched`);
    return;
  }
  throw new Error(`Expected ${label} text not found`);
}

replaceOnce(
  'import { notFound } from "next/navigation";',
  'import { notFound, redirect } from "next/navigation";',
  'redirect import',
);

replaceOnce(
  '&& array::join(path, "/") == $pathStr',
  '&& lower(array::join(path, "/")) == lower($pathStr)',
  'case-insensitive category lookup',
);

const humanize=`function humanizeSegment(seg: string) {\n  return (seg || "").replaceAll("-", " ").replaceAll("_", " ").trim();\n}`;
const helper=`function humanizeSegment(seg: string) {\n  return (seg || "").replaceAll("-", " ").replaceAll("_", " ").trim();\n}\n\nfunction canonicalizeCellularPath(path: string[]) {\n  if (!Array.isArray(path) || path[0]?.toLowerCase() !== "cellular-materials") return path;\n  return path.map((segment) => String(segment || "").trim().toLowerCase());\n}\n\nfunction canonicalizeCellularCategory<T extends { path?: string[] }>(category: T): T {\n  if (!Array.isArray(category?.path) || category.path[0]?.toLowerCase() !== "cellular-materials") return category;\n  return { ...category, path: canonicalizeCellularPath(category.path) };\n}`;
if(!s.includes('function canonicalizeCellularPath(')) replaceOnce(humanize,helper,'Cellular path canonicalizer');

const pathBlock=`  const path = (resolved?.path ?? []) as string[];\n  const activeRoot = path[0] || "";`;
const newPathBlock=`  const rawPath = (resolved?.path ?? []) as string[];\n  const path = canonicalizeCellularPath(rawPath);\n  if (rawPath.join("/") !== path.join("/")) redirect(buildHref("abm", path));\n  const activeRoot = path[0] || "";`;
replaceOnce(pathBlock,newPathBlock,'Cellular lowercase redirect');

const dataBlock=`  const roots: CatLite[] = Array.isArray(data?.roots) ? data.roots : [];\n  const descendants: CatLite[] = Array.isArray(data?.descendants) ? data.descendants : [];\n  const category = data?.category || null;`;
const newDataBlock=`  const roots: CatLite[] = (Array.isArray(data?.roots) ? data.roots : []).map(canonicalizeCellularCategory);\n  const descendants: CatLite[] = (Array.isArray(data?.descendants) ? data.descendants : []).map(canonicalizeCellularCategory);\n  const category = data?.category\n    ? canonicalizeCellularCategory(data.category)\n    : null;`;
replaceOnce(dataBlock,newDataBlock,'Cellular category tree normalization');

if(changed) fs.writeFileSync(file,s);
console.log(changed?'ABM Cellular canonical paths patched.':'No ABM Cellular canonical path changes needed.');
