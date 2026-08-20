#!/usr/bin/env node
import fs from 'node:fs';

const file='app/products/kent/[[...path]]/page.tsx';
let s=fs.readFileSync(file,'utf8');
const old=`  {
    title: "Surgery",
    path: ["surgery"],
    children: [
      { title: "Surgical Instruments", path: ["surgery", "surgical-instruments"] },
      { title: "Surgical Instrument Kits", path: ["surgery", "surgical-instruments", "surgical-instrument-kits"] },
      { title: "Surgical Accessories", path: ["surgery", "surgical-accessories"] },
      { title: "Instrument Cleaning", path: ["surgery", "instrument-cleaning"] },
    ],
  },`;
const next=`  {
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
if(!s.includes(old)) {
  if(s.includes('title: "Bull Dog Clamps"') && s.includes('surgical-accessories-for-surgisuite')) {
    console.log('Kent priority category tree already patched.');
    process.exit(0);
  }
  throw new Error('Expected Surgery static menu block not found');
}
s=s.replace(old,next);
fs.writeFileSync(file,s);
console.log('Kent priority category tree patched.');
