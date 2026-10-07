const PACKAGING_PATH = "genetic-materials/kits-for-viral-vectors/virus-packaging-dna-mixes";

// ABM category reviewed 2026-10-07. The workflow is the same official asset
// already rehosted for LV053 (original filename XLsbWjcEswBRFtRlopIQY0SnJXoULjIG3RJGpwGz.jpg).
const WORKFLOW = "https://cdn.sanity.io/images/9b5twpc8/production/35da2c880ee0ab3fe32ab098fd65f40934f3dc96-6619x3583.jpg?w=1600";

const PACKAGING_INTRO = `
<div data-itsbio-packaging-intro="true">
<ul>
  <li>Packaging mixes support lentivirus, retrovirus and AAV production.</li>
  <li>Lentiviral generations differ in how helper functions are separated; AAV mixes are selected by serotype.</li>
  <li>Compatible transfection, titration and transduction reagents complete the workflow.</li>
</ul>
<details class="itsbio-packaging-explainer">
<summary>What Is a Viral Packaging Mix? ↓ (Click to expand)</summary>
<div>
<p>A viral packaging mix is a combination of helper plasmids used to produce recombinant viral particles in mammalian producer cells, most commonly HEK293T cells. These plasmids provide the essential viral proteins required for assembly, replication, and packaging of viral genomes into infectious particles. The gene of interest is carried separately on a transfer vector, allowing researchers to generate viral vectors without directly handling fully replication-competent viruses.</p>
<p>Packaging plasmids are required because most viral vectors used in research have been engineered to remove genes necessary for replication. This makes them safer for laboratory use but also means they cannot produce viral particles on their own. Helper plasmids supply the missing functions in trans, enabling efficient production of lentivirus, retrovirus, or adeno-associated virus (AAV) particles depending on the system used.</p>
<p>Lentiviral packaging typically involves plasmids encoding structural proteins (Gag), enzymatic proteins (Pol), regulatory proteins (such as Rev in some systems), and an envelope protein such as VSV-G. These components assemble in producer cells to form lentiviral particles capable of integrating genetic cargo into dividing and non-dividing cells. Retroviral packaging systems are similar but are generally more limited to dividing cells and often use slightly different envelope and gag-pol configurations depending on the system design.</p>
<p>AAV packaging works differently from lentivirus and retrovirus systems. AAV requires rep and cap genes for replication and capsid formation, along with helper functions typically provided by adenoviral genes. Importantly, AAV vectors generally do not integrate into the host genome at high frequency, making them widely used for transient or long-term episomal gene expression in vivo and in vitro.</p>
<p>Viral genes are separated across multiple plasmids to improve biosafety and reduce the risk of generating replication-competent virus. By splitting essential viral functions into independent plasmids, the likelihood of recombination into a fully functional virus is extremely low under properly designed systems. Modern lentiviral systems further improve safety through self-inactivating (SIN) long terminal repeats (LTRs), which reduce transcriptional activity after integration into target cells.</p>
<p>Several factors influence viral titer and overall production efficiency, including plasmid design, DNA purity, transfection efficiency, ratio of packaging components, producer cell health, culture conditions, and harvest timing. Optimizing these parameters can significantly improve viral yield and consistency across experiments.</p>
<p>Overall, viral packaging mixes provide a standardized and reliable platform for producing high-quality viral vectors for gene delivery, stable cell line generation, CRISPR-based editing, and in vivo research applications, while maintaining multiple layers of experimental control and biosafety.</p>
<div class="abm-table-scroll" role="region" aria-label="Viral system comparison" tabindex="0">
<table data-itsbio-packaging-comparison="true">
<thead><tr><th>Feature</th><th>Lentivirus</th><th>Retrovirus</th><th>AAV</th></tr></thead>
<tbody>
<tr><td>Genome Integration</td><td>Yes</td><td>Yes</td><td>Typically No</td></tr>
<tr><td>Non-dividing Cells</td><td>Yes</td><td>Limited</td><td>Yes</td></tr>
<tr><td>Cargo Capacity</td><td>~8 kb</td><td>~8 kb</td><td>~4.7 kb</td></tr>
<tr><td>Long-term Expression</td><td>Excellent</td><td>Good</td><td>Excellent</td></tr>
<tr><td>Typical Applications</td><td>Stable expression, CRISPR</td><td>Stable expression in dividing cells</td><td>In vivo gene delivery</td></tr>
</tbody></table></div>
</div></details>
<h2>Why choose ABM packaging mixes?</h2>
<ul><li>Used in more than 70 publications</li><li>Quality-controlled formulations</li><li>Options across three viral systems</li><li>Broad transfer-vector compatibility</li><li>Designed for efficient production</li></ul>
<figure class="itsbio-packaging-workflow"><img src="${WORKFLOW}" alt="3rd Generation Lentivirus Packaging Workflow" width="800" height="433" loading="lazy"></figure>
</div>`;

