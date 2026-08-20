import { NextResponse } from "next/server";

import { getAbmStagedRecords } from "@/lib/abm/rebuild-staging";

type ModelType = "Immortalized Cells" | "Tumor Cells" | "Primary Cells";
type Rule = readonly [label: string, matcher: RegExp];

const SPECIES: readonly Rule[] = [
  ["Human (H. sapiens)", /\bhuman\b|h\.\s*sapiens/i],
  ["Mouse (M. musculus)", /\bmouse\b|m\.\s*musculus/i],
  ["Rat (R. norvegicus)", /\brat\b|r\.\s*norvegicus/i],
  ["Bat (Chiroptera)", /\bbat\b|chiroptera/i],
  ["Bottlenose Dolphin (Tursiops)", /dolphin|tursiops/i],
  ["Monkey (Primate)", /monkey|primate|marmoset|macaque/i],
  ["Dog (Canine)", /canine|\bdog\b/i],
  ["Cat (Feline)", /feline|\bcat\b/i],
  ["Cow (Bovine)", /bovine|\bcow\b/i],
  ["Pig (Porcine)", /porcine|\bpig\b/i],
  ["Rabbit", /rabbit/i],
  ["Chicken / Avian", /avian|chicken|\bbird\b/i],
  ["Horse (Equine)", /equine|\bhorse\b/i],
  ["Sheep / Ovine", /ovine|\bsheep\b/i],
  ["Fish", /zebrafish|\bfish\b/i],
];

const SYSTEMS: readonly Rule[] = [
  ["Lymphatic System", /lymph|lymphatic/i],
  ["Male Reproductive System", /male reproductive|testis|testicular|testes|prostate|seminal/i],
  ["Female Reproductive System", /female reproductive|ovary|ovarian|uter|cervix|placenta/i],
  ["Musculoskeletal System", /musculoskeletal|skeletal|muscle|bone|cartilage|oste|chondro/i],
  ["Nervous System", /nervous|neural|neuron|brain|glia|astro|microglia/i],
  ["Respiratory System", /respiratory|lung|airway|bronch|pulmonary/i],
  ["Digestive System", /digestive|hepatic|liver|stomach|intestinal|colon|oral|mouth|pancrea/i],
  ["Cardiovascular System", /cardio|vascular|heart|artery|endothelial|smooth muscle/i],
  ["Embryonic System", /embryo|embryonic|umbilical|cord/i],
  ["Integumentary System", /skin|dermal|keratin|melanocyte|hair|follicle/i],
  ["Immune System", /immune|blood|mast|t cell|b cell|myeloid|hematopo|promyelocyte/i],
  ["Urinary System", /urinary|kidney|renal|bladder/i],
  ["Endocrine System", /endocrine|thyroid|adrenal|pituitary/i],
  ["Sensory System", /retina|retinal|cornea|ocular|eye|ear|auditory/i],
];

const CELL_TYPES: readonly Rule[] = [
  ["Skin", /skin|keratinocyte/i],
  ["Liver", /hepatocyte|hepatic|\bliver\b/i],
  ["Bone Marrow", /bone marrow|promyelocyte/i],
  ["Cartilage", /cartilage|chondrocyte|chondroblast/i],
  ["Skeletal Muscle", /skeletal muscle|myoblast|myocyte/i],
  ["Smooth Muscle", /smooth muscle/i],
  ["Umbilical Cord", /umbilical cord|umbilical artery|umbilical vein/i],
  ["Mouth/Oral", /mouth|oral|lingual|periodontal/i],
  ["Cervix", /cervix|cervical/i],
  ["Colon", /\bcolon\b|colonic/i],
  ["Connective Tissue", /connective|fibroblast/i],
  ["Cord Blood", /cord blood/i],
  ["Ear", /\bear\b|auditory/i],
  ["Kidney", /kidney|renal/i],
  ["Lung", /\blung\b|pulmonary|bronch|airway/i],
  ["Brain", /\bbrain\b|cerebral/i],
  ["Neuron", /neuron|neuronal|neural/i],
  ["Astrocyte", /astrocyte|astroglia/i],
  ["Microglia", /microglia/i],
  ["Endothelial", /endothelial/i],
  ["Epithelial", /epithelial|epithelium/i],
  ["Fibroblast", /fibroblast/i],
  ["Melanocyte", /melanocyte/i],
  ["Mast Cell", /mast cell/i],
  ["T Cell", /t cell|t-cell/i],
  ["B Cell", /b cell|b-cell/i],
  ["Macrophage", /macrophage/i],
  ["Stem / Progenitor", /stem|progenitor/i],
  ["Embryo", /embryo|embryonic/i],
  ["Adipose", /adipocyte|adipose/i],
  ["Pancreas", /pancrea/i],
  ["Prostate", /prostate/i],
  ["Ovary", /ovary|ovarian/i],
  ["Placenta", /placenta/i],
  ["Retina / Eye", /retina|retinal|ocular|cornea|\beye\b/i],
  ["Testes", /testis|testicular|testes/i],
];

