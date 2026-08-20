#!/usr/bin/env node
import fs from 'node:fs';

const file='app/products/kent/[[...path]]/page.tsx';
let s=fs.readFileSync(file,'utf8');

const deepNbp=`  {
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
const flatNbp=`  {
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

const deepPhys=`  {
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
const flatPhys=`  {
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

const deepSurgery=`  {
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
const flatSurgery=`  {
    title: "Surgery",
    path: ["surgery"],
    children: [
      { title: "Surgical Instruments", path: ["surgery", "surgical-instruments"] },
      { title: "Surgical Instrument Kits", path: ["surgery", "surgical-instruments", "surgical-instrument-kits"] },
      { title: "Surgical Accessories", path: ["surgery", "surgical-accessories"] },
      { title: "Instrument Cleaning", path: ["surgery", "instrument-cleaning"] },
    ],
  },`;

for (const [from,to,label] of [[deepNbp,flatNbp,'NBP'],[deepPhys,flatPhys,'Phys'],[deepSurgery,flatSurgery,'Surgery']]) {
  if (!s.includes(from)) throw new Error(`Expected ${label} deep menu block not found`);
  s=s.replace(from,to);
}
fs.writeFileSync(file,s);
console.log('Kent sidebar depth restored; page content changes preserved.');
