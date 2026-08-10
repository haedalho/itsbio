export type AbmCatalogGroup = {
  kind: "product" | "service";
  slug: string;
  title: string;
  description: string;
  href: string;
  sourceUrl?: string;
  children?: AbmServiceCategory[];
};

export type AbmServiceCategory = {
  slug: string;
  title: string;
  sourceUrl?: string;
  children?: AbmServiceCategory[];
};

export function abmCategorySlug(value: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

const serviceCategory = (
  title: string,
  sourceUrl?: string,
  children?: AbmServiceCategory[],
): AbmServiceCategory => ({ slug: abmCategorySlug(title), title, sourceUrl, children });

export const ABM_PRODUCT_GROUPS: AbmCatalogGroup[] = [
  {
    kind: "product",
    slug: "general-materials",
    title: "General Materials",
    description: "Molecular biology enzymes, reagents, antibodies, purification tools, equipment, and consumables.",
    href: "/products/abm/general-materials",
  },
  {
    kind: "product",
    slug: "cellular-materials",
    title: "Cellular Materials",
    description: "Cell lines, culture reagents, growth factors, contamination control, and cell-based research tools.",
    href: "/products/abm/cellular-materials",
  },
  {
    kind: "product",
    slug: "genetic-materials",
    title: "Genetic Materials",
    description: "Vectors, viruses, CRISPR tools, expression systems, and specialized genetic research materials.",
    href: "/products/abm/genetic-materials",
  },
];

export const ABM_SERVICE_GROUPS: AbmCatalogGroup[] = [
  {
    kind: "service",
    slug: "cell-and-antibody-services",
    title: "Cell & Antibody Services",
    description: "Custom cell line, cell engineering, antibody, and related laboratory services.",
    href: "/products/abm/services/cell-and-antibody-services",
    sourceUrl: "https://www.abmgood.com/Cell-Antibody-Services.html",
    children: [
      serviceCategory("3D and Organoid Services", "https://www.abmgood.com/3d-organoid-services.html"),
      serviceCategory("Cell Biology Services", "https://www.abmgood.com/Cell-Biology-Services.html", [
        serviceCategory("CRISPR Stable Knockout Cell Line"),
        serviceCategory("Cell Immortalization Service"),
        serviceCategory("Stable Cell Line Generation Service"),
        serviceCategory("Mycoplasma Detection & Decontamination Service"),
        serviceCategory("Cell Line Authentication Service"),
        serviceCategory("Gene Expression Assay Service"),
        serviceCategory("Cell Line Insurance"),
      ]),
      serviceCategory("Custom Antibody Engineering", "https://www.abmgood.com/Antibody-Services.html", [
        serviceCategory("Mouse Monoclonal Antibody Production"),
        serviceCategory("Rabbit Monoclonal Antibody Production"),
      ]),
      serviceCategory("Protein Services", "https://www.abmgood.com/Protein-Services.html", [
        serviceCategory("Custom Peptide Synthesis"),
        serviceCategory("Custom Protein Production"),
      ]),
      serviceCategory("Histology", "https://www.abmgood.com/Histology.html", [
        serviceCategory("IHC Staining"),
        serviceCategory("IHC Optimization"),
        serviceCategory("Custom Tissue Microarray"),
      ]),
    ],
  },
  {
    kind: "service",
    slug: "dna-and-cloning-services",
    title: "DNA & Cloning Services",
    description: "Gene synthesis, cloning, mutagenesis, and DNA preparation services.",
    href: "/products/abm/services/dna-and-cloning-services",
    sourceUrl: "https://www.abmgood.com/Custom-Cloning-Service.html",
    children: [
      serviceCategory("Custom CRISPR Vectors & Viruses", "https://www.abmgood.com/Custom-CRISPR-Vectors-Viruses.html", [
        serviceCategory("CRISPR sgRNA Lentiviral Vectors & Viruses"),
        serviceCategory("CRISPR sgRNA AAV Vectors & Viruses"),
        serviceCategory("CRISPR sgRNA Adenovirus"),
        serviceCategory("CRISPR sgRNA Non-Viral Vectors"),
        serviceCategory("CRISPR Knock-In Repair Templates"),
        serviceCategory("CRISPR Multiplex sgRNA Vector"),
        serviceCategory("CRISPR Targeted Lentiviral sgRNA Library"),
      ]),
      serviceCategory("Custom Cloning & Gene Synthesis", "https://www.abmgood.com/Custom-Cloning.html"),
      serviceCategory("Custom Vectors", "https://www.abmgood.com/Custom-Vectors.html", [
        serviceCategory("Custom Vector Design"),
        serviceCategory("circRNA Expression Vectors"),
        serviceCategory("Cre-Inducible Vectors (DIO)"),
      ]),
      serviceCategory("Primer & Probe Design", "https://www.abmgood.com/Primer-Design-Synthesis.html"),
    ],
  },
  {
    kind: "service",
    slug: "recombinant-virus-packaging",
    title: "Recombinant Virus Packaging",
    description: "Lentivirus, AAV, adenovirus, and other recombinant virus packaging services.",
    href: "/products/abm/services/recombinant-virus-packaging",
    sourceUrl: "https://www.abmgood.com/Virus-Packaging-Services.html",
    children: [
      serviceCategory("Recombinant Lentivirus", "https://www.abmgood.com/Custom-Lentivirus.html"),
      serviceCategory("Recombinant AAV", "https://www.abmgood.com/Custom-AAV.html"),
      serviceCategory("Recombinant Adenovirus", "https://www.abmgood.com/Custom-Adenovirus.html"),
      serviceCategory("Recombinant Retrovirus", "https://www.abmgood.com/Custom-Retrovirus.html"),
    ],
  },
];

export const ABM_CATALOG_GROUPS = [...ABM_PRODUCT_GROUPS, ...ABM_SERVICE_GROUPS];

export function findAbmCatalogGroup(kind: "product" | "service", slug?: string) {
  if (!slug) return undefined;
  const groups = kind === "product" ? ABM_PRODUCT_GROUPS : ABM_SERVICE_GROUPS;
  return groups.find((group) => group.slug === slug);
}

export function findAbmServiceCategory(path: string[]) {
  if (!path.length) return undefined;
  const root = ABM_SERVICE_GROUPS.find((group) => group.slug === path[0]);
  if (!root) return undefined;
  if (path.length === 1) return { ...root, path: [root.slug] };
  let children = root.children || [];
  let current: AbmServiceCategory | undefined;
  for (const slug of path.slice(1)) {
    current = children.find((node) => node.slug === slug);
    if (!current) return undefined;
    children = current.children || [];
  }
  return current ? { ...current, path } : undefined;
}

export function abmServiceCategoryHref(path: string[]) {
  return `/products/abm/services/${path.join("/")}`;
}

export function flattenAbmServiceCategories() {
  const out: Array<AbmServiceCategory & { path: string[]; rootTitle: string }> = [];
  const visit = (node: AbmServiceCategory, path: string[], rootTitle: string) => {
    const nextPath = [...path, node.slug];
    out.push({ ...node, path: nextPath, rootTitle });
    (node.children || []).forEach((child) => visit(child, nextPath, rootTitle));
  };
  for (const root of ABM_SERVICE_GROUPS) {
    const node: AbmServiceCategory = {
      slug: root.slug,
      title: root.title,
      sourceUrl: root.sourceUrl,
      children: root.children,
    };
    visit(node, [], root.title);
  }
  return out;
}

export function findAbmServicePathForLabels(labels: string[]) {
  const wanted = new Set(labels.map(normalized).filter(Boolean));
  const candidates = flattenAbmServiceCategories().filter((node) => wanted.has(normalized(node.title)));
  if (!candidates.length) return [];
  candidates.sort((a, b) => b.path.length - a.path.length);
  const deepest = candidates[0];
  return deepest.path.every((_, index) => {
    const ancestor = findAbmServiceCategory(deepest.path.slice(0, index + 1));
    return ancestor && wanted.has(normalized(ancestor.title));
  }) ? deepest.path : [deepest.path[0]];
}

function normalized(value: string) {
  return String(value || "").replace(/&/g, "and").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
}

export function abmRecordBelongsToGroup(
  record: {
    filterTitle?: string;
    filterPath?: string[];
    listingFilters?: Array<{ title?: string; path?: string[] }>;
  },
  group: AbmCatalogGroup,
) {
  const target = normalized(group.title);
  const values = [
    record.filterTitle,
    ...(record.filterPath || []),
    ...(record.listingFilters || []).flatMap((filter) => [filter.title, ...(filter.path || [])]),
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return values.some((value) => normalized(value) === target);
}

export function abmRecordBelongsToServicePath(
  record: {
    filterTitle?: string;
    filterPath?: string[];
    listingFilters?: Array<{ title?: string; path?: string[] }>;
    listingPaths?: string[][];
    breadcrumbs?: string[];
  },
  path: string[],
) {
  const node = findAbmServiceCategory(path);
  if (!node) return false;
  const root = ABM_SERVICE_GROUPS.find((group) => group.slug === path[0]);
  if (!root || !abmRecordBelongsToGroup(record, root)) return false;
  if (path.length === 1) return true;

  const wanted = path.map((slug, index) => normalized(findAbmServiceCategory(path.slice(0, index + 1))?.title || slug));
  const trails = [
    ...(record.listingPaths || []),
    ...(record.listingFilters || []).map((filter) => filter.path || []),
    record.breadcrumbs || [],
  ].filter((trail) => trail.length);
  return trails.some((trail) => {
    const values = trail.map(normalized);
    return wanted.every((label) => values.includes(label));
  });
}
