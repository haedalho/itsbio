#!/usr/bin/env node
import fs from 'node:fs';

const file='app/products/kent/[[...path]]/page.tsx';
let s=fs.readFileSync(file,'utf8');
let changed=false;

function replaceExact(oldText,newText,label){
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
  throw new Error(`Expected ${label} block not found`);
}

const oldNbp=`  {
    title: "Non-invasive Blood Pressure",
    path: ["noninvasive-blood-pressure"],
    children: [
      {
        title: "Non-Invasive Blood Pressure Accessories",
        path: ["noninvasive-blood-pressure", "noninvasive-blood-pressure-accessories"],
      },
      {
        title: "Accessories for CODA® Monitor",
        path: ["noninvasive-blood-pressure", "noninvasive-blood-pressure-accessories", "accessories-for-coda-monitor"],
      },
      {
        title: "CODA® Cuffs",
        path: [
          "noninvasive-blood-pressure",
          "noninvasive-blood-pressure-accessories",
          "accessories-for-coda-monitor",
          "coda-cuffs",
        ],
      },
    ],
  },`;
const newNbp=`  {
    title: "Non-invasive Blood Pressure",
    path: ["noninvasive-blood-pressure"],
    children: [
      {
        title: "Non-Invasive Blood Pressure Accessories",
        path: ["noninvasive-blood-pressure", "noninvasive-blood-pressure-accessories"],
        children: [
          {
            title: "Accessories for CODA® Monitor",
            path: ["noninvasive-blood-pressure", "noninvasive-blood-pressure-accessories", "accessories-for-coda-monitor"],
            children: [
              {
                title: "CODA® Cuffs",
                path: [
                  "noninvasive-blood-pressure",
                  "noninvasive-blood-pressure-accessories",
                  "accessories-for-coda-monitor",
                  "coda-cuffs",
                ],
              },
            ],
          },
        ],
      },
    ],
  },`;
replaceExact(oldNbp,newNbp,'non-invasive blood pressure hierarchy');

const oldPhys=`  {
    title: "Physiological Monitoring",
    path: ["physiological-monitoring"],
    children: [
      {
        title: "Physiological Monitoring Accessories",
        path: ["physiological-monitoring", "physiological-monitoring-accessories"],
      },
      {
        title: "Pulse Oximetry",
        path: ["physiological-monitoring", "physiological-monitoring-accessories", "pulse-oximetry"],
      },
      {
        title: "Temperature",
        path: ["physiological-monitoring", "physiological-monitoring-accessories", "temperature"],
      },
    ],
  },`;
const newPhys=`  {
    title: "Physiological Monitoring",
    path: ["physiological-monitoring"],
    children: [
      {
        title: "Physiological Monitoring Accessories",
        path: ["physiological-monitoring", "physiological-monitoring-accessories"],
        children: [
          {
            title: "Pulse Oximetry",
            path: ["physiological-monitoring", "physiological-monitoring-accessories", "pulse-oximetry"],
          },
          {
            title: "Temperature",
            path: ["physiological-monitoring", "physiological-monitoring-accessories", "temperature"],
          },
        ],
      },
    ],
  },`;
replaceExact(oldPhys,newPhys,'physiological monitoring hierarchy');

const oldSurgery=`  {
    title: "Surgery",
    path: ["surgery"],
    children: [
      { title: "Surgical Instruments", path: ["surgery", "surgical-instruments"] },
      { title: "Surgical Instrument Kits", path: ["surgery", "surgical-instruments", "surgical-instrument-kits"] },
      { title: "Surgical Accessories", path: ["surgery", "surgical-accessories"] },
      { title: "Instrument Cleaning", path: ["surgery", "instrument-cleaning"] },
    ],
  },`;
