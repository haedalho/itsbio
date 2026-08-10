export type AbmCatalogGroup = {
  kind: "product" | "service";
  slug: string;
  title: string;
  description: string;
  href: string;
};

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
  },
  {
    kind: "service",
    slug: "dna-and-cloning-services",
    title: "DNA & Cloning Services",
    description: "Gene synthesis, cloning, mutagenesis, and DNA preparation services.",
    href: "/products/abm/services/dna-and-cloning-services",
  },
  {
    kind: "service",
    slug: "recombinant-virus-packaging",
    title: "Recombinant Virus Packaging",
    description: "Lentivirus, AAV, adenovirus, and other recombinant virus packaging services.",
    href: "/products/abm/services/recombinant-virus-packaging",
  },
];

export const ABM_CATALOG_GROUPS = [...ABM_PRODUCT_GROUPS, ...ABM_SERVICE_GROUPS];

export function findAbmCatalogGroup(kind: "product" | "service", slug?: string) {
  if (!slug) return undefined;
  const groups = kind === "product" ? ABM_PRODUCT_GROUPS : ABM_SERVICE_GROUPS;
  return groups.find((group) => group.slug === slug);
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