type CategoryBlock = { _type?: string; _key?: string; html?: string; items?: unknown[]; [key: string]: unknown };

// These four official learning banners are already used in the staged ABM
// catalog. Match by destination so an unrelated resource is never relabeled.
const RESOURCE_IMAGES: Record<string, string> = {
  "https://info.abmgood.com/crispr-cas9-introduction": "5f0c10c80b571ccb9c4e2bc35b37c95f28ec71d5",
  "https://info.abmgood.com/lentivirus-system": "0caec06d93d610450943579e96cad0055bfe8cbe",
  "https://info.abmgood.com/adeno-associated-virus-aav": "84498ce2e5950b8c88f027760e3468b18580b038",
  "https://info.abmgood.com/adenovirus-system": "cccb94fc52073e518a9178d1bbb0881e3ec59d33",
};

function restoreResourceImages(block: CategoryBlock): CategoryBlock {
  if (!block.items) return block;
  const items = block.items.map((item) => {
    if (!item || typeof item !== "object") return item;
    const resource = item as Record<string, unknown>;
    const asset = RESOURCE_IMAGES[String(resource.href || "").replace(/\/$/, "")];
    if (!asset) return item;
    return { ...resource, imageUrl: resource.imageUrl || `https://cdn.sanity.io/images/9b5twpc8/production/${asset}-705x405.png`, imageFit: "contain" };
  });
  return items.every((item, index) => item === block.items?.[index]) ? block : { ...block, title: "Resources", items };
}

/** Restore the missing category sections without writing shared production CMS
 * data. The migrated product table and resource records remain authoritative. */
export function restorePackagingMixesBlocks(path: string, blocks: CategoryBlock[]): CategoryBlock[] {
  if (path !== PACKAGING_PATH) return blocks;
  const htmlIndex = blocks.findIndex((block) => block._type === "contentBlockHtml" && block.html?.trim());
  if (htmlIndex < 0) return blocks;
  const html = blocks[htmlIndex].html || "";
  const productsIndex = html.search(/<div\b[^>]*\bid=["']abm-category-section2["']/i);
  if (productsIndex < 0) return blocks;

  let restoredHtml = html;
  if (!/data-itsbio-packaging-intro|What Is a Viral Packaging Mix/i.test(html)) {
    restoredHtml = html.slice(0, productsIndex) + PACKAGING_INTRO + html.slice(productsIndex);
  }
  if (!/Virus Packaging DNA Mixes for Lentivirus/i.test(restoredHtml)) {
    restoredHtml = `<h2>Virus Packaging DNA Mixes for Lentivirus, Retrovirus, and AAV</h2>` + restoredHtml;
  }
  restoredHtml = restoredHtml.replace(/<table\b([^>]*\bid=["']table2["'][^>]*)>/i, (match, attributes) =>
    /data-itsbio-packaging-products/.test(match) ? match : `<table data-itsbio-packaging-products="true"${attributes}>`,
  );

  const remaining = blocks.filter((_, index) => index !== htmlIndex);
  const resources = remaining.filter((block) => block._type === "contentBlockResources").map(restoreResourceImages);
  const publications = remaining.filter((block) => block._type === "contentBlockPublications" && block.items?.length);
  const other = remaining.filter((block) => !["contentBlockResources", "contentBlockPublications", "contentBlockAbmPackagingVideo", "contentBlockAbmPackagingPublications"].includes(block._type || ""));
  return [
    { ...blocks[htmlIndex], html: restoredHtml },
    { _key: "packaging-video", _type: "contentBlockAbmPackagingVideo" },
    ...resources,
    ...(publications.length ? publications : [{ _key: "packaging-publications", _type: "contentBlockAbmPackagingPublications" }]),
    ...other,
  ];
}