const newSurgery=`  {
    title: "Surgery",
    path: ["surgery"],
    children: [
      {
        title: "Surgical Instruments",
        path: ["surgery", "surgical-instruments"],
        children: [
          {
            title: "Forceps",
            path: ["surgery", "surgical-instruments", "forceps"],
            children: [
              { title: "Dressing Forceps", path: ["surgery", "surgical-instruments", "forceps", "dressing-forceps"] },
              { title: "Hemostat Forceps", path: ["surgery", "surgical-instruments", "forceps", "hemostat-forceps"] },
            ],
          },
          {
            title: "Laboratory Scissors",
            path: ["surgery", "surgical-instruments", "laboratory-scissors"],
            children: [
              { title: "Micro Scissors", path: ["surgery", "surgical-instruments", "laboratory-scissors", "micro-scissors"] },
            ],
          },
          { title: "Needle Holders", path: ["surgery", "surgical-instruments", "needle-holders"] },
          { title: "Surgical Instrument Kits", path: ["surgery", "surgical-instruments", "surgical-instrument-kits"] },
          { title: "Surgical Tweezers", path: ["surgery", "surgical-instruments", "surgical-tweezers"] },
          {
            title: "Wound Closure",
            path: ["surgery", "surgical-instruments", "wound-closure"],
            children: [
              { title: "Autoclips", path: ["surgery", "surgical-instruments", "wound-closure", "autoclips"] },
              { title: "Bull Dog Clamps", path: ["surgery", "surgical-instruments", "wound-closure", "bull-dog-clamps"] },
              { title: "Reflex Clips", path: ["surgery", "surgical-instruments", "wound-closure", "reflex-clips"] },
            ],
          },
        ],
      },
      {
        title: "Surgical Accessories",
        path: ["surgery", "surgical-accessories"],
        children: [
          { title: "Surgical Accessories for SurgiSuite", path: ["surgery", "surgical-accessories", "surgical-accessories-for-surgisuite"] },
        ],
      },
      { title: "Instrument Cleaning", path: ["surgery", "instrument-cleaning"] },
    ],
  },`;
replaceExact(oldSurgery,newSurgery,'surgery hierarchy');

const landingMarker='const LANDING_FALLBACK_PATHS = new Set(["anesthesia"]);';
const cleanSet=`const LANDING_FALLBACK_PATHS = new Set(["anesthesia"]);\nconst CLEAN_CATEGORY_LANDING_PATHS = new Set([\n  "physiological-monitoring/physiological-monitoring-accessories",\n  "noninvasive-blood-pressure/noninvasive-blood-pressure-accessories",\n  "noninvasive-blood-pressure/noninvasive-blood-pressure-accessories/accessories-for-coda-monitor",\n  "surgery/surgical-instruments",\n  "surgery/surgical-accessories",\n]);`;
if(!s.includes('const CLEAN_CATEGORY_LANDING_PATHS = new Set([')){
  if(!s.includes(landingMarker)) throw new Error('landing marker not found');
  s=s.replace(landingMarker,cleanSet);
  changed=true;
  console.log('added clean landing path set');
}

const oldLanding=`    if (renderedBlocks) {
      mainContent = <div className="mt-4">{renderedBlocks}</div>;
    } else if (hasFallbackHtml) {
      mainContent = <KentHtmlFallback html={fallbackHtml} />;
    } else if (directChildren.length) {
      mainContent = <KentChildCategoryGrid items={directChildren} products={allProducts} title="Explore categories" theme={THEME_KENT} />;
    } else if (category.summary) {`;
const newLanding=`    if (renderedBlocks) {
      mainContent = <div className="mt-4">{renderedBlocks}</div>;
    } else if (CLEAN_CATEGORY_LANDING_PATHS.has(pathStr) && directChildren.length) {
      mainContent = (
        <>
          <KentChildCategoryGrid items={directChildren} products={allProducts} title="Explore categories" theme={THEME_KENT} />
          {productsInCategory.length ? (
            <>
              <ListingHeader count={officialProductCount} theme={THEME_KENT} />
              <KentProductGrid products={productsInCategory} theme={THEME_KENT} />
            </>
          ) : null}
        </>
      );
    } else if (hasFallbackHtml) {
      mainContent = <KentHtmlFallback html={fallbackHtml} />;
    } else if (directChildren.length) {
      mainContent = <KentChildCategoryGrid items={directChildren} products={allProducts} title="Explore categories" theme={THEME_KENT} />;
    } else if (category.summary) {`;
if(s.includes(oldLanding)){
  s=s.replace(oldLanding,newLanding);
  changed=true;
  console.log('patched clean priority landing rendering');
}else if(s.includes('CLEAN_CATEGORY_LANDING_PATHS.has(pathStr) && directChildren.length')){
  console.log('clean priority landing rendering already patched');
}else{
  throw new Error('landing rendering block not found');
}

if(changed) fs.writeFileSync(file,s);
console.log(changed?'Kent priority sections patched.':'No Kent priority section changes needed.');
