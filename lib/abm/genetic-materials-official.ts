export type GeneticOfficialNode = {
  key: string;
  label: string;
  aliases: string[];
  sourceUrl?: string;
  summary?: string;
  bullets?: string[];
  searchPrompt?: string;
  comparison?: Array<{ system: string; advantages: string; limitations: string }>;
  children?: GeneticOfficialNode[];
};

const node = (
  key: string,
  label: string,
  options: Omit<GeneticOfficialNode, "key" | "label" | "aliases"> & { aliases?: string[] } = {},
): GeneticOfficialNode => ({
  key,
  label,
  aliases: [label, ...(options.aliases || [])],
  sourceUrl: options.sourceUrl,
  summary: options.summary,
  bullets: options.bullets,
  searchPrompt: options.searchPrompt,
  comparison: options.comparison,
  children: options.children,
});

export const ABM_GENETIC_OFFICIAL_TREE: GeneticOfficialNode[] = [
  node("expression-ready-libraries", "Expression-Ready Libraries", {
    aliases: ["Expression Ready Libraries"],
    sourceUrl: "https://www.abmgood.com/expression-ready-libraries.html",
    summary:
      "ABM's expression-ready libraries provide pre-built gene expression tools across AAV, lentiviral and adenoviral systems. Choose the delivery system that fits the desired expression duration, payload size and cell type, then search the catalog by gene name, symbol or accession number.",
    searchPrompt: "Search expression-ready libraries by gene name, symbol or accession number",
    comparison: [
      { system: "AAV", advantages: "Low immunogenicity and long-term expression in many cell types", limitations: "Limited packaging capacity of about 4.7 kb" },
      { system: "Lentivirus", advantages: "Stable long-term expression through genomic integration", limitations: "Integration-related safety considerations" },
      { system: "Adenovirus", advantages: "Very high transduction efficiency and larger payload capacity", limitations: "Typically transient expression and a stronger immune response" },
    ],
    children: [
      node("lentiviral-vectors-virus", "Lentiviral Vectors & Virus", {
        aliases: ["Lentiviral Vectors and Virus", "Lentiviral Vectors and Viruses", "Lentiviral Vectors & Lentivirus"],
        sourceUrl: "https://www.abmgood.com/Lentivirus-System.html",
        summary:
          "Ready-to-use human, mouse and rat genes are available as lentiviral vectors or packaged recombinant lentivirus for gene over-expression across a broad range of host cells.",
        searchPrompt: "Search lentiviral vectors and virus by gene name, symbol or accession number",
        bullets: [
          "Large insert capacity up to approximately 9 kb",
          "High infection efficiency across dividing and non-dividing cells",
          "Stable genomic integration and long-term recombinant protein expression",
          "Useful for stable cell-line generation",
        ],
      }),
      node("aav-vectors-virus", "AAV Vectors & Virus", {
        aliases: ["AAV Vectors and Virus", "AAV Vectors and Viruses"],
        sourceUrl: "https://www.abmgood.com/AAV-Adeno-Associated-Virus.html",
        summary:
          "ABM's AAV library includes ready-to-use AAV vectors and packaged AAV across multiple serotypes for gene over-expression in a wide range of host cells and in vivo models.",
        searchPrompt: "Search AAV vectors and virus by gene name, symbol or accession number",
        bullets: [
          "Low immunogenicity in vivo",
          "Broad tropism with serotype-dependent tissue specificity",
          "No intended integration into the host genome",
          "Can transduce proliferating and quiescent cells",
          "Supports long-term expression in non-dividing cells",
        ],
      }),
      node("adenovirus", "Adenovirus", {
        aliases: ["Adenoviral Virus", "Adenovirus Library"],
        summary:
          "Ready-to-use recombinant adenoviruses provide rapid, high-efficiency transient gene expression and accommodate larger payloads than AAV-based systems.",
        searchPrompt: "Search adenovirus products by gene name, symbol or accession number",
      }),
      node("sirna", "siRNA", {
        aliases: ["siRNA Libraries"],
        summary:
          "ABM's siRNA tools support gene knockdown with ready-to-use expression constructs and multiple delivery formats for transient or longer-term silencing workflows.",
        searchPrompt: "Search siRNA products by gene name, symbol or accession number",
        children: [
          node("sirna-lentivirus", "siRNA Lentivirus", { aliases: ["siRNA Lentiviral"] }),
          node("sirna-aav", "siRNA AAV"),
          node("sirna-dsrna-oligo", "siRNA dsRNA Oligo", { aliases: ["siRNA Oligo", "dsRNA Oligo"] }),
        ],
      }),
      node("mirna", "miRNA", { aliases: ["microRNA"] }),
      node("orf-vectors", "ORF Vectors", { aliases: ["ORF Vector"] }),
      node("circrna", "circRNA", {
        aliases: ["Circular RNA"],
        sourceUrl: "https://www.abmgood.com/circRNA.html",
        summary:
          "ABM's circRNA tools support circular RNA expression, isolation and analysis workflows, including expression vectors, purification tools and supporting research resources.",
      }),
      node("control-vectors-viruses", "Control Vectors & Viruses", {
        aliases: ["Control Vectors and Viruses", "Control Vectors"],
      }),
    ],
  }),
  node("crispr", "CRISPR", {
    aliases: ["CRISPR Products for Genome Editing", "CRISPR Products for Genome E"],
    sourceUrl: "https://www.abmgood.com/CRISPR-Cas9-sgRNA.html",
    summary:
      "ABM provides CRISPR/Cas9 research tools under access to the ERS CRISPR/Cas9 patent portfolio. The catalog includes knockout, activation, Cas9 delivery and screening products, with gene-specific libraries searchable by gene name or accession number.",
    searchPrompt: "Search the CRISPR sgRNA library by gene name, symbol or accession number",
    children: [
      node("crispr-ko-vectors-virus", "CRISPR KO Vectors & Virus", {
        aliases: [
          "CRISPR KO Vectors and Virus",
          "CRISPR KO Vectors and Viruses",
          "CRISPR sgRNA Library",
          "CRISPR Knockout Library",
          "CRISPR Cas9 sgRNA Expression Vectors and Virus",
        ],
        sourceUrl: "https://www.abmgood.com/crispr-knockout-library.html",
        summary:
          "CRISPR knockout vectors deliver Cas nuclease and sgRNA components for targeted gene disruption. ABM offers lentiviral, AAV and non-viral formats so the delivery method can be matched to the experimental model.",
        searchPrompt: "Search CRISPR knockout products by gene name, symbol or accession number",
      }),
      node("crispr-activation-vectors", "CRISPR Activation Vectors", {
        aliases: ["CRISPR Activation", "CRISPRa Vectors"],
        sourceUrl: "https://www.abmgood.com/crispr-activation-lentivirus-library.html",
        summary:
          "CRISPR activation uses sgRNAs targeted near the 5' regulatory region together with dCas9-VPR to increase expression of a selected gene without introducing a permanent double-strand break.",
        searchPrompt: "Search CRISPR activation sgRNA products by gene name, symbol or accession number",
      }),
      node("cas9-vectors-virus", "Cas9 Vectors & Virus", {
        aliases: ["Cas9 Vectors and Virus", "Cas9 Vectors and Viruses", "Cas9 Expression Vectors and Virus", "Cas9 Expression Vectors and Viruses"],
      }),
      node("cas-proteins-screening", "Cas Proteins & CRISPR Screening", {
        aliases: ["Cas Proteins and CRISPR Screening"],
      }),
    ],
  }),
  node("expression-systems", "Expression Systems", {
    sourceUrl: "https://www.abmgood.com/expression-systems.html",
    summary:
      "ABM's recombinant viral expression systems include ready-to-use lentiviral, AAV, adenoviral and retroviral vectors for introducing a gene of interest into experimental cells and models.",
    children: [
      node("lentiviral-vectors", "Lentiviral Vectors", { aliases: ["Lentivirus Expression System"] }),
      node("aav-vectors", "AAV Vectors", { aliases: ["AAV Expression System"] }),
      node("adenoviral-vectors", "Adenoviral Vectors", { aliases: ["Adenovirus Vectors", "Adenoviral Expression Vectors"] }),
      node("retroviral-vectors", "Retroviral Vectors", { aliases: ["Retrovirus Vectors"] }),
    ],
  }),
  node("specialized-vectors", "Specialized Vectors", {
    aliases: ["Specialized Vectors & Viruses", "Specialized Vectors and Viruses"],
    sourceUrl: "https://www.abmgood.com/Vectors.html",
    summary:
      "ABM's specialized vector collection covers focused expression systems and reporter tools for applications that fall outside the standard expression-ready libraries.",
    children: [
      node("targeted-cell-apoptosis-adenoviruses", "Targeted Cell Apoptosis Adenoviruses", { aliases: ["Targeted Cell Apoptosis Adenovirus"] }),
      node("ipsc-reporters", "iPSC Reporters", { aliases: ["iPSC Reporter"] }),
    ],
  }),
  node("kits-for-viral-vectors", "Kits for Viral Vectors", {
    aliases: ["Kits Related to Recombinant Virus", "Recombinant Virus Kits"],
    sourceUrl: "https://www.abmgood.com/Recombinant-Virus-Kits.html",
    summary:
      "ABM's viral-vector kit range covers virus packaging, titer measurement, transduction enhancement, purification and bundled starter workflows for recombinant virus experiments.",
    children: [
      node("virus-packaging-dna-mixes", "Virus Packaging DNA Mixes", { aliases: ["Virus Packaging Mixes"] }),
      node("qpcr-virus-titer-kits", "qPCR Virus Titer Kits", { aliases: ["Virus Titer Kits", "qPCR Viral Titer Kits"] }),
      node("virus-transduction-enhancer", "Virus Transduction Enhancer", { aliases: ["Virus Transduction Enhancers"] }),
      node("virus-purification-kits", "Virus Purification Kits", { aliases: ["Virus Purification Kit"] }),
      node("lentivirus-bundles", "Lentivirus Bundles", { aliases: ["Lentiviral Bundles"] }),
    ],
  }),
];

export function normalizeGeneticLabel(value: string) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function flattenGeneticOfficialTree(nodes = ABM_GENETIC_OFFICIAL_TREE) {
  const out: GeneticOfficialNode[] = [];
  const visit = (items: GeneticOfficialNode[]) => {
    items.forEach((item) => {
      out.push(item);
      if (item.children?.length) visit(item.children);
    });
  };
  visit(nodes);
  return out;
}

export function geneticNodeMatches(node: GeneticOfficialNode, ...values: Array<string | undefined>) {
  const aliases = node.aliases.map(normalizeGeneticLabel);
  return values
    .map((value) => normalizeGeneticLabel(value || ""))
    .filter(Boolean)
    .some((value) => aliases.some((alias) => value === alias || value.startsWith(`${alias} `) || alias.startsWith(`${value} `)));
}