type Record = Awaited<ReturnType<typeof getAbmStagedRecords>>[number];

function recordText(record: Record) {
  return [
    record.title,
    record.sku,
    record.searchCategory,
    record.filterTitle,
    ...(record.filterPath || []),
    ...(record.listingFilters || []).flatMap((filter) => [filter.title, ...(filter.path || [])]),
  ].filter(Boolean).join(" ");
}

function exactFilterValues(record: Record) {
  return (record.listingFilters || []).flatMap((filter) => [String(filter.title || ""), ...(filter.path || []).map(String)]).filter(Boolean);
}

function labelsFor(record: Record, rules: readonly Rule[]) {
  const exactValues = exactFilterValues(record);
  const text = recordText(record);
  const exactMatches = rules.filter(([, matcher]) => exactValues.some((value) => matcher.test(value))).map(([label]) => label);
  if (exactMatches.length) return Array.from(new Set(exactMatches));
  return rules.filter(([, matcher]) => matcher.test(text)).map(([label]) => label);
}

function classify(record: Record): ModelType | undefined {
  const title = String(record.title || "").toLowerCase();
  const sku = String(record.sku || "").trim();
  const text = recordText(record).toLowerCase();
  const isTSeries = /^t\d{3,}/i.test(sku);
  const looksLikeCellProduct = isTSeries || /\bcell(?:s| line| lines)?\b/i.test(text);
  if (!looksLikeCellProduct) return undefined;

  if (/primary cells?|primary-cell/i.test(text) || /\bprimary\b/i.test(title)) return "Primary Cells";
  if (/tumou?r cell lines?|cancer cell lines?|\btumou?r\b|\bcancer\b/i.test(text)) return "Tumor Cells";
  if (/immortalized cell lines?|\bimmortalized\b/i.test(text)) return "Immortalized Cells";

  if (isTSeries) {
    const separateCollection = /\b(crispr|knockout|ko cell|cas9|stable cell|reporter|overexpress|stem cell[- ]derived|hematopoietic|organoid|3d cell)\b/i.test(text);
    if (!separateCollection) return "Immortalized Cells";
  }
  return undefined;
}

export async function GET() {
  const records = await getAbmStagedRecords("product");
  const items = records.flatMap((record) => {
    const modelType = classify(record);
    if (!modelType) return [];
    const species = labelsFor(record, SPECIES);
    const bioSystems = labelsFor(record, SYSTEMS);
    const cellTypes = labelsFor(record, CELL_TYPES);
    return [{
      title: record.title,
      sku: record.sku,
      url: record.url,
      unit: record.unit,
      previewImage: record.previewImage,
      searchCategory: record.searchCategory,
      filterTitle: record.filterTitle,
      filterPath: record.filterPath,
      listingFilters: record.listingFilters,
      modelType,
      species,
      bioSystems,
      cellTypes,
    }];
  });

  const unique = Array.from(new Map(items.map((item) => [`${item.modelType}:${item.sku || item.url}`, item])).values());

  return NextResponse.json(
    { items: unique },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
